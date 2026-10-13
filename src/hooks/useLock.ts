// src/hooks/useLock.ts
import { useCallback, useState } from 'react';

const STORAGE_KEY = 'lekflow:unlocked';

export function useLock() {
    const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    });

    const unlock = useCallback(() => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setIsUnlocked(true);
    }, []);

    const lock = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setIsUnlocked(false);
    }, []);

    return { isUnlocked, unlock, lock };
}