import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// `utils.js` importa el cliente de Supabase, que se construye con
// `import.meta.env` en tiempo de import. Lo mockeamos para poder testear
// las funciones puras del módulo sin credenciales ni red.
vi.mock('./supabase', () => ({ supabase: {} }));

const { enrichExercisesWithCatalog, getNextSaturdayExpiration } = await import('./utils');

describe('enrichExercisesWithCatalog', () => {
    it('hereda name, image_url e instructions del catálogo maestro', () => {
        const rows = [{
            id: 1,
            name: 'Nombre viejo',
            image_url: '/viejo.png',
            instructions: 'Instrucciones viejas',
            exercise_catalog: {
                name: 'Press de Banca',
                image_url: '/nuevo.png',
                instructions: 'Instrucciones nuevas',
            },
        }];

        expect(enrichExercisesWithCatalog(rows)).toEqual([{
            id: 1,
            name: 'Press de Banca',
            image_url: '/nuevo.png',
            instructions: 'Instrucciones nuevas',
        }]);
    });

    it('elimina la relación embebida del resultado', () => {
        const [result] = enrichExercisesWithCatalog([
            { id: 1, name: 'X', exercise_catalog: { name: 'Y' } },
        ]);
        expect(result).not.toHaveProperty('exercise_catalog');
    });

    it('preserva el resto de campos del ejercicio', () => {
        const [result] = enrichExercisesWithCatalog([{
            id: 1,
            routine_id: 'day1',
            series: '4',
            reps: '10',
            sort_order: 2,
            name: 'X',
            exercise_catalog: { name: 'Y' },
        }]);
        expect(result).toMatchObject({ routine_id: 'day1', series: '4', reps: '10', sort_order: 2 });
    });

    it('devuelve el ejercicio intacto si no hay catálogo asociado', () => {
        const row = { id: 1, name: 'Ejercicio propio', image_url: '/propio.png' };
        const [result] = enrichExercisesWithCatalog([row]);
        expect(result).toBe(row);
    });

    it('conserva el valor del ejercicio si el campo del catálogo viene vacío', () => {
        const [result] = enrichExercisesWithCatalog([{
            id: 1,
            name: 'Nombre propio',
            image_url: '/propia.png',
            exercise_catalog: { name: '', image_url: null },
        }]);
        expect(result.name).toBe('Nombre propio');
        expect(result.image_url).toBe('/propia.png');
    });

    it('devuelve [] si no llegan datos (query fallida o tabla vacía)', () => {
        expect(enrichExercisesWithCatalog(null)).toEqual([]);
        expect(enrichExercisesWithCatalog(undefined)).toEqual([]);
        expect(enrichExercisesWithCatalog([])).toEqual([]);
    });
});

describe('getNextSaturdayExpiration', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const expirationOn = (iso) => {
        vi.setSystemTime(new Date(iso));
        return new Date(getNextSaturdayExpiration());
    };

    it('desde un viernes, caduca al día siguiente a las 23:59:59.999', () => {
        const exp = expirationOn('2026-09-11T10:00:00Z'); // viernes
        expect(exp.toISOString()).toBe('2026-09-12T23:59:59.999Z');
    });

    it('desde un domingo, caduca el sábado siguiente (6 días después)', () => {
        const exp = expirationOn('2026-09-06T10:00:00Z'); // domingo
        expect(exp.toISOString()).toBe('2026-09-12T23:59:59.999Z');
    });

    it('el propio sábado caduca ese mismo día, no la semana siguiente', () => {
        const exp = expirationOn('2026-09-12T10:00:00Z'); // sábado
        expect(exp.toISOString()).toBe('2026-09-12T23:59:59.999Z');
    });

    it('a las 23:59:59.999 del sábado la semana sigue viva (límite inclusivo)', () => {
        vi.setSystemTime(new Date('2026-09-12T23:59:59.999Z'));
        expect(getNextSaturdayExpiration()).toBe(Date.now());
    });

    it('cruza correctamente el cambio de mes y de año', () => {
        expect(expirationOn('2026-09-30T10:00:00Z').toISOString()) // miércoles
            .toBe('2026-10-03T23:59:59.999Z');
        expect(expirationOn('2026-12-31T10:00:00Z').toISOString()) // jueves
            .toBe('2027-01-02T23:59:59.999Z');
    });

    it('siempre devuelve un sábado', () => {
        for (let day = 1; day <= 14; day++) {
            const iso = `2026-09-${String(day).padStart(2, '0')}T10:00:00Z`;
            expect(expirationOn(iso).getDay()).toBe(6);
        }
    });
});
