-- ============================================================
-- Añadir columna sort_order a la tabla routines
-- Permite ordenar los días de forma explícita (Día 1 → Día 5)
-- sin depender del nombre ni del id autogenerado.
-- ============================================================

-- 1. Añadir la columna (nullable para no romper filas existentes)
ALTER TABLE public.routines
  ADD COLUMN IF NOT EXISTS sort_order integer;

-- 2. Rellenar sort_order en las filas existentes extrayendo el número del nombre
--    Ejemplo: "Día 1 - Pecho / Hombro" → 1
UPDATE public.routines
SET sort_order = (regexp_match(name, '\d+'))[1]::integer
WHERE sort_order IS NULL
  AND name ~ '\d+';

-- 3. Las filas sin número en el nombre quedan como NULL (irán al final)

-- 4. Índice para acelerar consultas ordenadas
CREATE INDEX IF NOT EXISTS idx_routines_sort_order ON public.routines (sort_order NULLS LAST);
