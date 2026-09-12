# RIR real vs prescrito Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En el detalle de una sesión pasada del cliente (`WorkoutDetailPanel.jsx`), el entrenador ve el RIR real aproximado (derivado del RPE que marcó el cliente) junto al RIR objetivo que él mismo prescribió — cierra el último punto pendiente de Fase 4.

**Architecture:** Función pura `rirFromRpe(rpe)` en `src/lib/plates.js` (mismo archivo que ya tiene `RPE_OPTIONS`) hace la conversión `10 - rpe`. `WorkoutDetailPanel.jsx` amplía su query de `exercises` para traer `target_rir` y usa `rirFromRpe` sobre el `rpe` que ya viaja en `setsData` — sin tablas ni columnas nuevas.

**Tech Stack:** React 19, Supabase JS client, Vitest.

---

## Task 1: Función pura `rirFromRpe`

**Files:**
- Modify: `src/lib/plates.js`
- Create: `src/lib/plates.test.js`

- [ ] **Step 1: Escribir los tests primero**

Crear `src/lib/plates.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { rirFromRpe } from './plates';

describe('rirFromRpe', () => {
    it('convierte RPE 10 (al fallo) en RIR 0', () => {
        expect(rirFromRpe(10)).toBe(0);
    });

    it('convierte RPE 8 en RIR 2', () => {
        expect(rirFromRpe(8)).toBe(2);
    });

    it('convierte RPE 6 (el más bajo de RPE_OPTIONS) en RIR 4', () => {
        expect(rirFromRpe(6)).toBe(4);
    });

    it('devuelve null si no hay rpe (undefined)', () => {
        expect(rirFromRpe(undefined)).toBeNull();
    });

    it('devuelve null si rpe es null', () => {
        expect(rirFromRpe(null)).toBeNull();
    });
});
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- plates`
Expected: FAIL — `rirFromRpe` no está exportado de `./plates` todavía.

- [ ] **Step 3: Implementar**

En `src/lib/plates.js`, añadir al final del archivo (después de `RPE_OPTIONS`):

```javascript
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

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npm test -- plates`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/plates.js src/lib/plates.test.js
git commit -m "$(cat <<'EOF'
feat(entrenador): función pura para RIR real aproximado a partir de RPE

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Mostrar RIR real y objetivo en `WorkoutDetailPanel.jsx`

**Files:**
- Modify: `src/views/trainer/WorkoutDetailPanel.jsx`

- [ ] **Step 1: Importar `rirFromRpe`**

En `src/views/trainer/WorkoutDetailPanel.jsx`, junto a los imports existentes (línea 1-5), añadir:

```javascript
import { rirFromRpe } from '../../lib/plates';
```

- [ ] **Step 2: Traer `target_rir` en la query de ejercicios**

Cambiar la query de la línea 23-26 (dentro de `fetchNames`):

```javascript
            const { data } = await supabase
                .from('exercises')
                .select('id, name, catalog_id, target_rir, exercise_catalog(name)')
                .in('id', ids.map(Number));
```

- [ ] **Step 3: Guardar `target_rir` en `nameMap`**

Cambiar el `data.forEach` de las líneas 29-32:

```javascript
            if (data) {
                data.forEach(ex => {
                    const resolvedName = ex.exercise_catalog?.name || ex.name;
                    nextNameMap[String(ex.id)] = { name: resolvedName, catalog_id: ex.catalog_id, target_rir: ex.target_rir ?? null };
                });
            }
```

(Las entradas que vienen de `STATIC_ID_TO_NAME`, para rutinas estáticas legacy, no tienen `target_rir` — quedan `undefined` al leerlas, que se trata igual que "sin prescribir".)

- [ ] **Step 4: Propagar `target_rir` en el `useMemo` de `exercises`**

Cambiar el bloque de las líneas 65-80 (dentro del `.map` de `Object.entries(entry.logs)`):

```javascript
            .map(([id, log]) => {
                const mapData = nameMap[id];
                let name = `Ejercicio antiguo (#${id})`;
                let catalog_id = null;
                let target_rir = null;

                if (mapData) {
                    name = (typeof mapData === 'string' ? mapData : mapData.name);
                    catalog_id = typeof mapData !== 'string' ? mapData.catalog_id : null;
                    target_rir = typeof mapData !== 'string' ? (mapData.target_rir ?? null) : null;
                }
                return {
                    id,
                    name,
                    catalog_id,
                    target_rir,
                    sets: Object.values(log.setsData || {}),
                };
            });
```

- [ ] **Step 5: Mostrar "objetivo RIR N" junto al nombre del ejercicio**

Cambiar la línea 128:

```jsx
                                <p className="font-semibold text-text-primary text-sm mb-3">
                                    {ex.name}
                                    {ex.target_rir != null && (
                                        <span className="font-normal text-text-secondary"> · objetivo RIR {ex.target_rir}</span>
                                    )}
                                </p>
```

- [ ] **Step 6: Mostrar "RIR real ≈M" en cada serie que tenga `rpe`**

Dentro del `doneSets.map((set, i) => {...})` (líneas 133-154), después del `<span>` de peso/reps (líneas 141-151) y antes de cerrar el `<div>` de la línea 152, añadir:

```jsx
                                                    {set.rpe != null && (
                                                        <span className="text-xs text-text-secondary">
                                                            · RIR real ≈{rirFromRpe(set.rpe)}
                                                        </span>
                                                    )}
```

El bloque completo de esa línea queda así (sin cambios en las partes ya existentes, solo el `<span>` nuevo añadido al final):

```jsx
                                            return (
                                                <div key={i} className="flex items-center gap-2">
                                                    <span className="text-xs text-text-secondary w-12">Serie {i + 1}</span>
                                                    <span className="text-xs font-mono font-bold text-text-primary">
                                                        {isBodyweightAbs || isTimeBased ? (
                                                            r > 0 ? `${r} ${isTimeBased ? 'min' : 'reps'}` : '—'
                                                        ) : (
                                                            <>
                                                                {w > 0 ? `${w} kg` : '—'}
                                                                {w > 0 && r > 0 ? ' × ' : ''}
                                                                {r > 0 ? `${r} reps` : ''}
                                                            </>
                                                        )}
                                                    </span>
                                                    {set.rpe != null && (
                                                        <span className="text-xs text-text-secondary">
                                                            · RIR real ≈{rirFromRpe(set.rpe)}
                                                        </span>
                                                    )}
                                                </div>
                                            );
```

- [ ] **Step 7: Verificar lint**

Run: `npx eslint src/views/trainer/WorkoutDetailPanel.jsx`
Expected: sin errores nuevos (este archivo tiene un error preexistente de `react-hooks/set-state-in-effect` en la línea 18, no relacionado con este cambio — confirmar que sigue siendo el único).

- [ ] **Step 8: Commit**

```bash
git add src/views/trainer/WorkoutDetailPanel.jsx
git commit -m "$(cat <<'EOF'
feat(entrenador): RIR real del cliente junto al objetivo en el detalle de sesión

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Verificación final en navegador

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Ejecutar toda la suite**

Run: `npm test`
Expected: PASS, incluyendo los nuevos tests de `plates.test.js`.

- [ ] **Step 2: Lint completo**

Run: `npm run lint`
Expected: mismo recuento de errores preexistentes que antes de este plan, ninguno nuevo introducido por los archivos tocados aquí (`plates.js`, `WorkoutDetailPanel.jsx`).

- [ ] **Step 3: Verificar en el navegador (skill `run-rutinex`)**

Arrancar la app, entrar como `admin@gymtracker.com` (entrenador), ir a Clientes → Carlos → Historial de Entrenamientos → abrir una sesión pasada que tenga series completadas. Comprobar:
- Si algún ejercicio de esa sesión tiene `target_rir` puesto, aparece "· objetivo RIR N" junto a su nombre.
- Si alguna serie de esa sesión tiene `rpe` guardado (dependerá de si Carlos lo marcó al entrenar — puede que ninguna sesión histórica lo tenga, ya que la captura de RPE es reciente), aparece "· RIR real ≈M" en esa línea.
- Si ninguna sesión real tiene `rpe` guardado todavía, no hay forma de ver el dato real en producción — en ese caso, verificar leyendo el código con atención que `set.rpe != null` es la condición correcta y que `rirFromRpe` ya está cubierto por sus propios tests unitarios (Task 1), que es la evidencia de que la lógica es correcta aunque no haya datos reales todavía para verla en pantalla.

Esto es solo lectura (`WorkoutDetailPanel.jsx` no tiene ningún botón de Guardar/editar) — no hay riesgo de tocar datos de Carlos.

---

## Self-review

**Cobertura del spec:**
- `RIR real ≈ 10 - RPE` → Task 1 (`rirFromRpe`). ✓
- `target_rir` añadido a la query de `WorkoutDetailPanel.jsx`, sin query/tabla nueva → Task 2, Step 2. ✓
- "objetivo RIR N" junto al nombre del ejercicio, solo si `target_rir` existe → Task 2, Step 5. ✓
- "RIR real ≈M" por serie, solo si esa serie tiene `rpe` → Task 2, Step 6. ✓
- Sin colores de alerta ni lógica de comparación añadida → ningún task la introduce, solo texto plano. ✓
- Nada en `ClientProfileView.jsx` ni en `ExerciseDetailModal.jsx` → ningún task los toca. ✓
- Rutinas estáticas legacy sin `target_rir` → cubierto explícitamente en Task 2, Step 3 (el comentario aclara que `STATIC_ID_TO_NAME` no lo tiene y se trata como "sin prescribir"). ✓

**Placeholders:** ninguno — código completo en cada step.

**Consistencia de tipos:** `rirFromRpe(rpe)` devuelve `number | null`, usado igual en su test (Task 1) y en su único call site (Task 2, Step 6: `set.rpe != null` antes de llamarlo, así que nunca recibe `null`/`undefined` en producción, pero la función los maneja igual por si se reutiliza en otro sitio). `target_rir` se nombra igual en `nameMap`, en el objeto `exercises` del `useMemo`, y en la columna real de la tabla `exercises` — ningún renombrado a mitad de camino.
