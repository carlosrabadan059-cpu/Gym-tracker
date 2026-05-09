import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = 'BOABd1tyZIeOvxKWzukzIf8bmMKRkZ4oZ80KlGhA4ZIrtm8uQQ43-OE8Xamv9T3D1vNkM8X88Q-Qp7ysU7tafQk';

/**
 * Converts a URL-safe base64 string to a Uint8Array.
 * Required for PushManager.subscribe() applicationServerKey.
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Subscribes the user to Web Push notifications and saves the
 * subscription to Supabase. Returns true on success.
 */
export async function subscribeToPush(userId) {
    if (!('serviceWorker' in navigator)) {
        console.warn('[Push] No serviceWorker support');
        return false;
    }
    if (!('PushManager' in window)) {
        console.warn('[Push] No PushManager support');
        return false;
    }

    try {
        console.log('[Push] Getting SW registration...');
        const registration = await navigator.serviceWorker.ready;
        console.log('[Push] SW ready. Checking existing subscription...');

        let subscription = await registration.pushManager.getSubscription();
        console.log('[Push] Existing subscription:', !!subscription);

        if (!subscription) {
            console.log('[Push] Subscribing with VAPID key...');
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
            console.log('[Push] Subscribed successfully:', subscription.endpoint?.substring(0, 50));
        }

        console.log('[Push] Saving to Supabase...');
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: userId,
                subscription: subscription.toJSON(),
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

        if (error) {
            console.error('[Push] Supabase upsert error:', error);
            throw error;
        }
        console.log('[Push] ✅ Subscription saved to DB');
        return true;
    } catch (err) {
        console.error('[Push] Subscription failed:', err.name, err.message);
        return false;
    }
}

/**
 * Schedules a push notification to fire at the given targetTime (epoch ms).
 * Calls the Supabase Edge Function which sleeps until targetTime, then
 * sends the Web Push notification to wake the SW even on a locked iPhone.
 */
export async function scheduleServerPush(userId, targetTime) {
    try {
        console.log('[Push] Scheduling server push for', new Date(targetTime).toLocaleTimeString());
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.warn('[Push] No session, cannot schedule');
            return false;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

        const response = await fetch(`${supabaseUrl}/functions/v1/send-timer-push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ userId, targetTime }),
        });

        const result = await response.json();
        console.log('[Push] Server response:', response.status, result);
        return response.ok;
    } catch (err) {
        console.error('[Push] Failed to schedule server push:', err);
        return false;
    }
}
