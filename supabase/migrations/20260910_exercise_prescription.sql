-- Fase 1 del plan de entrenador (docs/plan-trainer-improvements.md):
-- prescripción completa por ejercicio, no solo series y reps.
--
-- Decisiones (2026-09-10): peso objetivo en kg absolutos (el % de 1RM se
-- deja para más adelante), intensidad como RIR (repeticiones en reserva).
--
-- Todos los campos son opcionales — un ejercicio sin prescripción se
-- comporta exactamente como hasta ahora.

alter table public.exercises
    add column if not exists target_weight numeric,        -- kg objetivo
    add column if not exists target_rir smallint,          -- repeticiones en reserva (0-5)
    add column if not exists rest_seconds integer,         -- descanso prescrito entre series
    add column if not exists tempo text,                   -- p.ej. "3-1-2"
    add column if not exists notes text;                   -- indicaciones ("codos pegados")

comment on column public.exercises.target_weight is 'Peso objetivo en kg (Fase 1). Null = sin prescribir.';
comment on column public.exercises.target_rir is 'Repeticiones en reserva objetivo, 0-5 (Fase 1).';
comment on column public.exercises.rest_seconds is 'Descanso prescrito entre series, en segundos (Fase 1).';
comment on column public.exercises.tempo is 'Tempo de la repetición, p.ej. 3-1-2 (Fase 1).';
comment on column public.exercises.notes is 'Indicaciones técnicas del entrenador por ejercicio (Fase 1).';
