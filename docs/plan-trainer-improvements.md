# Plan: mejoras del lado entrenador

**Fecha:** 2026-09-07
**Estado:** propuesta, nada decidido ni implementado. No está asignado a una
versión concreta todavía — la Fase 0 no debería esperar a ninguna (ver abajo),
el resto puede intercalarse con la versión 2
([Apple Health](plan-apple-health-integration.md)) o la 3
([funciones de gimnasio](plan-gym-app-features.md)).

---

## Punto de partida real

Revisado el código antes de proponer nada:

| Vista | Qué hace hoy | Líneas |
|---|---|---|
| `TrainerDashboardView.jsx` | dos botones (Clientes, Librería) + cerrar sesión | 48 |
| `ClientsListView.jsx` | lista de clientes con avatar y nombre | 88 |
| `ClientProfileView.jsx` | peso del cliente, nº de sesiones (últimas 20), rutinas asignadas (editar/borrar ejercicios), historial de entrenamientos | 572 |
| `RoutineAssignerView.jsx` | montar y asignar rutinas | 701 |
| `TrainerLibraryView.jsx` | catálogo de ejercicios (crear/editar, con imagen) | 868 |
| `AddExercisePanel.jsx` | añadir ejercicio a una rutina: **solo series y reps** | 243 |

La prescripción hoy es literalmente `series` + `reps` por ejercicio
(columnas de la tabla `exercises`: `id, routine_id, name, series, reps,
image_url, ui_order, catalog_id`). Todo lo demás —cuánto peso, cuánto
descanso, a qué intensidad, con qué técnica— queda fuera de la app.

---

## Fase 0 — Fundamentos que faltan (no debería esperar)

**1. Relación entrenador ↔ cliente.**
Hoy `ClientsListView.jsx` hace `supabase.from('profiles').select('*')` y
filtra en cliente los que no son entrenadores: **cualquier entrenador ve a
todos los clientes de la plataforma**. `routines` sí tiene `trainer_id` y
`assigned_routines` tiene `assigned_by`, pero `profiles` no tiene dueño.
Hace falta una tabla `trainer_clients` (o columna `trainer_id` en
`profiles`) + políticas RLS que lo respeten. Cualquier mejora que se
construya encima multiplica este problema, por eso va primero.

**2. Plantillas de rutina reutilizables.**
Hoy cada rutina se crea dentro de una asignación; no hay forma de reutilizar
"Día 2 · Empuje" con otro cliente sin rehacerla. Marcar rutinas como
plantilla (`is_template`) y poder clonarlas a un cliente concreto.

## Fase 1 — Prescripción completa

El núcleo. Añadir a la tabla `exercises` y al panel de creación
(`AddExercisePanel.jsx`, `RoutineAssignerView.jsx`):

| Campo nuevo | Para qué |
|---|---|
| `target_weight` o `target_pct_1rm` | prescribir carga (absoluta o como % del 1RM, que v3 Fase A ya calcula) |
| `target_rir` / `target_rpe` | prescribir intensidad, no solo volumen |
| `rest_seconds` | hoy el descanso es un valor fijo del cliente (60s por defecto en `ExerciseDetailModal.jsx`); debería poder marcarlo el entrenador por ejercicio |
| `tempo` | ej. `3-1-2`, la parte técnica que hoy no cabe en ningún sitio |
| `notes` | indicaciones por ejercicio ("codos pegados", "no bloquear arriba") |

En la app del cliente estos valores aparecen como objetivo dentro del modal
del ejercicio. Encaja con v3 Fase A: donde ahí la sugerencia de peso venía de
la IA, aquí puede venir del entrenador — y cuando existan las dos, la del
entrenador manda y la IA solo sugiere ajustes.

## Fase 2 — Programación en el tiempo

- **Calendario semanal**: qué rutina toca cada día. Hoy las rutinas son
  "Día 1-4" sin fecha ni orden temporal real.
- **Progresión programada**: definir 4 semanas de una vez (sem. 1: 3×10 @70%,
  sem. 2: 3×12 @70%…) en vez de reeditar la rutina cada semana.
- **Mesociclo con fechas**: inicio, fin, y qué pasa al terminar.

## Fase 3 — Seguimiento y feedback

- **Adherencia**: % de sesiones completadas sobre asignadas, racha, días sin
  entrenar. Hoy el perfil del cliente solo muestra un contador de sesiones.
- **Alertas al entrenador**: "X lleva 8 días sin entrenar", "X no completó
  las series de ayer", "X hizo PR". Se apoya en la tabla `notifications` y la
  suscripción Realtime que ya existen (`NotificationsContext.jsx`) — no hace
  falta infraestructura nueva.
- **Comentarios en dos direcciones** por sesión o por ejercicio: hoy solo
  existe `support_messages`, que es un buzón genérico, no una conversación
  atada a un entreno concreto.
- **Ver el RPE/RIR real del cliente** junto a lo prescrito (dato que llega
  con v3 Fase A) — es lo que convierte "no le dio" en "le dio con RIR 0, hay
  que bajar carga".

## Fase 4 — Salud y visión agregada (depende de v2)

- **Datos de salud del cliente con su consentimiento**: peso corporal, FC en
  reposo, pasos, kcal reales. Ya quedó anotado en v2 Fase 5 como decisión de
  privacidad aparte — aquí es donde se materializa, y necesita consentimiento
  explícito por cliente, revocable.
- **Dashboard de entrenador de verdad**: hoy son dos botones. Debería abrir
  con una lista priorizada — quién necesita atención hoy, quién progresa,
  quién está parado — en vez de obligar a entrar cliente por cliente.
- **Volumen semanal por grupo muscular** del cliente: se apoya en el
  etiquetado del catálogo que pide v3 Fase C; si ese trabajo se hace, esta
  vista sale casi gratis.

---

## Orden recomendado

Fase 0 → Fase 1 → Fase 3 → Fase 2 → Fase 4.

La 3 antes que la 2 a propósito: el feedback y la adherencia dan valor
inmediato con datos que ya existen, mientras que la programación temporal
(Fase 2) es la que más modelo de datos nuevo introduce. La Fase 4 depende de
que v2 y v3 estén hechas.
