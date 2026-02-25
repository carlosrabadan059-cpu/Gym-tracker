
import React from 'react';
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

// Mock data for demonstration
const workoutData = [
    { name: 'Sem 1', workouts: 3 },
    { name: 'Sem 2', workouts: 4 },
    { name: 'Sem 3', workouts: 3 },
    { name: 'Sem 4', workouts: 5 },
];

const volumeData = [
    { name: 'Sem 1', volume: 12000 },
    { name: 'Sem 2', volume: 15000 },
    { name: 'Sem 3', volume: 13500 },
    { name: 'Sem 4', volume: 18000 },
];

const muscleDistribution = [
    { name: 'Pecho', value: 30 },
    { name: 'Espalda', value: 25 },
    { name: 'Pierna', value: 25 },
    { name: 'Brazos', value: 10 },
    { name: 'Hombro', value: 10 },
];

const COLORS = ['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

// Mock stats for calories (Pending Backend Integration)
const calorieStats = {
    daily: 450,
    weekly: 2100,
    monthly: 8450
};

export function StatisticsView() {
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
                    <p className="text-3xl font-bold text-text-primary">15</p>
                    <p className="text-green-500 text-xs mt-1">+2 vs mes anterior</p>
                </div>
                <div className="bg-surface p-4 rounded-xl shadow-lg border border-surface-highlight">
                    <p className="text-text-secondary text-sm">Volumen Total</p>
                    <p className="text-3xl font-bold text-text-primary">58.5k</p>
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
                        <p className="text-xl font-bold text-orange-400">{calorieStats.daily}</p>
                        <p className="text-text-secondary text-[10px]">kcal</p>
                    </div>
                    <div className="bg-surface p-4 rounded-xl shadow-lg border border-surface-highlight flex flex-col items-center justify-center text-center">
                        <CalendarDays size={18} className="text-orange-500 mb-2" />
                        <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Semana</p>
                        <p className="text-xl font-bold text-orange-500">{calorieStats.weekly}</p>
                        <p className="text-text-secondary text-[10px]">kcal</p>
                    </div>
                    <div className="bg-surface p-4 rounded-xl shadow-lg border border-surface-highlight flex flex-col items-center justify-center text-center">
                        <CalendarCheck size={18} className="text-orange-600 mb-2" />
                        <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Mes</p>
                        <p className="text-xl font-bold text-orange-600">{calorieStats.monthly}</p>
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
                            <YAxis stroke="#9ca3af" />
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
                <h3 className="text-lg font-semibold text-text-primary mb-4">Progresión de Volumen</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={volumeData}>
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
                                data={muscleDistribution}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {muscleDistribution.map((entry, index) => (
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
                    {muscleDistribution.map((entry, index) => (
                        <div key={index} className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <span className="text-text-secondary">{entry.name} ({entry.value}%)</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
