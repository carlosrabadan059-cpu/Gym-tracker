import { describe, it, expect } from 'vitest';
import { summarizeWorkoutHistory, matchDraftExercisesToCatalog, buildRoutineDraftPayload } from './trainerUtils';

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
        expect(summarizeWorkoutHistory(logs, { day1: 'Día 1' })).toBe('2026-09-01 · Día 1 · 1 ejercicio');
    });

    it('usa "1 ejercicio" en singular cuando solo hay un ejercicio contado', () => {
        const logs = [
            { routine_id: 'day1', date: '2026-09-03T00:00:00+00:00', logs: { '1': {} } },
        ];
        expect(summarizeWorkoutHistory(logs, { day1: 'Día 1' })).toBe('2026-09-03 · Día 1 · 1 ejercicio');
    });

    it('usa un texto de fecha desconocida si falta log.date, sin lanzar error', () => {
        const logs = [{ routine_id: 'day1', date: null, logs: { a: {} } }];
        expect(summarizeWorkoutHistory(logs, { day1: 'Día 1' })).toBe('fecha desconocida · Día 1 · 1 ejercicio');
    });

    it('no lanza error si nameById es undefined', () => {
        const logs = [{ routine_id: 'day1', date: '2026-09-01T00:00:00+00:00', logs: {} }];
        expect(summarizeWorkoutHistory(logs)).toBe('2026-09-01 · day1 · 0 ejercicios');
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

describe('matchDraftExercisesToCatalog', () => {
    const catalog = [
        { id: 1, name: 'Sentadilla trasera', image_url: 'img1.jpg' },
        { id: 2, name: 'Press banca', image_url: null },
    ];

    it('casa por nombre exacto y arma el objeto con la forma de selectedExercises', () => {
        const draft = [
            { catalogName: 'Sentadilla trasera', series: 4, reps: 8, target_weight: 60, target_rir: 2, rest_seconds: 120, notes: null, motivo: 'Prioridad de pierna.' },
        ];
        const { matched, unmatched } = matchDraftExercisesToCatalog(draft, catalog);
        expect(unmatched).toEqual([]);
        expect(matched).toEqual([{
            catalog_id: 1,
            name: 'Sentadilla trasera',
            image_url: 'img1.jpg',
            series: 4,
            reps: 8,
            target_weight: 60,
            target_rir: 2,
            rest_seconds: 120,
            notes: null,
            motivo: 'Prioridad de pierna.',
        }]);
    });

    it('casa sin distinguir mayúsculas ni espacios sobrantes', () => {
        const draft = [{ catalogName: '  press banca  ', series: 3, reps: 10 }];
        const { matched, unmatched } = matchDraftExercisesToCatalog(draft, catalog);
        expect(unmatched).toEqual([]);
        expect(matched[0].catalog_id).toBe(2);
    });

    it('devuelve el nombre en unmatched cuando no hay ningún ejercicio del catálogo con ese nombre', () => {
        const draft = [{ catalogName: 'Ejercicio inventado', series: 3, reps: 10 }];
        const { matched, unmatched } = matchDraftExercisesToCatalog(draft, catalog);
        expect(matched).toEqual([]);
        expect(unmatched).toEqual(['Ejercicio inventado']);
    });

    it('aplica defaults de series/reps cuando la IA no los manda', () => {
        const draft = [{ catalogName: 'Press banca' }];
        const { matched } = matchDraftExercisesToCatalog(draft, catalog);
        expect(matched[0].series).toBe(3);
        expect(matched[0].reps).toBe(10);
    });

    it('devuelve listas vacías si el borrador no trae ejercicios', () => {
        expect(matchDraftExercisesToCatalog([], catalog)).toEqual({ matched: [], unmatched: [] });
        expect(matchDraftExercisesToCatalog(null, catalog)).toEqual({ matched: [], unmatched: [] });
    });
});

describe('buildRoutineDraftPayload', () => {
    it('rellena defaults para los campos opcionales que falten', () => {
        const payload = buildRoutineDraftPayload({
            exerciseNames: ['Sentadilla trasera'],
            recentHistorySummary: 'Sin historial de entrenamientos registrado.',
        });
        expect(payload).toEqual({
            clientGoal: 'No especificado',
            level: 'intermedio',
            daysPerWeek: null,
            equipment: 'No especificado',
            limitations: 'Ninguna',
            exerciseNames: ['Sentadilla trasera'],
            recentHistorySummary: 'Sin historial de entrenamientos registrado.',
        });
    });

    it('usa los valores dados cuando vienen informados', () => {
        const payload = buildRoutineDraftPayload({
            clientGoal: 'Hipertrofia',
            level: 'avanzado',
            daysPerWeek: '5',
            equipment: 'mancuernas en casa',
            limitations: 'molestia en el hombro',
            exerciseNames: ['Press banca'],
            recentHistorySummary: '2026-09-10 · Día 4 · 8 ejercicios',
        });
        expect(payload.clientGoal).toBe('Hipertrofia');
        expect(payload.daysPerWeek).toBe(5);
    });
});
