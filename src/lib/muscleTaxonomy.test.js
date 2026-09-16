import { describe, it, expect } from 'vitest';
import { MUSCLE_VOCABULARY, normalizeSecondaryMuscles, isValidSecondaryProposal } from './muscleTaxonomy';

describe('MUSCLE_VOCABULARY', () => {
    it('son los 8 grupos musculares reales, sin Cardio ni Otros', () => {
        expect(MUSCLE_VOCABULARY).toEqual([
            'Abdomen', 'Bíceps', 'Dorsal', 'Glúteo', 'Hombro', 'Pecho', 'Pierna', 'Tríceps',
        ]);
    });
});

describe('normalizeSecondaryMuscles', () => {
    it('quita el grupo principal de los secundarios', () => {
        expect(normalizeSecondaryMuscles(['Pecho', 'Tríceps'], 'Pecho')).toEqual(['Tríceps']);
    });

    it('quita duplicados', () => {
        expect(normalizeSecondaryMuscles(['Tríceps', 'Tríceps', 'Hombro'], 'Pecho'))
            .toEqual(['Hombro', 'Tríceps']);
    });

    it('descarta etiquetas fuera del vocabulario', () => {
        expect(normalizeSecondaryMuscles(['Tríceps', 'Serrato', 'Romboides'], 'Pecho'))
            .toEqual(['Tríceps']);
    });

    it('ordena alfabéticamente para que el resultado sea estable', () => {
        expect(normalizeSecondaryMuscles(['Tríceps', 'Abdomen', 'Hombro'], 'Pecho'))
            .toEqual(['Abdomen', 'Hombro', 'Tríceps']);
    });

    it('devuelve array vacío para null, undefined o vacío', () => {
        expect(normalizeSecondaryMuscles(null, 'Pecho')).toEqual([]);
        expect(normalizeSecondaryMuscles(undefined, 'Pecho')).toEqual([]);
        expect(normalizeSecondaryMuscles([], 'Pecho')).toEqual([]);
    });

    it('tolera una category desconocida sin romper', () => {
        expect(normalizeSecondaryMuscles(['Tríceps'], 'Cardio')).toEqual(['Tríceps']);
    });
});

describe('isValidSecondaryProposal', () => {
    const valida = { id: 12, name: 'Press de banca', category: 'Pecho', secondary_muscles: ['Tríceps'] };

    it('acepta una fila correcta', () => {
        expect(isValidSecondaryProposal(valida)).toBe(true);
    });

    it('acepta secundarios vacíos (ejercicio aislado)', () => {
        expect(isValidSecondaryProposal({ ...valida, secondary_muscles: [] })).toBe(true);
    });

    it('rechaza id que no es número', () => {
        expect(isValidSecondaryProposal({ ...valida, id: 'doce' })).toBe(false);
    });

    it('rechaza category fuera del vocabulario', () => {
        expect(isValidSecondaryProposal({ ...valida, category: 'Cuello' })).toBe(false);
    });

    it('rechaza un secundario fuera del vocabulario', () => {
        expect(isValidSecondaryProposal({ ...valida, secondary_muscles: ['Serrato'] })).toBe(false);
    });

    it('rechaza que el principal aparezca entre los secundarios', () => {
        expect(isValidSecondaryProposal({ ...valida, secondary_muscles: ['Pecho'] })).toBe(false);
    });

    it('rechaza filas nulas o sin secundarios', () => {
        expect(isValidSecondaryProposal(null)).toBe(false);
        expect(isValidSecondaryProposal({ id: 1, category: 'Pecho' })).toBe(false);
    });
});
