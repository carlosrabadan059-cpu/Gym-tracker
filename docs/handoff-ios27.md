# Handoff: paso a iOS 27 / watchOS 27 (21-24 de septiembre de 2026)

Carlos actualizó el iPhone y el Watch a 27, y Xcode a 27.0 (SDK iOS/watchOS
27). Ambos schemes compilan sin errores ni avisos propios. Todo está
commiteado y pusheado a `origin/main`. El detalle vive en los commits;
aquí solo lo que no se deduce de ellos.

**Estado: terminado (29-09-2026).** El paso a 27 está cerrado y verificado en
el iPhone y el Watch de Carlos. Lo de "Pendiente, sin prisa" no bloquea.

## Firma caducada el 24-09, antes de lo esperado

La firma de Apple ID gratuito no aguantó hasta el 29-09 como se pensaba: el
24-09 la app nativa dio "no disponible" en el iPhone. Al volver a desplegar
desde Xcode, el iPhone marcó el certificado de desarrollador como
"untrusted" — hay que ir a Ajustes → General → VPN y gestión de dispositivos
→ confiar en el desarrollador cada vez que esto pase. Carlos ya lo resolvió.
Con la firma gratuita esto se repite semanalmente; sin Apple Developer
Program de pago no hay forma de evitarlo, solo de recordarlo.

**Cada scheme tiene su propio perfil y caduca por separado.** El 24-09 solo
se redesplegó `App`, y el perfil de `com.rutinex.app.watchkitapp` (del 18-09)
caducó el 25-09 a las 00:29: la app del Watch no abrió en el entreno. Al
renovar, redesplegar **los dos** schemes. Las caducidades se ven con:

```bash
for f in ~/Library/Developer/Xcode/UserData/Provisioning\ Profiles/*; do
  security cms -D -i "$f" | plutil -extract ExpirationDate raw - ; done
```

**Xcode no renueva un perfil que sigue siendo válido** (comprobado el
30-09): redesplegar antes de la caducidad deja la misma fecha. Para renovar
antes hay que borrar los perfiles guardados y redesplegar; Xcode genera
unos nuevos de 7 días, iguales para las tres apps:

```bash
rm ~/Library/Developer/Xcode/UserData/Provisioning\ Profiles/*
```

El Watch se puede reinstalar sin Xcode, con el reloj conectado (id en
`xcrun devicectl list devices`):

```bash
cd ios/App
xcodebuild -project App.xcodeproj -scheme "RutinexWatch Watch App" \
  -destination 'id=<id del Watch>' -derivedDataPath /tmp/dd -allowProvisioningUpdates build
xcrun devicectl device install app --device <id del Watch> \
  "/tmp/dd/Build/Products/Debug-watchos/RutinexWatch Watch App.app"
```

## Prueba del entreno entero: superada (29-09)

Fuerza de 1:16 h con Rutinex en el Watch: `desc 28 · avisos 26 · est 2`. Los
2 descansos sin aviso son los que Carlos paró a mano a los 30 s. Los avisos
aguantan un entreno entero, así que se quitó el diagnóstico temporal. La
línea naranja que salió al terminar la elíptica (`est 3` a los 5 s) era un
falso positivo del vigilante: veía el cierre pedido con Terminar.

## Qué se resolvió

Cada punto está verificado en el dispositivo de Carlos salvo donde se diga.

- **Etiqueta "Watch" del cardio en el resumen** y **avisos que no llegaban al
  Watch** (`WCSession counterpart app not installed`): sin cambio de código.
  Bastó recompilar y reinstalar los schemes. Tras actualizar watchOS hay que
  reinstalar la app del reloj o el iPhone deja de verla instalada.
- **La música se cortaba** al marcar una serie: `0fcfa67`.
- **El aviso local llegaba en silencio**: `6aef62c`. Necesita además Vibración
  en "Especial" (app Watch → Sonidos y vibraciones) para que el reloj vibre.
- **El descanso no avisaba con la muñeca bajada**: `4861021`. Es el fallo de
  fondo de estos días, y el diagnóstico que lo destapó fueron los contadores en
  pantalla: marcaban `desc 2 · avisos 1`, o sea que el mensaje llegaba y el
  aviso no salía. watchOS congela la app aunque la sesión de entreno siga viva,
  y el `Timer` no dispara. Ahora avisa una notificación local del propio reloj.
  Probado en casa con 90 s de descanso, muñeca bajada: vibró y sonó. **Falta la
  prueba con un entreno entero.**
- **"Unable to end a workout that is not currently active"**: `4861021`.
  watchOS mata la sesión sin avisar al delegado — se vio que el último
  `didChangeTo` decía "en marcha" y `session.state` ya era `.ended`. Por eso
  `end()` consulta el estado en vez de fiarse del delegado, y al arrancar se
  recupera con `recoverActiveWorkoutSession` la sesión que queda huérfana si la
  app muere a mitad del entreno (pasa al reinstalar desde Xcode con un entreno
  activo).
- **Descanso de 120 s** en el selector, que sirve para las dos, nativa y PWA:
  `4861021`.

## Pendiente, sin prisa

- ~~**Pitido de la PWA sin probar.**~~ Cerrado el 29-09 por decisión de
  Carlos, junto con el fix de la música de `c8b9a6f`.
- **Por qué watchOS mata la sesión** sigue sin saberse. Lo de `4861021` es
  recuperación, no causa raíz. El `WKBackgroundModes` con `workout-processing`
  ya está declarado, así que no es eso. El 25-09 lo causó una carrera al
  arrancar (`b1d48a3`), y en el entreno del 29-09 no volvió a pasar.
- **El Watch sale dos veces** en Ajustes → Notificaciones → Rutinex → Reenvío.
  Carlos decidió dejarlo.
- **Entrenos de prueba de ~1 min en Salud** (25-09 y 29-09), de probar el
  Watch. No se pudieron borrar desde Salud y Carlos decidió dejarlos: la app
  solo lee Health al terminar una sesión (ventana de minutos) y para el aviso
  de entreno sin registrar (solo el día de hoy), así que no interfieren.

## Lo que hay que saber para continuar

- **Una web nueva no llega al iPhone** hasta hacer `npm run build` y
  `npx cap sync ios`, y después `git checkout -- public/version.json`.
- **Registro del Watch** (desde el 01-10): la app guarda cada paso de
  las sesiones en `Documents/eventos.log` del reloj. Se lee desde el Mac con
  el Watch cerca:
  `xcrun devicectl device copy from --device <id del Watch> --domain-type appDataContainer --domain-identifier com.rutinex.app.watchkitapp --source Documents/eventos.log --destination eventos.log`.
- **La consola del iPhone** se ve con ▶ (Run) en Xcode y ⇧⌘C, filtrando por
  `WatchBridge` o `RestNotification`. La del Watch no es práctica: de ahí que
  el diagnóstico se pinte en su pantalla.
- **En la app nativa no se usa audio web**, por decisión: con iOS 27 tanto Web
  Audio como `speechSynthesis` pausan la música del usuario, y
  `navigator.audioSession.type = 'ambient'` no lo evita. No volver a meterlo.
- **Probar sin ensuciar datos:** el temporizador se arranca a mano desde el
  modal del ejercicio (`toggleTimer`), sin marcar series. Así no se escribe
  nada en `workout_logs`. El 22-09 hubo que borrar a mano una fila de prueba.
- **Si Xcode se cuelga** en "Installing built products" con la pantalla del
  iPhone en negro: Stop, cerrar la app, iPhone desbloqueado y por cable.
- **La firma de Apple ID gratuito caduca cada 7 días** (caducó el 24-09, no
  el 29-09 como se pensaba). Al desplegar tras caducar, el iPhone pide
  confiar de nuevo en el desarrollador (Ajustes → General → VPN y gestión de
  dispositivos). Hay evento semanal los martes a las 19:00 en el
  calendario de Carlos.
- **Solo cuenta lo verificado en su iPhone y su Watch.** No tocar sus datos de
  producción; ver CLAUDE.md.

## Skills sugeridas

- `run-rutinex`: arrancar la app en el navegador, para lo que quede de la PWA.
- `mattpocock-skills:diagnosing-bugs`: si vuelve a fallar algo en dispositivo.
- `graphify`: preguntas sobre el código (`graphify query "..."`).
