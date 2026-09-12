# Comentarios bidireccionales por ejercicio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cliente y entrenador pueden dejarse comentarios de texto plano por ejercicio (`exercises.id`), visibles en los dos sitios donde ese ejercicio ya se edita/consulta hoy, con notificación real al otro participante.

**Architecture:** Tabla nueva `exercise_comments` con RLS basada en `assigned_routines`/`routines.trainer_id` (mismo patrón que la migración de seguridad de esta misma Fase 4). Un componente compartido `ExerciseCommentThread.jsx` encapsula fetch + render + insert y se monta en `ExerciseDetailModal.jsx` (cliente) y en el editor inline de `ClientProfileView.jsx` (entrenador). La construcción del payload de notificación vive en una función pura testeable (`src/lib/exerciseComments.js`) para no depender de un mock de Supabase en el test.

**Tech Stack:** React 19, Supabase JS client + Supabase MCP (`apply_migration`, `get_advisors`) para la migración, Vitest para la función pura, `run-rutinex` para verificación visual final.

---

## Task 1: Tabla `exercise_comments` y RLS

**Files:**
- Create: `supabase/migrations/20260912_create_exercise_comments.sql`

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/20260912_create_exercise_comments.sql`:

```sql
create table public.exercise_comments (
    id uuid primary key default gen_random_uuid(),
    exercise_id integer not null references public.exercises(id) on delete cascade,
    author_id uuid not null references auth.users(id),
    body text not null,
    created_at timestamptz not null default now()
);

alter table public.exercise_comments enable row level security;

create index exercise_comments_exercise_id_created_at_idx
on public.exercise_comments(exercise_id, created_at);

-- Un cliente lee/escribe comentarios de un ejercicio si ese ejercicio
-- pertenece a una rutina que tiene asignada. Mismo patrón que la migración
-- 20260912_scope_trainer_policies_to_own_clients.sql (trainer_clients /
-- assigned_routines como fuente de verdad, nunca is_trainer() a secas).
create policy "Clients can read comments on their assigned exercises"
on public.exercise_comments for select
to authenticated
using (
    exists (
        select 1 from public.exercises ex
        join public.assigned_routines ar on ar.routine_id = ex.routine_id
        where ex.id = exercise_comments.exercise_id
          and ar.client_id = auth.uid()
    )
);

create policy "Clients can comment on their assigned exercises"
on public.exercise_comments for insert
to authenticated
with check (
    author_id = auth.uid()
    and exists (
        select 1 from public.exercises ex
        join public.assigned_routines ar on ar.routine_id = ex.routine_id
        where ex.id = exercise_comments.exercise_id
          and ar.client_id = auth.uid()
    )
);

-- Un entrenador lee/escribe comentarios de un ejercicio si ese ejercicio
-- pertenece a una rutina suya (routines.trainer_id). Las rutinas asignadas
-- son siempre clones con trainer_id puesto (Fase 0.2, "clonar-siempre al
-- asignar"), así que esto ya implica "solo sus propios clientes".
create policy "Trainers can read comments on their own routines"
on public.exercise_comments for select
to authenticated
using (
    exists (
        select 1 from public.exercises ex
        join public.routines r on r.id = ex.routine_id
        where ex.id = exercise_comments.exercise_id
          and r.trainer_id = auth.uid()
    )
);

create policy "Trainers can comment on their own routines"
on public.exercise_comments for insert
to authenticated
with check (
    author_id = auth.uid()
    and exists (
        select 1 from public.exercises ex
        join public.routines r on r.id = ex.routine_id
        where ex.id = exercise_comments.exercise_id
          and r.trainer_id = auth.uid()
    )
);
```

No hay políticas de `update`/`delete`: el hilo es append-only por diseño (fuera de alcance del spec).

- [ ] **Step 2: Aplicar la migración con el MCP de Supabase**

Llamar a la tool `mcp__supabase__apply_migration` con:
- `project_id`: `jqpyqqlkgisykgywilrf`
- `name`: `create_exercise_comments`
- `query`: el contenido completo del archivo del Step 1

Esto la aplica directamente a producción (mismo proceder que la migración de seguridad anterior de esta Fase 4) — la tabla es nueva, no hay datos existentes que puedan romperse.

- [ ] **Step 3: Verificar advisors de seguridad**

Llamar a `mcp__supabase__get_advisors` con `project_id: jqpyqqlkgisykgywilrf` y `type: security`. Confirmar que no aparece ningún aviso nuevo relacionado con `exercise_comments`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260912_create_exercise_comments.sql
git commit -m "$(cat <<'EOF'
feat(entrenador): tabla exercise_comments con RLS por relación real

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Payload de notificación (función pura + test)

**Files:**
- Create: `src/lib/exerciseComments.js`
- Create: `src/lib/exerciseComments.test.js`

- [ ] **Step 1: Escribir el test primero**

Crear `src/lib/exerciseComments.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { buildCommentNotificationPayload } from './exerciseComments';

describe('buildCommentNotificationPayload', () => {
    it('arma la fila de notifications para el destinatario, con type comment', () => {
        const payload = buildCommentNotificationPayload({
            recipientId: 'user-123',
            exerciseName: 'Press banca',
            body: 'Sube el peso la próxima serie',
        });

        expect(payload).toEqual({
            user_id: 'user-123',
            title: 'Nuevo comentario en Press banca',
            message: 'Sube el peso la próxima serie',
            type: 'comment',
        });
    });
});
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- exerciseComments`
Expected: FAIL — `./exerciseComments` no existe todavía.

- [ ] **Step 3: Implementar**

Crear `src/lib/exerciseComments.js`:

```javascript
// Construye la fila de `notifications` para el otro participante de un hilo
// de comentarios de ejercicio. Función pura y testeable a propósito: separa
// "qué se notifica" (aquí) de "cuándo se dispara" (ExerciseCommentThread.jsx,
// que sí toca Supabase).
export function buildCommentNotificationPayload({ recipientId, exerciseName, body }) {
    return {
        user_id: recipientId,
        title: `Nuevo comentario en ${exerciseName}`,
        message: body,
        type: 'comment',
    };
}
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npm test -- exerciseComments`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/exerciseComments.js src/lib/exerciseComments.test.js
git commit -m "$(cat <<'EOF'
feat(entrenador): función pura para el payload de notificación de comentarios

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Componente compartido `ExerciseCommentThread`

**Files:**
- Create: `src/components/shared/ExerciseCommentThread.jsx`

- [ ] **Step 1: Crear el componente**

Crear `src/components/shared/ExerciseCommentThread.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { buildCommentNotificationPayload } from '../../lib/exerciseComments';

// Hilo de comentarios de texto plano por ejercicio (exercises.id). Append-only
// a propósito (Fase 4 del plan de entrenador): sin editar ni borrar. Se monta
// en dos sitios que ya existen — ExerciseDetailModal.jsx (cliente) y el editor
// inline de ClientProfileView.jsx (entrenador) — cada uno le pasa quién es el
// destinatario de la notificación (recipientId) y cómo llamar al otro lado
// (counterpartLabel), porque ninguno de los dos sabe resolver al otro por sí
// mismo sin una query adicional que aquí no hace falta.
export function ExerciseCommentThread({ exerciseId, exerciseName, recipientId, counterpartLabel }) {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);

    const fetchComments = useCallback(async () => {
        const { data, error } = await supabase
            .from('exercise_comments')
            .select('*')
            .eq('exercise_id', exerciseId)
            .order('created_at', { ascending: true });
        if (!error) setComments(data || []);
        setLoading(false);
    }, [exerciseId]);

    useEffect(() => { fetchComments(); }, [fetchComments]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = body.trim();
        if (!trimmed || sending) return;
        setSending(true);
        try {
            const { error } = await supabase.from('exercise_comments').insert({
                exercise_id: exerciseId,
                author_id: user.id,
                body: trimmed,
            });
            if (error) throw error;

            if (recipientId) {
                const payload = buildCommentNotificationPayload({ recipientId, exerciseName, body: trimmed });
                await supabase.from('notifications').insert(payload);
            }

            setBody('');
            await fetchComments();
        } catch (err) {
            console.error('Error posting exercise comment:', err);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Comentarios</p>

            {loading ? (
                <p className="text-xs text-text-secondary">Cargando…</p>
            ) : comments.length === 0 ? (
                <p className="text-xs text-text-secondary">Sin comentarios todavía.</p>
            ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {comments.map((c) => {
                        const isMine = c.author_id === user.id;
                        return (
                            <div key={c.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isMine ? 'bg-primary text-black' : 'bg-surface-highlight text-text-primary'}`}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 mb-0.5">
                                        {isMine ? 'Tú' : counterpartLabel}
                                    </p>
                                    <p>{c.body}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                    type="text"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Escribe un comentario…"
                    className="flex-1 bg-background border border-surface-highlight rounded-full px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
                />
                <button
                    type="submit"
                    disabled={!body.trim() || sending}
                    className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                >
                    <Send size={14} className="text-black" />
                </button>
            </form>
        </div>
    );
}
```

El `onClick={(e) => e.stopPropagation()}` del contenedor evita que escribir o mandar un comentario dispare el `onClick` de colapsar/expandir de la fila del ejercicio en `ClientProfileView.jsx` (Task 5).

- [ ] **Step 2: Verificar lint**

Run: `npx eslint src/components/shared/ExerciseCommentThread.jsx`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/ExerciseCommentThread.jsx
git commit -m "$(cat <<'EOF'
feat(entrenador): componente ExerciseCommentThread compartido

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Montar el hilo en `ExerciseDetailModal.jsx` (cliente)

**Files:**
- Modify: `src/views/ExerciseDetailModal.jsx`
- Modify: `src/views/OtherViews.jsx`

- [ ] **Step 1: Importar el componente en `ExerciseDetailModal.jsx`**

En `src/views/ExerciseDetailModal.jsx`, junto a los imports existentes (línea 1-9), añadir:

```javascript
import { ExerciseCommentThread } from '../components/shared/ExerciseCommentThread';
```

- [ ] **Step 2: Aceptar `trainerId` como prop**

En la firma del componente (línea 20):

```javascript
export const ExerciseDetailModal = ({ exercise, initialLog, lastLog, bestOneRm = null, isCompleted, onClose, savedTimerState, onTimerStateChange, trainerId = null }) => {
```

- [ ] **Step 3: Renderizar el hilo bajo el bloque "Objetivo del entrenador"**

Justo después del bloque `{hasPrescription && (...)}` (líneas 660-692) y antes del bloque `{/* Referencia Última Vez */}` (línea 694), añadir:

```jsx
                    {/* Comentarios del entrenador sobre este ejercicio (Fase 4) */}
                    <div className="rounded-2xl bg-surface-highlight p-4 border border-surface-highlight">
                        <ExerciseCommentThread
                            exerciseId={exercise.id}
                            exerciseName={exercise.name}
                            recipientId={trainerId}
                            counterpartLabel="Entrenador"
                        />
                    </div>
```

- [ ] **Step 4: Pasar `trainerId` desde `OtherViews.jsx`**

En `src/views/OtherViews.jsx`, en el `<ExerciseDetailModal ... />` (línea ~421), añadir la prop usando el `trainer_id` que ya viene en el objeto `workout` (la rutina, seleccionada con `select('*')` en `DashboardView.jsx` — ya incluye la columna `trainer_id`, null en rutinas legacy sin entrenador):

```jsx
                <ExerciseDetailModal
                    exercise={activeExercise}
                    initialLog={exerciseLogs[String(activeExercise.id)]}
                    lastLog={lastExerciseLogs[String(activeExercise.id)] ?? null}
                    bestOneRm={exerciseBest1RM[String(activeExercise.id)] ?? null}
                    isCompleted={completedExercises[String(activeExercise.id)]}
                    onClose={handleExerciseModalClose}
                    savedTimerState={timerStates[activeExercise.id]}
                    onTimerStateChange={(state) =>
                        setTimerStates(prev => ({ ...prev, [activeExercise.id]: state }))
                    }
                    trainerId={workout?.trainer_id ?? null}
                />
```

- [ ] **Step 5: Verificar lint**

Run: `npx eslint src/views/ExerciseDetailModal.jsx src/views/OtherViews.jsx`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add src/views/ExerciseDetailModal.jsx src/views/OtherViews.jsx
git commit -m "$(cat <<'EOF'
feat(cliente): hilo de comentarios por ejercicio en ExerciseDetailModal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Montar el hilo en el editor inline de `ClientProfileView.jsx` (entrenador)

**Files:**
- Modify: `src/views/trainer/ClientProfileView.jsx`

- [ ] **Step 1: Importar el componente**

En `src/views/trainer/ClientProfileView.jsx`, junto a los imports existentes (línea 1-10), añadir:

```javascript
import { ExerciseCommentThread } from '../../components/shared/ExerciseCommentThread';
```

- [ ] **Step 2: Renderizar el hilo dentro del bloque de edición**

En el bloque `{isEditing && (...)}` (líneas 627-660), después del `<label>` de "Notas" (que cierra en la línea 658) y antes del `</div>` que cierra el grid (línea 659), añadir:

```jsx
                                                                        <div className="col-span-2 pt-2 border-t border-surface-highlight/60">
                                                                            <ExerciseCommentThread
                                                                                exerciseId={ex.id}
                                                                                exerciseName={ex.name}
                                                                                recipientId={client.user_id}
                                                                                counterpartLabel="Cliente"
                                                                            />
                                                                        </div>
```

El resultado queda así (línea 653 en adelante, sin cambios en las líneas anteriores):

```jsx
                                                                        <label className="col-span-2 flex flex-col gap-1 text-[10px] uppercase tracking-wide text-text-secondary">
                                                                            Notas
                                                                            <textarea rows={2} value={editingExercise.notes}
                                                                                onChange={(e) => setEditingExercise(p => ({ ...p, notes: e.target.value }))}
                                                                                className="bg-surface border border-surface-highlight rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary resize-none" placeholder="Indicaciones técnicas…" />
                                                                        </label>
                                                                        <div className="col-span-2 pt-2 border-t border-surface-highlight/60">
                                                                            <ExerciseCommentThread
                                                                                exerciseId={ex.id}
                                                                                exerciseName={ex.name}
                                                                                recipientId={client.user_id}
                                                                                counterpartLabel="Cliente"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}
```

`client.user_id` ya está disponible en el `scope` de `ClientProfileView` (es la prop `client` del componente, línea 32) — no hace falta ninguna query nueva para saber a quién notificar.

- [ ] **Step 3: Verificar lint**

Run: `npx eslint src/views/trainer/ClientProfileView.jsx`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add src/views/trainer/ClientProfileView.jsx
git commit -m "$(cat <<'EOF'
feat(entrenador): hilo de comentarios por ejercicio en el editor inline

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Icono de notificación para comentarios

**Files:**
- Modify: `src/views/NotificationsListView.jsx`

- [ ] **Step 1: Añadir el case y el import del icono**

En `src/views/NotificationsListView.jsx`, cambiar el import (línea 4):

```javascript
import { Bell, Trophy, Info, X, Check, MessageCircle } from 'lucide-react';
```

Y añadir un case en `getIcon` (líneas 10-16):

```javascript
    const getIcon = (type) => {
        switch (type) {
            case 'achievement': return <Trophy size={20} className="text-yellow-500" />;
            case 'reminder': return <Bell size={20} className="text-primary" />;
            case 'comment': return <MessageCircle size={20} className="text-primary" />;
            default: return <Info size={20} className="text-blue-500" />;
        }
    };
```

- [ ] **Step 2: Verificar lint**

Run: `npx eslint src/views/NotificationsListView.jsx`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/views/NotificationsListView.jsx
git commit -m "$(cat <<'EOF'
feat(notificaciones): icono para comentarios de ejercicio

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Verificación final en navegador

**Files:** ninguno (solo verificación, sin cambios de código)

- [ ] **Step 1: Ejecutar toda la suite**

Run: `npm test`
Expected: PASS, incluyendo los nuevos tests de `exerciseComments.test.js`.

- [ ] **Step 2: Lint completo**

Run: `npm run lint`
Expected: mismo recuento de errores preexistentes que antes de este plan (el de `DashboardView.jsx` `onSeeAll` sin usar), ninguno nuevo.

- [ ] **Step 3: Verificar en el navegador (skill `run-rutinex`)**

Arrancar la app, entrar como `admin@gymtracker.com` (entrenador), ir a Clientes → Carlos → expandir una rutina → editar un ejercicio (icono lápiz) → comprobar que aparece la sección "Comentarios" bajo las Notas, con el input para escribir. Escribir un comentario de prueba tipo "Prueba Fase 4 — ignorar" y enviarlo — comprobar que aparece en el hilo alineado a la derecha como "Tú".

**Importante (regla de producción de este repo):** Carlos es el único usuario real. Un comentario de prueba en `exercise_comments` es una fila nueva en una tabla nueva, no una modificación de sus `workout_logs` ni de sus `exercises` — está permitido, a diferencia de pulsar Guardar/Asignar sobre sus datos de entreno. Si se prefiere no dejar ni eso, verificar solo que el formulario y el hilo renderizan bien sin enviar nada, y confirmar visualmente el layout.

Después, entrar como cliente (si hay credenciales disponibles) o, si no las hay, verificar leyendo el código con atención que `ExerciseDetailModal.jsx` recibe `trainerId` correctamente desde `OtherViews.jsx` y que el hilo se monta bajo "Objetivo del entrenador".

- [ ] **Step 4: Limpiar dato de prueba si se insertó**

Si se insertó un comentario de prueba en el Step 3, borrarlo con `mcp__supabase__execute_sql`:

```sql
delete from public.exercise_comments where body = 'Prueba Fase 4 — ignorar';
```

(Esto es una fila de comentario de prueba, no un dato de entreno de Carlos — permitido limpiarla).

---

## Self-review

**Cobertura del spec:**
- Tabla `exercise_comments` con columnas exactas del spec → Task 1. ✓
- RLS diseñada desde el principio con `assigned_routines`/`routines.trainer_id`, sin `is_trainer()` a secas → Task 1. ✓
- `author_id` forzado a `auth.uid()` en insert → Task 1 (`with check (author_id = auth.uid() and ...)`). ✓
- Componente compartido `ExerciseCommentThread.jsx`, burbujas "Tú" vs otra parte, sin markdown/edición → Task 3. ✓
- Montado en `ExerciseDetailModal.jsx` bajo "Objetivo del entrenador" → Task 4. ✓
- Montado en el editor inline de `ClientProfileView.jsx` → Task 5. ✓
- Notificación real al otro participante reusando `notifications` + Realtime existente → Task 3 (`ExerciseCommentThread` inserta en `notifications`; `NotificationsContext.jsx` no se toca porque su suscripción ya cubre cualquier insert nuevo). ✓
- `case 'comment'` en `NotificationsListView.jsx` → Task 6. ✓
- Nada de edición/borrado de comentarios → sin policies de update/delete, sin UI para ello. ✓
- Nada de navegación al tocar notificación → no se toca `markAsRead`/onClick de `NotificationsListView.jsx` más que el icono. ✓
- Nada de comentarios por sesión completa (`workout_logs`) → ningún task lo toca. ✓
- Nada de cambios a `support_messages` → ningún task lo toca. ✓

**Placeholders:** ninguno — código completo en cada step.

**Consistencia de tipos:** `exerciseId` es siempre `exercise.id` (integer, columna real de `exercises`). `recipientId` es siempre un `uuid` de `auth.users` (o `null`): `trainerId` desde `workout.trainer_id` en el lado cliente, `client.user_id` en el lado entrenador — mismo nombre de prop (`recipientId`) en las dos integraciones de Task 4 y Task 5, definido una sola vez en Task 3. `buildCommentNotificationPayload` (Task 2) y su único call site (Task 3, dentro de `ExerciseCommentThread.jsx`) usan las mismas claves: `recipientId`, `exerciseName`, `body`.
