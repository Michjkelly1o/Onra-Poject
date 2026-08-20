# Marketing — status & production work (dev handoff)

**Verdict — real and store-wired.** The Marketing module (Campaigns + Announcements + Promotions) renders live from `marketingItems` / `marketingCampaignStats`, every CRUD action persists through the store, targeting resolves against live customers/plans/branches, and the customer-facing surfaces (What's-on banner, notifications "Updates" tab, promos) read the same live slices. No stubs, no fake rows, no dead actions.

The main "not real" aspect is that a campaign **send is simulated** — no email/SMS/WhatsApp actually goes out. That delivery gap is documented in [`notifications-delivery.md`](notifications-delivery.md); this doc covers the marketing-specific pieces.

---

## 2026-08 — Marketing spend moved onto campaigns + referral (READ THIS)

The client retired the standalone **Marketing Spend** module as a data-entry
surface. Spend is now captured where the money is committed and feeds the
**Acquisition Efficiency** report from there. What changed and what a real dev
should know:

**Where spend comes from now**
- **Campaigns carry a `budget_aed`** (new field on `MarketingItem`, set on the
  campaign create/edit form, shown on the campaign detail). Each campaign's
  budget is **split across the channels it actually sent on, weighted by message
  volume** (`marketingCampaignStats.sends` per channel) — a channel that sent 0
  messages (turned off) gets 0 spend.
- **Referral** contributes `referralSettings.monthlyProgramBudgetAed` as a
  "Referral" spend row, per active month, studio-wide (`branch_id: ""`).
- The channel taxonomy for spend is the **campaign send-channels** — **Email /
  WhatsApp / SMS** — **plus Referral**, NOT the lead-lifecycle acquisition sources
  (Instagram/Google/Walk-in/…). Those are dropped from the report because they
  carry no spend. WhatsApp and Referral overlap the lead sources, so those two
  rows show both spend AND new leads (CPL/CAC compute); Email/SMS are spend-only.

**Single source of truth (all surfaces reconcile)**
- `selectMarketingSpend(state)` in [`src/lib/reports/selectors.ts`](../src/lib/reports/selectors.ts)
  is the ONE derivation (campaigns split-by-volume + referral). `marketingSpendLedgerRows(state)`
  maps it back to the legacy `{month, spend_aed, branch_id}` shape for older
  consumers.
- Consumers wired to it: the **Acquisition Efficiency** report
  ([`src/app/reports/acquisition-efficiency/page.tsx`](../src/app/reports/acquisition-efficiency/page.tsx),
  a custom page), **Insights → Marketing tab** ([`src/lib/kpi/marketing.ts`](../src/lib/kpi/marketing.ts)),
  the **Dashboard** `kpi-marketing-efficiency` widget + performance CSV export,
  and the **AI agent** `marketing_spend` dataset reader. Every spend / CPL / CAC /
  ROAS figure now reconciles to one source.
- The report keeps the client's exact columns; ratio columns use `groupCalc` so a
  grouped/pivoted row divides SUMMED components (correct even when referral's
  studio-wide spend and per-branch leads arrive on separate source rows).

**Module hidden, not deleted**
- `/admin/marketing/spend` is removed from the sidebar and 404'd via
  `DISABLED_ROUTE_PREFIXES`. The page still compiles.

**What a real dev must harden here**
- The **old `marketing_spend` seed + module are now dead** for the report path
  (only the hidden module page still reads the ledger). In production, either
  remove the ledger table entirely or repurpose it — don't leave two spend
  sources.
- The **channel-volume split depends on `marketingCampaignStats.sends`, which is
  simulated** (see §1 below). Real per-channel sends come from the delivery
  providers; until then the split is only as real as the seeded/simulated send
  counts.
- **Referral spend attribution is coarse** — one studio-wide monthly figure
  emitted per active month with `branch_id: ""`. A real model would attribute
  referral cost per branch / per actual reward issued.
- **CPL/CAC meaning:** campaigns target *existing* members, so "new leads/members"
  only meaningfully fills for the channels that overlap lead sources (WhatsApp,
  Referral). Confirm with the client whether campaign efficiency should measure
  new-acquisition or attributed bookings/revenue before hardening the metric.

---

## Fixed during this audit
- **Delete now respects "never sent."** The delete guard was `view_count === 0`, so a *sent* campaign with zero views was deletable (contradicting PRD 08). Now a sent campaign is archive-only (store guard + list + detail affordances), scoped to campaigns so announcements are unaffected. Verified headless.
- **Send-from-edit now records analytics.** Editing a draft/scheduled campaign to "Send" only wrote `delivery_status:"sent"` — the `marketingCampaignStats` write-path lived solely in `addMarketingItem`, so an edit-send showed 0 sent/open/click. `updateMarketingItem` now records the send stats (same real consent-gated reach) on the draft→sent transition, once. Verified (0 → 3 channel rows, sends = real reach).
- **Edit no longer clobbers `created_at`** (it was overwritten with "now" on every save) and **edit now restores the campaign's Content type** (`topic` was omitted from the edit form's initial values, forcing re-selection).
- **Engagement panel hidden for non-sent items** (drafts/scheduled/announcements no longer show a misleading "Sent 0 / 0% / 0%"), and a misleading dispatch header comment (claimed "no opt-in / topic gate" — it does gate) was corrected.

---

## Remaining for a real dev

### 1. Campaign engagement (opens / clicks) is simulated — MEDIUM
The **sent** count is real (consent-gated audience reach). But opens/clicks are **deterministic hardcoded multipliers** — `opens_reads = round(sends * 0.45)`, `clicks_taps = round(sends * 0.08)` (`src/lib/store.ts` marketing send path), with `attributed_bookings`/`attributed_revenue` seeded 0. So every freshly-sent campaign shows ~45% open / ~8% click.
**Build:** real engagement comes from the delivery providers — email opens (tracking pixel / provider webhooks), click redirects, WhatsApp read receipts — feeding `marketingCampaignStats`, plus booking/revenue attribution over the attribution window. Depends on the provider integrations in [`notifications-delivery.md`](notifications-delivery.md) / [`integrations.md`](integrations.md).

### 2. "What's on" banner isn't consent-gated — LOW (design decision)
The customer notifications feed and the simulated reach both apply the dual consent gate (marketing topic opt-in + channel opt-in). The passive **home "What's on" banner** does **not** — it filters only type/status/branch/expiry (`src/lib/customer/home-data.ts`), so a member opted out of marketing still sees campaigns on the banner.
**Decide:** if the banner is a passive in-app storefront, ungated is defensible (opt-out governs *pushed* messages, not browsing). If it must honor the marketing opt-out, add the same `viewerReceives…` gate the feed uses. Left as a product decision, not changed.

### 3. Duplicate-campaign action not built — LOW
There is no "Duplicate" action anywhere in the marketing module. If the PRD expects one (create-from-existing), it's an unbuilt gap.

### 4. Minor
- Seed `mkt_aerial_yoga` has `action_type:"book_event"` but no `cta_class_id` (`src/data/mock/marketing_items.ts`), so its detail "Booked class" field silently drops — cosmetic seed inconsistency.

---

## Priority
1. Real engagement (opens/clicks/attribution) once the delivery providers exist (§1) — arrives with the notifications/integration work.
2. Decide the banner consent behavior (§2); add a Duplicate action if the PRD wants it (§3).
