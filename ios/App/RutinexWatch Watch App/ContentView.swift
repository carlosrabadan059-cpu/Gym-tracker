//
//  ContentView.swift
//  RutinexWatch
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var workout: WorkoutManager

    var body: some View {
        if let kind = workout.kind {
            WorkoutView(kind: kind)
        } else {
            StartView()
        }
    }
}

struct StartView: View {
    @EnvironmentObject var workout: WorkoutManager

    var body: some View {
        List {
            ForEach(WorkoutKind.allCases) { kind in
                Button(kind.rawValue) {
                    Task { await workout.start(kind) }
                }
            }
            if let error = workout.errorMessage {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
        .navigationTitle("Rutinex")
    }
}

struct WorkoutView: View {
    let kind: WorkoutKind
    @EnvironmentObject var workout: WorkoutManager

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text(kind.rawValue)
                    .font(.headline)

                if let start = workout.startDate {
                    Text(start, style: .timer)
                        .font(.title3.monospacedDigit())
                }

                HStack(spacing: 6) {
                    Image(systemName: "heart.fill")
                        .foregroundStyle(.red)
                    Text(workout.heartRate.map(String.init) ?? "—")
                        .font(.title2.monospacedDigit())
                    Text("\(workout.calories) kcal")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if let end = workout.restEndDate {
                    HStack(spacing: 4) {
                        Text("Descanso")
                        Text(timerInterval: Date()...max(end, Date()), countsDown: true)
                            .monospacedDigit()
                    }
                    .foregroundStyle(.green)
                }

                Button("Terminar", role: .destructive) {
                    Task { await workout.end() }
                }
            }
        }
    }
}
