import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Dumbbell } from 'lucide-react';
import { UNCLASSIFIED_GROUP } from '../../lib/muscleVolume';

// Series completadas por grupo muscular en la semana en curso. Sin estado ni
// acceso a Supabase: cada vista (Estadísticas del cliente, ficha de cliente
// del entrenador) resuelve sus datos y le pasa el array ya calculado por
// computeWeeklyMuscleVolume.
export function MuscleVolumeCard({ data, title = 'Volumen por grupo (esta semana)' }) {
    const totalSets = (data || []).reduce((sum, row) => sum + row.sets, 0);

    return (
        <div className="bg-surface rounded-2xl p-4 border border-surface-highlight">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                    <Dumbbell size={16} className="text-primary" /> {title}
                </h3>
                {totalSets > 0 && (
                    <span className="text-[11px] text-text-secondary">{totalSets} series</span>
                )}
            </div>

            {!data || data.length === 0 ? (
                <p className="text-sm text-text-secondary py-4 text-center">Sin series esta semana.</p>
            ) : (
                <div style={{ height: Math.max(120, data.length * 32) }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} horizontal={false} />
                            <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 10 }} allowDecimals={false} />
                            <YAxis
                                type="category"
                                dataKey="category"
                                stroke="#6b7280"
                                tick={{ fontSize: 11 }}
                                width={78}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '12px' }}
                                cursor={{ fill: '#374151', opacity: 0.4 }}
                                formatter={(v) => [`${v} serie${v === 1 ? '' : 's'}`, '']}
                            />
                            <Bar dataKey="sets" fill="var(--primary)" radius={[0, 6, 6, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {data?.some(row => row.category === UNCLASSIFIED_GROUP) && (
                <p className="text-[10px] text-text-secondary mt-2">
                    "{UNCLASSIFIED_GROUP}" son ejercicios de rutinas ya borradas, sin categoría que consultar.
                </p>
            )}
        </div>
    );
}
