import { useState, useEffect } from 'react';
import { Lock, Delete } from 'lucide-react';
import { cn } from '../utils/cn';

interface LockScreenProps {
    onUnlock: () => void;
}

// Read the PIN hash from the build-time environment.
// Set VITE_PIN_HASH in Vercel → Settings → Environment Variables,
// and in .env.local for local dev.
const PIN_HASH = import.meta.env.VITE_PIN_HASH as string | undefined;
const PIN_LENGTH = 6;

export const LockScreen = ({ onUnlock }: LockScreenProps) => {
    const [entered, setEntered] = useState<string>('');
    const [error, setError] = useState<boolean>(false);
    const [shake, setShake] = useState<boolean>(false);

    useEffect(() => {
        if (!PIN_HASH) return;
        if (entered.length !== PIN_LENGTH) return;

        let cancelled = false;
        (async () => {
            const buf = await crypto.subtle.digest(
                'SHA-256',
                new TextEncoder().encode(entered)
            );
            const hex = [...new Uint8Array(buf)]
                .map((x) => x.toString(16).padStart(2, '0'))
                .join('');

            if (cancelled) return;

            if (hex === PIN_HASH) {
                onUnlock();
            } else {
                setError(true);
                setShake(true);
                if (navigator.vibrate) navigator.vibrate(100);
                setTimeout(() => {
                    setEntered('');
                    setError(false);
                    setShake(false);
                }, 500);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [entered, onUnlock]);

    if (!PIN_HASH) {
        return (
            <div className="min-h-dvh bg-slate-950 text-slate-100 flex items-center justify-center px-6">
                <div className="max-w-xs text-center space-y-2">
                    <p className="text-sm font-semibold text-rose-400">Configuration error</p>
                    <p className="text-xs text-slate-500">
                        VITE_PIN_HASH is not set. Add it in Vercel and redeploy.
                    </p>
                </div>
            </div>
        );
    }

    const handleDigit = (d: string) => {
        if (entered.length < PIN_LENGTH) setEntered((p) => p + d);
    };

    const handleDelete = () => setEntered((p) => p.slice(0, -1));

    return (
        <div className="min-h-dvh bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-6 font-sans select-none">
            <div className="w-full max-w-xs flex flex-col items-center gap-8">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                        <Lock className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-lg font-bold text-white">LekFlow is locked</h1>
                        <p className="text-xs text-slate-500 mt-1">Enter your PIN to continue</p>
                    </div>
                </div>

                <div
                    className={cn(
                        'flex items-center gap-4',
                        shake && 'animate-[shake_0.4s_ease-in-out]'
                    )}
                >
                    {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                'w-3.5 h-3.5 rounded-full border-2 transition-all',
                                error
                                    ? 'bg-rose-500 border-rose-500'
                                    : i < entered.length
                                        ? 'bg-emerald-400 border-emerald-400 scale-110'
                                        : 'bg-transparent border-slate-700'
                            )}
                        />
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-3 w-full">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => handleDigit(d)}
                            className="aspect-square rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-2xl font-mono font-semibold text-white transition-colors cursor-pointer active:scale-95"
                        >
                            {d}
                        </button>
                    ))}
                    <div />
                    <button
                        type="button"
                        onClick={() => handleDigit('0')}
                        className="aspect-square rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-2xl font-mono font-semibold text-white transition-colors cursor-pointer active:scale-95"
                    >
                        0
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={entered.length === 0}
                        className="aspect-square rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Delete"
                    >
                        <Delete className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
      `}</style>
        </div>
    );
};