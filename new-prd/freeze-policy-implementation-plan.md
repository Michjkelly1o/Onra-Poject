# Freeze Policy — Implementation Plan

**Goal:** Give each studio branch a configurable **Freeze Policy** (admin settings) that
governs how members self-serve **membership** freezes on the customer side. Modelled on the
Momence reference screen. Admin retains a full freeze/unfreeze override.

## Locked decisions (client, 2026-07-14)
1. **Admin = full override.** The admin customer-profile Freeze/Unfreeze (memberships **and**
   credit packages) is **unchanged** and ignores the policy. The policy only gates the
   **customer self-service** side. → `FreezeModal`/`UnfreezeModal` in `CustomerDetailPage` untouched.
2. **Per-branch.** One `freeze_policy` row per branch (mirrors Booking rules). The admin page
   scopes to a branch (Owner can switch; Branch Admin sees their branch). The customer freeze
   reads the policy for the **membership's** branch.
3. **Charge now.** When a freeze fee is configured, confirming a customer freeze creates a real
   fee **transaction** in the customer's payment history / financials at confirm time.

## Existing reality (no rebuild needed)
- Store already has `freezeCustomerPlan(planId, start, end, source)` + `unfreezeCustomerPlan(planId)`,
  and each plan carries `freezeSource: customer_portal | admin | front_desk`.
- Customer freeze is **already membership-only** (`PlanCard` — packages have no plan actions). ✅
- Customer freeze UI = `FreezePlanSheet` (duration + unit + hardcoded reasons — NO policy gating yet).
- Settings tabs = `src/config/settings-groups.ts`; the **Customer** group is where "Freeze policy" lands.

## Reused components (no new components)
`Toggle` (same local pattern as every settings page) · `SelectInput` (unit) · `NumericStringInput`
(numbers, "0"-placeholder rule) · `MultiSelectCard` (Apply-to → Specific memberships) · existing
segmented-tab pattern (One-time/Recurring, All/Specific) · inline blue info-banner style · `Button`
+ `showToast`. Page scaffold mirrors `BookingRulesPage`.

## Data model — `FreezePolicy` (one per branch)
```
branch_id
enabled                       // master toggle — gates the customer Freeze button
max_duration_enabled, max_duration_value, max_duration_unit ("days"|"weeks"|"months")
limit_freezes_enabled, max_freezes
fee_enabled, fee_type ("one_time"|"recurring"), fee_amount_aed
allow_exceptions              // ON → members must pick from the enabled reasons
reasons: { id, label, enabled }[]   // seeded: Medical condition or illness / Injury / Family emergency (+ custom)
apply_to ("all"|"specific"), membership_ids: string[]   // "specific" → only these memberships are freezable
```
Plan-side: add `freezeCount` to `CustomerPlan` (increment in `freezeCustomerPlan`) to enforce `max_freezes`.

## Phases
### Phase 1 — Data model + admin settings tab (ADDITIVE, no behaviour change)
- `FreezePolicy` type in `_types.ts`; `freeze_policy` seed (one per active branch, sensible defaults).
- Store: `freezePolicies` slice + adapter + `updateFreezePolicy(branchId, patch)`; persist **version bump**.
- `settings-groups.ts`: add `{ label: "Freeze policy", href: "/admin/settings/freeze-policy" }` to the Customer group.
- `/admin/settings/freeze-policy` page + `FreezePolicyPage` component — full form, per-branch scope,
  Submit → `updateFreezePolicy` + toast. RBAC follows Booking rules (Owner + Branch Admin).
- **Nothing else changes** — customer + admin freeze behave exactly as today.

### Phase 2 — Customer-side enforcement
- `FreezePlanSheet` + plan page read the policy for the membership's branch:
  - `enabled` false → Freeze button hidden/disabled on `PlanCard` (with a short note).
  - reasons list ← policy (enabled reasons + custom); required only when `allow_exceptions`.
  - duration clamped/validated to max (value + unit).
  - `max_freezes` enforced via the new `freezeCount`.
  - `apply_to: specific` → only listed memberships are freezable.
  - fee → **charge now**: create a fee transaction on confirm; sheet shows the amount first.

### Phase 3 — QA + release note
- Verify admin override untouched, customer gating correct, cross-tab sync, financials reflect the fee,
  `tsc` + build green. Admin release note.

**Status:** Phase 0 (this doc) done 2026-07-14. Building Phase 1 next.
