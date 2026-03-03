
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
import { loadCompletedRoutines, loadWorkoutLogs } from '../lib/utils';
import { calculateCaloriesByVolume } from '../lib/routineUtils';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#9ca3af'];

export function StatisticsView() {
    const { profile } = useAuth();
    const [workoutsCount, setWorkoutsCount] = useState(0);
    const [totalCalories, setTotalCalories] = useState(0);
    const [totalVolume, setTotalVolume] = useState(0);
    const [muscleData, setMuscleData] = useState([]);

    // Advanced Progression States
    const [weeklyData, setWeeklyData] = useState([
        { name: 'Sem -3', workouts: 0, volume: 0, logs: [] },
        { name: 'Sem -2', workouts: 0, volume: 0, logs: [] },
        { name: 'Sem -1', workouts: 0, volume: 0, logs: [] },
        { name: 'Actual', workouts: 0, volume: 0, logs: [] },
    ]);
    const [monthlyData, setMonthlyData] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState(null); // Para el modal

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const completedIds = loadCompletedRoutines();
                const workoutLogs = loadWorkoutLogs();

                // Count total unique or tracked sessions
                setWorkoutsCount(Math.max(completedIds.length, workoutLogs.length));

                if (completedIds.length === 0 && workoutLogs.length === 0) {
                    return;
                }

                // Fetch routines and exercises
                const { data: routinesData, error: routinesError } = await supabase.from('routines').select('*').in('id', completedIds);
                if (routinesError && completedIds.length > 0) throw routinesError;

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

                // 1. Calculate base cals and muscles hit using completing ID arrays as before
                if (routinesData && exercisesData && completedIds.length > 0) {
                    completedIds.forEach(routineId => {
                        const routineExercises = exercisesData.filter(ex => ex.routine_id === routineId);
                        routineExercises.forEach(ex => {
                            cals += calculateCaloriesByVolume(ex, profile?.weight || null);

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

                // 2. Compute Volume Using Real workoutLogs if available
                if (workoutLogs && workoutLogs.length > 0) {
                    workoutLogs.forEach(session => {
                        if (session.logs) {
                            Object.values(session.logs).forEach(exerciseLog => {
                                const sets = exerciseLog.setsData;
                                const completed = exerciseLog.completedSets;
                                if (sets) {
                                    Object.keys(sets).forEach(setIndex => {
                                        // Only count sets the user checked off (completed), fallback to counting all if format is missing
                                        if (completed && !completed[setIndex]) return;

                                        const set = sets[setIndex];
                                        const weightStr = typeof set.weight === 'string' ? set.weight.replace(',', '.') : String(set.weight);
                                        const w = parseFloat(weightStr) || 0;
                                        const r = parseInt(set.reps) || 0;
                                        vol += (w * r);
                                    });
                                }
                            });
                        }
                    });
                } else if (routinesData && exercisesData) {
                    // Fallback volume estimation if no real logs exist yet (legacy compatibility)
                    completedIds.forEach(routineId => {
                        const routineExercises = exercisesData.filter(ex => ex.routine_id === routineId);
                        routineExercises.forEach(ex => {
                            const series = parseInt(ex.series) || 3;
                            const reps = parseInt(ex.reps) || 10;
                            vol += (series * reps * 10);
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

                // 3. Advanced Grouping: Build Weekly and Monthly progress from actual dates
                let newWeekly = [
                    { name: 'Sem -3', workouts: 0, volume: 0, logs: [] },
                    { name: 'Sem -2', workouts: 0, volume: 0, logs: [] },
                    { name: 'Sem -1', workouts: 0, volume: 0, logs: [] },
                    { name: 'Actual', workouts: 0, volume: 0, logs: [] },
                ];

                const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                let newMonthlyMap = {};

                const now = new Date();
                const startOfThisWeek = new Date(now);
                const dayOfWeek = startOfThisWeek.getDay() === 0 ? 6 : startOfThisWeek.getDay() - 1; // Lunes = 0
                startOfThisWeek.setDate(now.getDate() - dayOfWeek);
                startOfThisWeek.setHours(0, 0, 0, 0);

                if (workoutLogs && workoutLogs.length > 0) {
                    workoutLogs.forEach(session => {
                        const sessionDate = new Date(session.date);
                        let sessionVolume = 0;

                        // Calculate session isolated volume
                        if (session.logs) {
                            Object.values(session.logs).forEach(exerciseLog => {
                                const sets = exerciseLog.setsData;
                                const completed = exerciseLog.completedSets;
                                if (sets) {
                                    Object.keys(sets).forEach(setIndex => {
                                        if (completed && !completed[setIndex]) return;
                                        const set = sets[setIndex];
                                        const wStr = typeof set.weight === 'string' ? set.weight.replace(',', '.') : String(set.weight);
                                        const w = parseFloat(wStr) || 0;
                                        const r = parseInt(set.reps) || 0;
                                        sessionVolume += (w * r);
                                    });
                                }
                            });
                        }

                        // Append to Monthly Map
                        const monthName = monthNames[sessionDate.getMonth()];
                        if (!newMonthlyMap[monthName]) {
                            newMonthlyMap[monthName] = { name: monthName, workouts: 0, volume: 0 };
                        }
                        newMonthlyMap[monthName].workouts += 1;
                        newMonthlyMap[monthName].volume += sessionVolume;

                        // Determine Week Bucket (0 = actual, 1 = -1, 2 = -2, 3 = -3)
                        const timeDiff = startOfThisWeek.getTime() - sessionDate.getTime();
                        const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

                        let bucketIndex = 3; // Default to 'Actual' (index 3) if strictly this week or future
                        if (daysDiff >= 0) {
                            const weeksAgo = Math.floor(daysDiff / 7) + 1;
                            if (weeksAgo === 1) bucketIndex = 2; // Sem -1
                            else if (weeksAgo === 2) bucketIndex = 1; // Sem -2
                            else if (weeksAgo >= 3) bucketIndex = 0; // Sem -3
                        }

                        newWeekly[bucketIndex].workouts += 1;
                        newWeekly[bucketIndex].volume += sessionVolume;
                        // Save context for modal
                        const rData = routinesData ? routinesData.find(r => r.id === session.routineId) : null;
                        newWeekly[bucketIndex].logs.push({
                            date: sessionDate,
                            routineName: rData?.name || session.routineId,
                            volume: sessionVolume
                        });
                    });
                }

                // Convert monthly map to array sorted by current year progression basically just mapped from the array holding months
                // To be safe and simple, we show up to the last 6 active months, or simply sort by month index
                const sortedMonthly = monthNames
                    .filter(m => newMonthlyMap[m])
                    .map(m => newMonthlyMap[m]);

                setWeeklyData(newWeekly);
                setMonthlyData(sortedMonthly);

            } catch (error) {
                console.error('Error fetching stats:', error);
            }
        };

        fetchStats();
    }, [profile]);

    const displayMuscleData = muscleData.length > 0 ? muscleData : [{ name: 'Sin datos', value: 100 }];

    return (
        <div className="space-y-6 pb-20">
            <header className="mb-6">
                <h2 className="text-2xl font-bold text-text-primary">Estadísticas</h2>
                <p className="text-text-secondary">Tu progreso en el último mes</p>
            </header>

            {/* Resume Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div
                    className="bg-surface p-4 rounded-xl shadow-lg border border-surface-highlight cursor-pointer hover:border-blue-500 transition-colors"
                    onClick={() => setSelectedWeek(weeklyData[3])}
                >
                    <p className="text-text-secondary text-sm">Entrenamientos</p>
                    <p className="text-3xl font-bold text-text-primary">{weeklyData[3].workouts}</p>
                    <p className="text-green-500 text-xs mt-1">esta semana (toca para ver)</p>
                </div>
                <div className="bg-surface p-4 rounded-xl shadow-lg border border-surface-highlight">
                    <p className="text-text-secondary text-sm">Volumen Total</p>
                    <p className="text-3xl font-bold text-text-primary">{totalVolume > 0 ? (totalVolume / 1000).toFixed(1) + 'k' : '0'}</p>
                    <p className="text-green-500 text-xs mt-1">kg levantados</p>
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
                        <BarChart data={weeklyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="name" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" allowDecimals={false} />
                            <Tooltip
                                cursor={{ fill: '#374151', opacity: 0.4 }}
                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Bar
                                dataKey="workouts"
                                fill="#3b82f6"
                                radius={[4, 4, 0, 0]}
                                cursor="pointer"
                                onClick={(data) => setSelectedWeek(data)}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-text-secondary text-xs text-center mt-2">Toca una barra para ver el detalle de esa semana</p>
            </div>

            {/* Volume Progression Chart */}
            <div className="bg-surface p-4 rounded-xl shadow-lg border border-surface-highlight">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Progresión de Volumen (Semanas)</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weeklyData}>
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

            {/* Monthly Progression Chart */}
            {monthlyData.length > 0 && (
                <div className="bg-surface p-4 rounded-xl shadow-lg border border-surface-highlight">
                    <h3 className="text-lg font-semibold text-text-primary mb-4">Progresión de Volumen (Mensual)</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="name" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Line type="monotone" dataKey="volume" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

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

            {/* Weekly Summary Modal */}
            {selectedWeek && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="bg-surface w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-surface-highlight p-6 max-h-[80vh] overflow-y-auto shadow-2xl animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-text-primary">
                                Resumen: {selectedWeek.name === 'Actual' ? 'Semana Actual' : selectedWeek.name}
                            </h3>
                            <button
                                onClick={() => setSelectedWeek(null)}
                                className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-highlight rounded-full transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {(!selectedWeek.logs || selectedWeek.logs.length === 0) ? (
                            <p className="text-text-secondary text-center py-10">No hay entrenamientos registrados esta semana.</p>
                        ) : (
                            <div className="space-y-4">
                                {selectedWeek.logs.map((log, i) => (
                                    <div key={i} className="bg-background p-4 rounded-xl border border-surface-highlight flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold text-text-primary">{log.routineName}</p>
                                            <p className="text-xs text-text-secondary mt-1">
                                                {log.date.toLocaleDateString()} a las {log.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-green-500">{log.volume > 0 ? (log.volume > 1000 ? (log.volume / 1000).toFixed(1) + 'k' : log.volume) : '0'} kg</p>
                                            <p className="text-[10px] text-text-secondary uppercase">volumen</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-6 pt-4 border-t border-surface-highlight flex justify-between items-center">
                            <span className="text-text-secondary">Volumen total semanal:</span>
                            <span className="text-xl font-bold text-text-primary">{selectedWeek.volume > 0 ? (selectedWeek.volume > 1000 ? (selectedWeek.volume / 1000).toFixed(1) + 'k' : selectedWeek.volume) : '0'} kg</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
