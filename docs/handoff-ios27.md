# Handoff: paso a iOS 27 / watchOS 27 (21-22 de septiembre de 2026)

Carlos actualizó el iPhone y el Watch a 27, y Xcode a 27.0 (SDK iOS/watchOS
27). Los dos schemes compilan sin errores. Todo lo de esta sesión está
commiteado en `main` y **sin push**: `0fcfa67` y `6aef62c`. El detalle vive en
esos commits; aquí solo lo que no se deduce de ellos.

## Qué se resolvió

- **Etiqueta "Watch" del cardio en el resumen.** El dato se guardaba bien
  (`cardio.source: "health"` en `workout_logs`); la web instalada en el iPhone
  era anterior al commit que pinta la etiqueta. No hubo cambio de código: se
  volvió a compilar y a sincronizar.
- **Avisos de descanso sin llegar al Watch.** Tras actualizar a watchOS 27, la
  consola mostraba `WCSession counterpart app not installed`. Se arregló
  reinstalando el scheme `RutinexWatch Watch App` desde Xcode. Tampoco hubo
  cambio de código.
- **La música se cortaba** al marcar una serie: `0fcfa67`. Verificado en el
  dispositivo.
- **El aviso local llegaba en silencio**: `6aef62c`. Ahora el Watch pita y,
  con Vibración en "Especial" (app Watch → Sonidos y vibraciones), también
  vibra. Verificado en el dispositivo.

## Pendiente

- **Pitido de la PWA sin probar.** `0fcfa67` solo quita el audio en la app
  nativa, pero nadie ha comprobado que el pitido siga sonando en la PWA de
  Safari.
- **Carpeta sin seguimiento `ios/App/App.xcodeproj/xcshareddata/`.** Son los
  schemes que generó Xcode 27. Carlos no ha decidido si versionarla o
  ignorarla.
- **El Watch sale dos veces** en Ajustes → Notificaciones → Rutinex → Reenvío.
  Parece un registro viejo de la actualización. Carlos decidió dejarlo: no
  molesta y desemparejar obliga a reinstalar.

## Lo que hay que saber para continuar

- **Una web nueva no llega al iPhone** hasta hacer `npm run build` y
  `npx cap sync ios`, y después `git checkout -- public/version.json`. Luego
  Carlos ejecuta `App` desde Xcode.
- **La consola se ve** con ▶ (Run) en Xcode y ⇧⌘C, filtrando por
  `WatchBridge` y `RestNotification`. Las trazas de `0fcfa67` dicen en qué paso
  falla el aviso:
  - `installed=false`: hay que reinstalar la app del Watch.
  - `Watch confirmó: false` y luego `Aviso local programado`: el camino del
    iPhone funciona.
- **En la app nativa ya no se usa audio web**, por decisión: con iOS 27 tanto
  Web Audio como `speechSynthesis` pausan la música, y
  `navigator.audioSession.type = 'ambient'` no lo evitó. No volver a meter
  audio ahí.
- **Si Xcode se cuelga en "Installing built products"** con la pantalla del
  iPhone en negro: Stop, cerrar la app, iPhone desbloqueado y por cable, y
  reintentar.
- **Solo cuenta lo verificado en el dispositivo de Carlos.** No tocar sus
  datos de producción; ver CLAUDE.md.

## Skills sugeridas

- `run-rutinex`: arrancar la app y conducirla en el navegador. Sirve para
  comprobar el pitido en la PWA.
- `mattpocock-skills:diagnosing-bugs`: si reaparece un fallo de avisos o de
  audio en el dispositivo.
- `graphify`: preguntas sobre el código (`graphify query "..."`).
