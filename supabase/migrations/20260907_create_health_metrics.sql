-- Datos de Apple Health/Watch, v2 Fase 0. Sigue el mismo patrón que
-- workout_logs: una fila por usuario y fecha, RLS por dueño.
create table if not exists public.health_metrics (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    date date not null,

    steps integer,
    weight numeric,
    active_energy numeric,
    resting_hr numeric,

    -- de dónde vino el dato ('healthkit' hoy; deja sitio para health_connect
    -- en Android o entrada manual, sin tener que migrar el esquema)
    source text not null default 'healthkit',

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (user_id, date, source)
);

alter table public.health_metrics enable row level security;

create policy "Users can read own health metrics"
on public.health_metrics for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own health metrics"
on public.health_metrics for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own health metrics"
on public.health_metrics for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists health_metrics_user_id_date_idx
on public.health_metrics(user_id, date desc);
