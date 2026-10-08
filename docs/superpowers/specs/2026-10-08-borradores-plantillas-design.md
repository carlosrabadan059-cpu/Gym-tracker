# Borradores y plantillas en el panel del entrenador

**Fecha:** 2026-10-08
**Estado:** implementado (2026-10-08, commit 7713f5c; migración aplicada en
producción el mismo día), prototipo aprobado
(rama `prototype/borrador-plantillas`). Falta probarlo con el entrenador.
n8n revisado: ningún flujo lee `assigned_routines`.

## Qué se quiere

Que el entrenador pueda preparar rutinas sin que el cliente las vea todavía,
y reutilizarlas con varios clientes:

1. **Borrador por rutina:** una rutina asignada a un cliente puede guardarse
   como borrador. El cliente no la ve hasta que el entrenador pulsa Enviar.
2. **Plantillas:** rutinas sin cliente, en una sección propia del menú, que
   se asignan a uno o varios clientes a la vez.

## Decisiones tomadas

- **Las dos cosas**: borrador por rutina y sección Plantillas.
- **Borrador rutina a rutina**, no por programa completo.
- **Editar una plantilla no cambia lo ya asignado.** Cada cliente recibe su
  propia copia (ya era así: decisión "clonar siempre" de la Fase 0.2).
- **La plantilla no lleva peso.** El peso depende de cada persona y se pone
  en la ficha del cliente, en su copia. En el editor de plantilla el campo
  sale como "Por cliente".
- **Días de la semana y fecha de inicio se eligen al asignar**, no se guardan
  en la plantilla.
- Al asignar una plantilla se elige **Enviar ahora** o **Como borrador**.

## Lo que ya existe y se reutiliza

- `routines.is_template` y `routines.owner_client_id`
  (`20260910_routine_templates.sql`). Una plantilla es una rutina con
  `is_template = true` y `owner_client_id` nulo.
- `cloneRoutineToClient` en `src/lib/trainerUtils.js`: copia una rutina para
  un cliente y se la asigna.
- La estrella "Marcar como plantilla" en la lista "Rutinas existentes" de
  `RoutineAssignerView.jsx`.

### Fallo que se corrige

`cloneRoutineToClient` solo copia `name, series, reps, image_url, catalog_id,
ui_order`. Al asignar una rutina existente se pierden descanso, RIR, notas,
tempo, superseries y progresión semanal. Pasa a copiar toda la prescripción
**excepto `target_weight`**, que queda en blanco (decisión "peso por
cliente").

## Parte 1 — Borradores

### Base de datos (migración)

- `assigned_routines.sent_at timestamptz default now()`, nullable.
  - Nulo = borrador. Con fecha = enviada.
  - El `default now()` hace que cualquier inserción que no lo indique siga
    siendo una rutina enviada, como hoy.
  - Backfill: las filas existentes toman `assigned_at`.
- **Seguridad:** se borran las tres policies antiguas que dejan a cualquier
  usuario con sesión leer, crear y borrar asignaciones de cualquiera:
  - "Anyone authenticated can view assigned routines" (SELECT true)
  - "Authenticated users can insert assigned routines" (INSERT true)
  - "Authenticated users can delete assigned routines" (DELETE true)
- El cliente solo ve sus filas con `sent_at` no nulo.
- El entrenador lee, crea, actualiza y borra las asignaciones de sus propios
  clientes (vía `is_trainer()` y `trainer_clients`, como el resto de policies
  de entrenador). La policy de UPDATE es nueva: hace falta para Enviar.
- **Antes de aplicarla en producción se pide confirmación a Carlos.** Se
  verifica antes y después que Carlos sigue viendo sus rutinas.

### Entrenador

- Editor de rutina nueva para un cliente (`RoutineAssignerView.jsx`): dos
  botones, **Guardar borrador** (`sent_at = null`, sin notificación) y
  **Enviar a {cliente}** (como hoy).
- Asignar una rutina existente: la misma elección.
- Ficha del cliente (`ClientProfileView.jsx`): las rutinas en borrador salen
  con borde discontinuo, etiqueta **Borrador** y "{cliente} aún no la ve".
  Se editan igual que las enviadas. Botón **Enviar**: pone `sent_at = now()`
  y manda la notificación de nueva rutina.
- El resumen del panel (`TrainerDashboardView.jsx`) no cuenta los borradores
  como rutinas asignadas.
- La hoja del programa (ver/imprimir) solo incluye rutinas enviadas.

### Cliente

- `DashboardView.jsx` y `ChatView.jsx` no cambian: la RLS ya oculta los
  borradores. Filtrar por `sent_at` en el cliente rompería la app si el código
  llegara antes que la migración (columna inexistente).
- La notificación llega al enviar, no al guardar el borrador.

### Resto

- n8n: ningún flujo lee `assigned_routines` (el chat recibe las rutinas desde
  la app, ya filtradas por la RLS).

## Parte 2 — Plantillas

### Navegación

Nueva vista `trainer_templates` en `GymTrackerApp.jsx`, con entrada
**Plantillas** en el menú del entrenador.

### Lista

Tarjetas con las plantillas del entrenador (`is_template = true`,
`trainer_id = yo`, `owner_client_id` nulo): nombre, número de ejercicios y
botones **Editar** y **Asignar a…**. Botón **Nueva plantilla**.

### Editor

El editor de rutina de siempre (catálogo, series, reps y reps por serie,
descanso, RIR, tempo, notas, superseries, progresión semanal) en modo
plantilla:

- Sin cliente: no hay días de la semana ni peso ("Por cliente").
- **Guardar plantilla** inserta la rutina con `is_template = true` y sin
  asignación.
- **Editar** abre el mismo editor relleno. Guardar actualiza la rutina y
  reemplaza sus ejercicios. No toca las copias ya asignadas.
- La progresión semanal no se edita en este editor (tampoco al crear una
  rutina hoy); si la plantilla la tiene, se conserva y se copia sin peso.
- Solo salen las plantillas con `trainer_id` del propio entrenador: las
  rutinas base `day1`–`day3` (sin entrenador, respaldo de clientes sin
  asignaciones) nunca se editan desde aquí.

### Asignar a…

Ventana con:

- Los clientes del entrenador, con casillas (uno o varios).
- Días de la semana.
- Fecha de inicio (hoy por defecto). Se guarda en
  `routines.mesocycle_start_date` de cada copia.
- **Enviar ahora** / **Como borrador**.

Por cada cliente marcado se llama a `cloneRoutineToClient` con días, fecha de
inicio y si va como borrador.

### La lista "Rutinas existentes"

La estrella para marcar plantillas se mantiene. Las rutinas marcadas
aparecen también en la sección Plantillas.

## Pruebas

- Test de `cloneRoutineToClient` con Supabase mockeado: copia toda la
  prescripción, deja el peso vacío, aplica días y fecha de inicio, y respeta
  borrador/enviada (con o sin notificación).
- RLS, con SQL en producción y sin escribir datos de Carlos:
  - como cliente, una asignación en borrador no aparece;
  - como usuario sin relación, no se ven asignaciones ajenas.
- Comprobación en el navegador (entrenador de prueba, solo navegar):
  borrador visible en la ficha y oculto en la app del cliente.
- Comprobación en el iPhone tras `build` + `cap sync ios`: Carlos sigue
  viendo sus rutinas.
