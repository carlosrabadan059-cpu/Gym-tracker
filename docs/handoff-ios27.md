# Handoff: paso a iOS 27 / watchOS 27 (21-24 de septiembre de 2026)

Carlos actualizó el iPhone y el Watch a 27, y Xcode a 27.0 (SDK iOS/watchOS
27). Ambos schemes compilan sin errores ni avisos propios. Todo está
commiteado en `main`; `c4075a6` y anteriores están en `origin/main`, y
`4861021` y `c4f234d` **siguen sin push**. El detalle vive en los commits;
aquí solo lo que no se deduce de ellos.

## Firma caducada el 24-09, antes de lo esperado

La firma de Apple ID gratuito no aguantó hasta el 29-09 como se pensaba: el
24-09 la app nativa dio "no disponible" en el iPhone. Al volver a desplegar
desde Xcode, el iPhone marcó el certificado de desarrollador como
"untrusted" — hay que ir a Ajustes → General → VPN y gestión de dispositivos
→ confiar en el desarrollador cada vez que esto pase. Carlos ya lo resolvió.
Con la firma gratuita esto se repite semanalmente; sin Apple Developer
Program de pago no hay forma de evitarlo, solo de recordarlo.

## Lo único pendiente ahora mismo

**Carlos entrena el 25-09 y comprueba si los avisos de descanso aguantan un
entreno entero** (se pospuso del 24-09 por la firma caducada). Ya tiene los
dos schemes instalados. Al terminar, antes de pulsar Terminar en el reloj,
mirará la línea de diagnóstico de la pantalla del entreno y dirá qué marca:

- `desc N` — descansos que el reloj recibió del iPhone.
- `avisos N` — veces que le tocó avisar.
- `est N` — último estado que reportó el delegado (2 = en marcha, 3 =
  terminada, 4 = pausada, 6 = detenida).
- Línea naranja, si aparece: `viva HH:MM:SS · muerta HH:MM:SS` o `fallo: …`.

Si el entreno va bien, **quitar ese diagnóstico**: los `@Published`
`restsReceived`, `alertsFired`, `lastState`, `deathNote`, el `watchdog` de
`WorkoutManager.swift` y los `Text` de `ContentView.swift`. Están marcados con
`Diagnóstico temporal (23-09-2026)`.

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

- **Pitido de la PWA sin probar.** `0fcfa67` solo quitó el audio en la app
  nativa; nadie ha comprobado que en Safari siga sonando.
- **Por qué watchOS mata la sesión** sigue sin saberse. Lo de `4861021` es
  recuperación, no causa raíz. El `WKBackgroundModes` con `workout-processing`
  ya está declarado, así que no es eso. La línea naranja del diagnóstico
  existe para acotar cuándo pasa.
- **El Watch sale dos veces** en Ajustes → Notificaciones → Rutinex → Reenvío.
  Carlos decidió dejarlo.

## Lo que hay que saber para continuar

- **Una web nueva no llega al iPhone** hasta hacer `npm run build` y
  `npx cap sync ios`, y después `git checkout -- public/version.json`.
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
  dispositivos). Hay evento semanal los miércoles a las 19:00 en el
  calendario de Carlos.
- **Solo cuenta lo verificado en su iPhone y su Watch.** No tocar sus datos de
  producción; ver CLAUDE.md.

## Skills sugeridas

- `run-rutinex`: arrancar la app en el navegador, para lo que quede de la PWA.
- `mattpocock-skills:diagnosing-bugs`: si vuelve a fallar algo en dispositivo.
- `graphify`: preguntas sobre el código (`graphify query "..."`).
