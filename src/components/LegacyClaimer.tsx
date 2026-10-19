// src/components/LegacyClaimer.tsx
import { useEffect } from 'react';
import { useConvexAuth, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

/**
 * One-shot: once the user is authenticated with Convex, claim any cloud
 * records that predate Clerk (userId === undefined). Runs at most once
 * per device — guarded by localStorage. Silent no-op when unauthenticated.
 */
export const LegacyClaimer = () => {
    const { isAuthenticated } = useConvexAuth();
    const claim = useMutation(api.migrations.claimLegacyRecords);

    useEffect(() => {
        if (!isAuthenticated) return;
        if (localStorage.getItem('lekflow:legacy-claimed') === 'true') return;

        claim()
            .then((count) => {
                localStorage.setItem('lekflow:legacy-claimed', 'true');
                if (count > 0) {
                    console.log(`[LegacyClaimer] claimed ${count} unowned records`);
                }
            })
            .catch((err) => {
                // Not fatal — will retry next time isAuthenticated flips true.
                console.warn('[LegacyClaimer] claim failed:', err);
            });
    }, [isAuthenticated, claim]);

    return null;
};