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
        const existing = await ctx.db
            .query("transfers")
            .withIndex("by_localId", (q) => q.eq("localId", args.localId))
            .first();

        if (existing) {
            const existingUpdatedAt = existing.updatedAt ?? existing.timestamp;
            if (args.updatedAt >= existingUpdatedAt) {
                await ctx.db.replace(existing._id, args);
            }
            return existing._id;
        }

        return await ctx.db.insert("transfers", args);
    },
});

export const getRemoteTransfers = query({
    handler: async (ctx) => {
        return await ctx.db.query("transfers").collect();
    },
});