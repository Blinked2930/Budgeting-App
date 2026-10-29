// convex/expenses.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertExpense = mutation({
    args: {
        localId: v.string(),
        amount: v.number(),
        currency: v.union(v.literal("ALL"), v.literal("EUR"), v.literal("USD")),
        amountInALL: v.number(),
        category: v.string(),
        vendorType: v.optional(v.string()),
        foodType: v.optional(v.string()),
        itemName: v.optional(v.string()),
        estimatedMeals: v.optional(v.number()),
        paidWith: v.optional(v.string()),
        budgetAmountALL: v.optional(v.number()),
        debtId: v.optional(v.string()),
        debtRelated: v.optional(v.boolean()),
        walletNeutral: v.optional(v.boolean()),
        isDebtOrigin: v.optional(v.boolean()),
        isBigExpense: v.optional(v.boolean()),
        isForgiveness: v.optional(v.boolean()),
        timestamp: v.string(),
        updatedAt: v.string(),
        deleted: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Not signed in — skip silently. Sync worker retries on next cycle.
            return null;
        }
        const userId = identity.subject;

        const existing = await ctx.db
            .query("expenses")
            .withIndex("by_localId", (q) => q.eq("localId", args.localId))
            .first();

        // Reject if another user already owns this localId (shouldn't happen for UUIDs,
        // but prevents cross-account hijacking if it ever does).
        if (existing?.userId && existing.userId !== userId) {
            throw new Error('Forbidden: record belongs to another user');
        }

        if (existing) {
            const existingUpdatedAt = existing.updatedAt ?? existing.timestamp;
            if (args.updatedAt >= existingUpdatedAt) {
                await ctx.db.replace(existing._id, { ...args, userId });
            }
            return existing._id;
        }

        return await ctx.db.insert("expenses", { ...args, userId });
    },
});

export const getRemoteExpenses = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];
        return await ctx.db
            .query("expenses")
            .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
            .collect();
    },
});
