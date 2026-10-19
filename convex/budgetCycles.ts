// convex/budgetCycles.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertBudgetCycle = mutation({
    args: {
        localId: v.string(),
        startDate: v.string(),
        targetEndDate: v.string(),
        stipendAmountALL: v.number(),
        startingRaiffeisenBalanceALL: v.number(),
        startingCashALL: v.optional(v.number()),
        bufferPoolALL: v.number(),
        travelStashALL: v.number(),
        updatedAt: v.string(),
        deleted: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;
        const userId = identity.subject;

        const existing = await ctx.db
            .query("budgetCycles")
            .withIndex("by_localId", (q) => q.eq("localId", args.localId))
            .first();

        if (existing?.userId && existing.userId !== userId) {
            throw new Error('Forbidden: record belongs to another user');
        }

        if (existing) {
            const existingUpdatedAt = existing.updatedAt ?? existing.startDate;
            if (args.updatedAt >= existingUpdatedAt) {
                await ctx.db.replace(existing._id, { ...args, userId });
            }
            return existing._id;
        }

        return await ctx.db.insert("budgetCycles", { ...args, userId });
    },
});

export const getRemoteBudgetCycles = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];
        return await ctx.db
            .query("budgetCycles")
            .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
            .collect();
    },
});