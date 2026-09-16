# Plan: mejoras del lado entrenador

**Fecha:** 2026-09-07 (estado actualizado 2026-09-15)
**Estado: cerrado. Las 6 fases (0 a 5) están hechas**, cada una con su
detalle abajo. Lo que quedó fuera a propósito está anotado en la fase
correspondiente, no pendiente de decidir. Trabajo futuro del lado entrenador
entra como plan nuevo, no reabriendo este documento.

Dependencias con los otros planes: la **versión 2**
([Apple Health](plan-apple-health-integration.md)) también está cerrada; de
la **versión 3** ([funciones de gimnasio](plan-gym-app-features.md)) la Fase
A está hecha y las Fases B (superseries) y C (mapa de recuperación muscular)
siguen sin empezar — ninguna bloquea nada de aquí.

## Decisiones tomadas (2026-09-07)

No son propuestas abiertas: se discutieron y quedaron cerradas. Lo que venga
después se construye asumiéndolas.

1. **La IA propone, el entrenador dispone.** Todo lo que genere la IA entra
   como borrador editable y solo llega al cliente cuando el entrenador lo
   aprueba. Nunca se asigna nada solo. Es lo que separa una herramienta
   profesional de un generador de rutinas, y evita que la responsabilidad de
   una prescripción recaiga en un modelo. Detalle en la Fase 2.
2. **El entrenador trabaja en iPad o escritorio**, el cliente en el móvil.
   Son dos ergonomías distintas dentro de la misma app. Detalle en "Contexto
   de uso".
3. **El entrenador sigue siendo web.** El shell nativo de Capacitor de la v2
   es solo para el cliente en iPhone; la vista de entrenador no necesita
   build nativo.
4. **El layout móvil del cliente no se toca.** Todo el trabajo de pantalla
   ancha entra bajo breakpoints, sin regresión para quien entrena con el
   móvil en la mano.
5. **El orden de los ejercicios es prescripción, no cosmética**, y debe poder
   cambiarse arrastrando después de crear la rutina. Detalle en la Fase 0.3.

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

## Contexto de uso: el entrenador trabaja en iPad o escritorio

El cliente entrena con el móvil en la mano; el entrenador monta rutinas
sentado, en pantalla grande. **Son dos productos con ergonomías distintas
dentro de la misma app**, y hoy eso no está reconocido en ninguna parte del
código: las 7 vistas de `src/views/trainer/` tienen **cero breakpoints
responsive** (ni un solo `md:`, `lg:` ni `xl:`), el `<main>` de
`GymTrackerApp.jsx:307` es de ancho completo con padding móvil, y la
navegación es la píldora inferior de `BottomNavigation.jsx` (`max-w-md`,
fija abajo). En un iPad o en un portátil, la vista de entrenador es hoy una
app de móvil estirada.

Esto condiciona todo lo que viene después, así que se decide antes de
construir nada:

- **Layout maestro-detalle en pantalla ancha.** Lista de clientes a la
  izquierda, cliente seleccionado a la derecha, sin perder el contexto al
  navegar. Igual en el constructor: catálogo de ejercicios a un lado, rutina
  en construcción al otro, arrastrando de uno a otro.
- **La navegación inferior pasa a lateral** a partir de `md:`. Una píldora
  flotante centrada es un patrón de pulgar, no de ratón.
- **Densidad distinta.** El cliente necesita objetivos de toque de 44px; el
  entrenador necesita ver 20 ejercicios de un vistazo, tablas en vez de
  tarjetas apiladas, y edición en línea.
- **Teclado.** En escritorio se espera tabular entre campos y confirmar con
  Enter al montar una rutina, sin ir al ratón para cada serie.
- **Sin cambios para el cliente.** Todo esto entra bajo breakpoints; el
  layout móvil actual se queda exactamente como está. Y el shell nativo de
  Capacitor de la v2 es solo para el cliente en iPhone — **el entrenador
  sigue siendo web**, no necesita build nativo.

**Cómo verlo mientras se desarrolla:** `npm run browse` arranca en 420x1000
(móvil) por defecto. Para las vistas de entrenador hay que pasar el tamaño
real de trabajo:

```bash
npm run browse -- http://localhost:5173 --size 1024x768 --shot ipad.png
npm run browse -- http://localhost:5173 --size 1440x900 --shot desktop.png
```

---

## Fase 0 — Fundamentos que faltan · ✅ Hecho (2026-09-10)

**1. Relación entrenador ↔ cliente. ✅ Hecho (2026-09-08).**

Era peor de lo que parecía al leer solo el código de `ClientsListView.jsx`:
revisando las políticas RLS antes de tocar nada, seguía activa una política
heredada `"Public profiles are viewable by everyone."` (`qual: true`) junto
a la más nueva `"Trainers can read all profiles"`. En RLS de Postgres las
políticas permisivas se combinan con OR, así que la antigua anulaba a la
nueva: **cualquier usuario autenticado, no solo entrenadores, podía leer
todos los perfiles.** Y la propia política nueva también era demasiado
ancha — cualquier entrenador veía a cualquier cliente, no solo a los suyos.

Construido:
- Tabla `trainer_clients` (`trainer_id`, `client_id`), con
  `unique(client_id)` — un cliente tiene un único entrenador ("entrenador
  personal", no varios). RLS: cada entrenador ve/añade/quita solo sus
  propias filas; un cliente ve la fila que lo vincula a su entrenador.
- Backfill desde `assigned_routines.assigned_by` (siempre un entrenador,
  ya lo exigía su RLS de insert) — 1 relación real recuperada sin pérdida.
- `profiles`: fuera las dos políticas de SELECT demasiado anchas,
  sustituidas por "cada uno ve el suyo" + "un entrenador ve los perfiles de
  sus propios clientes" + "un cliente ve el perfil de su propio
  entrenador".
- Función `search_addable_clients(search_term)` (`security definer`,
  gateada por `is_trainer()`): permite buscar clientes **sin entrenador
  todavía** por username, sin reabrir `profiles`. Necesaria porque, una vez
  cerrada la RLS, un entrenador no podría ver el perfil de nadie nuevo para
  poder añadirlo — este es el único hueco intencionadamente abierto, y solo
  expone `user_id`/`username`/`avatar_url` de clientes sin vincular.
- `ClientsListView.jsx`: lista solo los clientes propios (dos consultas —
  `trainer_clients` no tiene FK directa a `profiles`, ambas referencian
  `auth.users`, así que no hay embed automático de PostgREST) + modal
  "Añadir cliente" con buscador en vivo sobre la RPC de arriba.
- Migración: `supabase/migrations/20260908_create_trainer_clients_and_fix_profiles_rls.sql`.

Verificado con datos reales (no solo lint/build): la consulta de "mis
clientes" del entrenador real devuelve exactamente su único cliente
backfillado; la búsqueda de clientes añadibles excluye a ese cliente y
devuelve los dos que siguen sin entrenador.

**2. Plantillas de rutina reutilizables. ✅ Hecho (2026-09-10).**

Decisiones: **clonar siempre** al asignar (cada cliente tiene su copia
editable, tocar la de uno no afecta a otro), y marcar plantilla con una
**estrella** en la lista de "Rutinas existentes".

Construido:
- Migración `20260910_routine_templates.sql`: `routines.is_template` y
  `routines.owner_client_id` (si está puesto, es la copia privada de un
  cliente y no aparece en la lista de asignables). Backfill: las rutinas
  custom asignadas hoy a un solo cliente quedan marcadas como su copia.
- `src/lib/trainerUtils.js`: `cloneRoutineToClient` (copia routine +
  exercises con id nuevo, asigna, notifica) y `deleteClientRoutineCopy`
  (al desasignar borra la copia huérfana; nunca toca plantillas ni
  compartidas).
- `RoutineAssignerView.jsx`: lista filtrada a `owner_client_id is null`,
  estrella para marcar/quitar plantilla (plantillas primero), "Asignar" y
  "Crear nueva" ahora clonan/crean copia privada.
- `ClientProfileView.jsx`: desasignar borra también la copia privada.

Pendiente, no bloqueante: una vista de plantillas propia encaja mejor con
la Fase 0.4 (layout iPad) — de momento se gestionan desde el asignador.

**3. Reordenar los ejercicios de una rutina. ✅ Hecho (2026-09-08), versión botones.**

Construido:
- `ClientProfileView.jsx` (rutina ya asignada): flechas ↑↓ por ejercicio,
  `handleReorderExercise` intercambia posiciones y renumera 1..n, persiste
  con un `update` por ejercicio a `exercises.ui_order` (cierra los huecos
  que dejaba borrar ejercicios).
- `RoutineAssignerView.jsx` (rutina nueva): mismas flechas en el panel de
  "seleccionados" antes de guardar — reordena el array en memoria,
  `handleSave` ya usa el índice como `ui_order` al insertar.

**Pendiente, no bloqueante**: arrastrar (drag) como gesto principal en
iPad/escritorio, per el plan original — se dejó para cuando llegue la Fase 0
punto 4 (layout iPad/escritorio), evitando construir dos mecanismos de
reorden. Las flechas ya cubren la necesidad funcional en móvil.

Verificado en real con la cuenta admin (headless, Playwright): reordené y
restauré el orden de los 8 ejercicios de "Dia 1 - Pecho / Hombro" de Carlos
— el intercambio persistió entre dos ejecuciones separadas del script,
confirmando que el update a `exercises.ui_order` llega a Supabase, no solo
al estado local. Probado también el panel de seleccionados al crear una
rutina nueva. Sin errores de consola nuevos.

**Bug preexistente encontrado de paso y arreglado**: el historial de
entrenamientos de `ClientProfileView.jsx` fallaba siempre (`Could not find a
relationship between 'workout_logs' and 'routines'`) — mismo patrón que el
hallazgo de `trainer_clients`/`profiles`: PostgREST no puede hacer embed
automático sin FK directa (y `routine_id` a veces es una rutina estática
tipo "day1", que ni existe como fila en `routines`). Sustituido el embed por
dos consultas + mapa en cliente, como ya se hizo ahí. Verificado en real
contra el cliente real (Carlos, el único usuario con datos reales en el
proyecto): tenía **20 sesiones ocultas** por este bug — ahora aparecen con
fecha y nombre de rutina correctos.

**4. Layout de iPad y escritorio. ✅ Hecho (2026-09-10).**

Ver "Contexto de uso" arriba. Verificado con capturas a 1280px y 390px
(login de entrenador real).

Construido:
- `src/components/layout/TrainerShell.jsx`: las vistas de entrenador salen
  del `<main>` móvil. A partir de `md:` barra lateral fija
  (Inicio/Clientes/Librería + cerrar sesión) en vez de la píldora inferior,
  contenido centrado con ancho máximo. Por debajo de `md:` sin barra
  lateral, las vistas usan su header con atrás como hasta ahora.
- `src/components/layout/TrainerClientsView.jsx`: clientes maestro-detalle.
  En `md:` lista (columna estrecha) + perfil del cliente a la vez; por
  debajo, una cosa cada vez. `ClientsListView`/`ClientProfileView` ganan
  prop `embedded`.
- `RoutineAssignerView` "Crear nueva": a dos columnas en `md:` — catálogo
  (izq) | nombre/color + rutina en construcción con reordenar/quitar (rail
  derecho). En móvil sigue la barra inferior colapsable.
- El layout móvil del cliente, intacto (todo bajo `md:`).

Pendiente, no bloqueante: drag-and-drop para reordenar ejercicios
(hoy flechas ↑↓), densidad de tabla en vez de tarjetas para listas largas
de ejercicios, y una vista de plantillas propia (Fase 0.2).

## Fase 1 — Prescripción completa · ✅ Hecho (2026-09-10)

El núcleo. Decisiones (2026-09-10): **peso objetivo en kg absolutos** (el %
de 1RM se deja para más adelante), intensidad como **RIR** (repeticiones en
reserva). Todos los campos opcionales — un ejercicio sin prescripción se
comporta como antes.

| Campo | Tipo | Para qué |
|---|---|---|
| `exercises.target_weight` | numeric (kg) | carga objetivo |
| `exercises.target_rir` | smallint (0-5) | intensidad, no solo volumen |
| `exercises.rest_seconds` | integer | descanso prescrito por ejercicio |
| `exercises.tempo` | text (`3-1-2`) | la parte técnica |
| `exercises.notes` | text | indicaciones ("codos pegados") |

Construido:
- Migración `20260910_exercise_prescription.sql`.
- `ClientProfileView.jsx`: al editar un ejercicio de una rutina asignada,
  bajo los steppers de series/reps aparece un bloque con peso/RIR/descanso/
  tempo/notas. En la fila (sin editar) se ve `4×10 · 60kg · RIR2`.
- Cliente (`ExerciseDetailModal.jsx`): bloque "Objetivo del entrenador" con
  todos los campos puestos; el peso objetivo prerrellena los inputs de las
  series; `rest_seconds` se ofrece como opción del temporizador y como
  duración por defecto.

Hecho (2026-09-16): prescribir peso/RIR/descanso ya al crear la rutina
(`RoutineAssignerView` "Crear nueva" / `AddExercisePanel`), opcional y
desplegable por ejercicio. Ver
`docs/superpowers/specs/2026-09-16-prescripcion-al-crear-design.md`.

Pendiente, no bloqueante: % de 1RM como alternativa al peso absoluto,
cuando la v3 Fase A esté asentada.

Encaja con v3 Fase A: donde ahí la sugerencia de peso viene de la heurística
local, aquí viene del entrenador — cuando existan las dos, la del entrenador
manda.

## Fase 2 — IA como asistente del entrenador · ✅ Hecho (2026-09-15)

Los cuatro puntos están construidos, cada uno con su workflow de n8n propio
y su spec en `docs/superpowers/specs/`: **2.1** borrador de rutina
(`Gym_App_RoutineDraft`), **2.2** revisar una rutina ya hecha
(`Gym_App_Trainer_Review`), **2.3** proponer la progresión del siguiente
ciclo (`Gym_App_ProgressionSuggestion`, apoyada en el RPE real que trajo v3
Fase A) y **2.4** explicar el porqué, que no es una pieza aparte sino el
campo `motivo` que acompaña a cada sugerencia de las tres anteriores — se
muestra al entrenador y nunca se persiste.

La app **ya tiene IA montada**: `ChatView.jsx` habla con un workflow de n8n
(`n8n.rabadanhouse.space`, permitido en el CSP de `vercel.json`; historial en
la tabla `n8n_chat_histories`). Así que esto no es montar infraestructura
nueva, es añadir capacidades a ese workflow y una entrada desde las vistas de
entrenador.

**Principio de diseño: la IA propone, el entrenador dispone.** Todo lo que
genere entra como **borrador editable** dentro del constructor de rutinas, y
solo se asigna al cliente cuando el entrenador lo aprueba. Nada se publica
solo. Esto no es un detalle de UX: es lo que separa "herramienta profesional"
de "generador de rutinas aleatorias", y también lo que evita que la
responsabilidad de una prescripción recaiga en un modelo.

### 2.1 Generar un borrador de rutina

Entrada: objetivo del cliente (`profiles.goal` ya existe), nivel, días por
semana, material disponible, lesiones o limitaciones, y su historial real
(`workout_logs`). Salida: una rutina completa como borrador — ejercicios en
**orden razonado** (multiarticulares primero), series, reps, y —cuando exista
la Fase 1— peso objetivo o % de 1RM, RIR y descanso.

### 2.2 Revisar una rutina que ya has hecho

El caso más útil para un entrenador con criterio propio: no que se la escriban,
sino que le señalen agujeros. "Este día tiene 6 ejercicios de empuje y ninguno
de tirón", "el volumen semanal de pierna es la mitad que el de pecho",
"pusiste aislamiento antes que sentadilla". Se apoya en el etiquetado muscular
del catálogo que pide la v3 Fase C: **sin ese etiquetado, esta revisión es
mucho más pobre**, así que las dos cosas se refuerzan.

### 2.3 Proponer la progresión del siguiente ciclo

A partir de lo que el cliente realmente levantó y su RPE/RIR (dato que llega
con la v3 Fase A): qué subir, qué mantener, qué cambiar porque se ha estancado.

### 2.4 Explicar el porqué

Cada sugerencia con una línea de justificación visible para el entrenador. Sin
eso, es una caja negra que nadie con criterio va a usar dos veces.

**Coste real:** el grueso está en el prompt y el contexto que se le pasa al
workflow de n8n, no en la app. La parte de React es una pantalla de borrador
con "aceptar / editar / descartar" dentro de `RoutineAssignerView`.

**En pantalla ancha esto gana mucho:** el borrador de la IA a un lado y la
rutina actual al otro, comparables de un vistazo, aceptando o descartando
ejercicio por ejercicio en vez de todo o nada. En móvil habría que resolverlo
como pasos sucesivos; en iPad cabe entero.

## Fase 3 — Programación en el tiempo · ✅ Hecho (2026-09-15)

**1. Calendario semanal. ✅ Hecho.**

Columna `routines.scheduled_days` (array de días, migración
`20260915_add_scheduled_days_to_routines.sql`) y `src/lib/routineSchedule.js`
(`isRoutineScheduledForDay`, `splitRoutinesByToday`, `WEEKDAY_LABELS`,
testeado). El entrenador marca los días en la ficha del cliente con las
píldoras L-M-X-J-V-S-D; el Dashboard del cliente separa "hoy" del resto en
vez de listar las 4-5 rutinas sin orden temporal.

**2. Progresión programada. ✅ Hecho.**

`exercises.weekly_progression` (JSONB): una fila por semana con series,
reps, peso objetivo y RIR. El editor inline de ejercicio en
`ClientProfileView.jsx` permite añadir/quitar semanas a mano — y desde la
Fase 2.3, rellenarlas con IA de un botón.

**3. Mesociclo con fechas. ✅ Hecho.**

`routines.mesocycle_start_date` + `src/lib/mesocycle.js`
(`getCurrentMesocycleWeek`, `applyMesocycleWeek`, testeado). La ficha de
cliente muestra un badge con la semana activa, y los ejercicios que ve el
cliente se resuelven a la fila de `weekly_progression` que toca esa semana.
Antes de la fecha de inicio la progresión se congela en la semana 1; no hay
lógica de "qué pasa al terminar" más allá de quedarse en la última semana
definida — no se construyó porque nadie ha necesitado todavía decidirlo.

## Fase 4 — Seguimiento y feedback · ✅ Hecho (2026-09-12)

**1. Adherencia: racha y días sin entrenar. ✅ Hecho.**

`src/lib/adherence.js`: `computeStreak(dates)` (racha viva en días
consecutivos) y `computeDaysSinceLastSession(dates)`, puras y testeadas
(`adherence.test.js`, con `vi.useFakeTimers()` para fechas deterministas).
`ClientProfileView.jsx` gana dos tarjetas ("Racha", "Última sesión") junto a
las que ya había (sesiones, rutinas asignadas).

**2. Alertas al entrenador: badge de inactividad. ✅ Hecho, con alcance recortado.**

Decidido explícitamente **al vuelo, sin tabla `notifications` ni cron**: el
proyecto no tiene ningún scheduler (`pg_cron` ni externo), y montar uno solo
para esto habría sido la infraestructura nueva que el plan decía evitar.
`INACTIVITY_ALERT_DAYS = 7` (en `adherence.js`); `ClientsListView.jsx` añade
una query en paralelo de `workout_logs` (fecha más reciente por cliente, sin
N+1) y muestra un badge ⚠️ "Hace N días" / "Sin sesiones" cuando corresponde.
Es un aviso visual al abrir la lista, no una notificación push — las
alertas de PR y de series no completadas quedan fuera, no se han construido.

**Hallazgo de seguridad real, no planeado, arreglado de paso**: revisando el
código de esta pieza salió un agujero de RLS — varias políticas de
entrenador (`workout_logs`, `assigned_routines`, `routines`, `exercises`)
usaban solo `is_trainer()` (comprueba el rol) sin comprobar que el cliente
fuera realmente suyo. **Cualquier entrenador podía leer/editar los datos de
clientes de cualquier otro entrenador.** Arreglado en
`20260912_scope_trainer_policies_to_own_clients.sql`: las cuatro tablas
pasan a exigir `trainer_clients`/`routines.trainer_id`, verificado contra
datos reales antes de aplicar y comprobado en el navegador después.

**3. Comentarios en dos direcciones por ejercicio. ✅ Hecho.**

Tabla nueva `exercise_comments` (`exercise_id`, `author_id`, `body`,
`created_at`), RLS **diseñada bien desde el principio** con el mismo patrón
que el fix de seguridad de arriba (nunca `is_trainer()` a secas). Componente
compartido `src/components/shared/ExerciseCommentThread.jsx` (hilo
append-only, sin editar/borrar) montado en dos sitios que ya existían:
`ExerciseDetailModal.jsx` (cliente, bajo "Objetivo del entrenador") y el
editor inline de ejercicio en `ClientProfileView.jsx` (entrenador). Cada
comentario notifica al otro participante reusando `notifications` +
Realtime — `NotificationsListView.jsx` gana un icono para `type: 'comment'`.
Por sesión completa no se hizo (no hay pantalla de detalle de sesión para el
cliente); navegación al tocar la notificación tampoco (ninguna notificación
de la app navega hoy, se deja para cuando haga falta de verdad).

**4. Ver el RPE/RIR real del cliente junto a lo prescrito. ✅ Hecho.**

El RPE por serie (v3 Fase A, ya en `main`) se convierte a RIR aproximado con
`rirFromRpe(rpe) = 10 - rpe` (`src/lib/plates.js`, testeado). El detalle de
una sesión pasada (`WorkoutDetailPanel.jsx`, lado entrenador) muestra
"objetivo RIR N" junto al nombre del ejercicio (si estaba prescrito) y "RIR
real ≈M" en cada serie donde el cliente marcó su esfuerzo — sin colores de
alerta ni lógica de "esto es preocupante", solo los dos números uno junto al
otro (YAGNI, igual criterio que el resto de la fase). Sin tabla ni columna
nueva: pura lectura de datos que ya existían.

**Pendiente, no bloqueante**: alerta de PR y de series no completadas
(explícitamente fuera de alcance de la pieza 2), resumen/promedio de
RPE/RIR en `ClientProfileView.jsx` (solo está en el detalle de sesión).

## Fase 5 — Salud y visión agregada · ✅ Hecho (2026-09-15)

**1. Dashboard de entrenador de verdad. ✅ Hecho.**

`src/lib/trainerPriority.js` (categorización pura, testeada) +
`TrainerDashboardView.jsx`: en vez de dos botones, una lista priorizada de
clientes por quién necesita atención. Se mantienen los accesos a Clientes y
Librería.

**2. Datos de salud del cliente con su consentimiento. ✅ Hecho, con el
alcance recortado tras mirar el código.**

El punto original listaba peso corporal, FC en reposo, pasos y kcal reales.
Al revisarlo resultó que **peso y kcal reales ya eran visibles para el
entrenador sin consentimiento ninguno**, y que FC en reposo y pasos no
existen en ningún sitio que el entrenador pueda leer: se leen en vivo de
HealthKit en el dispositivo del cliente (`src/lib/appleHealth.js`) y nunca
se persisten. Así que la pieza construida gatea lo que ya existía, y la
sincronización de FC/pasos queda fuera (exigiría código nativo nuevo que
escriba a `health_metrics` — tabla que ya existe desde v2 Fase 0 pero que
**ningún código de `src/` usa** — más una policy de lectura para el
entrenador).

Construido: `trainer_clients.health_consent` (`pending`/`granted`/`denied`,
migración `20260915_add_health_consent_to_trainer_clients.sql`) con
`pending` por defecto también para las relaciones ya existentes. La
escritura va por una función `security definer` `set_health_consent`, no por
una policy de UPDATE: RLS no restringe por columna, así que una policy
abierta habría dejado al cliente reescribir su `trainer_id` y reasignarse de
entrenador. `src/lib/healthConsent.js` (puro, testeado), banner en el
Dashboard del cliente al vincularse, toggle revocable en `PrivacyView.jsx`,
y ocultación en `ClientProfileView.jsx` ("Sin compartir") y
`WorkoutDetailPanel.jsx`. Ver
`docs/superpowers/specs/2026-09-15-salud-consentimiento-design.md`.

**3. Volumen semanal por grupo muscular. ✅ Hecho — y no hacía falta v3 Fase C.**

Este punto se daba por bloqueado por el etiquetado muscular de v3 Fase C.
Comprobado contra la base de datos real: **ese etiquetado ya existe**.
`exercise_catalog.category` está al **101 de 101** en 8 grupos (Bíceps 15,
Abdomen 15, Pecho 14, Hombro 14, Pierna 14, Tríceps 11, Dorsal 11, Glúteo
7), y las 64 filas de `exercises` tienen todas `catalog_id`, así que heredan
categoría. El bloqueo era del documento, no del código.

`src/lib/muscleVolume.js` (`computeWeeklyMuscleVolume`, puro y testeado)
cuenta **series completadas** por grupo en la semana en curso (lunes, vía
`getWeekStart`), y `MuscleVolumeCard.jsx` las pinta en Estadísticas del
cliente y en la ficha de cliente del entrenador. Los ids de ejercicio que ya
no se pueden resolver —17 de los 80 que aparecen en `workout_logs`, de
rutinas borradas con el tiempo— van a un grupo "Sin clasificar" visible, no
se descartan en silencio. Ver
`docs/superpowers/specs/2026-09-15-volumen-grupo-muscular-design.md`.

Lo que v3 Fase C sigue aportando, y que esto **no** construye: etiquetado
múltiple (músculo primario/secundario) y ventana de recuperación 48-72h.
Para un gráfico de volumen basta una etiqueta por ejercicio; para un mapa de
recuperación no, porque un press de banca también carga tríceps y hombro.

---

## Orden recomendado (histórico)

Fase 0 → Fase 1 → Fase 2 → Fase 4 → Fase 3 → Fase 5. **Se siguió tal cual**,
y se quedó corto en un punto: la Fase 5 se daba por dependiente de la v3
Fase C, y resultó que no lo estaba (ver Fase 5, punto 3). La lección para el
próximo plan es comprobar las dependencias contra la base de datos antes de
darlas por ciertas, no heredarlas del documento que las escribió.

Razones del orden:

- **La Fase 0 primero** porque hoy cualquier entrenador ve a todos los
  clientes, porque reordenar ejercicios es barato y desbloquea poder montar
  rutinas bien desde ya, y porque el layout de iPad/escritorio condiciona
  cómo se construye todo lo demás: hacerlo después obliga a rehacer las
  pantallas de las fases 2, 3 y 4.
- **La Fase 2 (IA) justo después de la 1** porque una IA que solo puede
  proponer series y reps no produce nada que un profesional llame plan; con
  los campos de prescripción completos, sí.
- **La 4 antes que la 3**: el seguimiento y la adherencia dan valor inmediato
  con datos que ya existen, mientras que la programación temporal (Fase 3) es
  la que más modelo de datos nuevo introduce.
- **La Fase 5 al final** porque depende de que la v2 (Apple Health) esté
  hecha.

**Dependencias con los otros planes (revisado 2026-09-15):** se asumía que la
calidad de la Fase 2 dependía del etiquetado muscular del catálogo (v3 Fase
C) y del RPE/RIR real del cliente (v3 Fase A). El RPE/RIR llegó con la Fase A
y desbloqueó de verdad la Fase 2.3. El etiquetado muscular, en cambio, ya
estaba en `exercise_catalog.category` desde antes (101/101), así que esa
dependencia nunca fue real — ni para la Fase 2 ni para la Fase 5. Lo que
sigue sin existir de la Fase C es el etiquetado primario/secundario, que sí
mejoraría la revisión de rutinas con IA (hoy solo conoce el grupo principal
de cada ejercicio).
