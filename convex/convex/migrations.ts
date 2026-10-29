// convex/migrations.ts
import { mutation } from './_generated/server';

/**
 * One-time migration: tag any unowned records with the current user's ID.
 * Safe to call repeatedly — only touches records where userId is unset.
 * Called automatically on first sign-in by <LegacyClaimer />.
 */
export const claimLegacyRecords = mutation({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error('Not authenticated');
        const userId = identity.subject;

        let claimed = 0;
        const tables = ['expenses', 'budgetCycles', 'transfers', 'debts'] as const;

        for (const table of tables) {
            const all = await ctx.db.query(table).collect();
            for (const record of all) {
                if (!record.userId) {
                    // Do NOT bump updatedAt — that would trigger spurious re-syncs.
                    await ctx.db.patch(record._id, { userId });
                    claimed++;
                }
            }
        }

        return claimed;
    },
});