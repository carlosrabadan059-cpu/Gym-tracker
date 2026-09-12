// Service Worker — Rest Timer Notifications
// Dual-timer approach: primary setTimeout + backup setInterval every 5s.
// The interval acts as a safety net if iOS suspends the primary timer.

let activeTimer = null; // { timeoutId, intervalId, targetTime, resolve }
let lastNotificationTime = 0; // For deduplication

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const REST_NOTIFICATION_OPTIONS = {
  icon: '/icon-192.png',
  badge: '/icon-192.png',
  vibrate: [500, 200, 500, 200, 800],
};

/**
 * Shows the rest-timer notification.
 *
 * Every notification shares one tag, so showing it twice replaces the first
 * instead of stacking two alerts on screen. That collapsing is what lets the
 * push handler show unconditionally without risking a duplicate.
 */
async function showRestNotification(title, options) {
  lastNotificationTime = Date.now();
  return self.registration.showNotification(title, {
    ...REST_NOTIFICATION_OPTIONS,
    ...options,
    tag: 'gym-rest-timer',
    renotify: true,
    requireInteraction: true,
  });
}

// ── Web Push from server (works even with locked iPhone) ──
self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (err) {
    console.error('[Push] Error parsing data:', err);
    try {
        data = { body: event.data.text() };
    } catch(e) {}
  }

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const isClientVisible = clients.some(c => c.visibilityState === 'visible');

      // Se muestra siempre, también con la app abierta, por dos motivos.
      //
      // El primero es que antes no se mostraba: esto estaba dentro de un
      // `if (!isClientVisible)`, así que teniendo la app en pantalla no llegaba
      // ningún aviso y todo dependía del pitido de Web Audio.
      //
      // El segundo es que la suscripción se crea con `userVisibleOnly: true`
      // (ver src/lib/pushNotifications.js), que obliga a mostrar una
      // notificación por cada push recibido. Consumir pushes en silencio puede
      // acabar con la suscripción revocada por iOS. Por eso esta llamada nunca
      // se salta — lo único que cambia con la app visible es el vibrate: la
      // página ya vibra por su cuenta al reproducir el pitido local
      // (ExerciseDetailModal.jsx), así que aquí se omite para no doblar el
      // golpe físico. El aviso visual se queda, es un coste menor que un
      // segundo vibrado encima del que ya sintió el usuario.
      await showRestNotification(data.title || '¡Recuperación completada! 💪', {
        body: data.body || '¡Es hora de tu siguiente serie!',
        icon: data.icon || '/icon-192.png',
        badge: data.badge || '/icon-192.png',
        // Solo se sobreescribe cuando SÍ está visible; si no, el objeto no
        // lleva la clave y showRestNotification usa el vibrate por defecto
        // (un `vibrate: undefined` explícito lo pisaría igualmente vacío).
        ...(isClientVisible ? { vibrate: [] } : {}),
      });

      // Avisa a la app abierta, si la hay, para que reponga el temporizador
      clients.forEach(c => c.postMessage({ type: 'TIMER_FIRED', sessionId: data.sessionId ?? null }));
    })()
  );
});


async function fireCompletionNotification(title, body, sessionId) {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ type: 'TIMER_FIRED', sessionId: sessionId ?? null });
    }
  } catch (e) {}

  // Este es el camino local, que no tiene la obligación de `userVisibleOnly`.
  // Se le da un margen al push para que gane, y si ya avisó, aquí no se repite.
  await new Promise(r => setTimeout(r, 800));
  if (Date.now() - lastNotificationTime < 2000) return;

  try {
    await showRestNotification(title || '¡Recuperación completada! 💪', {
      body: body || '¡Es hora de tu siguiente serie!',
    });
  } catch (e) {}
}

function cancelActiveTimer() {
  if (!activeTimer) return;
  clearTimeout(activeTimer.timeoutId);
  clearInterval(activeTimer.intervalId);
  activeTimer.resolve?.();
  activeTimer = null;
}

self.addEventListener('message', (event) => {
  const { type, targetTime, title, body, isStart, sessionId } = event.data || {};

  if (type === 'SCHEDULE_NOTIFICATION') {
    cancelActiveTimer();

    const now = Date.now();
    const delay = Math.max(0, targetTime - now);

    event.waitUntil(new Promise(async (resolve) => {
      let fired = false;

      const fire = async () => {
        if (fired) return;
        fired = true;
        if (activeTimer) {
          clearTimeout(activeTimer.timeoutId);
          clearInterval(activeTimer.intervalId);
        }
        activeTimer = null;
        await fireCompletionNotification(title, body, sessionId);
        resolve();
      };

      // Handle immediate start notification if delay is < 1s
      if (isStart && delay < 1000) {
        await fireCompletionNotification(title, body, sessionId);
      }

      // Primary timer
      const timeoutId = setTimeout(fire, delay);

      // Backup polling
      const intervalId = setInterval(() => {
        if (Date.now() >= targetTime) fire();
      }, 5000);

      activeTimer = { timeoutId, intervalId, targetTime, resolve };
    }));
  }

  if (type === 'CANCEL_NOTIFICATION') {
    cancelActiveTimer();
  }
});

// Bring the app to the foreground when the user taps the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
