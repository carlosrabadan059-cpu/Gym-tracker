import React from 'react';
import { cn } from '../../lib/utils';

const Badge = ({ className, variant = 'default', children, ...props }) => {
    const variants = {
        default: 'bg-surface-highlight text-text-secondary',
        primary: 'bg-primary/20 text-primary',
        outline: 'border border-surface-highlight text-text-secondary',
    };

    return (
        <div
            className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};

export { Badge };
