// v3 Fase B (recortada): agrupación visual de superseries.
// Ver docs/superpowers/specs/2026-09-16-superseries-visual-design.md.

/**
 * Agrupa ejercicios consecutivos que comparten superset_group_id. Ejercicios
 * sin grupo (null/undefined) siempre quedan solos. La contigüidad manda
 * sobre el id compartido: dos ejercicios con el mismo id separados por un
 * tercero sin ese id son dos grupos independientes, nunca uno.
 *
 * @param {Array<{superset_group_id?: string|null}>} exercises  en su orden real (ui_order)
 * @returns {Array<Array<object>>} arrays de 1 (suelto) o 2+ (superserie), en el mismo orden
 */
export function groupConsecutiveExercises(exercises) {
    const groups = [];
    for (const ex of exercises) {
        const last = groups[groups.length - 1];
        const lastId = last?.[0]?.superset_group_id;
        if (ex.superset_group_id && lastId === ex.superset_group_id) {
            last.push(ex);
        } else {
            groups.push([ex]);
        }
    }
    return groups;
}

/**
 * Tras reordenar, desvincula (superset_group_id -> null) cualquier grupo
 * cuyos miembros hayan dejado de ser contiguos en la lista. Grupo entero
 * dissuelto si se rompe — sin intento de "reparar" parcialmente.
 *
 * @param {Array<{catalog_id: string|number, superset_group_id?: string|null}>} exercises
 * @returns {Array<object>} mismo array si nada se rompió; copia con los grupos rotos a null si no
 */
export function clearBrokenSupersetGroups(exercises) {
    const positionsByGroup = {};
    exercises.forEach((ex, i) => {
        if (!ex.superset_group_id) return;
        (positionsByGroup[ex.superset_group_id] ||= []).push(i);
    });
    const brokenGroups = new Set(
        Object.entries(positionsByGroup)
            .filter(([, idxs]) => idxs[idxs.length - 1] - idxs[0] + 1 !== idxs.length)
            .map(([id]) => id)
    );
    if (brokenGroups.size === 0) return exercises;
    return exercises.map(ex =>
        brokenGroups.has(ex.superset_group_id) ? { ...ex, superset_group_id: null } : ex
    );
}

/**
 * Alterna el enlace de superserie entre un ejercicio y el siguiente en la
 * lista. Si ya comparten grupo, lo disuelve entero. Si no, los une (y si
 * alguno ya pertenecía a un grupo, el otro grupo se fusiona en él).
 *
 * @param {Array<{catalog_id: string|number, superset_group_id?: string|null}>} exercises
 * @param {string|number} catalogId  el ejercicio de la izquierda del conector
 * @param {() => string} makeGroupId  generador de id para un grupo nuevo (inyectado para poder testear sin crypto)
 * @returns {Array<object>}
 */
export function toggleSupersetLink(exercises, catalogId, makeGroupId) {
    const idx = exercises.findIndex(ex => ex.catalog_id === catalogId);
    if (idx === -1 || idx === exercises.length - 1) return exercises;
    const a = exercises[idx];
    const b = exercises[idx + 1];

    if (a.superset_group_id && a.superset_group_id === b.superset_group_id) {
        const groupId = a.superset_group_id;
        return exercises.map(ex =>
            ex.superset_group_id === groupId ? { ...ex, superset_group_id: null } : ex
        );
    }

    const groupId = a.superset_group_id || b.superset_group_id || makeGroupId();
    const oldBGroupId = b.superset_group_id;
    return exercises.map(ex => {
        if (ex.catalog_id === a.catalog_id || ex.catalog_id === b.catalog_id) {
            return { ...ex, superset_group_id: groupId };
        }
        if (oldBGroupId && ex.superset_group_id === oldBGroupId) {
            return { ...ex, superset_group_id: groupId };
        }
        return ex;
    });
}
