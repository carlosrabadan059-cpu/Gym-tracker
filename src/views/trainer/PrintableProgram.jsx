// Programa de un cliente: vista en pantalla para el entrenador y hoja A4
// al imprimir. Los datos vienen de buildPrintableProgram().
// Ver docs/superpowers/specs/2026-10-08-imprimir-programa-design.md.
import { createPortal } from 'react-dom';
import { ArrowLeft, Printer } from 'lucide-react';

// '2026-09-14' → '14/09/2026' sin pasar por Date: así no se corre un día según la zona horaria.
const fmtDate = (iso) => iso ? iso.slice(0, 10).split('-').reverse().join('/') : null;

// En papel siempre blanco y negro; en pantalla, los colores del tema.
const printCss = `
@page { size: A4 portrait; margin: 12mm; }
@media print {
  body { background: #fff !important; }
  #root { display: none !important; }
  .pp-root { position: static !important; overflow: visible !important; }
  .pp-toolbar { display: none !important; }
  .pp-sheet { color: #000 !important; background: #fff !important; box-shadow: none !important; border: 0 !important; padding: 0 !important; max-width: none !important; }
  .pp-sheet * { color: #000 !important; background: transparent !important; border-color: #000 !important; }
  .pp-day { break-inside: avoid; }
  .pp-scroll { overflow: visible !important; }
  .pp-thumb { width: 19mm !important; height: 19mm !important; }
  .pp-thumb img { filter: grayscale(1); }
  .pp-sheet .pp-badge { background: #fff !important; border: 1px solid #000 !important; }
  .pp-thumbs { flex-wrap: nowrap !important; gap: 2mm !important; }
  .pp-sheet .pp-col-name { width: 32%; }
  .pp-sheet .pp-col-weight { width: 12%; }
  .pp-sheet .pp-col-obs { width: 20%; }
  .pp-daygrid { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; }
  .pp-table { font-size: 9pt; }
}`;

function Field({ label, value }) {
    return (
        <div className="flex items-end gap-2 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary shrink-0">{label}</span>
            <span className="flex-1 min-w-0 border-b border-text-secondary/40 pb-0.5 text-sm text-text-primary truncate min-h-[1.4rem]">
                {value || ''}
            </span>
        </div>
    );
}

function Thumb({ ex }) {
    return (
        <div className="pp-thumb relative shrink-0 w-24 h-24 rounded-lg border border-text-secondary/30 bg-white overflow-hidden">
            <span className="pp-badge absolute top-1 left-1 z-10 text-[11px] font-bold bg-primary text-white rounded px-1.5">{ex.number}</span>
            {ex.imageUrl && (
                <img src={ex.imageUrl} alt="" className="w-full h-full object-contain p-1"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            )}
        </div>
    );
}

function DayBlock({ day }) {
    return (
        <section className="pp-day space-y-3">
            <h2 className="text-base font-bold text-text-primary border-b-2 border-primary pb-1">
                {day.label} · {day.name}
                {day.scheduledDays && <span className="ml-2 text-xs font-medium text-text-secondary">{day.scheduledDays}</span>}
            </h2>

            <div className="pp-scroll pp-thumbs flex gap-2 overflow-x-auto pb-1">
                {day.exercises.map(ex => <Thumb key={ex.number} ex={ex} />)}
            </div>

            <div className="pp-scroll overflow-x-auto">
                <table className="pp-table w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-text-secondary">
                            {[['Nº'], ['Ejercicio', 'pp-col-name'], ['Variante'], ['Series'], ['Repeticiones'], ['Descanso'], ['Peso', 'pp-col-weight'], ['Observaciones', 'pp-col-obs']].map(([h, cls]) => (
                                <th key={h} className={`${cls || ''} border border-text-secondary/30 px-2 py-1.5 text-left font-bold`}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="text-text-primary">
                        {day.exercises.map(ex => (
                            <tr key={ex.number}>
                                <td className="border border-text-secondary/30 px-2 py-1.5 font-bold whitespace-nowrap">
                                    {ex.number}
                                    {ex.superset && <span className="ml-1 text-[10px] font-bold text-primary">SS{ex.superset}</span>}
                                </td>
                                <td className="border border-text-secondary/30 px-2 py-1.5">{ex.name}</td>
                                <td className="border border-text-secondary/30 px-2 py-1.5 whitespace-nowrap">{ex.variant}</td>
                                <td className="border border-text-secondary/30 px-2 py-1.5 text-center tabular-nums">{ex.series}</td>
                                <td className="border border-text-secondary/30 px-2 py-1.5 text-center tabular-nums whitespace-nowrap">{ex.reps}</td>
                                <td className="border border-text-secondary/30 px-2 py-1.5 text-center tabular-nums">{ex.rest}</td>
                                <td className="border border-text-secondary/30 px-2 py-1.5 w-20"></td>
                                <td className="border border-text-secondary/30 px-2 py-1.5">{ex.observations}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

// Portal a <body>: al imprimir se oculta #root entero y solo queda la hoja,
// sin que la ficha del cliente añada páginas en blanco.
export function PrintableProgram({ program, onBack }) {
    return createPortal(
        <div className="pp-root fixed inset-0 z-50 overflow-y-auto bg-background">
            <style>{printCss}</style>

            <div className="pp-toolbar sticky top-0 z-20 flex items-center justify-between gap-2 px-4 py-3 bg-background/95 backdrop-blur border-b border-text-secondary/20">
                <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
                    <ArrowLeft size={18} /> Volver
                </button>
                <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
                    <Printer size={16} /> Imprimir
                </button>
            </div>

            <article className="pp-sheet max-w-4xl my-4 mx-4 sm:mx-auto bg-surface rounded-2xl p-4 sm:p-8 space-y-6 text-text-primary">
                <header className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-text-secondary">Programa de</p>
                            <h1 className="text-xl sm:text-2xl font-extrabold leading-tight">Entrenamiento</h1>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <img src="/rutinex-logo.svg" alt="" className="w-8 h-8" />
                            <span className="font-extrabold tracking-tight">Rutinex</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        <Field label="Nombre" value={program.clientName} />
                        <div className="grid grid-cols-2 gap-x-4">
                            <Field label="Inicio" value={fmtDate(program.startDate)} />
                            <Field label="Duración" value={program.durationWeeks ? `${program.durationWeeks} semanas` : null} />
                        </div>
                        <Field label="Objetivo" value={program.goal} />
                        <Field label="Lesión" value={null} />
                        <div className="sm:col-span-2"><Field label="Calentamiento" value={null} /></div>
                    </div>

                    <div className="pp-daygrid grid grid-cols-1 sm:grid-cols-5 border border-text-secondary/30 rounded-lg overflow-hidden">
                        {program.days.map(d => (
                            <div key={d.label} className="border-b sm:border-b-0 sm:border-r last:border-0 border-text-secondary/30 px-3 py-2">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{d.label}</p>
                                <p className="text-sm font-semibold leading-snug">{d.name}</p>
                                {d.scheduledDays && <p className="text-[11px] text-text-secondary">{d.scheduledDays}</p>}
                            </div>
                        ))}
                    </div>
                </header>

                {program.days.map(day => <DayBlock key={day.label} day={day} />)}
            </article>
        </div>,
        document.body
    );
}
