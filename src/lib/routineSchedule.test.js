import { describe, it, expect } from 'vitest';
import { WEEKDAY_LABELS, isRoutineScheduledForDay, splitRoutinesByToday } from './routineSchedule';

describe('WEEKDAY_LABELS', () => {
    it('tiene 7 días, orden L-M-X-J-V-S-D, valores 0-6 de getDay()', () => {
        expect(WEEKDAY_LABELS).toHaveLength(7);
        expect(WEEKDAY_LABELS.map(d => d.label)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
        expect(WEEKDAY_LABELS.map(d => d.value).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
});

describe('isRoutineScheduledForDay', () => {
    it('true si el día está en el array', () => {
        expect(isRoutineScheduledForDay([1, 3, 5], 3)).toBe(true);
    });

    it('false si el día no está en el array', () => {
        expect(isRoutineScheduledForDay([1, 3, 5], 2)).toBe(false);
    });

    it('false si scheduled_days es null', () => {
        expect(isRoutineScheduledForDay(null, 3)).toBe(false);
    });

    it('false si scheduled_days es un array vacío', () => {
        expect(isRoutineScheduledForDay([], 3)).toBe(false);
    });

    it('false si scheduled_days es undefined', () => {
        expect(isRoutineScheduledForDay(undefined, 3)).toBe(false);
    });
});

describe('splitRoutinesByToday', () => {
    it('separa rutinas de hoy y el resto', () => {
        const routines = [
            { id: 'a', scheduled_days: [1, 3, 5] },
            { id: 'b', scheduled_days: [2, 4] },
            { id: 'c', scheduled_days: null },
        ];
        const { today, rest } = splitRoutinesByToday(routines, 1);
        expect(today.map(r => r.id)).toEqual(['a']);
        expect(rest.map(r => r.id)).toEqual(['b', 'c']);
    });

    it('todas caen en rest si ninguna coincide con hoy', () => {
        const routines = [
            { id: 'a', scheduled_days: [1] },
            { id: 'b', scheduled_days: null },
        ];
        const { today, rest } = splitRoutinesByToday(routines, 6);
        expect(today).toEqual([]);
        expect(rest.map(r => r.id)).toEqual(['a', 'b']);
    });

    it('varias rutinas pueden coincidir con hoy a la vez, preservando orden', () => {
        const routines = [
            { id: 'a', scheduled_days: [2] },
            { id: 'b', scheduled_days: [2, 4] },
            { id: 'c', scheduled_days: [5] },
        ];
        const { today, rest } = splitRoutinesByToday(routines, 2);
        expect(today.map(r => r.id)).toEqual(['a', 'b']);
        expect(rest.map(r => r.id)).toEqual(['c']);
    });

    it('lista vacía de entrada da listas vacías', () => {
        expect(splitRoutinesByToday([], 3)).toEqual({ today: [], rest: [] });
    });
});
