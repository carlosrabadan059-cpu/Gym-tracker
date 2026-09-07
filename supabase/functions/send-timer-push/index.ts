// Aviso de fin de descanso.
//
// El cliente llama aquí al marcar una serie; esta función espera hasta
// targetTime y manda un Web Push para que el aviso llegue aunque el iPhone
// esté bloqueado.
//
// Esta función NO es la causa de los avisos que fallaban. Se llegó a sospechar
// que la espera moría por el tope de duración del background task
// (EdgeRuntime.waitUntil), pero los logs del 7 de septiembre de 2026 lo
// descartan: 30 envíos en una sesión, 30 respuestas 201 de Apple, cero fallos,
// con descansos de ~60 s. El fallo estaba en public/sw.js, que recibía el push
// y no mostraba ninguna notificación si la app estaba en primer plano.
//
// Lo que sí aporta esta versión:
//   1. La clave privada VAPID sale del código fuente y se lee del entorno.
//   2. Todo intento queda registrado en push_log (antes los errores solo iban a
//      console.error de un background task que nadie mira).
//   3. Se reintenta el envío ante fallos transitorios.
//   4. Si la suscripción está muerta (404/410) se borra, para que el cliente
//      vuelva a suscribirse en vez de fallar en silencio para siempre. Esto
//      importa más ahora: incumplir userVisibleOnly puede hacer que iOS revoque
//      la suscripción, y conviene detectarlo.
//
// Sigue en pie que mantener viva una función durante minutos es frágil. Si
// alguna vez hacen falta descansos largos, la salida es un scheduler
// persistente (n8n tiene nodo Wait) o notificaciones locales nativas con el
// shell de Capacitor. Ver docs/plan-apple-health-integration.md, fase 4.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webPush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = 'BJnd9P2SuZH8YWq4aZXEj9TrmMSydxiXrxt41L0FdlMhGjUE4gyMWmH-sKKn32uOVzbVgY_vXrqS6JRl0qbT16U';
// La clave privada NO va en el código. Configúrala con:
//   supabase secrets set VAPID_PRIVATE_KEY=...
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Margen por debajo del tope de duración del background task. Con descansos de
// ~60 s no se alcanza nunca; queda como aviso por si algún día se alargan.
const MAX_SAFE_WAIT_MS = 140_000;
const SEND_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_000;

webPush.setVapidDetails('mailto:carlos@gymtracker.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    try {
        const { userId, targetTime } = await req.json();
        if (!userId || !targetTime) return json({ error: 'Missing userId or targetTime' }, 400);

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const { data: subData } = await supabase
            .from('push_subscriptions').select('subscription').eq('user_id', userId).single();
        if (!subData) return json({ error: 'No subscription found' }, 404);

        const waitMs = targetTime - Date.now();

        // Deja constancia desde ya: si el background task muere a mitad, esta
        // fila se queda en 'scheduled' y eso mismo es el diagnóstico.
        const { data: logRow } = await supabase
            .from('push_log')
            .insert({
                user_id: userId,
                target_time: new Date(targetTime).toISOString(),
                status: waitMs > MAX_SAFE_WAIT_MS ? 'too_long' : 'scheduled',
            })
            .select('id')
            .single();
        const logId = logRow?.id;

        const updateLog = async (patch: Record<string, unknown>) => {
            if (!logId) return;
            await supabase.from('push_log').update(patch).eq('id', logId);
        };

        const bgWork = (async () => {
            try {
                while (Date.now() < targetTime) {
                    const timeToWait = Math.min(targetTime - Date.now(), 5000);
                    if (timeToWait > 0) await new Promise(r => setTimeout(r, timeToWait));
                    // Heartbeat: evita que el hipervisor de Deno pause la función por inactividad.
                    try { await supabase.from('push_subscriptions').select('user_id').limit(1); } catch { /* ignorar */ }
                }

                const payload = JSON.stringify({
                    title: '¡Recuperación completada! 💪',
                    body: '¡Es hora de tu siguiente serie!',
                });

                let lastError: unknown = null;
                for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt++) {
                    try {
                        const result = await webPush.sendNotification(subData.subscription, payload);
                        await updateLog({
                            status: 'sent',
                            fired_at: new Date().toISOString(),
                            attempts: attempt,
                            status_code: result.statusCode,
                            delay_ms: Date.now() - targetTime,
                        });
                        return;
                    } catch (e: any) {
                        lastError = e;
                        const code = e?.statusCode;

                        // Suscripción muerta: reintentar no sirve de nada. Se borra
                        // para que el cliente cree una nueva en el próximo entreno.
                        if (code === 404 || code === 410) {
                            await supabase.from('push_subscriptions').delete().eq('user_id', userId);
                            await updateLog({
                                status: 'subscription_gone',
                                attempts: attempt,
                                status_code: code,
                                error: String(e?.message ?? e),
                            });
                            return;
                        }
                        if (attempt < SEND_ATTEMPTS) await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
                    }
                }

                await updateLog({
                    status: 'failed',
                    attempts: SEND_ATTEMPTS,
                    status_code: (lastError as any)?.statusCode ?? null,
                    error: String((lastError as any)?.message ?? lastError),
                });
            } catch (e: any) {
                await updateLog({ status: 'failed', error: String(e?.message ?? e) });
            }
        })();

        EdgeRuntime.waitUntil(bgWork);

        return json({ scheduled: true, targetTime, logId, warning: waitMs > MAX_SAFE_WAIT_MS ? 'wait exceeds safe background-task window' : undefined });
    } catch (err: any) {
        return json({ error: err.message }, 500);
    }
});
