import { useState, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { buildCommentNotificationPayload } from '../../lib/exerciseComments';

// Hilo de comentarios de texto plano por ejercicio (exercises.id). Append-only
// a propósito (Fase 4 del plan de entrenador): sin editar ni borrar. Se monta
// en dos sitios que ya existen — ExerciseDetailModal.jsx (cliente) y el editor
// inline de ClientProfileView.jsx (entrenador) — cada uno le pasa quién es el
// destinatario de la notificación (recipientId) y cómo llamar al otro lado
// (counterpartLabel), porque ninguno de los dos sabe resolver al otro por sí
// mismo sin una query adicional que aquí no hace falta.
export function ExerciseCommentThread({ exerciseId, exerciseName, recipientId, counterpartLabel }) {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);

    // isActive: guarda contra respuestas obsoletas cuando exerciseId cambia
    // rápido o el componente se desmonta a mitad de la petición.
    const fetchComments = useCallback(async (isActive = () => true) => {
        setLoading(true);
        const { data, error: fetchError } = await supabase
            .from('exercise_comments')
            .select('*')
            .eq('exercise_id', exerciseId)
            .order('created_at', { ascending: true });
        if (!isActive()) return;
        if (!fetchError) setComments(data || []);
        setLoading(false);
    }, [exerciseId]);

    useEffect(() => {
        let cancelled = false;
        fetchComments(() => !cancelled);
        return () => { cancelled = true; };
    }, [fetchComments]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = body.trim();
        if (!trimmed || sending) return;
        setSending(true);
        setError(null);
        try {
            const { error: insertError } = await supabase.from('exercise_comments').insert({
                exercise_id: exerciseId,
                author_id: user.id,
                body: trimmed,
            });
            if (insertError) throw insertError;

            if (recipientId) {
                const payload = buildCommentNotificationPayload({ recipientId, exerciseName, body: trimmed });
                const { error: notifError } = await supabase.from('notifications').insert(payload);
                if (notifError) console.error('Error creating comment notification:', notifError);
            }

            setBody('');
            await fetchComments();
        } catch (err) {
            console.error('Error posting exercise comment:', err);
            setError('No se pudo enviar el comentario. Inténtalo de nuevo.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Comentarios</p>

            {loading ? (
                <p className="text-xs text-text-secondary">Cargando…</p>
            ) : comments.length === 0 ? (
                <p className="text-xs text-text-secondary">Sin comentarios todavía.</p>
            ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {comments.map((c) => {
                        const isMine = c.author_id === user.id;
                        return (
                            <div key={c.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isMine ? 'bg-primary text-black' : 'bg-surface-highlight text-text-primary'}`}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 mb-0.5">
                                        {isMine ? 'Tú' : counterpartLabel}
                                    </p>
                                    <p>{c.body}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {error && <p className="text-sm text-red-500 mb-2">{error}</p>}

            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                    type="text"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Escribe un comentario…"
                    className="flex-1 bg-background border border-surface-highlight rounded-full px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
                />
                <button
                    type="submit"
                    disabled={!body.trim() || sending}
                    aria-label="Enviar comentario"
                    className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                >
                    <Send size={14} className="text-black" />
                </button>
            </form>
        </div>
    );
}
