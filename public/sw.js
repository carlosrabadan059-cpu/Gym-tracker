// Service Worker — Rest Timer Notifications
// Handles background timer notifications independent of main page throttling.

let pendingTimer = null;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  const { type, targetTime } = event.data || {};

  if (type === 'SCHEDULE_NOTIFICATION') {
    // Cancel any previous pending timer
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }

    const delay = Math.max(0, targetTime - Date.now());

    pendingTimer = setTimeout(async () => {
      pendingTimer = null;

      // Show native notification (works even with screen off on Android;
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
      } catch (e) {
        // showNotification can fail if permission was revoked
      }

      // Tell the main page so it can play audio + vibrate if it's visible
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        client.postMessage({ type: 'TIMER_FIRED' });
      }
    }, delay);
  }

  if (type === 'CANCEL_NOTIFICATION') {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
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
