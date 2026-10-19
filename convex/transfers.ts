// convex/transfers.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertTransfer = mutation({
    args: {
        localId: v.string(),
        amountALL: v.number(),
        direction: v.string(),
        timestamp: v.string(),
        updatedAt: v.string(),
        deleted: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;
        const userId = identity.subject;

        const existing = await ctx.db
            .query("transfers")
            .withIndex("by_localId", (q) => q.eq("localId", args.localId))
            .first();

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

        return await ctx.db.insert("transfers", { ...args, userId });
    },
});

export const getRemoteTransfers = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];
        return await ctx.db
            .query("transfers")
            .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
            .collect();
    },
});