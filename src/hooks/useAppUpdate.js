import { useState, useEffect, useRef } from 'react';

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

export function useAppUpdate() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const initialVersion = useRef(null);

    useEffect(() => {
        const fetchVersion = async () => {
            try {
                const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
                if (!res.ok) return null;
                const { v } = await res.json();
                return v;
            } catch {
                return null;
            }
        };

        const init = async () => {
            const v = await fetchVersion();
            if (v) initialVersion.current = v;
        };

        const check = async () => {
            if (!initialVersion.current) return;
            const v = await fetchVersion();
            if (v && v !== initialVersion.current) {
                setUpdateAvailable(true);
            }
        };

        init();
        const interval = setInterval(check, CHECK_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    return updateAvailable;
}
