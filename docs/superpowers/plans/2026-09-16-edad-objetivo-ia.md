# Edad y objetivo real en las decisiones de IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los tres workflows de IA del entrenador (borrador de rutina,
revisión de rutina, progresión de ciclo) reciban la edad del cliente y usen
el objetivo de forma explícita — hoy `clientGoal` llega como dato inerte sin
ninguna instrucción de cómo traducirlo en reps/descanso/selección de
ejercicio, y `clientAge` no llega a ninguno.

**Architecture:** Un parámetro nuevo (`clientAge`) añadido a las dos
funciones puras que arman los payloads (`trainerUtils.js`) y a la prop de
`RoutineReviewModal.jsx`, threaded desde `client.age` (ya disponible, mismo
patrón que `client.goal`) en los tres call sites existentes. Los tres
prompts de n8n se actualizan in-place vía `update_workflow` — no se crean
workflows nuevos.

**Tech Stack:** React 19, n8n (`update_workflow`, `chainLlm` /
`langchain.agent` / `langchain.openAi` nodes ya existentes), Vitest.

---

## Task 1: `buildRoutineDraftPayload` — añadir `clientAge`

**Files:**
- Modify: `src/lib/trainerUtils.js`
- Test: `src/lib/trainerUtils.test.js`

- [ ] **Step 1: Escribir los tests (deben fallar)**

Find en `src/lib/trainerUtils.test.js`, dentro de `describe('buildRoutineDraftPayload', ...)`:
```js
    it('daysPerWeek inválido cae a null en vez de NaN', () => {
        const payload = buildRoutineDraftPayload({ daysPerWeek: 'abc', exerciseNames: [], recentHistorySummary: '' });
        expect(payload.daysPerWeek).toBeNull();
    });
});
```

Replace con (añade dos tests nuevos, no toca los existentes):
```js
    it('daysPerWeek inválido cae a null en vez de NaN', () => {
        const payload = buildRoutineDraftPayload({ daysPerWeek: 'abc', exerciseNames: [], recentHistorySummary: '' });
        expect(payload.daysPerWeek).toBeNull();
    });

    it('incluye clientAge cuando se pasa', () => {
        const payload = buildRoutineDraftPayload({ clientAge: 68, exerciseNames: [], recentHistorySummary: '' });
        expect(payload.clientAge).toBe(68);
    });

    it('clientAge es null cuando no se pasa, no un string placeholder', () => {
        const payload = buildRoutineDraftPayload({ exerciseNames: [], recentHistorySummary: '' });
        expect(payload.clientAge).toBeNull();
    });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `TZ=UTC npx vitest run src/lib/trainerUtils.test.js -t "clientAge"`
Expected: FAIL — `payload.clientAge` es `undefined`, no `68` ni `null`.

- [ ] **Step 3: Implementación**

Find:
```js
export function buildRoutineDraftPayload({ clientGoal, level, daysPerWeek, equipment, limitations, exerciseNames, recentHistorySummary }) {
    const parsedDays = Number(daysPerWeek);
    const daysPerWeekValue = daysPerWeek && !isNaN(parsedDays) ? parsedDays : null;
    return {
        clientGoal: clientGoal || 'No especificado',
        level: level || 'intermedio',
        daysPerWeek: daysPerWeekValue,
        equipment: equipment || 'No especificado',
        limitations: limitations || 'Ninguna',
        exerciseNames,
        recentHistorySummary,
    };
}
```

Replace con:
```js
export function buildRoutineDraftPayload({ clientGoal, clientAge, level, daysPerWeek, equipment, limitations, exerciseNames, recentHistorySummary }) {
    const parsedDays = Number(daysPerWeek);
    const daysPerWeekValue = daysPerWeek && !isNaN(parsedDays) ? parsedDays : null;
    return {
        clientGoal: clientGoal || 'No especificado',
        // null y no un string "No especificado": la IA distingue "sin dato"
        // de un valor real, y forzar un string lo trataría como si el
        // cliente tuviera esa edad literal.
        clientAge: clientAge ?? null,
        level: level || 'intermedio',
        daysPerWeek: daysPerWeekValue,
        equipment: equipment || 'No especificado',
        limitations: limitations || 'Ninguna',
        exerciseNames,
        recentHistorySummary,
    };
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `TZ=UTC npx vitest run src/lib/trainerUtils.test.js`
Expected: PASS, todos los tests del fichero (los 3 existentes de
`buildRoutineDraftPayload` + los 2 nuevos + el resto del fichero intacto).

- [ ] **Step 5: Commit**

```bash
git add src/lib/trainerUtils.js src/lib/trainerUtils.test.js
git commit -m "feat(edad-objetivo-ia): clientAge en buildRoutineDraftPayload"
```

---

## Task 2: `buildProgressionSuggestionPayload` — añadir `clientAge`

**Files:**
- Modify: `src/lib/trainerUtils.js`
- Test: `src/lib/trainerUtils.test.js`

- [ ] **Step 1: Escribir los tests (deben fallar)**

Find:
```js
        expect(result.category).toBe('No especificado');
        expect(result.clientGoal).toBe('No especificado');
        expect(result.level).toBe('intermedio');
        expect(result.currentTargetWeight).toBeNull();
    });
});
```

Replace con:
```js
        expect(result.category).toBe('No especificado');
        expect(result.clientGoal).toBe('No especificado');
        expect(result.level).toBe('intermedio');
        expect(result.currentTargetWeight).toBeNull();
    });

    it('incluye clientAge cuando se pasa', () => {
        const result = buildProgressionSuggestionPayload({
            exerciseName: 'Sentadilla',
            clientAge: 42,
            currentSeries: 3,
            currentReps: 8,
            historySummary: 'algo',
        });
        expect(result.clientAge).toBe(42);
    });

    it('clientAge es null cuando no se pasa', () => {
        const result = buildProgressionSuggestionPayload({
            exerciseName: 'Sentadilla',
            currentSeries: 3,
            currentReps: 8,
            historySummary: 'algo',
        });
        expect(result.clientAge).toBeNull();
    });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `TZ=UTC npx vitest run src/lib/trainerUtils.test.js -t "clientAge"`
Expected: FAIL en los 2 tests nuevos de `buildProgressionSuggestionPayload`
(los 2 de `buildRoutineDraftPayload` de la Task 1 ya están en verde).

- [ ] **Step 3: Implementación**

Find:
```js
export function buildProgressionSuggestionPayload({ exerciseName, category, clientGoal, level, currentSeries, currentReps, currentTargetWeight, currentTargetRir, historySummary }) {
    return {
        exerciseName,
        category: category || 'No especificado',
        clientGoal: clientGoal || 'No especificado',
        level: level || 'intermedio',
        currentSeries: currentSeries ?? null,
        currentReps: currentReps ?? null,
        currentTargetWeight: currentTargetWeight ?? null,
        currentTargetRir: currentTargetRir ?? null,
        historySummary,
    };
}
```

Replace con:
```js
export function buildProgressionSuggestionPayload({ exerciseName, category, clientGoal, clientAge, level, currentSeries, currentReps, currentTargetWeight, currentTargetRir, historySummary }) {
    return {
        exerciseName,
        category: category || 'No especificado',
        clientGoal: clientGoal || 'No especificado',
        clientAge: clientAge ?? null,
        level: level || 'intermedio',
        currentSeries: currentSeries ?? null,
        currentReps: currentReps ?? null,
        currentTargetWeight: currentTargetWeight ?? null,
        currentTargetRir: currentTargetRir ?? null,
        historySummary,
    };
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `TZ=UTC npx vitest run src/lib/trainerUtils.test.js`
Expected: PASS, todos los tests del fichero.

- [ ] **Step 5: Commit**

```bash
git add src/lib/trainerUtils.js src/lib/trainerUtils.test.js
git commit -m "feat(edad-objetivo-ia): clientAge en buildProgressionSuggestionPayload"
```

---

## Task 3: `RoutineReviewModal.jsx` — aceptar y enviar `clientAge`

**File:** `src/components/trainer/RoutineReviewModal.jsx`

**Context:** Este componente no tiene test dedicado (mismo criterio que el
resto de piezas de fetch/UI de IA del proyecto) — se verifica en la Task 6.

- [ ] **Step 1: Prop y ref**

Find:
```js
// exercises: [{ name, category, series, reps }] en el orden real de la rutina
// routineName: string
// clientGoal: string | undefined
export function RoutineReviewModal({ exercises, routineName, clientGoal, onClose }) {
    const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'
    const [answer, setAnswer] = useState('');
    const paramsRef = useRef({ exercises, routineName, clientGoal });
```

Replace con:
```js
// exercises: [{ name, category, series, reps }] en el orden real de la rutina
// routineName: string
// clientGoal: string | undefined
// clientAge: number | undefined
export function RoutineReviewModal({ exercises, routineName, clientGoal, clientAge, onClose }) {
    const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'
    const [answer, setAnswer] = useState('');
    const paramsRef = useRef({ exercises, routineName, clientGoal, clientAge });
```

- [ ] **Step 2: Desestructurar y enviar en el body**

Find:
```js
        const { exercises: initialExercises, routineName: initialRoutineName, clientGoal: initialClientGoal } = paramsRef.current;
```

Replace con:
```js
        const { exercises: initialExercises, routineName: initialRoutineName, clientGoal: initialClientGoal, clientAge: initialClientAge } = paramsRef.current;
```

Find:
```js
                    body: JSON.stringify({
                        routineName: initialRoutineName || 'Rutina sin nombre',
                        clientGoal: initialClientGoal || 'No especificado',
                        exercisesSummary,
                    }),
```

Replace con:
```js
                    body: JSON.stringify({
                        routineName: initialRoutineName || 'Rutina sin nombre',
                        clientGoal: initialClientGoal || 'No especificado',
                        clientAge: initialClientAge ?? null,
                        exercisesSummary,
                    }),
```

- [ ] **Step 3: Lint**

Run: `npx eslint src/components/trainer/RoutineReviewModal.jsx`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/trainer/RoutineReviewModal.jsx
git commit -m "feat(edad-objetivo-ia): RoutineReviewModal acepta y envia clientAge"
```

---

## Task 4: Threading — pasar `client.age` en los tres call sites

**Files:**
- Modify: `src/views/trainer/ClientProfileView.jsx`
- Modify: `src/views/trainer/RoutineAssignerView.jsx`

**Context:** `client.age` ya viaja en el objeto `client` en los tres sitios
(`profiles` se consulta con `select('*')` en `ClientsListView.jsx`, de
donde sale el `client` que reciben tanto `ClientProfileView` como
`RoutineAssignerView`). No hace falta ninguna query nueva.

- [ ] **Step 1: Progresión de ciclo (`ClientProfileView.jsx`)**

Find:
```js
            const payload = buildProgressionSuggestionPayload({
                exerciseName: editingExercise.name,
                category: editingExercise.category,
                clientGoal: client.goal,
                level: 'intermedio',
```

Replace con:
```js
            const payload = buildProgressionSuggestionPayload({
                exerciseName: editingExercise.name,
                category: editingExercise.category,
                clientGoal: client.goal,
                clientAge: client.age,
                level: 'intermedio',
```

- [ ] **Step 2: Revisión de rutina, mount en `ClientProfileView.jsx`**

Find:
```js
                    <RoutineReviewModal
                        key={reviewingAssignmentId}
                        exercises={assignment.routine.exercises.map((ex) => ({
                            name: ex.name,
                            category: ex.category,
                            series: ex.series,
                            reps: ex.reps,
                        }))}
                        routineName={assignment.routine.name}
                        clientGoal={client?.goal}
                        onClose={() => setReviewingAssignmentId(null)}
                    />
```

Replace con:
```js
                    <RoutineReviewModal
                        key={reviewingAssignmentId}
                        exercises={assignment.routine.exercises.map((ex) => ({
                            name: ex.name,
                            category: ex.category,
                            series: ex.series,
                            reps: ex.reps,
                        }))}
                        routineName={assignment.routine.name}
                        clientGoal={client?.goal}
                        clientAge={client?.age}
                        onClose={() => setReviewingAssignmentId(null)}
                    />
```

- [ ] **Step 3: Borrador de rutina con IA (`RoutineAssignerView.jsx`)**

Find:
```js
            const payload = buildRoutineDraftPayload({
                clientGoal,
                level,
                daysPerWeek,
                equipment,
                limitations,
                exerciseNames: catalog.map(ex => ex.name),
                recentHistorySummary,
            });
```

Replace con:
```js
            const payload = buildRoutineDraftPayload({
                clientGoal,
                clientAge: client?.age,
                level,
                daysPerWeek,
                equipment,
                limitations,
                exerciseNames: catalog.map(ex => ex.name),
                recentHistorySummary,
            });
```

- [ ] **Step 4: Revisión de rutina, mount en `RoutineAssignerView.jsx`**

Find:
```js
                <RoutineReviewModal
                    key={routineName}
                    exercises={selectedExercises.map((ex) => ({
                        name: ex.name,
                        category: catalog.find((c) => c.id === ex.catalog_id)?.category,
                        series: ex.series,
                        reps: ex.reps,
                    }))}
                    routineName={routineName}
                    clientGoal={client?.goal}
                    onClose={() => setShowReview(false)}
                />
```

Replace con:
```js
                <RoutineReviewModal
                    key={routineName}
                    exercises={selectedExercises.map((ex) => ({
                        name: ex.name,
                        category: catalog.find((c) => c.id === ex.catalog_id)?.category,
                        series: ex.series,
                        reps: ex.reps,
                    }))}
                    routineName={routineName}
                    clientGoal={client?.goal}
                    clientAge={client?.age}
                    onClose={() => setShowReview(false)}
                />
```

- [ ] **Step 5: Tests, lint y build**

Run: `TZ=UTC npm test`
Expected: todos los test files en verde.

Run: `npx eslint src/views/trainer/ClientProfileView.jsx src/views/trainer/RoutineAssignerView.jsx`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/views/trainer/ClientProfileView.jsx src/views/trainer/RoutineAssignerView.jsx
git commit -m "feat(edad-objetivo-ia): pasar client.age a los tres flujos de IA"
```

---

## Task 5: Actualizar los tres prompts en n8n

**Files:** ninguno en el repo — viven en la instancia de n8n
(`n8n.rabadanhouse.space`, carpeta Gymtracker `mFYxumQoAzC950ee`).

**Context:** Invoca la skill `using-n8n-skills` antes de tocar cualquier
herramienta `mcp__n8n-mcp__*` — protocolo obligatorio de este repo. Los tres
workflows ya existen y están publicados; esta tarea los actualiza in-place
con `update_workflow` (operación `updateNodeParameters`, `replace: true`),
no crea nada nuevo. IDs de los tres workflows (ya localizados en el spec):

| Workflow | ID |
|---|---|
| `Gym_App_RoutineDraft` | `zrnEm6mw32e6K6rS` |
| `Gym_App_Trainer_Review` | `x3s9ugFODtOpU4zr` |
| `Gym_App_ProgressionSuggestion` | `EQLlXUJdrFZ9Sm7Q` |

- [ ] **Step 1: `Gym_App_RoutineDraft` — nodo "Generar Borrador de Rutina (LLM)"**

Llama a `mcp__n8n-mcp__update_workflow` con:

```json
{
  "workflowId": "zrnEm6mw32e6K6rS",
  "operations": [
    {
      "type": "updateNodeParameters",
      "nodeName": "Generar Borrador de Rutina (LLM)",
      "replace": true,
      "parameters": {
        "promptType": "define",
        "text": "=clientGoal: {{ $json.body.clientGoal }}\nclientAge: {{ $json.body.clientAge }}\nlevel: {{ $json.body.level }}\ndaysPerWeek: {{ $json.body.daysPerWeek }}\nequipment: {{ $json.body.equipment }}\nlimitations: {{ $json.body.limitations }}\nexerciseNames: {{ JSON.stringify($json.body.exerciseNames) }}\nrecentHistorySummary: {{ $json.body.recentHistorySummary }}",
        "hasOutputParser": true,
        "messages": {
          "messageValues": [
            {
              "type": "SystemMessagePromptTemplate",
              "message": "Eres un entrenador experto que disena un borrador de rutina de gimnasio a partir de 8 campos: clientGoal, clientAge, level, daysPerWeek, equipment, limitations, exerciseNames y recentHistorySummary.\n\nUsa clientGoal para decidir rangos de repeticiones, descanso y que tipo de ejercicio priorizar:\n- Hipertrofia: 8-12 repeticiones, descanso 60-90s, mezcla equilibrada de compuestos y aislamiento.\n- Fuerza: 3-6 repeticiones, descanso 2-4 minutos, prioriza ejercicios compuestos (sentadilla, peso muerto, press) sobre aislamiento.\n- Resistencia: 15 o mas repeticiones, descanso 30-45s.\n- Perdida de Peso: volumen alto (mas series/ejercicios), descansos cortos.\n- Salud General o Mantenimiento: prioriza tecnica y consistencia sobre intensidad maxima, series y reps moderadas.\nSi clientGoal no es ninguno de estos valores o viene vacio, usa tu criterio.\n\nSi clientAge viene informado, tenlo en cuenta al elegir ejercicios, series, volumen e intensidad -- a mayor edad, prioriza salud articular y tecnica sobre cargas maximas. Si clientAge no viene informado, ignora este criterio.\n\nexerciseNames es la UNICA lista de la que puedes elegir ejercicios: cada catalogName que devuelvas debe ser una copia literal, caracter por caracter, de un elemento de esa lista. No inventes ejercicios que no esten en la lista ni modifiques su texto. Devuelve unicamente el JSON solicitado, sin texto adicional."
            }
          ]
        }
      }
    }
  ],
  "versionName": "Anadir clientAge y guia de objetivo al prompt",
  "versionDescription": "clientGoal llegaba como dato interpolado sin ninguna instruccion de como traducirlo en reps/descanso/seleccion de ejercicio. Se anade una tabla de guia por valor de objetivo y una instruccion generica de edad (sin reglas explicitas por franja).",
  "skillsUsed": ["n8n-skills:using-n8n-skills", "n8n-skills:n8n-mcp-tools-expert"]
}
```

- [ ] **Step 2: Verificar el nodo actualizado**

Llama a `mcp__n8n-mcp__get_workflow_details` con `workflowId: "zrnEm6mw32e6K6rS"`.
Confirma que el nodo `"Generar Borrador de Rutina (LLM)"` tiene el nuevo
`text` y el nuevo `messages.messageValues[0].message`, y que las conexiones
(`connections`) siguen intactas: `Webhook → LLM → Responder`,
`OpenAI Chat Model → ai_languageModel`, `Structured Output Parser →
ai_outputParser`.

- [ ] **Step 3: `Gym_App_Trainer_Review` — nodo "Variables Entrada"**

```json
{
  "workflowId": "x3s9ugFODtOpU4zr",
  "operations": [
    {
      "type": "updateNodeParameters",
      "nodeName": "Variables Entrada",
      "replace": true,
      "parameters": {
        "mode": "manual",
        "assignments": {
          "assignments": [
            { "id": "trainer-review-routineName", "name": "routineName", "value": "={{ $json.body.routineName || '' }}", "type": "string" },
            { "id": "trainer-review-clientGoal", "name": "clientGoal", "value": "={{ $json.body.clientGoal || 'No especificado' }}", "type": "string" },
            { "id": "trainer-review-clientAge", "name": "clientAge", "value": "={{ $json.body.clientAge || 'No especificado' }}", "type": "string" },
            { "id": "trainer-review-exercisesSummary", "name": "exercisesSummary", "value": "={{ $json.body.exercisesSummary || '' }}", "type": "string" }
          ]
        },
        "options": {}
      }
    }
  ],
  "versionName": "Anadir clientAge a las variables de entrada",
  "versionDescription": "Nueva asignacion clientAge, misma convencion de fallback a 'No especificado' que clientGoal.",
  "skillsUsed": ["n8n-skills:using-n8n-skills", "n8n-skills:n8n-mcp-tools-expert"]
}
```

- [ ] **Step 4: `Gym_App_Trainer_Review` — nodo "AI Agent"**

```json
{
  "workflowId": "x3s9ugFODtOpU4zr",
  "operations": [
    {
      "type": "updateNodeParameters",
      "nodeName": "AI Agent",
      "replace": true,
      "parameters": {
        "promptType": "define",
        "text": "=# ROLE\nActua como un Senior Fitness Coach revisando el trabajo de otro entrenador, no hablando con el cliente final. Tono directo, profesional, entre colegas.\n\n# CONTEXT\nVas a revisar una rutina de gimnasio ya construida por un entrenador para su cliente. Te doy el objetivo del cliente, su edad, y la rutina completa con, por cada ejercicio: grupo muscular, patron de movimiento (empuje/tiron/pierna/core/otro) y si es compuesto o aislamiento, en el orden real en que estan.\n\nObjetivo del cliente: {{ $json.clientGoal }}\nEdad del cliente: {{ $json.clientAge }}\n\nRutina \"{{ $json.routineName }}\":\n{{ $json.exercisesSummary }}\n\n# TAREA\nSenala agujeros concretos: patrones de movimiento ausentes o desequilibrados (ej. mucho empuje y nada de tiron), volumen de pierna muy por debajo del de torso, aislamiento colocado antes que ejercicios compuestos.\n\nAdemas, evalua si la rutina encaja con el objetivo del cliente: para Fuerza, senala si faltan compuestos pesados o sobra aislamiento; para Hipertrofia, senala si el volumen por grupo es bajo; para Resistencia o Perdida de Peso, senala si el volumen o la variedad es insuficiente.\n\nSi la edad del cliente esta informada y es alta, senala tambien si hay ejercicios de riesgo articular alto sin ningun ejercicio de movilidad o activacion previo en la rutina. Si la edad no esta informada, no comentes sobre edad.\n\nPara cada punto que senales, explica el porque en una frase. Si la rutina esta bien construida, dilo tambien -- no inventes problemas que no existen.\n\n# RESTRICTIONS\nNo propongas una rutina nueva ni sustituyas ejercicios -- solo senala el hueco. No menciones esteroides ni sustancias prohibidas.\n\n# FORMATO (OBLIGATORIO)\nMarkdown: parrafo inicial breve, `##` para separar tipos de hueco si hay varios, `-` para puntos concretos, `**negrita**` para lo importante, `> texto` para el aviso mas importante si lo hay. Maximo 250 palabras.",
        "options": {}
      }
    }
  ],
  "versionName": "Anadir edad y guia de objetivo a la revision",
  "versionDescription": "El objetivo solo se usaba para evaluar equilibrio de patrones de movimiento, sin criterio explicito por valor de objetivo. Se anade edad para poder senalar ejercicios de riesgo articular sin movilidad previa en clientes mayores.",
  "skillsUsed": ["n8n-skills:using-n8n-skills", "n8n-skills:n8n-mcp-tools-expert"]
}
```

- [ ] **Step 5: Verificar `Gym_App_Trainer_Review`**

Llama a `mcp__n8n-mcp__get_workflow_details` con `workflowId:
"x3s9ugFODtOpU4zr"`. Confirma que `"Variables Entrada"` tiene las 4
asignaciones (incluida `clientAge`) y que `"AI Agent"` tiene el nuevo
`text`. Confirma que las conexiones siguen intactas: `Webhook → Variables
Entrada → AI Agent → Respond to Webhook`, `OpenAI Chat Model →
ai_languageModel`.

- [ ] **Step 6: `Gym_App_ProgressionSuggestion` — nodo "Generate Progression"**

Este nodo es `@n8n/n8n-nodes-langchain.openAi` (v2.3, `resource: text`,
`operation: response`), no un `chainLlm` — su prompt vive en
`parameters.responses.values`, un array de 2 entradas (`system` y `user`).

```json
{
  "workflowId": "EQLlXUJdrFZ9Sm7Q",
  "operations": [
    {
      "type": "updateNodeParameters",
      "nodeName": "Generate Progression",
      "replace": true,
      "parameters": {
        "resource": "text",
        "operation": "response",
        "modelId": { "__rl": true, "mode": "id", "value": "gpt-4.1-mini" },
        "responses": {
          "values": [
            {
              "type": "text",
              "role": "system",
              "content": "Eres el asistente de un entrenador personal de la app Rutinex. Tu tarea es proponer una progresion de 4 semanas para UN solo ejercicio, basandote en el historial real registrado por el cliente (peso, repeticiones y RPE).\n\nRecibes estos campos del cliente: exerciseName, category, clientGoal, clientAge, level, currentSeries, currentReps, currentTargetWeight, currentTargetRir, historySummary.\n\nUsa clientGoal para orientar el rango de repeticiones y el ritmo de progresion:\n- Hipertrofia: manten el rango de 8-12 repeticiones, sube peso en incrementos pequenos cuando el RPE lo permita.\n- Fuerza: rango de 3-6 repeticiones, prioriza subir peso sobre subir repeticiones.\n- Resistencia: rango de 15 o mas repeticiones, prioriza series o repeticiones sobre peso.\n- Perdida de Peso: prioriza series y densidad de trabajo sobre peso maximo.\n- Salud General o Mantenimiento: progresion conservadora, prioriza tecnica y consistencia.\nSi clientGoal no es ninguno de estos valores o viene vacio, usa tu criterio.\n\nSi clientAge viene informado, tenlo en cuenta al decidir cuanto y que tan rapido progresar -- a mayor edad, progresa con incrementos mas conservadores y prioriza la tecnica sobre la velocidad de progresion. Si clientAge no viene informado, ignora este criterio.\n\nRPE es el \"esfuerzo percibido\" en una escala de 6 a 10: cuanto mas alto, mas cerca del fallo muscular. Si el historial muestra RPE >= 9 en todas las series de la ultima sesion registrada, NO anadas mas carga en la semana 1 - manten o reduce el peso, y dilo explicitamente en el motivo.\n\nSi historySummary es (o empieza por) el texto de fallback \"Sin historial...\", no hay datos reales de progresion: basa el plan en currentSeries, currentReps, currentTargetWeight, currentTargetRir, el objetivo del cliente (clientGoal), su edad (clientAge) y su nivel (level), y dilo explicitamente en el motivo de cada semana.\n\nDevuelve EXACTAMENTE 4 entradas en \"semanas\", con week de 1 a 4 en orden ascendente. Cada entrada debe incluir un \"motivo\" no vacio, de una frase, dirigido al entrenador, explicando el razonamiento real de esa semana - nunca relleno inventado.\n\nFormato de salida JSON:\n{ \"semanas\": [ { \"week\": 1, \"series\": number, \"reps\": number, \"target_weight\": number o null, \"target_rir\": number o null (0-5), \"motivo\": \"string, una frase\" } ] }"
            },
            {
              "type": "text",
              "role": "user",
              "content": "=exerciseName: {{ $json.body.exerciseName }}\ncategory: {{ $json.body.category }}\nclientGoal: {{ $json.body.clientGoal }}\nclientAge: {{ $json.body.clientAge }}\nlevel: {{ $json.body.level }}\ncurrentSeries: {{ $json.body.currentSeries }}\ncurrentReps: {{ $json.body.currentReps }}\ncurrentTargetWeight: {{ $json.body.currentTargetWeight }}\ncurrentTargetRir: {{ $json.body.currentTargetRir }}\nhistorySummary:\n{{ $json.body.historySummary }}"
            }
          ]
        },
        "options": {
          "textFormat": {
            "textOptions": {
              "type": "json_schema",
              "name": "gym_progression_suggestion",
              "strict": true,
              "schema": "{\"type\":\"object\",\"properties\":{\"semanas\":{\"type\":\"array\",\"minItems\":4,\"maxItems\":4,\"items\":{\"type\":\"object\",\"properties\":{\"week\":{\"type\":\"integer\",\"enum\":[1,2,3,4]},\"series\":{\"type\":\"number\"},\"reps\":{\"type\":\"number\"},\"target_weight\":{\"type\":[\"number\",\"null\"]},\"target_rir\":{\"type\":[\"number\",\"null\"]},\"motivo\":{\"type\":\"string\"}},\"required\":[\"week\",\"series\",\"reps\",\"target_weight\",\"target_rir\",\"motivo\"],\"additionalProperties\":false}}},\"required\":[\"semanas\"],\"additionalProperties\":false}"
            }
          }
        }
      }
    }
  ],
  "versionName": "Anadir clientAge y guia de objetivo a la progresion",
  "versionDescription": "clientGoal solo se mencionaba para el caso sin historial, sin tabla concreta de reps/ritmo. Se anade clientAge con instruccion generica de progresion mas conservadora en clientes mayores.",
  "skillsUsed": ["n8n-skills:using-n8n-skills", "n8n-skills:n8n-mcp-tools-expert"]
}
```

**Importante:** el `options.textFormat` con el `json_schema` estricto debe
copiarse tal cual (ya estaba así) — `replace: true` sustituye el objeto
`parameters` entero del nodo, así que omitir este bloque rompería la salida
estructurada.

- [ ] **Step 7: Verificar `Gym_App_ProgressionSuggestion`**

Llama a `mcp__n8n-mcp__get_workflow_details` con `workflowId:
"EQLlXUJdrFZ9Sm7Q"`. Confirma que `"Generate Progression"` tiene los dos
`content` actualizados (`values[0]` sistema, `values[1]` usuario) y que
`options.textFormat.textOptions.schema` sigue presente e idéntico al
original — si falta, la respuesta deja de venir en JSON estructurado y
`Respond With Progression` (`{{ $json.output[0].content[0].text }}`) se
rompe.

- [ ] **Step 8: Validar y publicar los tres**

Para cada uno de los tres workflows (`zrnEm6mw32e6K6rS`, `x3s9ugFODtOpU4zr`,
`EQLlXUJdrFZ9Sm7Q`):

Llama a `mcp__n8n-mcp__validate_workflow` — si el tool solo valida por
código SDK y no por ID, usa `mcp__n8n-mcp__get_workflow_details` (ya hecho
en los Steps 2/5/7) como verificación de wiring, que es la parte que la
validación por código no cubre.

Publica los tres con `mcp__n8n-mcp__publish_workflow`:
```
publish_workflow({ workflowId: "zrnEm6mw32e6K6rS" })
publish_workflow({ workflowId: "x3s9ugFODtOpU4zr" })
publish_workflow({ workflowId: "EQLlXUJdrFZ9Sm7Q" })
```

---

## Task 6: Verificación de calidad de los tres prompts

**Files:** ninguno (solo verificación manual, no hay forma de testear
automáticamente la calidad de un prompt).

**Context:** Mismo criterio que se usó para corregir el prompt de músculos
secundarios cuando la primera pasada etiquetaba mal: llamar al webhook real
con dos variantes del mismo caso y comparar la salida a ojo.

- [ ] **Step 1: `Gym_App_RoutineDraft` — cliente joven vs. cliente mayor, mismo objetivo Fuerza**

```bash
curl -s -X POST https://n8n.rabadanhouse.space/webhook/gym-app-routine-draft \
  -H 'Content-Type: application/json' \
  -d '{
    "clientGoal": "Fuerza",
    "clientAge": 25,
    "level": "intermedio",
    "daysPerWeek": 4,
    "equipment": "gimnasio completo",
    "limitations": "Ninguna",
    "exerciseNames": ["Sentadilla con barra", "Peso muerto rumano con barra", "Press de banca plano con barra", "Remo con barra", "Curl con barra", "Extensión de cuádriceps"],
    "recentHistorySummary": "Sin historial de entrenamientos registrado."
  }' --max-time 60 | python3 -m json.tool
```

```bash
curl -s -X POST https://n8n.rabadanhouse.space/webhook/gym-app-routine-draft \
  -H 'Content-Type: application/json' \
  -d '{
    "clientGoal": "Fuerza",
    "clientAge": 68,
    "level": "intermedio",
    "daysPerWeek": 4,
    "equipment": "gimnasio completo",
    "limitations": "Ninguna",
    "exerciseNames": ["Sentadilla con barra", "Peso muerto rumano con barra", "Press de banca plano con barra", "Remo con barra", "Curl con barra", "Extensión de cuádriceps"],
    "recentHistorySummary": "Sin historial de entrenamientos registrado."
  }' --max-time 60 | python3 -m json.tool
```

Confirmar a ojo: ambos deben mostrar rangos de repeticiones bajos (3-6, por
ser Fuerza) — eso confirma que la guía de objetivo se está aplicando. La
variante de 68 años debería reflejar en los `motivo` alguna consideración
de técnica/seguridad articular, o preferir ejercicios menos arriesgados de
la lista (ej. menos sesgo hacia sentadilla/peso muerto pesados que la de 25
años) — es una comparación cualitativa, no un test exacto.

- [ ] **Step 2: `Gym_App_Trainer_Review` — mismo caso**

```bash
curl -s -X POST https://n8n.rabadanhouse.space/webhook/TrainerReview \
  -H 'Content-Type: application/json' \
  -d '{
    "routineName": "Día 1 - Pierna",
    "clientGoal": "Fuerza",
    "clientAge": 70,
    "exercisesSummary": "1. Sentadilla con barra (Pierna, pierna, compuesto) 4x5\n2. Extensión de cuádriceps (Pierna, pierna, aislamiento) 3x12\n3. Curl femoral (Pierna, pierna, aislamiento) 3x12"
  }' --max-time 60 | python3 -m json.tool
```

Confirmar que la respuesta menciona algo sobre la edad y la sentadilla
pesada sin movilidad previa — es exactamente el caso que el prompt nuevo
pide señalar.

- [ ] **Step 3: `Gym_App_ProgressionSuggestion` — mismo caso**

```bash
curl -s -X POST https://n8n.rabadanhouse.space/webhook/gym-app-progression-suggestion \
  -H 'Content-Type: application/json' \
  -d '{
    "exerciseName": "Sentadilla con barra",
    "category": "Pierna",
    "clientGoal": "Fuerza",
    "clientAge": 70,
    "level": "intermedio",
    "currentSeries": 4,
    "currentReps": 5,
    "currentTargetWeight": 60,
    "currentTargetRir": 2,
    "historySummary": "Sin historial de entrenamientos registrado para este ejercicio."
  }' --max-time 60 | python3 -m json.tool
```

Confirmar que las 4 semanas muestran incrementos conservadores (no saltos
grandes de peso semana a semana) y que algún `motivo` referencia la edad o
un criterio conservador — comparación cualitativa contra lo que se vería con
`clientAge` más bajo si se quisiera contrastar.

- [ ] **Step 4: Confirmar que `clientAge` ausente no rompe nada**

Repite el Step 1 sin el campo `clientAge` en el body (payload viejo, como
seguiría llegando si algún caller no se hubiera actualizado). Confirmar
`HTTP 200` y una rutina generada con normalidad — el prompt dice
explícitamente "si clientAge no viene informado, ignora este criterio", así
que su ausencia no debe romper ni degradar la salida.

---

## Task 7: Verificación completa del repo

- [ ] **Step 1: Suite completa**

Run: `TZ=UTC npm test`
Expected: todos los test files en verde.

- [ ] **Step 2: Lint completo**

Run: `npx eslint .`
Expected: sin salida.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build OK. Luego `git checkout -- public/version.json`.

- [ ] **Step 4: Estado final**

```bash
git status
git log --oneline -6
```

Expected: working tree limpio, 5 commits de esta feature (Tasks 1-4, el
Task 5 no genera commits en el repo porque vive en n8n).

---

## Notes for the reviewer

- `clientAge` usa `?? null` en las dos funciones puras, nunca un string
  placeholder — mismo criterio que `currentSeries`/`currentTargetWeight` ya
  usan en `buildProgressionSuggestionPayload`. En el nodo Set de
  `Gym_App_Trainer_Review` sí se usa el fallback `'No especificado'` (como
  `clientGoal`) porque ahí el valor entra directo en el texto del prompt,
  no en una comparación de código.
- `level` no se toca en ningún sitio — sigue siendo el campo manual del
  entrenador, decisión explícita del spec.
- Los tres `updateNodeParameters` con `replace: true` sustituyen el objeto
  `parameters` completo del nodo — por eso cada operación de la Task 5
  incluye TODOS los campos existentes del nodo (`promptType`,
  `hasOutputParser`, `options.textFormat`, etc.), no solo el texto que
  cambia. Omitir un campo existente lo borraría.
