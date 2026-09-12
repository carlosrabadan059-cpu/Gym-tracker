//
//  LiveActivityPlugin.swift
//  App
//
//  Puente Capacitor -> ActivityKit para la Live Activity del entreno
//  (v2 Fase 4). JS llama a `LiveActivity.start/update/end` vía
//  @capacitor/core. Ver docs/plan-apple-health-integration.md, sección
//  "Fase 4", para el mapeo de eventos de la app -> estos métodos.
//
//  Deployment target 16.2 (mínimo real de la API Activity.request con
//  ActivityContent) — sin eso el resto del plugin no compila, así que no
//  hacen falta más #available aquí dentro.
//
//  En foreground esto basta para arrancar/actualizar/terminar. El caso
//  "descanso termina con el móvil bloqueado" necesita además el push token
//  de tipo `liveactivity` (ver observePushToken) y que send-timer-push lo
//  use — ese lado del server-side es un paso posterior, no bloquea probar
//  esto en foreground primero.

import Foundation
import Capacitor
import ActivityKit

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise)
    ]

    private var currentActivity: Activity<RutinexTimerAttributes>?

    // Al cargar el plugin (proceso nuevo): si el proceso anterior murió sin
    // llamar a end() (p.ej. matado por Xcode con SIGKILL), quedan Activities
    // huérfanas en pantalla que ninguna referencia controla. Limpiarlas.
    override public func load() {
        Task { await endAll() }
    }

    @objc func isSupported(_ call: CAPPluginCall) {
        call.resolve(["supported": ActivityAuthorizationInfo().areActivitiesEnabled])
    }

    @objc func start(_ call: CAPPluginCall) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("El usuario tiene las Live Activities desactivadas (Ajustes > Rutinex)")
            return
        }

        let routineName = call.getString("routineName") ?? "Entreno"
        let exerciseName = call.getString("exerciseName") ?? ""
        let currentSet = call.getInt("currentSet") ?? 1
        let totalSets = call.getInt("totalSets") ?? 1

        let attributes = RutinexTimerAttributes(routineName: routineName)
        let state = RutinexTimerAttributes.ContentState(
            exerciseName: exerciseName, currentSet: currentSet, totalSets: totalSets,
            phase: "training", restEndDate: nil
        )

        Task {
            // Termina cualquier Activity previa antes de crear una nueva —
            // tests repetidos, o app reabierta con una huérfana en pantalla.
            await endAll()
            do {
                // pushType: nil — foreground/local basta. `.token` requiere la
                // capability Push Notifications (aps-environment). El caso
                // "descanso acaba con móvil bloqueado" la necesitará; añadirla
                // y volver a .token + observePushToken es un paso posterior.
                let activity = try Activity<RutinexTimerAttributes>.request(
                    attributes: attributes,
                    content: .init(state: state, staleDate: nil),
                    pushType: nil
                )
                currentActivity = activity
                call.resolve(["id": activity.id])
            } catch {
                call.reject("No se pudo arrancar la Activity: \(error.localizedDescription)")
            }
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        // Si el proceso es nuevo y no tenemos referencia pero hay una Activity
        // viva (reanudar entreno tras reabrir la app), adoptarla.
        let activity = currentActivity ?? Activity<RutinexTimerAttributes>.activities.first
        guard let activity else {
            call.resolve()
            return
        }
        currentActivity = activity

        let exerciseName = call.getString("exerciseName") ?? activity.content.state.exerciseName
        let currentSet = call.getInt("currentSet") ?? activity.content.state.currentSet
        let totalSets = call.getInt("totalSets") ?? activity.content.state.totalSets
        let phase = call.getString("phase") ?? activity.content.state.phase
        let restEndMs = call.getDouble("restEndDate")
        let restEndDate = restEndMs.map { Date(timeIntervalSince1970: $0 / 1000) }

        let state = RutinexTimerAttributes.ContentState(
            exerciseName: exerciseName, currentSet: currentSet, totalSets: totalSets,
            phase: phase, restEndDate: restEndDate
        )

        Task {
            await activity.update(.init(state: state, staleDate: nil))
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        Task {
            let count = await endAll()
            call.resolve(["ended": count])
        }
    }

    /// Termina TODAS las Activities de este tipo (incluidas huérfanas de otro
    /// proceso). Devuelve cuántas había.
    @discardableResult
    private func endAll() async -> Int {
        let activities = Activity<RutinexTimerAttributes>.activities
        for activity in activities {
            let finalState = activity.content.state
            await activity.end(
                .init(state: finalState, staleDate: nil),
                dismissalPolicy: .immediate
            )
        }
        currentActivity = nil
        return activities.count
    }
}
