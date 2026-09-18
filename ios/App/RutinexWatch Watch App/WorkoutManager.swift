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

    private let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var restTimer: Timer?

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    // MARK: - Entreno

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
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func end() async {
        guard let session, let builder else { return }
        cancelRest()
        session.end()
        do {
            try await builder.endCollection(at: Date())
            _ = try await builder.finishWorkout()
        } catch {
            errorMessage = error.localizedDescription
        }
        self.session = nil
        self.builder = nil
        kind = nil
        startDate = nil
        heartRate = nil
    }

    // MARK: - Descanso

    private func startRest(until end: Date) {
        cancelRest()
        restEndDate = end
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
    }

    private func restFinished() {
        restTimer = nil
        restEndDate = nil
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
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {}

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        let message = error.localizedDescription
        Task { @MainActor in self.errorMessage = message }
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
