# Onra — Customer & Lead Management implementation plan

Companion to [`Onra_Customer_Lead_Management.pdf`](./Onra_Customer_Lead_Management.pdf).

Client 2026-07-24 — hybrid model where **AI owns detection and the default state; staff own the action and the override.** One person record, two label layers on top, signal → task engine as the differentiator. Boutique-first, built so a bigger club can turn on depth later without a rebuild.

---

## Governing rules (apply to every phase)

- Every UI element must use an existing component / pattern (see [Component reuse](#component-reuse--locked-list)). If a pattern doesn't exist, stop and confirm before inventing one.
- Every store change is additive (new optional fields, new slices). Existing shapes never mutate.
- Persist version bumps only when a slice shape changes; the migration runs once and is idempotent.
- Every phase ends with `tsc --noEmit` + `yarn build` clean AND the existing Customers / Bookings / Marketing / KPI screens still render correctly with no change to their behaviour.
- No new admin page route added. Everything surfaces on the existing `/admin/customers/*`, `/admin/dashboard`, and `/admin/settings/*` routes.
- Kanban view is out of scope (client's ask).
- Phase 7 triggers (signup abandoned, app-downloaded-no-booking) are documented, **NOT built** — they wait until the infrastructure they need exists.

---

## Phase 1 — Data foundation (no UI change)

**Goal:** get the `Customer` record + `followUpTasks` slice + `leadSources` slice + `followUpStages` slice in place, absorb the existing `leads` slice into `customers`, and wire the AI recompute hook. Nothing visible changes yet.

**Store changes (`src/lib/store.ts`):**
- Extend `Customer` interface with 5 optional fields:
  - `lifecycleTag?: LifecycleTag` — `"Lead" | "Trialist" | "New Active" | "Loyal Active" | "At Risk" | "Churned" | "Won-back"`
  - `isVip?: boolean` — orthogonal VIP flag
  - `followUpStatus?: FollowUpStatus` — `"New" | "Contacted" | "Trial booked" | "Follow-up" | "Won" | "Lost"`
  - `assignedTo?: staffId`
  - `sourceId?: leadSourceId`
- New slice `followUpTasks: FollowUpTask[]`
- New slice `leadSources: LeadSource[]` seeded with 10 defaults (Walk-in, Referral, Instagram/Social, Website/Online, Web form, Meta lead form, ClassPass, Gympass, Expired customer, Other)
- New slice `followUpStages: FollowUpStage[]` seeded with 6 defaults (New, Contacted, Trial booked, Follow-up, Won, Lost) — with `Won` + `Lost` flagged as system-mandatory

**Migration (persist middleware):**
- Bump persist version 82 → 83.
- Migration: for every row in the old `leads` array, upsert into `customers` with `lifecycleTag: "Lead"` + carry over source. Drop the `leads` slice. One-time, idempotent, guarded by version check.

**Lifecycle compute (new file `src/lib/customer/lifecycle.ts`):**
- `computeLifecycleTag(customer, state): { tag, isVip, reasons: string[], updatedAt }` — see [Lifecycle rules](#lifecycle-rules) below.
- Cheap: filters over `classBookings`, `customerPlans`, `customerTransactions` for that one customer. No batch job.

**Recompute hook (in existing Zustand actions):**
- After every mutation that touches a customer's behavior — `addBooking`, `cancelBooking`, `markAttendance`, `addCustomerPlan`, `addCustomerTransaction`, `addClassRating` — call `computeLifecycleTag(customerId, state)` for that one customer and store the result on the customer record.
- No new event system, no interval timers — piggybacks on the same action pattern the store already uses.

**Verify:** `tsc + yarn build` clean; open every existing customer / bookings / marketing / KPI page and confirm nothing changed visually or functionally. This is the safest-but-highest-impact phase; done well, everything downstream is easy.

---

## Phase 2 — Lifecycle tag visible on the Customer surface

**Goal:** show the AI-generated tag everywhere the customer appears.

**Components reused:**
- Existing pill/badge pattern from `Booking Status` and `Class Status`. New `<LifecycleTagPill>` = a variant of the same component, not a new one.
- Existing `IconTooltip` component (Dashboard tiles) for the hover reason.
- Existing side-panel/drawer pattern (customer profile side panels) for the reasoning drawer.
- Existing sticky tab strip pattern (Insights) for the Customers list segment tabs.

**UI touchpoints:**
- **Customer profile header** — lifecycle tag pill next to name; extra "VIP" pill next to it when `isVip: true`.
- **Customers list** — new "Lifecycle" column showing the pill.
- **Hover on the pill** — one-line tooltip: `"Tagged At Risk on 2026-07-22 · no attendance in 18 days"`.
- **Click the pill** — reasoning drawer opens: current tag + full transition history + the specific reasons behind the current tag.
- **Customers list segment tabs** — replace/augment existing status filter with tabs: **All · Leads · Members · Inactive**. Uses the same tab strip component as Insights.

**Verify:** existing customer profile bookings/plans/transactions/notes tabs unchanged; existing customer list search + branch filter still work.

---

## Phase 3 — Follow-up status + assignment field

**Goal:** the human-owned Layer 2 layer becomes editable, and every customer gets an assignment field.

**Components reused:**
- Same pill component as Phase 2 for the follow-up status pill (different color palette).
- Existing `SelectInput` for both the follow-up status dropdown AND the "Assigned to" dropdown.
- Existing toast (`showToast`) for the state-change confirmation.

**UI touchpoints:**
- **Customer profile header** — a second pill under the lifecycle tag showing follow-up status, but ONLY visible when `lifecycleTag === "Lead"` or `"Trialist"` (pre-conversion scoping enforced in the render).
- **Customer profile details block** — new "Assigned to" dropdown (all staff).
- **Customer profile details block** — new "Source" field (readonly, shows the source that was set at intake).
- **Customers list** — optional "Assigned to" column (hidden by default; user toggles it on).
- **Customers list toolbar** — new "Assigned to me" filter chip (reuses the existing filter-chip pattern).

**Precedence rule wired here:**
- If a staff sets `followUpStatus = "Lost"`, the task engine (Phase 4) will NOT resurface this customer.
- If a "Lost" customer books a class, behavior wins: the recompute hook re-activates them into the lifecycle, and the task engine can resurface again. Rule lives in `computeLifecycleTag`.

**Verify:** the pill only renders on Lead/Trialist customers. Setting a Loyal Active member's follow-up status is impossible (dropdown hidden).

---

## Phase 4 — Signal → task engine (Phase 1 triggers)

**Goal:** the differentiator. 4 triggers auto-create tasks; staff act; outcomes log.

**Components reused:**
- Existing modal pattern for confirmation actions (Reached / Not interested).
- Existing toast for outcome-logged confirmations.
- Existing filter chip + kebab menu patterns from customer list for task-row actions.

**Data (from Phase 1's `followUpTasks` slice):**
- Task shape: `{ id, customerId, triggerKind, reason, assigneeId, status, outcome?, createdAt, closedAt? }`.

**Task generation rules (attached to existing store actions — no new event bus):**

| Trigger | When it fires | Task copy |
|---|---|---|
| **Enquiry logged** | Staff clicks "Log enquiry" on customer profile (button added in Phase 5) | "New enquiry from `{name}` — follow up." |
| **Lead form submitted** | Whenever a customer with no history is created via a lead-add form | "New lead from `{source}` — reach out." |
| **Trial attended, no rebook in 7 days** | Recompute hook checks: intro plan attended, no non-cancelled booking in the 7 days since. Runs on every `addBooking` / `cancelBooking` — cheap filter on that customer only. | "`{name}` did a trial and hasn't returned — win them onto a plan." |
| **First booking cancelled, never rebooked** | Recompute hook checks: first booking was cancelled AND no subsequent booking exists. Runs on `cancelBooking`. | "`{name}` cancelled their first class and went quiet." |

**Time-based logic:** the 7-day and "no attendance in 14 days" checks piggyback on `computeLifecycleTag` which runs on every write — so the check is opportunistic (fires when something else happens on that customer). No cron, no interval. Good enough for a demo; matches the "recompute live" decision.

**Precedence enforced in task generator:**
- Skip task creation if `customer.followUpStatus === "Lost"`.
- Skip if an open task with the same `triggerKind` already exists for that customer.

**Verify:** on a fresh demo state, seed a customer whose trial was 8 days ago with no rebook → open a class page → immediately see the task materialize (via Phase 5's widget once we build it).

---

## Phase 5 — Dashboard widget + customer profile Follow-ups tab

**Goal:** surface the tasks generated in Phase 4.

**Components reused:**
- Existing `WIDGET_CATALOG` + `DashboardWidgetCard` system. New widget = new catalog entry, no changes to the widget shell.
- Existing customer profile tab strip. Adding a new tab is one array entry.
- Existing `<Button>`, `<Badge>`, list row patterns.

**Dashboard widget:**
- New `WIDGET_CATALOG` entry: `id: "leads-to-follow-up"`, `title: "Leads to follow up"`, `category: "Customer"`.
- Widget body: ranked list of open tasks. Rank = `(customer LTV × freshness × trigger weight)`. Freshness decays over time so stale tasks fall off.
- Row shows: customer name, tag pill, task reason, "Assigned to" avatar, age.
- Row click → navigate to customer profile Follow-ups tab.
- Info tooltip on the widget (uses the same `IconTooltip` as every other widget): "Auto-detected leads that need staff action, ranked by value and freshness."

**Customer profile "Follow-ups" tab (new):**
- List of open + closed tasks for this customer.
- Each open task shows: reason + created date + assigned staff + 3 outcome buttons — **Reached / Follow-up / Not interested**.
- Clicking an outcome:
  - **Reached** → task closes with `outcome: "reached"`, follow-up status advances (New → Contacted, etc.)
  - **Follow-up** → task closes with `outcome: "follow-up"`, follow-up status stays; a fresh task with a longer delay may re-materialize later.
  - **Not interested** → task closes with `outcome: "not-interested"`, follow-up status → "Lost", suppression kicks in.
- **"Log enquiry" button** at the top of the tab — creates a manual task (fires trigger #3).
- Activity log below the open tasks: chronological outcomes + notes.

**Verify:** widget shows tasks that match the profile's Follow-ups tab; outcomes logged in one place appear in the other.

---

## Phase 6 — Configurable sources + stages in Settings

**Goal:** studio-editable lead sources + follow-up stages, per PDF §4.

**Components reused:**
- Existing settings tab strip (Business / Operations / Customer group).
- Existing list-with-add-edit-remove pattern (class categories, tax rates, agreements).
- Existing full-page create/edit form pattern.
- Existing confirmation modals.
- Existing toast on save.

**UI touchpoints:**
- **Settings → Customer → Customer sources (new sub-tab):** list of lead sources with add/rename/remove. System-seeded ones marked with a lock icon so they can be renamed but not deleted.
- **Settings → Customer → Follow-up stages (new sub-tab):** list of stages with add/rename/remove. `Won` + `Lost` locked (system-mandatory). Max 8 stages (guardrail from PDF §4.2 "keep it tight").

**Downstream:**
- The existing "Member acquisition source" widget/report (PRD §6.3) already exists — this phase makes its data come from a live studio-editable list instead of a hardcoded enum. That's the only touch to existing analytics.

**Verify:** deleting a stage that's in use is blocked with a message; renaming propagates to every customer's follow-up status pill.

---

## Phase 7 — Deferred triggers (DOCUMENTED, not built)

Waiting on infrastructure we don't have yet. Design notes captured here so a future dev knows they're planned, not forgotten:

- **Trigger 5 — signup started, not verified/completed** — needs a partial-signup persistence layer. Build waits until we have a real signup funnel.
- **Trigger 6 — app downloaded, no booking in 48h** — needs an app-install event stream. Build waits until we have a real customer app instrumented.

No commit, no code, no half-wired state.

---

## Lifecycle rules

| Tag | Rule | Notes |
|---|---|---|
| **Lead** | No plan ever, no attended booking | Fallback |
| **Trialist** | Only plan(s) are `isFirstPlan === true`; no non-intro paid plan | |
| **New Active** | Has a non-intro paid plan, `purchasedAtISO` within last 30 days | |
| **Loyal Active** | Has active non-intro plan > 30 days AND ≥ 4 attended bookings in last 30 days | |
| **At Risk** | Has active plan AND (no attendance in 14 days OR cancellation rate in last 14 days > 50% OR avg rating dropped ≥ 1 star) | |
| **Churned** | No active plan AND no visit in 30+ days | |
| **Won-back** | Currently active plan AND previously had an expired plan. Sticky 30 days, then collapses to New Active or Loyal Active | |
| **VIP** *(orthogonal)* | Lifetime value in top 10% of studio's customers OR manual flag. Stacks on primary tag. | Not a stage — a separate pill |

**Precedence within Layer 1:** Churned > At Risk > Won-back (for 30 days) > New Active > Loyal Active > Trialist > Lead.

**Precedence between layers (per PDF §2.3):** AI default → human override (`Lost` suppresses) → behavior override (a "Lost" customer who books re-activates automatically).

---

## Component reuse — locked list

| Where I need something | Existing component I'll reuse |
|---|---|
| Status pills (lifecycle tag, follow-up status, VIP badge) | Existing Badge/Pill from booking/class status |
| Tab strip | Sticky tab strip pattern from Insights (identical component) |
| Filter chips | Existing filter chip pattern on customers list |
| Dropdowns (assigned to, follow-up status) | `SelectInput` |
| Info tooltip on tag hover | `IconTooltip` (same as Dashboard tiles) |
| Reasoning drawer (why this tag) | Existing customer profile side panel/drawer pattern |
| Confirmation actions on task outcomes | Existing centered confirmation modal |
| Toast on any state change | `showToast()` |
| Dashboard "Leads to follow up" widget | `WIDGET_CATALOG` entry + `DashboardWidgetCard` shell |
| Settings sub-tabs | Existing settings tab strip |
| List-with-add-edit-remove in Settings | Existing pattern (matches class categories, tax rates) |

**No new UI primitives are invented.** If a case comes up where a reuse doesn't fit, stop and confirm with the client before adding a new one.

---

## Safety recap

- 6 build phases + 1 documented-future phase.
- Each build phase ends with a build + a visual sanity check that nothing existing broke.
- Zero routes added. Zero existing pages rewritten.
- All new fields are optional; persist migration is one-time and idempotent.
- The `leads` slice absorption happens ONCE at persist-version bump — after that, only `customers` exists.
- Every trigger runs on existing write actions — no new event system, no cron, no background workers.
- Every UI element traces back to a component we already have.

---

## Coverage check

**Client's typed comment:**
- ✅ Layer 1 = AI-owned lifecycle_tag with 7 stages (Lead → Trialist → New Active → Loyal → At Risk → Churned → Won-back).
- ✅ Layer 2 = human-owned Follow-up status, pre-conversion only, Kenko-style (New → Contacted → Trial booked → Follow-up → Won / Not interested).

**PDF sections:**
- ✅ §1 Summary — the "AI detects, staff decide" wedge is the heart of what we're building.
- ✅ §2 Core model — one record, two layers (§2.1 Layer 1, §2.2 Layer 2, §2.3 precedence).
- ✅ §3 Signal → task engine (§3.1 full 5-step flow, §3.2 all 6 triggers — 4 in Phase 4, 2 in Phase 7).
- ✅ §4 Configurable sources + stages (§4.1 studio-editable lead sources, §4.2 configurable follow-up stages with tight defaults).
- ✅ §5 Where it lives (§5.1 leads inside Customers list + segment tabs, §5.2 customer record shape).
- ✅ §6 Scale to clubs (§6.1 configurable stages, non-hardcoded plan model, assignment field, generic trigger engine).

**Deferred (not skipped):**
- **VIP tag** — IN scope (client confirmed 2026-07-24: "just ship VIP too since it's under the PDF").
- **Kanban view** — SKIPPED per client's ask ("lets not implement the kanban for now").
- **Phase 2 triggers (signup abandoned + app-download-no-booking)** — deferred to Phase 7 pending infrastructure.
