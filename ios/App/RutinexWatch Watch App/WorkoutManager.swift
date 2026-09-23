//
//  WorkoutManager.swift
//  RutinexWatch
//
//  Entreno en el Watch (HKWorkoutSession + HKLiveWorkoutBuilder) y canal con
//  el iPhone (WatchConnectivity). Con un entreno activo watchOS mantiene la
//  app viva con la muñeca bajada: por eso el temporizador del descanso vibra
//  a su hora. Sin entreno, restStart responde ok=false y avisa el iPhone.

import Combine
import Foundation
import HealthKit
import UserNotifications
import WatchConnectivity
import WatchKit

/// Cada tipo acaba en Health con el workoutType que ya reconoce
/// src/lib/appleHealth.js (cardio y fuerza).
enum WorkoutKind: String, CaseIterable, Identifiable {
    case andar = "Andar en cinta"
    case correr = "Correr en cinta"
    case eliptica = "Elíptica"
    case bici = "Bicicleta"
    case fuerza = "Fuerza"

    var id: String { rawValue }

    /// Para reconstruir el tipo al recuperar una sesión huérfana, donde lo
    /// único que queda es el activityType de su configuración.
    init?(activityType: HKWorkoutActivityType) {
        switch activityType {
        case .walking: self = .andar
        case .running: self = .correr
        case .elliptical: self = .eliptica
        case .cycling: self = .bici
        case .traditionalStrengthTraining: self = .fuerza
        default: return nil
        }
    }

    var configuration: HKWorkoutConfiguration {
        let config = HKWorkoutConfiguration()
        config.locationType = .indoor
        switch self {
        case .andar: config.activityType = .walking
        case .correr: config.activityType = .running
        case .eliptica: config.activityType = .elliptical
        case .bici: config.activityType = .cycling
        case .fuerza: config.activityType = .traditionalStrengthTraining
        }
        return config
    }
}

@MainActor
final class WorkoutManager: NSObject, ObservableObject {
    @Published var kind: WorkoutKind?
    @Published var startDate: Date?
    @Published var heartRate: Int?
    @Published var calories = 0
    @Published var restEndDate: Date?
    @Published var errorMessage: String?
    // Diagnóstico temporal (23-09-2026): saber si el fallo está en que el
    // mensaje del descanso no llega al reloj, o en que llega y el aviso no
    // suena. Se ve en la pantalla del entreno; quitar cuando esté resuelto.
    @Published var restsReceived = 0
    @Published var alertsFired = 0
    @Published var lastState = 0
    // Acota cuándo muere la sesión: la última vez que se la vio en marcha y
    // el momento en que se la encontró muerta. Sobrevive a clearSession a
    // propósito, para poder leerlo después en la pantalla de inicio.
    @Published var deathNote: String?
    private var watchdog: Timer?
    private var lastAliveAt: Date?

    private let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var restTimer: Timer?
    // watchOS solo permite una HKWorkoutSession activa a la vez. session.end()
    // dispara el cierre pero no lo confirma en el acto — la confirmación llega
    // luego por didChangeTo. Sin esperarla, el flujo del manual (cardio →
    // Terminar → Fuerza, sin pausa) puede arrancar la sesión de Fuerza
    // mientras la de cardio todavía se está cerrando, y el sistema la mata:
    // entreno "zombi", sin descanso ni vibración, y luego el error al terminar.
    private var sessionEndedContinuation: CheckedContinuation<Void, Never>?
    // true mientras end() está cerrando a propósito. Distingue ese cierre
    // normal del que hace watchOS por su cuenta, que es el único que debe
    // avisar de entreno zombi.
    private var isEndingDeliberately = false

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
        UNUserNotificationCenter.current().delegate = self
        Task {
            _ = try? await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound])
            await recoverOrphanedSession()
        }
    }

    // MARK: - Entreno

    /// Si la app muere a mitad de un entreno, watchOS NO mata la sesión: la
    /// deja viva a nivel de sistema. Al volver a arrancar, la app no sabe que
    /// existe, así que no puede ni usarla ni cerrarla, y todo intento falla
    /// con "Unable to end a workout that is not currently active" — en cada
    /// arranque, hasta reiniciar el reloj. Aquí se reengancha a esa sesión.
    private func recoverOrphanedSession() async {
        guard session == nil else { return }
        do {
            guard let recovered = try await store.recoverActiveWorkoutSession() else { return }
            let builder = recovered.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(
                healthStore: store,
                workoutConfiguration: recovered.workoutConfiguration
            )
            recovered.delegate = self
            builder.delegate = self

            // Un tipo que la app no reconoce no se puede pintar; se cierra
            // para no dejar la sesión huérfana dando guerra.
            guard let recoveredKind = WorkoutKind(activityType: recovered.workoutConfiguration.activityType) else {
                session = recovered
                self.builder = builder
                await end()
                return
            }

            session = recovered
            self.builder = builder
            kind = recoveredKind
            startDate = recovered.startDate
            startWatchdog()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func start(_ kind: WorkoutKind) async {
        errorMessage = nil
        do {
            try await store.requestAuthorization(
                toShare: [HKObjectType.workoutType()],
                read: [HKQuantityType(.heartRate), HKQuantityType(.activeEnergyBurned)]
            )

            let config = kind.configuration
            let session = try HKWorkoutSession(healthStore: store, configuration: config)
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: config)
            session.delegate = self
            builder.delegate = self

            let start = Date()
            session.startActivity(with: start)
            try await builder.beginCollection(at: start)

            self.session = session
            self.builder = builder
            self.kind = kind
            startDate = start
            heartRate = nil
            calories = 0
            startWatchdog()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func end() async {
        guard let session, let builder else { return }

        // El delegado didChangeTo no siempre llega (si watchOS cerró la sesión
        // con la app congelada, el aviso puede perderse). Preguntar el estado
        // es fiable: sin esto, cerrar una sesión ya muerta solo produce
        // "Unable to end a workout that is not currently active".
        guard session.state != .ended else {
            clearSession(message: "El entreno se cerró solo. Vuelve a empezarlo.")
            return
        }

        isEndingDeliberately = true
        cancelRest()
        session.end()
        do {
            try await builder.endCollection(at: Date())
            _ = try await builder.finishWorkout()
        } catch {
            errorMessage = error.localizedDescription
        }
        await waitForSessionEnd()
        self.session = nil
        self.builder = nil
        kind = nil
        startDate = nil
        heartRate = nil
        isEndingDeliberately = false
    }

    /// Deja la app como recién abierta. `message` avisa de un cierre que no
    /// pidió quien entrena; nil para el cierre normal.
    private func clearSession(message: String?) {
        watchdog?.invalidate()
        watchdog = nil
        cancelRest()
        session = nil
        builder = nil
        kind = nil
        startDate = nil
        heartRate = nil
        errorMessage = message
    }

    /// El delegado no avisa cuando watchOS mata la sesión, así que hay que
    /// preguntar. Diagnóstico temporal (23-09-2026).
    private func startWatchdog() {
        watchdog?.invalidate()
        deathNote = nil
        lastAliveAt = Date()
        let timer = Timer(timeInterval: 5, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.checkAlive() }
        }
        RunLoop.main.add(timer, forMode: .common)
        watchdog = timer
    }

    private func checkAlive() {
        guard let session, deathNote == nil else { return }
        if session.state == .running || session.state == .prepared {
            lastAliveAt = Date()
            return
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        let alive = lastAliveAt.map(formatter.string(from:)) ?? "?"
        deathNote = "viva \(alive) · muerta \(formatter.string(from: Date())) · est \(session.state.rawValue)"
    }

    /// Espera a que HealthKit confirme el cierre (vía didChangeTo) antes de
    /// dejar que start() cree la siguiente sesión. 3s de margen: si la
    /// confirmación no llega, se sigue igualmente en vez de bloquear a quien
    /// entrena.
    private func waitForSessionEnd() async {
        await withCheckedContinuation { continuation in
            sessionEndedContinuation = continuation
            Task {
                try? await Task.sleep(for: .seconds(3))
                if let pending = self.sessionEndedContinuation {
                    self.sessionEndedContinuation = nil
                    pending.resume()
                }
            }
        }
    }

    // MARK: - Descanso

    // Con la muñeca bajada watchOS congela la app y el Timer no dispara: el
    // descanso llegaba pero no avisaba (visto con los contadores: desc 2,
    // avisos 1). La notificación local la entrega el sistema aunque la app
    // esté congelada, así que es ella la que avisa de verdad; el Timer se
    // queda solo para la cuenta atrás en pantalla.
    private static let restNotificationId = "rest-end"

    private func startRest(until end: Date) {
        cancelRest()
        restsReceived += 1
        restEndDate = end

        let content = UNMutableNotificationContent()
        content.title = "¡Descanso terminado!"
        content.body = "A por la siguiente serie"
        content.sound = .default
        let seconds = max(1, end.timeIntervalSinceNow)
        let request = UNNotificationRequest(
            identifier: Self.restNotificationId,
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
        )
        UNUserNotificationCenter.current().add(request)

        let timer = Timer(fire: end, interval: 0, repeats: false) { [weak self] _ in
            guard let manager = self else { return }
            Task { @MainActor in manager.restFinished() }
        }
        RunLoop.main.add(timer, forMode: .common)
        restTimer = timer
    }

    private func cancelRest() {
        restTimer?.invalidate()
        restTimer = nil
        restEndDate = nil
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: [Self.restNotificationId])
    }

    // Solo corre con la app despierta: es el aviso de cuando estás mirando el
    // reloj, donde la notificación va suprimida (ver willPresent).
    private func restFinished() {
        restTimer = nil
        restEndDate = nil
        alertsFired += 1
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: [Self.restNotificationId])
        // Un solo toque se pierde en plena serie; tres seguidos no.
        let device = WKInterfaceDevice.current()
        for i in 0..<3 {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.8) {
                device.play(.notification)
            }
        }
    }

    /// Devuelve la respuesta para el iPhone.
    private func handle(type: String?, endDate endMs: Double?) -> [String: Any] {
        switch type {
        case "restStart":
            guard session != nil, let endMs else { return ["ok": false] }
            startRest(until: Date(timeIntervalSince1970: endMs / 1000))
            return ["ok": true]
        case "restCancel":
            cancelRest()
            return ["ok": true]
        default:
            return ["ok": false]
        }
    }

    // MARK: - Pulso al iPhone

    private func sendHeartRate(_ bpm: Double, at date: Date) {
        let wc = WCSession.default
        guard wc.activationState == .activated, wc.isReachable else { return }
        wc.sendMessage(
            ["bpm": bpm, "sampledAt": date.timeIntervalSince1970 * 1000],
            replyHandler: nil,
            errorHandler: nil
        )
    }
}

// MARK: - HealthKit

extension WorkoutManager: HKWorkoutSessionDelegate {
    // watchOS puede terminar la sesión por su cuenta (fondo prolongado,
    // error interno) sin que se llame a end(). Sin esto la app se queda
    // enseñando un entreno "activo" zombi: sin sesión real detrás no vibra
    // el descanso, y Terminar falla con "Unable to end a workout that is
    // not currently active". Al ver .ended/.stopped se limpia el estado y
    // vuelve a la pantalla de inicio.
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
        Task { @MainActor in self.lastState = toState.rawValue }
        guard toState == .ended || toState == .stopped else { return }
        Task { @MainActor in
            // Resuelve la espera de end() (cierre normal) o limpia un entreno
            // zombi que el sistema cerró él solo sin que se llamara a end().
            if let pending = self.sessionEndedContinuation {
                self.sessionEndedContinuation = nil
                pending.resume()
            }
            guard !self.isEndingDeliberately, self.kind != nil else { return }
            self.cancelRest()
            self.session = nil
            self.builder = nil
            self.kind = nil
            self.startDate = nil
            self.heartRate = nil
            self.errorMessage = "El entreno se cerró solo. Vuelve a empezarlo."
        }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        let message = error.localizedDescription
        Task { @MainActor in
            self.errorMessage = message
            // deathNote no lo pisa nadie: es lo que se lee después del fallo.
            self.deathNote = "fallo: \(message)"
        }
    }
}

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        let hrType = HKQuantityType(.heartRate)
        let kcalType = HKQuantityType(.activeEnergyBurned)

        let hrStats = collectedTypes.contains(hrType) ? workoutBuilder.statistics(for: hrType) : nil
        let bpm = hrStats?.mostRecentQuantity()?.doubleValue(for: .count().unitDivided(by: .minute()))
        let sampledAt = hrStats?.mostRecentQuantityDateInterval()?.end
        let kcal = workoutBuilder.statistics(for: kcalType)?.sumQuantity()?.doubleValue(for: .kilocalorie())

        Task { @MainActor in
            if let kcal { self.calories = Int(kcal.rounded()) }
            if let bpm {
                self.heartRate = Int(bpm.rounded())
                self.sendHeartRate(bpm, at: sampledAt ?? Date())
            }
        }
    }
}

// MARK: - WatchConnectivity

extension WorkoutManager: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        let type = message["type"] as? String
        let endMs = message["endDate"] as? Double
        nonisolated(unsafe) let reply = replyHandler
        Task { @MainActor in
            reply(self.handle(type: type, endDate: endMs))
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        let type = message["type"] as? String
        let endMs = message["endDate"] as? Double
        Task { @MainActor in
            _ = self.handle(type: type, endDate: endMs)
        }
    }
}

// MARK: - Notificaciones

extension WorkoutManager: UNUserNotificationCenterDelegate {
    // Con la app delante ya vibra restFinished(); dejar salir además la
    // notificación sería avisar dos veces.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        []
    }
}
