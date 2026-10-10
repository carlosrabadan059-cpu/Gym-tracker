# Variante del ejercicio

**Fecha:** 2026-10-10
**Estado:** implementado (2026-10-10). Migración aplicada en producción.
Falta: validación de Carlos en la web; después, app nativa.

## Qué se quiere

Que el entrenador indique la variante de cada ejercicio ("agarre cerrado",
"inclinado 30º", "con pausa abajo") y que el cliente la vea al entrenar.

## Decisiones tomadas

- **Texto libre**, sin lista de valores.
- **Se mantiene el tempo** (`exercises.tempo`, "3-1-2"): son cosas distintas.
- La variante no cambia por semana en la progresión.
- Fuera de alcance: que la IA que genera rutinas proponga variantes.

## Diseño

### Base de datos

`exercises.variant text` nullable (migración aditiva). Las copias de rutina y
plantilla (`cloneExercises` y el guardado del editor) la llevan.

### Entrenador

Campo de texto "Variante" en los tres sitios donde se prescribe:

- `ExercisePrescriptionInputs` (crear rutina o plantilla y añadir ejercicio a
  una rutina asignada).
- El editor de ejercicio de `ClientProfileView`, junto al tempo.

### Cliente

- `ExerciseDetailModal`: "Variante: …" destacado bajo el nombre.
- Lista de ejercicios del entreno (`TrainingView`): texto pequeño bajo el
  nombre.

### Hoja imprimible

`buildPrintableProgram`: la columna "Variante" muestra `variant` (antes
mostraba por error `tempo`). El tempo pasa a observaciones como
"Tempo 3-1-2".

## Pruebas

- Tests: `cloneExercises` copia la variante; `buildPrintableProgram` pone la
  variante en su columna y el tempo en observaciones.
- Navegador con la cuenta de entrenador, sin guardar sobre las rutinas de
  Carlos.
- La app nativa espera a que Carlos valide la web.
