// src/lib/printableProgram.js
// Hoja del programa de un cliente, en pantalla y en A4. Ver
// docs/superpowers/specs/2026-10-08-imprimir-programa-design.md.
// Función pura: `today` se pasa como parámetro para poder testearla.
import { getCurrentMesocycleWeek, applyMesocycleWeek } from './mesocycle';

const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
// Orden de la semana en España: el domingo va al final.
const weekdayOrder = (day) => (day === 0 ? 7 : day);

/** Descanso con el formato de la hoja en papel: 90 → '90"'. Sin descanso, null. */
export function formatRest(seconds) {
    const n = Number(seconds);
    return seconds !== null && seconds !== '' && n > 0 ? `${n}"` : null;
}

// "Dia 1 - Pecho / Hombro" → "Pecho / Hombro": la etiqueta "Día N" ya la
// pone la hoja según el orden.
const stripDayPrefix = (name) => (name || '').replace(/^d[ií]a\s*\d+\s*[-–:]\s*/i, '').trim() || name;

const firstDay = (days) => (Array.isArray(days) && days.length ? Math.min(...days.map(weekdayOrder)) : Infinity);

/**
 * @param {{username?: string, goal?: string}} client
 * @param {Array<{routine: {name: string, scheduled_days?: number[]|null, mesocycle_start_date?: string|null, exercises: Array}}>} assignments
 * @param {Date} today
 */
export function buildPrintableProgram(client, assignments, today) {
    const routines = assignments
        .map((a) => a.routine)
        .filter((r) => r?.exercises?.length)
        .sort((a, b) => firstDay(a.scheduled_days) - firstDay(b.scheduled_days) || (a.name || '').localeCompare(b.name || ''));

    const startDates = routines.map((r) => r.mesocycle_start_date).filter(Boolean).sort();
    const weeks = routines.flatMap((r) => r.exercises.flatMap((ex) => (ex.weekly_progression || []).map((w) => w.week)));

    return {
        clientName: client?.username || null,
        goal: client?.goal || null,
        startDate: startDates[0] || null,
        durationWeeks: weeks.length ? Math.max(...weeks) : null,
        days: routines.map((routine, i) => {
            const activeWeek = getCurrentMesocycleWeek(routine.mesocycle_start_date, today);
            const supersetLabels = {};
            return {
                label: `Día ${i + 1}`,
                name: stripDayPrefix(routine.name),
                scheduledDays: Array.isArray(routine.scheduled_days) && routine.scheduled_days.length
                    ? [...routine.scheduled_days].sort((a, b) => weekdayOrder(a) - weekdayOrder(b)).map((d) => WEEKDAY_NAMES[d]).join(' · ')
                    : null,
                exercises: routine.exercises.map((raw, j) => {
                    const ex = applyMesocycleWeek(raw, activeWeek);
                    const group = ex.superset_group_id;
                    if (group && !supersetLabels[group]) {
                        supersetLabels[group] = String.fromCharCode(65 + Object.keys(supersetLabels).length);
                    }
                    const observations = [ex.notes, ex.tempo ? `Tempo ${ex.tempo}` : null, ex.target_rir != null && ex.target_rir !== '' ? `RIR ${ex.target_rir}` : null]
                        .filter(Boolean).join(' · ');
                    return {
                        number: j + 1,
                        name: ex.name,
                        imageUrl: ex.image_url || null,
                        variant: ex.variant || null,
                        series: ex.series,
                        reps: ex.reps,
                        rest: formatRest(ex.rest_seconds),
                        observations: observations || null,
                        superset: group ? supersetLabels[group] : null,
                    };
                }),
            };
        }),
    };
}
