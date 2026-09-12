# Alerta de inactividad en lista de clientes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La lista de clientes del entrenador muestra un badge ⚠️ junto a cada cliente que lleva 7+ días sin entrenar (o nunca ha entrenado), calculado al vuelo, sin tabla `notifications` ni cron.

**Architecture:** `adherence.js` gana una constante `INACTIVITY_ALERT_DAYS`; `ClientsListView.jsx` añade una query de `workout_logs` (fecha más reciente por cliente) junto a las dos que ya hace, y renderiza el badge condicionalmente.

**Tech Stack:** React 19, Supabase JS client, Vitest (el repo ya lo tiene configurado desde la PR #17 — `npm test`, `TZ=UTC`, tests junto al código en `src/**/*.test.js`).

**Nota:** a diferencia de los planes anteriores de este mismo plan de mejoras (Fase 2.2, racha), este repo ya tiene Vitest configurado (mergeado después). Este plan usa tests reales de Vitest en vez de scripts Node desechables.

---

## Task 1: `INACTIVITY_ALERT_DAYS` y tests de `adherence.js`

**Files:**
- Modify: `src/lib/adherence.js`
- Create: `src/lib/adherence.test.js`

- [ ] **Step 1: Escribir los tests primero**

Crear `src/lib/adherence.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeStreak, computeDaysSinceLastSession, INACTIVITY_ALERT_DAYS } from './adherence';

// Miércoles fijo a mediodía UTC — ancla estable para todos los tests,
// evita que "hoy" cambie según cuándo se ejecute la suite (TZ=UTC forzado
// por el script `test` de package.json).
const ANCHOR = new Date('2026-01-15T12:00:00.000Z');

function isoDaysAgo(n) {
    const d = new Date(ANCHOR);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString();
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(ANCHOR);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('computeStreak', () => {
    it('cuenta racha viva de varios días seguidos', () => {
        expect(computeStreak([isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(2)])).toBe(3);
    });

    it('se corta en un hueco de más de un día', () => {
        expect(computeStreak([isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(4)])).toBe(2);
    });

    it('racha muerta (última sesión anteayer) devuelve 0, no la racha vieja', () => {
        expect(computeStreak([isoDaysAgo(2), isoDaysAgo(3), isoDaysAgo(4)])).toBe(0);
    });

    it('sin sesiones devuelve 0', () => {
        expect(computeStreak([])).toBe(0);
    });

    it('fechas duplicadas del mismo día cuentan una sola vez', () => {
        expect(computeStreak([isoDaysAgo(0), isoDaysAgo(0), isoDaysAgo(1)])).toBe(2);
    });

    it('racha viva empezando ayer (sin sesión hoy todavía) también cuenta', () => {
        expect(computeStreak([isoDaysAgo(1), isoDaysAgo(2), isoDaysAgo(3)])).toBe(3);
    });
});

describe('computeDaysSinceLastSession', () => {
    it('sesión hoy son 0 días', () => {
        expect(computeDaysSinceLastSession([isoDaysAgo(0)])).toBe(0);
    });

    it('sesión ayer es 1 día', () => {
        expect(computeDaysSinceLastSession([isoDaysAgo(1)])).toBe(1);
    });

    it('usa la fecha más reciente, no la primera del array', () => {
        expect(computeDaysSinceLastSession([isoDaysAgo(5), isoDaysAgo(2)])).toBe(2);
    });

    it('sin sesiones devuelve null', () => {
        expect(computeDaysSinceLastSession([])).toBeNull();
    });
});

describe('INACTIVITY_ALERT_DAYS', () => {
    it('es 7', () => {
        expect(INACTIVITY_ALERT_DAYS).toBe(7);
    });
});
```

- [ ] **Step 2: Ejecutar y confirmar que falla por la constante que aún no existe**

Run: `npm test -- adherence`
Expected: FAIL — `INACTIVITY_ALERT_DAYS` no está exportado de `./adherence` (el resto de tests de `computeStreak`/`computeDaysSinceLastSession` deberían pasar ya, porque esas funciones ya existen sin cambios).

- [ ] **Step 3: Añadir la constante**

En `src/lib/adherence.js`, añadir cerca del final del archivo (después de `computeDaysSinceLastSession`, o justo debajo de los imports/comentario de cabecera — cualquiera de los dos sitios es correcto, mantener el resto del archivo intacto):

```javascript
// Umbral a partir del cual "días sin entrenar" pasa de dato informativo a
// aviso de atención (ClientsListView). Vive aquí para que cualquier vista
// futura que quiera el mismo criterio lo reuse en vez de inventar el suyo.
export const INACTIVITY_ALERT_DAYS = 7;
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npm test -- adherence`
Expected: PASS — todos los tests de `adherence.test.js` en verde.

- [ ] **Step 5: Commit**

```bash
git add src/lib/adherence.js src/lib/adherence.test.js
git commit -m "$(cat <<'EOF'
test(entrenador): cubrir adherence.js y añadir umbral de inactividad

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Badge de inactividad en `ClientsListView`

**Files:**
- Modify: `src/views/trainer/ClientsListView.jsx`

- [ ] **Step 1: Importar el helper y la constante**

En `src/views/trainer/ClientsListView.jsx`, añadir junto a los imports existentes (línea 1-4):

```javascript
import { computeDaysSinceLastSession, INACTIVITY_ALERT_DAYS } from '../../lib/adherence';
```

- [ ] **Step 2: Añadir la query de `workout_logs` y calcular `daysSinceLastSession` por cliente**

Reemplazar el bloque actual de `fetchClients` (líneas ~19-37: desde `const { data: links, ...` hasta `setClients(profiles || []);`) por:

```javascript
            const { data: links, error: linksError } = await supabase
                .from('trainer_clients')
                .select('client_id')
                .eq('trainer_id', user.id);
            if (linksError) throw linksError;

            const clientIds = (links || []).map(l => l.client_id);
            if (clientIds.length === 0) {
                setClients([]);
                return;
            }

            const [
                { data: profiles, error: profilesError },
                { data: logs, error: logsError },
            ] = await Promise.all([
                supabase.from('profiles').select('*').in('user_id', clientIds),
                supabase.from('workout_logs').select('user_id, date').in('user_id', clientIds),
            ]);
            if (profilesError) throw profilesError;
            if (logsError) throw logsError;

            // Fecha más reciente de workout_logs por cliente, sin N+1 queries.
            const lastSessionByClient = {};
            (logs || []).forEach((log) => {
                const current = lastSessionByClient[log.user_id];
                if (!current || new Date(log.date) > new Date(current)) {
                    lastSessionByClient[log.user_id] = log.date;
                }
            });

            const clientsWithActivity = (profiles || []).map((profile) => ({
                ...profile,
                daysSinceLastSession: computeDaysSinceLastSession(
                    lastSessionByClient[profile.user_id] ? [lastSessionByClient[profile.user_id]] : []
                ),
            }));

            setClients(clientsWithActivity);
```

(El resto de la función — el `catch`/`finally` — no cambia.)

- [ ] **Step 3: Renderizar el badge**

En el `.map((client) => ...)` que renderiza cada tarjeta (buscar el bloque con `<h3 className={...}>{client.fullName || client.username}</h3>`), añadir el badge justo después del `<h3>` y antes (o en vez, ver nota) del `<p>` de subtítulo existente:

```jsx
                                <div className="min-w-0">
                                    <h3 className={`font-bold text-text-primary truncate ${embedded ? 'text-sm' : 'text-lg'}`}>{client.fullName || client.username}</h3>
                                    {(client.daysSinceLastSession === null || client.daysSinceLastSession >= INACTIVITY_ALERT_DAYS) && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-full mt-1">
                                            ⚠️ {client.daysSinceLastSession === null ? 'Sin sesiones' : `Hace ${client.daysSinceLastSession} días`}
                                        </span>
                                    )}
                                    {!embedded && <p className="text-xs text-text-secondary">Ver progreso y asignar rutinas</p>}
                                </div>
```

(El badge y el `<p>` "Ver progreso y asignar rutinas" pueden coexistir — el `<p>` solo se muestra en modo no-embedded, el badge se muestra siempre que aplique, en ambos modos.)

- [ ] **Step 4: Verificar lint**

Run: `npx eslint src/views/trainer/ClientsListView.jsx`
Expected: sin errores nuevos.

- [ ] **Step 5: Probar en el navegador (skill `run-rutinex`)**

Arrancar la app, entrar como entrenador (`admin@gymtracker.com` / `admin123$$`), ir a Clientes. Carlos tiene sesiones recientes (según la Fase 4 anterior, "Ayer") — con eso NO debería verse el badge (1 día < 7). Para comprobar que el badge sí aparece cuando corresponde, no hay forma de simular otro cliente inactivo sin datos falsos en producción — verificar en su lugar, leyendo el código con atención, que la condición `daysSinceLastSession === null || daysSinceLastSession >= INACTIVITY_ALERT_DAYS` es la correcta, y confirmar visualmente que con Carlos (que NO debe mostrar el badge) la lista se ve exactamente igual que antes de este cambio — es la evidencia negativa de que la condición no se dispara de más.

- [ ] **Step 6: Commit**

```bash
git add src/views/trainer/ClientsListView.jsx
git commit -m "$(cat <<'EOF'
feat(entrenador): badge de inactividad en la lista de clientes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review

**Cobertura del spec:**
- `INACTIVITY_ALERT_DAYS` en `adherence.js` → Task 1. ✓
- Query de `workout_logs` sin N+1, reducida a fecha más reciente por cliente → Task 2. ✓
- Badge visual con el texto correcto ("Sin sesiones" / "Hace N días"), sin tocar `notifications` → Task 2. ✓
- Nada de cron/scheduler/edge function nuevo → no aparece en ningún task. ✓
- `ClientProfileView.jsx` no se toca en este plan → confirmado, ningún task lo modifica. ✓

**Placeholders:** ninguno — código completo en cada step.

**Consistencia de tipos:** `computeDaysSinceLastSession` sigue recibiendo un array de fechas (aquí, de 0 o 1 elemento) igual que en su uso existente en `ClientProfileView.jsx` — mismo contrato, ninguna sobrecarga nueva de la función. `client.daysSinceLastSession` es el nombre de campo añadido en Task 2 y es el único sitio donde se lee o se escribe en este plan.
