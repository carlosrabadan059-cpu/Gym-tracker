//
//  LiveActivityAttributes.swift
//  App
//
//  Compartido entre la app y RutinexWidgetsExtension — ActivityKit exige el
//  mismo tipo `ActivityAttributes` en ambos procesos para que
//  Activity<RutinexTimerAttributes>.request(...) desde la app y la vista de
//  RutinexWidgetsLiveActivity.swift hablen de la misma Activity. Este
//  fichero debe tener Target Membership marcado para "App" Y
//  "RutinexWidgetsExtension" (checkbox en el File Inspector de Xcode).
//
//  v2 Fase 4. Ver docs/plan-apple-health-integration.md.

import ActivityKit
import Foundation

struct RutinexTimerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var exerciseName: String
        var currentSet: Int
        var totalSets: Int
        // "training" | "resting" | "restFinished"
        var phase: String
        // Solo con valor cuando phase == "resting".
        var restEndDate: Date?
    }

    var routineName: String
}
