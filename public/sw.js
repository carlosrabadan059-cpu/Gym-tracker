// Service Worker — Rest Timer Notifications
// Dual-timer approach: primary setTimeout + backup setInterval every 5s.
// The interval acts as a safety net if iOS suspends the primary timer.

let activeTimer = null; // { timeoutId, intervalId, targetTime, resolve }

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function fireCompletionNotification() {
  try {
    await self.registration.showNotification('¡Recuperación completada! 💪', {
      body: '¡Es hora de tu siguiente serie!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [500, 200, 500, 200, 800],
      tag: 'rest-timer',
      renotify: true,
      requireInteraction: true,
    });
  } catch (e) {}

  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(c => c.postMessage({ type: 'TIMER_FIRED' }));
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
  const { type, targetTime, title, body, isStart } = event.data || {};

  if (type === 'SCHEDULE_NOTIFICATION') {
    cancelActiveTimer();

    const delay = Math.max(0, targetTime - Date.now());

    event.waitUntil(new Promise(async (resolve) => {
      // Immediate "started" notification if requested
      if (isStart) {
        try {
          await self.registration.showNotification(
            title || '¡Descanso iniciado! ⏱️',
            {
              body: body || 'El temporizador ha comenzado.',
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: 'rest-timer-start',
              renotify: true,
            }
          );
        } catch (e) {}
      }

      let fired = false;

      const fire = async () => {
        if (fired) return;
        fired = true;
        if (activeTimer) {
          clearTimeout(activeTimer.timeoutId);
          clearInterval(activeTimer.intervalId);
        }
        activeTimer = null;
        await fireCompletionNotification();
        resolve();
      };

      // Primary timer: exact delay
      const timeoutId = setTimeout(fire, delay);

      // Backup: poll every 5s in case iOS killed the primary setTimeout
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
