-- Fase 3 (parte 2) del plan de entrenador: mesociclo con progresión
-- programada. Depende de la parte 1 (scheduled_days, ya aplicada) solo en
-- el orden de las fases, no en el esquema.
--
-- Decisiones (2026-09-15, ver docs/superpowers/specs/2026-09-15-mesociclo-progresion-design.md):
--  - mesocycle_start_date vive en `routines` (no en assigned_routines):
--    cada rutina asignada ya es una copia privada por cliente, así que es
--    1:1 con la rutina, no con la relación de asignación.
--  - weekly_progression es un array JSON de
--    {week, series, reps, target_weight, target_rir} por ejercicio. No hay
--    tabla aparte por el mismo motivo que scheduled_days: sobre-ingeniería
--    para, como mucho, un puñado de filas sin relaciones propias.
--  - No hay columna de "duración del mesociclo" ni de fecha de fin: la
--    duración es implícita en cuántas semanas tenga cada
--    weekly_progression. Al superar la última semana definida, la app se
--    congela ahí (lógica en src/lib/mesocycle.js, no en la base de datos).

alter table public.routines add column if not exists mesocycle_start_date date;
alter table public.exercises add column if not exists weekly_progression jsonb;

comment on column public.routines.mesocycle_start_date is
    'Fecha de inicio del mesociclo de esta rutina asignada. Null = sin mesociclo (Fase 3 parte 2).';
comment on column public.exercises.weekly_progression is
    'Array [{week, series, reps, target_weight, target_rir}] por semana. Null o [] = sin progresión, usa las columnas base (Fase 3 parte 2).';
