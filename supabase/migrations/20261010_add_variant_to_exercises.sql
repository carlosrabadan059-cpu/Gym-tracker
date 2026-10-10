-- Variante del ejercicio indicada por el entrenador ("agarre cerrado",
-- "inclinado 30º"...). Texto libre, opcional. Ver
-- docs/superpowers/specs/2026-10-10-variante-ejercicio-design.md.
alter table public.exercises add column if not exists variant text;

comment on column public.exercises.variant is
    'Variante indicada por el entrenador, texto libre (p.ej. "agarre cerrado").';
