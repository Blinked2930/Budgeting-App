// convex/preferences.ts
//
// BRIDGE for Convex codegen not exposing `userPreferences` in
// _generated/dataModel.d.ts. The table IS deployed (verified via
// `npx convex data userPreferences`). Once codegen catches up, delete the
// `userPreferencesTable` helper and its two `as any` casts — the handler
// bodies below will compile unchanged.
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const currencyCode = v.string();

/**
 * Central bridge. Returns `ctx.db` typed loosely so `.query("userPreferences")`
 * compiles even when _generated/dataModel.d.ts doesn't list the table.
 * Runtime hits the real deployed table.
 */
function userPreferencesTable(ctx: QueryCtx | MutationCtx): any {
  return (ctx.db as any).query("userPreferences");
}

export const getMyPreferences = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const existing = await userPreferencesTable(ctx)
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .first();

    return {
      userId,
      baseCurrency: (existing?.baseCurrency as string | undefined) ?? "ALL",
      updatedAt: (existing?.updatedAt as number | undefined) ?? 0,
    };
  },
});

export const setBaseCurrency = mutation({
  args: { baseCurrency: currencyCode },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? "anonymous";

    const existing = await userPreferencesTable(ctx)
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .first();

    const now = Date.now();

    if (existing) {
      await (ctx.db as any).patch(existing._id, {
        baseCurrency: args.baseCurrency,
        updatedAt: now,
      });
    } else {
      await (ctx.db as any).insert("userPreferences", {
        userId,
        baseCurrency: args.baseCurrency,
        updatedAt: now,
      });
    }
  },
});