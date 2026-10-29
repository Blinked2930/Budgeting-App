/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as budgetCycles from "../budgetCycles.js";
import type * as convex__generated_api from "../convex/_generated/api.js";
import type * as convex__generated_server from "../convex/_generated/server.js";
import type * as convex_budgetCycles from "../convex/budgetCycles.js";
import type * as convex_convex__generated_api from "../convex/convex/_generated/api.js";
import type * as convex_convex__generated_server from "../convex/convex/_generated/server.js";
import type * as convex_convex_budgetCycles from "../convex/convex/budgetCycles.js";
import type * as convex_convex_debts from "../convex/convex/debts.js";
import type * as convex_convex_expenses from "../convex/convex/expenses.js";
import type * as convex_convex_groups from "../convex/convex/groups.js";
import type * as convex_convex_migrations from "../convex/convex/migrations.js";
import type * as convex_convex_transfers from "../convex/convex/transfers.js";
import type * as convex_debts from "../convex/debts.js";
import type * as convex_expenses from "../convex/expenses.js";
import type * as convex_groups from "../convex/groups.js";
import type * as convex_migrations from "../convex/migrations.js";
import type * as convex_transfers from "../convex/transfers.js";
import type * as debts from "../debts.js";
import type * as expenses from "../expenses.js";
import type * as groups from "../groups.js";
import type * as migrations from "../migrations.js";
import type * as transfers from "../transfers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  budgetCycles: typeof budgetCycles;
  "convex/_generated/api": typeof convex__generated_api;
  "convex/_generated/server": typeof convex__generated_server;
  "convex/budgetCycles": typeof convex_budgetCycles;
  "convex/convex/_generated/api": typeof convex_convex__generated_api;
  "convex/convex/_generated/server": typeof convex_convex__generated_server;
  "convex/convex/budgetCycles": typeof convex_convex_budgetCycles;
  "convex/convex/debts": typeof convex_convex_debts;
  "convex/convex/expenses": typeof convex_convex_expenses;
  "convex/convex/groups": typeof convex_convex_groups;
  "convex/convex/migrations": typeof convex_convex_migrations;
  "convex/convex/transfers": typeof convex_convex_transfers;
  "convex/debts": typeof convex_debts;
  "convex/expenses": typeof convex_expenses;
  "convex/groups": typeof convex_groups;
  "convex/migrations": typeof convex_migrations;
  "convex/transfers": typeof convex_transfers;
  debts: typeof debts;
  expenses: typeof expenses;
  groups: typeof groups;
  migrations: typeof migrations;
  transfers: typeof transfers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
