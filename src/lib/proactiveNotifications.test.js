import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import { shouldNotifyInactivity, shouldNotifyWeeklyInsight } from './proactiveNotifications';

describe('shouldNotifyInactivity', () => {
    it('nunca entrenó (lastSessionDate null) -> false', () => {
        expect(shouldNotifyInactivity({ lastSessionDate: null, threshold: 7 })).toBe(false);
    });

    it('días desde la última sesión por debajo del umbral -> false', () => {
        const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
        expect(shouldNotifyInactivity({ lastSessionDate: threeDaysAgo, threshold: 7 })).toBe(false);
    });

    it('igual o por encima del umbral, sin notificación previa -> true', () => {
        const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
        expect(shouldNotifyInactivity({ lastSessionDate: tenDaysAgo, threshold: 7 })).toBe(true);
    });

    it('por encima del umbral, con notificación previa anterior a la última sesión -> true', () => {
        const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
        const twentyDaysAgo = new Date(Date.now() - 20 * 86400000).toISOString();
        expect(shouldNotifyInactivity({
            lastSessionDate: tenDaysAgo,
            threshold: 7,
            lastInactivityNotificationDate: twentyDaysAgo,
        })).toBe(true);
    });

    it('por encima del umbral, con notificación previa posterior a la última sesión -> false', () => {
        const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
        const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
        expect(shouldNotifyInactivity({
            lastSessionDate: tenDaysAgo,
            threshold: 7,
            lastInactivityNotificationDate: fiveDaysAgo,
        })).toBe(false);
    });
});

describe('shouldNotifyWeeklyInsight', () => {
    const weekStart = new Date('2026-09-14T00:00:00Z');

    it('0 sesiones esta semana -> false', () => {
        expect(shouldNotifyWeeklyInsight({ sessionCountThisWeek: 0, weekStart })).toBe(false);
    });

    it('1+ sesiones, sin notificación previa -> true', () => {
        expect(shouldNotifyWeeklyInsight({ sessionCountThisWeek: 2, weekStart })).toBe(true);
    });

    it('1+ sesiones, con notificación previa ya creada desde weekStart -> false', () => {
        const afterWeekStart = new Date('2026-09-15T00:00:00Z').toISOString();
        expect(shouldNotifyWeeklyInsight({
            sessionCountThisWeek: 2,
            weekStart,
            lastWeeklyInsightNotificationDate: afterWeekStart,
        })).toBe(false);
    });

    it('1+ sesiones, con notificación previa de una semana anterior -> true', () => {
        const beforeWeekStart = new Date('2026-09-07T00:00:00Z').toISOString();
        expect(shouldNotifyWeeklyInsight({
            sessionCountThisWeek: 2,
            weekStart,
            lastWeeklyInsightNotificationDate: beforeWeekStart,
        })).toBe(true);
    });
});
