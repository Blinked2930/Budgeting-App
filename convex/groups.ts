// convex/groups.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

const currencyValidator = v.union(
  v.literal("ALL"),
  v.literal("EUR"),
  v.literal("USD"),
  v.literal("GBP"),
  v.literal("CHF"),
  v.literal("CAD"),
  v.literal("AUD"),
  v.literal("JPY")
);

// ---------------------------------------------------------------------------
// QUERIES
// ---------------------------------------------------------------------------

export const getMyGroups = query({
  args: {
    userId: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? args.userId ?? "anonymous";

    const allMembers = await ctx.db.query("groupMembers").collect();
    const myMemberRecords = allMembers.filter(
      (m) => m.userId === userId || (!m.userId && userId === "anonymous")
    );

    const groups: any[] = [];

    for (const memberRow of myMemberRecords) {
      const group = await ctx.db.get(memberRow.groupId);
      if (!group || group.deleted) continue;

      const groupStatus = group.status ?? "active";
      if (!args.includeArchived && groupStatus === "archived") continue;

      const members = await ctx.db
        .query("groupMembers")
        .filter((q) => q.eq(q.field("groupId"), memberRow.groupId))
        .collect();

      const expenses = await ctx.db
        .query("groupExpenses")
        .filter((q) =>
          q.and(
            q.eq(q.field("groupId"), memberRow.groupId),
            q.neq(q.field("deleted"), true)
          )
        )
        .collect();

      const settlements = await ctx.db
        .query("groupSettlements")
        .filter((q) =>
          q.and(
            q.eq(q.field("groupId"), memberRow.groupId),
            q.neq(q.field("deleted"), true)
          )
        )
        .collect();

      let net = 0;
      for (const exp of expenses) {
        if (exp.paidByMemberId === memberRow._id) net += exp.amountInALL;
        for (const split of exp.splits) {
          if (split.memberId === memberRow._id) net -= split.amountALL;
        }
      }
      for (const set of settlements) {
        if (set.fromMemberId === memberRow._id) net += set.amountALL;
        if (set.toMemberId === memberRow._id) net -= set.amountALL;
      }

      groups.push({
        ...group,
        status: groupStatus,
        memberCount: members.length,
        myNetBalanceALL: Math.round(net),
        isOwner: group.createdBy === userId,
      });
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
      group: {
        ...group,
        status: group.status ?? "active",
        allowedCurrencies: (group as any).allowedCurrencies || ["ALL", "EUR", "USD"],
      },
      members,
      expenses: expenses.sort((a, b) => b.timestamp - a.timestamp),
      settlements: settlements.sort((a, b) => b.timestamp - a.timestamp),
    };
  },
});

/**
 * Returns whether a group name is available to the calling user.
 * A name is unavailable if the caller already OWNS another group with the
 * same name (case-insensitive, trimmed). Names owned by other users do not
 * block — you can both have a "Tirana Trip".
 *
 * `excludeGroupId` lets GroupSettingsModal reuse this check when renaming.
 */
export const checkGroupNameAvailable = query({
  args: {
    name: v.string(),
    excludeGroupId: v.optional(v.id("groups")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const normalized = normalizeName(args.name);
    if (!normalized) return { available: false, reason: "empty" as const };

    const allGroups = await ctx.db.query("groups").collect();
    const conflict = allGroups.find(
      (g) =>
        !g.deleted &&
        g.createdBy === userId &&
        normalizeName(g.name) === normalized &&
        g._id !== args.excludeGroupId
    );

    return conflict
      ? { available: false, reason: "duplicate" as const, conflictGroupName: conflict.name }
      : { available: true, reason: "ok" as const };
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
      category?: string;
      paidByMemberId?: string;
      splitType?: string;
      paidWith?: "Cash" | "Card";
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
          category: exp.category,
          paidByMemberId: exp.paidByMemberId,
          splitType: exp.splitType,
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
          paidWith: set.paidWith,
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
    groupIdOrCode: v.string(),
  },
  handler: async (ctx, args) => {
    const queryStr = args.groupIdOrCode.trim().toUpperCase();

    const allGroups = await ctx.db.query("groups").collect();
    const group = allGroups.find(
      (g) =>
        !g.deleted &&
        (g._id === args.groupIdOrCode ||
          (g as any).inviteCode?.toUpperCase() === queryStr)
    );

    if (!group) return null;

    const members = await ctx.db
      .query("groupMembers")
      .filter((q) => q.eq(q.field("groupId"), group._id))
      .collect();

    const unclaimedMembers = members.filter(
      (m) => !m.userId || m.userId === "anonymous"
    );

    return {
      groupId: group._id,
      groupName: group.name,
      currency: group.currency,
      inviteCode: (group as any).inviteCode || group._id.slice(-6).toUpperCase(),
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
    currency: currencyValidator,
    allowedCurrencies: v.optional(v.array(currencyValidator)),
    description: v.optional(v.string()),
    memberName: v.string(),
    additionalMembers: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";
    const now = Date.now();
    const inviteCode = generateInviteCode();

    const normalized = normalizeName(args.name);
    if (!normalized) {
      throw new Error("Group name cannot be empty.");
    }

    // Owner-scoped uniqueness: reject if THIS user already owns a group
    // with the same name (case-insensitive). Other users may own groups
    // with the same name — names are not globally unique.
    const allGroups = await ctx.db.query("groups").collect();
    const ownedDuplicate = allGroups.find(
      (g) =>
        !g.deleted &&
        g.createdBy === userId &&
        normalizeName(g.name) === normalized
    );
    if (ownedDuplicate) {
      throw new Error(
        `You already own a group called "${ownedDuplicate.name}". Pick a different name.`
      );
    }

    const groupData: {
      name: string;
      currency: string;
      allowedCurrencies: string[];
      description?: string;
      createdBy: string;
      createdAt: number;
      inviteCode: string;
      status: "active" | "archived";
    } = {
      name: args.name.trim(),
      currency: args.currency,
      allowedCurrencies: args.allowedCurrencies || ["ALL", "EUR", "USD"],
      createdBy: userId,
      createdAt: now,
      inviteCode,
      status: "active",
    };

    if (args.description?.trim()) {
      groupData.description = args.description.trim();
    }

    const groupId = await ctx.db.insert("groups", groupData as any);

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

    return { groupId, inviteCode, memberId: creatorMemberId };
  },
});

export const updateGroupSettings = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.string(),
    currency: currencyValidator,
    allowedCurrencies: v.array(currencyValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const group = await ctx.db.get(args.groupId);
    if (!group || group.deleted) {
      throw new Error("Group not found.");
    }
    if (group.createdBy !== userId) {
      throw new Error("Only the group owner can change settings.");
    }

    // Owner-scoped duplicate check on rename (excludes this group).
    const normalized = normalizeName(args.name);
    if (!normalized) {
      throw new Error("Group name cannot be empty.");
    }
    const allGroups = await ctx.db.query("groups").collect();
    const ownedDuplicate = allGroups.find(
      (g) =>
        !g.deleted &&
        g.createdBy === userId &&
        g._id !== args.groupId &&
        normalizeName(g.name) === normalized
    );
    if (ownedDuplicate) {
      throw new Error(
        `You already own a group called "${ownedDuplicate.name}". Pick a different name.`
      );
    }

    await ctx.db.patch(args.groupId, {
      name: args.name.trim(),
      currency: args.currency,
      allowedCurrencies: args.allowedCurrencies as any,
    });
  },
});

export const archiveGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.groupId, { status: "archived" });
  },
});

export const unarchiveGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.groupId, { status: "active" });
  },
});

/**
 * Hard-deletes a group and every dependent row (settlements, expenses,
 * members). Only the creator can delete. Non-owners should archive instead.
 * Order matters: children before the parent so no orphaned rows survive.
 */
export const deleteGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const group = await ctx.db.get(args.groupId);
    if (!group || group.deleted) {
      throw new Error("Group not found.");
    }
    if (group.createdBy !== userId) {
      throw new Error("Only the group owner can delete a group. Archive it instead.");
    }

    const settlements = await ctx.db
      .query("groupSettlements")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();
    for (const s of settlements) await ctx.db.delete(s._id);

    const expenses = await ctx.db
      .query("groupExpenses")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();
    for (const e of expenses) await ctx.db.delete(e._id);

    const members = await ctx.db
      .query("groupMembers")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();
    for (const m of members) await ctx.db.delete(m._id);

    await ctx.db.delete(args.groupId);

    return { deleted: true, groupId: args.groupId };
  },
});

export const joinGroup = mutation({
  args: {
    groupIdOrCode: v.string(),
    memberName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";
    const now = Date.now();

    const queryStr = args.groupIdOrCode.trim().toUpperCase();
    const allGroups = await ctx.db.query("groups").collect();
    const group = allGroups.find(
      (g) =>
        !g.deleted &&
        (g._id === args.groupIdOrCode ||
          (g as any).inviteCode?.toUpperCase() === queryStr)
    );

    if (!group) {
      throw new Error("Group not found with that Invite Code or ID.");
    }

    const existingMembers = await ctx.db
      .query("groupMembers")
      .filter((q) =>
        q.and(
          q.eq(q.field("groupId"), group._id),
          q.eq(q.field("userId"), userId)
        )
      )
      .collect();

    if (existingMembers.length > 0) {
      return { groupId: group._id, memberId: existingMembers[0]._id };
    }

    const memberId = await ctx.db.insert("groupMembers", {
      groupId: group._id,
      userId,
      name: args.memberName.trim(),
      joinedAt: now,
    });

    return { groupId: group._id, memberId };
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
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const memberId = await ctx.db.insert("groupMembers", {
      groupId: args.groupId,
      name: args.name.trim(),
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
    currency: currencyValidator,
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
    currency: currencyValidator,
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
    currency: currencyValidator,
    paidWith: v.optional(v.union(v.literal("Cash"), v.literal("Card"))),
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
      paidWith: args.paidWith ?? "Cash",
      timestamp: args.timestamp ?? now,
      createdAt: now,
    });

    return settlementId;
  },
});

export const addSettlement = settleGroupDebt;