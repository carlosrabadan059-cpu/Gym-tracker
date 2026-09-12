# Fase 4 (final) — Comentarios bidireccionales por ejercicio

Parte de [docs/plan-trainer-improvements.md](../../plan-trainer-improvements.md), sección "Fase 4 — Seguimiento y feedback", sub-punto "Comentarios en dos direcciones". Con esto se cierra Fase 4 (RPE/RIR real del cliente queda fuera, depende de v3 Fase A, no hecha).

## Alcance

Hilo de comentarios de texto plano por ejercicio (`exercises.id`), visible
y editable desde el lado del cliente y del entrenador. Notificación real al
otro participante al postear (tabla `notifications` ya existente).

Fuera de alcance en esta iteración:
- Comentarios por sesión completa (`workout_logs`) — decidido en el
  brainstorming: no existe hoy ninguna pantalla de detalle de sesión para
  el cliente (solo gráficas agregadas en `StatisticsView.jsx`); construirla
  es un alcance mucho mayor. `exercises.id` es estable por rutina asignada
  y ya lo consume `ExerciseDetailModal.jsx` en el lado cliente y el editor
  inline de `ClientProfileView.jsx` en el lado entrenador — cero pantallas
  nuevas que construir.
- Editar o borrar comentarios — hilo append-only.
- Navegación al tocar la notificación — hoy ninguna notificación de la app
  navega a ningún sitio al tocarla (solo `markAsRead`), sería la primera
  vez. Se deja para cuando haga falta de verdad; por ahora la notificación
  solo informa, el usuario navega a Clientes/Rutinas por su cuenta.
- RPE/RIR real del cliente — depende de v3 Fase A, no hecha.

## Tabla nueva: `exercise_comments`

```sql
create table public.exercise_comments (
    id uuid primary key default gen_random_uuid(),
    exercise_id integer not null references public.exercises(id) on delete cascade,
    author_id uuid not null references auth.users(id),
    body text not null,
    created_at timestamptz not null default now()
);
```

## RLS — diseñada desde el principio con el patrón ya corregido

Tras el hallazgo de seguridad de esta misma Fase 4 (`is_trainer()` sin
comprobar la relación real entrenador-cliente), esta tabla nueva se diseña
ya bien, no se corrige después:

- Un **cliente** lee/escribe comentarios de un ejercicio si ese ejercicio
  pertenece a una rutina que tiene asignada (`assigned_routines`, vía
  `exercises.routine_id`).
- Un **entrenador** lee/escribe comentarios de un ejercicio si ese ejercicio
  pertenece a una rutina suya (`routines.trainer_id`, vía
  `exercises.routine_id`) — esto ya implica "solo sus propios clientes",
  porque las rutinas asignadas son siempre clones con `trainer_id` puesto
  (Fase 0.2, "clonar-siempre al asignar").
- En el `insert`, `author_id` se fuerza a `auth.uid()` — nadie puede postear
  en nombre de otro.

## UI

Componente nuevo y compartido `src/components/shared/ExerciseCommentThread.jsx`:
lista de comentarios (burbuja "Tú" vs. la otra parte, orden cronológico) +
input de texto para añadir uno. Sin markdown, sin edición — texto plano.

Usado en dos sitios que ya existen, sin pantallas nuevas:
- `ExerciseDetailModal.jsx` (cliente): nueva sección bajo el bloque
  "Objetivo del entrenador" de la Fase 1.
- El editor inline de ejercicio en `ClientProfileView.jsx` (entrenador):
  mismo sitio donde ya edita peso/RIR/descanso/tempo/notas (Fase 1).

## Notificaciones

Al postear un comentario, se inserta una fila en `notifications` para el
**otro** participante (si comenta el cliente, notifica al entrenador; si
comenta el entrenador, notifica al cliente): `title: "Nuevo comentario en
{nombre del ejercicio}"`, `message`: el texto del comentario, `type:
'comment'`. Reusa la tabla y la suscripción Realtime que ya existen
(`NotificationsContext.jsx`) — cero infraestructura nueva.

`NotificationsListView.jsx` gana un `case 'comment'` en `getIcon()` (icono
💬 o `MessageCircle` de lucide-react) — un caso más en un `switch` que ya
existe, no una reestructuración.

## Fuera de alcance (explícito, recapitulando)

- Comentarios por sesión completa.
- Editar/borrar comentarios.
- Navegación al tocar la notificación.
- RPE/RIR real.
- Cualquier cambio a `support_messages` (sigue siendo el buzón genérico de
  soporte, sin relación con esto).
