import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase falso: cada tabla responde lo que diga `db`, y se apuntan los
// borrados para comprobar qué se habría eliminado.
let db;
const deletes = [];
vi.mock('./supabase', () => {
    const query = (table) => {
        const q = {
            select: () => q,
            eq: () => q,
            single: () => Promise.resolve({ data: db.routine }),
            delete: () => { deletes.push(table); return q; },
            then: (resolve) => resolve(
                table === 'assigned_routines' ? { count: db.assignments }
                    : table === 'workout_logs' ? db.logs
                        : {}
            ),
        };
        return q;
    };
    return { supabase: { from: query } };
});

const { deleteClientRoutineCopy } = await import('./trainerUtils');

const copy = { owner_client_id: 'client', is_template: false };

describe('deleteClientRoutineCopy', () => {
    beforeEach(() => { deletes.length = 0; });

    it('borra la copia privada que nunca se usó', async () => {
        db = { routine: copy, assignments: 0, logs: { count: 0 } };
        await deleteClientRoutineCopy('r1');
        expect(deletes).toEqual(['exercises', 'routines']);
    });

    it('no borra la copia si el cliente tiene entrenos registrados con ella', async () => {
        db = { routine: copy, assignments: 0, logs: { count: 21 } };
        await deleteClientRoutineCopy('r1');
        expect(deletes).toEqual([]);
    });

    it('no borra si no se puede comprobar el historial', async () => {
        db = { routine: copy, assignments: 0, logs: { count: null, error: { message: 'x' } } };
        await deleteClientRoutineCopy('r1');
        expect(deletes).toEqual([]);
    });

    it('nunca borra una plantilla', async () => {
        db = { routine: { owner_client_id: null, is_template: true }, assignments: 0, logs: { count: 0 } };
        await deleteClientRoutineCopy('r1');
        expect(deletes).toEqual([]);
    });
});
