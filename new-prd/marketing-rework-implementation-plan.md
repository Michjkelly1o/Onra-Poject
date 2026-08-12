# Marketing Rework — Implementation Plan

**Source:** client feedback (2026-08-12) redefining the Marketing area by *intent*.
**Goal:** three crisp Marketing concepts + move Events to Schedule, with real,
connected, consent-gated data flow and full reuse of existing components + the
new brand tokens.

> Status: **Phase 0 (plan) — awaiting approval to build.** Phases 1→4 below.
> Per the repo convention, each phase is a self-contained, buildable step
> (never break routes; verify `tsc` + full `next build` per phase).

---

## 1. The model (client's words)

| Menu | Intent | Essence | Action? | Revenue? |
|---|---|---|---|---|
| **Campaigns** | something to **send** | a message to a **chosen segment** of customers | yes (optional CTA) | no direct revenue |
| **Promotions** | something to **discount** | a price mechanic on a product + validity window | the discount | yes |
| **Announcements** | something to **say** | information + a show-until date — banner + push | **no action** | **no revenue** |
| ~~Events~~ | something to **book** | date + capacity → **lives in Schedule, not Marketing** | — | — |

**Locked decisions**
- Events: **remove** from Marketing + **delete** the 3 seeded event banners. (Bookable events already exist in Schedule; "Yoga pack, this week only" is a Promotion, already covered by promo seeds.)
- Announcements: **information-only** — no CTA, no revenue, single **show-until** date, keep **branch** scope, no customer-segment targeting, **push on publish**.
- Campaigns: **option (b)** — rebuild as "send a message to a chosen segment": segment picker + message + optional CTA + send-now/schedule + push. **Push-only** (campaigns leave the in-app "What's on" banner feed; the banner is the Announcement's job).
- Promotions + Referrals: **unchanged**.

---

## 2. Design + brand constraints (apply to every phase)

- **Reuse, don't reinvent.** Compose the existing `src/components/marketing/form-kit.tsx` primitives (stepper, FormCard, Section, inputs, ToggleCard, MultiSelectCard, BranchSingleSelect, live preview), the card-grid list pattern, and the `DetailPageShell`. New elements go through `ui/patterns` / `ui/` — never inline a duplicate (component-centralization rule).
- **New brand color.** New UI must use the semantic brand tokens (`var(--colors-secondary-*)`, `--colors-text-*`, `--colors-border-*`) so it inherits the current brand (Rich blue green). **Audit the marketing files for hardcoded hex** left from earlier phases (`#f5fffa`, `#10373a`, `#164e52`, `#94aeaf`, `#eff6f3`, `#667085`, …) and map each to a token.
- **Conventions:** `<Button>` component + `border-1`; create/edit = full-page routes, state changes = confirm modals; every action emits a toast; form dropdowns in scrollable cards use `FixedDropdown`; internal detail links set `?returnTo={usePathname()}`; list toolbars keep **Import immediately after Filter**; numeric inputs use the "0" placeholder rule; no `<hr>` dropdown separators; bordered view-cards keep a min-height.

---

## 3. Data model changes

Single `marketingItems` slice retained (minimal churn, unified consumers), with
`type` narrowed and type-specific fields added.

**`MarketingItem.type`:** `"campaign" | "announcement"` — drop `new_class` +
`event`. (Migrate seed `new_class` → `campaign`; delete `event` rows.)

**Shared fields (unchanged):** `id`, `title`, `short_description` (message),
`cover_image_url`, `branch_ids`, `multi_location`, `status`
(active/inactive/archived), `created_at`, analytics counters.

**Announcement-specific**
- `show_until` (single date) — reuse `expiry_date` as show-until; **no** start/duration, **no** `action_type`/`ticket_price`/`cta_class_id`/`external_url`, **no** `customer_targeting`.
- Consent topic = `studio_announcements` (fixed).

**Campaign-specific (new)**
- `audience`: `{ kind: "everyone" | "membership" | "segment" | "specific" | "branch"; membershipIds?: string[]; segments?: ("lead"|"member"|"inactive")[]; customerIds?: string[] }` (branch handled by existing `branch_ids`).
- `delivery_status`: `"draft" | "scheduled" | "sent"`.
- `scheduled_at?`, `sent_at?`.
- `cta`: `{ kind: "book_class" | "link" | "none"; classScheduleId?; url? }` (reuses existing `cta_class_id` / `external_url`).
- `topic`: `"new_class_launch" | "special_offers" | "promo_code_offers"` (drives the consent gate).
- Stats: a `marketingCampaignStats` row is **created on send** (`sent` = delivered count), keyed by the campaign id (today stats are seed-only + decoupled).

**Persist:** bump the store `version` (breaking shape change) → discards old
payload, re-seeds. Document the standard "persisted testers re-seed" caveat.

---

## 4. Cross-module dispatch (the load-bearing new logic)

A single shared helper `dispatchMarketing(item, state)` used by both **campaign
send** and **announcement publish**:

1. **Resolve recipients** from the audience/branch:
   - `everyone` → all non-archived customers in scope.
   - `membership` → customers whose active plan matches `membershipIds`.
   - `segment` → `customerSegment()` ∈ chosen segments (Lead/Member/Inactive) — reuse the existing engine.
   - `specific` → `customerIds`.
   - always intersect with `branch_ids` (or all branches).
2. **Consent gate** (per [[Customer marketing preferences v28]]): keep a
   recipient only if they opted into **the channel** (`marketingChannelPush`)
   **AND the topic** (`marketingTopic*` matching the item's topic). A message is
   delivered only when BOTH are true.
3. **Deliver**: create one customer `Notification` per kept recipient
   (`customerId`, a `marketing` tab/event, deep-link to `/customer/marketing/[id]`)
   → surfaces in the existing customer bell + push toast + notification rows.
4. **Record**: campaigns → write a `marketingCampaignStats` row
   (`sent` = delivered count; open/click simulated deterministically like the
   promo derive). Announcements → no stats (no revenue/conversion), just the
   delivered count for the toast.

**Notification model:** add `"customer"` to `NotificationAudience` (or confirm
the customer bell already filters by `customerId`; wire accordingly). Add a
`marketing` notification event + icon.

**Scale guard:** for demo realism without creating thousands of rows, cap
materialized notification rows (e.g. first N recipients) but report the **true
delivered count** in the stat + toast; `log`/comment the cap (no silent
truncation).

---

## 5. Phases

### Phase 1 — Remove Events (small)
- Delete `src/app/admin/marketing/events/**`, `src/app/events/**`, `src/components/marketing/EventFormPage.tsx`.
- Remove `"event"` from `form-kit` types + `ACTIONS_BY_TYPE`; remove the Events nav item (Sidebar), the Header title, the breadcrumbs entries, and the feature-flag line.
- Delete the 3 `event` seed rows (`mkt_appreciation_night`, `mkt_yoga_pack`, `mkt_new_year`) from `marketing_items.ts`.
- Verify: Campaigns list still renders; customer "What's on" no longer references events; `tsc` + build clean.

### Phase 2 — Announcements → information-only (small)
- **Form** (`AnnouncementFormPage`): drop the Link-or-action section entirely; single **"Show until"** date (replace start/end window); keep banner + title + message + **branch** scope; remove customer-targeting. Add a **Topic** = Studio announcement (fixed, shown read-only).
- **Publish** → call `dispatchMarketing` (consent-gated push) + success toast ("Sent to N customers").
- **Customer side:** announcement renders as a banner **without any CTA button**; also lands in the notification bell/toast. Detail page: strip action/ticket/link rows; show message + show-until + branch.
- Verify: no CTA anywhere; no revenue/conversion counters surfaced; consent gate respected.

### Phase 3 — Campaigns → "send to a segment" (medium)
- **3a — Data model:** reshape per §3 (type `campaign`, audience, delivery_status, scheduled_at/sent_at, cta, topic). Persist bump. Migrate `new_class` seeds → `campaign` with `audience.kind="everyone"`, `delivery_status="sent"`, back-dated `sent_at`.
- **3b — Audience/segment picker:** new step/section — Everyone · by membership type · by segment (Lead/Member/Inactive) · specific customers · branch — with a live **"Will reach N customers"** count (after the consent gate). Reuses `customerSegment` + `MultiSelectCard`.
- **3c — Send lifecycle:** **Draft / Scheduled / Sent** status; footer action **"Send now" / "Schedule"** (datetime); list gains **tabs (All · Sent · Scheduled · Drafts)** + sent-count + sent/scheduled date. Scheduled items flip to Sent at/after `scheduled_at` on load (prototype simulation; documented).
- **3d — Dispatch on send:** `dispatchMarketing` → consent-gated customer notifications + a `marketingCampaignStats` row. **Remove `type==="campaign"` from the customer "What's on" banner feed** (push-only).
- **3e — Detail analytics + CTA:** detail page shows **Sent / Open rate / Click rate** (from the stats row) + the CTA (Book a class → Schedule link / external link / none).
- **3f — Verify cross-module:** Campaign Performance report, Insights → Marketing tab, and the campaign dashboard widgets now reflect **real sends**; customer bell shows the push; segment counts match; no money/promo/referral impact.

### Phase 4 — Verify + ship
- Full `tsc` + clean `rm -rf .next && next build` (catch prerender).
- Brand-token audit sweep on all touched marketing files.
- Update the admin **release note**; update memory ([[project_marketing_split]] → supersede with the new 3-concept model).

---

## 6. Cross-module connection map (after rework)

| When this happens | It affects |
|---|---|
| Campaign **sent** | customer notification bell/toast (opted-in recipients) · `marketingCampaignStats` row → Campaign Performance report + Insights Marketing tab + Dashboard campaign widgets |
| Announcement **published** | customer "What's on" banner (no CTA) · customer notification bell/toast (opted-in) |
| Audience = membership/segment | reads `customers` + `customerSegment` + `memberships` (read-only) |
| Campaign CTA = Book a class | deep-links to a Schedule class (read-only FK) |
| Customer edits marketing prefs (8 fields) | changes who `dispatchMarketing` delivers to |
| Event (bookable) | Schedule only — no Marketing surface |

**Untouched by design:** POS / checkout / recognized-revenue engine (marketing
carries no revenue), Promotions (promo codes), Referrals.

---

## 7. Risks & caveats
- **Persisted demo state** re-seeds on the version bump; testers lose in-session edits (standard).
- **Notification volume**: cap materialized rows, report the true delivered count (no silent truncation).
- **`NotificationAudience`** may need a `"customer"` member — confirm against the existing customer bell filter before wiring.
- **Reversal**: Phase 1 removes the Events module committed in `feb032e9`; that history stays, we delete forward.
- **"What's on" change**: campaigns leaving the banner feed is a visible customer-home change — intended, but call it out in the release note.
