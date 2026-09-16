import { describe, it, expect } from 'vitest';
import { groupConsecutiveExercises, clearBrokenSupersetGroups, toggleSupersetLink } from './superset';

describe('groupConsecutiveExercises', () => {
    it('sin ningún superset_group_id, todos sueltos', () => {
        const exercises = [{ id: 1 }, { id: 2 }, { id: 3 }];
        expect(groupConsecutiveExercises(exercises)).toEqual([
            [{ id: 1 }], [{ id: 2 }], [{ id: 3 }],
        ]);
    });

    it('un grupo de 2 contiguos', () => {
        const a = { id: 1, superset_group_id: 'g1' };
        const b = { id: 2, superset_group_id: 'g1' };
        const c = { id: 3 };
        expect(groupConsecutiveExercises([a, b, c])).toEqual([[a, b], [c]]);
    });

    it('un grupo de 3 contiguos', () => {
        const a = { id: 1, superset_group_id: 'g1' };
        const b = { id: 2, superset_group_id: 'g1' };
        const c = { id: 3, superset_group_id: 'g1' };
        expect(groupConsecutiveExercises([a, b, c])).toEqual([[a, b, c]]);
    });

    it('mismo id pero no contiguos: dos grupos de 1, no uno de 2', () => {
        const a = { id: 1, superset_group_id: 'g1' };
        const mid = { id: 2 };
        const b = { id: 3, superset_group_id: 'g1' };
        expect(groupConsecutiveExercises([a, mid, b])).toEqual([[a], [mid], [b]]);
    });

    it('dos grupos distintos separados por un ejercicio suelto', () => {
        const a = { id: 1, superset_group_id: 'g1' };
        const b = { id: 2, superset_group_id: 'g1' };
        const mid = { id: 3 };
        const c = { id: 4, superset_group_id: 'g2' };
        const d = { id: 5, superset_group_id: 'g2' };
        expect(groupConsecutiveExercises([a, b, mid, c, d])).toEqual([[a, b], [mid], [c, d]]);
    });
});

describe('clearBrokenSupersetGroups', () => {
    it('no cambia nada si todos los grupos siguen contiguos', () => {
        const list = [
            { catalog_id: 1, superset_group_id: 'g1' },
            { catalog_id: 2, superset_group_id: 'g1' },
            { catalog_id: 3 },
        ];
        expect(clearBrokenSupersetGroups(list)).toBe(list);
    });

    it('disuelve un grupo roto por un ejercicio intercalado', () => {
        const list = [
            { catalog_id: 1, superset_group_id: 'g1' },
            { catalog_id: 2 },
            { catalog_id: 3, superset_group_id: 'g1' },
        ];
        expect(clearBrokenSupersetGroups(list)).toEqual([
            { catalog_id: 1, superset_group_id: null },
            { catalog_id: 2 },
            { catalog_id: 3, superset_group_id: null },
        ]);
    });

    it('deja intacto un grupo no afectado mientras rompe otro', () => {
        const list = [
            { catalog_id: 1, superset_group_id: 'g1' },
            { catalog_id: 2 },
            { catalog_id: 3, superset_group_id: 'g1' },
            { catalog_id: 4, superset_group_id: 'g2' },
            { catalog_id: 5, superset_group_id: 'g2' },
        ];
        expect(clearBrokenSupersetGroups(list)).toEqual([
            { catalog_id: 1, superset_group_id: null },
            { catalog_id: 2 },
            { catalog_id: 3, superset_group_id: null },
            { catalog_id: 4, superset_group_id: 'g2' },
            { catalog_id: 5, superset_group_id: 'g2' },
        ]);
    });
});

describe('toggleSupersetLink', () => {
    it('vincula dos ejercicios sueltos generando un grupo nuevo', () => {
        const list = [{ catalog_id: 1 }, { catalog_id: 2 }, { catalog_id: 3 }];
        const result = toggleSupersetLink(list, 1, () => 'new-group');
        expect(result).toEqual([
            { catalog_id: 1, superset_group_id: 'new-group' },
            { catalog_id: 2, superset_group_id: 'new-group' },
            { catalog_id: 3 },
        ]);
    });

    it('extiende un grupo existente al vincular con el siguiente suelto', () => {
        const list = [
            { catalog_id: 1, superset_group_id: 'g1' },
            { catalog_id: 2, superset_group_id: 'g1' },
            { catalog_id: 3 },
        ];
        const result = toggleSupersetLink(list, 2, () => 'unused');
        expect(result).toEqual([
            { catalog_id: 1, superset_group_id: 'g1' },
            { catalog_id: 2, superset_group_id: 'g1' },
            { catalog_id: 3, superset_group_id: 'g1' },
        ]);
    });

    it('fusiona dos grupos al vincular su frontera', () => {
        const list = [
            { catalog_id: 1, superset_group_id: 'g1' },
            { catalog_id: 2, superset_group_id: 'g1' },
            { catalog_id: 3, superset_group_id: 'g2' },
            { catalog_id: 4, superset_group_id: 'g2' },
        ];
        const result = toggleSupersetLink(list, 2, () => 'unused');
        expect(result).toEqual([
            { catalog_id: 1, superset_group_id: 'g1' },
            { catalog_id: 2, superset_group_id: 'g1' },
            { catalog_id: 3, superset_group_id: 'g1' },
            { catalog_id: 4, superset_group_id: 'g1' },
        ]);
    });

    it('disuelve el grupo entero al pulsar sobre un enlace ya vinculado', () => {
        const list = [
            { catalog_id: 1, superset_group_id: 'g1' },
            { catalog_id: 2, superset_group_id: 'g1' },
            { catalog_id: 3, superset_group_id: 'g1' },
        ];
        const result = toggleSupersetLink(list, 1, () => 'unused');
        expect(result).toEqual([
            { catalog_id: 1, superset_group_id: null },
            { catalog_id: 2, superset_group_id: null },
            { catalog_id: 3, superset_group_id: null },
        ]);
    });

    it('no hace nada si el catalogId es el último de la lista', () => {
        const list = [{ catalog_id: 1 }, { catalog_id: 2 }];
        expect(toggleSupersetLink(list, 2, () => 'unused')).toBe(list);
    });
});
