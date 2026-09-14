# Fase 5 (parte 1) — Dashboard de entrenador de verdad

**Fecha:** 2026-09-15
**Alcance:** `docs/plan-trainer-improvements.md`, Fase 5, primer punto
("Dashboard de entrenador de verdad: hoy son dos botones. Debería abrir con
una lista priorizada — quién necesita atención hoy, quién progresa, quién
está parado — en vez de obligar a entrar cliente por cliente"). Los otros
dos puntos de Fase 5 (datos de salud del cliente vía v2 Apple Health, y
volumen semanal por grupo muscular vía el etiquetado de v3 Fase C) quedan
**fuera de este spec** a propósito — dependen de trabajo no hecho todavía en
otros planes, mientras que esta pieza no depende de nada nuevo: reutiliza
`computeStreak`/`computeDaysSinceLastSession` (Fase 4) y `scheduled_days`
(Fase 3, calendario semanal), ambos ya construidos.

## Decisiones tomadas (brainstorming, no reabrir)

1. **"Necesita atención"** = inactividad (`daysSinceLastSession === null` o
   `>= INACTIVITY_ALERT_DAYS`, criterio ya existente en `ClientsListView`)
   **o** tiene una rutina programada para hoy (`scheduled_days` incluye el
   día actual) y no ha entrenado hoy. Combina la señal que ya existía con la
   pieza de calendario semanal recién construida.
2. **"Progresa"** = racha viva (`computeStreak(...) > 0`), reusando la
   función tal cual — sin lógica nueva de progresión de carga o peso.
3. **Prioridad cuando ambas señales aplican**: atención gana sobre
   progreso. Un cliente con racha viva de ayer que hoy tenía rutina
   programada y no la ha hecho sigue necesitando atención — la racha no
   tapa eso.
4. **`TrainerDashboardView.jsx` deja de ser 2 botones**: se abre
   directamente con la lista priorizada. El botón "Librería" se mantiene,
   y se añade acceso a la lista completa/búsqueda/añadir cliente (que sigue
   siendo `ClientsListView.jsx`, sin cambios) más abajo.

## Arquitectura

### 1. `src/lib/trainerPriority.js` (nuevo, función pura)

```js
/**
 * Categoriza a un cliente para el dashboard del entrenador. Puro: todas
 * las señales se pasan ya calculadas, no hace fetch ni llama a `new Date()`.
 *
 * @param {object} signals
 * @param {number|null} signals.daysSinceLastSession - de computeDaysSinceLastSession
 * @param {number} signals.streak - de computeStreak
 * @param {boolean} signals.hasRoutineScheduledToday - alguna rutina asignada
 *   tiene scheduled_days que incluye el día de hoy (isRoutineScheduledForDay)
 * @param {boolean} signals.trainedToday - hay al menos un workout_log de
 *   hoy para este cliente (cualquier rutina, no necesariamente la programada)
 * @returns {'attention'|'progressing'|'neutral'}
 */
export function categorizeClient({ daysSinceLastSession, streak, hasRoutineScheduledToday, trainedToday }) {
    const isInactive = daysSinceLastSession === null || daysSinceLastSession >= INACTIVITY_ALERT_DAYS;
    const missedToday = hasRoutineScheduledToday && !trainedToday;
    if (isInactive || missedToday) return 'attention';
    if (streak > 0) return 'progressing';
    return 'neutral';
}
```

`INACTIVITY_ALERT_DAYS` se importa de `src/lib/adherence.js` (ya existe, no
se duplica el número). El motivo concreto de "atención" (inactividad vs.
rutina de hoy sin hacer) se calcula por separado en la vista para mostrarlo
en la tarjeta — `categorizeClient` solo decide el grupo, no el texto.

### 2. `TrainerDashboardView.jsx` — fetch y agrupación

Mismo patrón de dos pasos que `ClientsListView.jsx` (sin FK directa
`trainer_clients` → `profiles`, sin FK entre `workout_logs`/`assigned_routines`
y `profiles`):

1. `trainer_clients` → `client_id`s del entrenador.
2. En paralelo: `profiles` (los perfiles), `workout_logs` (`user_id, date`,
   todas las fechas — se necesitan para `computeStreak`, no solo la más
   reciente como hace hoy `ClientsListView`), `assigned_routines` (`client_id,
   routine_id`) y `routines` (`id, scheduled_days`) para los `routine_id`
   devueltos.
3. Por cliente: `datesForClient` (fechas de sus logs) →
   `computeDaysSinceLastSession(datesForClient)`,
   `computeStreak(datesForClient)`, `trainedToday` (alguna fecha de
   `datesForClient` cae en el día de hoy, comparación por día calendario
   igual que ya hace `adherence.js` internamente — reimplementar la misma
   comparación de día, no exportar una función nueva de `adherence.js` solo
   para esto ya que es una línea), `hasRoutineScheduledToday` (alguna de sus
   rutinas asignadas tiene `isRoutineScheduledForDay(routine.scheduled_days,
   new Date().getDay())`).
4. `categorizeClient(...)` por cliente → tres arrays: `attentionClients`,
   `progressingClients`, `neutralClients`.

### 3. Render

Tres secciones, cada una solo si tiene elementos:

- **"Necesitan atención"** (si hay alguna): tarjeta de cliente + motivo en
  texto — "Sin sesiones" / "Hace N días" (mismo texto que el badge que ya
  existe en `ClientsListView`) o "Rutina de hoy sin hacer" cuando el motivo
  es `missedToday` y no inactividad. Si ambos motivos aplican a la vez, se
  muestra el de inactividad (es el más grave).
- **"Progresando"** (si hay alguna): tarjeta de cliente + "🔥 Racha de N
  días".
- El resto (`neutralClients`) se lista debajo sin cabecera de sección
  destacada, o bajo "Resto de tus clientes" si las otras dos secciones no
  están vacías (mismo criterio visual que "Resto de tus rutinas" del
  Dashboard de cliente en el calendario semanal — consistencia entre
  ambos lados de la app).
- Cada tarjeta de cliente reusa el mismo diseño de fila que
  `ClientsListView.jsx` (avatar, nombre, chevron) — se extrae a un
  componente compartido si la duplicación resulta molesta al implementar,
  decisión que se deja al criterio del desarrollador en el plan (no hay
  diferencia funcional en duplicar una fila de card simple).
- Debajo de las tres secciones: los accesos que hoy son los dos botones
  del dashboard — "Librería" (igual que hoy) y un nuevo acceso "Todos los
  clientes" que abre `ClientsListView.jsx` sin cambios (para buscar/añadir
  cliente, casos que esta lista priorizada no cubre).
- Pulsar una tarjeta de cliente navega directo al perfil de ese cliente
  (`trainer_client_profile`), sin pasar por `ClientsListView` — para eso
  `TrainerDashboardView` necesita las mismas dos piezas que hoy tiene
  `TrainerClientsView` (`onSelectClient` para fijar el cliente activo,
  navegación a la vista de perfil). Se añade un prop combinado
  `onOpenClient(client)` en `GymTrackerApp.jsx` que hace ambas cosas a la
  vez.

### 4. `GymTrackerApp.jsx` — wiring

`TrainerDashboardView` gana un prop nuevo:

```jsx
<TrainerDashboardView
    onNavigate={handleNavigate}
    onOpenClient={(client) => { setCurrentClient(client); setView('trainer_client_profile'); }}
/>
```

Mismo patrón que ya usa `TrainerClientsView` (`onSelectClient={setCurrentClient}`
+ `onOpenProfile`), combinado en una sola función porque
`TrainerDashboardView` solo necesita ir directo al perfil, nunca a la lista
intermedia.

## Fuera de alcance (explícito)

- Datos de salud del cliente (peso, FC, pasos) — depende de v2 Apple
  Health, no construido.
- Volumen semanal por grupo muscular — depende del etiquetado de v3 Fase C,
  no construido.
- `ClientsListView.jsx` no se modifica.
- Cualquier ordenación dentro de cada sección más allá de la agrupación en
  tres grupos (p.ej. ordenar "necesitan atención" por días de inactividad
  descendente) — no pedido, se deja en el orden que devuelva la consulta.
- Paginación o límite de clientes mostrados — el modelo actual es un
  entrenador con pocos clientes (relación 1 cliente → 1 entrenador), no
  hace falta todavía.

## Testing

`src/lib/trainerPriority.test.js` (nuevo): `categorizeClient` — inactivo
por `daysSinceLastSession === null`, inactivo por `>= INACTIVITY_ALERT_DAYS`,
activo pero con rutina de hoy sin hacer → atención, racha viva sin ninguna
señal de atención → progreso, racha viva pero también rutina de hoy sin
hacer → atención (gana sobre progreso), sin ninguna señal → neutral.

Sin test para el fetch/JSX de `TrainerDashboardView.jsx` — mismo criterio
que `ClientsListView.jsx`, que tampoco lo tiene.
