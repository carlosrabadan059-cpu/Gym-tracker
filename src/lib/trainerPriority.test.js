// src/lib/trainerPriority.test.js
import { describe, it, expect } from 'vitest';
import { categorizeClient } from './trainerPriority';

describe('categorizeClient', () => {
    it('flags attention when the client has never trained', () => {
        expect(categorizeClient({
            daysSinceLastSession: null,
            streak: 0,
            hasRoutineScheduledToday: false,
            trainedToday: false,
        })).toBe('attention');
    });

    it('flags attention when inactive for 7+ days, even with signals that look fine otherwise', () => {
        expect(categorizeClient({
            daysSinceLastSession: 7,
            streak: 0,
            hasRoutineScheduledToday: false,
            trainedToday: false,
        })).toBe('attention');
        expect(categorizeClient({
            daysSinceLastSession: 10,
            streak: 0,
            hasRoutineScheduledToday: false,
            trainedToday: false,
        })).toBe('attention');
    });

    it('does not flag attention for inactivity below the threshold', () => {
        expect(categorizeClient({
            daysSinceLastSession: 6,
            streak: 0,
            hasRoutineScheduledToday: false,
            trainedToday: false,
        })).not.toBe('attention');
    });

    it('flags attention when a routine is scheduled today and has not been trained, even if recently active', () => {
        expect(categorizeClient({
            daysSinceLastSession: 1,
            streak: 3,
            hasRoutineScheduledToday: true,
            trainedToday: false,
        })).toBe('attention');
    });

    it('does not flag attention for a scheduled routine already trained today', () => {
        expect(categorizeClient({
            daysSinceLastSession: 0,
            streak: 3,
            hasRoutineScheduledToday: true,
            trainedToday: true,
        })).toBe('progressing');
    });

    it('flags progressing when streak is alive and no attention signal applies', () => {
        expect(categorizeClient({
            daysSinceLastSession: 0,
            streak: 5,
            hasRoutineScheduledToday: false,
            trainedToday: true,
        })).toBe('progressing');
    });

    it('attention wins over progressing when both signals apply', () => {
        expect(categorizeClient({
            daysSinceLastSession: 1,
            streak: 4,
            hasRoutineScheduledToday: true,
            trainedToday: false,
        })).toBe('attention');
    });

    it('flags neutral when no signal applies', () => {
        expect(categorizeClient({
            daysSinceLastSession: 3,
            streak: 0,
            hasRoutineScheduledToday: false,
            trainedToday: false,
        })).toBe('neutral');
    });
});
