import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const SUGGESTED_QUESTIONS = [
    "¿Cómo mejorar mi press de banca?",
    "Plan de nutrición para ganar masa",
    "Ejercicios para dolor de espalda",
    "¿Qué suplementos recomiendas?"
];

export function ChatView() {
    const { user } = useAuth();
    const [userProfile, setUserProfile] = useState(null);
    const [messages, setMessages] = useState([
        {
            id: 1,
            type: 'bot',
            text: '¡Hola! Soy tu Entrenador IA. Estoy aquí para ayudarte a optimizar tu entrenamiento, resolver dudas sobre nutrición o ajustar tu rutina. ¿En qué puedo ayudarte hoy?'
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    // Fetch user profile data to provide context to the AI
    useEffect(() => {
        if (user) {
            const fetchProfile = async () => {
                try {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('username, weight, height, age, gender, goal')
                        .eq('user_id', user.id)
                        .single();

                    if (error) throw error;
                    setUserProfile(data);
                } catch (error) {
                    console.error('Error fetching profile for chat context:', error);
                }
            };
            fetchProfile();
        }
    }, [user]);

    // TODO: Replace with your actual n8n Webhook URL
    const N8N_WEBHOOK_URL = 'https://n8n.rabadanhouse.space/webhook/Gym';

    const handleSendMessage = async (text) => {
        if (!text.trim()) return;

        // Add user message
        const userMsg = { id: Date.now(), type: 'user', text: text };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        // Check if userProfile is loaded, otherwise use what we have
        const profileContext = {
            name: userProfile?.username || user?.email?.split('@')[0] || "Usuario",
            age: userProfile?.age ? `${userProfile.age} años` : 'No especificado',
            weight: userProfile?.weight ? `${userProfile.weight}kg` : 'No especificado',
            height: userProfile?.height ? `${userProfile.height}cm` : 'No especificado',
            goal: userProfile?.goal || 'No especificado'
        };



        const contextString = `
[CONTEXTO DEL USUARIO]
- Nombre: ${profileContext.name}
- Edad: ${profileContext.age}
- Peso: ${profileContext.weight}
- Altura: ${profileContext.height}
- OBJETIVO PRINCIPAL: ${profileContext.goal}
[FIN CONTEXTO]
`;

        try {
            const response = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: user?.id || "anonymous",
                    chatInput: text, // Some n8n workflows use chatInput
                    message: `${contextString}\n\n${text}`, // Inject context into main message
                    userData: {
                        ...profileContext,
                        email: user?.email
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
                image: botImage
            };
            setMessages(prev => [...prev, botMsg]);

        } catch (error) {
            console.error("AI Error:", error);
            const errorMsg = {
                id: Date.now() + 1,
                type: 'bot',
                text: "⚠️ Error de conexión: Asegúrate de que tu webhook de n8n esté activo."
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
                <div>
                    <h2 className="font-bold text-text-primary flex items-center gap-2">
                        Entrenador IA
                        <Sparkles size={14} className="text-yellow-400" />
                    </h2>
                    <p className="text-xs text-text-secondary">Siempre activo • v1.0</p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm flex flex-col gap-2 ${msg.type === 'user'
                                ? 'bg-primary text-black rounded-tr-none font-medium'
                                : 'bg-surface-highlight text-text-primary rounded-tl-none border border-surface-highlight'
                                }`}
                        >
                            <span className="whitespace-pre-wrap">{msg.text}</span>
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
                    </div>
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
