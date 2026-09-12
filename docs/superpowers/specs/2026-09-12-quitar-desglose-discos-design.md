# Quitar el desglose de discos por lado

## Contexto

Bug reportado por el usuario con captura real: `ExerciseDetailModal.jsx` muestra un desglose "N×kg + N×kg /lado" (`platesPerSide`/`formatPlates` en `src/lib/plates.js`) para cualquier ejercicio con peso que no sea bodyweight/de tiempo, asumiendo siempre una barra olímpica de 20 kg cargada por los dos lados. Correcto para barra libre (sentadilla con barra, press banca con barra); incorrecto para máquinas de palanca/T-bar ("Remo en T apoyado", 32.5 kg no se carga como 20 kg de barra + discos), poleas, prensa de piernas, etc.

Se investigó el catálogo real (`exercise_catalog`, ~65 ejercicios) para ver si el nombre permitía distinguir el tipo de equipo de forma fiable: no. Ejemplos: "Press de banca" y "Peso muerto rumano" son barra libre real sin decir "con barra"; "Remo en T apoyado", "Jalón al pecho", "Prensa de piernas" son máquina/polea real sin decirlo tampoco. Arreglarlo bien exigiría un campo de equipo nuevo en el catálogo, clasificado ejercicio por ejercicio.

**Decisión del usuario**: el desglose de discos aporta poco valor — se quita del todo en vez de arreglarlo. Se mantiene el peso total en kg (dato correcto y suficiente); desaparece solo la línea de qué discos poner.

## Alcance

- `src/lib/plates.js`: eliminar `platesPerSide`, `formatPlates`, `BAR_KG`, `PLATES`. Se mantienen `estimate1RM`, `RPE_OPTIONS`, `rirFromRpe` — siguen en uso.
- `src/views/ExerciseDetailModal.jsx`:
  - Quitar `platesPerSide`, `formatPlates` del import de `../lib/plates` (línea 4).
  - Quitar la variable `plates` calculada por serie (dentro del `.map` de series, línea ~805).
  - Quitar el `<span>` que renderiza `{formatPlates(plates)} /lado` y la condición que envolvía discos+récord juntos; el badge "🏆 Récord estimado" (`showPr`) se queda, ahora solo con su propia condición.

## Fuera de alcance

- Ningún cambio de base de datos, ningún cambio en `TrainerLibraryView.jsx` ni en el catálogo de ejercicios — ya no hace falta ningún campo de tipo de equipo.
- Ningún test que borrar: `platesPerSide`/`formatPlates` nunca tuvieron cobertura de Vitest.
- El peso total en kg, el 1RM estimado y el badge de récord siguen exactamente igual que hoy.
