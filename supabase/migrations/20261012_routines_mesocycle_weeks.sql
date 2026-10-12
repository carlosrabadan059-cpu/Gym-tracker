-- Duración del mesociclo en semanas (nula = sin duración: se cuenta la
-- semana sin fin, como hasta ahora). Ver
-- docs/superpowers/specs/2026-10-12-duracion-mesociclo-design.md.
alter table public.routines
    add column if not exists mesocycle_weeks smallint
    check (mesocycle_weeks is null or mesocycle_weeks between 1 and 52);
