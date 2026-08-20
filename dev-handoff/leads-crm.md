# Leads & CRM (Lead Lifecycle) — status & production work (dev handoff)

**Verdict — real and store-wired.** The lead/CRM funnel runs live off customer
data + the `leads` slice. Like Bookings, the key thing to understand is where it
lives:

> **There is no separate admin "Leads" list module.** Leads are modelled two ways,
> and both are real:
> 1. **Customers in the funnel** — every customer carries a **lifecycle tag** and
>    **follow-up status**; the admin customer list's segment tabs + lifecycle
>    filter *are* the CRM view.
> 2. **The `leads` slice** ([`leads.ts`](../src/data/mock/leads.ts)) — a lead
>    pipeline dataset (source + stage) that feeds the **lead reports** and the
>    **marketing KPIs**.

---

## The two-layer lifecycle model

Each customer carries two orthogonal fields (see `Customer` in
[`src/lib/store.ts`](../src/lib/store.ts)):

- **`lifecycleTag`** — the AI-owned funnel stage: **Lead → Trialist → New Active →
  Loyal Active → At Risk → Churned → Won-back** (missing = "Lead" fallback).
  Auto-derived; `lifecycleTaggedOn` records when it last changed.
- **`followUpStatus`** — the **human-owned** follow-up state (the studio's own
  pipeline stages, editable in Settings).
- **VIP** — an orthogonal flag that stacks on top of the lifecycle tag.

The two layers are deliberately separate: the AI classifies the funnel; staff own
the follow-up. Don't collapse them.

---

## Where it surfaces in the UI

| Surface | Route | What |
|---|---|---|
| **Customer list — segment tabs** | `/admin/customers` | Wallet-based **Members / Leads / Inactive** partition (`customerSegment`), with a **lifecycle-tag filter** stacked on top (Lead / Trialist / …) — [`customer-management.md`](customer-management.md) |
| **Customer detail — Follow-ups tab** | `/customers/[id]` | CRM follow-up notes/tasks + the follow-up status pill |
| **Customer detail — Details tab** | `/customers/[id]` | Source field + Follow-up status dropdown |
| **Settings → Customer → Lead lifecycle** | `/admin/settings/lead-lifecycle` | The two studio-editable lists (below) |
| **Reports** | `/reports/lead-conversion`, `/reports/lead-data` | Lead funnel conversion + raw lead data — [`reports-and-insights.md`](reports-and-insights.md) |
| **Insights → Marketing tab** | `/admin/insights` | New leads, leads-by-source, funnel conversions ([`src/lib/kpi/marketing.ts`](../src/lib/kpi/marketing.ts)) |

---

## Settings → Lead lifecycle (the config)

[`/admin/settings/lead-lifecycle`](../src/app/admin/settings/lead-lifecycle/page.tsx)
holds two editable lists that drive the funnel everywhere:

1. **Customer sources** — the source dropdown pool. Feeds `Customer.sourceId`, the
   Add-Lead intake, and the Details-tab Source field.
2. **Follow-up stages** — the values behind the Details-tab Follow-up status
   dropdown + the header pill.

**2026-08 alignment (important):** the Customer source names were aligned so
**leads, marketing spend channels, and reports all use the same vocabulary**
(Walk-in, Referral, Instagram, Google, Website, WhatsApp, Web form, Meta lead
form, ClassPass, Gympass, Expired customer, Other). This is why the Acquisition
Efficiency report's WhatsApp / Referral rows join spend to leads correctly —
the source label is the join key. **If you rename a source, keep it consistent
across the `leads` data, the customer source list, and the spend channels**, or
the report joins break. See [`marketing.md`](marketing.md).

---

## What's real

- Lifecycle tags + follow-up status persist and drive the customer list segments +
  filters, the detail pills, and the lead reports/KPIs — all off live data.
- Sources + follow-up stages are studio-editable and flow to every consumer.

## What a real dev must build / harden

- **`lifecycleTag` is derived/seeded, not a live ML model.** The "AI-owned"
  classification is a heuristic in the prototype — a production build would recompute
  it from real behaviour (visits, purchases, recency) on a schedule.
- **Lead intake / conversion** — "Add lead" and lead→customer conversion exist as
  data, but a full lead-capture pipeline (web forms, Meta lead ads, ClassPass /
  Gympass feeds) is integration work ([`integrations.md`](integrations.md)).
- **Follow-up tasks aren't scheduled/notified** — follow-ups are notes today; real
  reminders need the notification service ([`notifications-delivery.md`](notifications-delivery.md)).
- **Two lead representations** (the `leads` slice vs. customers-in-funnel) should be
  reconciled into one model when the backend is built, so there's a single lead →
  customer lifecycle rather than a separate pipeline dataset.

## Cross-module

Leads feed **Reports/Insights** (conversion, by-source, marketing KPIs), the
**Customer** module (the funnel view), and **Marketing** (targeting the "Lead"
segment + the spend/CPL join).
