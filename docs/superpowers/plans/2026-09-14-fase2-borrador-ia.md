# Fase 2.1+2.4 — Borrador de rutina con IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El entrenador puede generar un borrador de rutina con IA (objetivo, nivel, días/semana, material, lesiones) desde una 3ª pestaña "Con IA" en `RoutineAssignerView.jsx`, que rellena "Crear nueva" con ejercicios del catálogo maestro, prescripción sugerida y un motivo por ejercicio.

**Architecture:** Un workflow n8n nuevo (`Gym_App_RoutineDraft`) recibe el contexto del cliente y la lista cerrada de nombres del catálogo, y devuelve un borrador JSON. En el cliente, tres funciones puras nuevas en `src/lib/trainerUtils.js` (resumen de historial, casar nombres de la IA con el catálogo, construir el payload) hacen de puente entre ese JSON y el estado `selectedExercises` que ya usa "Crear nueva". `handleSave` se extiende para persistir los 4 campos de prescripción que hoy se pierden.

**Tech Stack:** React 19, Supabase, n8n (workflow + nodo OpenAI), Vitest.

---

## Task 1: Workflow n8n `Gym_App_RoutineDraft`

**Files:** ninguno en el repo — vive en la instancia n8n (`n8n.rabadanhouse.space`, carpeta Gym `mFYxumQoAzC950ee`).

- [ ] **Step 1: Cargar el protocolo n8n**

Invocar la skill `using-n8n-skills` antes de tocar cualquier tool `mcp__n8n-mcp__*` — es el punto de entrada obligatorio del plugin, cubre qué skill usar para cada pieza (nodos, expresiones, validación).

- [ ] **Step 2: Cargar la referencia del SDK y las buenas prácticas**

Llamar `get_workflow_sdk_reference` (sin haberlo hecho antes en esta sesión, es obligatorio antes de escribir código de workflow). Llamar `get_workflow_best_practices` con `technique="ai agent"` o la técnica más cercana a "llamada estructurada a un LLM sin memoria conversacional" — si no está claro cuál aplica, llamar con `technique="list"` primero.

- [ ] **Step 3: Buscar y tipar los nodos necesarios**

`search_nodes` con las queries: `"webhook"`, `"openai chat model"` (o `"message a model"`/`"OpenAI"`, según lo que devuelva la búsqueda), `"respond to webhook"`. Estructura lógica del workflow (3-4 nodos):

1. **Webhook** (trigger, método POST) — recibe el JSON de entrada tal como lo describe el spec (`clientGoal`, `level`, `daysPerWeek`, `equipment`, `limitations`, `exerciseNames`, `recentHistorySummary`).
2. **Nodo OpenAI** (modelo `gpt-4.1-mini`, credencial `OpenAI Carlos` id `HeNfhfUfwAHOImZn`) — prompt de sistema que:
   - Recibe los 7 campos del webhook.
   - Deja explícito que `exerciseNames` es la ÚNICA lista de la que puede elegir — cada `catalogName` que devuelva debe ser una copia literal de un elemento de esa lista.
   - Pide salida JSON con la forma exacta:
     ```json
     {
       "nombre": "string",
       "ejercicios": [
         {
           "catalogName": "string (debe existir en exerciseNames)",
           "series": "number",
           "reps": "number",
           "target_weight": "number o null",
           "target_rir": "number o null",
           "rest_seconds": "number o null",
           "notes": "string o null",
           "motivo": "string, una frase"
         }
       ]
     }
     ```
   - Usa el modo de salida estructurada/JSON del nodo si el tipo de nodo lo soporta (confirmar con `get_node_types` sobre el nodo concreto encontrado — no asumir el nombre del parámetro sin mirarlo).
3. **Respond to Webhook** — devuelve el JSON generado tal cual (parseado, no como string escapado).

Para cada nodo elegido, llamar `get_node_types` con su id exacto (incluyendo discriminadores de `search_nodes`, p.ej. `resource`/`operation` del nodo OpenAI) antes de escribir el código del workflow — no adivinar nombres de parámetro.

- [ ] **Step 4: Construir el workflow**

Usar `create_workflow_from_code` con la estructura de 3 nodos de arriba, nombre `Gym_App_RoutineDraft`, en el folder `mFYxumQoAzC950ee`. Seguir la sintaxis exacta que devolvió `get_workflow_sdk_reference` en el Step 2 (no la sintaxis de memoria).

- [ ] **Step 5: Validar**

Llamar `validate_workflow` sobre el workflow recién creado. Si hay errores, consultar la skill `n8n-validation-expert` antes de corregir a ciegas (para no "arreglar" un falso positivo ya documentado).

- [ ] **Step 6: Probar con un payload de ejemplo**

Llamar `test_workflow` (o `execute_workflow` si el workflow no admite test directo) con un payload de ejemplo:

```json
{
  "clientGoal": "Fuerza",
  "level": "intermedio",
  "daysPerWeek": 4,
  "equipment": "gimnasio completo",
  "limitations": "ninguna",
  "exerciseNames": ["Sentadilla trasera", "Press banca", "Peso muerto", "Remo con barra", "Press militar"],
  "recentHistorySummary": "Sin historial de entrenamientos registrado."
}
```

Confirmar que la respuesta trae `nombre` (string) y `ejercicios` (array no vacío) con `catalogName` tomados literalmente de la lista de `exerciseNames` enviada.

- [ ] **Step 7: Publicar**

`publish_workflow` para dejarlo activo. Anotar la URL del webhook resultante (se necesita en el Task 5 para `.env.local`/Vercel).

---

## Task 2: Funciones puras de trainerUtils — resumen de historial

**Files:**
- Modify: `src/lib/trainerUtils.js`
- Test: `src/lib/trainerUtils.test.js` (crear)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/trainerUtils.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { summarizeWorkoutHistory } from './trainerUtils';

describe('summarizeWorkoutHistory', () => {
    it('devuelve un texto sin historial cuando no hay logs', () => {
        expect(summarizeWorkoutHistory([], {})).toBe('Sin historial de entrenamientos registrado.');
        expect(summarizeWorkoutHistory(null, {})).toBe('Sin historial de entrenamientos registrado.');
    });

    it('resume fecha, nombre de rutina y número de ejercicios por sesión', () => {
        const logs = [
            {
                routine_id: 'day4',
                date: '2026-09-10T14:09:42.758+00:00',
                logs: { '1': {}, '2': {}, workoutDuration: { durationMinutes: 80 } },
            },
        ];
        const nameById = { day4: 'Día 4: Biceps / Triceps' };
        expect(summarizeWorkoutHistory(logs, nameById)).toBe(
            '2026-09-10 · Día 4: Biceps / Triceps · 2 ejercicios'
        );
    });

    it('no cuenta workoutDuration ni cardio como ejercicios', () => {
        const logs = [
            {
                routine_id: 'day1',
                date: '2026-09-01T10:00:00+00:00',
                logs: { '5': {}, workoutDuration: {}, cardio: {} },
            },
        ];
        expect(summarizeWorkoutHistory(logs, { day1: 'Día 1' })).toBe('2026-09-01 · Día 1 · 1 ejercicios');
    });

    it('usa el routine_id como nombre si no hay match en nameById', () => {
        const logs = [{ routine_id: 'custom_x', date: '2026-08-01T00:00:00+00:00', logs: {} }];
        expect(summarizeWorkoutHistory(logs, {})).toBe('2026-08-01 · custom_x · 0 ejercicios');
    });

    it('une varias sesiones con salto de línea', () => {
        const logs = [
            { routine_id: 'day1', date: '2026-09-02T00:00:00+00:00', logs: { a: {} } },
            { routine_id: 'day1', date: '2026-09-01T00:00:00+00:00', logs: { a: {}, b: {} } },
        ];
        const result = summarizeWorkoutHistory(logs, { day1: 'Día 1' });
        expect(result.split('\n')).toHaveLength(2);
    });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- trainerUtils`
Expected: FAIL — `summarizeWorkoutHistory is not a function` (no existe todavía en `trainerUtils.js`).

- [ ] **Step 3: Implementar `summarizeWorkoutHistory`**

Añadir a `src/lib/trainerUtils.js`, después del comentario de cabecera existente:

```js
/**
 * Resume el historial reciente de un cliente en texto plano, para pasarlo
 * como contexto a la IA del borrador de rutina (Fase 2.1) sin mandar el
 * JSON crudo de `workout_logs`.
 *
 * @param {Array<{routine_id: string, date: string, logs: object}>} logs
 * @param {Record<string, string>} nameById  routine_id -> nombre de rutina
 * @returns {string}
 */
export function summarizeWorkoutHistory(logs, nameById) {
    if (!logs || logs.length === 0) return 'Sin historial de entrenamientos registrado.';

    return logs.map(log => {
        const routineName = nameById[log.routine_id] || log.routine_id;
        const exerciseCount = log.logs
            ? Object.keys(log.logs).filter(key => key !== 'workoutDuration' && key !== 'cardio').length
            : 0;
        const dateOnly = log.date.slice(0, 10);
        return `${dateOnly} · ${routineName} · ${exerciseCount} ejercicios`;
    }).join('\n');
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test -- trainerUtils`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/trainerUtils.js src/lib/trainerUtils.test.js
git commit -m "$(cat <<'EOF'
feat(entrenador): resumir historial de cliente para el borrador de IA

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Funciones puras de trainerUtils — casar el borrador con el catálogo

**Files:**
- Modify: `src/lib/trainerUtils.js`
- Test: `src/lib/trainerUtils.test.js`

- [ ] **Step 1: Añadir los tests que fallan**

Añadir a `src/lib/trainerUtils.test.js`:

```js
import { matchDraftExercisesToCatalog, buildRoutineDraftPayload } from './trainerUtils';

describe('matchDraftExercisesToCatalog', () => {
    const catalog = [
        { id: 1, name: 'Sentadilla trasera', image_url: 'img1.jpg' },
        { id: 2, name: 'Press banca', image_url: null },
    ];

    it('casa por nombre exacto y arma el objeto con la forma de selectedExercises', () => {
        const draft = [
            { catalogName: 'Sentadilla trasera', series: 4, reps: 8, target_weight: 60, target_rir: 2, rest_seconds: 120, notes: null, motivo: 'Prioridad de pierna.' },
        ];
        const { matched, unmatched } = matchDraftExercisesToCatalog(draft, catalog);
        expect(unmatched).toEqual([]);
        expect(matched).toEqual([{
            catalog_id: 1,
            name: 'Sentadilla trasera',
            image_url: 'img1.jpg',
            series: 4,
            reps: 8,
            target_weight: 60,
            target_rir: 2,
            rest_seconds: 120,
            notes: null,
            motivo: 'Prioridad de pierna.',
        }]);
    });

    it('casa sin distinguir mayúsculas ni espacios sobrantes', () => {
        const draft = [{ catalogName: '  press banca  ', series: 3, reps: 10 }];
        const { matched, unmatched } = matchDraftExercisesToCatalog(draft, catalog);
        expect(unmatched).toEqual([]);
        expect(matched[0].catalog_id).toBe(2);
    });

    it('devuelve el nombre en unmatched cuando no hay ningún ejercicio del catálogo con ese nombre', () => {
        const draft = [{ catalogName: 'Ejercicio inventado', series: 3, reps: 10 }];
        const { matched, unmatched } = matchDraftExercisesToCatalog(draft, catalog);
        expect(matched).toEqual([]);
        expect(unmatched).toEqual(['Ejercicio inventado']);
    });

    it('aplica defaults de series/reps cuando la IA no los manda', () => {
        const draft = [{ catalogName: 'Press banca' }];
        const { matched } = matchDraftExercisesToCatalog(draft, catalog);
        expect(matched[0].series).toBe(3);
        expect(matched[0].reps).toBe(10);
    });

    it('devuelve listas vacías si el borrador no trae ejercicios', () => {
        expect(matchDraftExercisesToCatalog([], catalog)).toEqual({ matched: [], unmatched: [] });
        expect(matchDraftExercisesToCatalog(null, catalog)).toEqual({ matched: [], unmatched: [] });
    });
});

describe('buildRoutineDraftPayload', () => {
    it('rellena defaults para los campos opcionales que falten', () => {
        const payload = buildRoutineDraftPayload({
            exerciseNames: ['Sentadilla trasera'],
            recentHistorySummary: 'Sin historial de entrenamientos registrado.',
        });
        expect(payload).toEqual({
            clientGoal: 'No especificado',
            level: 'intermedio',
            daysPerWeek: null,
            equipment: 'No especificado',
            limitations: 'Ninguna',
            exerciseNames: ['Sentadilla trasera'],
            recentHistorySummary: 'Sin historial de entrenamientos registrado.',
        });
    });

    it('usa los valores dados cuando vienen informados', () => {
        const payload = buildRoutineDraftPayload({
            clientGoal: 'Hipertrofia',
            level: 'avanzado',
            daysPerWeek: '5',
            equipment: 'mancuernas en casa',
            limitations: 'molestia en el hombro',
            exerciseNames: ['Press banca'],
            recentHistorySummary: '2026-09-10 · Día 4 · 8 ejercicios',
        });
        expect(payload.clientGoal).toBe('Hipertrofia');
        expect(payload.daysPerWeek).toBe(5);
    });
});
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npm test -- trainerUtils`
Expected: FAIL — `matchDraftExercisesToCatalog is not a function`, `buildRoutineDraftPayload is not a function`.

- [ ] **Step 3: Implementar ambas funciones**

Añadir a `src/lib/trainerUtils.js`:

```js
/**
 * Casa el borrador que devuelve la IA (Fase 2.1) contra el catálogo maestro
 * ya cargado en RoutineAssignerView. La IA solo puede elegir nombres de
 * `exerciseNames` (ver buildRoutineDraftPayload), pero puede equivocarse o
 * el modelo puede alucinar — por eso el match es defensivo: lo que no casa
 * se descarta y se reporta, no rompe el resto del borrador.
 *
 * @param {Array<object>} draftExercises  el array `ejercicios` que devuelve el webhook
 * @param {Array<{id: number, name: string, image_url: string|null}>} catalog
 * @returns {{ matched: Array<object>, unmatched: string[] }}
 */
export function matchDraftExercisesToCatalog(draftExercises, catalog) {
    const byName = new Map(catalog.map(ex => [ex.name.trim().toLowerCase(), ex]));
    const matched = [];
    const unmatched = [];

    for (const item of (draftExercises || [])) {
        const key = String(item.catalogName || '').trim().toLowerCase();
        const catalogEx = byName.get(key);
        if (!catalogEx) {
            unmatched.push(item.catalogName);
            continue;
        }
        matched.push({
            catalog_id: catalogEx.id,
            name: catalogEx.name,
            image_url: catalogEx.image_url || null,
            series: item.series ?? 3,
            reps: item.reps ?? 10,
            target_weight: item.target_weight ?? null,
            target_rir: item.target_rir ?? null,
            rest_seconds: item.rest_seconds ?? null,
            notes: item.notes ?? null,
            motivo: item.motivo ?? null,
        });
    }

    return { matched, unmatched };
}

/**
 * Arma el cuerpo del POST al webhook `Gym_App_RoutineDraft` (Fase 2.1),
 * con defaults en español para los campos que el entrenador deje en blanco
 * en el formulario "Con IA".
 */
export function buildRoutineDraftPayload({ clientGoal, level, daysPerWeek, equipment, limitations, exerciseNames, recentHistorySummary }) {
    return {
        clientGoal: clientGoal || 'No especificado',
        level: level || 'intermedio',
        daysPerWeek: daysPerWeek ? Number(daysPerWeek) : null,
        equipment: equipment || 'No especificado',
        limitations: limitations || 'Ninguna',
        exerciseNames,
        recentHistorySummary,
    };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `npm test -- trainerUtils`
Expected: PASS (11 tests en total del archivo).

- [ ] **Step 5: Commit**

```bash
git add src/lib/trainerUtils.js src/lib/trainerUtils.test.js
git commit -m "$(cat <<'EOF'
feat(entrenador): casar borrador de IA con el catálogo y armar el payload

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `fetchRecentHistorySummary` (wrapper de Supabase, sin test)

**Files:**
- Modify: `src/lib/trainerUtils.js`

- [ ] **Step 1: Añadir la función**

Añadir a `src/lib/trainerUtils.js` (usa `summarizeWorkoutHistory` del Task 2; sin test unitario porque es una llamada directa a Supabase — mismo criterio que el resto de wrappers de `utils.js`, que tampoco se testean, solo se verifican en el navegador):

```js
/**
 * Últimas `limit` sesiones de un cliente, ya resumidas en texto, para el
 * formulario "Con IA" (Fase 2.1). Mismo patrón de dos consultas que
 * ClientProfileView.jsx (routine_id no tiene FK real a `routines.id`, puede
 * ser un id estático tipo "day1" que ni existe como fila).
 *
 * @param {string} clientUserId
 * @param {number} limit
 * @returns {Promise<string>}
 */
export async function fetchRecentHistorySummary(clientUserId, limit = 10) {
    const { data: logs, error } = await supabase
        .from('workout_logs')
        .select('routine_id, date, logs')
        .eq('user_id', clientUserId)
        .order('date', { ascending: false })
        .limit(limit);
    if (error) throw error;

    const routineIds = [...new Set((logs || []).map(l => l.routine_id).filter(Boolean))];
    let nameById = {};
    if (routineIds.length > 0) {
        const { data: routinesData } = await supabase
            .from('routines')
            .select('id, name')
            .in('id', routineIds);
        nameById = Object.fromEntries((routinesData || []).map(r => [r.id, r.name]));
    }

    return summarizeWorkoutHistory(logs, nameById);
}
```

- [ ] **Step 2: Verificar lint**

Run: `npx eslint src/lib/trainerUtils.js`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/lib/trainerUtils.js
git commit -m "$(cat <<'EOF'
feat(entrenador): cargar historial reciente del cliente desde Supabase

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Variable de entorno

**Files:**
- Modify: `.env.example`
- Modify: `.env.local` (no se commitea, está en `.gitignore`)

- [ ] **Step 1: Añadir la variable a `.env.example`**

En `.env.example`, después de la línea `VITE_N8N_TRAINER_REVIEW_WEBHOOK_URL=...`:

```
VITE_N8N_ROUTINE_DRAFT_WEBHOOK_URL=https://n8n.rabadanhouse.space/webhook/RoutineDraft
```

- [ ] **Step 2: Añadir la variable real a `.env.local`**

Usar la URL real del webhook publicado en el Task 1, Step 7. Añadir la misma línea (con la URL real) a `.env.local`. Reiniciar `npm run dev` tras el cambio (las env vars de Vite solo se leen al arrancar).

- [ ] **Step 3: Avisar de la variable en Vercel**

Esto no se puede hacer por comando — anotar en el resumen final de la tarea que el usuario debe añadir `VITE_N8N_ROUTINE_DRAFT_WEBHOOK_URL` en Vercel (Project Settings → Environment Variables) antes de que el "Con IA" funcione en producción. Sin esto, el fetch en producción falla con el mismo mensaje que ya maneja `RoutineReviewModal.jsx` cuando falta la suya (`Falta configurar ...`).

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "$(cat <<'EOF'
docs: documentar VITE_N8N_ROUTINE_DRAFT_WEBHOOK_URL en .env.example

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Pestaña "Con IA" en `RoutineAssignerView.jsx`

**Files:**
- Modify: `src/views/trainer/RoutineAssignerView.jsx`

- [ ] **Step 1: Añadir el import y el componente `GenerateWithAiTab`**

En `src/views/trainer/RoutineAssignerView.jsx`, añadir a los imports existentes (cerca de la línea 1-7):

```js
import { Sparkles, Loader2 } from 'lucide-react';
import { fetchRecentHistorySummary, matchDraftExercisesToCatalog, buildRoutineDraftPayload } from '../../lib/trainerUtils';
```

(`cloneRoutineToClient` ya se importa de `trainerUtils` en la línea 4 — añadir estos tres nombres al mismo `import { ... } from '../../lib/trainerUtils';` en vez de duplicar la línea.)

Después de la función `SelectedExerciseList` (termina en la línea 142, justo antes del comentario `// ─── Assign Existing Routine Tab ───`), añadir:

```js
const REQUEST_TIMEOUT_MS = 30000;

// ─── Generate With AI Tab ───────────────────────────────────────────────────

function GenerateWithAiTab({ client, catalog, onDraftGenerated }) {
    const [clientGoal, setClientGoal] = useState(client?.goal || '');
    const [level, setLevel] = useState('intermedio');
    const [daysPerWeek, setDaysPerWeek] = useState(4);
    const [equipment, setEquipment] = useState('');
    const [limitations, setLimitations] = useState('');
    const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'error'
    const [errorMessage, setErrorMessage] = useState('');
    const [warning, setWarning] = useState('');

    const handleGenerate = async () => {
        const webhookUrl = import.meta.env.VITE_N8N_ROUTINE_DRAFT_WEBHOOK_URL;
        if (!webhookUrl) {
            setStatus('error');
            setErrorMessage('Falta configurar VITE_N8N_ROUTINE_DRAFT_WEBHOOK_URL.');
            return;
        }

        setStatus('loading');
        setErrorMessage('');
        setWarning('');

        let controller;
        let timer;
        try {
            const recentHistorySummary = client?.user_id
                ? await fetchRecentHistorySummary(client.user_id)
                : 'Sin historial de entrenamientos registrado.';

            const payload = buildRoutineDraftPayload({
                clientGoal,
                level,
                daysPerWeek,
                equipment,
                limitations,
                exerciseNames: catalog.map(ex => ex.name),
                recentHistorySummary,
            });

            controller = new AbortController();
            timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            clearTimeout(timer);

            if (!response.ok) throw new Error('Respuesta HTTP ' + response.status);
            const data = await response.json();

            const { matched, unmatched } = matchDraftExercisesToCatalog(data.ejercicios, catalog);
            if (matched.length === 0) {
                setStatus('error');
                setErrorMessage('La IA no devolvió ningún ejercicio reconocible del catálogo. Inténtalo de nuevo.');
                return;
            }

            if (unmatched.length > 0) {
                setWarning(`La IA sugirió ${unmatched.length} ejercicio(s) que no existen en el catálogo y se han omitido.`);
            }

            setStatus('idle');
            onDraftGenerated(data.nombre || 'Rutina generada con IA', matched);
        } catch (err) {
            clearTimeout(timer);
            console.error('Error generando borrador con IA:', err);
            setStatus('error');
            setErrorMessage('No se pudo generar el borrador. Inténtalo de nuevo.');
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center gap-2 text-text-primary">
                <Sparkles size={18} className="text-primary" />
                <h3 className="text-sm font-bold">Generar borrador con IA</h3>
            </div>

            <div className="space-y-3">
                <div>
                    <label className="text-xs text-text-secondary">Objetivo del cliente</label>
                    <input
                        type="text"
                        value={clientGoal}
                        onChange={(e) => setClientGoal(e.target.value)}
                        className="w-full mt-1 bg-surface border border-surface-highlight rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                        placeholder="Ej: Fuerza, hipertrofia, pérdida de grasa..."
                    />
                </div>

                <div>
                    <label className="text-xs text-text-secondary">Nivel</label>
                    <select
                        value={level}
                        onChange={(e) => setLevel(e.target.value)}
                        className="w-full mt-1 bg-surface border border-surface-highlight rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                    >
                        <option value="principiante">Principiante</option>
                        <option value="intermedio">Intermedio</option>
                        <option value="avanzado">Avanzado</option>
                    </select>
                </div>

                <div>
                    <label className="text-xs text-text-secondary">Días por semana</label>
                    <input
                        type="number"
                        min={1}
                        max={7}
                        value={daysPerWeek}
                        onChange={(e) => setDaysPerWeek(e.target.value)}
                        className="w-full mt-1 bg-surface border border-surface-highlight rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                    />
                </div>

                <div>
                    <label className="text-xs text-text-secondary">Material disponible</label>
                    <input
                        type="text"
                        value={equipment}
                        onChange={(e) => setEquipment(e.target.value)}
                        className="w-full mt-1 bg-surface border border-surface-highlight rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                        placeholder="Ej: gimnasio completo, mancuernas en casa..."
                    />
                </div>

                <div>
                    <label className="text-xs text-text-secondary">Lesiones o limitaciones (opcional)</label>
                    <input
                        type="text"
                        value={limitations}
                        onChange={(e) => setLimitations(e.target.value)}
                        className="w-full mt-1 bg-surface border border-surface-highlight rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
                        placeholder="Ej: molestia en el hombro derecho"
                    />
                </div>
            </div>

            {status === 'error' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-400 text-xs font-medium">
                    {errorMessage}
                </div>
            )}
            {warning && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-2.5 text-yellow-500 text-xs font-medium">
                    {warning}
                </div>
            )}

            <button
                onClick={handleGenerate}
                disabled={status === 'loading'}
                className="w-full bg-primary text-black font-bold px-4 py-3 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
            >
                {status === 'loading' ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Generando...
                    </>
                ) : (
                    'Generar borrador'
                )}
            </button>
        </div>
    );
}
```

- [ ] **Step 2: Verificar lint**

Run: `npx eslint src/views/trainer/RoutineAssignerView.jsx`
Expected: mismos warnings/errores preexistentes que antes de este cambio (comparar con `git stash` si hace falta) — sin errores nuevos. `GenerateWithAiTab` aún no se usa en el render todavía (eso es el Task 7) — puede salir un warning de "defined but never used" en este punto intermedio, es esperado y se resuelve en el Task 7.

- [ ] **Step 3: Commit**

```bash
git add src/views/trainer/RoutineAssignerView.jsx
git commit -m "$(cat <<'EOF'
feat(entrenador): formulario "Con IA" para generar borrador de rutina

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Cablear la pestaña "Con IA" en el render + extender `handleSave`

**Files:**
- Modify: `src/views/trainer/RoutineAssignerView.jsx`

- [ ] **Step 1: Añadir `'ai'` como valor posible de `mode`**

Cambiar la línea:

```js
    const [mode, setMode] = useState('existing'); // 'existing' | 'new'
```

por:

```js
    const [mode, setMode] = useState('existing'); // 'existing' | 'new' | 'ai'
```

- [ ] **Step 2: Añadir el 3er botón de pestaña**

Cambiar el bloque de pestañas (busca `{/* Mode tabs */}`):

```jsx
            {/* Mode tabs */}
            <div className="flex gap-1 p-3 border-b border-surface-highlight bg-background">
                <button
                    onClick={() => setMode('existing')}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'existing' ? 'bg-primary text-black' : 'bg-surface text-text-secondary hover:text-text-primary'}`}
                >
                    Rutinas existentes
                </button>
                <button
                    onClick={() => setMode('new')}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'new' ? 'bg-primary text-black' : 'bg-surface text-text-secondary hover:text-text-primary'}`}
                >
                    Crear nueva
                </button>
            </div>
```

por:

```jsx
            {/* Mode tabs */}
            <div className="flex gap-1 p-3 border-b border-surface-highlight bg-background">
                <button
                    onClick={() => setMode('existing')}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'existing' ? 'bg-primary text-black' : 'bg-surface text-text-secondary hover:text-text-primary'}`}
                >
                    Rutinas existentes
                </button>
                <button
                    onClick={() => setMode('new')}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'new' ? 'bg-primary text-black' : 'bg-surface text-text-secondary hover:text-text-primary'}`}
                >
                    Crear nueva
                </button>
                <button
                    onClick={() => setMode('ai')}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'ai' ? 'bg-primary text-black' : 'bg-surface text-text-secondary hover:text-text-primary'}`}
                >
                    Con IA
                </button>
            </div>
```

- [ ] **Step 3: Renderizar `GenerateWithAiTab` en modo `'ai'`**

El render del cuerpo hoy es un ternario de 2 ramas:

```jsx
            {mode === 'existing' ? (
                <AssignExistingTab client={client} user={user} onSuccess={onSuccess} onBack={onBack} />
            ) : (
                <div className="md:flex md:flex-1 md:min-h-0">
```

Cambiar a un ternario de 3 ramas:

```jsx
            {mode === 'existing' ? (
                <AssignExistingTab client={client} user={user} onSuccess={onSuccess} onBack={onBack} />
            ) : mode === 'ai' ? (
                <GenerateWithAiTab
                    client={client}
                    catalog={catalog}
                    onDraftGenerated={(name, exercises) => {
                        setRoutineName(name);
                        setSelectedExercises(exercises);
                        setMode('new');
                    }}
                />
            ) : (
                <div className="md:flex md:flex-1 md:min-h-0">
```

(El cierre de ese bloque, más abajo en el archivo, ya cierra el ternario original con `)}` — no hace falta tocarlo, sigue cerrando la última rama igual que antes.)

- [ ] **Step 4: Mostrar el "motivo" en `SelectedExerciseList`**

En `SelectedExerciseList` (líneas 102-142), cambiar:

```jsx
                    <span className="flex-1 text-xs text-text-primary truncate">{ex.name}</span>
                    <span className="text-xs text-text-secondary font-bold">{ex.series}×{ex.reps}</span>
```

por:

```jsx
                    <div className="flex-1 min-w-0">
                        <span className="block text-xs text-text-primary truncate">{ex.name}</span>
                        {ex.motivo && (
                            <span className="block text-[10px] text-text-secondary italic truncate">{ex.motivo}</span>
                        )}
                    </div>
                    <span className="text-xs text-text-secondary font-bold flex-shrink-0">{ex.series}×{ex.reps}</span>
```

- [ ] **Step 5: Extender el insert de `exercises` en `handleSave`**

Cambiar:

```js
            const { error: exError } = await supabase.from('exercises').insert(
                selectedExercises.map((ex, i) => ({
                    routine_id: routineId,
                    name: ex.name,
                    series: String(ex.series),
                    reps: String(ex.reps),
                    image_url: ex.image_url,
                    catalog_id: ex.catalog_id ?? null,
                    ui_order: i + 1,
                }))
            );
```

por:

```js
            const { error: exError } = await supabase.from('exercises').insert(
                selectedExercises.map((ex, i) => ({
                    routine_id: routineId,
                    name: ex.name,
                    series: String(ex.series),
                    reps: String(ex.reps),
                    image_url: ex.image_url,
                    catalog_id: ex.catalog_id ?? null,
                    ui_order: i + 1,
                    target_weight: ex.target_weight ?? null,
                    target_rir: ex.target_rir ?? null,
                    rest_seconds: ex.rest_seconds ?? null,
                    notes: ex.notes ?? null,
                }))
            );
```

(`ex.motivo`, si existe, no se incluye aquí a propósito — es efímero, decisión ya cerrada en el spec.)

- [ ] **Step 6: Verificar lint**

Run: `npx eslint src/views/trainer/RoutineAssignerView.jsx`
Expected: sin errores nuevos (el warning de "GenerateWithAiTab never used" del Task 6 debe haber desaparecido, ya se usa aquí).

- [ ] **Step 7: Ejecutar toda la suite**

Run: `npm test`
Expected: PASS, 81 tests (70 previos + 11 nuevos de `trainerUtils.test.js`).

- [ ] **Step 8: Commit**

```bash
git add src/views/trainer/RoutineAssignerView.jsx
git commit -m "$(cat <<'EOF'
feat(entrenador): cablear pestaña "Con IA" y guardar prescripción sugerida

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Verificación en navegador

**Files:** ninguno

- [ ] **Step 1: Arrancar la app (skill `run-rutinex`)**

Con `.env.local` ya actualizado (Task 5) y el workflow n8n ya publicado (Task 1).

- [ ] **Step 2: Flujo completo con login de entrenador**

Login `admin@gymtracker.com`. Ir a un cliente → Asignar rutina → pestaña "Con IA". Rellenar el formulario (objetivo ya viene precargado de `client.goal` si el cliente lo tiene informado) y pulsar "Generar borrador".

- Confirmar que tras generar, la vista salta sola a "Crear nueva" con el nombre y los ejercicios ya rellenos.
- Confirmar que cada ejercicio del borrador muestra su línea de motivo en cursiva bajo el nombre, en la lista de seleccionados.
- Pulsar "Guardar" y, con `mcp__supabase__execute_sql` (solo lectura), comprobar que la fila de `exercises` recién creada tiene `target_weight`/`target_rir`/`rest_seconds`/`notes` rellenos cuando el borrador los traía.
- Revisar la consola del navegador: sin errores nuevos.

- [ ] **Step 3: Caso de error — variable de entorno ausente**

Comentar temporalmente `VITE_N8N_ROUTINE_DRAFT_WEBHOOK_URL` en `.env.local`, reiniciar el dev server, repetir "Generar borrador" y confirmar que aparece el aviso "Falta configurar..." sin romper la pantalla. Descomentar la variable y reiniciar de nuevo antes de seguir.

- [ ] **Step 4: Caso de ejercicios no reconocidos (si se puede forzar)**

Si es fácil de provocar (p.ej. pidiendo a la IA algo fuera de lo típico), confirmar que el aviso amarillo "La IA sugirió N ejercicio(s) que no existen..." aparece y el resto del borrador se sigue mostrando. Si no se puede provocar de forma realista en esta pasada, dejarlo anotado como pendiente de observar en uso real — no bloquea el resto de la verificación.

---

## Self-review

**Cobertura del spec:**
- Workflow n8n nuevo, sin tocar los existentes → Task 1. ✓
- Entrada/salida del webhook con la forma exacta del spec → Task 1, Step 3. ✓
- IA solo elige del catálogo maestro (`exerciseNames` cerrado) → Task 1 (prompt) + Task 3 (`matchDraftExercisesToCatalog`, descarta lo que no casa). ✓
- Motivo efímero, no se persiste → Task 7, Step 5 (comentario explícito de por qué no se incluye). ✓
- 3ª pestaña que rellena "Crear nueva" (no vista comparativa aparte) → Task 7, Steps 2-3. ✓
- `handleSave` extendido con los 4 campos de prescripción → Task 7, Step 5. ✓
- Efecto colateral intencional sobre la creación manual documentado (no cambia comportamiento visible) → mismo Step 5, siguen guardándose `null` si no vienen informados. ✓
- Env var `VITE_N8N_ROUTINE_DRAFT_WEBHOOK_URL`, mismo naming que la de 2.2 → Task 5. ✓
- Manejo de errores (timeout/red, JSON mal formado, ejercicios sin match, 0 ejercicios) → Task 6 (`handleGenerate` catch + chequeo `matched.length === 0`). ✓
- Testing: solo funciones puras extraíbles, resto verificación manual → Tasks 2-3 (tests reales) + Task 8 (navegador). ✓

**Placeholders:** ninguno — código completo en cada step. El Task 1 (n8n) no tiene código de workflow pre-escrito porque su sintaxis exacta depende de tools en vivo (`get_workflow_sdk_reference`, `get_node_types`) — no es un placeholder de pereza, es la única forma correcta de construir un workflow n8n sin arriesgar tipos de nodo inventados; el resto de la tarea (estructura de 3 nodos, prompt, forma del JSON, payload de prueba) está completo.

**Consistencia de tipos:** `selectedExercises` mantiene la misma forma en todo el plan — `{catalog_id, name, image_url, series, reps, target_weight, target_rir, rest_seconds, notes, motivo}` — desde que `matchDraftExercisesToCatalog` los crea (Task 3) hasta que `SelectedExerciseList` los renderiza (Task 7, Step 4) y `handleSave` los inserta (Task 7, Step 5). `motivo` viaja en el objeto en memoria pero nunca llega al insert, consistente con la decisión del spec.
