
import React, { useState, useEffect } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { Flame, Calendar, CalendarDays, CalendarCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { loadCompletedRoutines } from '../lib/utils';
import { calculateCaloriesByVolume } from '../lib/routineUtils';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#9ca3af'];

export function StatisticsView() {
    const { profile } = useAuth();
    const [workoutsCount, setWorkoutsCount] = useState(0);
    const [totalCalories, setTotalCalories] = useState(0);
    const [totalVolume, setTotalVolume] = useState(0);
    const [muscleData, setMuscleData] = useState([]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const completedIds = loadCompletedRoutines();
                setWorkoutsCount(completedIds.length);

                if (completedIds.length === 0) {
                    return;
                }

                // Fetch routines and exercises
                const { data: routinesData, error: routinesError } = await supabase.from('routines').select('*').in('id', completedIds);
                if (routinesError) throw routinesError;

                const { data: exercisesData, error: exercisesError } = await supabase.from('exercises').select('*');
                if (exercisesError) throw exercisesError;

                let cals = 0;
                let vol = 0;
                let muscles = {
                    'Pecho': 0,
                    'Espalda': 0,
                    'Pierna': 0,
                    'Brazos': 0,
                    'Hombro': 0
                };

                if (routinesData && exercisesData) {
                    completedIds.forEach(routineId => {
                        const routineExercises = exercisesData.filter(ex => ex.routine_id === routineId);
                        routineExercises.forEach(ex => {
                            cals += calculateCaloriesByVolume(ex, profile?.weight || null);

                            // Estimate volume just to populate the chart a bit (series * reps * 10kg default)
                            const series = parseInt(ex.series) || 3;
                            const reps = parseInt(ex.reps) || 10;
                            vol += (series * reps * 10);

                            const routine = routinesData.find(r => r.id === routineId);
                            if (routine?.name) {
                                const name = routine.name.toLowerCase();
                                if (name.includes('pecho')) muscles['Pecho'] += 1;
                                else if (name.includes('espalda') || name.includes('dorsal')) muscles['Espalda'] += 1;
                                else if (name.includes('pierna') || name.includes('femoral') || name.includes('cuádriceps')) muscles['Pierna'] += 1;
                                else if (name.includes('bíceps') || name.includes('tríceps')) muscles['Brazos'] += 1;
                                else if (name.includes('hombro')) muscles['Hombro'] += 1;
                            }
                        });
                    });
                }

                setTotalCalories(Math.round(cals));
                setTotalVolume(vol);

                const formattedMuscles = Object.keys(muscles)
                    .filter(k => muscles[k] > 0)
                    .map(k => ({ name: k, value: muscles[k] }));

                if (formattedMuscles.length > 0) {
                    setMuscleData(formattedMuscles);
                }

            } catch (error) {
                console.error('Error fetching stats:', error);
            }
        };

        fetchStats();
    }, [profile]);

    const workoutData = [
        { name: 'Sem 1', workouts: 0 },
        { name: 'Sem 2', workouts: 0 },
        { name: 'Sem 3', workouts: 0 },
        { name: 'Sem actual', workouts: workoutsCount },
    ];

    const volumeChartData = [
        { name: 'Sem 1', volume: 0 },
        { name: 'Sem 2', volume: 0 },
        { name: 'Sem 3', volume: 0 },
        { name: 'Sem actual', volume: totalVolume },
    ];

    const displayMuscleData = muscleData.length > 0 ? muscleData : [{ name: 'Sin datos', value: 100 }];

    return (
        <div className="space-y-6 pb-20">
            <header className="mb-6">
                <h2 className="text-2xl font-bold text-text-primary">Estadísticas</h2>
                <p className="text-text-secondary">Tu progreso en el último mes</p>
            </header>

            {/* Resume Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface p-4 rounded-xl shadow-lg border border-surface-highlight">
                    <p className="text-text-secondary text-sm">Entrenamientos</p>
                    <p className="text-3xl font-bold text-text-primary">{workoutsCount}</p>
                    <p className="text-green-500 text-xs mt-1">esta semana</p>
                </div>
                <div className="bg-surface p-4 rounded-xl shadow-lg border border-surface-highlight">
                    <p className="text-text-secondary text-sm">Volumen Total</p>
                    <p className="text-3xl font-bold text-text-primary">{totalVolume > 0 ? (totalVolume / 1000).toFixed(1) + 'k' : '0'}</p>
                    <p className="text-green-500 text-xs mt-1">kg levantados (est.)</p>
                </div>
            </div>

            {/* Calories Summary Cards */}
            <div>
                <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <Flame className="text-orange-500" size={20} />
                    Calorías Quemadas
                </h3>
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-surface p-4 rounded-xl shadow-lg border border-surface-highlight flex flex-col items-center justify-center text-center">
                        <Calendar size={18} className="text-orange-400 mb-2" />
                        <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Hoy</p>
                        <p className="text-xl font-bold text-orange-400">{workoutsCount > 0 ? Math.round(totalCalories / workoutsCount) : 0}</p>
                        <p className="text-text-secondary text-[10px]">kcal est.</p>
                    </div>
                    <div className="bg-surface p-4 rounded-xl shadow-lg border border-surface-highlight flex flex-col items-center justify-center text-center">
                        <CalendarDays size={18} className="text-orange-500 mb-2" />
                        <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Semana</p>
                        <p className="text-xl font-bold text-orange-500">{totalCalories}</p>
                        <p className="text-text-secondary text-[10px]">kcal</p>
                    </div>
                    <div className="bg-surface p-4 rounded-xl shadow-lg border border-surface-highlight flex flex-col items-center justify-center text-center">
                        <CalendarCheck size={18} className="text-orange-600 mb-2" />
                        <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Mes</p>
                        <p className="text-xl font-bold text-orange-600">{totalCalories}</p>
                        <p className="text-text-secondary text-[10px]">kcal</p>
                    </div>
                </div>
            </div>

            {/* Weekly Workouts Chart */}
            <div className="bg-surface p-4 rounded-xl shadow-lg border border-surface-highlight">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Frecuencia Semanal</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={workoutData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="name" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" allowDecimals={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Bar dataKey="workouts" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Volume Progression Chart */}
            <div className="bg-surface p-4 rounded-xl shadow-lg border border-surface-highlight">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Progresión de Volumen (est.)</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={volumeChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="name" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Line type="monotone" dataKey="volume" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Muscle Distribution Chart */}
            <div className="bg-surface p-4 rounded-xl shadow-lg border border-surface-highlight">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Distribución Muscular</h3>
                <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={displayMuscleData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {displayMuscleData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    {displayMuscleData.map((entry, index) => {
                        const totalHits = muscleData.length > 0 ? muscleData.reduce((sum, item) => sum + item.value, 0) : 1;
                        const percentage = muscleData.length > 0 ? Math.round((entry.value / totalHits) * 100) : 100;
                        return (
                            <div key={index} className="flex items-center space-x-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                <span className="text-text-secondary">{entry.name} {entry.name !== 'Sin datos' && `(${percentage}%)`}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
