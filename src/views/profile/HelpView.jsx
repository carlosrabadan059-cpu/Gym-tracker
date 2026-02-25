import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import {
    HelpCircle, MessageSquare, ExternalLink, ChevronDown, ChevronUp,
    Send, CheckCircle, AlertCircle, Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export function HelpView({ onBack }) {
    const { user } = useAuth();
    const [openFaq, setOpenFaq] = useState(0); // First one open by default
    const [isFormView, setIsFormView] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        subject: 'General',
        message: ''
    });

    const faqs = [
        {
            q: "¿Cómo cambio mis rutinas?",
            a: "Ve a la sección de Entrenamientos y selecciona 'Editar' en la rutina que desees modificar."
        },
        {
            q: "¿Se guardan mis datos?",
            a: "Sí, todos tus progresos se sincronizan automáticamente en la nube para que nunca pierdas tu información."
        },
        {
            q: "¿Cómo contacto soporte?",
            a: "Si tienes algún problema técnico o sugerencia, puedes usar el formulario de 'Enviar Mensaje' aquí abajo."
        }
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.message.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const { error: submitError } = await supabase
                .from('support_messages')
                .insert({
                    user_id: user.id,
                    subject: formData.subject,
                    message: formData.message
                });

            if (submitError) throw submitError;

            setSuccess(true);
            setFormData({ subject: 'General', message: '' });
        } catch (err) {
            console.error('Error sending support message:', err);
            setError('No se pudo enviar el mensaje. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (isFormView) {
            setIsFormView(false);
            setSuccess(false);
            setError(null);
        } else {
            onBack();
        }
    };

    if (isFormView) {
        return (
            <div className="space-y-8 animate-fadeIn pb-24 px-2">
                <header className="flex items-center gap-4 mb-2">
                    <button
                        onClick={handleBack}
                        className="text-text-secondary hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium"
                    >
                        ← Volver
                    </button>
                    <h2 className="text-2xl font-bold text-text-primary">Contactar Soporte</h2>
                </header>

                <Card className="p-6 bg-surface border-none shadow-xl">
                    {success ? (
                        <div className="py-8 flex flex-col items-center text-center space-y-4">
                            <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                                <CheckCircle size={48} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-text-primary">¡Mensaje Enviado!</h3>
                                <p className="text-text-secondary mt-2">Hemos recibido tu consulta. Te responderemos lo antes posible.</p>
                            </div>
                            <button
                                onClick={handleBack}
                                className="mt-6 px-8 py-3 bg-primary text-black font-bold rounded-xl hover:bg-primary-hover transition-colors"
                            >
                                Volver a Ayuda
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider ml-1">Asunto</label>
                                <select
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    className="w-full bg-surface-highlight border-none rounded-xl p-4 text-text-primary focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                >
                                    <option value="General">Consulta General</option>
                                    <option value="Técnico">Problema Técnico</option>
                                    <option value="Suscripción">Pagos y Suscripción</option>
                                    <option value="Feedback">Sugerencia / Feedback</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider ml-1">Tu Mensaje</label>
                                <textarea
                                    required
                                    rows={5}
                                    placeholder="Explícanos cómo podemos ayudarte..."
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    className="w-full bg-surface-highlight border-none rounded-xl p-4 text-text-primary focus:ring-2 focus:ring-primary/50 outline-none transition-all resize-none"
                                />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-4 bg-red-500/10 text-red-500 rounded-xl text-sm border border-red-500/20">
                                    <AlertCircle size={18} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !formData.message.trim()}
                                className="w-full bg-primary text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-[0.98]"
                            >
                                {loading ? (
                                    <Loader2 size={24} className="animate-spin" />
                                ) : (
                                    <>
                                        <Send size={20} />
                                        <span>Enviar Mensaje</span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn pb-24 px-2">
            <header className="flex items-center gap-4 mb-2">
                <button
                    onClick={onBack}
                    className="text-text-secondary hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium"
                >
                    ← Volver
                </button>
                <h2 className="text-2xl font-bold text-text-primary">Ayuda y Soporte</h2>
            </header>

            <div className="space-y-8">
                {/* FAQ Section */}
                <section>
                    <h3 className="text-xs font-black text-text-secondary uppercase tracking-widest px-1 mb-4 opacity-70">
                        PREGUNTAS FRECUENTES
                    </h3>
                    <div className="space-y-3">
                        {faqs.map((faq, i) => (
                            <button
                                key={i}
                                onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                                className="w-full text-left"
                            >
                                <Card className={`p-5 bg-surface border-none transition-all duration-300 ${openFaq === i ? 'ring-1 ring-primary/30 shadow-lg' : 'hover:bg-surface-highlight'}`}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className={`mt-0.5 p-1.5 rounded-lg ${openFaq === i ? 'bg-primary/20 text-primary' : 'bg-surface-highlight text-text-secondary'}`}>
                                                <HelpCircle size={18} />
                                            </div>
                                            <div>
                                                <h4 className={`font-bold transition-colors ${openFaq === i ? 'text-text-primary' : 'text-text-secondary'}`}>
                                                    {faq.q}
                                                </h4>
                                                {openFaq === i && (
                                                    <p className="text-sm text-text-secondary leading-relaxed mt-3 pr-4 animate-slideDown">
                                                        {faq.a}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-text-secondary mt-1">
                                            {openFaq === i ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>
                                </Card>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Contact Section */}
                <section>
                    <h3 className="text-xs font-black text-text-secondary uppercase tracking-widest px-1 mb-4 opacity-70">
                        CONTACTO
                    </h3>
                    <button
                        onClick={() => setIsFormView(true)}
                        className="w-full bg-surface border-none p-5 rounded-2xl flex items-center justify-between hover:bg-surface-highlight transition-all active:scale-[0.98] group cursor-pointer shadow-sm"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform">
                                <MessageSquare size={28} />
                            </div>
                            <div className="text-left">
                                <h4 className="font-bold text-text-primary text-lg">Enviar Mensaje</h4>
                                <p className="text-sm text-text-secondary">Normalmente respondemos en 24h</p>
                            </div>
                        </div>
                        <div className="p-2 rounded-full bg-surface-highlight text-text-secondary group-hover:text-primary transition-colors">
                            <ExternalLink size={20} />
                        </div>
                    </button>

                    <div className="flex flex-col items-center mt-12 space-y-2">
                        <p className="text-xs font-medium text-text-secondary opacity-40">
                            Gym Tracker App • v1.0.0 (Beta)
                        </p>
                        <div className="h-1 w-12 bg-surface-highlight rounded-full"></div>
                    </div>
                </section>
            </div>
        </div>
    );
}
