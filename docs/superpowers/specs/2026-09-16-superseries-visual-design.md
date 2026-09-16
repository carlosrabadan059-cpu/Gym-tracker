# Superseries — agrupación visual (v3 Fase B, alcance recortado)

**Fecha:** 2026-09-16
**Alcance:** Fase B de `docs/plan-gym-app-features.md` — agrupar 2+
ejercicios consecutivos como superserie, **solo visual**. El descanso real
sigue funcionando exactamente igual que hoy, por ejercicio, dentro de
`ExerciseDetailModal.jsx` — no se toca.

## Decisiones tomadas (brainstorming, no reabrir)

1. **Solo agrupar y mostrar, no coordinar descanso.** El flujo real
   "A→B→descanso" (niveles 2/3 explorados) queda fuera — más inversión de la
   que se quiere ahora mismo. Esta pieza es señalización: qué ejercicios van
   juntos.
2. **Grupos = ejercicios consecutivos**, no un selector libre. Coincide con
   la descripción original del plan ("2+ ejercicios consecutivos sin
   descanso entre ellos"). Un grupo es siempre un rango contiguo en el orden
   guardado (`ui_order`).
3. **Solo se agrupa al crear la rutina.** `RoutineAssignerView.jsx` ("Crear
   nueva") y `AddExercisePanel.jsx` — no se toca `ClientProfileView.jsx`
   (editar rutinas ya asignadas queda fuera).
4. **Reordenar rompe el grupo si deja de ser contiguo.** Invariante simple:
   un ejercicio movido fuera del rango de su grupo se desvincula
   automáticamente. Sin lógica de "reparar" el grupo — el entrenador
   re-vincula a mano si hace falta.

## Arquitectura

### Datos

Migración additive: `exercises.superset_group_id` (`text`, nullable,
default `null`). Mismo patrón de id que ya usa `custom_${crypto.randomUUID()}`
en `cloneRoutineToClient` (`trainerUtils.js`) — se genera
`superset_${crypto.randomUUID()}` en el cliente al crear un grupo nuevo.

### Función pura compartida — `src/lib/superset.js`

```js
/**
 * Agrupa ejercicios consecutivos que comparten superset_group_id. Ejercicios
 * sin grupo (null/undefined) siempre quedan solos. Un grupo roto por un id
 * no contiguo (dos filas con el mismo id separadas por una tercera sin ese
 * id) se trata como dos grupos independientes — la contigüidad manda sobre
 * el id compartido, nunca al revés.
 *
 * @param {Array<{superset_group_id?: string|null}>} exercises  en su orden real (ui_order)
 * @returns {Array<Array<object>>} arrays de 1 (suelto) o 2+ (superserie), en el mismo orden
 */
export function groupConsecutiveExercises(exercises) { ... }
```

Usada por **el constructor** (para saber qué filas pintar conectadas) y por
**`TrainingView`** (para saber qué tarjetas envolver con la etiqueta
"Superserie"). Una sola implementación, sin duplicar la regla de
contigüidad en dos sitios.

### Constructor — `RoutineAssignerView.jsx` y `AddExercisePanel.jsx`

En la lista de seleccionados (`SelectedExerciseList` y el bloque equivalente
de `AddExercisePanel.jsx`, ambos ya expandibles por la feature de
prescripción), un botón de enlace (icono `Link2` de lucide-react) entre cada
par de filas adyacentes:

- **Ninguna de las dos tiene grupo:** al pulsar, se genera
  `superset_${crypto.randomUUID()}` y se asigna a ambas.
  `updateSelected(catalogId, 'superset_group_id', value)` — reutiliza el
  `updateSelected` genérico que ya existe en los dos ficheros, sin función
  nueva.
- **Una ya tiene grupo (viene de un enlace anterior):** la otra hereda ese
  mismo `superset_group_id` (extiende el grupo).
- **Ya están enlazadas:** el botón alterna a "desvincular" — limpia
  `superset_group_id` en ambas filas si el grupo resultante quedaría de
  tamaño 1; si el grupo tiene 3+, solo saca la fila pulsada.

**Reordenar (↑↓ ya existentes):** tras mover una fila, se recalcula con
`groupConsecutiveExercises` sobre el array reordenado; cualquier ejercicio
cuyo `superset_group_id` ya no forme un bloque contiguo con el resto de su
grupo se limpia a `null` (desvinculación automática).

**Guardado:** `handleSave` en ambos ficheros incluye `superset_group_id` en
el insert a `exercises` (hoy no se manda ese campo en absoluto).

### `TrainingView` (`OtherViews.jsx`)

La lista de ejercicios de la rutina activa pasa por
`groupConsecutiveExercises(activeWorkout.exercises)` antes de renderizar.
Cada grupo de tamaño 2+ se envuelve en un contenedor con borde/etiqueta
"Superserie" (estilo a definir en implementación, coherente con el resto de
`OtherViews.jsx`); los ejercicios sueltos se renderizan exactamente igual
que hoy. **Sin cambios** en `handleOpenExercise`, `ExerciseDetailModal`, ni
en la lógica de descanso — tocar cualquier ejercicito del grupo abre su
modal normal, independiente de los demás, igual que ahora.

## Testing

`src/lib/superset.js` + `superset.test.js`: casos —
- Sin ningún `superset_group_id` → todos sueltos (arrays de 1).
- Un grupo de 2 contiguos → un array de 2.
- Un grupo de 3 contiguos → un array de 3.
- Dos ejercicios con el mismo id pero **no contiguos** (separados por un
  tercero sin ese id) → dos grupos de 1, no uno de 2 (la contigüidad manda).
- Dos grupos distintos separados por un ejercicio suelto → 3 arrays.

Sin test para el wiring de UI (constructor, `TrainingView`) — mismo criterio
que el resto de piezas de UI/fetch del proyecto.

**Verificación en navegador:** crear una rutina con 3 ejercicios, enlazar
los dos primeros, guardar, comprobar en Supabase que comparten
`superset_group_id` y el tercero es `null`; abrir la rutina en
`TrainingView` y comprobar que los dos primeros aparecen agrupados
visualmente y el tercero suelto. Repetir el flujo de desvincular al
reordenar.

## Fuera de alcance

- Descanso coordinado real entre ejercicios agrupados (niveles 2/3
  explorados y descartados por ahora).
- Agrupar/editar desde `ClientProfileView.jsx` (rutinas ya asignadas).
- Reparar automáticamente un grupo roto por reordenar — se desvincula sin
  más, el entrenador re-vincula a mano si quiere.
