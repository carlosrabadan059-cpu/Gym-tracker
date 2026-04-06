import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, Sparkles, Copy, Check as CheckIcon, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const SUGGESTED_QUESTIONS = [
    "Analiza mis rutinas y sugiere mejoras",
    "¿Qué ejercicios me faltan en mi plan?",
    "Plan de nutrición para mi objetivo",
    "¿Cómo mejorar mi técnica en mis ejercicios?"
];

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
function BotMarkdown({ text }) {
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

function MessageBubble({ msg }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(msg.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const timeStr = msg.timestamp
        ? new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        : null;

    const isBot = msg.type === 'bot';

    return (
        <div className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
            <div className={`flex flex-col gap-1 ${isBot ? 'items-start w-full' : 'items-end max-w-[80%]'}`}>
                {isBot ? (
                    <div className="w-full space-y-0.5">
                        <BotMarkdown text={msg.text} />
                        {msg.image && (
                            <div className="mt-2 rounded-xl overflow-hidden shadow-sm">
                                <img
                                    src={msg.image}
                                    alt="Generated content"
                                    className="w-full h-auto object-cover max-h-64 sm:max-h-80"
                                    loading="lazy"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-primary text-black rounded-2xl rounded-tr-none px-4 py-3 text-sm font-medium leading-relaxed shadow-sm">
                        <span className="whitespace-pre-wrap">{msg.text}</span>
                    </div>
                )}

                {/* Timestamp + copy */}
                <div className={`flex items-center gap-2 px-1 ${isBot ? 'flex-row' : 'flex-row-reverse'}`}>
                    {timeStr && (
                        <span className="text-[10px] text-text-secondary">{timeStr}</span>
                    )}
                    {isBot && (
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1 text-[10px] text-text-secondary hover:text-text-primary transition-colors"
                        >
                            {copied
                                ? <><CheckIcon size={10} className="text-green-400" /><span className="text-green-400">Copiado</span></>
                                : <><Copy size={10} /><span>Copiar</span></>
                            }
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

const WELCOME_MESSAGE = {
    id: 1,
    type: 'bot',
    text: '¡Hola! Soy tu **Entrenador IA**. Estoy aquí para ayudarte a optimizar tu entrenamiento, resolver dudas sobre nutrición o ajustar tu rutina.\n\n¿En qué puedo ayudarte hoy?',
    timestamp: new Date().toISOString()
};
const MAX_STORED_MESSAGES = 100;

export function ChatView() {
    const { user } = useAuth();
    const [userProfile, setUserProfile] = useState(null);
    const [userRoutines, setUserRoutines] = useState([]);
    const [messages, setMessages] = useState([WELCOME_MESSAGE]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const storageKey = user?.id ? `gym_chat_${user.id}` : null;

    // Cargar historial de localStorage al montar
    useEffect(() => {
        if (!storageKey) return;
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setMessages(parsed);
                }
            }
        } catch (e) {
            // Si los datos están corruptos, se queda con el mensaje de bienvenida
        }
    }, [storageKey]);

    // Guardar en localStorage cada vez que cambia el historial
    useEffect(() => {
        if (!storageKey || messages.length === 0) return;
        try {
            const toStore = messages.slice(-MAX_STORED_MESSAGES);
            localStorage.setItem(storageKey, JSON.stringify(toStore));
        } catch (e) {
            // localStorage lleno u otro error — no bloqueante
        }
    }, [messages, storageKey]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    // Fetch user profile + routines to provide full context to the AI
    useEffect(() => {
        if (!user) return;

        const fetchContext = async () => {
            try {
                // Profile
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('username, weight, height, age, gender, goal')
                    .eq('user_id', user.id)
                    .single();
                if (!profileError) setUserProfile(profileData);

                // Assigned routines
                const { data: assigned } = await supabase
                    .from('assigned_routines')
                    .select('routine_id')
                    .eq('client_id', user.id);

                const routineIds = assigned?.length
                    ? assigned.map(a => a.routine_id)
                    : ['day1', 'day2', 'day3', 'day4'];

                const { data: routinesData } = await supabase
                    .from('routines')
                    .select('id, name')
                    .in('id', routineIds)
                    .order('id');

                const { data: exercisesData } = await supabase
                    .from('exercises')
                    .select('routine_id, name, series, reps')
                    .in('routine_id', routineIds)
                    .order('ui_order');

                if (routinesData) {
                    const merged = routinesData.map(r => ({
                        name: r.name,
                        exercises: (exercisesData || [])
                            .filter(e => e.routine_id === r.id)
                            .map(e => ({ name: e.name, series: e.series, reps: e.reps }))
                    }));
                    setUserRoutines(merged);
                }
            } catch (err) {
                console.error('Error fetching chat context:', err);
            }
        };

        fetchContext();
    }, [user]);

    const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;

    const handleSendMessage = async (text) => {
        if (!text.trim()) return;

        // Add user message
        const userMsg = { id: Date.now(), type: 'user', text: text, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        const profileContext = {
            name: userProfile?.username || user?.email?.split('@')[0] || "Usuario",
            age: userProfile?.age ? `${userProfile.age} años` : 'No especificado',
            weight: userProfile?.weight ? `${userProfile.weight}kg` : 'No especificado',
            height: userProfile?.height ? `${userProfile.height}cm` : 'No especificado',
            goal: userProfile?.goal || 'No especificado'
        };

        // Build routines context string
        const routinesString = userRoutines.length > 0
            ? userRoutines.map(r =>
                `  Rutina: ${r.name}\n` +
                r.exercises.map(e => `    - ${e.name}: ${e.series}x${e.reps}${e.muscleGroup ? ` (${e.muscleGroup})` : ''}`).join('\n')
              ).join('\n')
            : '  No hay rutinas asignadas actualmente.';

        const contextString = `[CONTEXTO DEL USUARIO]
- Nombre: ${profileContext.name}
- Edad: ${profileContext.age}
- Peso: ${profileContext.weight}
- Altura: ${profileContext.height}
- OBJETIVO PRINCIPAL: ${profileContext.goal}
[FIN CONTEXTO]

[RUTINAS ACTUALES DEL USUARIO]
${routinesString}
[FIN RUTINAS]`;

        const fullMessage = `${contextString}\n\nPregunta del usuario: ${text}`;

        try {
            const response = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: user?.id || "anonymous",
                    chatInput: fullMessage,
                    message: fullMessage,
                    userData: {
                        ...profileContext,
                        email: user?.email,
                        routines: userRoutines
                    }
                })
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();

            let botText = "Lo siento, no pude procesar la respuesta correctamente.";
            let botImage = null;

            // Handle n8n array format: [{ "answer": "...", "image": "..." }]
            if (Array.isArray(data) && data.length > 0) {
                const item = data[0];
                if (item.answer) botText = item.answer;
                else if (item.output) botText = item.output;
                else if (item.text) botText = item.text;
                else if (item.reply) botText = item.reply;

                if (item.image) botImage = item.image;
                else if (item.imageUrl) botImage = item.imageUrl;
            }
            // Handle single object format
            else if (typeof data === 'object') {
                if (data.answer) botText = data.answer;
                else if (data.reply) botText = data.reply;
                else if (data.output) botText = data.output;
                else if (data.text) botText = data.text;

                if (data.image) botImage = data.image;
                else if (data.imageUrl) botImage = data.imageUrl;
            }

            const botMsg = {
                id: Date.now() + 1,
                type: 'bot',
                text: botText,
                image: botImage,
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, botMsg]);

        } catch (error) {
            console.error("AI Error:", error);
            const errorMsg = {
                id: Date.now() + 1,
                type: 'bot',
                text: "⚠️ **Error de conexión:** Asegúrate de que tu webhook de n8n esté activo.",
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };



    return (
        <div className="flex flex-col h-full bg-background relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 bg-surface/80 backdrop-blur-md border-b border-surface-highlight sticky top-0 z-10">
                <div className="p-2 bg-primary/20 rounded-full">
                    <Bot size={24} className="text-primary" />
                </div>
                <div className="flex-1">
                    <h2 className="font-bold text-text-primary flex items-center gap-2">
                        Entrenador IA
                        <Sparkles size={14} className="text-yellow-400" />
                    </h2>
                    <p className="text-xs text-text-secondary">Siempre activo • v1.0</p>
                </div>
                <button
                    onClick={() => {
                        if (!window.confirm('¿Borrar el historial del chat?')) return;
                        if (storageKey) localStorage.removeItem(storageKey);
                        setMessages([WELCOME_MESSAGE]);
                    }}
                    className="p-2 text-text-secondary hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10"
                    title="Limpiar conversación"
                >
                    <Trash2 size={18} />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4">
                {messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} />
                ))}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-surface-highlight p-4 rounded-2xl rounded-tl-none border border-surface-highlight flex items-center gap-2">
                            <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Suggested Questions (only show if few messages or idle) */}
            {messages.length < 3 && !isTyping && (
                <div className="px-4 pb-2">
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {SUGGESTED_QUESTIONS.map((q, i) => (
                            <button
                                key={i}
                                onClick={() => handleSendMessage(q)}
                                className="whitespace-nowrap px-4 py-2 rounded-full bg-surface-highlight border border-surface-highlight text-xs text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="p-4 bg-surface/80 backdrop-blur-md border-t border-surface-highlight">
                <div className="relative">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                        placeholder="Escribe tu pregunta..."
                        className="w-full bg-surface-highlight border border-transparent rounded-xl py-3 pl-4 pr-12 text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary transition-colors"
                        disabled={isTyping}
                    />
                    <button
                        onClick={() => handleSendMessage(inputValue)}
                        disabled={!inputValue.trim() || isTyping}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary rounded-lg text-black hover:brightness-110 disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-500 transition-all"
                    >
                        {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
