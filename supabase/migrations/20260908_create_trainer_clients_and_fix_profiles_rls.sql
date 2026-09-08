-- Fase 0.1 del plan de entrenador: hoy `profiles` no tiene dueño.
--
-- Hallazgo al revisar las políticas antes de tocar nada: el agujero es peor
-- de lo que decía el plan. Sigue activa una política heredada
-- "Public profiles are viewable by everyone." (qual: true) junto a la más
-- nueva "Trainers can read all profiles" — en RLS de Postgres las políticas
-- permisivas se combinan con OR, así que esa antigua anula a la nueva: hoy
-- CUALQUIER usuario autenticado, no solo entrenadores, puede leer todos los
-- perfiles. Y la propia "Trainers can read all profiles" es también
-- demasiado ancha: cualquier entrenador ve a cualquier cliente, no solo a
-- los suyos.
create table if not exists public.trainer_clients (
    id uuid primary key default gen_random_uuid(),
    trainer_id uuid not null references auth.users(id) on delete cascade,
    client_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (trainer_id, client_id)
);

alter table public.trainer_clients enable row level security;

create policy "Trainers can view own clients"
on public.trainer_clients for select
to authenticated
using (trainer_id = auth.uid());

create policy "Clients can view their trainer link"
on public.trainer_clients for select
to authenticated
using (client_id = auth.uid());

create policy "Trainers can add clients"
on public.trainer_clients for insert
to authenticated
with check (trainer_id = auth.uid() and is_trainer());

create policy "Trainers can remove clients"
on public.trainer_clients for delete
to authenticated
using (trainer_id = auth.uid());

create index if not exists trainer_clients_trainer_id_idx on public.trainer_clients(trainer_id);
create index if not exists trainer_clients_client_id_idx on public.trainer_clients(client_id);

-- Backfill: la única fuente fiable de "quién es cliente de quién" hoy es
-- quién le asignó una rutina a quién. assigned_by es siempre un entrenador
-- (la RLS de insert en assigned_routines ya lo exige).
insert into public.trainer_clients (trainer_id, client_id)
select distinct assigned_by, client_id
from public.assigned_routines
where assigned_by is not null and client_id is not null
on conflict (trainer_id, client_id) do nothing;

-- Cierra el agujero real: fuera la política heredada que dejaba a
-- cualquiera leer cualquier perfil, y fuera la que dejaba a cualquier
-- entrenador leer cualquier perfil. Sustituidas por: cada uno ve el suyo,
-- un entrenador ve los perfiles de sus propios clientes (via
-- trainer_clients), y un cliente ve el perfil de su propio entrenador.
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Trainers can read all profiles" on public.profiles;

create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (user_id = auth.uid());

create policy "Trainers can read own clients profiles"
on public.profiles for select
to authenticated
using (
    exists (
        select 1 from public.trainer_clients tc
        where tc.trainer_id = auth.uid() and tc.client_id = profiles.user_id
    )
);

create policy "Clients can read own trainer profile"
on public.profiles for select
to authenticated
using (
    exists (
        select 1 from public.trainer_clients tc
        where tc.client_id = auth.uid() and tc.trainer_id = profiles.user_id
    )
);

-- Búsqueda controlada para "Añadir cliente": un entrenador necesita poder
-- encontrar un cliente ANTES de tener fila en trainer_clients (si no, es
-- imposible enlazar a nadie nuevo con la RLS ya cerrada). En vez de abrir
-- profiles otra vez, una función security definer que solo devuelve
-- username/avatar de clientes SIN entrenador todavía, y solo a quien ya es
-- entrenador.
create or replace function public.search_addable_clients(search_term text)
returns table (user_id uuid, username text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
    select p.user_id, p.username, p.avatar_url
    from public.profiles p
    where is_trainer()
        and p.role = 'client'
        and (search_term = '' or p.username ilike '%' || search_term || '%')
        and not exists (
            select 1 from public.trainer_clients tc where tc.client_id = p.user_id
        )
    order by p.username
    limit 20
$$;

revoke all on function public.search_addable_clients(text) from public;
grant execute on function public.search_addable_clients(text) to authenticated;

-- "Hazlo como si fuese entrenador personal": un cliente tiene un único
-- entrenador, no varios. search_addable_clients() ya asumía esto (solo
-- ofrece clientes sin ninguna fila en trainer_clients), pero no estaba
-- forzado en la base de datos.
alter table public.trainer_clients
add constraint trainer_clients_client_id_key unique (client_id);
