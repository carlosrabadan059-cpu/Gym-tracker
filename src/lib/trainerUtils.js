import { supabase } from './supabase';

// Utilidades del lado entrenador. Ver docs/plan-trainer-improvements.md.

/**
 * Clona una rutina (plantilla o cualquier rutina existente) en una copia
 * privada para un cliente, y se la asigna. Cada cliente tiene su propia copia
 * editable: tocar la rutina de uno nunca afecta a otro (Fase 0.2, decisión
 * "clonar siempre").
 *
 * @param {string} sourceRoutineId  rutina origen a copiar
 * @param {object} client           { user_id, username?, fullName? }
 * @param {string} trainerId        auth.uid() del entrenador
 * @returns {Promise<string>} el id de la rutina clonada
 */
export async function cloneRoutineToClient(sourceRoutineId, client, trainerId) {
    if (!sourceRoutineId || !client?.user_id || !trainerId) {
        throw new Error('cloneRoutineToClient: faltan datos (rutina, cliente o entrenador)');
    }

    const [{ data: source, error: srcErr }, { data: exercises, error: exErr }] = await Promise.all([
        supabase.from('routines').select('name, color, border_color, text_color').eq('id', sourceRoutineId).single(),
        supabase.from('exercises')
            .select('name, series, reps, image_url, catalog_id, ui_order')
            .eq('routine_id', sourceRoutineId)
            .order('ui_order'),
    ]);
    if (srcErr) throw srcErr;
    if (exErr) throw exErr;

    const newRoutineId = `custom_${crypto.randomUUID()}`;

    const { error: insRoutineErr } = await supabase.from('routines').insert([{
        id: newRoutineId,
        name: source.name,
        color: source.color,
        border_color: source.border_color,
        text_color: source.text_color,
        trainer_id: trainerId,
        owner_client_id: client.user_id,
        is_template: false,
    }]);
    if (insRoutineErr) throw insRoutineErr;

    if (exercises?.length) {
        const { error: insExErr } = await supabase.from('exercises').insert(
            exercises.map((ex, i) => ({
                routine_id: newRoutineId,
                name: ex.name,
                series: ex.series,
                reps: ex.reps,
                image_url: ex.image_url,
                catalog_id: ex.catalog_id ?? null,
                ui_order: ex.ui_order ?? i + 1,
            }))
        );
        if (insExErr) throw insExErr;
    }

    const { error: assignErr } = await supabase.from('assigned_routines').insert([{
        client_id: client.user_id,
        routine_id: newRoutineId,
        assigned_by: trainerId,
    }]);
    if (assignErr) throw assignErr;

    try {
        await supabase.from('notifications').insert([{
            user_id: client.user_id,
            title: '¡Nueva Rutina Asignada!',
            message: `Tu entrenador te ha asignado: ${source.name}. ¡A darle duro!`,
            read: false,
        }]);
    } catch (notifErr) {
        console.warn('Could not insert notification, table likely missing', notifErr);
    }

    return newRoutineId;
}

/**
 * Al desasignar la rutina de un cliente, borra también su copia privada
 * (routine + exercises) si es un clon y ninguna otra asignación la usa —
 * evita rutinas huérfanas acumulándose. Nunca toca plantillas ni rutinas
 * estáticas/compartidas.
 *
 * @param {string} routineId
 * @returns {Promise<void>}
 */
export async function deleteClientRoutineCopy(routineId) {
    if (!routineId) return;

    const { data: routine } = await supabase
        .from('routines')
        .select('owner_client_id, is_template')
        .eq('id', routineId)
        .single();

    if (!routine || routine.is_template || !routine.owner_client_id) return;

    const { count } = await supabase
        .from('assigned_routines')
        .select('id', { count: 'exact', head: true })
        .eq('routine_id', routineId);
    if (count && count > 0) return;

    await supabase.from('exercises').delete().eq('routine_id', routineId);
    await supabase.from('routines').delete().eq('id', routineId);
}

/**
 * Resume el historial reciente de un cliente en texto plano, para pasarlo
 * como contexto a la IA del borrador de rutina (Fase 2.1) sin mandar el
 * JSON crudo de `workout_logs`.
 *
 * @param {Array<{routine_id: string, date: string, logs: object}>} logs
 * @param {Record<string, string>} nameById  routine_id -> nombre de rutina
 * @returns {string}
 */
export function summarizeWorkoutHistory(logs, nameById = {}) {
    if (!logs || logs.length === 0) return 'Sin historial de entrenamientos registrado.';

    return logs.map(log => {
        const routineName = nameById[log.routine_id] || log.routine_id;
        const exerciseCount = log.logs
            ? Object.keys(log.logs).filter(key => key !== 'workoutDuration' && key !== 'cardio').length
            : 0;
        const dateOnly = log.date ? log.date.slice(0, 10) : 'fecha desconocida';
        const ejercicioLabel = exerciseCount === 1 ? 'ejercicio' : 'ejercicios';
        return `${dateOnly} · ${routineName} · ${exerciseCount} ${ejercicioLabel}`;
    }).join('\n');
}

/**
 * Casa el borrador que devuelve la IA (Fase 2.1) contra el catálogo maestro
 * ya cargado en RoutineAssignerView. La IA solo puede elegir nombres de
 * `exerciseNames` (ver buildRoutineDraftPayload), pero puede equivocarse o
 * el modelo puede alucinar — por eso el match es defensivo: lo que no casa
 * se descarta y se reporta, no rompe el resto del borrador.
 *
 * @param {Array<object>} draftExercises  el array `ejercicios` que devuelve el webhook
 * @param {Array<{id: number, name: string, image_url: string|null}>} catalog
 * @returns {{ matched: Array<object>, unmatched: string[] }}
 */
export function matchDraftExercisesToCatalog(draftExercises, catalog) {
    const byName = new Map(catalog.map(ex => [ex.name.trim().toLowerCase(), ex]));
    const matched = [];
    const unmatched = [];

    for (const item of (draftExercises || [])) {
        const key = String(item.catalogName || '').trim().toLowerCase();
        const catalogEx = byName.get(key);
        if (!catalogEx) {
            unmatched.push(item.catalogName);
            continue;
        }
        matched.push({
            catalog_id: catalogEx.id,
            name: catalogEx.name,
            image_url: catalogEx.image_url || null,
            series: item.series ?? 3,
            reps: item.reps ?? 10,
            target_weight: item.target_weight ?? null,
            target_rir: item.target_rir ?? null,
            rest_seconds: item.rest_seconds ?? null,
            notes: item.notes ?? null,
            motivo: item.motivo ?? null,
        });
    }

    return { matched, unmatched };
}

/**
 * Arma el cuerpo del POST al webhook `Gym_App_RoutineDraft` (Fase 2.1),
 * con defaults en español para los campos que el entrenador deje en blanco
 * en el formulario "Con IA".
 */
export function buildRoutineDraftPayload({ clientGoal, level, daysPerWeek, equipment, limitations, exerciseNames, recentHistorySummary }) {
    return {
        clientGoal: clientGoal || 'No especificado',
        level: level || 'intermedio',
        daysPerWeek: daysPerWeek ? Number(daysPerWeek) : null,
        equipment: equipment || 'No especificado',
        limitations: limitations || 'Ninguna',
        exerciseNames,
        recentHistorySummary,
    };
}
