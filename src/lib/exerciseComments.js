// Construye la fila de `notifications` para el otro participante de un hilo
// de comentarios de ejercicio. Función pura y testeable a propósito: separa
// "qué se notifica" (aquí) de "cuándo se dispara" (ExerciseCommentThread.jsx,
// que sí toca Supabase).
export function buildCommentNotificationPayload({ recipientId, exerciseName, body }) {
    return {
        user_id: recipientId,
        title: `Nuevo comentario en ${exerciseName}`,
        message: body,
        type: 'comment',
    };
}
