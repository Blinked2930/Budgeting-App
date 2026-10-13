import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const syncExpense = mutation({
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
    timestamp: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("expenses")
      .withIndex("by_localId", (q) => q.eq("localId", args.localId))
      .first();

    if (existing) {
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