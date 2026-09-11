import { useEffect, useRef, useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { BotMarkdown } from '../ui/BotMarkdown';
import { buildRoutineBreakdown } from '../../lib/exerciseClassifier';

const REQUEST_TIMEOUT_MS = 30000;

const PATTERN_LABELS = {
    empuje: 'empuje',
    tiron: 'tirón',
    pierna: 'pierna',
    core: 'core',
    otro: 'otro',
};

function formatExercisesSummary(items) {
    const lines = items.map(function formatLine(item, index) {
        const tipo = item.compound ? 'compuesto' : 'aislamiento';
        const patternLabel = PATTERN_LABELS[item.pattern] || item.pattern;
        return (index + 1) + '. ' + item.name + ' (' + item.category + ', ' + patternLabel + ', ' + tipo + ') ' + item.series + 'x' + item.reps;
    });
    return lines.join('\n');
}

// exercises: [{ name, category, series, reps }] en el orden real de la rutina
// routineName: string
// clientGoal: string | undefined
export function RoutineReviewModal({ exercises, routineName, clientGoal, onClose }) {
    const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'
    const [answer, setAnswer] = useState('');
    const hasRunRef = useRef(false);
    const paramsRef = useRef({ exercises, routineName, clientGoal });

    useEffect(() => {
        if (hasRunRef.current) return;
        hasRunRef.current = true;

        const { exercises: initialExercises, routineName: initialRoutineName, clientGoal: initialClientGoal } = paramsRef.current;

        let cancelled = false;
        let controller;
        let timer;

        const run = async () => {
            const webhookUrl = import.meta.env.VITE_N8N_TRAINER_REVIEW_WEBHOOK_URL;
            if (!webhookUrl) {
                if (!cancelled) {
                    setStatus('error');
                    setAnswer('Falta configurar VITE_N8N_TRAINER_REVIEW_WEBHOOK_URL.');
                }
                return;
            }

            const breakdown = buildRoutineBreakdown(initialExercises);
            const exercisesSummary = formatExercisesSummary(breakdown.items);

            try {
                controller = new AbortController();
                timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        routineName: initialRoutineName || 'Rutina sin nombre',
                        clientGoal: initialClientGoal || 'No especificado',
                        exercisesSummary,
                    }),
                    signal: controller.signal,
                });
                clearTimeout(timer);

                if (!response.ok) throw new Error('Respuesta HTTP ' + response.status);
                const data = await response.json();
                if (cancelled) return;
                setAnswer(data.answer || 'Sin respuesta de la IA.');
                setStatus('done');
            } catch (err) {
                if (cancelled) return;
                console.error('Error revisando rutina con IA:', err);
                setStatus('error');
                setAnswer('No se pudo completar la revisión. Inténtalo de nuevo.');
            }
        };

        run();
        return () => {
            cancelled = true;
            controller?.abort();
            clearTimeout(timer);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
            <div
                className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-surface rounded-t-3xl p-6 pb-10 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-primary" />
                        <h3 className="text-lg font-bold text-text-primary">Revisión con IA</h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-highlight transition-colors">
                        <X size={18} className="text-text-secondary" />
                    </button>
                </div>

                {status === 'loading' && (
                    <div className="flex items-center gap-2 text-text-secondary py-8 justify-center">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm">Analizando la rutina...</span>
                    </div>
                )}

                {status !== 'loading' && <BotMarkdown text={answer} />}

                <button
                    onClick={onClose}
                    className="w-full bg-surface-highlight text-text-primary font-bold px-4 py-2.5 rounded-xl text-sm hover:bg-gray-600 transition-colors"
                >
                    Cerrar
                </button>
            </div>
        </div>
    );
}
