-- Músculos secundarios por ejercicio (v3 Fase C1). Hoy `category` guarda un
-- único grupo, así que un press de banca cuenta solo como Pecho e ignora que
-- carga tríceps y hombro — sin esto, el mapa de recuperación (C2) diría que
-- tienes el tríceps fresco el día después de 12 series de empuje.
--
-- text[] y no JSONB: es una lista plana de etiquetas de un vocabulario
-- cerrado (los mismos 8 grupos que ya usa `category`), y los operadores de
-- array de Postgres funcionan sin castings.
--
-- default '{}' y not null en vez de nullable: un ejercicio aislado como el
-- curl de bíceps legítimamente no tiene secundarios, así que "vacío" y "sin
-- etiquetar" se tratan igual y el código que lee no necesita distinguirlos.
alter table public.exercise_catalog
    add column secondary_muscles text[] not null default '{}';

-- Ver docs/superpowers/specs/2026-09-16-musculos-secundarios-design.md.
-- La regla "el grupo principal nunca aparece en secondary_muscles" se aplica
-- en código (normalizeSecondaryMuscles / isValidSecondaryProposal), no como
-- constraint: el vocabulario vive en el front y duplicarlo en SQL obligaría
-- a migrar la tabla cada vez que se toque la lista de grupos.
