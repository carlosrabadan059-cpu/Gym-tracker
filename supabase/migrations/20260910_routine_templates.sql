-- Fase 0.2 del plan de entrenador (docs/plan-trainer-improvements.md):
-- plantillas de rutina reutilizables + clonar-siempre al asignar.
--
-- Decisiones (2026-09-10):
--  - Al asignar una rutina a un cliente se CLONA (routine + exercises nuevos):
--    editar la rutina de un cliente nunca afecta a otro.
--  - El entrenador marca una rutina como plantilla con una estrella en la
--    lista de "Rutinas existentes".
--
-- Dos columnas nuevas en `routines`:
--  - is_template: el entrenador la marcó como plantilla reutilizable.
--  - owner_client_id: si está puesto, esta rutina es la copia privada de un
--    cliente concreto (resultado de un clon) y NO debe aparecer en la lista
--    de rutinas asignables.

alter table public.routines
    add column if not exists is_template boolean not null default false;

alter table public.routines
    add column if not exists owner_client_id uuid references auth.users(id) on delete cascade;

comment on column public.routines.is_template is
    'El entrenador la marcó como plantilla reutilizable (Fase 0.2).';
comment on column public.routines.owner_client_id is
    'Si está puesto, es la copia privada de este cliente (clon). No aparece en la lista de rutinas asignables.';

create index if not exists routines_owner_client_id_idx on public.routines (owner_client_id);

-- Backfill: las rutinas custom asignadas hoy a UN solo cliente ya son de
-- hecho copias privadas — se marcan como tal para que salgan de la lista de
-- asignables. Las compartidas entre varios clientes se dejan como están para
-- que el entrenador decida (marcarlas plantilla o rehacerlas).
update public.routines r
set owner_client_id = ar.client_id
from public.assigned_routines ar
where ar.routine_id = r.id
  and r.trainer_id is not null
  and r.owner_client_id is null
  and (select count(*) from public.assigned_routines a2 where a2.routine_id = r.id) = 1;
