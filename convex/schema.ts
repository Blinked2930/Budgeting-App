// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    expenses: defineTable({
        localId: v.string(),
        userId: v.optional(v.string()),
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
        updatedAt: v.optional(v.string()),
        deleted: v.optional(v.boolean()),
    })
        .index("by_localId", ["localId"])
        .index("by_userId", ["userId"]),

    budgetCycles: defineTable({
        localId: v.string(),
        userId: v.optional(v.string()),
        startDate: v.string(),
        targetEndDate: v.string(),
        stipendAmountALL: v.number(),
        startingRaiffeisenBalanceALL: v.number(),
        startingCashALL: v.optional(v.number()),
        bufferPoolALL: v.number(),
        travelStashALL: v.number(),
        plannedBigExpensesALL: v.optional(v.number()),
        updatedAt: v.optional(v.string()),
        deleted: v.optional(v.boolean()),
    })
        .index("by_localId", ["localId"])
        .index("by_userId", ["userId"]),

    transfers: defineTable({
        localId: v.string(),
        userId: v.optional(v.string()),
        amountALL: v.number(),
        direction: v.string(),
        timestamp: v.string(),
        updatedAt: v.optional(v.string()),
        deleted: v.optional(v.boolean()),
    })
        .index("by_localId", ["localId"])
        .index("by_userId", ["userId"]),

    debts: defineTable({
        localId: v.string(),
        userId: v.optional(v.string()),
        counterparty: v.string(),
        counterpartyKey: v.string(),
        direction: v.string(),
        amountALL: v.number(),
        remainingALL: v.number(),
        note: v.optional(v.string()),
        status: v.string(),
        sourceExpenseId: v.optional(v.string()),
        myShareAmountALL: v.optional(v.number()),
        createdAt: v.string(),
        resolvedAt: v.optional(v.string()),
        updatedAt: v.optional(v.string()),
        deleted: v.optional(v.boolean()),
    })
        .index("by_localId", ["localId"])
        .index("by_userId", ["userId"]),
});
