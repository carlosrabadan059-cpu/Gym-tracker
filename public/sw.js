// Service Worker — Rest Timer Notifications
// KEY FIX: event.waitUntil() keeps the SW alive for the full timer duration.
// Without it, the OS can terminate the SW before the notification fires.

let cancelCurrent = null; // cancellation function for the active timer

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  const { type, targetTime, title, body, isStart } = event.data || {};

  if (type === 'SCHEDULE_NOTIFICATION') {
    // 1. Cancel previous
    if (cancelCurrent) {
      cancelCurrent();
      cancelCurrent = null;
    }

    const delay = Math.max(0, targetTime - Date.now());
    let cancelled = false;

    // 2. Wrap EVERYTHING in a waitUntil promise
    event.waitUntil(
      new Promise(async (resolve) => {
        // Immediate start notification if requested
        if (isStart) {
          try {
            await self.registration.showNotification(title || '¡Descanso iniciado! ⏱️', {
              body: body || 'El temporizador ha comenzado.',
              icon: '/vite.svg',
              badge: '/vite.svg',
              tag: 'rest-timer-start',
              renotify: true,
            });
          } catch (err) {}
        }

        // Setup the completion timer
        const timerId = setTimeout(async () => {
          if (cancelled) { resolve(); return; }
          cancelCurrent = null;

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
          } catch (e) {}

          // Notify clients
          try {
            const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            clients.forEach(c => c.postMessage({ type: 'TIMER_FIRED' }));
          } catch (e) {}

          resolve();
        }, delay);

        cancelCurrent = () => {
          cancelled = true;
          clearTimeout(timerId);
          resolve();
        };
      })
    );
  }

  if (type === 'CANCEL_NOTIFICATION') {
    if (cancelCurrent) {
      cancelCurrent();
      cancelCurrent = null;
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
