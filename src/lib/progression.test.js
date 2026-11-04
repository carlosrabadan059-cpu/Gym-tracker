// src/lib/progression.test.js
import { describe, it, expect } from 'vitest';
import { suggestSetWeights, prefillWeights } from './progression';

const log = (sets) => ({ setsData: Object.fromEntries(sets.map((s, i) => [String(i), s])) });

describe('suggestSetWeights', () => {
    it('raises only the sets that reached their reps without RPE 9+', () => {
        const last = log([
            { weight: '60', reps: '12', rpe: 8 },
            { weight: '65', reps: '10', rpe: 8 },
            { weight: '70', reps: '7', rpe: 8 },
            { weight: '72.5', reps: '6', rpe: 9 },
        ]);
        expect(suggestSetWeights(last, '12-10-8-6', 4)).toEqual([
            { weight: 62.5, up: true, last: { weight: 60, reps: 12, rpe: 8 } },
            { weight: 67.5, up: true, last: { weight: 65, reps: 10, rpe: 8 } },
            { weight: 70, up: false, last: { weight: 70, reps: 7, rpe: 8 } },
            { weight: 72.5, up: false, last: { weight: 72.5, reps: 6, rpe: 9 } },
        ]);
    });

    it('raises a set without RPE if it reached its reps', () => {
        const [first] = suggestSetWeights(log([{ weight: '10', reps: '12' }]), '12-10', 2);
        expect(first).toEqual({ weight: 11, up: true, last: { weight: 10, reps: 12, rpe: null } });
    });

    it('returns null for sets without data last time', () => {
        expect(suggestSetWeights(log([{ weight: '60', reps: '12', rpe: 8 }]), '12-10', 2)[1]).toBeNull();
        expect(suggestSetWeights(null, '12-10', 2)).toEqual([null, null]);
        expect(suggestSetWeights(log([{ weight: '', reps: '12' }]), '12', 1)).toEqual([null]);
    });
});

describe('prefillWeights', () => {
    const last = log([{ weight: '60', reps: '10' }, { weight: '57.5', reps: '8' }]);

    it('uses the same set from last time', () => {
        expect(prefillWeights({ series: 2 }, last)).toEqual(['60', '57.5']);
    });

    it('repeats the last recorded weight for extra sets', () => {
        expect(prefillWeights({ series: 4 }, last)).toEqual(['60', '57.5', '57.5', '57.5']);
    });

    it('trainer target wins over history', () => {
        expect(prefillWeights({ series: 2, target_weight: 70 }, last)).toEqual(['70', '70']);
    });

    it('is empty without history or target', () => {
        expect(prefillWeights({ series: 2 }, null)).toEqual(['', '']);
    });

    it('defaults to 3 sets', () => {
        expect(prefillWeights({}, last)).toHaveLength(3);
    });
});
