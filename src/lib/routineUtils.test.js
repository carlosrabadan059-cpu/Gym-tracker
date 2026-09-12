import { describe, it, expect } from 'vitest';
import {
    getRoutineIcon,
    calculateCaloriesByTime,
    calculateCaloriesByVolume,
    getAverageWorkoutMET,
    calculateRealCalories,
    calculateCardioCalories,
    CARDIO_TYPES,
} from './routineUtils';

describe('getRoutineIcon', () => {
    it('mapea el grupo muscular a su icono', () => {
        expect(getRoutineIcon('Pecho')).toBe('/categories/pecho.png');
        expect(getRoutineIcon('Dorsal')).toBe('/categories/dorsal.png');
        expect(getRoutineIcon('Abdomen')).toBe('/categories/abdomen.png');
    });

    it('acepta acentos y mayúsculas (bíceps/biceps, tríceps/triceps, glúteo/gluteo)', () => {
        expect(getRoutineIcon('Bíceps')).toBe('/categories/biceps.png');
        expect(getRoutineIcon('BICEPS')).toBe('/categories/biceps.png');
        expect(getRoutineIcon('Tríceps')).toBe('/categories/triceps.png');
        expect(getRoutineIcon('Triceps')).toBe('/categories/triceps.png');
        expect(getRoutineIcon('Glúteo')).toBe('/categories/gluteo.png');
        expect(getRoutineIcon('Gluteo')).toBe('/categories/gluteo.png');
    });

    it('trapecio reutiliza el icono de hombro', () => {
        expect(getRoutineIcon('Trapecio')).toBe('/categories/hombro.png');
    });

    it('busca por subcadena dentro de nombres de rutina reales', () => {
        expect(getRoutineIcon('Día 3: Pierna')).toBe('/categories/pierna.png');
    });

    it('con varios grupos en el nombre gana el primero del diccionario, no el del nombre', () => {
        // 'pecho' se declara antes que 'biceps', así que gana aunque aparezca después.
        expect(getRoutineIcon('Día 1: Bíceps / Pecho')).toBe('/categories/pecho.png');
    });

    it('devuelve null si no hay coincidencia o no hay nombre', () => {
        expect(getRoutineIcon('Cardio')).toBeNull();
        expect(getRoutineIcon('')).toBeNull();
        expect(getRoutineIcon(null)).toBeNull();
        expect(getRoutineIcon(undefined)).toBeNull();
    });
});

describe('calculateCaloriesByTime', () => {
    it('aplica la fórmula MET × kg × horas', () => {
        expect(calculateCaloriesByTime(6, 80, 60)).toBe(480);
        expect(calculateCaloriesByTime(6, 80, 30)).toBe(240);
    });

    it('devuelve 0 si falta el peso o la duración', () => {
        expect(calculateCaloriesByTime(6, 0, 60)).toBe(0);
        expect(calculateCaloriesByTime(6, undefined, 60)).toBe(0);
        expect(calculateCaloriesByTime(6, 80, 0)).toBe(0);
        expect(calculateCaloriesByTime(6, 80, undefined)).toBe(0);
    });
});

describe('calculateCaloriesByVolume', () => {
    it('asume 1 minuto activo por serie', () => {
        // MET pesado 6.0 ('press') × 75 kg × 4/60 h = 30
        expect(calculateCaloriesByVolume({ name: 'Press de Banca', series: '4' }, 75)).toBe(30);
    });

    it('clasifica el MET por palabras clave del nombre', () => {
        const sets = { series: '10' };
        // Fuerza pesada: 6.0 × 75 × 10/60 = 75
        expect(calculateCaloriesByVolume({ ...sets, name: 'Sentadilla' }, 75)).toBe(75);
        expect(calculateCaloriesByVolume({ ...sets, name: 'Peso Muerto' }, 75)).toBe(75);
        expect(calculateCaloriesByVolume({ ...sets, name: 'Remo con barra' }, 75)).toBe(75);
        // Peso corporal: 8.0 × 75 × 10/60 = 100
        expect(calculateCaloriesByVolume({ ...sets, name: 'Dominadas' }, 75)).toBe(100);
        expect(calculateCaloriesByVolume({ ...sets, name: 'Fondos' }, 75)).toBe(100);
        // Cardio: 9.0 × 75 × 10/60 = 112.5 → 113
        expect(calculateCaloriesByVolume({ ...sets, name: 'Correr en cinta' }, 75)).toBe(113);
        // Desconocido → fuerza ligera 3.5 × 75 × 10/60 = 43.75 → 44
        expect(calculateCaloriesByVolume({ ...sets, name: 'Curl de antebrazo' }, 75)).toBe(44);
    });

    it('usa 75 kg cuando no se conoce el peso del usuario', () => {
        const ex = { name: 'Press de Banca', series: '4' };
        expect(calculateCaloriesByVolume(ex, undefined)).toBe(calculateCaloriesByVolume(ex, 75));
        expect(calculateCaloriesByVolume(ex, 0)).toBe(calculateCaloriesByVolume(ex, 75));
    });

    it('escala con el peso del usuario', () => {
        expect(calculateCaloriesByVolume({ name: 'Press de Banca', series: '4' }, 100)).toBe(40);
    });

    it('devuelve 0 si las series no son un número utilizable', () => {
        expect(calculateCaloriesByVolume({ name: 'Press', series: '0' }, 75)).toBe(0);
        expect(calculateCaloriesByVolume({ name: 'Press', series: 'AMRAP' }, 75)).toBe(0);
        expect(calculateCaloriesByVolume({ name: 'Press' }, 75)).toBe(0);
    });

    it('parsea series escritas como texto libre ("4 series")', () => {
        expect(calculateCaloriesByVolume({ name: 'Press de Banca', series: '4 series' }, 75)).toBe(30);
    });
});

describe('getAverageWorkoutMET', () => {
    it('promedia los METs de los ejercicios', () => {
        // 6.0 (press) + 8.0 (dominadas) → 7.0
        expect(getAverageWorkoutMET([{ name: 'Press de Banca' }, { name: 'Dominadas' }])).toBe(7);
    });

    it('una lista vacía devuelve el MET por defecto (4.5), no el de fuerza ligera', () => {
        expect(getAverageWorkoutMET([])).toBe(4.5);
        expect(getAverageWorkoutMET(null)).toBe(4.5);
        expect(getAverageWorkoutMET(undefined)).toBe(4.5);
        // Contraste: un ejercicio desconocido puntúa 3.5, no 4.5.
        expect(getAverageWorkoutMET([{ name: 'Ejercicio raro' }])).toBe(3.5);
    });
});

describe('calculateRealCalories', () => {
    it('usa el MET medio del entreno y la duración real', () => {
        // MET medio 7.0 × 80 kg × 45/60 h = 420
        const exercises = [{ name: 'Press de Banca' }, { name: 'Dominadas' }];
        expect(calculateRealCalories(exercises, 80, 45)).toBe(420);
    });

    it('usa 75 kg por defecto', () => {
        const exercises = [{ name: 'Press de Banca' }];
        expect(calculateRealCalories(exercises, null, 60)).toBe(450);
    });

    it('duración 0 devuelve 0', () => {
        expect(calculateRealCalories([{ name: 'Press de Banca' }], 80, 0)).toBe(0);
    });
});

describe('calculateCardioCalories', () => {
    it('escala las kcal/min del tipo por peso y minutos', () => {
        // 10 kcal/min × (75/75) × 30 min
        expect(calculateCardioCalories('Correr en cinta', 30, 75)).toBe(300);
        // 8 kcal/min × (90/75) × 30 min = 288
        expect(calculateCardioCalories('Elíptica', 30, 90)).toBe(288);
    });

    it('usa 75 kg por defecto (factor de escala 1)', () => {
        expect(calculateCardioCalories('Bicicleta', 60, undefined)).toBe(420);
    });

    it('mantiene "Andar" como alias legacy de "Andar en cinta"', () => {
        expect(CARDIO_TYPES['Andar']).toBe(CARDIO_TYPES['Andar en cinta']);
        expect(calculateCardioCalories('Andar', 30, 75)).toBe(150);
    });

    it('devuelve 0 ante un tipo desconocido o sin minutos', () => {
        expect(calculateCardioCalories('Natación', 30, 75)).toBe(0);
        expect(calculateCardioCalories(undefined, 30, 75)).toBe(0);
        expect(calculateCardioCalories('Bicicleta', 0, 75)).toBe(0);
        expect(calculateCardioCalories('Bicicleta', undefined, 75)).toBe(0);
    });
});
