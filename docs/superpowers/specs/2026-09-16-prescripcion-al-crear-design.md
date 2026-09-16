# Prescripción al crear la rutina

**Fecha:** 2026-09-16
**Alcance:** Fase 1 de `docs/plan-trainer-improvements.md`, pendiente #1 — fijar
peso, RIR y descanso ya al crear la rutina, sin esperar al editor posterior de
`ClientProfileView.jsx`. El % de 1RM (pendiente #2) queda fuera, decisión
explícita del usuario.

## Punto de partida real

Hoy la prescripción (`target_weight`, `target_rir`, `rest_seconds`, `tempo`,
`notes`) solo se puede fijar DESPUÉS de crear la rutina, desde el editor por
ejercicio de `ClientProfileView.jsx`. En creación
(`RoutineAssignerView.jsx` "Crear nueva" y `AddExercisePanel.jsx` "Añadir
ejercicio") solo existen `series`/`reps`; los tres campos de prescripción se
insertan como `null` sin ninguna UI para rellenarlos.

Las columnas ya existen en `exercises` (creadas en la Fase 1 original) — sin
migración nueva.

## Decisiones tomadas (brainstorming, no reabrir)

1. **Campos expuestos en creación: solo peso, RIR y descanso.** Tempo y notas
   se quedan exclusivamente en el editor posterior — son campos de texto
   libre / ajuste fino que no encajan en un flujo de creación rápida.
2. **Interacción: opcional, desplegable por ejercicio.** La rejilla/lista
   sigue mostrando solo series/reps por defecto, igual que hoy. Cada ejercicio
   seleccionado gana una acción "+ prescribir" que despliega los 3 campos.
   Entrenadores que no lo necesiten no ven ningún cambio.

## Arquitectura

### `RoutineAssignerView.jsx`

Ya tiene todo lo necesario salvo la UI del desplegable:

- `SelectedExerciseList` (dos call sites: rail de escritorio línea ~1025,
  barra móvil línea ~1053) ya es la lista de seleccionados — se le añade el
  botón "+ prescribir" por fila y el bloque desplegable.
- `updateSelected(catalogId, field, value)` ya existe y ya es genérico por
  campo (hoy solo lo usa `ExerciseCard` en la rejilla) — se reutiliza tal
  cual para `target_weight`/`target_rir`/`rest_seconds`, sin lógica nueva de
  estado.
- `toggleExercise` (que crea el objeto `{catalog_id, name, image_url, series,
  reps}` al seleccionar) siembra además `target_weight: null, target_rir:
  null, rest_seconds: null`.
- `handleSave`/inserción a `exercises`: en vez de forzar `null` en los tres
  campos, pasa el valor del ejercicio si se rellenó, `null` si no.

### `AddExercisePanel.jsx`

No existe ninguna lista de seleccionados — solo tiles de rejilla
(`aspect-square`) con overlay de series/reps, sin sitio para 3 campos más.
Se añade una sección nueva de "seleccionados" debajo de la rejilla,
mirroring el patrón de `SelectedExerciseList` de `RoutineAssignerView`
(fila con miniatura, nombre, series×reps, botón "+ prescribir" desplegable),
reutilizando el componente compartido de abajo. `toggleExercise` y
`handleSave` reciben el mismo cambio que en `RoutineAssignerView`.

### Componente compartido nuevo: `ExercisePrescriptionInputs.jsx`

Los 3 inputs (peso/RIR/descanso), mismo estilo visual que ya usa el editor de
`ClientProfileView.jsx` (label uppercase + input `bg-surface
border-surface-highlight`). Recibe `{ values: {target_weight, target_rir,
rest_seconds}, onChange(field, value) }`. Se monta dentro del bloque
desplegable en los dos sitios de arriba. No sustituye ni toca el editor de
`ClientProfileView.jsx` (5 campos, lógica de progresión semanal distinta, ya
en producción — fuera de alcance).

## Testing

Sin lógica pura nueva: es threading de estado + inputs controlados, mismo
patrón que `series`/`reps`. Sin test dedicado (convención del proyecto para
piezas de UI/fetch).

Verificación en navegador (`run-rutinex`): crear una rutina nueva con un
ejercicio prescrito (peso+RIR+descanso) y uno sin prescribir, guardar, y
confirmar en Supabase que los valores llegan correctos y que
`ClientProfileView.jsx` los muestra igual que si se hubieran prescrito
después. Repetir en `AddExercisePanel.jsx` sobre una rutina ya asignada.

## Fuera de alcance

- Tempo y notas en creación (quedan solo en el editor posterior).
- % de 1RM como alternativa al peso absoluto (pendiente #2, Fase 1).
- Tocar el editor de `ClientProfileView.jsx`.
