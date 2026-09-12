import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeStreak, computeDaysSinceLastSession, INACTIVITY_ALERT_DAYS } from './adherence';

// Miércoles fijo a mediodía UTC — ancla estable para todos los tests,
// evita que "hoy" cambie según cuándo se ejecute la suite (TZ=UTC forzado
// por el script `test` de package.json).
const ANCHOR = new Date('2026-01-15T12:00:00.000Z');

function isoDaysAgo(n) {
    const d = new Date(ANCHOR);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString();
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(ANCHOR);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('computeStreak', () => {
    it('cuenta racha viva de varios días seguidos', () => {
        expect(computeStreak([isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(2)])).toBe(3);
    });

    it('se corta en un hueco de más de un día', () => {
        expect(computeStreak([isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(4)])).toBe(2);
    });

    it('racha muerta (última sesión anteayer) devuelve 0, no la racha vieja', () => {
        expect(computeStreak([isoDaysAgo(2), isoDaysAgo(3), isoDaysAgo(4)])).toBe(0);
    });

    it('sin sesiones devuelve 0', () => {
        expect(computeStreak([])).toBe(0);
    });

    it('fechas duplicadas del mismo día cuentan una sola vez', () => {
        expect(computeStreak([isoDaysAgo(0), isoDaysAgo(0), isoDaysAgo(1)])).toBe(2);
    });

    it('racha viva empezando ayer (sin sesión hoy todavía) también cuenta', () => {
        expect(computeStreak([isoDaysAgo(1), isoDaysAgo(2), isoDaysAgo(3)])).toBe(3);
    });
});

describe('computeDaysSinceLastSession', () => {
    it('sesión hoy son 0 días', () => {
        expect(computeDaysSinceLastSession([isoDaysAgo(0)])).toBe(0);
    });

    it('sesión ayer es 1 día', () => {
        expect(computeDaysSinceLastSession([isoDaysAgo(1)])).toBe(1);
    });

    it('usa la fecha más reciente, no la primera del array', () => {
        expect(computeDaysSinceLastSession([isoDaysAgo(5), isoDaysAgo(2)])).toBe(2);
    });

    it('sin sesiones devuelve null', () => {
        expect(computeDaysSinceLastSession([])).toBeNull();
    });
});

describe('INACTIVITY_ALERT_DAYS', () => {
    it('es 7', () => {
        expect(INACTIVITY_ALERT_DAYS).toBe(7);
    });
});
