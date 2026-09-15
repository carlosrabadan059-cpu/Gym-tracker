import { describe, it, expect } from 'vitest';
import { computeWeeklyMuscleVolume, UNCLASSIFIED_GROUP } from './muscleVolume';

// Semana de referencia: lunes 2026-09-14 a domingo 2026-09-20.
const MIERCOLES = new Date('2026-09-16T12:00:00Z');

const sesion = (date, logs) => ({ date, routineId: 'r1', logs });
const serie = (n, done = true) => {
    const setsData = {};
    const completedSets = {};
    for (let i = 0; i < n; i++) {
        setsData[i] = { weight: '50', reps: '10' };
        completedSets[i] = done;
    }
    return { setsData, completedSets };
};

describe('computeWeeklyMuscleVolume', () => {
    it('suma series de varios ejercicios del mismo grupo', () => {
        const logs = [
            sesion('2026-09-14T10:00:00Z', { 1: serie(4), 2: serie(3) }),
            sesion('2026-09-16T10:00:00Z', { 1: serie(2) }),
        ];
        const result = computeWeeklyMuscleVolume(logs, { 1: 'Pecho', 2: 'Pecho' }, MIERCOLES);
        expect(result).toEqual([{ category: 'Pecho', sets: 9 }]);
    });

    it('excluye sesiones de la semana anterior y de la siguiente', () => {
        const logs = [
            sesion('2026-09-13T10:00:00Z', { 1: serie(5) }), // domingo anterior
            sesion('2026-09-16T10:00:00Z', { 1: serie(3) }), // dentro
            sesion('2026-09-21T10:00:00Z', { 1: serie(7) }), // lunes siguiente
        ];
        const result = computeWeeklyMuscleVolume(logs, { 1: 'Dorsal' }, MIERCOLES);
        expect(result).toEqual([{ category: 'Dorsal', sets: 3 }]);
    });

    it('cuenta solo las series marcadas como completadas', () => {
        const logs = [sesion('2026-09-16T10:00:00Z', {
            1: {
                setsData: { 0: { reps: '10' }, 1: { reps: '10' }, 2: { reps: '10' } },
                completedSets: { 0: true, 1: false, 2: true },
            },
        })];
        const result = computeWeeklyMuscleVolume(logs, { 1: 'Hombro' }, MIERCOLES);
        expect(result).toEqual([{ category: 'Hombro', sets: 2 }]);
    });

    it('sin completedSets, cuenta las series con reps registradas', () => {
        const logs = [sesion('2026-09-16T10:00:00Z', {
            1: { setsData: { 0: { reps: '10' }, 1: { reps: '0' }, 2: { reps: '12' } } },
        })];
        const result = computeWeeklyMuscleVolume(logs, { 1: 'Pierna' }, MIERCOLES);
        expect(result).toEqual([{ category: 'Pierna', sets: 2 }]);
    });

    it('agrupa como "Sin clasificar" los ejercicios sin categoría conocida', () => {
        const logs = [sesion('2026-09-16T10:00:00Z', { 1: serie(2), 99: serie(3) })];
        const result = computeWeeklyMuscleVolume(logs, { 1: 'Bíceps' }, MIERCOLES);
        expect(result).toEqual([
            { category: UNCLASSIFIED_GROUP, sets: 3 },
            { category: 'Bíceps', sets: 2 },
        ]);
    });

    it('ordena de más a menos series', () => {
        const logs = [sesion('2026-09-16T10:00:00Z', { 1: serie(2), 2: serie(6), 3: serie(4) })];
        const result = computeWeeklyMuscleVolume(
            logs, { 1: 'Pecho', 2: 'Pierna', 3: 'Dorsal' }, MIERCOLES
        );
        expect(result.map(r => r.category)).toEqual(['Pierna', 'Dorsal', 'Pecho']);
    });

    it('ignora las claves cardio y workoutDuration', () => {
        const logs = [sesion('2026-09-16T10:00:00Z', {
            1: serie(3),
            cardio: { type: 'Elíptica', duration: 10, calories: 80 },
            workoutDuration: { durationMinutes: 60, realCalories: 400 },
        })];
        const result = computeWeeklyMuscleVolume(logs, { 1: 'Abdomen' }, MIERCOLES);
        expect(result).toEqual([{ category: 'Abdomen', sets: 3 }]);
    });

    it('devuelve array vacío si no hay sesiones esta semana', () => {
        const logs = [sesion('2026-09-01T10:00:00Z', { 1: serie(5) })];
        expect(computeWeeklyMuscleVolume(logs, { 1: 'Pecho' }, MIERCOLES)).toEqual([]);
    });

    it('tolera logs nulos o vacíos', () => {
        expect(computeWeeklyMuscleVolume(null, {}, MIERCOLES)).toEqual([]);
        expect(computeWeeklyMuscleVolume([], {}, MIERCOLES)).toEqual([]);
    });
});
