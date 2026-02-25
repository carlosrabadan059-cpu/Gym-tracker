import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Bell, Mail, Clock } from 'lucide-react';

export function NotificationSettingsView({ onBack }) {
    const [toggles, setToggles] = useState({
        push: true,
        email: false,
        reminders: true
    });

    const toggle = (key) => setToggles({ ...toggles, [key]: !toggles[key] });

    return (
        <div className="space-y-6 animate-fadeIn pb-24">
            <header className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="text-text-secondary hover:text-black dark:hover:text-white">
                    ← Volver
                </button>
                <h2 className="text-xl font-bold text-black dark:text-white">Notificaciones</h2>
            </header>

            <Card className="divide-y divide-surface-highlight">
                {[
                    { key: 'push', label: 'Notificaciones Push', icon: Bell, desc: 'Recibe alertas sobre tu rutina' },
                    { key: 'email', label: 'Boletín por Email', icon: Mail, desc: 'Novedades y consejos semanales' },
                    { key: 'reminders', label: 'Recordatorios de Entreno', icon: Clock, desc: 'Si no has entrenado en 3 días' }
                ].map((item) => (
                    <div key={item.key} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-surface-highlight rounded-lg text-primary">
                                <item.icon size={20} />
                            </div>
                            <div>
                                <h4 className="font-medium text-text-primary">{item.label}</h4>
                                <p className="text-xs text-text-secondary">{item.desc}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => toggle(item.key)}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${toggles[item.key] ? 'bg-primary' : 'bg-surface-highlight'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-surface shadow-sm transition-transform ${toggles[item.key] ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                    </div>
                ))}
            </Card>
        </div>
    );
}
