//
//  RutinexWatchApp.swift
//  RutinexWatch
//
//  App de Rutinex en el Apple Watch. Ver
//  docs/superpowers/specs/2026-09-17-app-watch-design.md.

import SwiftUI

@main
struct RutinexWatchApp: App {
    @StateObject private var workout = WorkoutManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(workout)
        }
    }
}
