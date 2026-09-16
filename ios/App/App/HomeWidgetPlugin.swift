//
//  HomeWidgetPlugin.swift
//  App
//
//  Puente Capacitor -> App Group compartido con la extensión de widgets
//  (v2 Fase 5). JS llama a `HomeWidget.setData({streak, steps})` vía
//  @capacitor/core. Ver docs/plan-apple-health-integration.md, sección
//  "Fase 5", y docs/superpowers/specs/2026-09-16-widget-pantalla-inicio-design.md.
//
//  Escritura parcial a propósito: streak y steps llegan desde dos
//  useEffect independientes en DashboardView.jsx (racha desde
//  workout_logs, pasos desde HealthKit) que no se sincronizan entre sí.
//  Cada llamada solo sobreescribe las claves que trae.

import Foundation
import Capacitor
import WidgetKit

private let appGroupId = "group.com.rutinex.app"
private let widgetKind = "RutinexHomeWidget"

@objc(HomeWidgetPlugin)
public class HomeWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HomeWidgetPlugin"
    public let jsName = "HomeWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setData", returnType: CAPPluginReturnPromise)
    ]

    @objc func setData(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: appGroupId) else {
            call.reject("No se pudo abrir el App Group \(appGroupId)")
            return
        }

        if let streak = call.getInt("streak") {
            defaults.set(streak, forKey: "streak")
        }
        if let steps = call.getInt("steps") {
            defaults.set(steps, forKey: "steps")
        }

        WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
        call.resolve()
    }
}
