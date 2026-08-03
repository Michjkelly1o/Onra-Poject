# Onra Studio — Mock Data Guide

Hi. This folder is the **complete demo dataset** for the Onra Studio fitness-studio SaaS. Every row you see in the app comes from a file in here. If you're building an AI feature or migrating to a real database, this is the only folder you need to read.

**Written for humans. No jargon. Read top to bottom.**

---

## What's in this folder?

- **55 table files** (e.g. `customers.ts`, `class_schedule.ts`, `pay_rates.ts`). Each one is one future database table.
- **`_types.ts`** — the TypeScript type for every table. If you don't use TypeScript, treat this like a schema reference.
- **`index.ts`** — a "barrel" that re-exports everything so you can import from one place.
- **`prototype_demo_data.ts`** — extra helpers that generate a few rows anchored to "today" (e.g. "5 days ago"). Used by some seeds to keep the demo canvas current.
- **`permission_templates.ts`** — pre-canned RBAC permission matrices (used by `roles.ts`).
- **`account_profile.ts` + `instructor_profile.ts`** — two personas: the currently-logged-in admin and the currently-logged-in instructor. Used to fake a login without a real auth system.

**Total: 59 files.**

---

## How the data is shaped

**One file per future Postgres table.** The file is named exactly like the table (e.g. `customers.ts` → future `customers` table).

**All field names are `snake_case`** — matching Postgres conventions. Example:

```ts
{
    id: "cust_ahmed_zayn",
    branch_id: "branch_forma_south",   // ← snake_case, not branchId
    full_name: "Ahmed Zayn",
    email: "ahmed@example.com",
    created_at: "2024-06-14T10:00:00Z",
}
```

**Foreign keys are always by `id`.** No denormalized names, no nested objects. Example:

```ts
// class_bookings.ts row
{
    id: "book_001",
    class_schedule_id: "class_sched_2026_05_08_0900",  // → class_schedule.id
    customer_id: "cust_ahmed_zayn",                    // → customers.id
    status: "confirmed",
}
```

To render "Ahmed Zayn just booked Reformer Pilates," you look up:
- `customers.find(c => c.id === booking.customer_id)` → get the name
- `class_schedule.find(cs => cs.id === booking.class_schedule_id)` → get the class

**Every seed file exports one array**, typed as the table's row type:

```ts
export const customers: Customer[] = [ /* rows */ ];
```

---

## How to use it

### One-line import (recommended)

```ts
import { customers, class_schedule, class_bookings } from "@/data/mock";
```

`index.ts` re-exports every seed. Just grab what you need.

### If you don't have the `@/data/mock` path alias

Import from the relative path:

```ts
import { customers } from "./src/data/mock";
```

### Reading a single table

```ts
import { customers } from "@/data/mock";

// It's just an array. Filter, map, whatever you like.
const activeCustomers = customers.filter(c => c.status === "active");
```

### Joining two tables (no SQL, just JS)

```ts
import { class_bookings, customers, class_schedule } from "@/data/mock";

const bookingsWithDetails = class_bookings.map(b => ({
    ...b,
    customer: customers.find(c => c.id === b.customer_id),
    class:    class_schedule.find(cs => cs.id === b.class_schedule_id),
}));
```

That's it. It's data — do whatever you want with it.

---

## Three files that need outside types

**Heads up:** most of the folder is 100% self-contained, but three files pull TypeScript types from outside:

| File | Outside type import | Where it comes from |
|---|---|---|
| `account_profile.ts` | `type { User }` | `src/types/index.ts` |
| `instructor_profile.ts` | `type { User }` | `src/types/index.ts` |
| `branding_settings.ts` | `type { BrandingSettings }` | `src/lib/store.ts` |

**These are TypeScript-only imports.** They vanish at runtime. Your options:

1. **Ignore them entirely** if you're using this as JSON-ish data — the actual data works fine.
2. **Copy `src/types/index.ts`** alongside the mock folder if you want `User` typed.
3. **Copy the `BrandingSettings` type** from `src/lib/store.ts` (search that file for `export interface BrandingSettings` — it's ~15 fields).

Every OTHER file in this folder types itself against `_types.ts` inside the folder. Fully portable.

---

## The 55 tables at a glance

Grouped so you know what fits together.

### Foundation (no FKs, everyone depends on these)
`roles` · `branches` · `class_categories`

### People
`users` · `staff` · `staff_profiles` · `user_role_assignments` · `customers`

### Locations & scheduling
`rooms` · `business_hours` · `shifts` · `blocked_times`

### Products for sale
`memberships` · `packages` · `gift_card_designs` · `promo_codes` · `payment_methods`

### Class catalog + schedule + attendance
`class_templates` · `class_schedule` · `class_bookings` · `class_ratings`

### Appointment / service catalog + schedule + attendance
`services` · `appointments`

### Customer state
`customer_plans` · `customer_transactions` · `customer_agreements` · `customer_referrals` · `wallet_transactions` · `issued_gift_cards`

### Payroll & pay
`pay_rates` · `instructors` · `payroll_entries`

### Settings
`business_hours` · `tax_rates` · `tax_settings` · `tax_rules` · `agreements` · `agreement_versions` · `integrations` · `payment_providers` · `referral_settings` · `notification_settings` · `notification_delivery_settings` · `branding_settings` · `classes_settings` · `cancellation_policy`

### Marketing
`marketing_items` · `marketing_campaign_stats` · `marketing_spend` · `leads`

### Notifications feed
`notifications` · `notifications_instructor`

### Staff observability
`staff_attendance_log`

### Personas
`account_profile` (logged-in admin) · `instructor_profile` (logged-in instructor)

### Instructor integrations
`instructor_integrations`

---

## When you migrate to Postgres / Supabase

Every one of these files maps 1-to-1 to a real table. The path is:

1. **CREATE TABLE.** The interface in `_types.ts` is your schema.
2. **INSERT INTO.** The exported array is your seed data — dump it as JSON, load it with `\copy` or Supabase's SQL editor.
3. **FK constraints.** Add `REFERENCES` clauses matching the `_id`-suffixed fields (they're all consistent).

Because every field is already `snake_case` and every FK is already an `id`, the migration is a schema-preserving swap. Nothing gets reshaped.

**Example (translating `wallet_transactions.ts`):**

```sql
-- from wallet_transactions.ts row shape
CREATE TABLE wallet_transactions (
    id                TEXT PRIMARY KEY,
    customer_id       TEXT NOT NULL REFERENCES customers(id),
    branch_id         TEXT NOT NULL REFERENCES branches(id),
    type              TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    amount_aed        NUMERIC NOT NULL,
    reason            TEXT NOT NULL,
    reference_type    TEXT,
    reference_id      TEXT,
    created_at        TIMESTAMPTZ NOT NULL,
    created_by        TEXT
);
```

Then `INSERT INTO wallet_transactions VALUES ...` using the seeded rows.

---

## Rules to keep in mind

**Do:**
- Treat each file as a table. Row shape never changes across a file.
- Use FKs as source of truth. Look up related data by `id`, don't trust denormalized copies.
- Read the header comment at the top of each seed file — it explains any quirks (e.g. "Owner's `branch_id` is `null` = all locations").

**Don't:**
- Mutate seed arrays at runtime. They're the starting state. If you need to change data, copy to your own store first.
- Assume the row order is meaningful. Sort by `created_at` or whatever field makes sense in context.
- Trust `id` prefixes to convey business logic. `cust_ahmed_zayn` is just a stable, human-readable id — don't parse it.

---

## Timestamps you'll see

Two patterns:

1. **Fixed dates** (`"2026-01-08T09:15:00Z"`) — historical rows. Never change.
2. **Anchored to boot time** (via `prototype_demo_data.ts`) — some rows compute their timestamps as "N days ago" at module load, so the demo canvas always feels current. Look for imports from `./prototype_demo_data` at the top of a seed file if you see this in action.

For real-database migration you'd just freeze all timestamps to absolute values.

---

## Total counts (as of this snapshot)

- **23 staff** (1 owner, 3 branch admins, 2 operators, 2 front desk, 15 instructors)
- **~30 customers**
- **6 pay rates** (1 monthly with commission, 5 class-based)
- **4 branches** (3 active, 1 inactive)
- **6 roles** (owner, branch_admin, operator, front_desk, instructor + 1 archived)
- **~35 class schedules** across the current period
- **~60 customer transactions**

Numbers move as the seed evolves — treat them as ballpark.

---

## Questions?

Look at the header comment inside any seed file. Each one starts with a short note about what the table is, what it drives in the app, and what FKs it uses. That's usually the fastest way to answer a "what does this field mean?" question.

If a header comment is missing or unclear, that's a bug — open a note. Every seed is meant to be readable without external docs.
