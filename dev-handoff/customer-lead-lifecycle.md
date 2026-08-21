# Customer Lead Lifecycle — the model, logic & flow (dev handoff)

> How a person moves from **lead → trialist → active member → at-risk / churned →
> won-back**, how each stage is decided, and how the human follow-up pipeline sits
> on top of it.
>
> This is the **logic & flow** doc. For the CRM surfaces (where it renders), the
> production build-out, and Settings → Lead Lifecycle config, see
> [`leads-crm.md`](leads-crm.md). The Leads/Lead-Conversion **reports** are in
> [`reports-and-insights.md`](reports-and-insights.md); the customer-list
> Lead/Member/Inactive tabs are in [`customer-management.md`](customer-management.md).
> Source-of-truth plan: `new-prd/customer-lead-management-implementation-plan.md`.

---

## Three classifications that overlap — don't confuse them

There are **three** separate ways a customer is labelled. They answer different questions and are computed differently:

| Classification | Values | Owner | Where it's used | Source |
|---|---|---|---|---|
| **Wallet segment** | Lead · Member · Inactive | computed (wallet) | the customer-list **tabs** | [`src/lib/customer/segment.ts`](../src/lib/customer/segment.ts) |
| **Lifecycle tag** | Lead · Trialist · New Active · Loyal Active · At Risk · Churned · Won-back (+ VIP) | **AI/auto** (computed) | the lifecycle **pill** on the customer card/profile, dashboards | [`src/lib/customer/lifecycle.ts`](../src/lib/customer/lifecycle.ts) |
| **Follow-up status** | New · Contacted · Trial booked · Follow-up · Won · Lost | **human** (staff) | the pre-conversion **pipeline** on Lead/Trialist customers | store `followUpStatus` |

The **hybrid two-layer model** (client 2026-07-24, v83): the **AI owns the lifecycle tag** (Layer 1) and **humans own the follow-up status** (Layer 2). Both live on the `Customer` row (`lifecycleTag`, `followUpStatus`, `isVip`, `lifecycleTaggedOn`), all optional so pre-v83 rows hydrate cleanly.

> Note: the wallet **segment** ("Lead") and the lifecycle **tag** ("Lead") share a word but aren't the same thing — the segment is a pure wallet partition for the list tabs; the tag is the behavioural stage. A person can be segment=Lead and tag=Trialist at the same time (bought an intro/comp plan but never paid).

---

## Layer 1 — the lifecycle tag (AI-owned)

`computeLifecycleTag(customer, slices)` runs **after every customer-touching write** (booking, cancel, attendance, plan purchase, transaction, rating), filters the store for that **one** customer, applies a precedence table, and stamps the new `lifecycleTag` (+ `isVip` + `reasons`) on the row. It's intentionally **dumb + pure**: no cron, no batch, no intervals — it piggy-backs on writes the store already does (same pattern as `reconcileCreditsRemaining`). The caller applies the returned patch.

**Precedence (first match wins):** `Churned > At Risk > Won-back > New Active > Loyal Active > Trialist > Lead`

| Tag | Condition (from `lifecycle.ts`) | Meaning |
|---|---|---|
| **Churned** | no usable plan **AND** > 30 days since last visit | lapsed; the money's gone, they've stopped coming |
| **At Risk** | usable plan **AND** (≥ 14 days since last visit **OR** > 50% cancel rate in last 14 days) | paying but disengaging — the intervention window |
| **Won-back** | paid before, holds an expired plan, **AND** bought a fresh plan < 30 days ago (after a lapse) | reactivated; a sticky 30-day celebratory state |
| **New Active** | paid for a plan < 30 days ago | freshly converted / freshly renewed |
| **Loyal Active** | paid plan **AND** attended ≥ 4 classes in the last 30 days | engaged, high-frequency member |
| **Trialist** | holds intro / complimentary plan(s) but **no paid plan yet** | trying the studio, not yet converted |
| **Lead** | no plan **and** no attended booking on record | brand-new contact, hasn't done anything yet |

Each result carries an ordered **`reasons[]`** array (e.g. "Attended 6 classes in the last 30 days on a paid plan.") — surfaced on the pill hover / reasoning drawer.

**VIP** (`isVip`) is an **orthogonal** flag that stacks on top of any tag (auto-computed) — a "Loyal Active" can also be VIP.

---

## Layer 2 — the follow-up status (human-owned)

`followUpStatus` is the **staff-driven pre-conversion pipeline**. It's **only rendered when `lifecycleTag ∈ { Lead, Trialist }`** — once someone converts (New Active and beyond), the follow-up pipeline is hidden (they're a member now, not a prospect).

**Stages:** `New → Contacted → Trial booked → Follow-up → Won / Lost`. These are **studio-editable** in Settings → Lead Lifecycle (`followUpStages`) — renaming a stage cascades to every customer's status.

### Follow-up tasks (the work queue)
A `FollowUpTask` is a to-do that tells staff *who to chase and why*. It's created by triggers and closed with an outcome:

- **Triggers** (`FollowUpTaskTrigger`): `enquiry_logged`, `lead_form_submitted`, `trial_no_rebook_7d` (a trialist didn't rebook within 7 days), `first_booking_cancelled`.
- **Outcomes** (staff-picked when closing): `reached`, `follow_up` (delay a fresh task), `not_interested`. Precedence rule: `not_interested` → sets follow-up status to **Lost**. There's also a system outcome for "no answer" that keeps the Activity log honest (nobody actually reached them).

These drive the Dashboard "Leads to follow up" widget and the customer-profile Follow-ups tab.

---

## The flow (a person's journey)

```
        (enquiry / lead form)                    (buys intro/comp)            (buys a paid plan)
new contact ───────────────► LEAD ──────────────────────► TRIALIST ──────────────────► NEW ACTIVE
   │  followUpStatus: New → Contacted → Trial booked → Follow-up          │ (attends 4+/30d)
   │                                                                       ▼
   │                                                                   LOYAL ACTIVE
   │                                                                       │ (14d no visit / high cancels)
   └────────► LOST (not interested)                                        ▼
                                                                        AT RISK
                                                                           │ (30d+ no visit, plan gone)
                                                                           ▼
                                            (buys fresh plan <30d) ◄──── CHURNED
                                                    │
                                                    ▼
                                                WON-BACK ──(30d)──► New/Loyal Active
```

- **Lead → Trialist:** the moment they hold an intro/complimentary plan (segment can still be Lead until they *pay*).
- **Trialist → New Active:** their first **paid** plan. Follow-up pipeline disappears.
- **New Active → Loyal Active:** sustained attendance (≥4 classes/30d).
- **Active → At Risk → Churned:** disengagement, then lapse. The At Risk window is the intervention opportunity; Churned is post-lapse.
- **Churned → Won-back:** a fresh purchase after the lapse; sticky for 30 days, then it flows back to New/Loyal Active on the next recompute.

---

## The `leads` funnel report vs. the lifecycle (keep separate)

Distinct from the per-customer lifecycle above, there's a `leads` slice + the **Leads** report — a marketing funnel with its own stage enum (`new · contacted · trial-booked · trial-attended · paid · lost`). The Leads report's "Lead stage" column maps that enum onto the editable follow-up-stage vocabulary (New / Contacted / Trial booked / Follow-up / Won / Lost) so the report reads like the studio's pipeline. See [`reports-and-insights.md`](reports-and-insights.md).

---

## Key files

| File | Role |
|---|---|
| [`src/lib/customer/lifecycle.ts`](../src/lib/customer/lifecycle.ts) | `computeLifecycleTag` — the AI tag precedence + reasons |
| [`src/lib/customer/segment.ts`](../src/lib/customer/segment.ts) | wallet segment (Lead/Member/Inactive) for the list tabs |
| [`src/lib/store.ts`](../src/lib/store.ts) | `LifecycleTag` / `FollowUpStatus` / `FollowUpTaskTrigger` types, `followUpStages`, `leads` slice, the recompute hook on write actions, follow-up task actions |
| `src/app/admin/settings/lead-lifecycle/page.tsx` | Settings → Lead Lifecycle (editable follow-up stages + lead sources) |
| `src/components/customers/*` · `src/components/dashboard/LeadsToFollowUpBody.tsx` | the pill, Follow-ups tab, "Leads to follow up" widget |

## Prototype notes
- The tag compute is **client-side + synchronous** on each write; there is no server, no scheduled re-scan. A production build would run it server-side (event-driven or a nightly sweep for the time-based transitions like At Risk / Churned that no write would otherwise trigger).
- `followUpStatus` + follow-up tasks are real, persisted state; the "reach out" itself never sends anything (see [`notifications-delivery.md`](notifications-delivery.md)).
