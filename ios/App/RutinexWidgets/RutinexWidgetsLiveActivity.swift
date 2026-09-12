//
//  RutinexWidgetsLiveActivity.swift
//  RutinexWidgets
//
//  Live Activity del entreno en curso (v2 Fase 4). Ver
//  docs/plan-apple-health-integration.md, sección "Fase 4", para el mapeo
//  completo de eventos de la app -> arrancar/actualizar/terminar esta
//  Activity.
//
//  Atributos fijos (routineName) vs. estado mutable (todo lo demás, incluido
//  el ejercicio — cambia varias veces durante la misma Activity, así que va
//  en ContentState, no en Attributes).

import ActivityKit
import WidgetKit
import SwiftUI

// RutinexTimerAttributes vive en LiveActivityAttributes.swift (App/App/),
// compartido con target membership en App y RutinexWidgetsExtension. La
// cuenta atrás la pinta SwiftUI solo (Text(timerInterval:)), sin necesitar
// refrescos por push mientras solo cambian los segundos — el push hace
// falta para el cambio de fase (resting -> restFinished) con el móvil
// bloqueado.

private func phaseLabel(_ phase: String) -> String {
    switch phase {
    case "resting": return "Descanso"
    case "restFinished": return "¡Descanso terminado!"
    default: return "Entrenando"
    }
}

struct RutinexWidgetsLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RutinexTimerAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(Color.black)
                .activitySystemActionForegroundColor(Color.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.exerciseName)
                            .font(.headline)
                            .lineLimit(1)
                        Text("Serie \(context.state.currentSet)/\(context.state.totalSets)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    CountdownOrLabel(context: context, style: .title2)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(phaseLabel(context.state.phase))
                        .font(.caption)
                        .foregroundStyle(context.state.phase == "restFinished" ? Color.green : .secondary)
                }
            } compactLeading: {
                Image(systemName: context.state.phase == "training" ? "dumbbell.fill" : "timer")
            } compactTrailing: {
                CountdownOrLabel(context: context, style: .caption)
            } minimal: {
                Image(systemName: context.state.phase == "training" ? "dumbbell.fill" : "timer")
            }
        }
    }
}

private struct CountdownOrLabel: View {
    let context: ActivityViewContext<RutinexTimerAttributes>
    let style: Font

    var body: some View {
        if context.state.phase == "resting", let end = context.state.restEndDate {
            Text(timerInterval: Date.now...end, countsDown: true)
                .font(style)
                .monospacedDigit()
        } else if context.state.phase == "restFinished" {
            Text("¡Vamos!")
                .font(style)
                .foregroundStyle(Color.green)
        } else {
            Text("\(context.state.currentSet)/\(context.state.totalSets)")
                .font(style)
        }
    }
}

private struct LockScreenView: View {
    let context: ActivityViewContext<RutinexTimerAttributes>

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(context.attributes.routineName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(context.state.exerciseName)
                    .font(.headline)
                    .foregroundStyle(.white)
                Text("Serie \(context.state.currentSet)/\(context.state.totalSets) · \(phaseLabel(context.state.phase))")
                    .font(.caption)
                    .foregroundStyle(context.state.phase == "restFinished" ? Color.green : .secondary)
            }
            Spacer()
            CountdownOrLabel(context: context, style: .title)
                .foregroundStyle(.white)
        }
        .padding()
    }
}

// La macro #Preview("Notification", as: .content, ...) del boilerplate de
// Xcode para Live Activity necesita iOS 17+ para compilar — el target va en
// 16.1 (mínimo real de ActivityKit). Solo era ayuda de Xcode Previews, no
// hace falta para que la Activity funcione; se quitó en vez de subir el
// deployment target solo por esto.
