# Avisos de fin de descanso en la app nativa

**Fecha:** 2026-09-16
**Alcance:** hacer que el aviso de fin de descanso funcione en el shell
nativo de Capacitor con el móvil bloqueado. Hoy no funciona en absoluto
ahí, y el fallo es silencioso.

## El hallazgo

El aviso de fin de descanso **nunca ha funcionado en la app nativa**. Lo
que se veía venía de la PWA, que sigue instalada en el mismo iPhone.

La cadena completa:

1. El único mecanismo de aviso del proyecto es Web Push a través de
   `public/sw.js`. No hay ningún plugin nativo de notificaciones
   instalado — solo `@capacitor/haptics` y `@capgo/capacitor-health`.
2. Apple solo admite Web Push en PWAs añadidas a la pantalla de inicio
   desde Safari. En el `WKWebView` de Capacitor no existe `PushManager`,
   así que `subscribeToPush` (`src/lib/pushNotifications.js`) sale por su
   propia guarda y devuelve `false` sin suscribir nada.
3. `push_subscriptions` guarda **una fila por usuario**
   (`onConflict: 'user_id'`). Esa fila es la de la PWA. Cuando la app
   nativa llama a `scheduleServerPush`, la Edge Function la encuentra y
   manda el push correctamente… **al icono de la PWA**. Desde la app
   nativa eso es, además de inútil, ruido en el icono equivocado.

En el modal del ejercicio hay tres caminos que disparan el fin de
descanso, y en nativo solo sobreviven dos, ninguno de ellos útil estando
bloqueado:

| Camino | `ExerciseDetailModal.jsx` | En nativo |
|---|---|---|
| `setInterval` de la cuenta atrás | ~línea 422 | Solo en primer plano |
| Mensaje `TIMER_FIRED` del service worker | ~línea 444 | No llega: sin SW |
| Repescado al volver a la app (`visibilitychange`) | ~línea 464 | Suena tarde, al desbloquear |

De ahí el síntoma: con la app nativa, el descanso termina en silencio y el
pitido salta al desbloquear, cuando ya no avisa de nada.

## Decisiones tomadas (brainstorming, no reabrir)

1. **Se mantienen las dos aplicaciones**, PWA y nativa. Es una restricción
   fijada por el usuario, no una consecuencia técnica.
2. **En nativo, notificaciones locales** (`@capacitor/local-notifications`,
   plugin oficial). Se programan en el propio iPhone a la hora exacta y
   disparan con la pantalla bloqueada e incluso con la app cerrada. Sin
   servidor, sin suscripción, sin Edge Function esperando en background.
3. **En la PWA no se toca nada**: sigue con Web Push exactamente igual.
4. **Push nativo por APNs descartado, y no por coste de trabajo.** La
   capacidad de push exige un perfil de aprovisionamiento con entitlement
   de push, que un Apple ID gratuito no puede firmar. Está cerrado por la
   decisión, ya tomada y documentada, de no pagar el Developer Program.
5. **El permiso se pide desde el banner ámbar que ya existe** en el modal
   del ejercicio ("Acción requerida para avisos en reposo"), que ya
   detecta la falta de permiso y ya trae botón. No se añade UI nueva, y la
   petición aparece en el sitio donde se entiende para qué sirve.

## Arquitectura

### `src/lib/restNotification.js` (nuevo)

Un único sitio que decide cómo avisar según la plataforma. Sigue el patrón
que ya usan `appleHealth.js`, `liveActivity.js` y `homeWidget.js`: el
puente vive aislado y quien lo llama no se entera de en qué plataforma
está.

- `scheduleRestEnd({ userId, targetTime, sessionId })` — en nativo programa
  la notificación local usando `sessionId` como id; en web mantiene el
  camino actual (`subscribeToPush` y después `scheduleServerPush`). **En
  nativo no se llama a `scheduleServerPush`**: es justo lo que hoy hace
  sonar el icono de la PWA.
- `cancelRestEnd(sessionId)` — cancela lo programado en la plataforma que
  toque.
- `checkNotificationPermission()` y `requestNotificationPermission()` — en
  nativo por el plugin, en web por la API web. El banner usa estas dos y
  deja de mirar `Notification.permission` directamente, que en el
  `WKWebView` no significa nada.

Copia del aviso, idéntica a la actual para que las dos plataformas digan lo
mismo: título "¡Recuperación completada! 💪", cuerpo "¡Es hora de tu
siguiente serie!".

### `src/views/ExerciseDetailModal.jsx`

- Los dos puntos que hoy programan avisos — `toggleSet` (al marcar serie) y
  `toggleTimer` (al arrancar el descanso a mano) — pasan a llamar a
  `scheduleRestEnd`.
- El banner ámbar consulta el permiso por el módulo. Como en nativo la
  consulta es asíncrona, el estado del permiso vive en un `useState` que se
  rellena al montar; el banner se pinta a partir de él.
- La función local `requestNotificationPermission` (~línea 198) **se
  sustituye** por la del módulo. Hoy hace dos cosas atadas: pide permiso
  por la API web y, si se concede, suscribe a Web Push. En el módulo esas
  dos cosas se separan por plataforma — en web sigue suscribiendo igual, en
  nativo solo pide permiso al plugin, porque ahí no hay suscripción que
  crear. Se llama desde el botón del banner y, de forma oportunista, desde
  `unlockAudio` en cada serie marcada; ese segundo uso se mantiene y es
  seguro, porque iOS solo enseña el diálogo la primera vez.

### `capacitor.config.json`

`presentationOptions: []` para LocalNotifications: con la app en primer
plano no se muestra banner. Así el aviso del sistema y el pitido interno no
pueden coincidir nunca, sin depender de cancelar en el instante exacto —
que sería una carrera, exactamente el error que se acaba de corregir en
`sw.js`.

En primer plano avisa el pitido y la vibración de siempre; bloqueado o en
segundo plano, la notificación local. Cada situación tiene un único aviso y
un único dueño.

## Cancelación

`timerSessionIdRef` ya sube en cada descanso y ya se usa para descartar
avisos huérfanos de descansos cancelados. Se reutiliza tal cual como id de
notificación:

- Al arrancar un descanso, se cancela el del `sessionId` anterior.
- Al detenerlo a mano o cerrar el ejercicio, se cancela el suyo.

No se inventa un esquema de identidad nuevo.

## Errores

Cualquier fallo del plugin (permiso denegado, excepción) se registra con
`console.error` y se sigue. El aviso es un extra: el registro del entreno
nunca se bloquea por él, mismo criterio que el resto de puentes nativos del
proyecto.

## Tests

**No se añaden tests nuevos, y se dice explícitamente en vez de inventar
unos de adorno.** El módulo es una capa fina de llamadas a plataforma, como
`liveActivity.js` y `homeWidget.js`, que tampoco los tienen; su
comportamiento real solo se puede comprobar en el dispositivo.

Lo que sí es obligatorio: **los 206 tests actuales siguen en verde**. El
riesgo real de este cambio no está en la parte nativa sino en romper el
camino de la PWA al moverlo de sitio.

## Fuera de alcance

- No se toca el flujo de la PWA ni la Edge Function `send-timer-push`.
- No se unifican las dos plataformas en un solo mecanismo: no se puede,
  cada una solo admite el suyo.
- No se añade sonido propio a la notificación; se usa el del sistema.

## Verificación en dispositivo — ✅ pasada (2026-09-16)

Confirmada en el iPhone: la notificación llega con el móvil bloqueado y
desde el icono de la app nativa, y en primer plano no aparece banner
(`presentationOptions: []` se comporta como se esperaba).

Pasos que se siguieron:

Recompilar en Xcode tras `npm run build && npx cap sync ios`. El plugin no
pide capability ni entrada en Info.plist, solo permiso en tiempo de
ejecución, así que no hay trabajo de configuración en Xcode.

Prueba real, con la app nativa (no la PWA):

1. Conceder el permiso desde el banner del ejercicio.
2. Marcar una serie y bloquear el móvil.
3. Al terminar la cuenta atrás debe llegar la notificación, **del icono de
   la app nativa**, no del de la PWA.
4. Repetir sin bloquear: en primer plano debe sonar el pitido y no
   aparecer banner.
