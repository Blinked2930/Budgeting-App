// convex/debts.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertDebt = mutation({
    args: {
        localId: v.string(),
        counterparty: v.string(),
        counterpartyKey: v.string(),
        direction: v.string(),
        amountALL: v.number(),
        remainingALL: v.number(),
        note: v.optional(v.string()),
        status: v.string(),
        sourceExpenseId: v.optional(v.string()),
        createdAt: v.string(),
        resolvedAt: v.optional(v.string()),
        updatedAt: v.string(),
        deleted: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("debts")
            .withIndex("by_localId", (q) => q.eq("localId", args.localId))
            .first();

        if (existing) {
            const existingUpdatedAt = existing.updatedAt ?? existing.createdAt;
            if (args.updatedAt >= existingUpdatedAt) {
                await ctx.db.replace(existing._id, args);
            }
            return existing._id;
        }

        return await ctx.db.insert("debts", args);
    },
});

export const getRemoteDebts = query({
    handler: async (ctx) => {
        return await ctx.db.query("debts").collect();
    },
});