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
//
//  isReachable cae a ratos aunque el Watch tenga la fuerza en marcha (16-11:
//  sesión viva de 10:56 a 12:11 y ningún descanso llegó). Por eso, sin
//  conexión en vivo, el descanso va por transferUserInfo (lo entrega el
//  sistema en cuanto puede) y el estado de fuerza se lee del
//  applicationContext que publica el Watch. Todo queda en Documents/watchbridge.log:
//    xcrun devicectl device copy from --device <id del iPhone> \
//      --domain-type appDataContainer --domain-identifier com.rutinex.app \
//      --source Documents/watchbridge.log --destination watchbridge.log

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
        CAPPluginMethod(name: "getHeartRate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "strengthStatus", returnType: CAPPluginReturnPromise)
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

    /// Sesión activada con el Watch y su app instalada, alcanzable o no.
    private var installedSession: WCSession? {
        guard WCSession.isSupported() else { return nil }
        let session = WCSession.default
        guard session.activationState == .activated,
              session.isPaired,
              session.isWatchAppInstalled else { return nil }
        return session
    }

    private func sessionState() -> String {
        guard WCSession.isSupported() else { return "sin WCSession" }
        let s = WCSession.default
        return "activation=\(s.activationState.rawValue) paired=\(s.isPaired) installed=\(s.isWatchAppInstalled) reachable=\(s.isReachable)"
    }

    @objc func restStart(_ call: CAPPluginCall) {
        guard let endDate = call.getDouble("endDate") else {
            call.reject("Falta endDate")
            return
        }
        let message: [String: Any] = ["type": "restStart", "endDate": endDate]
        BridgeLog.add("restStart \(sessionState())")
        guard let session = reachableSession else {
            // Sin confirmación: avisa también el iPhone. Si el iPhone está
            // bloqueado puede vibrar dos veces; mejor eso que ninguna.
            if let session = installedSession {
                session.transferUserInfo(message)
                BridgeLog.add("restStart por transferUserInfo")
            }
            call.resolve(["delivered": false])
            return
        }
        session.sendMessage(
            message,
            replyHandler: { reply in
                BridgeLog.add("restStart reply=\(reply)")
                call.resolve(["delivered": reply["ok"] as? Bool ?? false])
            },
            errorHandler: { error in
                // Repetir un restStart no hace daño: el Watch reemplaza el descanso.
                BridgeLog.add("restStart error=\(error.localizedDescription); va por transferUserInfo")
                session.transferUserInfo(message)
                call.resolve(["delivered": false])
            }
        )
    }

    @objc func restCancel(_ call: CAPPluginCall) {
        let message = ["type": "restCancel"]
        if let session = reachableSession {
            session.sendMessage(message, replyHandler: nil) { _ in session.transferUserInfo(message) }
        } else {
            // Puede ir detrás de un restStart encolado: la cola es FIFO.
            installedSession?.transferUserInfo(message)
        }
        call.resolve()
    }

    /// paired=false: no hay Watch con la app, no hay nada que avisar. strength=true
    /// solo si el Watch confirma una sesión de fuerza en marcha; sin respuesta
    /// (app del Watch cerrada o inalcanzable) cuenta como false.
    @objc func strengthStatus(_ call: CAPPluginCall) {
        guard WCSession.isSupported(),
              WCSession.default.activationState == .activated,
              WCSession.default.isPaired,
              WCSession.default.isWatchAppInstalled else {
            call.resolve(["paired": false, "strength": false])
            return
        }
        // Lo último que publicó el Watch; vale cuando no contesta en vivo.
        let published = WCSession.default.receivedApplicationContext["strength"] as? Bool ?? false
        guard let session = reachableSession else {
            BridgeLog.add("status sin conexión, contexto strength=\(published)")
            call.resolve(["paired": true, "strength": published])
            return
        }
        session.sendMessage(
            ["type": "status"],
            replyHandler: { reply in
                call.resolve(["paired": true, "strength": reply["strength"] as? Bool ?? false])
            },
            errorHandler: { error in
                BridgeLog.add("status error=\(error.localizedDescription), contexto strength=\(published)")
                call.resolve(["paired": true, "strength": published])
            }
        )
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
        BridgeLog.add("activación \(activationState.rawValue)\(error.map { " error=\($0.localizedDescription)" } ?? "")")
    }

    public func sessionReachabilityDidChange(_ session: WCSession) {
        BridgeLog.add("alcanzable=\(session.isReachable)")
    }

    public func session(_ session: WCSession, didFinish userInfoTransfer: WCSessionUserInfoTransfer, error: Error?) {
        let type = userInfoTransfer.userInfo["type"] as? String ?? "?"
        BridgeLog.add("transferUserInfo \(type) \(error.map { "falla: \($0.localizedDescription)" } ?? "entregado")")
    }

    public func sessionDidBecomeInactive(_ session: WCSession) {}

    // Cambio de Watch emparejado: hay que reactivar para hablar con el nuevo.
    public func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }
}

/// Registro en fichero del lado iPhone; el del Watch es EventLog.
enum BridgeLog {
    private static let url = FileManager.default
        .urls(for: .documentDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("watchbridge.log")
    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "dd-MM HH:mm:ss.SSS"
        return f
    }()
    private static let queue = DispatchQueue(label: "BridgeLog")
    // ponytail: recorte a lo bruto por tamaño, como EventLog.
    private static let maxBytes = 200_000

    static func add(_ event: String) {
        let line = "\(formatter.string(from: Date())) \(event)\n"
        CAPLog.print("[WatchBridge] \(event)")
        queue.async {
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
    }
}
