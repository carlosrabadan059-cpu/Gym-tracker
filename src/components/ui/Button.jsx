import React from 'react';
import { cn } from '../../lib/utils';
import { Loader } from 'lucide-react';

const Button = React.forwardRef(({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
    const variants = {
        primary: 'bg-primary text-black hover:bg-opacity-90',
        secondary: 'bg-surface-highlight text-text-primary hover:bg-opacity-80',
        ghost: 'bg-transparent text-text-primary hover:bg-surface-highlight',
        danger: 'bg-red-500 text-white hover:bg-red-600',
    };

    const sizes = {
        sm: 'h-9 px-3 text-xs',
        md: 'h-11 px-5 py-2', // iOS accessible min-height 44px
        lg: 'h-14 px-8 text-lg',
        icon: 'h-11 w-11 p-2 flex items-center justify-center',
    };

    return (
        <button
            ref={ref}
            className={cn(
                'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50',
                variants[variant],
                sizes[size],
                className
            )}
            disabled={isLoading || props.disabled}
            {...props}
        >
            {isLoading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
            {children}
        </button>
    );
});

Button.displayName = 'Button';

export { Button };
