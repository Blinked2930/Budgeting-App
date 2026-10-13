import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    expenses: defineTable({
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
    }).index("by_localId", ["localId"]),
});