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
        timestamp: v.string(),
        updatedAt: v.string(),
        deleted: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("expenses")
            .withIndex("by_localId", (q) => q.eq("localId", args.localId))
            .first();

        if (existing) {
            const existingUpdatedAt = existing.updatedAt ?? existing.timestamp;
            if (args.updatedAt >= existingUpdatedAt) {
                await ctx.db.replace(existing._id, args);
            }
            return existing._id;
        }

        return await ctx.db.insert("expenses", args);
    },
});

export const getRemoteExpenses = query({
    handler: async (ctx) => {
        return await ctx.db.query("expenses").collect();
    },
});