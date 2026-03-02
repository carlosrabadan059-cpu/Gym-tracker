-- Insert Aperturas en Máquina (ID 10) into Day 1
INSERT INTO exercises (id, routine_id, name, series, reps, image_url, ui_order)
VALUES (10, 'day1', 'Aperturas en Máquina', '3', '10', '/exercises/futures-pecho-contractora.png', 4)
ON CONFLICT (id) DO UPDATE SET 
    routine_id = EXCLUDED.routine_id,
    name = EXCLUDED.name,
    series = EXCLUDED.series,
    reps = EXCLUDED.reps,
    image_url = EXCLUDED.image_url,
    ui_order = EXCLUDED.ui_order;

-- Insert Curl Concentrado (ID 28) into Day 1
INSERT INTO exercises (id, routine_id, name, series, reps, image_url, ui_order)
VALUES (28, 'day1', 'Curl Concentrado', '3', '10', '/exercises/futures-biceps-curl-concentrado.png', 7)
ON CONFLICT (id) DO UPDATE SET 
    routine_id = EXCLUDED.routine_id,
    name = EXCLUDED.name,
    series = EXCLUDED.series,
    reps = EXCLUDED.reps,
    image_url = EXCLUDED.image_url,
    ui_order = EXCLUDED.ui_order;
