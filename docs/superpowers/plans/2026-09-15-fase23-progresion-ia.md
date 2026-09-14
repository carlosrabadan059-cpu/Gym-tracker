# Fase 2.3 — Progresión de ciclo con IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a trainer generate a 4-week `weekly_progression` table for one exercise with a single click, using AI grounded in that exercise's real recent history (weight/reps/RPE), instead of typing every week by hand.

**Architecture:** A new n8n workflow (`Gym_App_ProgressionSuggestion`), mirroring the existing `Gym_App_RoutineDraft` (Fase 2.1) pattern exactly (webhook → OpenAI structured output → respond). Two new pure functions in `src/lib/trainerUtils.js` summarize an exercise's real history and build the webhook payload. `ClientProfileView.jsx`'s existing per-exercise weekly-progression editor (built in Fase 3 parte 2) gains a "Sugerir con IA" button that calls the webhook and fills the table, showing each week's `motivo` — which is discarded (not persisted) when the trainer saves, same convention as Fase 2.1's `motivo`.

**Tech Stack:** React 19, Supabase, n8n (workflow + OpenAI node), Vitest.

---

## Task 1: Workflow n8n `Gym_App_ProgressionSuggestion`

**Files:** none in the repo — lives in the n8n instance (`n8n.rabadanhouse.space`, folder Gym `mFYxumQoAzC950ee`).

- [ ] **Step 1: Load the n8n protocol**

Invoke the `using-n8n-skills` skill before touching any `mcp__n8n-mcp__*` tool — mandatory entry point, covers which skill to use for nodes/expressions/validation.

- [ ] **Step 2: Load the SDK reference and best practices**

Call `get_workflow_sdk_reference`. Call `get_workflow_best_practices` with `technique="ai agent"` or the closest technique to "structured LLM call, no conversational memory" — if unclear, call with `technique="list"` first.

- [ ] **Step 3: Search and type the needed nodes**

`search_nodes` with queries: `"webhook"`, `"openai chat model"` (or `"OpenAI"`/`"message a model"`, whatever the search surfaces), `"respond to webhook"`. Workflow structure (3 nodes):

1. **Webhook** (trigger, POST) — receives this exact JSON:
```json
{
  "exerciseName": "Press de banca",
  "category": "Pecho",
  "clientGoal": "Hipertrofia",
  "level": "intermedio",
  "currentSeries": 4,
  "currentReps": 10,
  "currentTargetWeight": 60,
  "currentTargetRir": 2,
  "historySummary": "2026-09-01: 4×10 @57.5kg RPE7\n2026-09-08: 4×10 @60kg RPE8"
}
```

2. **OpenAI node** (model `gpt-4.1-mini`, credential `OpenAI Carlos` id `HeNfhfUfwAHOImZn`) — system prompt that:
   - Receives all 9 webhook fields.
   - Explains this is a personal trainer's assistant proposing a 4-week progression for ONE exercise, based on the client's real logged history (weight/reps/RPE) — RPE is "repeticiones en reserva inversas": higher RPE = closer to failure, so a session with RPE ≥ 9 across all sets means "don't add more load yet."
   - Requires the output to have EXACTLY 4 entries in `semanas`, `week` values 1 through 4 in order.
   - Requires a non-empty `motivo` per week explaining the reasoning in one sentence — this is shown to the trainer, never invented filler.
   - Requests JSON output with this exact shape:
     ```json
     {
       "semanas": [
         { "week": 1, "series": "number", "reps": "number", "target_weight": "number or null", "target_rir": "number or null (0-5)", "motivo": "string, one sentence" }
       ]
     }
     ```
   - If `historySummary` is the fallback "Sin historial..." string, bases the plan on `currentSeries`/`currentReps`/`currentTargetWeight`/`currentTargetRir` and the client's goal/level instead, and says so in `motivo`.
   - Uses the node's structured/JSON output mode if the node type supports it (confirm the exact parameter name with `get_node_types` on the specific node found — don't guess).

3. **Respond to Webhook** — returns the generated JSON as-is (parsed, not an escaped string).

For each chosen node, call `get_node_types` with its exact id (including `search_nodes` discriminators like `resource`/`operation` for the OpenAI node) before writing workflow code — never guess parameter names.

- [ ] **Step 4: Build the workflow**

Use `create_workflow_from_code` with the 3-node structure above, name `Gym_App_ProgressionSuggestion`, in folder `mFYxumQoAzC950ee`. Follow the exact syntax `get_workflow_sdk_reference` returned in Step 2 — not remembered syntax.

- [ ] **Step 5: Validate**

Call `validate_workflow` on the new workflow. If there are errors, consult the `n8n-validation-expert` skill before blindly "fixing" anything (to avoid patching an already-documented false positive).

- [ ] **Step 6: Test with a sample payload**

Call `test_workflow` (or `execute_workflow` if direct test isn't supported) with:

```json
{
  "exerciseName": "Press de banca",
  "category": "Pecho",
  "clientGoal": "Hipertrofia",
  "level": "intermedio",
  "currentSeries": 4,
  "currentReps": 10,
  "currentTargetWeight": 60,
  "currentTargetRir": 2,
  "historySummary": "2026-09-01: 4×10 @57.5kg RPE7\n2026-09-08: 4×10 @60kg RPE8"
}
```

Confirm the response has `semanas` as an array of exactly 4 objects, each with `week` (1-4, in order), `series`, `reps`, `target_weight`, `target_rir`, and a non-empty `motivo`.

- [ ] **Step 7: Publish**

`publish_workflow` to make it active. Note the resulting webhook URL — needed in Task 4 for `.env.local`/Vercel.

---

## Task 2: `src/lib/trainerUtils.js` — pure functions for the AI payload

**Files:**
- Modify: `src/lib/trainerUtils.js`
- Test: `src/lib/trainerUtils.test.js` (already exists, 17 tests from Fase 2.1 — extend it)

**Context:** `src/lib/utils.js` already exports `loadExerciseHistory(userId, exerciseName)`, returning `Array<{date, routineId, setsData}>` sorted most-recent-first (used today by the "Historial de Ejercicios" section in Estadísticas). `src/lib/progression.js`'s `suggestNextWeight` already has the "pick the sets at the highest weight moved that session" logic this task's summarizer reuses conceptually (not imported — it's a one-function file for a different purpose, this is a new self-contained summarizer).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/trainerUtils.test.js` (append; do not remove the existing 17 tests):

```js
import { summarizeExerciseHistoryForAI, buildProgressionSuggestionPayload } from './trainerUtils';

describe('summarizeExerciseHistoryForAI', () => {
    it('returns fallback text for empty or missing history', () => {
        expect(summarizeExerciseHistoryForAI([])).toBe('Sin historial de entrenamientos registrado para este ejercicio.');
        expect(summarizeExerciseHistoryForAI(null)).toBe('Sin historial de entrenamientos registrado para este ejercicio.');
    });

    it('summarizes a session with RPE', () => {
        const history = [{
            date: '2026-09-08T10:00:00Z',
            setsData: { 0: { weight: '60', reps: '10', rpe: 8 }, 1: { weight: '60', reps: '10', rpe: 7 } },
        }];
        expect(summarizeExerciseHistoryForAI(history)).toBe('2026-09-08: 2×10 @60kg RPE8');
    });

    it('summarizes a session without RPE, omitting the suffix', () => {
        const history = [{ date: '2026-09-01T10:00:00Z', setsData: { 0: { weight: '57.5', reps: '10' } } }];
        expect(summarizeExerciseHistoryForAI(history)).toBe('2026-09-01: 1×10 @57.5kg');
    });

    it('uses the highest-weight sets when a session mixes weights', () => {
        const history = [{
            date: '2026-09-05T10:00:00Z',
            setsData: { 0: { weight: '40', reps: '12' }, 1: { weight: '60', reps: '8', rpe: 9 } },
        }];
        expect(summarizeExerciseHistoryForAI(history)).toBe('2026-09-05: 1×8 @60kg RPE9');
    });

    it('skips a session with no valid sets, keeps the rest', () => {
        const history = [
            { date: '2026-09-01T10:00:00Z', setsData: { 0: { weight: '0', reps: '0' } } },
            { date: '2026-09-08T10:00:00Z', setsData: { 0: { weight: '60', reps: '10' } } },
        ];
        expect(summarizeExerciseHistoryForAI(history)).toBe('2026-09-08: 1×10 @60kg');
    });
});

describe('buildProgressionSuggestionPayload', () => {
    it('passes through all fields when provided', () => {
        const result = buildProgressionSuggestionPayload({
            exerciseName: 'Press de banca',
            category: 'Pecho',
            clientGoal: 'Hipertrofia',
            level: 'avanzado',
            currentSeries: 4,
            currentReps: 10,
            currentTargetWeight: 60,
            currentTargetRir: 2,
            historySummary: 'algo',
        });
        expect(result).toEqual({
            exerciseName: 'Press de banca',
            category: 'Pecho',
            clientGoal: 'Hipertrofia',
            level: 'avanzado',
            currentSeries: 4,
            currentReps: 10,
            currentTargetWeight: 60,
            currentTargetRir: 2,
            historySummary: 'algo',
        });
    });

    it('applies defaults when category/clientGoal/level are missing', () => {
        const result = buildProgressionSuggestionPayload({
            exerciseName: 'Sentadilla',
            currentSeries: 3,
            currentReps: 8,
            currentTargetWeight: null,
            currentTargetRir: null,
            historySummary: 'Sin historial de entrenamientos registrado para este ejercicio.',
        });
        expect(result.category).toBe('No especificado');
        expect(result.clientGoal).toBe('No especificado');
        expect(result.level).toBe('intermedio');
        expect(result.currentTargetWeight).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `TZ=UTC npx vitest run src/lib/trainerUtils.test.js`
Expected: FAIL — `summarizeExerciseHistoryForAI`/`buildProgressionSuggestionPayload` not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/trainerUtils.js`:

```js
/**
 * Resume el historial real de UN ejercicio (peso/reps/RPE por sesión) en
 * texto plano para la IA de progresión (Fase 2.3). A diferencia de
 * summarizeWorkoutHistory (Fase 2.1, resume sesiones completas), esto
 * resume series de un solo ejercicio con su dato de intensidad real.
 *
 * @param {Array<{date: string, setsData: object}>} history  de loadExerciseHistory (utils.js), más reciente primero
 * @returns {string}
 */
export function summarizeExerciseHistoryForAI(history) {
    const fallback = 'Sin historial de entrenamientos registrado para este ejercicio.';
    if (!history || history.length === 0) return fallback;

    const lines = [];
    for (const entry of history) {
        const sets = Object.values(entry.setsData || {})
            .map(s => ({
                weight: parseFloat(s.weight),
                reps: parseInt(s.reps, 10),
                rpe: s.rpe != null ? Number(s.rpe) : null,
            }))
            .filter(s => s.weight > 0 && s.reps > 0);

        if (sets.length === 0) continue;

        // Peso de trabajo = el más alto movido esa sesión (mismo criterio
        // que src/lib/progression.js usa para la sugerencia de próxima sesión).
        const topWeight = Math.max(...sets.map(s => s.weight));
        const topSets = sets.filter(s => s.weight === topWeight);
        const minReps = Math.min(...topSets.map(s => s.reps));
        const maxRpe = topSets.reduce((m, s) => (s.rpe != null && s.rpe > m ? s.rpe : m), 0);

        const dateOnly = entry.date ? entry.date.slice(0, 10) : 'fecha desconocida';
        const rpeSuffix = maxRpe ? ` RPE${maxRpe}` : '';
        lines.push(`${dateOnly}: ${topSets.length}×${minReps} @${topWeight}kg${rpeSuffix}`);
    }

    return lines.length > 0 ? lines.join('\n') : fallback;
}

/**
 * Arma el cuerpo del POST al webhook `Gym_App_ProgressionSuggestion`
 * (Fase 2.3), con defaults en español para los campos que falten.
 */
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `TZ=UTC npx vitest run src/lib/trainerUtils.test.js`
Expected: PASS, 24 tests (17 existing + 7 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/trainerUtils.js src/lib/trainerUtils.test.js
git commit -m "feat(fase23): funciones puras para sugerencia de progresion con IA"
```

---

## Task 3: `ClientProfileView.jsx` — botón "Sugerir con IA"

**File:** `src/views/trainer/ClientProfileView.jsx`

**Context — read the current file in full first.** This task builds on the weekly-progression editor added in the calendario-semanal/mesociclo work (Fase 3 parte 2): `editingExercise` state already has `useWeeklyProgression` (bool) and `weeklyProgression` (array of `{week, series, reps, target_weight, target_rir}` rows), set up in `startEditExercise`, with `addProgressionWeek`/`removeProgressionWeek`/`updateProgressionRow` helpers and a checkbox + table rendered in the edit form.

- [ ] **Step 1: Extend imports**

Add `useRef` to the React import, add `loadExerciseHistory` to the `../../lib/utils` import, and add a new import for the two Task 2 functions:

Find:
```js
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { enrichExercisesWithCatalog } from '../../lib/utils';
import { deleteClientRoutineCopy } from '../../lib/trainerUtils';
```

Replace with:
```js
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { enrichExercisesWithCatalog, loadExerciseHistory } from '../../lib/utils';
import { deleteClientRoutineCopy, summarizeExerciseHistoryForAI, buildProgressionSuggestionPayload } from '../../lib/trainerUtils';
```

Also add `Sparkles` to the `lucide-react` import list if it isn't already there (check the existing import line — `Sparkles` is already imported in this file for the "Revisar con IA" button, so this should be a no-op; confirm by reading the file rather than assuming).

- [ ] **Step 2: Add a request timeout constant**

Right after the imports (before the `Stepper` function), add:

```js
const PROGRESSION_SUGGESTION_TIMEOUT_MS = 30000;
```

- [ ] **Step 3: Seed `name` and `category` on `editingExercise`**

`startEditExercise` currently seeds `id`, `assignmentId`, `series`, `reps`, `target_weight`, `target_rir`, `rest_seconds`, `tempo`, `notes`, `useWeeklyProgression`, `weeklyProgression`. Add `name: ex.name` and `category: ex.category` to that object (needed to call the AI webhook without having to look the exercise back up by id later). Find the `setEditingExercise({` call inside `startEditExercise` and add these two lines right after `id: ex.id,`:

```js
            id: ex.id,
            name: ex.name,
            category: ex.category,
            assignmentId,
```

- [ ] **Step 4: Add history-fetching state and effect**

Right after the `editingExercise`/`savingEdit` state declarations (`const [editingExercise, setEditingExercise] = useState(null); const [savingEdit, setSavingEdit] = useState(false);`), add:

```js
    const [editingExerciseHistory, setEditingExerciseHistory] = useState(null);
    const [suggestingProgression, setSuggestingProgression] = useState(false);
    const [suggestionError, setSuggestionError] = useState('');
    const isMountedForSuggestionRef = useRef(true);

    useEffect(() => {
        isMountedForSuggestionRef.current = true;
        return () => { isMountedForSuggestionRef.current = false; };
    }, []);

    // Fase 2.3: historial real de este ejercicio, para decidir si el botón
    // "Sugerir con IA" tiene datos suficientes y para resumirlo en el
    // payload. Se recarga cada vez que se abre un ejercicio distinto.
    useEffect(() => {
        if (!editingExercise) {
            setEditingExerciseHistory(null);
            return;
        }
        let cancelled = false;
        setEditingExerciseHistory(null);
        loadExerciseHistory(client.user_id, editingExercise.name).then((history) => {
            if (!cancelled) setEditingExerciseHistory(history);
        });
        return () => { cancelled = true; };
    }, [editingExercise?.id, editingExercise?.name, client.user_id]);
```

- [ ] **Step 5: Add `handleSuggestProgression`**

Right after `removeProgressionWeek`/`updateProgressionRow` (the row-management helpers added for the weekly-progression table), add:

```js
    const handleSuggestProgression = async () => {
        const webhookUrl = import.meta.env.VITE_N8N_PROGRESSION_SUGGESTION_WEBHOOK_URL;
        if (!webhookUrl) {
            setSuggestionError('Falta configurar VITE_N8N_PROGRESSION_SUGGESTION_WEBHOOK_URL.');
            return;
        }

        setSuggestingProgression(true);
        setSuggestionError('');

        let controller;
        let timer;
        try {
            const historySummary = summarizeExerciseHistoryForAI(editingExerciseHistory || []);
            const payload = buildProgressionSuggestionPayload({
                exerciseName: editingExercise.name,
                category: editingExercise.category,
                clientGoal: client.goal,
                level: 'intermedio',
                currentSeries: editingExercise.series,
                currentReps: editingExercise.reps,
                currentTargetWeight: editingExercise.target_weight === '' ? null : Number(editingExercise.target_weight),
                currentTargetRir: editingExercise.target_rir === '' ? null : Number(editingExercise.target_rir),
                historySummary,
            });

            controller = new AbortController();
            timer = setTimeout(() => controller.abort(), PROGRESSION_SUGGESTION_TIMEOUT_MS);
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            clearTimeout(timer);

            if (!response.ok) throw new Error('Respuesta HTTP ' + response.status);
            const data = await response.json();
            if (!isMountedForSuggestionRef.current) return;

            if (!Array.isArray(data.semanas) || data.semanas.length === 0) {
                setSuggestionError('La IA no devolvió ninguna semana. Inténtalo de nuevo.');
                return;
            }

            setEditingExercise(prev => ({
                ...prev,
                useWeeklyProgression: true,
                weeklyProgression: data.semanas.map(w => ({
                    week: w.week,
                    series: w.series,
                    reps: w.reps,
                    target_weight: w.target_weight ?? '',
                    target_rir: w.target_rir ?? '',
                    motivo: w.motivo || '',
                })),
            }));
        } catch (err) {
            clearTimeout(timer);
            if (!isMountedForSuggestionRef.current) return;
            console.error('Error sugiriendo progresión con IA:', err);
            setSuggestionError('No se pudo generar la sugerencia. Inténtalo de nuevo.');
        } finally {
            if (isMountedForSuggestionRef.current) setSuggestingProgression(false);
        }
    };
```

- [ ] **Step 6: Render the button next to the "Progresión por semanas" checkbox**

Find the checkbox added in Fase 3 parte 2:

```jsx
                                                                        <label className="col-span-2 flex items-center gap-2 text-[10px] uppercase tracking-wide text-text-secondary">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={editingExercise.useWeeklyProgression}
                                                                                onChange={(e) => setEditingExercise(p => ({ ...p, useWeeklyProgression: e.target.checked }))}
                                                                                className="accent-primary"
                                                                            />
                                                                            Progresión por semanas
                                                                        </label>
```

Replace with (adds the button and a disabled-reason on the same row, plus the error message right below):

```jsx
                                                                        <div className="col-span-2 flex items-center justify-between gap-2">
                                                                            <label className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-text-secondary">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={editingExercise.useWeeklyProgression}
                                                                                    onChange={(e) => setEditingExercise(p => ({ ...p, useWeeklyProgression: e.target.checked }))}
                                                                                    className="accent-primary"
                                                                                />
                                                                                Progresión por semanas
                                                                            </label>
                                                                            <button
                                                                                onClick={handleSuggestProgression}
                                                                                disabled={
                                                                                    suggestingProgression
                                                                                    || editingExerciseHistory === null
                                                                                    || (editingExercise.target_weight === '' && editingExerciseHistory.length === 0)
                                                                                }
                                                                                title={
                                                                                    editingExerciseHistory !== null && editingExercise.target_weight === '' && editingExerciseHistory.length === 0
                                                                                        ? 'Sin datos suficientes'
                                                                                        : undefined
                                                                                }
                                                                                className="flex items-center gap-1 text-[10px] font-bold text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                                                                            >
                                                                                <Sparkles size={11} />
                                                                                {suggestingProgression ? 'Generando...' : 'Sugerir con IA'}
                                                                            </button>
                                                                        </div>
                                                                        {suggestionError && (
                                                                            <p className="col-span-2 text-[10px] text-red-500">{suggestionError}</p>
                                                                        )}
```

- [ ] **Step 7: Show `motivo` under each progression row**

Find the row-rendering inside the `useWeeklyProgression` table (from Fase 3 parte 2):

```jsx
                                                                                {editingExercise.weeklyProgression.map((row) => (
                                                                                    <div key={row.week} className="flex items-center gap-1.5">
                                                                                        <span className="w-14 flex-shrink-0 text-[10px] text-text-secondary">Sem. {row.week}</span>
                                                                                        <input type="number" min="1" value={row.series}
```

(the full row continues with the reps/weight/RIR inputs and the remove button, unchanged). Wrap that whole per-row `<div className="flex items-center gap-1.5">...</div>` in an outer fragment that adds the `motivo` line below it:

```jsx
                                                                                {editingExercise.weeklyProgression.map((row) => (
                                                                                    <div key={row.week}>
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <span className="w-14 flex-shrink-0 text-[10px] text-text-secondary">Sem. {row.week}</span>
                                                                                            <input type="number" min="1" value={row.series}
                                                                                                onChange={(e) => updateProgressionRow(row.week, 'series', e.target.value)}
                                                                                                className="w-12 bg-surface border border-surface-highlight rounded-lg px-1.5 py-1 text-xs text-text-primary focus:outline-none focus:border-primary" placeholder="Ser." />
                                                                                            <input type="number" min="1" value={row.reps}
                                                                                                onChange={(e) => updateProgressionRow(row.week, 'reps', e.target.value)}
                                                                                                className="w-12 bg-surface border border-surface-highlight rounded-lg px-1.5 py-1 text-xs text-text-primary focus:outline-none focus:border-primary" placeholder="Reps" />
                                                                                            <input type="number" inputMode="decimal" value={row.target_weight}
                                                                                                onChange={(e) => updateProgressionRow(row.week, 'target_weight', e.target.value)}
                                                                                                className="w-16 bg-surface border border-surface-highlight rounded-lg px-1.5 py-1 text-xs text-text-primary focus:outline-none focus:border-primary" placeholder="Kg" />
                                                                                            <input type="number" min="0" max="5" value={row.target_rir}
                                                                                                onChange={(e) => updateProgressionRow(row.week, 'target_rir', e.target.value)}
                                                                                                className="w-12 bg-surface border border-surface-highlight rounded-lg px-1.5 py-1 text-xs text-text-primary focus:outline-none focus:border-primary" placeholder="RIR" />
                                                                                            <button
                                                                                                onClick={() => removeProgressionWeek(row.week)}
                                                                                                disabled={editingExercise.weeklyProgression.length === 1}
                                                                                                className="w-6 h-6 flex-shrink-0 rounded-md hover:bg-red-500/10 flex items-center justify-center disabled:opacity-20"
                                                                                            >
                                                                                                <X size={11} className="text-text-secondary hover:text-red-500" />
                                                                                            </button>
                                                                                        </div>
                                                                                        {row.motivo && (
                                                                                            <p className="text-[9px] text-text-secondary italic pl-16 mt-0.5">{row.motivo}</p>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
```

Read the actual current file to get the exact existing indentation/structure of this block before editing — this plan reproduces it as it stood after the Fase 3 parte 2 work, but confirm against the real file since whitespace must match exactly for a clean diff.

- [ ] **Step 8: Confirm `handleSaveEdit` already strips `motivo`**

`handleSaveEdit`'s `useWeeklyProgression` branch builds `weekly_progression` by mapping each row to `{ week: row.week, series: Number(row.series), reps: Number(row.reps), target_weight: numOrNull(row.target_weight), target_rir: numOrNull(row.target_rir) }` — an explicit new object, not a spread of `row`. Since `motivo` isn't one of those 5 keys, it's already excluded automatically. Read `handleSaveEdit` to confirm this is still true (it was written this way in the Fase 3 parte 2 plan) — no code change needed here, just verify.

- [ ] **Step 9: Run the full test suite**

Run: `TZ=UTC npm test`
Expected: all passing (124 total: 117 from before + 7 new in `trainerUtils.test.js`). No new tests for the `ClientProfileView.jsx` changes themselves — component/fetch code, same convention as `GenerateWithAiTab` in Fase 2.1, which also has no dedicated test file.

- [ ] **Step 10: Run lint**

Run: `npm run lint`
Expected: no NEW errors in `ClientProfileView.jsx` compared to `main` (pre-existing unrelated errors elsewhere are not a regression to fix here).

- [ ] **Step 11: Commit**

```bash
git add src/views/trainer/ClientProfileView.jsx
git commit -m "feat(fase23): boton sugerir progresion con IA por ejercicio"
```

---

## Task 4: Variable de entorno

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Document the new env var**

Add to `.env.example`, right after the existing `VITE_N8N_ROUTINE_DRAFT_WEBHOOK_URL` line (added in Fase 2.1):

```
VITE_N8N_PROGRESSION_SUGGESTION_WEBHOOK_URL=https://n8n.rabadanhouse.space/webhook/gym-app-progression-suggestion
```

Use the real webhook URL published in Task 1, Step 7, instead of the placeholder path shown here if it differs.

- [ ] **Step 2: Add the same line to `.env.local`**

Same variable, same real URL, in the local (untracked) `.env.local` file so local dev can call the webhook. Restart `npm run dev` afterward — Vite only reads env vars at startup.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs(fase23): documentar VITE_N8N_PROGRESSION_SUGGESTION_WEBHOOK_URL"
```

(`.env.local` is gitignored, nothing to commit there — just needed locally to verify Task 5.)

---

## Task 5: Verificación en navegador

**Files:** none (verification only, throwaway script)

**Context:** Same constraint as every prior verification pass (CLAUDE.md): only navigate and capture, never click anything that writes to Carlos's real account — in particular, never click the exercise editor's "Guardar" after generating a suggestion, since that would persist a real (if harmless) `weekly_progression` onto one of his real exercises.

- [ ] **Step 1: Start the dev server**

```bash
[ -d node_modules ] || npm install
nohup npm run dev > /tmp/rutinex-dev.log 2>&1 & disown
for i in $(seq 1 20); do curl -sf http://localhost:5173 >/dev/null 2>&1 && break; sleep 1; done
```

- [ ] **Step 2: Write a throwaway Playwright script at `tools/verify-fase23.local.mjs`**

Log in as `admin@gymtracker.com` / `admin123$$`, navigate to Carlos's profile, expand a routine, open the edit form on an exercise that has real logged history (check `WorkoutDetailPanel`/dashboard data from prior verification runs to pick one Carlos has actually trained, e.g. from "Dia 1 - Pecho / Hombro"). Confirm:
1. The "Sugerir con IA" button is enabled (not showing "Sin datos suficientes") for an exercise with either history or an existing `target_weight`.
2. Clicking it shows "Generando..." then fills the weekly-progression table with 4 rows, each showing a `motivo` line.
3. No console errors during the real webhook call.
4. **Do not click Guardar** — screenshot the filled table, then close the editor (click the X/cancel button) instead of saving.

- [ ] **Step 3: Review the screenshots and console output**

Confirm no console errors, the table fills with exactly 4 weeks, motivos are visible and non-empty.

- [ ] **Step 4: Clean up**

```bash
rm tools/verify-fase23.local.mjs
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
git checkout -- public/version.json 2>/dev/null
git status
```

Expected: clean working tree.

---

## Notes for the reviewer

- The `motivo` field lives only in React state (`editingExercise.weeklyProgression[i].motivo`) during the editing session — it is never written to Supabase. This mirrors the Fase 2.1 decision to show a draft's `motivo` during review but exclude it from the persisted `exercises` insert.
- `Gym_App_RoutineDraft`, `Gym_App_Trainer_Review`, and `Gym_App_Chat` are not touched by this plan — only the new `Gym_App_ProgressionSuggestion` workflow is created.
- Task 3's Step 6 disabled-condition reads `editingExercise.target_weight === '' && editingExerciseHistory.length === 0` — this only runs after the `editingExerciseHistory === null` (still loading) check has already short-circuited the `disabled` expression via `||`, so `editingExerciseHistory.length` is safe to read at that point (never null there). Preserve that ordering if refactoring.
