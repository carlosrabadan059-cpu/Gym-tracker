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
