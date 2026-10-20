# Product Requirements Document (PRD) — LekFlow

## 1. Overview
LekFlow is an ultra-lightweight, offline-first Progressive Web Application (PWA) tailored for Peace Corps Volunteers in Albania. Its primary goal is frictionless daily food expenditure tracking, transitioning effortlessly into deeper budget management, travel savings (Travel Stash), and bank account reconciliation.

## 2. Target Persona & Core Constraints
- **User:** Peace Corps Volunteer operating in Albania (Peshkopi / Lezhë / regional sites).
- **Environment:** Variable connectivity (needs 100% offline logging capability), variable mid-month stipend arrival dates (12th–18th), local market shopping (Pazar vs. Supermarket).
- **Primary Need:** 2-second quick expense entry on mobile without network friction or complex forms.

## 3. Core Feature Requirements

### 3.1 Primary Interface (Quick Entry Screen)
- **Zero-Friction Input:** Large numeric entry pad/input field focused automatically on launch.
- **Currency Switcher:** Default `ALL` (Albanian Lek) with instant toggle flag/dropdown for `EUR` or `USD`.
- **One-Tap Save:** "Save Expense" button logs transaction instantly with current ISO timestamp.
- **Advanced Drawer Trigger:** "Advanced Entry" secondary button opens a slide-up drawer for additional metadata.

### 3.2 Advanced Entry Drawer
- **Historical Auto-Suggest:** Intelligent auto-complete for item/vendor names based on historical frequency and recent inputs.
- **Vendor Category:** Toggle choices for *Pazar (Open Market)*, *Dyqan / Supermarket*, *Kafene / Bar*, *Bakery*, *Restaurant*, *Utilities / Phone*, *Transport*, *Social / Other*.
- **Food Characteristics:**
  - Item Type (*Grocery Ingredient*, *Ready Meal*, *Snack*, *Beverage*).
  - Estimated Servings / Meals Provided.
- **Category Assignment:** Defaults to `Food & Dining`, reassignable to `Utilities`, `Transport`, `Social`, or `Travel Stash`.

### 3.3 Dynamic Budgeting & Payday Engine
- **Stipend-to-Stipend Cycle:** Flexible budget period anchored to actual stipend arrival dates rather than rigid calendar months.
- **Rolling Daily Cushion:** Daily allowance dynamically calculated as `(Cycle Budget Remaining) / (Days Until Target Next Payday)`. Unspent daily funds flow into a **Buffer Pool**.
- **Travel Stash Waterfall:** End-of-cycle surpluses automatically allocate into a dedicated **Travel Stash** savings account.

### 3.4 Insights & Raiffeisen Reconciliation Screen
- **Bank Account Check:** Real-time calculated estimate of expected Raiffeisen Bank account balance (`Starting Cash + Income - Tracked Expenses`). Displays variance alert if tracked numbers mismatch physical bank balance.
- **Pazar vs. Store Ratio:** Analytical breakdown showing savings performance at open markets vs. supermarkets.
- **Cost-Per-Meal Metric:** Aggregated average cost per derived meal.
- **Custom Data Querying:** Quick visual filter chips (by vendor, currency, month, or food type) with aggregate summaries.

### 3.5 Export-First Philosophy
- **Instant CSV Export:** One-tap export generating clean, flattened, unformatted CSV files (standard headers, ISO date formats).
- **Instant JSON Export:** Raw data backup for zero-vendor-lockin portability.