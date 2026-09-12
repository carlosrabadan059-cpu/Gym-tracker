# Fase 2.2 — Revisar rutina con IA

Parte de [docs/plan-trainer-improvements.md](../../plan-trainer-improvements.md), sección "Fase 2.2 — Revisar una rutina que ya has hecho".

## Objetivo

El entrenador pide una revisión de una rutina (nueva, sin guardar, o ya asignada
a un cliente) y recibe un análisis en texto de agujeros estructurales: huecos
de patrón de movimiento, desequilibrio de volumen, orden compuesto/aislamiento
roto. Es solo diagnóstico — no genera ni modifica ejercicios. Coincide con el
principio de Fase 2: "la IA propone, el entrenador dispone"; aquí ni siquiera
propone cambios, señala.

## Clasificación de ejercicios (sin migración, sin heurística de nombre para grupo muscular)

`exercise_catalog.category` ya es el grupo muscular (`Pecho`, `Dorsal`,
`Hombro`, `Bíceps`, `Tríceps`, `Pierna`, `Glúteo`, `Abdomen`, `Cardio`,
`Otros`, o un valor personalizado libre) — se rellena al crear el ejercicio en
`TrainerLibraryView.jsx`. No hace falta migración ni etiquetado nuevo.

Nuevo módulo `src/lib/exerciseClassifier.js`:

- `PATTERN_BY_CATEGORY`: mapa fijo `category → patrón` para las categorías
  conocidas (`Pecho`/`Hombro`/`Tríceps` → `empuje`, `Dorsal`/`Bíceps` →
  `tiron`, `Pierna`/`Glúteo` → `pierna`, `Abdomen`/`Cardio` → `core`).
  Categorías personalizadas no listadas caen en `otro`.
- `isCompound(exerciseName)`: heurística ligera por palabras clave en el
  **nombre** del ejercicio, solo para distinguir compuesto de aislamiento
  dentro de una misma categoría (ej. "press banca" compuesto vs. "aperturas"
  aislamiento, ambos `Pecho`). Lista de palabras clave de aislamiento
  (curl, extensión, elevación, aductor, abductor, cruce, vuelo, contracción)
  — si ninguna coincide, se asume compuesto. Es una heurística admitidamente
  imperfecta; se documenta como limitación conocida, no bloquea el resto.

`buildRoutineBreakdown(exercises)` calcula, para el análisis:
- conteo de ejercicios por patrón
- ratio volumen pierna+glúteo vs. torso (pecho+dorsal+hombro)
- lista ordenada con flag `compound` por ejercicio, y si el orden real rompe
  la regla "compuestos antes que aislamiento" (algún aislamiento aparece
  antes que algún compuesto del mismo día)

## Nuevo workflow n8n: `Gym_App_Trainer_Review`

Independiente de `Gym_App_Chat` (que sigue siendo el chat del cliente, sin
tocar). Un workflow nuevo porque el prompt y la audiencia son distintos
(colega entrenador revisando trabajo de otro entrenador, no un socio pidiendo
consejo) y porque no necesita memoria de conversación — cada revisión es una
llamada de una sola vez.

```
Webhook (POST, path "TrainerReview")
  → Set "Variables Entrada" (routineName, goal del cliente, lista de
     ejercicios con category/patrón/compound/series/reps, breakdown calculado)
  → AI Agent (prompt fijo, sin memoria; mismo modelo/credencial OpenAI que
     Gym_App_Chat)
  → Respond to Webhook
```

Prompt del AI Agent (idea, se afina al construir el nodo): actuar como
entrenador senior revisando el trabajo de un colega, señalar agujeros
concretos con el por qué, mismo formato markdown que ya sabe renderizar
`BotMarkdown` (`##`, `-`, `**negrita**`, `> tips`), tono directo y breve.

Se construye con `mcp__n8n-mcp__create_workflow_from_code` (o equivalente),
usando `get_workflow_sdk_reference` primero.

## App

- Nueva env var `VITE_N8N_TRAINER_REVIEW_WEBHOOK_URL` (documentar en
  `README.md` junto a la de chat).
- `src/components/ui/BotMarkdown.jsx`: extraído de `ChatView.jsx` (mover, no
  duplicar) para reusarlo en el modal de revisión.
- `src/components/trainer/RoutineReviewModal.jsx` (nuevo): recibe la lista de
  ejercicios de la rutina + datos del cliente, calcula el breakdown con
  `exerciseClassifier`, llama al webhook, muestra loading → `BotMarkdown` con
  la respuesta → botón "Cerrar". Sin edición ni guardado.
- Botón "Revisar con IA" en:
  - `RoutineAssignerView.jsx`, modo `'new'`, junto al botón "Guardar" —
    opera sobre `selectedExercises` antes de persistir nada.
  - `ClientProfileView.jsx`, sobre una rutina ya asignada — opera sobre los
    ejercicios ya guardados de esa rutina.

## Fuera de alcance (explícito)

- No se edita ni se propone una nueva rutina (eso es 2.1).
- No se usa RPE/RIR real del cliente (eso es 2.3, depende de v3 Fase A).
- No se toca `exercise_catalog` ni se migra nada — se reusa `category` tal
  cual existe hoy.
- No se toca el workflow `Gym_App_Chat` ni `ChatView.jsx` salvo la extracción
  de `BotMarkdown` a componente compartido.

## Limitación conocida

`isCompound()` es heurística de nombre — un ejercicio personalizado con
nombre atípico puede clasificarse mal. Aceptado por el usuario; no bloquea.
