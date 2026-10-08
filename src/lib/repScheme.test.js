// src/lib/repScheme.test.js
import { describe, it, expect } from 'vitest';
import { parseRepScheme, formatRepScheme, isPyramid, repsForSet, isPerSet, resizeReps, normalizeReps } from './repScheme';

describe('parseRepScheme', () => {
    it('repeats fixed reps for every set', () => {
        expect(parseRepScheme('8', 4)).toEqual([8, 8, 8, 8]);
        expect(parseRepScheme(8, 3)).toEqual([8, 8, 8]);
    });

    it('reads a pyramid set by set', () => {
        expect(parseRepScheme('12-10-8-6', 4)).toEqual([12, 10, 8, 6]);
    });

    it('repeats the last number when the pyramid is shorter than the sets', () => {
        expect(parseRepScheme('12-10', 4)).toEqual([12, 10, 10, 10]);
    });

    it('cuts the pyramid when it is longer than the sets', () => {
        expect(parseRepScheme('12-10-8-6', 2)).toEqual([12, 10]);
    });

    it('falls back to 10 reps and to the pyramid length', () => {
        expect(parseRepScheme('', 2)).toEqual([10, 10]);
        expect(parseRepScheme(null, 1)).toEqual([10]);
        expect(parseRepScheme('12-10-8', undefined)).toEqual([12, 10, 8]);
    });
});

describe('formatRepScheme', () => {
    it('collapses equal reps to a single number', () => {
        expect(formatRepScheme([8, 8, 8])).toBe('8');
    });

    it('joins a pyramid with dashes', () => {
        expect(formatRepScheme([12, 10, 8, 6])).toBe('12-10-8-6');
    });
});

describe('isPyramid', () => {
    it('is true only with more than one distinct number', () => {
        expect(isPyramid('12-10-8-6')).toBe(true);
        expect(isPyramid('8')).toBe(false);
        expect(isPyramid('8-8-8')).toBe(false);
        expect(isPyramid(10)).toBe(false);
        expect(isPyramid(null)).toBe(false);
    });
});

describe('repsForSet', () => {
    it('returns the target of one set', () => {
        expect(repsForSet('12-10-8-6', 0)).toBe(12);
        expect(repsForSet('12-10-8-6', 3)).toBe(6);
        expect(repsForSet('12-10', 3)).toBe(10);
        expect(repsForSet('8', 2)).toBe(8);
    });
});

describe('editor helpers', () => {
    it('isPerSet keeps the per-set mode while editing equal values', () => {
        expect(isPerSet('8-8-8')).toBe(true);
        expect(isPerSet('8')).toBe(false);
        expect(isPerSet(8)).toBe(false);
    });

    it('resizeReps grows or shrinks a pyramid and leaves fixed reps alone', () => {
        expect(resizeReps('12-10-8-6', 5)).toBe('12-10-8-6-6');
        expect(resizeReps('12-10-8-6', 2)).toBe('12-10');
        expect(resizeReps(8, 5)).toBe(8);
    });

    it('normalizeReps produces what gets saved', () => {
        expect(normalizeReps('12-10-8-6', 4)).toBe('12-10-8-6');
        expect(normalizeReps('8-8-8', 3)).toBe('8');
        expect(normalizeReps('12-10', 3)).toBe('12-10-10');
        expect(normalizeReps(8, 4)).toBe('8');
    });
});
