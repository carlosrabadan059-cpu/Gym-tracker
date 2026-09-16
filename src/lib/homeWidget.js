// Puente al widget de pantalla de inicio (v2 Fase 5). Ver
// docs/plan-apple-health-integration.md, sección "Fase 5", y
// docs/superpowers/specs/2026-09-16-widget-pantalla-inicio-design.md.
//
// Igual que liveActivity.js: plugin LOCAL (ios/App/App/HomeWidgetPlugin.swift),
// no un paquete npm — acceso lazy a window.Capacitor.Plugins.HomeWidget,
// nunca capturado en import time.
import { Capacitor } from '@capacitor/core';

const getPlugin = () => Capacitor.Plugins.HomeWidget;

export const isHomeWidgetAvailableOnThisPlatform = () =>
    Capacitor.isNativePlatform() && !!getPlugin();

/**
 * Actualiza los datos del widget de pantalla de inicio. Escritura parcial:
 * solo las claves pasadas se sobreescriben en el lado nativo — se puede
 * llamar con solo `streak` o solo `steps` sin borrar la otra.
 *
 * @param {{streak?: number, steps?: number}} data
 */
export async function updateHomeWidgetData({ streak, steps } = {}) {
    if (!isHomeWidgetAvailableOnThisPlatform()) return;
    try {
        const data = {};
        if (streak !== undefined) data.streak = streak;
        if (steps !== undefined) data.steps = steps;
        if (Object.keys(data).length === 0) return;
        await getPlugin().setData(data);
    } catch (err) {
        console.error('[HomeWidget] No se pudo actualizar el widget:', err);
    }
}
