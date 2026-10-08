-- Borradores de rutina: el entrenador prepara una rutina para un cliente y
-- el cliente no la ve hasta que se envía. Ver
-- docs/superpowers/specs/2026-10-08-borradores-plantillas-design.md.
--
-- sent_at nulo = borrador. El default now() hace que cualquier inserción que
-- no lo indique siga siendo una rutina enviada, como hasta ahora.

alter table public.assigned_routines
    add column if not exists sent_at timestamptz default now();

comment on column public.assigned_routines.sent_at is
    'Cuándo se envió al cliente. Nulo = borrador: el cliente no la ve.';

-- Las asignaciones existentes ya estaban enviadas.
update public.assigned_routines set sent_at = assigned_at where sent_at is null;

-- Policies antiguas abiertas a cualquier usuario con sesión (leer, crear y
-- borrar asignaciones de cualquiera). Las acotadas a cada entrenador y a cada
-- cliente ya existen y cubren todos los usos de la app.
drop policy if exists "Anyone authenticated can view assigned routines" on public.assigned_routines;
drop policy if exists "Authenticated users can insert assigned routines" on public.assigned_routines;
drop policy if exists "Authenticated users can delete assigned routines" on public.assigned_routines;

-- El cliente solo ve lo enviado; el entrenador, todo lo de sus clientes.
drop policy if exists "Users can read own or own clients assigned_routines" on public.assigned_routines;
create policy "Users can read own sent or own clients assigned_routines"
    on public.assigned_routines for select to authenticated
    using (
        (client_id = auth.uid() and sent_at is not null)
        or exists (
            select 1 from public.trainer_clients tc
            where tc.trainer_id = auth.uid() and tc.client_id = assigned_routines.client_id
        )
    );

-- Enviar un borrador = actualizar sent_at.
drop policy if exists "Trainers can update assigned_routines of own clients" on public.assigned_routines;
create policy "Trainers can update assigned_routines of own clients"
    on public.assigned_routines for update to authenticated
    using (
        exists (
            select 1 from public.trainer_clients tc
            where tc.trainer_id = auth.uid() and tc.client_id = assigned_routines.client_id
        )
    )
    with check (
        is_trainer() and exists (
            select 1 from public.trainer_clients tc
            where tc.trainer_id = auth.uid() and tc.client_id = assigned_routines.client_id
        )
    );
