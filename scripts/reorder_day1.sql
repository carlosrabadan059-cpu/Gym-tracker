-- Actualizar el orden de los ejercicios para el Día 1 (Pecho / Bíceps)
-- 1. Press de Banca (ID 101)
UPDATE exercises SET ui_order = 1 WHERE routine_id = 'day1' AND id = 101;
-- 2. Press Inclinado con Barra (ID 102)
UPDATE exercises SET ui_order = 2 WHERE routine_id = 'day1' AND id = 102;
-- 3. Press Declinado Inverso (ID 103)
UPDATE exercises SET ui_order = 3 WHERE routine_id = 'day1' AND id = 103;
-- 4. Aperturas en Máquina (ID 10) - Detrás del press declinado inverso
UPDATE exercises SET ui_order = 4 WHERE routine_id = 'day1' AND id = 10;
-- 5. Curl con Barra (ID 201)
UPDATE exercises SET ui_order = 5 WHERE routine_id = 'day1' AND id = 201;
-- 6. Curl Martillo (ID 202)
UPDATE exercises SET ui_order = 6 WHERE routine_id = 'day1' AND id = 202;
-- 7. Curl Concentrado (ID 28) - Detrás del curl martillo
UPDATE exercises SET ui_order = 7 WHERE routine_id = 'day1' AND id = 28;
-- 8. Crunch Abdominal Inclinado (ID 84)
UPDATE exercises SET ui_order = 8 WHERE routine_id = 'day1' AND id = 84;
