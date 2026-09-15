// Consentimiento del cliente para compartir peso corporal y kcal reales de
// sesión con su entrenador (Fase 5 del plan de entrenador). Funciones puras:
// los componentes que sí tocan Supabase (DashboardView, PrivacyView,
// ClientsListView, ClientProfileView) las usan para decidir qué mostrar o
// qué enviar, sin duplicar la comparación en cada sitio.

/**
 * @param {'pending'|'granted'|'denied'|null|undefined} healthConsent
 * @returns {boolean}
 */
export function canShowHealthData(healthConsent) {
    return healthConsent === 'granted';
}

/**
 * Copy del banner que ve el CLIENTE mientras no ha respondido. `null` si ya
 * respondió (nada que mostrar) o si todavía no se sabe el nombre del
 * entrenador (fila sin cargar).
 *
 * @param {'pending'|'granted'|'denied'|null|undefined} healthConsent
 * @param {string|null|undefined} trainerName
 * @returns {{title: string, body: string} | null}
 */
export function getHealthConsentBannerCopy(healthConsent, trainerName) {
    if (healthConsent !== 'pending' || !trainerName) return null;
    return {
        title: 'Compartir datos de salud',
        body: `${trainerName} quiere ver tu peso corporal y las calorías reales de tus sesiones. Puedes cambiarlo cuando quieras desde Privacidad y Seguridad.`,
    };
}

/**
 * Fila de `notifications` que se inserta al vincular un cliente nuevo —
 * mismo patrón que buildCommentNotificationPayload en exerciseComments.js.
 *
 * @param {{recipientId: string, trainerName: string}} params
 */
export function buildHealthConsentRequestPayload({ recipientId, trainerName }) {
    return {
        user_id: recipientId,
        title: 'Tu entrenador quiere ver tus datos de salud',
        message: `${trainerName} te ha añadido como cliente y le gustaría ver tu peso corporal y las calorías reales de tus sesiones. Puedes decidirlo desde tu Perfil > Privacidad y Seguridad.`,
        type: 'health_consent_request',
    };
}
