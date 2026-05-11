// Service Worker — Rest Timer Notifications
// Dual-timer approach: primary setTimeout + backup setInterval every 5s.
// The interval acts as a safety net if iOS suspends the primary timer.

let activeTimer = null; // { timeoutId, intervalId, targetTime, resolve }
let lastNotificationTime = 0; // For deduplication

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/**
 * Shows a notification only if another one hasn't been shown recently.
 * This prevents double-notifications from local timer + server push.
 */
async function showDeduplicatedNotification(title, options) {
  const now = Date.now();
  // 2-second window to catch duplicates
  if (now - lastNotificationTime < 2000) {
    console.log('[SW] Suppressing duplicate notification');
    return;
  }
  lastNotificationTime = now;
  return self.registration.showNotification(title, {
    ...options,
    tag: 'gym-rest-timer', // Ensure consistent tag for collapsing
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
      // Check if any client is visible
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const isClientVisible = clients.some(c => c.visibilityState === 'visible');

      // Only show notification if app is in background
      if (!isClientVisible) {
        await showDeduplicatedNotification(
          data.title || '¡Recuperación completada! 💪',
          {
            body: data.body || '¡Es hora de tu siguiente serie!',
            icon: data.icon || '/icon-192.png',
            badge: data.badge || '/icon-192.png',
            vibrate: [500, 200, 500, 200, 800],
          }
        );
      }

      // Always notify client to reset timer UI if open
      clients.forEach(c => c.postMessage({ type: 'TIMER_FIRED' }));
    })()
  );
});


async function fireCompletionNotification(title, body) {
  let isClientVisible = false;

  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (client.visibilityState === 'visible') isClientVisible = true;
      client.postMessage({ type: 'TIMER_FIRED' });
    }
  } catch (e) {}

  // Local timer fallback: wait a moment to see if a Push notification arrives first.
  // This helps deduplication if both fire at the same time.
  await new Promise(r => setTimeout(r, 800));

  if (!isClientVisible) {
    try {
      await showDeduplicatedNotification(title || '¡Recuperación completada! 💪', {
        body: body || '¡Es hora de tu siguiente serie!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [500, 200, 500, 200, 800],
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
        await fireCompletionNotification(title, body);
        resolve();
      };

      // Handle immediate start notification if delay is < 1s
      if (isStart && delay < 1000) {
        await fireCompletionNotification(title, body);
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
