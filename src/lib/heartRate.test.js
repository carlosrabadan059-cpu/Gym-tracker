import { describe, it, expect } from 'vitest';
import { pickLiveHeartRate, LIVE_HR_MAX_AGE_MS } from './heartRate';

const NOW = new Date('2026-09-16T12:00:00Z').getTime();

const sampleAt = (msAgo, value) => ({
    dataType: 'heartRate',
    value,
    unit: 'count/min',
    startDate: new Date(NOW - msAgo).toISOString(),
    endDate: new Date(NOW - msAgo).toISOString(),
});

describe('pickLiveHeartRate', () => {
    it('sin muestras devuelve null', () => {
        expect(pickLiveHeartRate([], { now: NOW })).toBeNull();
    });

    it('con algo que no es un array devuelve null', () => {
        expect(pickLiveHeartRate(undefined, { now: NOW })).toBeNull();
    });

    it('devuelve la muestra reciente redondeada a bpm entero', () => {
        const result = pickLiveHeartRate([sampleAt(5_000, 117.6)], { now: NOW });
        expect(result).toEqual({ bpm: 118, sampledAt: NOW - 5_000 });
    });

    it('descarta la muestra más vieja que el umbral', () => {
        expect(pickLiveHeartRate([sampleAt(LIVE_HR_MAX_AGE_MS + 1, 120)], { now: NOW })).toBeNull();
    });

    it('acepta la muestra justo en el umbral', () => {
        const result = pickLiveHeartRate([sampleAt(LIVE_HR_MAX_AGE_MS, 120)], { now: NOW });
        expect(result?.bpm).toBe(120);
    });

    it('coge la más reciente aunque vengan desordenadas', () => {
        const result = pickLiveHeartRate(
            [sampleAt(30_000, 150), sampleAt(5_000, 118), sampleAt(60_000, 160)],
            { now: NOW }
        );
        expect(result?.bpm).toBe(118);
    });

    it('ignora muestras sin valor', () => {
        expect(pickLiveHeartRate([sampleAt(5_000, null)], { now: NOW })).toBeNull();
    });

    it('ignora fechas inválidas y se queda con la muestra usable', () => {
        const result = pickLiveHeartRate(
            [{ value: 99, startDate: 'no-es-una-fecha' }, sampleAt(10_000, 118)],
            { now: NOW }
        );
        expect(result?.bpm).toBe(118);
    });
});
