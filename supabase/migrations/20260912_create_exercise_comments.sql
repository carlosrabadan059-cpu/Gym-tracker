create table if not exists public.exercise_comments (
    id uuid primary key default gen_random_uuid(),
    exercise_id integer not null references public.exercises(id) on delete cascade,
    author_id uuid not null references auth.users(id) on delete cascade,
    body text not null,
    created_at timestamptz not null default now()
);

alter table public.exercise_comments enable row level security;

create index if not exists exercise_comments_exercise_id_created_at_idx
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

-- Sin políticas de update/delete: el hilo es append-only por diseño (fuera de alcance del spec de Fase 4).
