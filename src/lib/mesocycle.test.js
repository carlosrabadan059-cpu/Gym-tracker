// src/lib/mesocycle.test.js
import { describe, it, expect } from 'vitest';
import { getCurrentMesocycleWeek, applyMesocycleWeek } from './mesocycle';

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
