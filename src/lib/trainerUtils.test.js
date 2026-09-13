import { describe, it, expect } from 'vitest';
import { summarizeWorkoutHistory } from './trainerUtils';

describe('summarizeWorkoutHistory', () => {
    it('devuelve un texto sin historial cuando no hay logs', () => {
        expect(summarizeWorkoutHistory([], {})).toBe('Sin historial de entrenamientos registrado.');
        expect(summarizeWorkoutHistory(null, {})).toBe('Sin historial de entrenamientos registrado.');
    });

    it('resume fecha, nombre de rutina y número de ejercicios por sesión', () => {
        const logs = [
            {
                routine_id: 'day4',
                date: '2026-09-10T14:09:42.758+00:00',
                logs: { '1': {}, '2': {}, workoutDuration: { durationMinutes: 80 } },
            },
        ];
        const nameById = { day4: 'Día 4: Biceps / Triceps' };
        expect(summarizeWorkoutHistory(logs, nameById)).toBe(
            '2026-09-10 · Día 4: Biceps / Triceps · 2 ejercicios'
        );
    });

    it('no cuenta workoutDuration ni cardio como ejercicios', () => {
        const logs = [
            {
                routine_id: 'day1',
                date: '2026-09-01T10:00:00+00:00',
                logs: { '5': {}, workoutDuration: {}, cardio: {} },
            },
        ];
        expect(summarizeWorkoutHistory(logs, { day1: 'Día 1' })).toBe('2026-09-01 · Día 1 · 1 ejercicios');
    });

    it('usa el routine_id como nombre si no hay match en nameById', () => {
        const logs = [{ routine_id: 'custom_x', date: '2026-08-01T00:00:00+00:00', logs: {} }];
        expect(summarizeWorkoutHistory(logs, {})).toBe('2026-08-01 · custom_x · 0 ejercicios');
    });

    it('une varias sesiones con salto de línea', () => {
        const logs = [
            { routine_id: 'day1', date: '2026-09-02T00:00:00+00:00', logs: { a: {} } },
            { routine_id: 'day1', date: '2026-09-01T00:00:00+00:00', logs: { a: {}, b: {} } },
        ];
        const result = summarizeWorkoutHistory(logs, { day1: 'Día 1' });
        expect(result.split('\n')).toHaveLength(2);
    });
});
