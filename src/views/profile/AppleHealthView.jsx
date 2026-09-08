import React, { useState, useCallback } from 'react';
import { Heart, RefreshCw, Footprints, Flame, HeartPulse, Smartphone } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import {
    isHealthAvailableOnThisPlatform,
    requestHealthAuthorization,
    getTodayMetrics,
} from '../../lib/appleHealth';

// HealthKit no deja saber si el usuario denegó la lectura de un tipo
// concreto — es privacidad por diseño de Apple, solo se puede saber si
// escribir está autorizado. Por eso "conectado" aquí significa "completó el
// diálogo de permiso alguna vez", no "dio el sí a todo". Se guarda en
// localStorage porque es un estado de ESTE iPhone, no de la cuenta.
const STORAGE_KEY = 'rutinex_health_connected_at';

export function AppleHealthView({ onBack }) {
    const available = isHealthAvailableOnThisPlatform();
    const [connectedAt, setConnectedAt] = useState(() => localStorage.getItem(STORAGE_KEY));
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState(null);

    const sync = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            const metrics = await getTodayMetrics();
            setPreview(metrics);
            const now = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, now);
            setConnectedAt(now);
        } catch (err) {
            console.error('[Health] Sync failed:', err);
            setError('No se pudo leer Salud ahora mismo. Inténtalo de nuevo.');
        } finally {
            setBusy(false);
        }
    }, []);

    const connect = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            await requestHealthAuthorization();
            await sync();
        } catch (err) {
            console.error('[Health] Authorization failed:', err);
            setError('No se pudo conectar con Salud. Inténtalo de nuevo.');
            setBusy(false);
        }
    }, [sync]);

    const disconnect = () => {
        if (!window.confirm('Rutinex dejará de leer Salud. Para revocar el permiso del todo, hazlo desde Ajustes del iPhone → Salud → Acceso y dispositivos.')) return;
        localStorage.removeItem(STORAGE_KEY);
        setConnectedAt(null);
        setPreview(null);
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-24">
            <header className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="text-text-secondary hover:text-black dark:hover:text-white">
                    ← Volver
                </button>
                <h2 className="text-xl font-bold text-black dark:text-white">Apple Health</h2>
            </header>

            {!available ? (
                <Card className="p-6 text-center">
                    <Smartphone size={32} className="mx-auto mb-3 text-text-secondary" />
                    <h3 className="font-bold text-text-primary mb-1">Solo disponible en la app de iPhone</h3>
                    <p className="text-sm text-text-secondary">
                        Apple Health es un framework nativo de iOS. Abre Rutinex desde el icono
                        instalado en tu iPhone para conectarlo — no funciona en el navegador.
                    </p>
                </Card>
            ) : connectedAt ? (
                <>
                    <Card className="border border-surface-highlight">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-text-primary flex items-center gap-2">
                                <Heart size={16} className="text-primary" />
                                Conectado
                            </h4>
                            <button
                                onClick={sync}
                                disabled={busy}
                                className="flex items-center gap-1 text-[11px] text-text-secondary disabled:opacity-50"
                            >
                                <RefreshCw size={11} className={busy ? 'animate-spin' : ''} />
                                {busy ? 'Sincronizando…' : `Última sync: ${formatRelative(connectedAt)}`}
                            </button>
                        </div>

                        {preview ? (
                            <div className="grid grid-cols-3 gap-3">
                                <Metric icon={<Footprints size={16} className="text-blue-400 mx-auto mb-1" />} value={preview.steps?.toLocaleString('es-ES') ?? '--'} label="pasos" />
                                <Metric icon={<Flame size={16} className="text-orange-400 mx-auto mb-1" />} value={preview.activeCalories ? Math.round(preview.activeCalories) : '--'} label="kcal" />
                                <Metric icon={<HeartPulse size={16} className="text-red-400 mx-auto mb-1" />} value={preview.restingHr ? Math.round(preview.restingHr) : '--'} label="FC reposo" />
                            </div>
                        ) : (
                            <p className="text-xs text-text-secondary">
                                Sin datos de hoy todavía. Puede ser normal (aún no hay actividad) o que
                                falte algún permiso — compruébalo en Ajustes del iPhone → Salud → Acceso
                                y dispositivos → Rutinex.
                            </p>
                        )}
                    </Card>

                    {error && <p className="text-sm text-red-500 px-2">{error}</p>}

                    <button
                        onClick={disconnect}
                        className="w-full text-center text-sm text-red-500 hover:bg-red-500/10 rounded-xl py-3 transition-colors"
                    >
                        Desconectar
                    </button>
                </>
            ) : (
                <Card className="border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent text-center py-8">
                    <Heart size={28} className="text-primary mx-auto mb-2" />
                    <h4 className="font-bold text-text-primary mb-1">Conecta Apple Health</h4>
                    <p className="text-xs text-text-secondary mb-4 max-w-[16rem] mx-auto">
                        Detecta tu cardio automáticamente y trae kcal reales del Watch a cada entreno.
                    </p>
                    {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
                    <button
                        onClick={connect}
                        disabled={busy}
                        className="bg-primary text-black font-bold rounded-full px-6 py-2.5 disabled:opacity-50"
                    >
                        {busy ? 'Conectando…' : 'Conectar con Apple Health'}
                    </button>
                </Card>
            )}
        </div>
    );
}

function Metric({ icon, value, label }) {
    return (
        <div className="rounded-xl bg-surface-highlight/60 p-3 text-center">
            {icon}
            <p className="text-base font-black text-text-primary">{value}</p>
            <p className="text-[10px] text-text-secondary">{label}</p>
        </div>
    );
}

function formatRelative(isoDate) {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'ahora mismo';
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `hace ${diffH} h`;
    return `hace ${Math.floor(diffH / 24)} d`;
}
