-- Pack 1 (CORRECTED): Premium 'Futures Gym' Icons (17 exercises)
-- These IDs have been verified against catalog_dump.json

-- PECHO
UPDATE exercise_catalog SET image_url = '/exercises/futures-pecho-aperturas-laterales.png' WHERE id = 3;
UPDATE exercise_catalog SET image_url = '/exercises/futures-pecho-press-superior-mancuernas.png' WHERE id = 4;
UPDATE exercise_catalog SET image_url = '/exercises/futures-pecho-press-banca-plano-barra.png' WHERE id = 6;

-- DORSAL
UPDATE exercise_catalog SET image_url = '/exercises/futures-dorsal-jalon-ancho.png' WHERE id = 17;
UPDATE exercise_catalog SET image_url = '/exercises/futures-dorsal-remo-mancuerna.png' WHERE id = 20;
UPDATE exercise_catalog SET image_url = '/exercises/futures-dorsal-remo-polea-baja.png' WHERE id = 21;
UPDATE exercise_catalog SET image_url = '/exercises/futures-dorsal-face-pull.png' WHERE id = 56; -- Vuelos posterior

-- BICEPS
UPDATE exercise_catalog SET image_url = '/exercises/futures-biceps-curl-barra-recta.png' WHERE id = 26;
UPDATE exercise_catalog SET image_url = '/exercises/futures-biceps-curl-martillo.png' WHERE id = 27;

-- TRICEPS
UPDATE exercise_catalog SET image_url = '/exercises/futures-triceps-jalon-cuerda.png' WHERE id = 39;

-- HOMBRO
UPDATE exercise_catalog SET image_url = '/exercises/futures-hombro-press-militar-mancuernas.png' WHERE id = 51;
UPDATE exercise_catalog SET image_url = '/exercises/futures-hombro-front-raise.png' WHERE id = 55;
UPDATE exercise_catalog SET image_url = '/exercises/futures-hombro-lateral-raise.png' WHERE id = 54;

-- PIERNA
UPDATE exercise_catalog SET image_url = '/exercises/futures-pierna-prensa-45.png' WHERE id = 64;
UPDATE exercise_catalog SET image_url = '/exercises/futures-pierna-extension.png' WHERE id = 66;
UPDATE exercise_catalog SET image_url = '/exercises/futures-pierna-femoral-tumbado.png' WHERE id = 69;

-- ABDOMEN
UPDATE exercise_catalog SET image_url = '/exercises/futures-abdomen-crunch-suelo.png' WHERE id = 83;
