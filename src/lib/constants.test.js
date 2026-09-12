import { describe, it, expect } from 'vitest';
import { TRAINER_ROLES, isTrainer } from './constants';

describe('isTrainer', () => {
    it('acepta los roles con permisos de entrenador', () => {
        expect(isTrainer({ role: 'trainer' })).toBe(true);
        expect(isTrainer({ role: 'admin' })).toBe(true);
        expect(TRAINER_ROLES).toEqual(['trainer', 'admin']);
    });

    it('rechaza clientes y roles desconocidos', () => {
        expect(isTrainer({ role: 'client' })).toBe(false);
        expect(isTrainer({ role: 'user' })).toBe(false);
    });

    it('distingue mayúsculas: "Trainer" NO es entrenador', () => {
        // El rol se guarda en minúsculas en `profiles.role`; si eso cambia,
        // este test avisa antes de que se abra un agujero de permisos.
        expect(isTrainer({ role: 'Trainer' })).toBe(false);
    });

    it('un perfil ausente o sin rol nunca es entrenador', () => {
        expect(isTrainer(null)).toBe(false);
        expect(isTrainer(undefined)).toBe(false);
        expect(isTrainer({})).toBe(false);
        expect(isTrainer({ role: null })).toBe(false);
    });
});
