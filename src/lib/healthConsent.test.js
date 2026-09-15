import { describe, it, expect } from 'vitest';
import { canShowHealthData, getHealthConsentBannerCopy, buildHealthConsentRequestPayload } from './healthConsent';

describe('canShowHealthData', () => {
    it('solo es true cuando el consentimiento está concedido', () => {
        expect(canShowHealthData('granted')).toBe(true);
    });

    it('es false para pending, denied, null o undefined', () => {
        expect(canShowHealthData('pending')).toBe(false);
        expect(canShowHealthData('denied')).toBe(false);
        expect(canShowHealthData(null)).toBe(false);
        expect(canShowHealthData(undefined)).toBe(false);
    });
});

describe('getHealthConsentBannerCopy', () => {
    it('devuelve null si ya se respondió (granted o denied)', () => {
        expect(getHealthConsentBannerCopy('granted', 'Ana')).toBeNull();
        expect(getHealthConsentBannerCopy('denied', 'Ana')).toBeNull();
    });

    it('sin nombre de entrenador sigue mostrando el aviso, con un genérico', () => {
        expect(getHealthConsentBannerCopy('pending', null).body).toContain('Tu entrenador');
        expect(getHealthConsentBannerCopy('pending', '').body).toContain('Tu entrenador');
    });

    it('devuelve title y body con el nombre del entrenador cuando está pending', () => {
        const copy = getHealthConsentBannerCopy('pending', 'Ana');
        expect(copy.title).toBe('Compartir datos de salud');
        expect(copy.body).toContain('Ana');
    });
});

describe('buildHealthConsentRequestPayload', () => {
    it('arma la fila de notifications para el cliente recién vinculado', () => {
        const payload = buildHealthConsentRequestPayload({ recipientId: 'client-1', trainerName: 'Ana' });
        expect(payload).toEqual({
            user_id: 'client-1',
            title: 'Tu entrenador quiere ver tus datos de salud',
            message: 'Ana te ha añadido como cliente y le gustaría ver tu peso corporal y las calorías reales de tus sesiones. Puedes decidirlo desde tu Perfil > Privacidad y Seguridad.',
            type: 'health_consent_request',
        });
    });
});
