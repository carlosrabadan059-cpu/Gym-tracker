# App de Rutinex para Apple Watch

**Fecha:** 2026-09-17
**Alcance:** que el fin del descanso avise en la muñeca sin mirar el iPhone,
y que el pulso del descanso coincida con el que marca el reloj.

## Problema

- iOS solo pasa las notificaciones del iPhone al Watch cuando el iPhone está
  bloqueado. Con el iPhone desbloqueado, el aviso de fin de descanso
  (`restNotification.js`) no llega a la muñeca.
- La FC en vivo del descanso (`getLiveHeartRate`) lee HealthKit en el
  iPhone. El Watch sincroniza las muestras por lotes, así que el número va
  por detrás del que se ve en el reloj.

Ninguna de las dos cosas se arregla desde el iPhone: hace falta código en el
Watch.

## Decisiones (brainstorming, no reabrir)

1. **Rutinex en el Watch sustituye a la app Entreno de Apple** en el
   gimnasio. watchOS solo permite un entreno activo a la vez, y solo una app
   con entreno activo sigue ejecutándose con la muñeca bajada. Sin eso, el
   aviso podría llegar con minutos de retraso.
2. **Las series se marcan solo en el iPhone.** El Watch no tiene botón de
   serie: muestra el pulso y la cuenta atrás, y vibra.
3. **WatchConnectivity**, no el "workout mirroring" de iOS 17: hace lo
   necesario, funciona con watchOS 9 y es más fácil de depurar.
4. **Cardio y fuerza son entrenos separados**, cada uno con su Terminar. Así
   se mantiene lo ya hecho hoy: al terminar la sesión, `TrainingView` detecta
   el cardio y la fuerza del Watch en Health sin cambios.
5. Sin Developer Program: la app del Watch va embebida en la del iPhone y se
   reinstala con ella cada 7 días desde Xcode.

## Arquitectura

### Watch: target `RutinexWatch` (SwiftUI, watchOS)

- `WorkoutManager`: `HKWorkoutSession` + `HKLiveWorkoutBuilder`. Publica el
  pulso, las kcal, el tiempo y el fin del descanso. Tipos de entreno:
  - Andar en cinta: `.walking`, interior.
  - Correr en cinta: `.running`, interior.
  - Elíptica: `.elliptical`.
  - Bicicleta: `.cycling`, interior.
  - Fuerza: `.traditionalStrengthTraining`.

  Son los tipos que ya reconoce `appleHealth.js`.
- **Mensajes de WatchConnectivity que recibe:**
  - `restStart { endDate }`: guarda la hora de fin y programa la vibración.
    Responde `{ ok: true }` solo si hay un entreno activo.
  - `restCancel`: borra la hora de fin.
- **Vibración:** 3 × `WKInterfaceDevice.play(.notification)` al llegar a la
  hora de fin. Con un entreno activo la app sigue viva en segundo plano, así
  que el temporizador dispara aunque la muñeca esté bajada.
- **Pulso:** cada muestra nueva de `heartRate` del builder se manda al iPhone
  como `{ bpm, sampledAt }` (epoch ms) si hay conexión.
- **Vistas:**
  - Inicio: lista con los 4 cardios y Fuerza.
  - Entreno: tiempo, pulso, kcal, cuenta atrás del descanso si la hay, y
    Terminar.

### iPhone: plugin local `WatchBridgePlugin`

Sigue el mismo patrón que `HomeWidgetPlugin`: registro manual en
`MainViewController` y acceso lazy desde JS por `Capacitor.Plugins`.

- Activa `WCSession` al cargar.
- `restStart({ endDate })` → `{ delivered }`. Es `true` solo si el Watch
  respondió `ok`.
- `restCancel()`.
- `getHeartRate()` → `{ bpm, sampledAt }` o vacío: la última muestra que
  llegó del Watch.

### JS

- `src/lib/watchBridge.js`: puente lazy, sin efecto fuera de nativo.
- `restNotification.js`:
  - `scheduleRestEnd`: en nativo, primero `restStart`. Si el Watch confirma,
    no se programa la notificación local (así no hay aviso doble). Si no, se
    programa como hoy.
  - `cancelRestEnd`: manda `restCancel` y cancela la notificación local.
- `appleHealth.getLiveHeartRate`: primero la muestra del Watch, pasada por
  `pickLiveHeartRate` con `maxAgeMs` de 15 s. Si no hay, lee HealthKit como
  hoy.

## Errores

- Watch no emparejado, sin conexión o sin entreno: `delivered: false` y se
  usa la notificación local de siempre.
- Cualquier fallo del puente se registra y se sigue. El registro del entreno
  nunca se bloquea.

## Tests

- JS: `pickLiveHeartRate` ya cubre la selección por frescura con `maxAgeMs`.
  Los 206 tests actuales deben seguir en verde.
- Swift: solo se valida en el dispositivo.

## Trabajo manual en Xcode (Carlos)

1. File > New > Target > watchOS > App.
   - Nombre `RutinexWatch`.
   - "Watch App for Existing iOS App", con App como compañera.
   - Interface SwiftUI.
2. En el target del Watch:
   - Signing con el mismo equipo.
   - Capability **HealthKit**.
   - Capability **Background Modes** > **Workout processing**.
3. Info del target del Watch: `NSHealthShareUsageDescription` y
   `NSHealthUpdateUsageDescription`.

## Verificación en dispositivo

1. Instalar desde Xcode y dar los permisos de Salud en el Watch.
2. Iniciar Fuerza en el Watch. En el iPhone, marcar una serie con la pantalla
   desbloqueada: al acabar el descanso, el Watch vibra y el iPhone no muestra
   notificación.
3. El pulso del descanso en el iPhone coincide con el del Watch (±2 bpm,
   menos de 5 s de retraso).
4. Sin entreno en el Watch, el aviso vuelve a ser la notificación local.
5. Cardio en el Watch → Terminar → Fuerza → Terminar → Terminar en la app:
   el cardio y las kcal de fuerza salen en el resumen.

## Fuera de alcance

- Marcar series desde el Watch.
- Live Activity.
- PWA.
- Complicaciones.

## Verificación en dispositivo — ✅ pasada (2026-09-18)

Confirmado en el iPhone y el Apple Watch Ultra 2 (watchOS 26.6):

- El Watch vibra al acabar el descanso con el iPhone desbloqueado, y el iPhone
  no muestra notificación.
- El pulso del descanso en el iPhone coincide con el del reloj.
- Cardio en el Watch → Terminar → Fuerza → Terminar → Terminar en la app: el
  resumen trae el cardio detectado y las kcal reales de fuerza.

Notas de instalación, por si hay que repetirla: Xcode no ve el Watch hasta que
está en la misma red y con el modo desarrollador activo, "Fetching debug
symbols" puede quedarse colgado y no impide instalar, y borrar DerivedData
obliga a limpiar `~/Library/Caches/org.swift.swiftpm/artifacts/*capacitor*`
antes de resolver los paquetes otra vez.
