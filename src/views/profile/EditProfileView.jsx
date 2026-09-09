import React, { useState, useRef, useEffect } from 'react';
import { Camera, Save, Loader2, Dumbbell, Flame, Activity, Heart, Shield, Scale, Lock, Eye, EyeOff, Watch, RefreshCw } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { isHealthAvailableOnThisPlatform, getLatestBodyWeight } from '../../lib/appleHealth';

export function EditProfileView({ user, onBack, onSave }) {
    const [formData, setFormData] = useState(user);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    // v2 Fase 3 — peso corporal recogido de Health en vez de pedirlo siempre
    // a mano. Solo autorrellena si el campo está vacío; sigue editable, y
    // "Sincronizar" lo vuelve a pedir cuando se quiera.
    const [weightFromHealth, setWeightFromHealth] = useState(false);
    const [syncingWeight, setSyncingWeight] = useState(false);
    const [weightSyncMessage, setWeightSyncMessage] = useState('');

    // `manual`: si viene del botón, avisa cuando no hay dato en Health en
    // vez de quedarse en silencio (parecería que el botón no hizo nada). El
    // intento automático al montar sí se queda callado — no tiene sentido
    // avisar de "sin datos" nada más abrir la pantalla.
    const syncWeightFromHealth = async (manual = false) => {
        setSyncingWeight(true);
        setWeightSyncMessage('');
        try {
            const weight = await getLatestBodyWeight();
            if (weight != null) {
                setFormData(f => ({ ...f, stats: { ...f.stats, weight } }));
                setWeightFromHealth(true);
            } else if (manual) {
                setWeightSyncMessage('Sin peso registrado en Salud');
            }
        } catch (err) {
            console.error('[Health] No se pudo leer el peso corporal:', err);
            if (manual) setWeightSyncMessage('No se pudo leer Salud ahora mismo');
        } finally {
            setSyncingWeight(false);
        }
    };

    useEffect(() => {
        if (isHealthAvailableOnThisPlatform() && !user.stats.weight) {
            syncWeightFromHealth();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar, con el peso inicial
    }, []);

    const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);

    const handlePasswordChange = async () => {
        setPasswordError('');
        setPasswordSuccess('');
        if (passwordData.newPassword.length < 6) {
            setPasswordError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError('Las contraseñas no coinciden.');
            return;
        }
        setSavingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
            if (error) throw error;
            setPasswordSuccess('Contraseña actualizada correctamente.');
            setPasswordData({ newPassword: '', confirmPassword: '' });
        } catch (error) {
            setPasswordError(error.message || 'Error al cambiar la contraseña.');
        } finally {
            setSavingPassword(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'weight') setWeightFromHealth(false);
        if (name in formData.stats) {
            setFormData({
                ...formData,
                stats: { ...formData.stats, [name]: value }
            });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleImageUpload = async (event) => {
        try {
            setUploading(true);

            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('Debes seleccionar una imagen para subir.');
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

            setFormData({ ...formData, avatar: data.publicUrl });
        } catch (error) {
            console.error('Error uploading avatar:', error);
            alert('Error uploading avatar!');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-24">
            <header className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="text-text-secondary hover:text-black dark:hover:text-white">
                    ← Volver
                </button>
                <h2 className="text-xl font-bold text-black dark:text-white">Editar Perfil</h2>
            </header>

            <div className="flex justify-center mb-8">
                <div className="relative">
                    <div className="h-28 w-28 rounded-full p-1 bg-surface-highlight">
                        <img
                            src={formData.avatar}
                            alt="Profile"
                            className="h-full w-full rounded-full object-cover"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = `https://ui-avatars.com/api/?name=${formData.name || 'User'}&background=random&color=fff`;
                            }}
                        />
                        {uploading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                                <Loader2 className="animate-spin text-white" />
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 bg-primary p-2 rounded-full text-black hover:bg-primary-hover transition-colors"
                        disabled={uploading}
                    >
                        <Camera size={18} />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        className="hidden"
                    />
                </div>
            </div>

            <Card className="p-6 space-y-4">
                <div className="space-y-2">
                    <label className="text-sm text-text-secondary">Nombre de Usuario</label>
                    <input
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full bg-surface rounded-lg p-3 text-black dark:text-white border border-surface-highlight focus:border-primary outline-none transition-colors"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm text-text-secondary">Email</label>
                    <input
                        name="email"
                        value={formData.email}
                        disabled
                        className="w-full bg-surface/50 rounded-lg p-3 text-text-secondary border border-transparent outline-none cursor-not-allowed"
                    />
                </div>
            </Card>



            <div className="space-y-3">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider px-2">Objetivo Principal</h3>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { label: 'Hipertrofia', value: 'Hipertrofia', icon: Dumbbell, desc: 'Ganar Músculo' },
                        { label: 'Definición', value: 'Pérdida de Peso', icon: Flame, desc: 'Quemar Grasa' },
                        { label: 'Fuerza', value: 'Fuerza', icon: Scale, desc: 'Potencia Máxima' },
                        { label: 'Resistencia', value: 'Resistencia', icon: Activity, desc: 'Cardiovascular' },
                        { label: 'Salud', value: 'Salud General', icon: Heart, desc: 'Bienestar' },
                        { label: 'Mantener', value: 'Mantenimiento', icon: Shield, desc: 'Peso Actual' },
                    ].map((goal) => (
                        <button
                            key={goal.value}
                            onClick={() => setFormData({ ...formData, goal: goal.value })}
                            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.goal === goal.value
                                ? 'bg-primary/20 border-primary text-primary shadow-sm'
                                : 'bg-surface border-transparent text-text-secondary hover:bg-surface-highlight hover:text-text-primary'
                                }`}
                        >
                            <goal.icon size={24} className={formData.goal === goal.value ? 'text-primary' : 'text-text-secondary'} />
                            <div className="text-center">
                                <span className={`block font-bold text-sm ${formData.goal === goal.value ? 'text-text-primary' : 'text-text-secondary'}`}>
                                    {goal.label}
                                </span>
                                <span className="text-xs text-text-secondary/70">{goal.desc}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider px-2">Estadísticas Físicas</h3>
            <div className="grid grid-cols-3 gap-3">
                <Card className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-text-secondary">Peso</label>
                        {isHealthAvailableOnThisPlatform() && (
                            <button
                                onClick={() => syncWeightFromHealth(true)}
                                disabled={syncingWeight}
                                className="text-text-secondary disabled:opacity-40"
                                title="Sincronizar desde Apple Health"
                            >
                                <RefreshCw size={12} className={syncingWeight ? 'animate-spin' : ''} />
                            </button>
                        )}
                    </div>
                    <input
                        name="weight"
                        type="number"
                        value={formData.stats.weight}
                        onChange={handleChange}
                        placeholder="0"
                        className="w-full bg-transparent text-lg font-bold text-black dark:text-white outline-none border-b border-surface-highlight focus:border-primary"
                    />
                    {weightFromHealth && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-wide">
                            <Watch size={10} /> Health
                        </span>
                    )}
                    {weightSyncMessage && (
                        <p className="text-[10px] text-text-secondary leading-tight">{weightSyncMessage}</p>
                    )}
                </Card>
                <Card className="p-4 space-y-2">
                    <label className="text-xs text-text-secondary">Altura</label>
                    <input
                        name="height"
                        type="number"
                        value={formData.stats.height}
                        onChange={handleChange}
                        placeholder="0"
                        className="w-full bg-transparent text-lg font-bold text-black dark:text-white outline-none border-b border-surface-highlight focus:border-primary"
                    />
                </Card>
                <Card className="p-4 space-y-2">
                    <label className="text-xs text-text-secondary">Edad</label>
                    <input
                        name="age"
                        type="number"
                        value={formData.stats.age}
                        onChange={handleChange}
                        placeholder="0"
                        className="w-full bg-transparent text-lg font-bold text-black dark:text-white outline-none border-b border-surface-highlight focus:border-primary"
                    />
                </Card>
            </div>

            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider px-2">Seguridad</h3>
            <Card className="p-6 space-y-4">
                <div className="space-y-2">
                    <label className="text-sm text-text-secondary">Nueva contraseña</label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={passwordData.newPassword}
                            onChange={e => setPasswordData(p => ({ ...p, newPassword: e.target.value }))}
                            placeholder="Mínimo 6 caracteres"
                            className="w-full bg-surface rounded-lg p-3 pr-10 text-black dark:text-white border border-surface-highlight focus:border-primary outline-none transition-colors"
                        />
                        <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-3.5 text-text-secondary">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm text-text-secondary">Confirmar contraseña</label>
                    <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordData.confirmPassword}
                        onChange={e => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))}
                        placeholder="Repite la contraseña"
                        className="w-full bg-surface rounded-lg p-3 text-black dark:text-white border border-surface-highlight focus:border-primary outline-none transition-colors"
                    />
                </div>
                {passwordError && <p className="text-red-400 text-sm">{passwordError}</p>}
                {passwordSuccess && <p className="text-green-400 text-sm">{passwordSuccess}</p>}
                <button
                    onClick={handlePasswordChange}
                    disabled={savingPassword || !passwordData.newPassword}
                    className="w-full bg-surface-highlight text-text-primary font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {savingPassword ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                    Cambiar contraseña
                </button>
            </Card>

            <button
                onClick={() => onSave(formData)}
                className="w-full bg-primary text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:brightness-110 transition-all mt-8"
            >
                <Save size={20} />
                Guardar Cambios
            </button>
        </div >
    );
}
