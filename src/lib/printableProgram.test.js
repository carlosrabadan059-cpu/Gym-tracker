// src/lib/printableProgram.test.js
import { describe, it, expect } from 'vitest';
import { buildPrintableProgram, formatRest } from './printableProgram';

const TODAY = new Date('2026-10-08');

const ex = (over = {}) => ({
    id: 1, name: 'Press de banca', image_url: '/exercises/v2_pecho_9.png',
    series: '4', reps: '10', rest_seconds: null, tempo: null, notes: null,
    target_rir: null, superset_group_id: null, weekly_progression: null,
    ...over,
});

const assignment = (routine) => ({ id: routine.id, routine: { scheduled_days: null, mesocycle_start_date: null, ...routine } });

describe('formatRest', () => {
    it('formats seconds the way the paper sheet does', () => {
        expect(formatRest(90)).toBe('90"');
        expect(formatRest('60')).toBe('60"');
    });

    it('returns null without a rest', () => {
        expect(formatRest(null)).toBeNull();
        expect(formatRest('')).toBeNull();
        expect(formatRest(0)).toBeNull();
    });
});

describe('buildPrintableProgram', () => {
    it('fills the header from the client', () => {
        const program = buildPrintableProgram({ username: 'Carlos', goal: 'Hipertrofia' }, [], TODAY);
        expect(program.clientName).toBe('Carlos');
        expect(program.goal).toBe('Hipertrofia');
        expect(program.startDate).toBeNull();
        expect(program.durationWeeks).toBeNull();
        expect(program.days).toEqual([]);
    });

    it('orders days by their first scheduled weekday, Sunday last and unscheduled at the end', () => {
        const program = buildPrintableProgram({}, [
            assignment({ id: 'c', name: 'Sin día', exercises: [ex()] }),
            assignment({ id: 'b', name: 'Domingo', scheduled_days: [0], exercises: [ex()] }),
            assignment({ id: 'a', name: 'Martes', scheduled_days: [2], exercises: [ex()] }),
        ], TODAY);
        expect(program.days.map(d => d.name)).toEqual(['Martes', 'Domingo', 'Sin día']);
        expect(program.days.map(d => d.label)).toEqual(['Día 1', 'Día 2', 'Día 3']);
        expect(program.days[0].scheduledDays).toBe('Martes');
        expect(program.days[2].scheduledDays).toBeNull();
    });

    it('strips a "Día N -" prefix from the routine name', () => {
        const program = buildPrintableProgram({}, [
            assignment({ id: 'a', name: 'Dia 1 - Pecho / Hombro', exercises: [ex()] }),
            assignment({ id: 'b', name: 'Día 4: Biceps / Triceps', exercises: [ex()] }),
        ], TODAY);
        expect(program.days.map(d => d.name)).toEqual(['Pecho / Hombro', 'Biceps / Triceps']);
    });

    it('skips routines without exercises', () => {
        const program = buildPrintableProgram({}, [
            assignment({ id: 'a', name: 'Vacía', exercises: [] }),
            assignment({ id: 'b', name: 'Llena', exercises: [ex()] }),
        ], TODAY);
        expect(program.days.map(d => d.name)).toEqual(['Llena']);
    });

    it('maps each exercise to a numbered row', () => {
        const program = buildPrintableProgram({}, [
            assignment({ id: 'a', name: 'Pecho', exercises: [
                ex({ rest_seconds: 90, variant: 'Agarre cerrado', tempo: '3-1-2', notes: 'Codos altos', target_rir: 2 }),
                ex({ id: 2, name: 'Fondos', image_url: null }),
            ] }),
        ], TODAY);
        expect(program.days[0].exercises).toEqual([
            { number: 1, name: 'Press de banca', imageUrl: '/exercises/v2_pecho_9.png', variant: 'Agarre cerrado', series: '4', reps: '10', rest: '90"', observations: 'Codos altos · Tempo 3-1-2 · RIR 2', superset: null },
            { number: 2, name: 'Fondos', imageUrl: null, variant: null, series: '4', reps: '10', rest: null, observations: null, superset: null },
        ]);
    });

    it('labels supersets A, B... in order of appearance within the day', () => {
        const program = buildPrintableProgram({}, [
            assignment({ id: 'a', name: 'Pecho', exercises: [
                ex({ id: 1, superset_group_id: 'zzz' }),
                ex({ id: 2, superset_group_id: 'zzz' }),
                ex({ id: 3 }),
                ex({ id: 4, superset_group_id: 'aaa' }),
                ex({ id: 5, superset_group_id: 'aaa' }),
            ] }),
        ], TODAY);
        expect(program.days[0].exercises.map(e => e.superset)).toEqual(['A', 'A', null, 'B', 'B']);
    });

    it('uses the active mesocycle week and reports start date and duration', () => {
        const progression = [
            { week: 1, series: 3, reps: '12', target_rir: 3 },
            { week: 4, series: 4, reps: '8', target_rir: 1 },
            { week: 8, series: 2, reps: '10', target_rir: 4 },
        ];
        const program = buildPrintableProgram({}, [
            assignment({ id: 'a', name: 'Pecho', mesocycle_start_date: '2026-09-15', exercises: [ex({ weekly_progression: progression })] }),
            assignment({ id: 'b', name: 'Pierna', mesocycle_start_date: '2026-09-22', exercises: [ex()] }),
        ], TODAY);
        // 2026-09-15 → 2026-10-08 = 23 días: semana 4.
        const row = program.days[0].exercises[0];
        expect(row.series).toBe(4);
        expect(row.reps).toBe('8');
        expect(row.observations).toBe('RIR 1');
        expect(program.startDate).toBe('2026-09-15');
        expect(program.durationWeeks).toBe(8);
    });
});
