import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Eye, CheckCircle, HeartPulse } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export function PrivacyView({ onBack }) {
    const { user } = useAuth();
    // null = este cliente no tiene entrenador (no hay nada que compartir ni
    // con quién), así que la fila entera no se muestra.
    const [healthConsent, setHealthConsent] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        supabase
            .from('trainer_clients')
            .select('health_consent')
            .eq('client_id', user.id)
            .maybeSingle()
            .then(({ data }) => {
                if (!cancelled) setHealthConsent(data?.health_consent ?? null);
            });
        return () => { cancelled = true; };
    }, [user?.id]);

    const toggleHealthConsent = async () => {
        const nextStatus = healthConsent === 'granted' ? 'denied' : 'granted';
        setSaving(true);
        try {
            const { error } = await supabase.rpc('set_health_consent', { new_status: nextStatus });
            if (error) throw error;
            setHealthConsent(nextStatus);
        } catch (err) {
            console.error('Error actualizando consentimiento de salud:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-24">
            <header className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="text-text-secondary hover:text-black dark:hover:text-white">
                    ← Volver
                </button>
                <h2 className="text-xl font-bold text-black dark:text-white">Privacidad y Seguridad</h2>
            </header>

            <div className="space-y-4">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider px-2">Seguridad</h3>
                <Card className="p-1">
                    <button className="w-full flex items-center justify-between p-4 hover:bg-surface-highlight rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                            <CheckCircle size={20} className="text-green-400" />
                            <span className="text-text-primary font-medium">Verificación en dos pasos</span>
                        </div>
                        <span className="text-xs text-text-secondary">Activado</span>
                    </button>
                </Card>

                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider px-2 pt-4">Privacidad</h3>
                <Card className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Eye size={20} className="text-blue-400" />
                            <div>
                                <h4 className="font-medium text-text-primary">Perfil Público</h4>
                                <p className="text-xs text-text-secondary">Permitir que otros vean tus estadísticas</p>
                            </div>
                        </div>
                        <div className="w-12 h-6 bg-surface-highlight rounded-full p-1 relative">
                            <div className="w-4 h-4 bg-text-secondary rounded-full" />
                        </div>
                    </div>

                    {healthConsent !== null && (
                        <div className="flex items-center justify-between pt-4 border-t border-surface-highlight">
                            <div className="flex items-center gap-3">
                                <HeartPulse size={20} className="text-primary" />
                                <div>
                                    <h4 className="font-medium text-text-primary">Datos de salud con mi entrenador</h4>
                                    <p className="text-xs text-text-secondary">
                                        {healthConsent === 'pending'
                                            ? 'Aún no has respondido — actívalo aquí o desde el aviso del Dashboard.'
                                            : 'Comparte tu peso corporal y las calorías reales de tus sesiones.'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={toggleHealthConsent}
                                disabled={saving}
                                aria-label="Compartir datos de salud con mi entrenador"
                                className={`w-12 h-6 rounded-full p-1 relative flex-shrink-0 transition-colors disabled:opacity-50 ${healthConsent === 'granted' ? 'bg-primary' : 'bg-surface-highlight'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${healthConsent === 'granted' ? 'translate-x-6' : ''}`} />
                            </button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
