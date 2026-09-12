# Quitar desglose de discos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar el desglose de discos ("N×kg + N×kg /lado") de `ExerciseDetailModal.jsx` — asumía siempre barra olímpica de 20kg, lo cual es incorrecto para máquinas/poleas y no se puede arreglar de forma fiable con los datos actuales del catálogo. El peso total en kg se mantiene intacto.

**Architecture:** Borrado puro — quitar `platesPerSide`/`formatPlates`/`BAR_KG`/`PLATES` de `src/lib/plates.js` (se quedan `estimate1RM`, `RPE_OPTIONS`, `rirFromRpe`, que siguen en uso) y su único call site en `src/views/ExerciseDetailModal.jsx`.

**Tech Stack:** React 19. Sin cambios de datos ni de tests (esas funciones nunca tuvieron cobertura de Vitest).

---

## Task 1: Quitar `platesPerSide`/`formatPlates` de `plates.js` y de `ExerciseDetailModal.jsx`

**Files:**
- Modify: `src/lib/plates.js`
- Modify: `src/views/ExerciseDetailModal.jsx`

- [ ] **Step 1: Confirmar que no hay más usos antes de borrar**

Run: `grep -rln "platesPerSide\|formatPlates\|BAR_KG\|PLATES\b" src/ | grep -v ".test.js"`
Expected: solo `src/lib/plates.js` y `src/views/ExerciseDetailModal.jsx` (si aparece algún otro archivo, PARAR y reportar antes de tocar nada — significa que el alcance es mayor del que dice este plan).

- [ ] **Step 2: Borrar `platesPerSide`, `formatPlates`, `BAR_KG`, `PLATES` de `plates.js`**

En `src/lib/plates.js`, el archivo completo hoy es:

```javascript
// Cálculo de discos por lado y 1RM estimado. Puro cliente, sin backend.
// v3 Fase A (docs/plan-gym-app-features.md). Prototipado en la rama
// prototype/logging-ui (variante A, "inline mínimo").

/** Peso de la barra olímpica estándar. */
export const BAR_KG = 20;

/** Discos disponibles por lado, de mayor a menor (kg). */
export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/**
 * Discos a poner POR LADO para alcanzar un peso total con la barra estándar.
 * Devuelve un array de kg (p.ej. [20, 20, 2.5]) o null si el peso no es
 * alcanzable exactamente con los discos disponibles (o es menor que la barra).
 */
export function platesPerSide(total) {
    if (!total || total < BAR_KG) return null;
    let perSide = (total - BAR_KG) / 2;
    const out = [];
    for (const p of PLATES) {
        while (perSide >= p - 0.001) {
            out.push(p);
            perSide = Math.round((perSide - p) * 100) / 100;
        }
    }
    return perSide > 0.01 ? null : out;
}

/** "2×20 + 1×2,5" a partir de [20, 20, 2.5]. '' si el array está vacío. */
export function formatPlates(plates) {
    if (!plates || !plates.length) return '';
    const counts = plates.reduce((acc, p) => ({ ...acc, [p]: (acc[p] || 0) + 1 }), {});
    return Object.entries(counts)
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .map(([p, n]) => `${n}×${String(p).replace('.', ',')}`)
        .join(' + ');
}

/**
 * 1RM estimado por la fórmula de Epley: peso × (1 + reps/30).
 * Redondeado a 1 decimal. null si falta peso o reps, o si son <= 0.
 */
export function estimate1RM(weight, reps) {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!w || !r || w <= 0 || r <= 0) return null;
    return Math.round(w * (1 + r / 30) * 10) / 10;
}

/** Opciones de RPE (esfuerzo percibido, 1-10) que se ofrecen tras la serie. */
export const RPE_OPTIONS = [6, 7, 8, 9, 10];

/**
 * RIR (repeticiones en reserva) aproximado a partir del RPE marcado por el
 * cliente tras una serie. Conversión estándar RIR = 10 - RPE — aproximada
 * a propósito (el RPE es una sensación, no una cuenta exacta de reps
 * restantes), de ahí el "≈" con que se presenta en la UI. null si no hay
 * rpe (es un dato opcional, el cliente puede no haberlo marcado).
 */
export function rirFromRpe(rpe) {
    if (rpe == null) return null;
    return 10 - rpe;
}
```

Reemplazar el archivo completo por:

```javascript
// 1RM estimado y RIR real aproximado. Puro cliente, sin backend.
// v3 Fase A (docs/plan-gym-app-features.md). El desglose de discos por lado
// que vivía aquí (platesPerSide/formatPlates) se quitó (Fase 4, 2026-09-12):
// asumía siempre barra olímpica de 20kg cargada por los dos lados, lo cual
// es incorrecto para máquinas de palanca/T-bar, poleas y prensas — y el
// catálogo de ejercicios no tiene ningún dato fiable para distinguir barra
// libre del resto (ver docs/superpowers/specs/2026-09-12-quitar-desglose-discos-design.md).

/**
 * 1RM estimado por la fórmula de Epley: peso × (1 + reps/30).
 * Redondeado a 1 decimal. null si falta peso o reps, o si son <= 0.
 */
export function estimate1RM(weight, reps) {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!w || !r || w <= 0 || r <= 0) return null;
    return Math.round(w * (1 + r / 30) * 10) / 10;
}

/** Opciones de RPE (esfuerzo percibido, 1-10) que se ofrecen tras la serie. */
export const RPE_OPTIONS = [6, 7, 8, 9, 10];

/**
 * RIR (repeticiones en reserva) aproximado a partir del RPE marcado por el
 * cliente tras una serie. Conversión estándar RIR = 10 - RPE — aproximada
 * a propósito (el RPE es una sensación, no una cuenta exacta de reps
 * restantes), de ahí el "≈" con que se presenta en la UI. null si no hay
 * rpe (es un dato opcional, el cliente puede no haberlo marcado).
 */
export function rirFromRpe(rpe) {
    if (rpe == null) return null;
    return 10 - rpe;
}
```

- [ ] **Step 3: Quitar el import en `ExerciseDetailModal.jsx`**

Cambiar la línea 4 de `src/views/ExerciseDetailModal.jsx`:

```javascript
import { platesPerSide, formatPlates, estimate1RM, RPE_OPTIONS } from '../lib/plates';
```

por:

```javascript
import { estimate1RM, RPE_OPTIONS } from '../lib/plates';
```

- [ ] **Step 4: Quitar la variable `plates` y su render**

Localizar (dentro del `.map` de series, cerca de la línea 814-817):

```javascript
                        {Array.from({ length: parseInt(exercise.series) || 3 }).map((_, i) => {
                          const set = setsData[i];
                          const plates = !isBodyweight && !isTimeBased ? platesPerSide(parseFloat(set?.weight)) : null;
                          const showPr = isSetPr(set);
```

Cambiar a:

```javascript
                        {Array.from({ length: parseInt(exercise.series) || 3 }).map((_, i) => {
                          const set = setsData[i];
                          const showPr = isSetPr(set);
```

Y localizar el bloque de render (cerca de la línea 860-870):

```jsx
                              {/* Discos por lado + badge de récord: texto fino, sin bloque propio */}
                              {(plates?.length > 0 || showPr) && (
                                <div className="flex items-center gap-2 pl-11 mt-1">
                                    {plates?.length > 0 && (
                                        <span className="text-[11px] text-text-secondary font-mono">
                                            {formatPlates(plates)} /lado
                                        </span>
                                    )}
                                    {showPr && (
                                        <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                                            <Trophy size={10} /> Récord estimado
                                        </span>
                                    )}
                                </div>
                              )}
```

Cambiar a:

```jsx
                              {/* Badge de récord: texto fino, sin bloque propio */}
                              {showPr && (
                                <div className="flex items-center gap-2 pl-11 mt-1">
                                    <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                                        <Trophy size={10} /> Récord estimado
                                    </span>
                                </div>
                              )}
```

- [ ] **Step 5: Ejecutar la suite y lint**

Run: `npm test`
Expected: PASS (mismo recuento que antes de este cambio — no había tests de `platesPerSide`/`formatPlates` que puedan romperse).

Run: `npx eslint src/lib/plates.js src/views/ExerciseDetailModal.jsx`
Expected: sin errores nuevos (este archivo tiene errores preexistentes de timers/`Date.now` no relacionados — confirmar que siguen siendo los mismos, no más).

- [ ] **Step 6: Commit**

```bash
git add src/lib/plates.js src/views/ExerciseDetailModal.jsx
git commit -m "$(cat <<'EOF'
fix(cliente): quitar desglose de discos por lado, asumía siempre barra de 20kg

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Verificación en navegador

**Files:** ninguno

- [ ] **Step 1: Verificar en el navegador (skill `run-rutinex`)**

Arrancar la app, entrar como cliente si hay credenciales, o como `admin@gymtracker.com` para al menos confirmar visualmente que `ExerciseDetailModal.jsx` sigue renderizando bien (peso total, RPE, badge de récord) sin la línea de discos y sin errores de consola. Si solo hay login de entrenador disponible, verificar leyendo el código con atención que la condición `showPr` es la única que queda controlando ese bloque, y que ninguna otra parte del archivo sigue referenciando `plates`/`platesPerSide`/`formatPlates`.

---

## Self-review

**Cobertura del spec:**
- Quitar `platesPerSide`, `formatPlates`, `BAR_KG`, `PLATES` de `plates.js`, mantener `estimate1RM`/`RPE_OPTIONS`/`rirFromRpe` → Task 1, Step 2. ✓
- Quitar el import y el único call site en `ExerciseDetailModal.jsx` → Task 1, Steps 3-4. ✓
- Badge de récord se mantiene, solo pierde el vecino de discos → Task 1, Step 4 (nuevo bloque conserva `showPr` intacto). ✓
- Sin cambios de BD/catálogo/`TrainerLibraryView.jsx` → ningún task los toca. ✓
- Sin tests que borrar → confirmado, no hay ningún `plates.test.js` con casos de `platesPerSide`/`formatPlates` (el archivo existente solo cubre `rirFromRpe`, que no se toca).

**Placeholders:** ninguno — código completo en cada step, incluyendo el archivo `plates.js` reescrito entero para evitar ambigüedad de "quita estas líneas de en medio".

**Consistencia de tipos:** `estimate1RM`, `RPE_OPTIONS`, `rirFromRpe` mantienen exactamente la misma firma antes y después — ningún otro archivo que los importe (`ExerciseDetailModal.jsx`, y `WorkoutDetailPanel.jsx` para `rirFromRpe`) necesita cambios.
