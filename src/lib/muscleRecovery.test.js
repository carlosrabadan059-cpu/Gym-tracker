import { describe, it, expect } from 'vitest';
import {
    computeMuscleRecovery,
    FULL_FATIGUE_SETS,
    SECONDARY_SET_WEIGHT,
    RECOVERY_HOURS,
} from './muscleRecovery';
import { MUSCLE_VOCABULARY } from './muscleTaxonomy';

const AHORA = new Date('2026-09-16T12:00:00Z');
const hoursAgo = (h) => new Date(AHORA.getTime() - h * 3600000).toISOString();

const sesion = (date, logs) => ({ date, logs });
const series = (n) => {
    const setsData = {};
    const completedSets = {};
    for (let i = 0; i < n; i++) {
        setsData[i] = { weight: '50', reps: '10' };
        completedSets[i] = true;
    }
    return { setsData, completedSets };
};

const find = (result, category) => result.find(r => r.category === category);

describe('computeMuscleRecovery', () => {
    it('sin sesiones, los 8 grupos salen al 100% y frescos', () => {
        const result = computeMuscleRecovery([], {}, AHORA);
        expect(result).toHaveLength(MUSCLE_VOCABULARY.length);
        expect(result.every(r => r.recovery === 100)).toBe(true);
        expect(result.every(r => r.state === 'fresco')).toBe(true);
    });

    it('devuelve siempre los 8 grupos aunque solo se entrene uno', () => {
        const logs = [sesion(hoursAgo(1), { 1: series(4) })];
        const map = { 1: { category: 'Pecho', secondary_muscles: [] } };
        const result = computeMuscleRecovery(logs, map, AHORA);
        expect(result.map(r => r.category).sort()).toEqual([...MUSCLE_VOCABULARY].sort());
    });

    it('el grupo principal se fatiga mas que el secundario', () => {
        // A hora cero no hay decaimiento, así que la proporción es exacta.
        // Con horas de por medio no lo sería: Pecho tiene ventana de 72h y
        // Tríceps de 48h, y cada uno decae a su ritmo.
        const logs = [sesion(hoursAgo(0), { 1: series(6) })];
        const map = { 1: { category: 'Pecho', secondary_muscles: ['Tríceps'] } };
        const result = computeMuscleRecovery(logs, map, AHORA);

        const pecho = find(result, 'Pecho');
        const triceps = find(result, 'Tríceps');
        expect(pecho.recovery).toBeLessThan(triceps.recovery);
        expect(triceps.fatigue).toBeCloseTo(pecho.fatigue * SECONDARY_SET_WEIGHT, 5);
    });

    it('la fatiga decae con las horas: la misma sesion resta menos cuanto mas antigua', () => {
        const map = { 1: { category: 'Pecho', secondary_muscles: [] } };
        const reciente = computeMuscleRecovery([sesion(hoursAgo(2), { 1: series(6) })], map, AHORA);
        const antigua = computeMuscleRecovery([sesion(hoursAgo(48), { 1: series(6) })], map, AHORA);
        expect(find(reciente, 'Pecho').recovery).toBeLessThan(find(antigua, 'Pecho').recovery);
    });

    it('fuera de la ventana no resta nada', () => {
        const map = { 1: { category: 'Pecho', secondary_muscles: [] } };
        const logs = [sesion(hoursAgo(RECOVERY_HOURS.Pecho + 1), { 1: series(10) })];
        expect(find(computeMuscleRecovery(logs, map, AHORA), 'Pecho').recovery).toBe(100);
    });

    it('aplica la ventana corta a los grupos pequenos y la larga a los grandes', () => {
        expect(RECOVERY_HOURS['Bíceps']).toBe(48);
        expect(RECOVERY_HOURS.Pierna).toBe(72);

        // A las 60h, el biceps (ventana 48h) ya esta recuperado y la
        // pierna (ventana 72h) todavia no.
        const logs = [sesion(hoursAgo(60), { 1: series(8), 2: series(8) })];
        const map = {
            1: { category: 'Bíceps', secondary_muscles: [] },
            2: { category: 'Pierna', secondary_muscles: [] },
        };
        const result = computeMuscleRecovery(logs, map, AHORA);
        expect(find(result, 'Bíceps').recovery).toBe(100);
        expect(find(result, 'Pierna').recovery).toBeLessThan(100);
    });

    it('la recuperacion nunca baja de 0 por mucho volumen que se acumule', () => {
        const logs = [sesion(hoursAgo(0.5), { 1: series(60) })];
        const map = { 1: { category: 'Pecho', secondary_muscles: [] } };
        expect(find(computeMuscleRecovery(logs, map, AHORA), 'Pecho').recovery).toBe(0);
    });

    it('asigna el estado segun el umbral', () => {
        const map = { 1: { category: 'Pecho', secondary_muscles: [] } };
        const recoveryFor = (sets) => {
            const result = computeMuscleRecovery([sesion(hoursAgo(0), { 1: series(sets) })], map, AHORA);
            return find(result, 'Pecho');
        };
        // A hora cero no hay decaimiento: fatiga = series.
        expect(recoveryFor(FULL_FATIGUE_SETS).state).toBe('fatigado');       // 0%
        expect(recoveryFor(Math.round(FULL_FATIGUE_SETS / 2)).state).toBe('parcial'); // ~50%
        expect(recoveryFor(1).state).toBe('fresco');                          // ~92%
    });

    it('ordena de menos a mas recuperado', () => {
        const logs = [sesion(hoursAgo(1), { 1: series(8), 2: series(2) })];
        const map = {
            1: { category: 'Pierna', secondary_muscles: [] },
            2: { category: 'Pecho', secondary_muscles: [] },
        };
        const result = computeMuscleRecovery(logs, map, AHORA);
        expect(result[0].category).toBe('Pierna');
        expect(result[1].category).toBe('Pecho');
        for (let i = 1; i < result.length; i++) {
            expect(result[i].recovery).toBeGreaterThanOrEqual(result[i - 1].recovery);
        }
    });

    it('ignora cardio, workoutDuration y ejercicios sin mapear', () => {
        const logs = [sesion(hoursAgo(1), {
            1: series(4),
            999: series(10),
            cardio: { type: 'Elíptica', duration: 10 },
            workoutDuration: { durationMinutes: 60 },
        })];
        const map = { 1: { category: 'Pecho', secondary_muscles: [] } };
        const result = computeMuscleRecovery(logs, map, AHORA);
        // Solo Pecho se ve afectado; el id 999 no mapea a ningun grupo.
        expect(result.filter(r => r.recovery < 100)).toHaveLength(1);
        expect(find(result, 'Pecho').recovery).toBeLessThan(100);
    });

    it('tolera logs nulos y mapa vacio', () => {
        expect(computeMuscleRecovery(null, null, AHORA)).toHaveLength(MUSCLE_VOCABULARY.length);
    });
});
