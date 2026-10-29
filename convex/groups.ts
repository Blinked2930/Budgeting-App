import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ---------------------------------------------------------------------------
// QUERIES
// ---------------------------------------------------------------------------

export const getMyGroups = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? args.userId;

    if (!userId) {
      return [];
    }

    const memberRecords = await ctx.db
      .query("groupMembers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const groupIds = memberRecords.map((m) => m.groupId);

    const groups = [];
    for (const groupId of groupIds) {
      const group = await ctx.db.get(groupId);
      if (group && !group.deleted) {
        groups.push(group);
      }
    }

    return groups.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const listGroups = getMyGroups;

export const getGroupDetails = query({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group || group.deleted) {
      return null;
    }

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
      expenses: expenses.sort((a, b) => b.timestamp - a.timestamp),
      settlements: settlements.sort((a, b) => b.timestamp - a.timestamp),
    };
  },
});

// ---------------------------------------------------------------------------
// MUTATIONS
// ---------------------------------------------------------------------------

export const createGroup = mutation({
  args: {
    name: v.string(),
    currency: v.union(v.literal("ALL"), v.literal("EUR"), v.literal("USD")),
    description: v.optional(v.string()),
    memberName: v.string(),
    additionalMembers: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";
    const now = Date.now();

    // 1. Insert the group
    const groupId = await ctx.db.insert("groups", {
      name: args.name,
      currency: args.currency,
      description: args.description,
      createdBy: userId,
      createdAt: now,
    });

    // 2. Insert creator as primary member
    const creatorMemberId = await ctx.db.insert("groupMembers", {
      groupId,
      userId,
      name: args.memberName,
      joinedAt: now,
    });

    // 3. Insert initial additional members if provided
    if (args.additionalMembers && args.additionalMembers.length > 0) {
      for (const name of args.additionalMembers) {
        if (name.trim()) {
          await ctx.db.insert("groupMembers", {
            groupId,
            name: name.trim(),
            joinedAt: now,
          });
        }
      }
    }

    return { groupId, memberId: creatorMemberId };
  },
});

export const addMember = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.string(),
    email: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const memberId = await ctx.db.insert("groupMembers", {
      groupId: args.groupId,
      name: args.name,
      email: args.email,
      userId: args.userId,
      joinedAt: now,
    });

    return memberId;
  },
});

export const addExpense = mutation({
  args: {
    groupId: v.id("groups"),
    title: v.string(),
    amount: v.number(),
    currency: v.union(v.literal("ALL"), v.literal("EUR"), v.literal("USD")),
    amountInALL: v.number(),
    category: v.optional(v.string()),
    paidByMemberId: v.id("groupMembers"),
    paidByUserId: v.optional(v.string()),
    splitType: v.union(v.literal("equal"), v.literal("exact"), v.literal("shares")),
    splits: v.array(
      v.object({
        memberId: v.id("groupMembers"),
        userId: v.optional(v.string()),
        amountALL: v.number(),
      })
    ),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const expenseId = await ctx.db.insert("groupExpenses", {
      groupId: args.groupId,
      title: args.title,
      amount: args.amount,
      currency: args.currency,
      amountInALL: args.amountInALL,
      category: args.category,
      paidByMemberId: args.paidByMemberId,
      paidByUserId: args.paidByUserId,
      splitType: args.splitType,
      splits: args.splits,
      timestamp: args.timestamp ?? now,
      createdAt: now,
    });

    return expenseId;
  },
});

export const addGroupExpense = addExpense;