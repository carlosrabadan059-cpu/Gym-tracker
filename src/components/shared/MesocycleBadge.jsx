import React from 'react';
import { getMesocycleStatus } from '../../lib/mesocycle';

// Aviso de lo que queda del mesociclo (entrenador y cliente). Sin fecha de
// inicio o sin duración no pinta nada. Con `showEnd` añade el último día.
const STYLES = {
    active: 'text-primary bg-primary/10',
    last: 'text-orange-500 bg-orange-500/10',
    finished: 'text-red-500 bg-red-500/10',
};

export default function MesocycleBadge({ startDate, weeks, showEnd = false, className = '' }) {
    const status = getMesocycleStatus(startDate, weeks, new Date());
    if (!status) return null;

    const end = new Date(`${status.endDate}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const text = status.state === 'finished'
        ? 'Mesociclo terminado'
        : status.state === 'last'
            ? (showEnd ? `Última semana · termina el ${end}` : 'Última semana del mesociclo')
            : `Semana ${status.week} de ${status.total}${showEnd ? ` · termina el ${end}` : ''}`;

    return (
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${STYLES[status.state]} ${className}`}>
            {text}
        </span>
    );
}
