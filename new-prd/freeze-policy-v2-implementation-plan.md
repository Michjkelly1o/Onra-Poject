# Freeze Policy v2 — Implementation Plan

**Status:** Phase 0 — Awaiting client answers on 8 ambiguities
**Owner surface:** Admin settings (Booking Rules → Freeze policy) + Customer profile plan freeze sheet + booking flow guardrails
**Snapshot tag:** `pre-freeze-policy-v2`
**Client feedback source:** 2026-07-20 message + Figma screenshots (Billing during a freeze / Who can freeze / Limits / Freeze reasons)

---

## Why this document exists

The freeze policy shipped in v1 as a single-panel admin settings page
that governs three things: enable/disable, freeze fee, and a flat
list of reasons customers can pick from. Client feedback expands
that into a fully-featured membership-freeze workflow with billing
semantics, role-based approval, per-reason exceptions, and
cross-module guardrails on booking + notifications.

This is NOT a UI tweak. It touches 8 surfaces:

  1. Admin freeze policy panel UI (biggest visible change)
  2. Store schema + actions (persist bump)
  3. Customer freeze sheet UI
  4. Customer plan page (CTA gate + eligibility)
  5. Booking flow — 6–8 code sites across customer + admin
  6. Notifications module (2 new event types)
  7. Billing engine (Option A shift vs Option B prorate)
  8. Admin customer detail (approval surface)

The rest of this document is the phase-by-phase plan for landing all
of it without breaking the existing demo, plus the 8 open questions
the client needs to answer before we start Phase 1.

---

## Guiding principles

Same rules that governed the AI Agent integration ([new-prd/ai-agent-implementation-plan.md](./ai-agent-implementation-plan.md) — see § "Guiding architecture principles"):

1. **Every phase is a valid commit.** You can stop after any phase and the app still works — the feature is partially wired but nothing existing breaks.
2. **Additive schema changes only.** New fields on `FreezePolicy` + `FreezeReason` default to their v1-equivalent behavior. Existing seeded rows migrate silently on persist bump.
3. **Rename with migration.** `allow_exceptions` becomes `require_reason` (semantic equivalent). Migrate on load — no data loss for existing testers.
4. **Cross-module changes stay minimal per file.** Booking guardrails touch ~6–8 files, each with a 2–4 line addition (`if plan is frozen: reject`). No refactors.
5. **Notification events piggyback on the existing customer-notifications table.** Register them the same way payment / booking events already work — no new dispatch layer.
6. **Billing math stays in the mock/demo path.** Option A (shift renewal) vs Option B (prorate next charge) is implemented as two branches of the same `computeNextCharge` helper. Real billing engine wiring is out of scope.

---

## Open questions (Phase 0 blockers)

I need answers on these 8 before Phase 1 starts. Each one affects
what the code has to do.

1. **"Per calendar year" (client message) vs "per rolling 12 months" (Figma image)** — which wins? The Figma screenshot says "per rolling 12 months" on the Maximum freezes field; the client's written feedback says "per calendar year". These are different rules — calendar year resets Jan 1; rolling 12 months resets 12 months after each freeze.

2. **Auto-resume reminder cadence** — how many days before end? Figma doesn't show. Default proposal: 3 days (matches Payment reminder cadence in existing notification_settings).

3. **"Admins only" mode UX on the customer app** — hide the Freeze CTA entirely, or show it as "Contact your studio to freeze" (disabled with helper text)?

4. **"Members request, admins approve" workflow shape** — new plan status `freeze_requested`, OR a separate `freeze_requests` slice keyed by plan id? First is simpler (fewer stores, easier to derive UI state); second is more auditable (request history survives multiple freezes).

5. **"First billing cycle" definition** — window between `plan_created_at` and `first_billed_at`, OR a hardcoded window (e.g. first 30 days)? First is more accurate; second is simpler.

6. **"Payment failing" definition** — derived from last transaction status on the plan's customer, OR an explicit `payment_status: "failing"` flag on the plan itself? Deriving is DRY-er; flag is faster to check.

7. **Reason exceptions applied per member** — when a reason enables "ignores max duration", does the customer sheet show NO cap, or does the admin freeze form show the cap with an override checkbox? Figma reads as "no cap" for that reason on the member side.

8. **Persist bump migration strategy** — for existing seeded policies + existing frozen plans, do we:
   (a) Auto-migrate `allow_exceptions=true → require_reason=true` (semantic-equivalent rename) + default new fields to sensible defaults, keeping user progress, OR
   (b) Bump persist version (v76 → v77) forcing a full reseed on every tester's next reload, dropping their in-progress state?
   Approach (a) is nicer for tester continuity; (b) is simpler + guarantees everyone lands on the same v2 defaults.

---

## Phases

### Phase 0 — Pre-flight

**Purpose:** Confirm nothing is going to explode before we start.

- Answers to the 8 questions above (this doc gets updated with the answers)
- Snapshot tag `pre-freeze-policy-v2` (already created)
- Plan doc committed (this file)

**Exit check:** All 8 questions answered. Ready to start Phase 1.

**Deliverable:** Docs only. Zero code changes.

---

### Phase 1 — Schema + admin panel UI

**Purpose:** The biggest visible change — client can validate the whole admin design in one review before any customer-side work.

**What gets built:**

1. **Type extensions** on [FreezePolicy](../src/data/mock/_types.ts) + [FreezeReason](../src/data/mock/_types.ts):
   ```ts
   FreezePolicy:
     + billing_behavior: "pause" | "stay_on_schedule"   // Option A vs B
     + who_can_freeze: "members_and_admins" | "members_request_admins_approve" | "admins_only"
     + min_duration_value: number
     + min_duration_unit: "days" | "weeks" | "months"
     + max_freezes_period: "calendar_year" | "rolling_12m"  // depends on Q1
     ~ allow_exceptions → require_reason  (rename)

   FreezeReason:
     + exceptions?: {
         ignoresMaxDuration?:  boolean
         ignoresFreezeLimit?:  boolean
         waivesFee?:           boolean
       }
   ```

2. **Store actions** (additive — nothing removed):
   - `setFreezeBillingBehavior(mode)`
   - `setWhoCanFreeze(mode)`
   - `setMinDuration(value, unit)`
   - `setMaxFreezesPeriod(period)`
   - `setReasonExceptions(reasonId, patch)` — sets one/more of the three flag fields
   - `setRequireReason(on)` — new name for the old `setAllowExceptions`

3. **Persist bump + migration** (v76 → v77): existing rows get sensible defaults; `allow_exceptions` value carries into `require_reason` on load.

4. **Admin panel** ([FreezePolicyPanel.tsx](../src/components/settings/FreezePolicyPanel.tsx)):
   - **NEW section "Billing during a freeze"** — two big radio cards (Pauses / Stays on schedule) with the worked-example tables inline (Jul 1 / Aug 1 / Sep 1 style from the client screenshot)
   - **NEW section "Who can freeze"** — three radio cards (Members & admins / Members request, admins approve / Admins only)
   - **Limits section**: add a Minimum freeze duration numeric input; rename Maximum freezes label per Q1 answer
   - **Freeze reasons section**: rename "Allow exceptions" → "Require reason"; add per-reason exceptions expander ("3 exceptions ▾") with three toggles
   - Keep Fee section + Apply-to section as-is

**Files touched:** 4 (types, store, admin panel, persist bump comment).

**Exit check:** `yarn build` green. Admin can configure everything from the client feedback. Customer flow unchanged. Persist migration works — existing testers reload without losing state.

**Deliverable:** Client can review the entire admin surface in the browser.

---

### Phase 2 — Customer sheet + eligibility gates

**Purpose:** Wire the customer-side freeze surface to respect the new admin settings.

**What gets built:**

1. **[FreezePlanSheet.tsx](../src/components/customer/profile/FreezePlanSheet.tsx)** — replace duration+unit inputs with **start-date + end-date picker** (already have `DatePicker` from the DS). Compute `days` from the range.

2. **Client-side validation**:
   - "Cannot start in past" — start date must be ≥ today
   - Minimum duration — from the policy
   - Maximum duration — from the policy (unless reason has `ignoresMaxDuration`)
   - Reason picker gates on `require_reason` (renamed field)

3. **Billing behavior disclosure** — line in the sheet showing what will happen at next charge based on `billing_behavior`:
   - "Pauses" → "Your next charge shifts to <new_date>"
   - "Stays on schedule" → "Your next charge is reduced to AED <prorated>"

4. **[customer/profile/plan/page.tsx](../src/app/customer/profile/plan/page.tsx)** — Freeze CTA gate:
   - Hide entirely if `who_can_freeze === "admins_only"` (per Q3)
   - Show as "Freeze request" if `who_can_freeze === "members_request_admins_approve"`
   - Eligibility hide/disable (per Q5, Q6): trial, first billing cycle, payment failing

5. **Reason exceptions applied to the sheet** — when the member picks a reason with `ignoresMaxDuration`, the max-duration validation is bypassed for that submission (per Q7).

**Files touched:** ~2 files.

**Exit check:** `yarn build` green. Customer can freeze from the plan page when eligible; sees the correct disclosure per policy. Frozen plan can still be viewed on the admin side.

---

### Phase 3 — Booking guardrails (cross-module)

**Purpose:** "During a freeze they cannot book anything else" — enforce it EVERYWHERE.

**What gets built:**

Add a `plan.status === "frozen"` check at every booking entry point. Each site gets a 2–4 line addition rejecting the booking with a clear message.

Sites:
1. Customer class booking — `/customer/classes/[id]/book/page.tsx`
2. Customer appointment booking — `/customer/appointments/[id]/book/page.tsx`
3. Customer waitlist claim — `/components/customer/classes/WaitlistClaimSheet.tsx`
4. Admin walk-in booking on `/schedule/[classId]/page.tsx` (Front Desk flow)
5. Admin appointment booking on `/appointments/[id]/page.tsx`
6. POS class-credit redemption (if applicable — need to check whether POS reads plan status)

Rejection message: "Your membership is frozen — you can book again on <resume_date>." Consistent copy across all sites.

**Files touched:** ~6–8 files. Each edit is 2–4 lines.

**Exit check:** Frozen customer can't book anywhere in the app. Message is consistent + shows the resume date.

---

### Phase 4 — Auto-resume + notifications

**Purpose:** Freezes end automatically at the end date; both member + staff get notified.

**What gets built:**

1. **Auto-reactivate sweep** in [store.ts](../src/lib/store.ts)'s `onRehydrateStorage`: at hydrate time, any plan whose `freeze_end_iso ≤ today` and `status === "frozen"` flips back to `active`. Same pattern the existing `liveScheduleStatus` sweep uses for class instances.

2. **Two new notification events** registered in the [notification_settings seed](../src/data/mock/notification_settings.ts):
   - `freeze_reminder_customer` — customer notification, N days before `freeze_end_iso` (N from Q2). Channels: Email + WhatsApp + SMS toggles (same shape as class_reminder).
   - `freeze_started_admin` — staff notification (in-app notification bell — not customer-facing), fires when a member self-freezes.

3. **Trigger points** — the `startFreeze` action fires `freeze_started_admin` for staff; a scheduled tick (or hydrate check) queues `freeze_reminder_customer` when a plan's freeze is within N days of ending.

**Files touched:** ~4 files (store, notification_settings seed, dispatch trigger points).

**Exit check:** Manually shortcut a plan's `freeze_end_iso` to yesterday, reload, plan is active. Bell + customer notification appear for the two new events.

---

### Phase 5 — Approval flow + Option A/B billing semantics

**Purpose:** The two most complex behavior branches — request-approval + billing math.

**What gets built:**

1. **Approval flow** (only wires if `who_can_freeze === "members_request_admins_approve"`):
   - New plan state (per Q4): either `freeze_requested` OR separate `freeze_requests` slice
   - Customer sheet: "Confirm freeze" button becomes "Request freeze"
   - Admin surface on [CustomerDetailPage.tsx](../src/components/customers/CustomerDetailPage.tsx) → Plans tab: a chip on the plan card showing "Freeze requested — approve / reject", opens a modal with the requested date range + reason + Approve/Reject buttons
   - Approve → plan transitions to `frozen` with the requested dates; Reject → back to `active` with an optional note

2. **Option A vs B billing semantics** in [store.ts](../src/lib/store.ts):
   - `computeNextCharge(plan, freezeStart, freezeEnd, policy)` returns `{ newBillingDate, chargeAmountAed }`
   - Option A ("pause"): `newBillingDate = old + freezeLength`, `chargeAmountAed = plan.price` (unchanged)
   - Option B ("stay_on_schedule"): `newBillingDate = old (unchanged)`, `chargeAmountAed = plan.price - (frozenDays × dailyRate)`
   - Both branches update `plan.paidThroughISO` + `plan.nextBillingISO` when the freeze starts (Option A) or when the freeze ends (Option B)

**Files touched:** ~4 files.

**Exit check:** Request flow works end-to-end. Billing math produces the correct next-charge date + amount for each Option A/B scenario. Verify against the client's worked examples (Jul 1 → Sep 1 flows shown in the screenshot).

---

### Phase 6 — Verify + regression sweep

**Purpose:** Smoke test across all admin roles + customer, plus regression on the existing demo.

**Test matrix:**

| Persona            | Who can freeze scope | Test |
|--------------------|----------------------|------|
| Owner              | Any mode             | Full config + freeze from customer detail |
| Branch Admin       | Any mode             | Same, scoped to their branch |
| Operator           | Any mode             | Freeze/unfreeze from customer detail |
| Front Desk         | Any mode             | Freeze on behalf of walk-in |
| Instructor         | N/A                  | No freeze surface at all |
| Customer (Members & admins) | direct freeze | Pick date range, confirm, verify Option A/B disclosure |
| Customer (Request)          | request/approve | Submit request, admin approves, plan freezes |
| Customer (Admins only)      | no CTA           | Freeze action hidden or "Contact your studio" |
| Customer with trial         | eligibility gate | Freeze CTA hidden or disabled with helper |

**Regression:** Existing freeze demo (Sarah's plan, others) still works end-to-end.

**Deliverable:** A short "Phase 1 done" note (like the AI Agent one) summarising what shipped, what's deferred (if anything), and how the client should demo.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Existing plans break on persist bump | Phase 1 migrates `allow_exceptions → require_reason` semantically; new fields get defaults. Bump is v76→v77. |
| Booking guardrails miss a code site | Phase 3 checklist grepped upfront; each site edit is small + reviewed. |
| Option A vs B math is wrong | Verified against client's worked examples in the screenshot. |
| Trial / first-billing definitions drift | Q5, Q6 answers pin the definitions before we code them. |
| Notification cadence wrong for freeze reminder | Q2 answer pins it. |

---

## Estimated total effort

- **Phase 0** — 30 min (docs only)
- **Phase 1** — 2 hours (client-visible foundation)
- **Phase 2** — 1.5 hours
- **Phase 3** — 1.5 hours
- **Phase 4** — 1.5 hours
- **Phase 5** — 2 hours (heaviest — approval + billing math)
- **Phase 6** — 45 min

**Total:** ~9–10 hours of focused work, splittable into 2–3 client review cycles.

---

## Pre-Phase-1 checklist

1. This plan doc committed (Phase 0 delivery).
2. Snapshot tag `pre-freeze-policy-v2` created (done).
3. Client answers the 8 open questions above.
4. Say "go" to start Phase 1.
