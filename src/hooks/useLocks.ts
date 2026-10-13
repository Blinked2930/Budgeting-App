import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'lekflow:unlockedAt';
const AUTO_LOCK_MS = 15 * 60 * 1000; // 15 minutes of inactivity

export function useLock() {
    const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
        // Persist unlock across reloads within the same tab.
        // Close the tab → lock again.
        return sessionStorage.getItem(STORAGE_KEY) !== null;
    });

    const unlock = useCallback(() => {
        sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
        setIsUnlocked(true);
    }, []);

    const lock = useCallback(() => {
        sessionStorage.removeItem(STORAGE_KEY);
        setIsUnlocked(false);
    }, []);

    // Auto-lock after inactivity
    useEffect(() => {
        if (!isUnlocked) return;

        let timer: number;
        const reset = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => lock(), AUTO_LOCK_MS);
        };

        const events: (keyof WindowEventMap)[] = [
            'mousemove',
            'keydown',
            'touchstart',
            'click',
        ];
        events.forEach((e) => window.addEventListener(e, reset));
        reset();

        return () => {
            window.clearTimeout(timer);
            events.forEach((e) => window.removeEventListener(e, reset));
        };
    }, [isUnlocked, lock]);

    return { isUnlocked, unlock, lock };
}