-- La secuencia de exercises.id iba por 68 mientras había filas con ids
-- mucho más altos (insertadas antes con id explícito, hasta 803733). Cada
-- insert nuevo chocaba con un id existente: "duplicate key value violates
-- unique constraint exercises_pkey" al guardar una plantilla o rutina.
-- Solo mueve la secuencia; no toca ninguna fila.
select setval('public.exercises_id_seq', (select max(id) from public.exercises));
