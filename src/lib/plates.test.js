import { describe, it, expect } from 'vitest';
import { rirFromRpe } from './plates';

describe('rirFromRpe', () => {
    it('convierte RPE 10 (al fallo) en RIR 0', () => {
        expect(rirFromRpe(10)).toBe(0);
    });

    it('convierte RPE 8 en RIR 2', () => {
        expect(rirFromRpe(8)).toBe(2);
    });

    it('convierte RPE 6 (el más bajo de RPE_OPTIONS) en RIR 4', () => {
        expect(rirFromRpe(6)).toBe(4);
    });

    it('devuelve null si no hay rpe (undefined)', () => {
        expect(rirFromRpe(undefined)).toBeNull();
    });

    it('devuelve null si rpe es null', () => {
        expect(rirFromRpe(null)).toBeNull();
    });
});
