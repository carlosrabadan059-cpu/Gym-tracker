# Repeticiones por serie (pirámides)

**Fecha:** 2026-10-08
**Estado:** implementado (2026-10-08), prototipo aprobado
(rama `prototype/reps-por-serie`). Falta probarlo en el iPhone.

## Qué se quiere

Que el entrenador pueda prescribir repeticiones distintas en cada serie de un
ejercicio, como en las hojas del gimnasio: "4 series, 12-10-8-6". Hoy las
reps son un único número para todas las series.

Los ejercicios de reps fijas (4×8) siguen siendo lo normal y funcionan
exactamente igual que ahora.

## Decisiones tomadas

- **Reps fijas por defecto.** La pirámide se activa por ejercicio con un
  interruptor "Reps por serie". Apagado, todo es como hoy. En una misma
  rutina se pueden mezclar ejercicios en pirámide y de reps fijas. Los
  ejercicios existentes no cambian.
- **Entrada con selectores, no texto libre:** con el interruptor encendido
  sale un selector por serie (12 · 10 · 8 · 6).
- **Peso por serie para el cliente:** cada serie propone el peso que usó en
  esa misma serie la última vez, y la sugerencia de subir peso se calcula
  serie a serie.
- **Pirámide por semana en el mesociclo:** cada semana de la progresión
  puede tener su propia pirámide.
- **Formato:** texto en la columna `reps` existente. `"12-10-8-6"` es una
  pirámide; `"8"` son reps fijas. Sin migración. Descartados: una columna
  nueva con una lista (migración y dos fuentes de verdad) y JSON dentro de
  `reps` (rompe todo lo que hoy lee `reps` como texto).

## Componentes

### `src/lib/repScheme.js` (con tests)

- `parseRepScheme(reps, series)` → array de `series` números. `"8"` con 4
  series → `[8, 8, 8, 8]`; `"12-10-8-6"` con 4 → `[12, 10, 8, 6]`. Si la
  pirámide es más corta que las series, se repite la última cifra; si es más
  larga, se recorta.
- `formatRepScheme(array)` → `"8"` si todos son iguales, `"12-10-8-6"` si no.
  Así, una pirámide con todas las cifras iguales vuelve a ser reps fijas.
- `isPyramid(reps)` → si el texto tiene más de una cifra.
- Los ejercicios por tiempo (minutos) no admiten pirámide: el interruptor no
  aparece.

### Entrenador

En los tres sitios donde hoy se eligen las reps: al asignar ejercicios
(`AddExercisePanel.jsx`), al editarlos en la ficha (`ClientProfileView.jsx`)
y en cada semana de la progresión.

- Interruptor **"Reps por serie"**, apagado por defecto (encendido si el
  ejercicio ya es una pirámide).
- Encendido: un selector por serie. Al cambiar el número de series, se
  añaden selectores (con la última cifra) o se quitan los sobrantes.
- Al apagarlo, las reps pasan a ser las de la primera serie.
- Se corrige el fallo actual: `Number(ex.reps) || 10` al editar convierte
  "12-10-8-6" en 10 sin avisar. Todas las lecturas pasan por
  `parseRepScheme`.
- Las listas muestran "4×12-10-8-6".

### Cliente (`ExerciseDetailModal.jsx`)

- Cada serie se rellena con sus reps de la pirámide.
- Peso de cada serie: el de esa misma serie en la última sesión; si no hay,
  el prescrito; si tampoco, vacío.
- Sugerencia de peso serie a serie (adaptación de `suggestNextWeight` en
  `progression.js`): si en la última sesión la serie `i` llegó a sus reps
  objetivo con RPE por debajo de 9, se propone subir el peso de esa serie.
- La cabecera del ejercicio muestra "12-10-8-6".
- Con reps fijas, todo sigue como hoy.

### Resto

- La hoja impresa del programa ya muestra el texto tal cual.
- La IA del entrenador (borrador y revisión de rutinas) recibe y devuelve
  `reps` como texto; se le indica que puede usar el formato "12-10-8-6".

## Prototipo antes de desarrollar

En la rama `prototype/reps-por-serie`, con datos de ejemplo y sin backend:

1. El entrenador editando un ejercicio: interruptor, selectores por serie y
   la progresión semanal con una pirámide distinta por semana.
2. El cliente registrando las series de un ejercicio en pirámide, con reps y
   pesos propuestos por serie y la sugerencia de subir peso.
3. El mismo registro con un ejercicio de reps fijas, para comprobar que no
   cambia.

## Pruebas

- Tests de `repScheme.js`: reps fijas, pirámide, longitud distinta a las
  series, formato de vuelta, pirámide con cifras iguales.
- Tests de la sugerencia por serie en `progression.test.js`.
- Comprobación en dispositivo: un ejercicio en pirámide y otro de reps fijas
  en la misma rutina, entrenados en el iPhone.
