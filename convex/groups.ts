// convex/groups.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getMyGroups = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];
        const userId = identity.subject;

        // Find memberships
        const memberships = await ctx.db
            .query("groupMembers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .collect();

        const groupIds = new Set(memberships.map((m) => m.groupId));

        // Also include groups created by this user
        const created = await ctx.db
            .query("groups")
            .withIndex("by_createdBy", (q) => q.eq("createdBy", userId))
            .collect();
        for (const g of created) {
            groupIds.add(g._id);
        }

        const groups = [];
        for (const gId of groupIds) {
            const g = await ctx.db
                .query("groups")
                .filter((q) => q.and(q.eq(q.field("_id"), gId), q.neq(q.field("deleted"), true)))
                .first();
            if (g) groups.push(g);
        }

        return groups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
});

export const createGroup = mutation({
    args: {
        name: v.string(),
        currency: v.union(v.literal("ALL"), v.literal("EUR"), v.literal("USD")),
        description: v.optional(v.string()),
        creatorName: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthorized: Sign in required");
        const userId = identity.subject;
        const now = new Date().toISOString();

        const groupId = await ctx.db.insert("groups", {
            name: args.name.trim(),
            currency: args.currency,
            description: args.description?.trim(),
            createdBy: userId,
            createdAt: now,
        });

        // Add creator as first member
        await ctx.db.insert("groupMembers", {
            groupId,
            userId,
            name: args.creatorName.trim(),
            email: identity.email,
            avatarUrl: identity.pictureUrl,
            joinedAt: now,
        });

        return groupId;
    },
});

export const addMember = mutation({
    args: {
        groupId: v.string(),
        name: v.string(),
        email: v.optional(v.string()),
        userId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthorized");

        return await ctx.db.insert("groupMembers", {
            groupId: args.groupId,
            name: args.name.trim(),
            email: args.email?.trim(),
            userId: args.userId,
            joinedAt: new Date().toISOString(),
        });
    },
});

export const getGroupDetails = query({
    args: { groupId: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        const group = await ctx.db
            .query("groups")
            .filter((q) => q.eq(q.field("_id"), args.groupId))
            .first();

        if (!group || group.deleted) return null;

        const members = await ctx.db
            .query("groupMembers")
            .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
            .collect();

        const expenses = await ctx.db
            .query("groupExpenses")
            .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
            .filter((q) => q.neq(q.field("deleted"), true))
            .collect();

        const settlements = await ctx.db
            .query("groupSettlements")
            .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
            .filter((q) => q.neq(q.field("deleted"), true))
            .collect();

        return {
            group,
            members,
            expenses: expenses.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
            settlements: settlements.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
        };
    },
});

export const addGroupExpense = mutation({
    args: {
        groupId: v.string(),
        title: v.string(),
        amount: v.number(),
        currency: v.union(v.literal("ALL"), v.literal("EUR"), v.literal("USD")),
        amountInALL: v.number(),
        category: v.optional(v.string()),
        paidByMemberId: v.string(),
        paidByUserId: v.optional(v.string()),
        splitType: v.union(v.literal("equal"), v.literal("exact"), v.literal("shares")),
        splits: v.array(
            v.object({
                memberId: v.string(),
                userId: v.optional(v.string()),
                amountALL: v.number(),
            })
        ),
        timestamp: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthorized");
        const now = new Date().toISOString();

        return await ctx.db.insert("groupExpenses", {
            ...args,
            createdAt: now,
        });
    },
});

export const settleGroupDebt = mutation({
    args: {
        groupId: v.string(),
        fromMemberId: v.string(),
        toMemberId: v.string(),
        fromUserId: v.optional(v.string()),
        toUserId: v.optional(v.string()),
        amountALL: v.number(),
        currency: v.union(v.literal("ALL"), v.literal("EUR"), v.literal("USD")),
        timestamp: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthorized");
        const now = new Date().toISOString();

        return await ctx.db.insert("groupSettlements", {
            ...args,
            createdAt: now,
        });
    },
});

