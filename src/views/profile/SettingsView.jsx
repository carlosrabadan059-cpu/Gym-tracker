import React from 'react';
import { Card } from '../../components/ui/Card';
import { Globe, Moon, Ruler, Sun, Smartphone } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export function SettingsView({ onBack }) {
    const { theme, setTheme } = useTheme();

    const themes = [
        { id: 'light', label: 'Claro', icon: Sun },
        { id: 'dark', label: 'Oscuro', icon: Moon },
        { id: 'system', label: 'Auto', icon: Smartphone },
    ];

    return (
        <div className="space-y-6 animate-fadeIn pb-24">
            <header className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="text-text-secondary hover:text-text-primary transition-colors">
                    ← Volver
                </button>
                <h2 className="text-xl font-bold text-text-primary">Configuración General</h2>
            </header>

            <Card className="divide-y divide-white/5">
                <button className="w-full flex items-center justify-between p-4 hover:bg-surface-highlight rounded-t-xl transition-colors">
                    <div className="flex items-center gap-3">
                        <Globe size={20} className="text-blue-400" />
                        <span className="text-text-primary font-medium">Idioma</span>
                    </div>
                    <span className="text-sm text-text-secondary">Español</span>
                </button>

                <button className="w-full flex items-center justify-between p-4 hover:bg-surface-highlight transition-colors">
                    <div className="flex items-center gap-3">
                        <Ruler size={20} className="text-green-400" />
                        <span className="text-text-primary font-medium">Unidades</span>
                    </div>
                    <span className="text-sm text-text-secondary">Métrico (kg, cm)</span>
                </button>

                <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3 mb-2">
                        <Moon size={20} className="text-purple-400" />
                        <div className="text-left">
                            <h4 className="font-medium text-text-primary">Apariencia</h4>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-background/50 p-1 rounded-xl">
                        {themes.map((t) => {
                            const Icon = t.icon;
                            const isActive = theme === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setTheme(t.id)}
                                    className={`
                                        flex flex-col items-center justify-center py-2.5 rounded-lg text-xs font-medium transition-all duration-200
                                        ${isActive
                                            ? 'bg-primary text-black shadow-sm'
                                            : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                                        }
                                    `}
                                >
                                    <Icon size={18} className="mb-1" />
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </Card>
        </div>
    );
}
