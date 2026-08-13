# Marketing — status & production work (dev handoff)

**Verdict — real and store-wired.** The Marketing module (Campaigns + Announcements + Promotions) renders live from `marketingItems` / `marketingCampaignStats`, every CRUD action persists through the store, targeting resolves against live customers/plans/branches, and the customer-facing surfaces (What's-on banner, notifications "Updates" tab, promos) read the same live slices. No stubs, no fake rows, no dead actions.

The main "not real" aspect is that a campaign **send is simulated** — no email/SMS/WhatsApp actually goes out. That delivery gap is documented in [`notifications-delivery.md`](notifications-delivery.md); this doc covers the marketing-specific pieces.

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
