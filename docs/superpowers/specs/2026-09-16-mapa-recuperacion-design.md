# v3 Fase C2 — Mapa de recuperación muscular

**Fecha:** 2026-09-16
**Alcance:** los dos puntos que quedaban de la Fase C de
[plan-gym-app-features.md](../../plan-gym-app-features.md): "cálculo de
volumen reciente por grupo muscular, ventana 48-72h" y "visualización tipo
heatmap". El etiquetado (punto 1) se construyó en
[C1](2026-09-16-musculos-secundarios-design.md).

## Qué responde esta pantalla

Una sola pregunta, la que te haces al entrar al gimnasio: **qué tengo
descansado hoy**. No es una estadística para mirar después de entrenar —por
eso va en el Dashboard y no en Estadísticas, donde ya vive el volumen
semanal (Fase 5).

## Decisiones tomadas (brainstorming, no reabrir)

1. **Barras por grupo**, coloreadas por estado. Mismo lenguaje visual que la
   tarjeta de volumen de la Fase 5. Un mapa corporal SVG queda descartado:
   no hay ningún recurso anatómico en el repo y habría que dibujarlo y
   mantenerlo en dos temas.
2. **En el Dashboard del cliente.**
3. **Se muestran los 8 grupos siempre**, incluso al 100%. A diferencia del
   volumen semanal —que enseña lo entrenado— aquí el valor está justo en ver
   qué NO has tocado.

## El modelo de recuperación

Todo son constantes con nombre en `src/lib/muscleRecovery.js`, pensadas para
ajustarse cuando se vean con datos reales:

**Fatiga por serie.** Una serie completada suma `1.0` al grupo principal del
ejercicio y `0.5` a cada secundario (`SECONDARY_SET_WEIGHT`). El 0.5 es un
peso único para todos los secundarios: distinguir "el hombro se carga un 0.3
en press de banca pero un 0.6 en press militar" exigiría un dato que el
catálogo no tiene y que nadie va a mantener a mano.

**Ventana de recuperación.** 48h para los grupos pequeños (Bíceps, Tríceps,
Hombro, Abdomen) y 72h para los grandes (Pecho, Dorsal, Pierna, Glúteo).
Es lo que pedía el plan y refleja que un cuádriceps tarda más en recuperarse
que un bíceps.

**Decaimiento lineal.** Una serie hecha hace `h` horas aporta
`peso × (1 − h / ventana)` y deja de contar al llegar a la ventana. Lineal y
no exponencial a propósito: es explicable en una frase y nadie tiene datos
para calibrar una curva mejor.

**De fatiga a porcentaje.** `recuperación = 100 − (fatiga / FULL_FATIGUE_SETS)
× 100`, acotado a [0, 100], con `FULL_FATIGUE_SETS = 12`. Es decir, 12 series
efectivas concentradas en el momento dejan un grupo a 0%. Es el número más
discutible del modelo y por eso está aislado en una constante.

**Estados** (para el color y el texto): `fresco` ≥ 70%, `parcial` entre 35% y
69%, `fatigado` < 35%.

## Arquitectura

### `src/lib/muscleRecovery.js`

```js
computeMuscleRecovery(logs, exerciseMuscleMap, referenceDate)
  => Array<{ category, recovery, state, fatigue }>
```

- `logs`: lo que devuelve `loadWorkoutLogs` (`{date, logs}`).
- `exerciseMuscleMap`: `{ [exerciseId]: { category, secondary_muscles } }`,
  que resuelve quien llama.
- Devuelve los 8 grupos, ordenados de menos a más recuperado — lo urgente
  primero.

Reutiliza `countCompletedSets` de `muscleVolume.js`, que pasa a exportarse.
Duplicar esa regla (`completedSets` con fallback a series con reps) en dos
módulos es exactamente lo que causó el lío de "inicio de semana" que hubo que
unificar: una regla, un sitio.

### `src/components/shared/MuscleRecoveryCard.jsx`

Barras horizontales de 0 a 100%, coloreadas por estado, con el porcentaje al
lado. Sin estado propio ni acceso a Supabase: recibe el array ya calculado.

### Montaje

`DashboardView.jsx` necesita dos datos que hoy no carga: el historial
reciente (`loadWorkoutLogs`) y el mapa de ejercicio a músculos
(`exercises` con `exercise_catalog(category, secondary_muscles)` embebido).
Se cargan en un efecto propio, y la tarjeta se coloca bajo el banner de
consentimiento y sobre las rutinas del día.

## Testing

`src/lib/muscleRecovery.test.js`, con `referenceDate` explícito:

- Sin sesiones recientes, los 8 grupos salen al 100% y en estado `fresco`.
- Una serie del grupo principal resta más que una de secundario.
- El decaimiento: la misma sesión resta menos cuanto más antigua.
- Fuera de la ventana no resta nada (48h para un grupo pequeño, 72h para uno
  grande).
- La ventana corta y la larga se aplican al grupo que toca.
- La recuperación nunca baja de 0 por mucho volumen que se acumule.
- Los estados caen en el umbral correcto.
- Ordena de menos a más recuperado.
- Devuelve siempre los 8 grupos, también sin datos.

Verificación en navegador con los datos reales de Carlos.

## Fuera de alcance

- Recomendar qué entrenar hoy ("toca espalda"). Esto informa, no prescribe.
- Intensidad por secundario (peso único 0.5, ver arriba).
- Ajustar la ventana por edad, sueño o RPE.
- Histórico de recuperación.
