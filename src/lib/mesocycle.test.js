// src/lib/mesocycle.test.js
import { describe, it, expect } from 'vitest';
import { getCurrentMesocycleWeek, applyMesocycleWeek, getMesocycleStatus, getMesocycleAlert } from './mesocycle';

describe('getCurrentMesocycleWeek', () => {
    it('returns null without a start date', () => {
        expect(getCurrentMesocycleWeek(null, new Date('2026-09-15'))).toBeNull();
        expect(getCurrentMesocycleWeek(undefined, new Date('2026-09-15'))).toBeNull();
    });

    it('returns week 1 on the start date itself', () => {
        expect(getCurrentMesocycleWeek('2026-09-15', new Date('2026-09-15'))).toBe(1);
    });

    it('returns week 2 after exactly 7 days', () => {
        expect(getCurrentMesocycleWeek('2026-09-15', new Date('2026-09-22'))).toBe(2);
    });

    it('returns week 2 at 13 days and week 3 at 14 days', () => {
        expect(getCurrentMesocycleWeek('2026-09-15', new Date('2026-09-28'))).toBe(2);
        expect(getCurrentMesocycleWeek('2026-09-15', new Date('2026-09-29'))).toBe(3);
    });

    it('treats a future start date as week 1, never negative or zero', () => {
        expect(getCurrentMesocycleWeek('2026-10-01', new Date('2026-09-15'))).toBe(1);
    });

    it('is not shifted by a non-midnight local time on today', () => {
        expect(getCurrentMesocycleWeek('2026-09-15', new Date('2026-09-22T23:30:00'))).toBe(2);
    });
});

describe('applyMesocycleWeek', () => {
    const base = { id: 'ex1', series: '3', reps: '10', target_weight: 40, target_rir: 3, rest_seconds: 90 };

    it('returns the exercise unchanged without a week number', () => {
        expect(applyMesocycleWeek({ ...base, weekly_progression: [{ week: 1, series: 4, reps: 8, target_weight: 60, target_rir: 2 }] }, null)).toEqual(
            { ...base, weekly_progression: [{ week: 1, series: 4, reps: 8, target_weight: 60, target_rir: 2 }] }
        );
    });

    it('returns the exercise unchanged without weekly_progression', () => {
        expect(applyMesocycleWeek(base, 2)).toEqual(base);
        expect(applyMesocycleWeek({ ...base, weekly_progression: [] }, 2)).toEqual({ ...base, weekly_progression: [] });
    });

    it('applies the exact week when it exists', () => {
        const ex = {
            ...base,
            weekly_progression: [
                { week: 1, series: 4, reps: 8, target_weight: 60, target_rir: 3 },
                { week: 2, series: 4, reps: 6, target_weight: 65, target_rir: 2 },
            ],
        };
        const result = applyMesocycleWeek(ex, 2);
        expect(result.series).toBe(4);
        expect(result.reps).toBe(6);
        expect(result.target_weight).toBe(65);
        expect(result.target_rir).toBe(2);
        expect(result.rest_seconds).toBe(90);
    });

    it('freezes at the last defined week once the current week exceeds it', () => {
        const ex = {
            ...base,
            weekly_progression: [
                { week: 1, series: 4, reps: 8, target_weight: 60, target_rir: 3 },
                { week: 2, series: 4, reps: 6, target_weight: 65, target_rir: 2 },
            ],
        };
        const result = applyMesocycleWeek(ex, 5);
        expect(result.target_weight).toBe(65);
        expect(result.reps).toBe(6);
    });

    it('leaves the exercise unchanged before the first defined week', () => {
        const ex = { ...base, weekly_progression: [{ week: 2, series: 4, reps: 6, target_weight: 65, target_rir: 2 }] };
        expect(applyMesocycleWeek(ex, 1)).toEqual(ex);
    });

    it('sorts unordered entries before picking', () => {
        const ex = {
            ...base,
            weekly_progression: [
                { week: 2, series: 4, reps: 6, target_weight: 65, target_rir: 2 },
                { week: 1, series: 4, reps: 8, target_weight: 60, target_rir: 3 },
            ],
        };
        expect(applyMesocycleWeek(ex, 1).target_weight).toBe(60);
        expect(applyMesocycleWeek(ex, 2).target_weight).toBe(65);
    });
});

describe('getMesocycleStatus', () => {
    // Mesociclo de Carlos: empieza el lunes 12 de octubre, 8 semanas.
    const at = (d) => getMesocycleStatus('2026-10-12', 8, new Date(`${d}T10:00:00`));

    it('null sin fecha de inicio o sin duración', () => {
        expect(getMesocycleStatus(null, 8, new Date('2026-10-12'))).toBeNull();
        expect(getMesocycleStatus('2026-10-12', null, new Date('2026-10-12'))).toBeNull();
    });

    it('semana 1 de 8 el primer día, y termina el domingo de la semana 8', () => {
        expect(at('2026-10-12')).toEqual({ week: 1, total: 8, endDate: '2026-12-06', state: 'active' });
    });

    it('la semana 7 aún no es la última', () => {
        expect(at('2026-11-29')).toMatchObject({ week: 7, state: 'active' });
    });

    it('última semana desde el lunes de la semana 8 hasta su domingo', () => {
        expect(at('2026-11-30')).toMatchObject({ week: 8, state: 'last' });
        expect(at('2026-12-06')).toMatchObject({ week: 8, state: 'last' });
    });

    it('terminado al día siguiente del último, sin pasar de la semana 8', () => {
        expect(at('2026-12-07')).toMatchObject({ week: 8, state: 'finished' });
        expect(at('2027-01-20')).toMatchObject({ week: 8, state: 'finished' });
    });
});

describe('getMesocycleAlert', () => {
    const r = (start, weeks) => ({ mesocycle_start_date: start, mesocycle_weeks: weeks });
    const today = new Date('2026-12-02T10:00:00');

    it('null si ningún mesociclo está en su última semana ni terminado', () => {
        expect(getMesocycleAlert([r('2026-11-30', 8), r(null, 8), r('2026-10-12', null)], today)).toBeNull();
    });

    it('avisa de la última semana', () => {
        expect(getMesocycleAlert([r('2026-11-30', 8), r('2026-10-12', 8)], today)).toMatchObject({ state: 'last', endDate: '2026-12-06' });
    });

    it('terminado gana a última semana', () => {
        expect(getMesocycleAlert([r('2026-10-12', 8), r('2026-10-05', 8)], today)).toMatchObject({ state: 'finished', endDate: '2026-11-29' });
    });
});
