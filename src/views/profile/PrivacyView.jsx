import React from 'react';
import { Card } from '../../components/ui/Card';
import { Lock, Eye, CheckCircle } from 'lucide-react';

export function PrivacyView({ onBack }) {
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
                            <Lock size={20} className="text-purple-400" />
                            <span className="text-text-primary font-medium">Cambiar Contraseña</span>
                        </div>
                    </button>
                    <div className="h-px bg-surface-highlight mx-4" />
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
                </Card>
            </div>
        </div>
    );
}
