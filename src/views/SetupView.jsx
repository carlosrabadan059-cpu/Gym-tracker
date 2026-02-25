import React from 'react';
import { Dumbbell, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';

const SetupView = ({ onStart }) => {
    return (
        <div className="relative flex h-screen flex-col items-center justify-end overflow-hidden pb-12 pb-safe text-center">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <img
                    src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=1080"
                    alt="Fitness Background"
                    className="h-full w-full object-cover opacity-60"
                    onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
            </div>

            <div className="relative z-10 w-full px-6">
                <div className="mb-8 text-left">
                    <h1 className="mb-2 text-5xl font-black uppercase leading-tight tracking-tight text-white">
                        Sin Excusas<br />
                        <span className="text-white">Solo Haz El</span><br />
                        <span className="text-primary">Entrenamiento</span>
                    </h1>
                    <p className="mt-4 text-sm font-medium text-gray-400 opacity-80">
                        "El fitness no se trata de ser mejor que alguien más. Se trata de ser mejor de lo que solías ser."
                    </p>
                </div>

                <Button
                    variant="primary"
                    size="lg"
                    className="w-full rounded-full py-6 text-xl font-bold text-black"
                    onClick={onStart}
                >
                    Empezar
                </Button>

                {/* Pagination dots simulation */}
                <div className="mt-8 flex justify-center gap-2">
                    <div className="h-1.5 w-6 rounded-full bg-primary" />
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-600" />
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-600" />
                </div>
            </div>
        </div>
    );
};

export { SetupView };
