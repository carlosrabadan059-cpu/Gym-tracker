import { describe, it, expect } from 'vitest';
import { buildCommentNotificationPayload } from './exerciseComments';

describe('buildCommentNotificationPayload', () => {
    it('arma la fila de notifications para el destinatario, con type comment', () => {
        const payload = buildCommentNotificationPayload({
            recipientId: 'user-123',
            exerciseName: 'Press banca',
            body: 'Sube el peso la próxima serie',
        });

        expect(payload).toEqual({
            user_id: 'user-123',
            title: 'Nuevo comentario en Press banca',
            message: 'Sube el peso la próxima serie',
            type: 'comment',
        });
    });
});
