// src/lib/progression.test.js
import { describe, it, expect } from 'vitest';
import { suggestSetWeights } from './progression';

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
