// Puente a Apple Health/Watch (v2 Fase 0). Ver docs/plan-apple-health-integration.md.
//
// Todo lo que exporta este módulo es un no-op fuera del shell nativo de
// Capacitor — el build web/PWA no cambia de comportamiento. Cuando exista el
// proyecto iOS (`npx cap add ios`, bloqueado hoy por no tener Xcode.app
// instalado), `Capacitor.isNativePlatform()` empieza a devolver `true` ahí y
// estas funciones pasan a hablar con HealthKit de verdad.
import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';

export const isHealthAvailableOnThisPlatform = () => Capacitor.isNativePlatform();

// 'calories' (no 'totalCalories') a propósito: el plugin instalado mapea
// ambos al mismo dato nativo (activeEnergyBurned) pero solo permite
// agregación (sum) sobre 'calories' — 'totalCalories' solo vale con
// readSamples. Ver getTodayMetrics().
const READ_TYPES = ['steps', 'weight', 'calories', 'restingHeartRate', 'workouts'];

/**
 * Pide permiso de lectura para lo que necesita el Dashboard/Estadísticas
 * (pasos, peso, kcal activas, FC en reposo, workouts). Ver Fase 1 del plan
 * para la pantalla "Conectar Apple Health" que llama a esto.
 */
export async function requestHealthAuthorization() {
    if (!isHealthAvailableOnThisPlatform()) return null;
    return Health.requestAuthorization({ read: READ_TYPES });
}

/**
 * Comprueba el estado de permiso actual SIN mostrar el diálogo del sistema.
 * Pensado para saber, al abrir la pantalla de ajustes, si hace falta pedir
 * permiso o ya se pidió antes — requestHealthAuthorization() no distingue
 * eso, siempre puede disparar el diálogo si aún no se había respondido.
 */
export async function checkHealthAuthorization() {
    if (!isHealthAvailableOnThisPlatform()) return null;
    return Health.checkAuthorization({ read: READ_TYPES });
}

/**
 * Pasos, kcal activas y FC en reposo de hoy, para la card "Salud (7 días)"
 * del Dashboard (Fase 3). Usa queryAggregated en vez de leer muestra a
 * muestra: es lo que recomienda la propia documentación del plugin para
 * rangos de más de un día.
 */
export async function getTodayMetrics() {
    if (!isHealthAvailableOnThisPlatform()) return null;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const range = { startDate: startOfDay.toISOString(), endDate: new Date().toISOString() };

    const [steps, calories, restingHr] = await Promise.all([
        Health.queryAggregated({ ...range, dataType: 'steps', aggregation: 'sum' }),
        Health.queryAggregated({ ...range, dataType: 'calories', aggregation: 'sum' }),
        Health.queryAggregated({ ...range, dataType: 'restingHeartRate', aggregation: 'average' }),
    ]);

    return {
        steps: steps.samples[0]?.value ?? 0,
        activeCalories: calories.samples[0]?.value ?? 0,
        restingHr: restingHr.samples[0]?.value ?? null,
    };
}

/**
 * Pasos promedio/día y kcal activas de los últimos 7 días, y FC en reposo de
 * hoy — para la card "Salud (7 días)" del Dashboard (Fase 3).
 * `bucket: 'day'` le pide al plugin un total por día en vez de uno para todo
 * el rango, así se puede promediar del lado del cliente.
 */
export async function getWeeklyHealthSummary() {
    if (!isHealthAvailableOnThisPlatform()) return null;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    const weekRange = { startDate: startDate.toISOString(), endDate: endDate.toISOString(), bucket: 'day' };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [stepsByDay, caloriesByDay, restingHrToday] = await Promise.all([
        Health.queryAggregated({ ...weekRange, dataType: 'steps', aggregation: 'sum' }),
        Health.queryAggregated({ ...weekRange, dataType: 'calories', aggregation: 'sum' }),
        Health.queryAggregated({
            startDate: todayStart.toISOString(),
            endDate: endDate.toISOString(),
            dataType: 'restingHeartRate',
            aggregation: 'average',
        }),
    ]);

    const daysWithSteps = stepsByDay.samples.length || 1;
    const totalSteps = stepsByDay.samples.reduce((sum, s) => sum + (s.value ?? 0), 0);
    const weeklyActiveCalories = caloriesByDay.samples.reduce((sum, s) => sum + (s.value ?? 0), 0);

    return {
        avgSteps: Math.round(totalSteps / daysWithSteps),
        weeklyActiveCalories: Math.round(weeklyActiveCalories),
        restingHr: restingHrToday.samples[0]?.value ?? null,
    };
}

/**
 * El workout de Watch más reciente que solape con el rango dado. Pensado
 * para el modal "Añadir Cardio Previo" (Fase 2): al abrirlo se pide el rango
 * de la última hora y, si hay un workout, se ofrece usar sus kcal reales en
 * vez de la estimación MET.
 *
 * ⚠️ Límite conocido, confirmado en el código del plugin instalado
 * (@capgo/capacitor-health 8.10.5) y no solo sospechado: `queryWorkouts()`
 * lee `workout.workoutActivityType`, el tipo ÚNICO de todo el HKWorkout —
 * nunca `workout.workoutActivities`, el array de HKWorkoutActivity con el
 * tipo POR SEGMENTO que introdujo iOS 16/watchOS 9. Con el uso real descrito
 * en el plan (una sola sesión de Watch con segmento aeróbico + segmento de
 * fuerza, sin parar de grabar), esta llamada devuelve un solo workout con un
 * solo `workoutType` — no hay forma de distinguir los dos segmentos con este
 * plugin tal cual está. Para eso hace falta una extensión Swift pequeña
 * dentro del proyecto Capacitor iOS que lea `workoutActivities` directamente
 * (ver "Riesgo técnico principal" en el plan). Mientras no exista, esta
 * función sirve para detectar UN tipo de workout por sesión (válido para el
 * caso simple: solo cardio, o solo fuerza, sin cambiar en el Watch).
 */
// El plugin no expone el flag "indoor" del workout (HKMetadataKeyIndoorWorkout
// del plan), así que no se puede distinguir cinta/interior de exterior como
// planeaba el mapeo original — se asume contexto de gimnasio (cinta/interior)
// para los 4 tipos que ya maneja la app. Ver "Mapeo de tipos de cardio" en el
// plan.
const CARDIO_WORKOUT_TYPE_MAP = {
    walking: 'Andar en cinta',
    running: 'Correr en cinta',
    elliptical: 'Elíptica',
    cycling: 'Bicicleta',
};

// Cómo reporta HealthKit (via el plugin) un entreno de fuerza del Watch.
// funcional y tradicional llegan como dos `workoutType` distintos.
const STRENGTH_WORKOUT_TYPES = ['strengthTraining', 'functionalStrengthTraining'];

/** Traduce el `workoutType` de un workout de Watch a un tipo de `CARDIO_TYPES` de la app, o null si no es uno de los 4 reconocidos. */
export function mapWorkoutToCardioType(workout) {
    return CARDIO_WORKOUT_TYPE_MAP[workout?.workoutType] ?? null;
}

/** Si el workout de Watch es un entreno de fuerza (funcional o tradicional). */
export function isStrengthWorkout(workout) {
    return !!workout && STRENGTH_WORKOUT_TYPES.includes(workout.workoutType);
}

export async function getMostRecentWorkout({ sinceMinutesAgo = 90 } = {}) {
    if (!isHealthAvailableOnThisPlatform()) return null;

    const startDate = new Date(Date.now() - sinceMinutesAgo * 60_000).toISOString();
    const { workouts } = await Health.queryWorkouts({
        startDate,
        endDate: new Date().toISOString(),
        limit: 1,
        ascending: false,
    });
    return workouts[0] ?? null;
}

/**
 * Escribe el entreno completado de Rutinex de vuelta a Health, para que
 * aparezca en los anillos de Actividad (Fase 2). `calories` en kcal.
 */
export async function writeWorkoutToHealth({ startDate, endDate, calories }) {
    if (!isHealthAvailableOnThisPlatform()) return;
    await Health.saveSample({
        dataType: 'totalCalories',
        value: calories,
        startDate,
        endDate,
    });
}
