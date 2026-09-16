//
//  RutinexHomeWidget.swift
//  RutinexWidgets
//
//  Widget de pantalla de inicio: racha + pasos del día (v2 Fase 5). Ver
//  docs/plan-apple-health-integration.md, sección "Fase 5", y
//  docs/superpowers/specs/2026-09-16-widget-pantalla-inicio-design.md.
//
//  Datos escritos por HomeWidgetPlugin.swift (App/App/) en el App Group
//  compartido — este widget solo lee, nunca escribe. Sin pasos guardados
//  (Health no conectado, o denegado): esa fila no se pinta, nunca un
//  placeholder tipo "—".

import WidgetKit
import SwiftUI

private let appGroupId = "group.com.rutinex.app"

private struct HomeWidgetEntry: TimelineEntry {
    let date: Date
    let streak: Int
    let steps: Int?
}

private struct HomeWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> HomeWidgetEntry {
        HomeWidgetEntry(date: .now, streak: 3, steps: 4200)
    }

    func getSnapshot(in context: Context, completion: @escaping (HomeWidgetEntry) -> Void) {
        completion(readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HomeWidgetEntry>) -> Void) {
        // Una sola entrada: el widget se refresca cuando la app llama
        // reloadTimelines (tras entrenar o al abrir el Dashboard), no con
        // política de refresco propia.
        completion(Timeline(entries: [readEntry()], policy: .never))
    }

    private func readEntry() -> HomeWidgetEntry {
        let defaults = UserDefaults(suiteName: appGroupId)
        let streak = defaults?.integer(forKey: "streak") ?? 0
        let steps = defaults?.object(forKey: "steps") != nil ? defaults?.integer(forKey: "steps") : nil
        return HomeWidgetEntry(date: .now, streak: streak, steps: steps)
    }
}

private struct HomeWidgetView: View {
    let entry: HomeWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "flame.fill")
                    .foregroundStyle(.orange)
                Text("\(entry.streak)")
                    .font(.title)
                    .fontWeight(.bold)
            }
            Text(entry.streak == 1 ? "día seguido" : "días seguidos")
                .font(.caption)
                .foregroundStyle(.secondary)

            if let steps = entry.steps {
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: "figure.walk")
                        .foregroundStyle(.blue)
                    Text("\(steps)")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
                Text("pasos hoy")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

struct RutinexHomeWidget: Widget {
    let kind: String = "RutinexHomeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HomeWidgetProvider()) { entry in
            // .containerBackground(for: .widget) es iOS 17+; el target compila
            // para 16.2 (mismo mínimo que la Live Activity), así que se usa el
            // fondo clásico pre-17.
            HomeWidgetView(entry: entry)
                .background()
        }
        .configurationDisplayName("Racha de Rutinex")
        .description("Tu racha de entrenos y los pasos de hoy, sin abrir la app.")
        .supportedFamilies([.systemSmall])
    }
}
