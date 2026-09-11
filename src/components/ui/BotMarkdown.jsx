import React from 'react';

// Paleta de colores para secciones h2, cíclica
const SECTION_PALETTES = [
    { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   icon: 'text-blue-400',   dot: 'bg-blue-400'   },
    { bg: 'bg-primary/10',    border: 'border-primary/30',    icon: 'text-primary',    dot: 'bg-primary'    },
    { bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: 'text-purple-400', dot: 'bg-purple-400' },
    { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: 'text-orange-400', dot: 'bg-orange-400' },
    { bg: 'bg-green-500/10',  border: 'border-green-500/30',  icon: 'text-green-400',  dot: 'bg-green-400'  },
];

// Renderiza texto inline: **bold** y `code`
function renderInline(text) {
    const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
            return <strong key={i} className="font-bold text-text-primary">{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`'))
            return <code key={i} className="bg-background px-1.5 py-0.5 rounded text-primary text-xs font-mono border border-surface-highlight">{part.slice(1, -1)}</code>;
        return part;
    });
}

// Renderizador Markdown ligero sin dependencias externas
export function BotMarkdown({ text }) {
    const lines = String(text || '').split('\n');
    const elements = [];
    let listItems = [];
    let paletteIdx = 0;

    const flushList = () => {
        if (!listItems.length) return;
        elements.push(
            <ul key={`ul-${elements.length}`} className="space-y-1.5 my-2">
                {listItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 bg-background/60 rounded-xl px-3 py-2 border border-surface-highlight/50">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary block" />
                        </span>
                        <span className="text-sm text-text-primary leading-relaxed">{renderInline(item)}</span>
                    </li>
                ))}
            </ul>
        );
        listItems = [];
    };

    lines.forEach((line, i) => {
        // H2
        if (/^## /.test(line)) {
            flushList();
            const p = SECTION_PALETTES[paletteIdx++ % SECTION_PALETTES.length];
            elements.push(
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${p.bg} border ${p.border} mt-3 mb-2`}>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.dot}`} />
                    <span className={`text-sm font-bold ${p.icon}`}>{line.slice(3)}</span>
                </div>
            );
        // H3
        } else if (/^### /.test(line)) {
            flushList();
            elements.push(
                <p key={i} className="text-xs font-bold text-text-secondary uppercase tracking-wider mt-3 mb-1">{line.slice(4)}</p>
            );
        // Blockquote
        } else if (/^> /.test(line)) {
            flushList();
            elements.push(
                <div key={i} className="flex gap-3 bg-amber-400 border border-amber-500 rounded-xl px-3 py-2.5 my-2">
                    <span className="text-base flex-shrink-0">💡</span>
                    <p className="text-sm text-gray-900 font-medium leading-relaxed">{renderInline(line.slice(2))}</p>
                </div>
            );
        // HR
        } else if (/^---/.test(line)) {
            flushList();
            elements.push(<div key={i} className="border-t border-surface-highlight my-3" />);
        // List item
        } else if (/^[-*] /.test(line)) {
            listItems.push(line.slice(2));
        // Empty line
        } else if (!line.trim()) {
            flushList();
        // Paragraph
        } else {
            flushList();
            elements.push(
                <p key={i} className="text-sm leading-relaxed mb-2 text-text-primary">{renderInline(line)}</p>
            );
        }
    });

    flushList();
    return <div className="space-y-0.5">{elements}</div>;
}
