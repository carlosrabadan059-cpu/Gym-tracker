// Puente a la app de Rutinex en el Apple Watch. Ver
// docs/superpowers/specs/2026-09-17-app-watch-design.md.
//
// Plugin LOCAL (ios/App/App/WatchBridgePlugin.swift) con el mismo acceso lazy
// que liveActivity.js — ver allí por qué no se usa registerPlugin().
// Todo resuelve a "sin Watch" fuera de nativo o ante cualquier fallo.
import { Capacitor } from '@capacitor/core';

const getPlugin = () => Capacitor.Plugins.WatchBridge;

const isAvailable = () => Capacitor.isNativePlatform() && !!getPlugin();

// Si el Watch no contesta a tiempo se da por no entregado y avisa el iPhone.
const REPLY_TIMEOUT_MS = 2000;

/** Pide al Watch que vibre en `endDate` (epoch ms). true solo si lo confirmó. */
export async function sendRestStartToWatch(endDate) {
    if (!isAvailable()) return false;
    try {
        const timeout = new Promise(resolve => setTimeout(() => resolve({ delivered: false }), REPLY_TIMEOUT_MS));
        const { delivered } = await Promise.race([getPlugin().restStart({ endDate }), timeout]);
        return !!delivered;
    } catch (err) {
        console.error('[WatchBridge] No se pudo avisar al Watch:', err);
        return false;
    }
}

export async function sendRestCancelToWatch() {
    if (!isAvailable()) return;
    try {
        await getPlugin().restCancel();
    } catch (err) {
        console.error('[WatchBridge] No se pudo cancelar en el Watch:', err);
    }
}

/** Última muestra de pulso del Watch como `{ value, startDate }`, o null. */
export async function getWatchHeartRateSample() {
    if (!isAvailable()) return null;
    try {
        const { bpm, sampledAt } = await getPlugin().getHeartRate();
        if (bpm == null || sampledAt == null) return null;
        return { value: bpm, startDate: new Date(sampledAt).toISOString() };
    } catch {
        return null;
    }
}
