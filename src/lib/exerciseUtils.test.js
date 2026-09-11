import { describe, it, expect } from 'vitest';
import { isBodyweightExercise, isTimeBasedExercise } from './exerciseUtils';

describe('isBodyweightExercise', () => {
    describe('vía catalog_id (fuente de verdad)', () => {
        it('reconoce los IDs del catálogo de peso corporal', () => {
            expect(isBodyweightExercise({ catalog_id: 84 })).toBe(true);
            expect(isBodyweightExercise({ catalog_id: 94 })).toBe(true);
        });

        it('acepta el catalog_id como string (viene así de Supabase)', () => {
            expect(isBodyweightExercise({ catalog_id: '85' })).toBe(true);
        });

        it('92 no está en la lista aunque esté dentro del rango 84-94', () => {
            expect(isBodyweightExercise({ catalog_id: 92 })).toBe(false);
        });

        it('el catalog_id gana sobre el nombre', () => {
            // Nombre que el heurístico marcaría como peso corporal, pero el catálogo manda.
            expect(isBodyweightExercise({ catalog_id: 1, name: 'Plancha' })).toBe(false);
        });
    });

    describe('vía heurístico de nombre (sin catalog_id)', () => {
        it('detecta ejercicios de core por nombre', () => {
            expect(isBodyweightExercise({ name: 'Crunch abdominal' })).toBe(true);
            expect(isBodyweightExercise({ name: 'Plancha frontal' })).toBe(true);
            expect(isBodyweightExercise({ name: 'Encogimiento de piernas' })).toBe(true);
            expect(isBodyweightExercise({ name: 'Extensión lumbar' })).toBe(true);
        });

        it('exige que "elevación" vaya acompañada de pierna/rodilla/pelvis', () => {
            expect(isBodyweightExercise({ name: 'Elevación de piernas' })).toBe(true);
            expect(isBodyweightExercise({ name: 'Elevación de rodillas' })).toBe(true);
            // Elevación lateral es de hombro con mancuernas, no core.
            expect(isBodyweightExercise({ name: 'Elevación lateral' })).toBe(false);
        });

        it('una palabra de material descarta el ejercicio aunque suene a core', () => {
            expect(isBodyweightExercise({ name: 'Máquina de abdominales' })).toBe(false);
            expect(isBodyweightExercise({ name: 'Crunch en polea' })).toBe(false);
            expect(isBodyweightExercise({ name: 'Abdominal con disco' })).toBe(false);
            expect(isBodyweightExercise({ name: 'Encogimiento con barra' })).toBe(false);
            expect(isBodyweightExercise({ name: 'Crunch con mancuerna' })).toBe(false);
        });

        it('es insensible a mayúsculas', () => {
            expect(isBodyweightExercise({ name: 'PLANCHA' })).toBe(true);
        });

        it('no marca ejercicios normales de fuerza', () => {
            expect(isBodyweightExercise({ name: 'Press de Banca' })).toBe(false);
        });

        it('sin nombre devuelve false en lugar de romper', () => {
            expect(isBodyweightExercise({})).toBe(false);
            expect(isBodyweightExercise({ name: null })).toBe(false);
        });

        it('catalog_id = 0 cae al heurístico de nombre (0 es falsy)', () => {
            expect(isBodyweightExercise({ catalog_id: 0, name: 'Plancha' })).toBe(true);
        });
    });
});

describe('isTimeBasedExercise', () => {
    it('el ID 97 del catálogo es el ejercicio por tiempo', () => {
        expect(isTimeBasedExercise({ catalog_id: 97 })).toBe(true);
        expect(isTimeBasedExercise({ catalog_id: '97' })).toBe(true);
        expect(isTimeBasedExercise({ catalog_id: 96 })).toBe(false);
    });

    it('sin catalog_id, solo "plancha" se mide por tiempo', () => {
        expect(isTimeBasedExercise({ name: 'Plancha lateral' })).toBe(true);
        expect(isTimeBasedExercise({ name: 'Crunch abdominal' })).toBe(false);
        expect(isTimeBasedExercise({})).toBe(false);
    });

    it('un catalog_id distinto de 97 descarta el nombre', () => {
        expect(isTimeBasedExercise({ catalog_id: 84, name: 'Plancha' })).toBe(false);
    });
});
