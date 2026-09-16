//
//  RutinexWidgetsBundle.swift
//  RutinexWidgets
//
//  Created by Carlos Rabadán on 09/09/2026.
//

import WidgetKit
import SwiftUI

// Live Activity (Fase 4) + widget de pantalla de inicio (Fase 5, racha +
// pasos). Sin widget de Centro de Control, se quitó el boilerplate de eso.
@main
struct RutinexWidgetsBundle: WidgetBundle {
    var body: some Widget {
        RutinexWidgetsLiveActivity()
        RutinexHomeWidget()
    }
}
