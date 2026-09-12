# Racha y días sin entrenar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El perfil de un cliente (vista del entrenador) muestra racha de días consecutivos con sesión y días desde la última sesión, calculados de las sesiones ya cargadas — sin tocar Supabase.

**Architecture:** Un módulo puro (`src/lib/adherence.js`) calcula ambas métricas a partir de un array de fechas; `ClientProfileView.jsx` lo alimenta con `workoutHistory` (ya cargado) y añade dos tarjetas al grid de stats existente.

**Tech Stack:** React 19, JavaScript puro (sin librerías de fechas nuevas).

**Nota sobre tests:** este repo no tiene test runner configurado. La verificación de `adherence.js` usa un script Node de un solo uso con `console.assert`, igual que se hizo para `exerciseClassifier.js` en la Fase 2.2 de este mismo plan de mejoras.

---

## Task 1: `adherence.js` — racha y días sin entrenar

**Files:**
- Create: `src/lib/adherence.js`

- [ ] **Step 1: Escribir el módulo**

```javascript
// src/lib/adherence.js

// Compara por día calendario local, ignorando la hora — dos sesiones el
// mismo día (aunque a horas distintas) cuentan como un solo día para la
// racha.
function toDayKey(dateInput) {
    const d = new Date(dateInput);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function dayKeyToDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function addDays(date, delta) {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    return next;
}

// dates: array de fechas de sesiones (string ISO o Date), pueden repetirse
// o venir desordenadas. Racha = días consecutivos con sesión, contando
// hacia atrás desde hoy o ayer. Si la última sesión es de anteayer o antes,
// la racha está "muerta" y se devuelve 0 (no se muestra una racha vieja
// como si siguiera viva).
export function computeStreak(dates) {
    const daySet = new Set((dates || []).map(toDayKey));
    if (daySet.size === 0) return 0;

    const today = new Date();
    const todayKey = toDayKey(today);
    const yesterdayKey = toDayKey(addDays(today, -1));

    let cursor;
    if (daySet.has(todayKey)) {
        cursor = dayKeyToDate(todayKey);
    } else if (daySet.has(yesterdayKey)) {
        cursor = dayKeyToDate(yesterdayKey);
    } else {
        return 0;
    }

    let streak = 0;
    while (daySet.has(toDayKey(cursor))) {
        streak += 1;
        cursor = addDays(cursor, -1);
    }
    return streak;
}

// dates: array de fechas de sesiones (string ISO o Date).
// Devuelve días enteros desde la sesión más reciente hasta hoy, o null si
// no hay ninguna sesión.
export function computeDaysSinceLastSession(dates) {
    if (!dates || dates.length === 0) return null;

    const latestMs = dates.reduce((max, d) => {
        const t = new Date(d).getTime();
        return t > max ? t : max;
    }, -Infinity);

    const latestDay = dayKeyToDate(toDayKey(latestMs));
    const todayDay = dayKeyToDate(toDayKey(new Date()));

    const diffMs = todayDay.getTime() - latestDay.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
```

- [ ] **Step 2: Verificar con un script Node de un solo uso**

Crear temporalmente `<tu directorio de scratch>/verify-adherence.mjs` (ajusta la ruta de import a la ubicación real del repo en tu máquina):

```javascript
import { computeStreak, computeDaysSinceLastSession } from '/Volumes/SSD Externo/Proyectos/Antigravity/Gym-tracker/src/lib/adherence.js';

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

console.assert(computeStreak([daysAgo(0), daysAgo(1), daysAgo(2)]) === 3, 'racha de 3 días seguidos (hoy, ayer, anteayer)');
console.assert(computeStreak([daysAgo(0), daysAgo(1), daysAgo(4)]) === 2, 'racha se corta en el hueco de más de un día');
console.assert(computeStreak([daysAgo(2), daysAgo(3)]) === 0, 'racha muerta (última sesión anteayer, no hoy ni ayer) = 0');
console.assert(computeStreak([]) === 0, 'sin sesiones = racha 0');
console.assert(computeStreak([daysAgo(0), daysAgo(0), daysAgo(1)]) === 2, 'fechas duplicadas del mismo día cuentan una sola vez');
console.assert(computeStreak([daysAgo(1), daysAgo(2), daysAgo(3)]) === 3, 'racha viva empezando ayer (sin sesión hoy todavía) también cuenta');

console.assert(computeDaysSinceLastSession([daysAgo(0)]) === 0, 'sesión hoy = 0 días');
console.assert(computeDaysSinceLastSession([daysAgo(1)]) === 1, 'sesión ayer = 1 día');
console.assert(computeDaysSinceLastSession([daysAgo(5), daysAgo(2)]) === 2, 'usa la fecha más reciente, no la primera del array');
console.assert(computeDaysSinceLastSession([]) === null, 'sin sesiones = null');

console.log('OK — todas las aserciones pasaron');
```

Run: `node <tu directorio de scratch>/verify-adherence.mjs`
Expected: `OK — todas las aserciones pasaron` (si algún `console.assert` falla, imprime `Assertion failed: <mensaje>` a stderr — corregir `adherence.js` hasta que no aparezca ninguno).

- [ ] **Step 3: Borrar el script temporal**

Run: `rm <tu directorio de scratch>/verify-adherence.mjs`

- [ ] **Step 4: Commit**

```bash
git add src/lib/adherence.js
git commit -m "$(cat <<'EOF'
feat(entrenador): calcular racha y días sin entrenar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Tarjetas de racha y última sesión en `ClientProfileView`

**Files:**
- Modify: `src/views/trainer/ClientProfileView.jsx`

- [ ] **Step 1: Importar el helper y el icono nuevo**

En `src/views/trainer/ClientProfileView.jsx`, añadir al import de `lucide-react` (línea 6, ya tiene `Sparkles` de la Fase 2.2):

```javascript
import { ArrowLeft, PlusCircle, Activity, Dumbbell, ChevronRight, ChevronUp, ChevronDown, Trash2, Calendar, Clock, Edit2, Check, X, Minus, Plus, Pencil, Sparkles, Flame } from 'lucide-react';
```

Añadir junto a los demás imports de `../../lib/...`:

```javascript
import { computeStreak, computeDaysSinceLastSession } from '../../lib/adherence';
```

- [ ] **Step 2: Calcular racha y días sin entrenar a partir de `workoutHistory`**

Dentro de `export function ClientProfileView(...)`, junto a los demás `useMemo`/derivados (si no hay ninguno ya, añadir cerca de los `useState` iniciales, después de `const [selectedHistoryEntry, setSelectedHistoryEntry] = useState(null);`):

```javascript
const sessionDates = useMemo(() => workoutHistory.map((entry) => entry.date), [workoutHistory]);
const streak = useMemo(() => computeStreak(sessionDates), [sessionDates]);
const daysSinceLastSession = useMemo(() => computeDaysSinceLastSession(sessionDates), [sessionDates]);

const lastSessionLabel = historyLoading
    ? '—'
    : daysSinceLastSession === null
        ? 'Sin sesiones'
        : daysSinceLastSession === 0
            ? 'Hoy'
            : daysSinceLastSession === 1
                ? 'Ayer'
                : `Hace ${daysSinceLastSession} días`;
```

Añadir `useMemo` al import de React si no está ya importado (comprobar la línea 1 del archivo — hoy es `import { useState, useEffect } from 'react';`, hay que añadir `useMemo`):

```javascript
import { useState, useEffect, useMemo } from 'react';
```

- [ ] **Step 3: Añadir las dos tarjetas al grid de stats**

El grid de stats actual (línea ~366-387) tiene 2 tarjetas dentro de `<div className="grid grid-cols-2 gap-4">`. Añadir 2 tarjetas más como hijos del mismo grid, justo después de la tarjeta "Rutinas" y antes del `</div>` que cierra el grid:

```jsx
                        <div className="bg-surface p-4 rounded-2xl border border-surface-highlight flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-red-500">
                                <Flame size={18} />
                                <span className="font-bold text-xs uppercase tracking-wider">Racha</span>
                            </div>
                            <p className="text-2xl font-black text-text-primary">
                                {historyLoading ? '—' : streak}
                            </p>
                            <p className="text-xs text-text-secondary">días seguidos</p>
                        </div>
                        <div className="bg-surface p-4 rounded-2xl border border-surface-highlight flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-blue-400">
                                <Calendar size={18} />
                                <span className="font-bold text-xs uppercase tracking-wider">Última sesión</span>
                            </div>
                            <p className="text-lg font-black text-text-primary">
                                {lastSessionLabel}
                            </p>
                        </div>
```

(Nota: esta última tarjeta usa `text-lg` en vez de `text-2xl` porque su contenido es una frase ("Hace 12 días", "Sin sesiones"), no un número corto — evita que se desborde o se vea desproporcionado frente a las otras tres tarjetas.)

El grid ya es `grid-cols-2`, así que con 4 hijos queda automáticamente en 2 filas de 2 columnas — no hace falta tocar las clases del contenedor.

- [ ] **Step 4: Verificar lint**

Run: `npx eslint src/views/trainer/ClientProfileView.jsx`
Expected: sin errores nuevos causados por este cambio (el repo tiene lint preexistente en otros archivos, no relacionado).

- [ ] **Step 5: Probar en el navegador (skill `run-rutinex`)**

Arrancar la app, entrar como entrenador (`admin@gymtracker.com`), abrir el perfil de un cliente con historial de entrenamientos (Carlos, el único cliente real, tiene 20 sesiones registradas). Verificar: aparecen las 4 tarjetas (Sesiones, Rutinas, Racha, Última sesión) con valores coherentes con las fechas reales de `workout_logs`. Es de solo lectura — no hace falta evitar nada especial en la cuenta de Carlos, esta vista no escribe datos.

- [ ] **Step 6: Commit**

```bash
git add src/views/trainer/ClientProfileView.jsx
git commit -m "$(cat <<'EOF'
feat(entrenador): mostrar racha y última sesión en el perfil del cliente

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review

**Cobertura del spec:**
- `computeStreak`/`computeDaysSinceLastSession` puros, sin queries nuevas → Task 1. ✓
- Reusa las 20 sesiones ya cargadas, limitación documentada en comentarios → Task 1 (docstring del módulo) y en el spec. ✓
- UI solo en `ClientProfileView.jsx`, 2 tarjetas nuevas en el grid existente → Task 2. ✓
- Fuera de alcance (badge en `ClientsListView`, límite de 20 ampliado, campo de frecuencia objetivo) → no tocado en ningún task. ✓

**Placeholders:** ninguno — código completo en cada step.

**Consistencia de tipos:** `computeStreak(dates)`/`computeDaysSinceLastSession(dates)` reciben `array de fechas` en ambos tasks — Task 2 les pasa `sessionDates` (`workoutHistory.map(entry => entry.date)`), mismo tipo de entrada (fechas ISO string, tal como llegan de Supabase) que el script de verificación del Task 1 (objetos `Date`) — ambas funciones normalizan con `new Date(dateInput)`, que acepta los dos formatos por igual.
