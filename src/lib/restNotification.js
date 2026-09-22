// Aviso de fin de descanso. Ver
// docs/superpowers/specs/2026-09-16-avisos-descanso-nativo-design.md.
//
// Las dos plataformas necesitan mecanismos distintos y no hay forma de
// unificarlas: Apple solo admite Web Push en PWAs añadidas a la pantalla de
// inicio desde Safari, así que en el WKWebView de Capacitor no existe
// PushManager. Y al revés, un plugin de Capacitor no existe en la PWA.
//
// Este módulo es el único sitio que conoce esa diferencia. Quien lo llama
// (ExerciseDetailModal) pide "avísame al terminar el descanso" y se
// desentiende de dónde está corriendo.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { subscribeToPush, scheduleServerPush } from './pushNotifications';
import { sendRestStartToWatch, sendRestCancelToWatch } from './watchBridge';

const TITLE = '¡Recuperación completada! 💪';
const BODY = '¡Es hora de tu siguiente serie!';

const isNative = () => Capacitor.isNativePlatform();

/**
 * Programa el aviso para `targetTime`.
 *
 * En nativo NO se llama a scheduleServerPush: push_subscriptions guarda una
 * fila por usuario y esa fila es la de la PWA, así que el push acabaría
 * sonando en el icono equivocado.
 */
export async function scheduleRestEnd({ userId, targetTime, sessionId }) {
    if (isNative()) {
        // Con entreno activo en la app del Watch, vibra él aunque el iPhone
        // esté desbloqueado (caso en que iOS no reenvía notificaciones). La
        // local sobraría y avisaría dos veces.
        const deliveredToWatch = await sendRestStartToWatch(targetTime);
        console.log('[RestNotification] Watch confirmó:', deliveredToWatch);
        if (deliveredToWatch) return;
        try {
            await LocalNotifications.schedule({
                notifications: [{
                    id: sessionId,
                    title: TITLE,
                    body: BODY,
                    schedule: { at: new Date(targetTime) },
                }],
            });
            console.log('[RestNotification] Aviso local programado para', new Date(targetTime).toISOString());
        } catch (err) {
            console.error('[RestNotification] No se pudo programar el aviso local:', err);
        }
        return;
    }

    if (!userId) return;
    try {
        await subscribeToPush(userId);
        await scheduleServerPush(userId, targetTime, sessionId);
    } catch (err) {
        console.error('[RestNotification] No se pudo programar el push:', err);
    }
}

/**
 * Cancela el aviso de ese descanso. En web no hay nada que cancelar en el
 * servidor: el push que ya salió se descarta por sessionId al llegar, que
 * es el mecanismo que ya existía.
 */
export async function cancelRestEnd(sessionId) {
    if (!isNative()) return;
    sendRestCancelToWatch();
    try {
        await LocalNotifications.cancel({ notifications: [{ id: sessionId }] });
    } catch (err) {
        console.error('[RestNotification] No se pudo cancelar el aviso local:', err);
    }
}

/** ¿Hay permiso para avisar? Devuelve true/false, nunca lanza. */
export async function hasNotificationPermission() {
    if (isNative()) {
        try {
            const { display } = await LocalNotifications.checkPermissions();
            return display === 'granted';
        } catch {
            return false;
        }
    }
    return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Pide permiso. Se llama desde el botón del banner y, de forma oportunista,
 * al marcar cada serie — iOS solo enseña el diálogo la primera vez, así que
 * repetirlo es inocuo.
 *
 * En web, conceder el permiso además crea la suscripción de Web Push, que
 * es lo que el servidor necesita para poder avisar. En nativo no hay
 * suscripción que crear.
 */
export async function requestNotificationPermission(userId) {
    if (isNative()) {
        try {
            const { display } = await LocalNotifications.requestPermissions();
            return display === 'granted';
        } catch (err) {
            console.error('[RestNotification] Falló la petición de permiso:', err);
            return false;
        }
    }

    if (!('Notification' in window)) return false;
    try {
        const permission = Notification.permission === 'default'
            ? await Notification.requestPermission()
            : Notification.permission;
        if (permission !== 'granted') return false;
        if (userId) subscribeToPush(userId);
        return true;
    } catch (err) {
        console.error('[RestNotification] Falló la petición de permiso:', err);
        return false;
    }
}
