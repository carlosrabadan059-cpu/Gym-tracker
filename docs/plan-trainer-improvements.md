# Plan: mejoras del lado entrenador

**Fecha:** 2026-09-07
**Estado:** planteamiento aprobado, nada implementado todavía. No está
asignado a una versión concreta — la Fase 0 no debería esperar a ninguna (ver
abajo), el resto puede intercalarse con la versión 2
([Apple Health](plan-apple-health-integration.md)) o la 3
([funciones de gimnasio](plan-gym-app-features.md)).

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

## Fase 0 — Fundamentos que faltan (no debería esperar)

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

Pendiente, no bloqueante: fijar la prescripción ya al crear la rutina
(`RoutineAssignerView` "Crear nueva" / `AddExercisePanel`) — de momento se
pone justo después desde el editor del perfil del cliente. Y el % de 1RM
como alternativa al peso absoluto, cuando la v3 Fase A esté asentada.

Encaja con v3 Fase A: donde ahí la sugerencia de peso viene de la heurística
local, aquí viene del entrenador — cuando existan las dos, la del entrenador
manda.

## Fase 2 — IA como asistente del entrenador

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

## Fase 3 — Programación en el tiempo

- **Calendario semanal**: qué rutina toca cada día. Hoy las rutinas son
  "Día 1-4" sin fecha ni orden temporal real.
- **Progresión programada**: definir 4 semanas de una vez (sem. 1: 3×10 @70%,
  sem. 2: 3×12 @70%…) en vez de reeditar la rutina cada semana.
- **Mesociclo con fechas**: inicio, fin, y qué pasa al terminar.

## Fase 4 — Seguimiento y feedback

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

## Fase 5 — Salud y visión agregada (depende de v2)

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

Fase 0 → Fase 1 → Fase 2 → Fase 4 → Fase 3 → Fase 5.

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

**Dependencias con los otros planes:** la calidad de la Fase 2 depende del
etiquetado muscular del catálogo (v3 Fase C) y del RPE/RIR real del cliente
(v3 Fase A). Se puede empezar sin ellos, pero la revisión de rutinas será
bastante más superficial.
