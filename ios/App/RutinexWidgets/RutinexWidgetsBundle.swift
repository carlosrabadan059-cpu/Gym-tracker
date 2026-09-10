//
//  RutinexWidgetsBundle.swift
//  RutinexWidgets
//
//  Created by Carlos Rabadán on 09/09/2026.
//

import WidgetKit
import SwiftUI

// Solo Live Activity — Fase 4 no incluye widget de pantalla de inicio ni de
// Centro de Control, se quitó el boilerplate de esos dos.
@main
struct RutinexWidgetsBundle: WidgetBundle {
    var body: some Widget {
        RutinexWidgetsLiveActivity()
    }
}
