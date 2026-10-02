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

    // true mientras se cierra o se arranca una sesión. Los botones se
    // desactivan: pulsar Fuerza con el cardio aún cerrándose era lo que
    // dejaba dos sesiones a la vez y watchOS mataba la nueva (25-09 a 01-10).
    @Published var isBusy = false

    private let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var restTimer: Timer?
    // true mientras end() está cerrando a propósito. Distingue ese cierre
    // normal del que hace watchOS por su cuenta.
    private var isEndingDeliberately = false
    // start() la espera: si se pulsa un ejercicio antes de que acabe, habría
    // dos sesiones a la vez y watchOS mata una (visto el 25-09-2026).
    private var recoveryTask: Task<Void, Never>?
    // Una sesión huérfana más vieja que esto es de otro día: se descarta en
    // vez de reengancharla, o acabaría en Health un entreno de horas.
    private static let maxRecoverableAge: TimeInterval = 4 * 3600
    // Si watchOS mata la sesión, se rearranca sola, pero no en bucle: como
    // mucho estas veces en 10 minutos.
    private static let maxAutoRestarts = 3
    private var autoRestarts: [Date] = []
    // kcal de los tramos anteriores tras un rearranque, para que el número
    // en pantalla no vuelva a 0.
    private var calorieBase = 0

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
        }
        EventLog.add("app arranca")
        recoveryTask = Task { await recoverOrphanedSession() }
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

            // Un tipo que la app no reconoce no se puede pintar, y una sesión
            // de otro día no es el entreno de ahora: se cierran sin guardar
            // para no dejar la sesión huérfana dando guerra.
            let isStale = recovered.startDate.map { Date().timeIntervalSince($0) > Self.maxRecoverableAge } ?? true
            guard let recoveredKind = WorkoutKind(activityType: recovered.workoutConfiguration.activityType), !isStale else {
                EventLog.add("recupera \(EventLog.id(recovered)) y la descarta (vieja o desconocida)")
                recovered.end()
                builder.discardWorkout()
                await waitUntilEnded(recovered)
                return
            }

            EventLog.add("recupera \(EventLog.id(recovered)) \(recoveredKind.rawValue)")
            session = recovered
            self.builder = builder
            kind = recoveredKind
            startDate = recovered.startDate
        } catch {
            EventLog.add("recuperar falla: \(error.localizedDescription)")
            errorMessage = error.localizedDescription
        }
    }

    func start(_ kind: WorkoutKind) async {
        guard !isBusy else { return }
        isBusy = true
        defer { isBusy = false }
        await recoveryTask?.value
        // Se recuperó un entreno en marcha: la pantalla ya lo enseña.
        guard session == nil else { return }
        errorMessage = nil
        autoRestarts = []
        calorieBase = 0
        await begin(kind, keepingStartDate: false)
        isBusy = false
        await rescueIfDead()
    }

    /// Mientras isBusy, el delegado no actúa: si la sesión murió justo al
    /// arrancar, se detecta aquí, al terminar el arranque.
    private func rescueIfDead() async {
        guard let session, session.state == .ended || session.state == .stopped else { return }
        EventLog.add("\(EventLog.id(session)) muerta nada más arrancar")
        await handleUnexpectedEnd(of: session)
    }

    /// Crea y arranca la sesión. `keepingStartDate` es para el rearranque:
    /// el cronómetro sigue contando desde el inicio original.
    private func begin(_ kind: WorkoutKind, keepingStartDate: Bool) async {
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
            if !keepingStartDate || startDate == nil { startDate = start }
            heartRate = nil
            calories = calorieBase
            EventLog.add("empieza \(EventLog.id(session)) \(kind.rawValue) estado \(session.state.rawValue)")
        } catch {
            EventLog.add("empezar \(kind.rawValue) falla: \(error.localizedDescription)")
            errorMessage = error.localizedDescription
        }
    }

    func end() async {
        guard let session, let builder, !isBusy else { return }
        isBusy = true
        isEndingDeliberately = true
        defer {
            isEndingDeliberately = false
            isBusy = false
        }
        EventLog.add("Terminar \(EventLog.id(session)) estado \(session.state.rawValue)")

        cancelRest()
        // Si watchOS ya la cerró por su cuenta, no se puede volver a cerrar
        // ("Unable to end a workout that is not currently active"), pero lo
        // recogido sí se puede guardar.
        if session.state != .ended { session.end() }
        await save(builder)
        await waitUntilEnded(session)
        clearSession(message: nil)
    }

    /// Guarda en Health lo recogido. Funciona también con la sesión ya
    /// cerrada por watchOS.
    private func save(_ builder: HKLiveWorkoutBuilder) async {
        do {
            try await builder.endCollection(at: Date())
            _ = try await builder.finishWorkout()
            EventLog.add("guardado en Health")
        } catch {
            EventLog.add("guardar falla: \(error.localizedDescription)")
            errorMessage = error.localizedDescription
        }
    }

    /// watchOS ha cerrado la sesión en curso sin que se pulsara Terminar.
    /// Antes se soltaba todo y salía "El entreno se cerró solo": el reloj
    /// dejaba de recibir los descansos y había que volver a empezar a mano.
    /// Ahora se guarda lo recogido y se rearranca el mismo tipo de entreno.
    private func handleUnexpectedEnd(of dead: HKWorkoutSession) async {
        guard let kind, let builder, !isBusy else { return }
        isBusy = true
        defer { isBusy = false }

        let elapsed = dead.startDate.map { Date().timeIntervalSince($0) } ?? 0
        // .stopped aún no está cerrada del todo.
        if dead.state != .ended { dead.end() }
        // Un tramo de segundos no aporta nada y partiría el entreno en Health.
        if elapsed < 120 {
            builder.discardWorkout()
            EventLog.add("tramo de \(Int(elapsed)) s descartado")
        } else {
            calorieBase = calories
            await save(builder)
        }
        session = nil
        self.builder = nil
        await waitUntilEnded(dead)

        autoRestarts = autoRestarts.filter { $0 > Date().addingTimeInterval(-600) }
        guard autoRestarts.count < Self.maxAutoRestarts else {
            EventLog.add("demasiados rearranques, se para")
            clearSession(message: "watchOS cierra el entreno una y otra vez. Vuelve a empezarlo.")
            return
        }
        autoRestarts.append(Date())
        // El descanso en curso no se toca: lo avisa la notificación local del
        // reloj, que no depende de la sesión.
        try? await Task.sleep(for: .seconds(2))
        EventLog.add("rearranque \(autoRestarts.count) de \(kind.rawValue)")
        await begin(kind, keepingStartDate: true)
        if session == nil {
            clearSession(message: "No se pudo reanudar el entreno. Vuelve a empezarlo.")
            return
        }
        isBusy = false
        await rescueIfDead()
    }

    /// Deja la app como recién abierta. `message` avisa de un cierre que no
    /// pidió quien entrena; nil para el cierre normal.
    private func clearSession(message: String?) {
        cancelRest()
        session = nil
        builder = nil
        kind = nil
        startDate = nil
        heartRate = nil
        calorieBase = 0
        errorMessage = message ?? errorMessage
    }

    /// Espera a que la sesión esté de verdad cerrada antes de seguir. Se
    /// pregunta el estado en vez de esperar al delegado: el aviso puede
    /// llegar tarde o no llegar (con la espera de 3 s al delegado, Fuerza
    /// arrancaba con el cardio aún vivo). Tope de 10 s para no bloquear.
    private func waitUntilEnded(_ session: HKWorkoutSession) async {
        let deadline = Date().addingTimeInterval(10)
        while session.state != .ended && Date() < deadline {
            try? await Task.sleep(for: .milliseconds(200))
        }
        EventLog.add("espera cierre \(EventLog.id(session)): estado \(session.state.rawValue)")
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
            guard let session, session.state == .running, let endMs else {
                EventLog.add("descanso rechazado (sesión \(session.map { "\($0.state.rawValue)" } ?? "ninguna"))")
                return ["ok": false]
            }
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
    // otra sesión que arranca, error interno) sin que se llame a end(). Solo
    // cuenta si es la sesión en curso: el aviso de una ya cerrada con
    // Terminar puede llegar tarde, con la siguiente ya empezada (30-09-2026).
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
        let changed = ObjectIdentifier(workoutSession)
        nonisolated(unsafe) let dead = workoutSession
        Task { @MainActor in
            let isCurrent = self.session.map { ObjectIdentifier($0) == changed } ?? false
            EventLog.add("estado \(EventLog.id(dead)) \(fromState.rawValue)→\(toState.rawValue)\(isCurrent ? "" : " (no es la actual)")")
            guard toState == .ended || toState == .stopped,
                  isCurrent, !self.isEndingDeliberately else { return }
            await self.handleUnexpectedEnd(of: dead)
        }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        let changed = ObjectIdentifier(workoutSession)
        let message = error.localizedDescription
        let code = (error as NSError).code
        Task { @MainActor in
            let isCurrent = self.session.map { ObjectIdentifier($0) == changed } ?? false
            EventLog.add("fallo \(code)\(isCurrent ? "" : " (no es la actual)"): \(message)")
            // El error de una sesión ya cerrada (p. ej. "otra sesión ha
            // empezado", que recibe el cardio al arrancar Fuerza) no es un
            // problema del entreno en curso.
            if isCurrent { self.errorMessage = message }
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
            if let kcal { self.calories = self.calorieBase + Int(kcal.rounded()) }
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

// MARK: - Registro de eventos

/// Registro silencioso en un fichero del reloj, para saber qué hace watchOS
/// con las sesiones sin depender de la consola del Watch (que no es
/// práctica). Se lee desde el Mac con:
///   xcrun devicectl device copy from --device <id del Watch> \
///     --domain-type appDataContainer --domain-identifier com.rutinex.app.watchkitapp \
///     --source Documents/eventos.log --destination eventos.log
@MainActor
enum EventLog {
    private static let url = FileManager.default
        .urls(for: .documentDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("eventos.log")
    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "dd-MM HH:mm:ss.SSS"
        return f
    }()
    // ponytail: recorte a lo bruto por tamaño; de sobra para unas semanas.
    private static let maxBytes = 200_000

    static func add(_ event: String) {
        let line = "\(formatter.string(from: Date())) \(event)\n"
        guard let data = line.data(using: .utf8) else { return }
        if let handle = try? FileHandle(forWritingTo: url) {
            defer { try? handle.close() }
            if let size = try? handle.seekToEnd(), size > maxBytes {
                try? handle.truncate(atOffset: 0)
            }
            try? handle.write(contentsOf: data)
        } else {
            try? data.write(to: url)
        }
    }

    static func id(_ session: HKWorkoutSession) -> String {
        String(String(describing: ObjectIdentifier(session)).suffix(5).dropLast())
    }
}
