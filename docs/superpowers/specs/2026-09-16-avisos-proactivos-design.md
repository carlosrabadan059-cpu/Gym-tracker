# Avisos proactivos: inactividad, insight semanal y entreno sin registrar (v2 Fase 5)

**Fecha:** 2026-09-16 (ampliado el mismo día con la tercera pieza)
**Alcance:** tres de las piezas de Fase 5 (pulido opcional) de
`docs/plan-apple-health-integration.md` — "aviso si llevan varios días sin
sincronizar", "insight semanal de actividad" y "notificación proactiva"
(Health detecta un entreno sin log en Rutinex ese día).

## Punto de partida real y corrección de premisa

El plan original asumía un proceso de sincronización de fondo con Health
que podía quedarse atrás. No existe: `getTodayMetrics()` y
`getWeeklyHealthSummary()` (`src/lib/appleHealth.js`) leen HealthKit en
vivo cada vez que se abre la app, sin ningún timestamp de "última
sincronización" guardado en ningún sitio.

**Decisión (brainstorming, no reabrir):** las dos piezas se redefinen sin
depender de Health en absoluto:

1. **"Aviso de sincronización"** → aviso de **inactividad real**: llevas
   `INACTIVITY_ALERT_DAYS` (7, ya existe en `src/lib/adherence.js`, hoy solo
   usado por el entrenador) días sin registrar un entreno en `workout_logs`.
2. **"Insight semanal"** → resumen de **sesiones registradas esta semana**,
   sin datos de Health (pasos, calorías activas) — mismo dato en PWA y en
   la app nativa, sin que el contenido varíe según si el cliente conectó
   Health o no.

## Arquitectura

### Datos

Sin migración. `notifications.type` (`text`, default `'info'`) ya existe —
se usan dos valores nuevos: `'inactivity'` y `'weekly_insight'`.

### Funciones puras — `src/lib/proactiveNotifications.js`

```js
/**
 * ¿Toca avisar de inactividad? true si daysSinceLastSession no es null,
 * es >= threshold, Y la última notificación de este tipo (si existe) es
 * anterior a la fecha de la última sesión — así se avisa una vez por racha
 * de inactividad, no una vez por apertura de app.
 */
export function shouldNotifyInactivity({ lastSessionDate, threshold, lastInactivityNotificationDate }) { ... }

/**
 * ¿Toca mandar el insight semanal? true si sessionCountThisWeek > 0 y no
 * existe ya una notificación de este tipo creada desde weekStart.
 */
export function shouldNotifyWeeklyInsight({ sessionCountThisWeek, weekStart, lastWeeklyInsightNotificationDate }) { ... }
```

Ambas reciben datos ya resueltos (fechas, contadores), no hacen fetch — se
testean sin mockear Supabase, mismo patrón que `adherence.js`.

### Orquestación — mismo fichero, funciones async

```js
export async function checkInactivityNotification(userId) { ... }   // fetch + shouldNotifyInactivity + insert
export async function checkWeeklyInsightNotification(userId) { ... } // fetch + shouldNotifyWeeklyInsight + insert
```

- `checkInactivityNotification`: consulta `workout_logs` del usuario
  (`order('date', {ascending: false}).limit(1)`) para la última sesión;
  reutiliza `computeDaysSinceLastSession` (`adherence.js`) pasándole ese
  único valor. Consulta `notifications` (`type='inactivity'`,
  `created_at desc limit 1`) para la última notificación de este tipo.
  Inserta `{user_id, type: 'inactivity', title: 'Llevas unos días sin entrenar', message: '...'}`
  si `shouldNotifyInactivity` da `true`.
- `checkWeeklyInsightNotification`: usa `getWeekStart` (`utils.js`, fuente
  única de "inicio de semana") para contar sesiones de `workout_logs` desde
  ese límite. Consulta la última notificación `type='weekly_insight'`.
  Inserta `{user_id, type: 'weekly_insight', title: 'Resumen de tu semana', message: 'Esta semana: N entreno(s)'}`
  si `shouldNotifyWeeklyInsight` da `true`.

### Disparo — `DashboardView.jsx`

Un `useEffect` nuevo, al montar, con `user?.id` como dependencia — mismo
patrón que los `useEffect` de carga ya existentes ahí. Llama a las dos
funciones de orquestación en paralelo (`Promise.all`), sin bloquear el
render del dashboard (best-effort, errores solo a `console.error`, igual
que el resto de side-effects no críticos del proyecto).

## Testing

`src/lib/proactiveNotifications.test.js` — casos para
`shouldNotifyInactivity`:
- `lastSessionDate` null (nunca entrenó) → `false`.
- Días desde la última sesión por debajo del umbral → `false`.
- Igual o por encima del umbral, sin notificación previa → `true`.
- Igual o por encima del umbral, con notificación previa **anterior** a la
  última sesión (o sea, de la racha de inactividad anterior) → `true`.
- Igual o por encima del umbral, con notificación previa **posterior** a la
  última sesión (ya avisado en esta racha) → `false`.

Y para `shouldNotifyWeeklyInsight`:
- 0 sesiones esta semana → `false`.
- 1+ sesiones, sin notificación previa → `true`.
- 1+ sesiones, con notificación previa ya creada desde `weekStart` →
  `false`.
- 1+ sesiones, con notificación previa de una semana anterior a `weekStart`
  → `true`.

Sin test para las funciones de orquestación (fetch/insert) ni para el
`useEffect` de `DashboardView.jsx` — mismo criterio que el resto de
piezas de UI/fetch del proyecto.

**Verificación en navegador:** con un usuario de prueba, forzar
`workout_logs` con fecha antigua y comprobar que aparece la notificación de
inactividad una sola vez (no en cada refresco); registrar un entreno hoy y
comprobar que aparece el insight semanal.

## Tercera pieza — entreno detectado sin registrar

**Decisión (brainstorming, no reabrir):** match **por día completo**, no
por sesión individual — si Health tiene algún entreno reconocido hoy
(fuerza o uno de los 4 tipos de cardio ya mapeados en `appleHealth.js`) y
Rutinex no tiene ningún `workout_log` hoy, se avisa una vez al día. No se
cruzan horarios entre los dos sistemas (evita el caso "ya registré uno por
la mañana pero hice otro sin registrar por la tarde" — aceptado como
limitación conocida, YAGNI para una pieza de pulido opcional).

### Función pura

```js
/**
 * ¿Toca avisar de un entreno de Health sin registrar hoy?
 */
export function shouldNotifyUnloggedWorkout({ hasRecognizedHealthWorkoutToday, hasLoggedWorkoutToday, alreadyNotifiedToday }) { ... }
```

### Orquestación

`checkUnloggedWorkoutNotification(userId)`:
- `if (!isHealthAvailableOnThisPlatform()) return;` — solo nativo, igual
  que el resto de Health.
- `todayStart` con el patrón `new Date(); setHours(0,0,0,0)` ya usado en
  varios sitios de `utils.js` — sin helper nuevo.
- Reutiliza `getMostRecentWorkout` (`appleHealth.js`) con
  `sinceMinutesAgo` calculado desde `todayStart` en vez del `90` que usa
  `DashboardView.jsx` para el detector de cardio en vivo — misma función,
  ventana distinta.
- `hasRecognizedHealthWorkoutToday` = el workout devuelto existe y
  (`isStrengthWorkout(workout)` o `mapWorkoutToCardioType(workout)` no
  nulo).
- `hasLoggedWorkoutToday` = alguna fila en `workout_logs` con
  `date >= todayStart` para ese usuario (mismo patrón `gte` ya usado en
  `utils.js`).
- `alreadyNotifiedToday` = notificación `type='unlogged_workout'` con
  `created_at >= todayStart`.
- Mensaje: `Detectamos ${duración} min de ${tipo} sin registrar en
  Rutinex, ¿lo añades?` — duración de `Math.round(workout.duration / 60)`,
  tipo "fuerza" o el tipo de cardio detectado.

### Disparo

Mismo `useEffect` de `DashboardView.jsx` ya usado para inactividad e
insight semanal — se añade a la llamada en paralelo.

### Testing

`shouldNotifyUnloggedWorkout`: 4 casos — sin entreno de Health reconocido
hoy → `false`; con entreno + ya hay log hoy → `false`; con entreno + sin
log + ya avisado hoy → `false`; con entreno + sin log + sin avisar → `true`.
Sin test para la orquestación, mismo criterio que el resto.

## Fuera de alcance

- Cualquier dato de Health en el insight semanal (pasos, calorías) —
  descartado en el brainstorming, mismo contenido en PWA y app nativa.
- Registrar un timestamp real de "última lectura de Health" — la
  interpretación de "sincronización" se redefinió como inactividad de
  entreno, no de Health.
- Notificaciones push nativas para las tres piezas — se insertan como
  filas de `notifications`, mismo canal que el resto de notificaciones de
  la app (ya visible vía `NotificationsContext` + Realtime).
- Matching por sesión individual en el aviso de entreno sin registrar
  (solo por día completo).
- Widget de pantalla de inicio y frecuencia cardíaca en vivo — resto de
  Fase 5, requieren trabajo nativo Swift/WidgetKit fuera del alcance de
  esta sesión, quedan pendientes para una sesión dedicada con iteración en
  Xcode.
