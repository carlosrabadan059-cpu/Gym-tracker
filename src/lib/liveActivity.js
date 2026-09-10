// Puente a la Live Activity del entreno (v2 Fase 4). Ver
// docs/plan-apple-health-integration.md, sección "Fase 4".
//
// A diferencia de appleHealth.js (que envuelve un plugin npm,
// @capgo/capacitor-health, ya expuesto vía `registerPlugin` de
// @capacitor/core), este es un plugin LOCAL — vive solo en
// ios/App/App/LiveActivityPlugin.swift, registrado a mano en
// MainViewController.swift vía `bridge?.registerPluginInstance(...)`.
//
// Por qué NO se usa `registerPlugin()` de @capacitor/core aquí: esa función
// construye su proxy a partir de `window.Capacitor.PluginHeaders`, un
// array que solo rellenan los plugins registrados ANTES de que el bridge
// termine de inicializarse (`registerPlugins()`, dentro del init de
// CapacitorBridge). `registerPluginInstance()` se llama después, desde
// `capacitorDidLoad()` — sí genera la implementación real de los métodos
// en `window.Capacitor.Plugins.LiveActivity` (confirmado: los métodos
// funcionan), pero no llega a tiempo para PluginHeaders. `registerPlugin()`
// solo mira PluginHeaders, así que con un plugin local siempre daría
// "UNIMPLEMENTED" aunque el nativo esté bien — hay que llamar directo al
// objeto que el propio bridge ya deja listo en window.Capacitor.Plugins.
import { Capacitor } from '@capacitor/core';

// Acceso LAZY, no en el import: el nativo inyecta
// `window.Capacitor.Plugins.LiveActivity` (vía JSExport.exportJS) DESPUÉS de
// que este módulo se evalúe. Capturarlo arriba deja `undefined` fijo y cada
// llamada peta en silencio dentro del catch.
const getPlugin = () => Capacitor.Plugins.LiveActivity;

export const isLiveActivityAvailableOnThisPlatform = () =>
    Capacitor.isNativePlatform() && !!getPlugin();

/** Si el usuario tiene las Live Activities activadas para esta app. */
export async function isLiveActivitySupported() {
    if (!isLiveActivityAvailableOnThisPlatform()) return false;
    try {
        const { supported } = await getPlugin().isSupported();
        return !!supported;
    } catch {
        return false;
    }
}

/** Arranca la Activity al entrar a un ejercicio. Best-effort — nunca lanza. */
export async function startWorkoutActivity({ routineName, exerciseName, currentSet, totalSets }) {
    if (!isLiveActivityAvailableOnThisPlatform()) return;
    try {
        await getPlugin().start({ routineName, exerciseName, currentSet, totalSets });
    } catch (err) {
        console.error('[LiveActivity] No se pudo arrancar:', err);
    }
}

/**
 * Actualiza la Activity. `phase`: 'training' | 'resting' | 'restFinished'.
 * `restEndDate` en epoch ms (Date.now()-compatible), solo con phase='resting'.
 */
export async function updateWorkoutActivity({ exerciseName, currentSet, totalSets, phase, restEndDate }) {
    if (!isLiveActivityAvailableOnThisPlatform()) return;
    try {
        await getPlugin().update({ exerciseName, currentSet, totalSets, phase, restEndDate });
    } catch (err) {
        console.error('[LiveActivity] No se pudo actualizar:', err);
    }
}

/** Termina la Activity al terminar la rutina (o al abandonarla). */
export async function endWorkoutActivity() {
    if (!isLiveActivityAvailableOnThisPlatform()) return;
    try {
        await getPlugin().end();
    } catch (err) {
        console.error('[LiveActivity] No se pudo terminar:', err);
    }
}
