-- ============================================================
-- Restaurar Ejercicio 24: Remo con Mancuerna → Rutina Day 3
-- (Single-arm dumbbell row)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Corregir nombre e imagen en el catálogo para el ejercicio 24
UPDATE exercise_catalog
SET name      = 'Remo con Mancuerna',
    image_url = '/exercises/futures_dorsal_remo_mancuerna_horizontal_final.png'
WHERE id = 24;

-- 2. Hacer hueco: desplazar hacia abajo los ejercicios de day3 con ui_order >= 4
--    para que los ejercicios de Tríceps y posteriores queden en la posición correcta
UPDATE exercises
SET ui_order = ui_order + 1
WHERE routine_id = 'day3'
  AND ui_order >= 4;

-- 3. Insertar Remo con Mancuerna (ID 24) en day3 en la posición 4
--    (tras los 3 ejercicios dorsales principales, antes que los de tríceps)
INSERT INTO exercises (id, routine_id, name, series, reps, image_url, ui_order)
VALUES (
    24,
    'day3',
    'Remo con Mancuerna',
    '3',
    '10',
    '/exercises/futures_dorsal_remo_mancuerna_horizontal_final.png',
    4
)
ON CONFLICT (id) DO UPDATE SET
    routine_id = EXCLUDED.routine_id,
    name       = EXCLUDED.name,
    series     = EXCLUDED.series,
    reps       = EXCLUDED.reps,
    image_url  = EXCLUDED.image_url,
    ui_order   = EXCLUDED.ui_order;

-- 4. Verificar el resultado final de day3
SELECT id, name, series, reps, ui_order
FROM exercises
WHERE routine_id = 'day3'
ORDER BY ui_order;
