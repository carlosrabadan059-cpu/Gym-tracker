# Handoff: app de Rutinex para Apple Watch (2026-09-18)

Spec: `docs/superpowers/specs/2026-09-17-app-watch-design.md` (commit 7d94a3a).

## Estado

Código escrito y sin commit. Tests JS en verde (206). El target del Watch pasa
el chequeo de tipos con las opciones reales de Xcode 26.6 (watchOS 26.x,
`-default-isolation=MainActor` y las upcoming features del target nuevo).
**Nada verificado en dispositivo.**

Cambios sin commit:

- `src/lib/watchBridge.js` (nuevo), `restNotification.js`, `appleHealth.js`:
  aviso de descanso al Watch y pulso en vivo por WatchConnectivity.
- `ios/App/App/WatchBridgePlugin.swift` (nuevo) + registro en
  `MainViewController.swift`.
- `ios/App/RutinexWatch Watch App/`: `RutinexWatchApp.swift`,
  `ContentView.swift`, `WorkoutManager.swift`.
- `App.xcodeproj`: target `RutinexWatch Watch App` (lo creó Carlos),
  `WATCHOS_DEPLOYMENT_TARGET` bajado a 26.0, referencia del plugin movida al
  grupo App.
- De la sesión anterior, también sin commit: aviso al cambiar la duración del
  descanso, detección del cardio y la fuerza del Watch al terminar, kcal del
  Watch no reescritas en Health, y el selector de cardio saltado en nativo.

## Dónde se quedó

Xcode ya ve el reloj (`Apple Watch de Carlos`, watchOS 26.6, Ultra 2), pero
"Fetching debug symbols" se quedó colgado: en 3 minutos la caché de símbolos
no creció nada. Ese paso no hace falta para instalar.

Antes falló la instalación desde el reloj con "no se ha podido verificar su
integridad" (perfil de firma anterior al registro del Watch). Se borró
DerivedData, lo que se llevó los paquetes de Capacitor, y hubo que limpiar
`~/Library/Caches/org.swift.swiftpm/artifacts/*capacitor*`.

## Siguiente paso

1. Cerrar y reabrir Xcode. Si faltan paquetes: File > Packages > Reset Package
   Caches y Resolve Package Versions.
2. Scheme **App** con el iPhone → ▶. Confiar el perfil en
   Ajustes > General > VPN y gestión de dispositivos. Abrir Rutinex.
3. Scheme **RutinexWatch Watch App** con el Watch real → ▶, sin esperar a los
   símbolos.
4. Verificación en dispositivo: la del spec (vibración con el iPhone
   desbloqueado, pulso que coincide, cardio → Terminar → fuerza → Terminar).

## Ojo

Cuenta Apple gratuita: la firma caduca cada 7 días y hay que reinstalar y
volver a confiar. El flujo acordado en el Watch es terminar el cardio y
empezar un entreno de fuerza aparte, nunca el botón "+".
