// Service Worker — Rest Timer Notifications
// Uses a keep-alive ping loop to prevent iOS from killing the SW
// before the rest timer fires (60-90 seconds).

let timerState = null; // { targetTime, title, body, resolve }

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ── Keep-alive: re-extends waitUntil every 20s ──────────────
function keepAliveUntil(targetTime) {
  return new Promise((resolve) => {
    const check = () => {
      const remaining = targetTime - Date.now();
      if (remaining <= 0 || !timerState) {
        resolve();
        return;
      }
      // Sleep for min(20s, remaining) then re-check
      const sleepMs = Math.min(20000, remaining);
      setTimeout(check, sleepMs);
    };
    check();
  });
}

async function fireCompletionNotification() {
  try {
    await self.registration.showNotification('¡Recuperación completada! 💪', {
      body: '¡Es hora de tu siguiente serie!',
      icon: '/vite.svg',
      badge: '/vite.svg',
      vibrate: [500, 200, 500, 200, 800],
      tag: 'rest-timer',
      renotify: true,
      requireInteraction: true,
    });
  } catch (e) { /* notification permission may be missing */ }

  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(c => c.postMessage({ type: 'TIMER_FIRED' }));
  } catch (e) {}
}

self.addEventListener('message', (event) => {
  const { type, targetTime, title, body, isStart } = event.data || {};

  if (type === 'SCHEDULE_NOTIFICATION') {
    // Cancel any previous timer
    if (timerState) {
      timerState.resolve?.();
      timerState = null;
    }

    const delay = Math.max(0, targetTime - Date.now());

    event.waitUntil(
      (async () => {
        // Show immediate "started" notification if requested
        if (isStart) {
          try {
            await self.registration.showNotification(
              title || '¡Descanso iniciado! ⏱️',
              {
                body: body || 'El temporizador ha comenzado.',
                icon: '/vite.svg',
                badge: '/vite.svg',
                tag: 'rest-timer-start',
                renotify: true,
              }
            );
          } catch (e) {}
        }

        // Set up the completion timer with keep-alive
        let resolveKeepAlive;
        const keepAlivePromise = new Promise(r => { resolveKeepAlive = r; });

        timerState = { targetTime, resolve: resolveKeepAlive };

        // Main timer
        const timerId = setTimeout(async () => {
          if (!timerState || timerState.targetTime !== targetTime) {
            resolveKeepAlive();
            return;
          }
          timerState = null;
          await fireCompletionNotification();
          resolveKeepAlive();
        }, delay);

        // Keep-alive loop runs alongside the timer
        const alivePromise = keepAliveUntil(targetTime + 2000);

        // Wait for both: the timer to fire AND the keep-alive to finish
        await Promise.race([keepAlivePromise, alivePromise]);

        // Cleanup just in case
        clearTimeout(timerId);
      })()
    );
  }

  if (type === 'CANCEL_NOTIFICATION') {
    if (timerState) {
      timerState.resolve?.();
      timerState = null;
    }
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
