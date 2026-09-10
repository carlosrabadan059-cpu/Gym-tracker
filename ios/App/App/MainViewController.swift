//
//  MainViewController.swift
//  App
//
//  Los plugins de npm (@capgo/capacitor-health) se autorregistran vía
//  capacitor.config.json. LiveActivityPlugin es local a este target (no un
//  paquete npm), así que hace falta registrarlo a mano — este es el punto
//  que Capacitor documenta para eso. Apuntado desde Main.storyboard en vez
//  del CAPBridgeViewController de stock.

import Capacitor

class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LiveActivityPlugin())
    }
}
