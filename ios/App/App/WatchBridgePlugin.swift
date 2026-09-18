//
//  WatchBridgePlugin.swift
//  App
//
//  Puente Capacitor -> app de Rutinex en el Apple Watch, vía
//  WatchConnectivity. Ver docs/superpowers/specs/2026-09-17-app-watch-design.md.
//
//  - restStart/restCancel: el Watch vibra al acabar el descanso. restStart
//    solo devuelve delivered=true si el Watch confirma que tiene un entreno
//    activo (sin él, watchOS lo suspende y no vibraría a tiempo); en ese caso
//    JS no programa la notificación local, para no avisar dos veces.
//  - getHeartRate: última muestra de pulso que mandó el Watch. Llega en vivo,
//    sin el retraso de sincronización de HealthKit.

import Foundation
import Capacitor
import WatchConnectivity

@objc(WatchBridgePlugin)
public class WatchBridgePlugin: CAPPlugin, CAPBridgedPlugin, WCSessionDelegate {
    public let identifier = "WatchBridgePlugin"
    public let jsName = "WatchBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "restStart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restCancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getHeartRate", returnType: CAPPluginReturnPromise)
    ]

    // Los callbacks de WCSession llegan en un hilo de fondo.
    private let lock = NSLock()
    private var lastHeartRate: [String: Any]?

    override public func load() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    private var reachableSession: WCSession? {
        guard WCSession.isSupported() else { return nil }
        let session = WCSession.default
        guard session.activationState == .activated,
              session.isPaired,
              session.isWatchAppInstalled,
              session.isReachable else { return nil }
        return session
    }

    @objc func restStart(_ call: CAPPluginCall) {
        guard let endDate = call.getDouble("endDate") else {
            call.reject("Falta endDate")
            return
        }
        guard let session = reachableSession else {
            call.resolve(["delivered": false])
            return
        }
        session.sendMessage(
            ["type": "restStart", "endDate": endDate],
            replyHandler: { reply in
                call.resolve(["delivered": reply["ok"] as? Bool ?? false])
            },
            errorHandler: { _ in
                call.resolve(["delivered": false])
            }
        )
    }

    @objc func restCancel(_ call: CAPPluginCall) {
        // Sin conexión no hay nada que cancelar: el Watch no recibió el inicio.
        reachableSession?.sendMessage(["type": "restCancel"], replyHandler: nil, errorHandler: nil)
        call.resolve()
    }

    @objc func getHeartRate(_ call: CAPPluginCall) {
        lock.lock()
        let reading = lastHeartRate
        lock.unlock()
        call.resolve(reading ?? [:])
    }

    // MARK: - WCSessionDelegate

    public func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let bpm = message["bpm"] as? Double,
              let sampledAt = message["sampledAt"] as? Double else { return }
        lock.lock()
        lastHeartRate = ["bpm": bpm, "sampledAt": sampledAt]
        lock.unlock()
    }

    public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let error = error {
            CAPLog.print("[WatchBridge] Activación fallida: \(error.localizedDescription)")
        }
    }

    public func sessionDidBecomeInactive(_ session: WCSession) {}

    // Cambio de Watch emparejado: hay que reactivar para hablar con el nuevo.
    public func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }
}
