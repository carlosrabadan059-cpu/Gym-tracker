// Service Worker — Rest Timer Notifications
// KEY FIX: event.waitUntil() keeps the SW alive for the full timer duration.
// Without it, the OS can terminate the SW before the notification fires.

let cancelCurrent = null; // cancellation function for the active timer

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  const { type, targetTime } = event.data || {};

  if (type === 'SCHEDULE_NOTIFICATION') {
    // Cancel any previously scheduled timer
    if (cancelCurrent) {
      cancelCurrent();
      cancelCurrent = null;
    }

    const delay = Math.max(0, targetTime - Date.now());
    let cancelled = false;

    // event.waitUntil keeps the SW alive until the Promise resolves.
    // This prevents the browser/OS from terminating the SW mid-timer.
    event.waitUntil(
      new Promise((resolve) => {
        const timerId = setTimeout(async () => {
          cancelCurrent = null;
          if (cancelled) { resolve(); return; }

          // Show OS-level notification (works with screen off on Android;
          // on iOS 16.4+ PWA when added to home screen)
          try {
            await self.registration.showNotification('¡Recuperación completada! 💪', {
              body: '¡Es hora de tu siguiente serie!',
              icon: '/vite.svg',
              badge: '/vite.svg',
              vibrate: [500, 200, 500, 200, 800],
              tag: 'rest-timer',
              renotify: true,
              requireInteraction: false,
            });
          } catch (_) { /* permission may have been revoked */ }

          // Notify any open clients so they can play audio if visible
          try {
            const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            for (const client of clients) {
              client.postMessage({ type: 'TIMER_FIRED' });
            }
          } catch (_) {}

          resolve();
        }, delay);

        // Expose cancellation: clear timeout + mark cancelled + resolve promise
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
