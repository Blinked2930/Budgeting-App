// convex/budgetCycles.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Insert a new budget cycle, or update an existing one (matched by localId).
 * Last-write-wins: the incoming version replaces the stored one only if
 * its updatedAt is the same or newer.
 */
export const upsertBudgetCycle = mutation({
    args: {
        localId: v.string(),
        startDate: v.string(),
        targetEndDate: v.string(),
        stipendAmountALL: v.number(),
        startingRaiffeisenBalanceALL: v.number(),
        bufferPoolALL: v.number(),
        travelStashALL: v.number(),
        updatedAt: v.string(),
        deleted: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("budgetCycles")
            .withIndex("by_localId", (q) => q.eq("localId", args.localId))
            .first();

        if (existing) {
            const existingUpdatedAt = existing.updatedAt ?? existing.startDate;
            if (args.updatedAt >= existingUpdatedAt) {
                await ctx.db.replace(existing._id, args);
            }
            return existing._id;
        }

        return await ctx.db.insert("budgetCycles", args);
    },
});

export const getRemoteBudgetCycles = query({
    handler: async (ctx) => {
        return await ctx.db.query("budgetCycles").collect();
    },
});