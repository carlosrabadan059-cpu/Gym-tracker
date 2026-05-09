// Service Worker — Rest Timer Notifications
// Dual-timer approach: primary setTimeout + backup setInterval every 5s.
// The interval acts as a safety net if iOS suspends the primary timer.

let activeTimer = null; // { timeoutId, intervalId, targetTime, resolve }

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ── Web Push from server (works even with locked iPhone) ──
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(
        data.title || '¡Recuperación completada! 💪',
        {
          body: data.body || '¡Es hora de tu siguiente serie!',
          icon: data.icon || '/icon-192.png',
          badge: data.badge || '/icon-192.png',
          vibrate: [500, 200, 500, 200, 800],
          tag: 'rest-timer-push',
          renotify: true,
          requireInteraction: true,
        }
      );
      // Notify client to reset timer UI if open
      try {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach(c => c.postMessage({ type: 'TIMER_FIRED' }));
      } catch (e) {}
    })()
  );
});

async function fireCompletionNotification() {
  let isClientVisible = false;

  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (client.visibilityState === 'visible') isClientVisible = true;
      client.postMessage({ type: 'TIMER_FIRED' });
    }
  } catch (e) {}

  // Only show notification when app is in background/locked.
  // In foreground, the pre-scheduled Web Audio beep is sufficient.
  if (!isClientVisible) {
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
  }
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
