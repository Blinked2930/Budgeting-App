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
    const userId = identity?.subject ?? args.userId ?? "anonymous";

    const allMembers = await ctx.db.query("groupMembers").collect();
    const memberRecords = allMembers.filter(
      (m) => m.userId === userId || (!m.userId && userId === "anonymous")
    );

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
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();

    const expenses = await ctx.db
      .query("groupExpenses")
      .filter((q) =>
        q.and(
          q.eq(q.field("groupId"), args.groupId),
          q.neq(q.field("deleted"), true)
        )
      )
      .collect();

    const settlements = await ctx.db
      .query("groupSettlements")
      .filter((q) =>
        q.and(
          q.eq(q.field("groupId"), args.groupId),
          q.neq(q.field("deleted"), true)
        )
      )
      .collect();

    return {
      group,
      members,
      expenses: expenses.sort((a, b) => b.timestamp - a.timestamp),
      settlements: settlements.sort((a, b) => b.timestamp - a.timestamp),
    };
  },
});

export const getActivityFeed = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? args.userId ?? "anonymous";

    const allMembers = await ctx.db.query("groupMembers").collect();
    const memberRecords = allMembers.filter(
      (m) => m.userId === userId || (!m.userId && userId === "anonymous")
    );

    const groupIds = memberRecords.map((m) => m.groupId);

    const activities: Array<{
      id: string;
      groupId: string;
      groupName: string;
      type: "expense" | "settlement";
      title: string;
      amount: number;
      currency: string;
      timestamp: number;
      actorName: string;
    }> = [];

    for (const groupId of groupIds) {
      const group = await ctx.db.get(groupId);
      if (!group || group.deleted) continue;

      const members = await ctx.db
        .query("groupMembers")
        .filter((q) => q.eq(q.field("groupId"), groupId))
        .collect();

      const memberMap = new Map(members.map((m) => [m._id, m.name]));

      const expenses = await ctx.db
        .query("groupExpenses")
        .filter((q) =>
          q.and(
            q.eq(q.field("groupId"), groupId),
            q.neq(q.field("deleted"), true)
          )
        )
        .collect();

      for (const exp of expenses) {
        activities.push({
          id: exp._id,
          groupId: group._id,
          groupName: group.name,
          type: "expense",
          title: exp.title,
          amount: exp.amount,
          currency: exp.currency,
          timestamp: exp.timestamp,
          actorName: memberMap.get(exp.paidByMemberId) ?? "Someone",
        });
      }

      const settlements = await ctx.db
        .query("groupSettlements")
        .filter((q) =>
          q.and(
            q.eq(q.field("groupId"), groupId),
            q.neq(q.field("deleted"), true)
          )
        )
        .collect();

      for (const set of settlements) {
        const fromName = memberMap.get(set.fromMemberId) ?? "Someone";
        const toName = memberMap.get(set.toMemberId) ?? "Someone";
        activities.push({
          id: set._id,
          groupId: group._id,
          groupName: group.name,
          type: "settlement",
          title: `${fromName} paid ${toName}`,
          amount: set.amountALL,
          currency: set.currency,
          timestamp: set.timestamp,
          actorName: fromName,
        });
      }
    }

    return activities.sort((a, b) => b.timestamp - a.timestamp);
  },
});

export const getUnclaimedMembers = query({
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
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();

    const unclaimedMembers = members.filter(
      (m) => !m.userId || m.userId === "anonymous"
    );

    return {
      groupName: group.name,
      currency: group.currency,
      unclaimedMembers: unclaimedMembers.map((m) => ({
        _id: m._id,
        name: m.name,
      })),
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

    const groupData: {
      name: string;
      currency: "ALL" | "EUR" | "USD";
      description?: string;
      createdBy: string;
      createdAt: number;
    } = {
      name: args.name,
      currency: args.currency,
      createdBy: userId,
      createdAt: now,
    };

    if (args.description?.trim()) {
      groupData.description = args.description.trim();
    }

    const groupId = await ctx.db.insert("groups", groupData);

    const creatorMemberId = await ctx.db.insert("groupMembers", {
      groupId,
      userId,
      name: args.memberName.trim(),
      joinedAt: now,
    });

    if (args.additionalMembers && args.additionalMembers.length > 0) {
      for (const name of args.additionalMembers) {
        if (name.trim()) {
          await ctx.db.insert("groupMembers", {
            groupId,
            userId: "anonymous",
            name: name.trim(),
            joinedAt: now,
          });
        }
      }
    }

    return { groupId, memberId: creatorMemberId };
  },
});

export const joinGroup = mutation({
  args: {
    groupId: v.id("groups"),
    memberName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";
    const now = Date.now();

    const group = await ctx.db.get(args.groupId);
    if (!group || group.deleted) {
      throw new Error("Group not found");
    }

    const existingMembers = await ctx.db
      .query("groupMembers")
      .filter((q) =>
        q.and(
          q.eq(q.field("groupId"), args.groupId),
          q.eq(q.field("userId"), userId)
        )
      )
      .collect();

    if (existingMembers.length > 0) {
      return { groupId: args.groupId, memberId: existingMembers[0]._id };
    }

    const memberId = await ctx.db.insert("groupMembers", {
      groupId: args.groupId,
      userId,
      name: args.memberName.trim(),
      joinedAt: now,
    });

    return { groupId: args.groupId, memberId };
  },
});

export const claimMember = mutation({
  args: {
    memberId: v.id("groupMembers"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const member = await ctx.db.get(args.memberId);
    if (!member) {
      throw new Error("Member profile not found");
    }

    const patchData: { userId: string; name?: string } = { userId };
    if (args.name?.trim()) {
      patchData.name = args.name.trim();
    }

    await ctx.db.patch(args.memberId, patchData);
    return { groupId: member.groupId, memberId: args.memberId };
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
      name: args.name.trim(),
      email: args.email,
      userId: args.userId ?? "anonymous",
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

export const updateExpense = mutation({
  args: {
    expenseId: v.id("groupExpenses"),
    title: v.string(),
    amount: v.number(),
    currency: v.union(v.literal("ALL"), v.literal("EUR"), v.literal("USD")),
    amountInALL: v.number(),
    category: v.optional(v.string()),
    paidByMemberId: v.id("groupMembers"),
    splitType: v.union(v.literal("equal"), v.literal("exact"), v.literal("shares")),
    splits: v.array(
      v.object({
        memberId: v.id("groupMembers"),
        userId: v.optional(v.string()),
        amountALL: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { expenseId, ...updates } = args;
    await ctx.db.patch(expenseId, updates);
  },
});

export const deleteExpense = mutation({
  args: {
    expenseId: v.id("groupExpenses"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.expenseId, {
      deleted: true,
    });
  },
});

export const settleGroupDebt = mutation({
  args: {
    groupId: v.id("groups"),
    fromMemberId: v.id("groupMembers"),
    toMemberId: v.id("groupMembers"),
    fromUserId: v.optional(v.string()),
    toUserId: v.optional(v.string()),
    amountALL: v.number(),
    currency: v.union(v.literal("ALL"), v.literal("EUR"), v.literal("USD")),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const settlementId = await ctx.db.insert("groupSettlements", {
      groupId: args.groupId,
      fromMemberId: args.fromMemberId,
      toMemberId: args.toMemberId,
      fromUserId: args.fromUserId,
      toUserId: args.toUserId,
      amountALL: args.amountALL,
      currency: args.currency,
      timestamp: args.timestamp ?? now,
      createdAt: now,
    });

    return settlementId;
  },
});

export const addSettlement = settleGroupDebt;