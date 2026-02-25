import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
    theme: 'system',
    setTheme: () => null,
});

export const ThemeProvider = ({ children }) => {
    // Initialize state from localStorage or default to 'system'
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('gym-tracker-theme') || 'system';
        }
        return 'system';
    });

    useEffect(() => {
        const root = window.document.documentElement;

        // Function to apply the theme
        const applyTheme = (targetTheme) => {
            root.classList.remove('light', 'dark');

            if (targetTheme === 'system') {
                const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                root.classList.add(systemTheme);
            } else {
                root.classList.add(targetTheme);
            }
        };

        applyTheme(theme);

        // Save to localStorage
        localStorage.setItem('gym-tracker-theme', theme);

        // Listen for system changes if theme is 'system'
        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => applyTheme('system');

            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
