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
        // Optional so rows created before this change still validate.
        // When missing, `timestamp` is used as the last-modified time.
        updatedAt: v.optional(v.string()),
        // Soft delete flag so deletions can sync to other devices.
        deleted: v.optional(v.boolean()),
    }).index("by_localId", ["localId"]),
});