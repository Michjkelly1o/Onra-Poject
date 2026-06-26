# Brief — Customer Profile Settings Module (`/member/profile`)

Implementation brief for the customer-side **Profile settings** hub of the Onra Studio member app — the big settings landing with sub-sections/sub-pages. Built on Next.js 14 (App Router), Tailwind, Zustand + Supabase, mock-data-driven. It is implementation-focused and assumes the builder has the existing DS components, the member layout shell, and the seeded mock data already in place.

Profile settings is one of the five customer tabs (Home · Search class · Bookings · Products · **Profile settings**). It owns notification **settings**, referral/invite, payment-method management, and all account/preference surfaces. The notification **center** panel (bell + list) lives in **Home**; **purchasing/checkout** lives in **Products**.

---

## 1. Purpose & Scope

The Profile settings tab is the member's **account & settings hub** — the self-service mirror of the admin customer Details/Payments tabs (PRD 07), rendered from the member's side over the *same* underlying records. It is the fifth and final bottom-nav destination (`/member/profile`); its nav icon renders the member's own avatar photo. It is a **settings landing** with a sub-page per section.

**In scope — the 11 sub-sections:**

1. **Profile details** *(EDITABLE)* — name, photo, phone, DOB, gender, address. Writes `customers`. Validation mirrors admin add/edit-customer (PRD 07 §4.1).
2. **Credit balance / current plan** *(READ view + one toggle)* — current membership status (active / expiring / frozen / cancelled / expired) + package credit balances; **auto-renew toggle** (writes `customer_plans` — ⚠️ additive field, see §4); **Renew / Upgrade** CTA → Products. Freeze/cancel are admin-only (display only).
3. **Integrations** *(e.g. calendar sync)* — mirrors the `instructor_integrations` pattern. ⚠️ **No customer-integration seed exists** — additive, see §4.
4. **Notification settings** — channels + marketing opt-in/out + per-category push (transactional cannot be fully disabled); honored with `notification_settings`.
5. **Payment settings** — saved payment methods add/remove (`payment_methods`), **shared with admin POS** (single source of truth); removing a card mid-checkout blocked.
6. **Emergency contact** *(EDITABLE)* → writes `customers`.
7. **Timezone** *(EDITABLE preference)* — ⚠️ **no `timezone` field on `customers` today** — additive, see §4.
8. **Promo code / voucher** — enter a code to apply/store a voucher; view applied vouchers. Grounded against `promo_codes`; ⚠️ **no per-customer applied-voucher store exists** — additive, see §4.
9. **Gift card (owned)** — view the member's `issued_gift_cards` (code, current balance, expiry, status); redemption happens in **Products** checkout (cross-ref, not here).
10. **Invite member / referral** — referral code/link to share (copy → toast), count of successful referrals, rewards earned, monthly cap, "Monthly referral limit reached"; program-disabled (`referral_settings.program_active === false`) hides the surface; show **successfully-referred** people only (`customer_referrals`). *(Streak/milestone metrics belong to Home — cross-ref only.)*
11. **Account settings** — change email (current-password confirm), change password; **sign out / logout** (clears session).

**Also in scope:** **Activity history** (read-only) and the **editable vs non-editable matrix** (§6). An **entry point to view accepted agreements** (`customer_agreements` → `agreement_versions`).

**Cross-ref (owned elsewhere, linked from here):** booking management → Bookings tab; membership/package detail + **checkout/purchasing** → Products tab; **notification CENTER (bell panel)** → Home; **streaks/milestones/achievements** → Home (Achievement Highlight + stat tiles). This module links into these; it does not re-implement them.

**Non-goals:** no admin overrides ever (no refunds, no freeze/unfreeze, no complimentary grants, no capacity/window overrides, no role-gated deletes, no referral-rule config). No real payment gateway — cards are simulated. No seed regeneration.

---

## 2. References

- **PRD 13 — Customer Experience** (parent): §3 (mobile-only platform), §5.5 (Profile nav destination), §9 (membership/package plan-viewing), §11 (referral/invite + rewards + cap), §12 (notification settings — channels, transactional vs marketing), §13 (states), §14 (edge cases), §15 (cross-module contracts), §16 (Profile Experience — primary spec).
- **PRD 07 — Customer Management** §4.1 (create/edit field set + validation — member edits mirror these records), §6.1–6.2 (personal info + emergency contact), §9.1 (payment methods — shared card-on-file), §15 (referrals tab — **successful referrals only** display rule).
- **PRD 11 — Settings** §11 (`referral_settings`: program toggle, referred/referrer rewards, trigger, monthly cap, copy), §12 (`notification_settings` — studio-level channel config / push gate).
- **PRD 12 — Notifications & Account Settings** (style reference for change-email / change-password flows: current-password confirm, eye-toggle on password inputs, toast-after-success).
- **Merged drafts** (this file overwrites the first; substance from the other two folded in):
  - `Brief-for-customer-profile-module.md` (overwritten by this file).
  - `Brief-for-customer-notifications-module.md` — **notification-SETTINGS portion only** (gating, channels, marketing opt-out) folded into §3.4. The bell/center panel itself is Home's, not here.
  - `Brief-for-customer-loyalty-module.md` — **referral / invite-member portion** (code/link, successful-referral list, rewards, monthly cap) folded into §3.10. Streak/milestone metrics cross-ref Home.

---

## 3. Screens & Layout (the 11 sub-sections)

All screens render inside the member shell: centred `max-w-[400px] mx-auto`, **no decorative phone frame**, designed and tested at **375px** base (360px must not break). Bottom nav (Home · Search · Bookings · Products · Profile) visible on the Profile **landing**; **hidden** on full-page edit/account flows (focused tasks). Every screen uses existing DS components (`Button`, `Input`, `Select`, `Switch`, `Avatar`, `Badge`, `Card`, `Toast`, modal/sheet primitives, `Skeleton`). Currency always `AED [amount]`. The Profile tab nav icon is the member's own avatar (falls back to `user-01`).

### 3.0 Profile settings landing (`/member/profile`)
Vertically scrolling composition, top to bottom:

1. **Profile header card** — member avatar (large), full name, email, phone, "Member since [join date]", status badge (Active / Suspended / Archived — **read-only**). A single **Edit** affordance → Profile details (§3.1).
2. **Plan summary strip** (read-only, entry point) — current membership (name + status) and package credit total; tapping → Credit balance / plan (§3.2). Empty → "No active plan — browse products" CTA → `/member/products`.
3. **Menu list rows** (DS list-row pattern: leading icon, label, chevron-right, ≥44px tap targets):
   - **Profile details** → `/member/profile/personal` (§3.1)
   - **Credit balance & plan** → `/member/profile/plan` (§3.2)
   - **Integrations** → `/member/profile/integrations` (§3.3) ⚠️ additive
   - **Notification settings** → `/member/profile/notifications` (§3.4)
   - **Payment settings** → `/member/profile/payment-methods` (§3.5)
   - **Emergency contact** → `/member/profile/emergency` (§3.6) *(may be a card within §3.1; see note)*
   - **Timezone** → `/member/profile/timezone` (§3.7) ⚠️ additive
   - **Promo code / vouchers** → `/member/profile/vouchers` (§3.8) ⚠️ additive store
   - **Gift cards** → `/member/profile/gift-cards` (§3.9)
   - **Invite a friend / Referrals** → `/member/profile/referrals` (§3.10) *(hidden when program disabled)*
   - **Account settings** → `/member/profile/account` (§3.11)
   - **Activity history** → `/member/profile/activity` (§3.12)
   - **Agreements** → `/member/profile/agreements` (§3.13)
4. **Sign out** — destructive-styled list row / button at the bottom (also reachable in §3.11).

The whole landing is read-self-only. Header status badge and "Member since" are **non-editable** (§6).

### 3.1 Profile details (`/member/profile/personal`) — full-page form
Full-page screen (CLAUDE.md convention #2: data entry is a full-page route, not a modal). Bottom nav hidden; back affordance in header. Sections mirror PRD 07 §4.1 / §6:

- **Profile photo** — Avatar + "Change photo" (upload → Supabase Storage; prototype stores the object URL on `customers.image_url`). Falls back to initials avatar (`customers.initials`).
- **Personal** — First name + Last name (both required, map to `customers.first_name` / `last_name`); Phone (required; same phone-input component as admin add-customer → `customers.phone`); Date of birth (optional date picker → `date_of_birth`); Gender (Select: Male / Female / Non-binary / Prefer not to say — optional → `gender`).
- **Address** — Street address, City, State, Postal code, Country (Select) — all optional, map to `street_address` / `city` / `state` / `postal_code` / `country`. Mirror exactly what the admin form exposes; do not invent fields beyond PRD 07 §4.1.
- **Emergency contact** *(may live here as a card, or as its own §3.6 route — pick one, do not duplicate)* — name, relationship, phone, email (`emergency_contact_name` / `_relation` / `_phone` / `_email`). All optional; when name is filled, phone becomes **required** (mirror admin rule). Empty → "Add emergency contact" affordance reveals the fields.
- Sticky **Save** (`<Button variant="primary">`) + **Cancel**. Save validates (§5.6), writes `customers` via the store, toasts "Profile updated", returns to landing.

**Non-editable, not rendered as inputs here:** email (managed in Account settings §3.11), customer id, owning branch, account status, plan/credit/wallet balances, admin notes.

### 3.2 Credit balance & current plan (`/member/profile/plan`) — read view + auto-renew toggle
Read-only summary of the member's plan state (mirrors admin customer Plans tab from the member side; reads `customer_plans` joined to `memberships` / `packages`):

- **Membership card** — the member's **single** active membership (one-membership rule, PRD 07 #1): name, coverage (categories / credits), billing cycle, price, start date, renewal/expiry date, and a **status badge**:
  - **Active** — within valid period.
  - **Expiring soon** — within the reminder window before end date → banner.
  - **Frozen** — paused by studio; shows freeze start/end + recomputed expiry. Member cannot book against it; **member cannot self-freeze** (display only).
  - **Cancelled** — retains access until effective end if "cancel at end of period."
  - **Expired** — past end date; in history with a Renew CTA.
- **Auto-renew toggle** — `Switch` on the active membership. Writes the member-facing auto-renew flag. ⚠️ **Additive:** `customer_plans` rows carry **no `auto_renew` column** today (only the `Membership` **product** type has `auto_renew?`). Specify a new `customer_plans.auto_renew?: boolean` per-plan field (append-only) — surface and confirm before any seed/type change. Toggling writes via the store and mirrors to the admin profile; toast "Auto-renew turned on/off."
- **Package balances** — each active package card: name, **credits remaining / total**, credits used, purchase date, expiry, frozen state if applicable, covered categories. Multiple packages listed; show consumption order (soonest-expiring eligible first) so the member knows which credits go next.
- **Freeze / cancel are admin-only** — shown as state/badges, never as member actions.
- **Renew / Upgrade CTA** → routes to **Products** checkout (purchasing is Products' job, not here). Buying a membership while one is active routes to the upgrade/replace path (PRD 13 §9.7), never a second membership.
- Home's "Remaining credits" stat (PRD 13 §6.4) is the live sum across active, non-expired, non-frozen packages — same store, same render cycle.

### 3.3 Integrations (`/member/profile/integrations`) ⚠️ ADDITIVE
Calendar-sync style integration list, mirroring the `instructor_integrations` card pattern (Connect button → modal → connected state + toast). For the member this would be e.g. "Sync my booked classes to Google / Apple Calendar."

⚠️ **No customer-integration seed exists.** The `integrations` seed is **studio-level** (Google Calendar, Apple Calendar, Google Analytics, WhatsApp Business — all `not_connected`); `instructor_integrations` is **per-instructor** (`staff_profile_id`). Neither is keyed to a `customer_id`. **Additive:** introduce a `customer_integrations` seed/type `{ id, customer_id, slug, status, connected_at?, account_label? }` mirroring `instructor_integrations` (append-only). **Surface and confirm before adding any seed.** Until then, this section may render a disabled "Coming soon" card or be feature-flagged off — do not fabricate a seed.

### 3.4 Notification settings (`/member/profile/notifications`)
*(Merged from the notifications-module draft — the SETTINGS portion only. The bell/center panel itself lives in Home.)*

- **Marketing opt-in/out** — single `Switch`. Off → no marketing notifications/pushes are produced (PRD 13 §12.4). Maps to the member's marketing flag on `customers` (`marketing_emails` / `marketing_sms` exist as channel flags; expose a single member-facing "Marketing" toggle, or per-channel toggles mirroring those two columns).
- **Per-category push** — a `Switch` per category (booking, payment, package/membership, referral, marketing), honored together with the studio-level `notification_settings` (PRD 11 §12). **Transactional categories (booking, payment, package/membership, refund, reminder) cannot be fully disabled** — the in-app `notifications` record always persists; the member may mute **push** only. Render transactional push toggles as toggleable with a helper note "You'll always see these in the app"; never offer a control that suppresses the in-app record.
- **Gating contract (consumed by Home's notification center + the event-emitting source modules):** a notification is produced when permitted by **both** the studio's `notification_settings` for that event **and**, for marketing only, the member's marketing opt-in. Transactional events ignore the member flag for the in-app record (push only is gated). This screen **writes** the member preference; it does not fire or render notifications.
- Each toggle change writes immediately (optimistic) and toasts "Preferences updated"; reverts + error toast on failure.

### 3.5 Payment settings (`/member/profile/payment-methods`)
- **List** of saved cards (`payment_methods`): brand, •••• last4, exp MM/YY, a "Default" badge on the default card. Each row: **Remove** action and optional **Set as default** (when ≥2 cards).
- **Add card** — `<Button variant="primary">` "Add payment method" → full-page / bottom-sheet **simulated** card form (cardholder name, number, exp, CVC — stores a dummy brand/last4 record). On submit: writes a `payment_methods` row, toast "Card added", returns to list.
- **Remove** — confirmation **modal** (state-change = modal, convention #3): "Remove this card?" Cancel + destructive Confirm → deletes the `payment_methods` row, toast "Card removed". **Blocked mid-checkout** (§5.4): if the card is selected in an in-progress member checkout (Products) or referenced by an in-flight auto-renew → "This card is in use at checkout. Finish checkout to remove it." and keep the card.
- **Empty state:** "Add a card to check out faster." + Add CTA.
- **Shared single source of truth:** these rows are the **same** records the admin POS card picker sees for this customer (PRD 05/07). Adding/removing here mirrors instantly to admin; vice-versa. ⚠️ **Note:** the `payment_methods` seed is currently **demo-global** (2 cards, **no `customer_id` FK** — seed comment says "this table gains a `customer_id` FK" when the payments module ships). For per-customer saved cards the additive `customer_id` column is required — surface and confirm; until then treat the shared two-card set as the demo source.

### 3.6 Emergency contact (`/member/profile/emergency`) — EDITABLE
Editable card writing `customers` emergency-contact fields (`emergency_contact_name` / `_relation` / `_phone` / `_email`). Same validation rule as §3.1 (phone required once name filled). **Note:** to avoid duplicate surfaces, implement this **either** as its own route **or** as the card inside §3.1 — not both. Empty → "No emergency contact on file." + "Add emergency contact."

### 3.7 Timezone (`/member/profile/timezone`) — EDITABLE preference ⚠️ ADDITIVE
A `Select` of timezones; the member's preferred timezone, used for day-bucketing of stats/streaks and class-time display.

⚠️ **No `timezone` field exists on `customers` today** (only `branches` carries a `+later: timezone` placeholder). **Additive:** introduce `customers.timezone?: string` (append-only) — surface and confirm before any type/seed change. Until then this section is feature-flagged off or falls back to the studio/branch timezone read-only. Do not fabricate a column.

### 3.8 Promo code / vouchers (`/member/profile/vouchers`) ⚠️ ADDITIVE STORE
- **Apply a code** — `Input` + "Apply" `Button`. Validates against `promo_codes` (PRD 06): status active, within `valid_from`/`valid_until`, `customer_targeting` matches, `per_customer_limit` not exceeded. Valid → store/attach the voucher to the member; invalid → inline reason ("Expired", "Not valid for you", "Code not found", "Usage limit reached").
- **Applied vouchers list** — vouchers the member has stored, each showing code, discount, and validity; usable later at **Products** checkout's promo field (cross-ref, redemption happens there).
- ⚠️ **No per-customer applied-voucher store exists.** `promo_codes` is the global discount catalog (grounded), but there is **no table mapping a customer → stored/applied vouchers**. **Additive:** introduce a `customer_vouchers` seed/type `{ id, customer_id, promo_code_id, applied_at, status }` (append-only) — surface and confirm before any seed change. Until then, "Apply" may validate-and-toast only (no persistence), or the section is feature-flagged off. Do not fabricate a store.

### 3.9 Gift cards owned (`/member/profile/gift-cards`) — read
- **List** of the member's `issued_gift_cards` (filtered by `customer_id`): masked/full `code`, `current_balance_aed`, `expires_at`, `status` (active / redeemed / expired), and the design name. All grounded in the seed.
- **Redemption happens in Products checkout** (PRD 13 §10.5) — cross-ref; this screen is **view-only**. No issue/spend action here (issuance is a POS/Products purchase; redemption is checkout).
- Empty → "No gift cards yet — buy one in Products." + CTA → `/member/products`.

### 3.10 Invite a friend / Referrals (`/member/profile/referrals`)
*(Merged from the loyalty-module draft — the referral/invite portion only. Streaks/milestones/achievements live on Home — cross-ref, not here.)*

- **Program-disabled guard (evaluated first):** if `referral_settings.program_active === false`, the **entire** Referrals view **and** its landing menu row are **hidden** (not a disabled row, not an empty shell).
- When enabled, top-to-bottom:
  1. **Hero / info block** — `referral_settings.info_description` copy ("Refer a friend and you both get 2 free credits!"). Reuse a `Card`.
  2. **Code + link block** — the member's referral code (`customers.referral_code`, e.g. `AHMEZA`) shown prominently + a shareable link. **Copy link** (primary) + **Copy code** (secondary) `Button`s → clipboard → toast ("Referral link copied" / "Referral code copied"). Optional simulated native-share sits alongside; copy is the guaranteed path.
  3. **Metrics row** — stat tiles: **Successful referrals** (count of `customer_referrals` for this member) and **Rewards earned** (cumulative credits/value). If the monthly cap is reached, render the inline banner **"Monthly referral limit reached"** here.
  4. **Successful referrals list** — **only** people who completed the qualifying action (`customer_referrals` rows): referred person's name + qualifying date + reward applied (e.g. "2 credits"). Pending/unqualified invitees are **never** shown (mirrors PRD 07 §15 + PRD 13 §11.5).
  5. **Empty (enabled, none yet):** list shows "You haven't referred anyone yet — share your link to start earning." Code/link + Copy buttons remain visible.
- **Rewards land elsewhere** (no screen here): class credit → `customer_plans` credit row (Products/Home credits); wallet credit → wallet balance (checkout); discount → applicable `promo_codes` (checkout promo field). This surface only displays counts/rewards-earned. *(Reward issuance + monthly-cap enforcement are driven by the qualifying-referral event, not by this screen.)*
- ⚠️ **Note:** `referral_settings` is a **global singleton** with `program_active`, `new_customer_credits`, `existing_customer_trigger` (seed = `purchase`), `existing_customer_credits`, copy — but carries **no explicit monthly-cap field** in the seed today. PRD 11 §11 references a monthly cap; if enforced, the cap value is additive to `referral_settings` (append-only) — surface and confirm. Until then, render the "limit reached" banner only when a cap is configured.

### 3.11 Account settings (`/member/profile/account`)
Reuses the structure/copy/component patterns of the admin account-settings flow (PRD 12), scoped to the member:

- **Change email** — modal: new email + **current password** confirm → (optional simulated verify step) → on success update auth email + `customers.email`, toast "Email updated". **Collision blocked** (§5.5): new email already on another account → inline "An account with this email already exists." (no write).
- **Change password** — modal: current + new + confirm. **Eye-toggle** show/hide on every password input (must work). Validate: new ≠ blank, confirm matches, strength rule. Success → toast "Password changed".
- **Sign out / logout** — confirmation modal "Sign out of your account?" → Confirm clears the Supabase session + member store state → redirect to `/member` login (PRD 13 §4.2).
- **Read-only identity block** — non-editable facts (customer id reference, owning branch name, account status) as static, clearly non-interactive rows for transparency (§6).

### 3.12 Activity history (`/member/profile/activity`) — read-only
Consolidated read-only summary (PRD 13 §16), four sub-sections, each linking to the owning module:
- **Attended classes** — `class_bookings` with `attendance_status === "present"` (class name, date, instructor) → tap to class/booking detail (Bookings tab).
- **Purchases** — `customer_transactions` (date, items, amount, status) → tap opens the receipt (Products §10.7).
- **Referrals** — successful `customer_referrals` (referred name + reward) → §3.10.
- **Achievements** — earned milestones/streak bests (derived; **owned by Home/loyalty logic**) → cross-ref Home Achievement list. *(This screen links out; it does not compute streaks/milestones — that derivation lives with Home.)*
Each sub-section has its own empty state (§11). **No edit actions** anywhere on this screen.

### 3.13 Agreements (`/member/profile/agreements`) — read-only
List of agreement versions the member has accepted (`customer_agreements` joined to `agreement_versions`): title, version, accepted date. Tap → view the accepted version's content (read-only). **No re-acceptance here** (acceptance is gated at booking time, PRD 13 §8.3 step 4). Empty → "No agreements on file."

---

## 4. Data Model

No new tables required for the **grounded** sections; the member surface is a new front end over existing seeds (PRD 13 §17 — seeds are **read-only**, never regenerated). All member writes go through the live Zustand store and persist via `onra-demo-state` localStorage — they are **not** seed edits. **Additive/flagged fields are clearly marked below — surface and confirm before any type/seed change (append-only per CLAUDE.md "Adding a new table").**

| Table (seed in `src/data/mock/`) | Access | Notes |
|---|---|---|
| `customers` | **READ + WRITE-via-store** | Profile details, emergency contact, photo (`image_url`), marketing flags (`marketing_emails` / `marketing_sms` / `transactional_emails`), `referral_code`. ⚠️ **No `timezone` field** (§3.7 additive). |
| `payment_methods` | **READ + WRITE-via-store** | Add/remove cards; shared with admin POS card picker (single source of truth). ⚠️ Seed is **demo-global — no `customer_id` FK yet** (§3.5 additive for per-customer cards). |
| `customer_plans` | **READ** (+ WRITE for auto-renew toggle) | Plan/credit view (§3.2). ⚠️ **No `auto_renew` column on `customer_plans`** today (only the `Membership` **product** type has `auto_renew?`) — §3.2 additive per-plan field. |
| `notification_settings` | **READ** (+ honor) | Studio-level per-event channel config; member marketing/push prefs gate against it (§3.4). Never edited from the member surface. |
| `issued_gift_cards` | **READ** | Member-owned gift cards by `customer_id` (`code`, `current_balance_aed`, `expires_at`, `status`) — grounded (§3.9). |
| `promo_codes` | **READ** | Voucher validation (§3.8) — grounded global catalog. |
| `customer_transactions` | **READ** | Purchases in activity history; link to receipts. |
| `customer_agreements` / `agreement_versions` | **READ** | Accepted-agreements list + version view (§3.13). |
| `customer_referrals` | **READ** | Successful-referrals list + counts (§3.10). |
| `referral_settings` | **READ** | Global singleton: `program_active`, `new_customer_credits`, `existing_customer_trigger`, `existing_customer_credits`, copy (§3.10). ⚠️ **No explicit monthly-cap field** in the seed (§3.10 additive if enforced). |
| `account_profile` (current-user pattern) | **READ/WRITE-via-store** | Member account identity (email/password/sign-out), parallels admin `updateAccountProfile`. |

### 4.1 Flagged additive / needs-confirmation fields & stores (consolidated)

| # | What | Grounding status | Additive shape (append-only, confirm first) |
|---|---|---|---|
| 1 | **Customer integrations** (§3.3) | ❌ No seed. `integrations` is studio-level; `instructor_integrations` is per-instructor. | New `customer_integrations` `{ id, customer_id, slug, status, connected_at?, account_label? }` mirroring `instructor_integrations`. |
| 2 | **Timezone** (§3.7) | ❌ No field on `customers` (only `branches` has a `+later: timezone` placeholder). | New `customers.timezone?: string`. |
| 3 | **Applied-voucher store** (§3.8) | ⚠️ `promo_codes` exists (catalog); no customer→voucher mapping. | New `customer_vouchers` `{ id, customer_id, promo_code_id, applied_at, status }`. |
| 4 | **Per-plan auto-renew** (§3.2) | ⚠️ `customer_plans` has no `auto_renew`; only `Membership` product type does. | New `customer_plans.auto_renew?: boolean`. |
| 5 | **Per-customer payment methods** (§3.5) | ⚠️ `payment_methods` is demo-global, no `customer_id`. | Add `payment_methods.customer_id` FK (seed comment already anticipates this). |
| 6 | **Referral monthly cap** (§3.10) | ⚠️ `referral_settings` singleton has no explicit monthly-cap field; PRD 11 §11 references one. | Add a cap field to `referral_settings` if the "limit reached" banner is enforced. |

Until each additive item is confirmed, render the affected section feature-flagged-off or validate-and-toast-only — **never fabricate or reshape a seed**.

**Self-scope:** every read/write resolves only the authenticated member's own `customers`-linked rows (PRD 13 §15, PRD 00 §5 RLS pattern). Active-studio context scopes browse surfaces (Search/Products) but never the member's own cross-studio records (plans, gift cards, referrals, agreements, activity).

---

## 5. Business Rules

1. **Editable vs non-editable matrix (PRD 13 §16) — enforce exactly** (full matrix in §6). Non-editable fields **never** render as inputs.
2. **Shared payment-method source of truth.** Cards live in `payment_methods` (one record set; ⚠️ `customer_id` additive). A card the member adds is selectable when an admin checks that customer out in POS; a card the admin adds is visible/removable here. No member-private copy.
3. **Transactional notifications cannot be fully disabled.** Booking, payment, package/membership, refund, and reminder categories always record an in-app `notifications` row regardless of toggles; the member may mute the **simulated push** only. Marketing is fully opt-out-able (governs PRD 13 §12.4).
4. **Remove-card-mid-checkout blocked.** A card selected in an in-progress member checkout (Products) or referenced by an in-flight auto-renew cannot be removed until that flow completes/aborts. Attempt → blocked with explanation; card retained (PRD 13 §14).
5. **Email collision blocked.** Changing email to an address registered to another account is rejected with an inline error before any write; the member keeps their current email (PRD 13 §14).
6. **Validation mirrors admin add/edit-customer (PRD 07 §4.1).** First + last name required; phone required, same phone-input component/format as admin; email format-valid and unique; emergency-contact phone required once a contact name is entered; DOB/gender/address optional. Keeps member-edited data import/POS-compatible.
7. **Auto-renew is the member's only plan write.** Member may toggle auto-renew on their active membership (⚠️ additive field §3.2); freeze/unfreeze/cancel remain **admin-only** and are display-only here. Renew/Upgrade route to **Products** (purchasing isn't done in this module).
8. **Referral program toggle is a hard gate.** `referral_settings.program_active === false` → §3.10 view **and** its menu row hidden everywhere; no code/link, no rewards. Successful-referrals-only display (PRD 07 §15). Monthly cap (⚠️ additive if enforced): over-cap referrals still recorded but issue no further reward; banner "Monthly referral limit reached."
9. **Gift cards & vouchers are view/attach only here.** Gift-card **redemption** and voucher **application at purchase** happen in **Products** checkout (cross-ref). This module displays owned gift cards (grounded) and stores/validates vouchers (⚠️ additive store).
10. **Every save emits a toast** (CLAUDE.md #4) and propagates to dependent surfaces in the same render cycle (§10).
11. **State-changing actions are modals; data entry is full-page** (CLAUDE.md #2/#3): remove-card, sign-out, change-email, change-password, auto-renew confirm (if confirmed) = modals; profile-details / emergency / timezone / preferences edits = full-page routes.

---

## 6. Permissions & Visibility — Editable vs Non-editable matrix

- **Self-scope only.** Reads and writes exclusively the authenticated member's own records. No other member's data, no instructor pay, no admin tooling.
- **Members never get admin overrides** — no refunds, freeze/unfreeze, complimentary grants, capacity/window overrides, role-gated deletes, or referral-rule config.

| Field / capability | Member-editable? |
|---|---|
| Name, phone, DOB, gender, address, photo | **Yes** (§3.1) |
| Emergency contact | **Yes** (§3.1 / §3.6) |
| Timezone | **Yes** (§3.7) ⚠️ additive field |
| Integrations connect/disconnect | **Yes** (§3.3) ⚠️ additive store |
| Notification channels / marketing opt-out / per-category push | **Yes** — but transactional **in-app records** cannot be disabled (rule 3) |
| Saved payment methods (add/remove/default) | **Yes** (§3.5) |
| Apply / store voucher | **Yes** (§3.8) ⚠️ additive store |
| Membership auto-renew | **Yes** (§3.2) ⚠️ additive field |
| Email, password | **Yes**, with confirmation (§3.11) |
| **Customer id, owning branch, account status** | **No** — admin-controlled, read-only |
| **Plan / credit / wallet / gift-card balances** | **No** — changed only via bookings/purchases/admin/referral actions |
| **Freeze / cancel a plan** | **No** — admin-only, display-only here |
| **Referral rules, reward config, monthly cap** | **No** — Settings-owned (PRD 11 §11) |
| **Admin notes** | **No** — never surfaced to the member at all |
| **Agreement records** | **No** — view-only (§3.13); acceptance gated at booking |

- **Suspended / archived account (admin action, possibly mid-session):** Profile landing + all sub-screens show a persistent "Your account is suspended — contact the studio" banner; **all mutating actions disabled** (saves, add/remove card, toggles, auto-renew, change email/password, voucher apply) while **read access to own history retained** (activity, agreements, plans, gift cards). **Sign out remains available.** Mirrors PRD 13 §4.2 / §5.5 / §14.
- **Single-branch studios** hide any studio-switch / default-studio affordance.
- **Referral surface visibility** fully governed by `referral_settings.program_active` (rule 8).

---

## 7. Flows

Each flow ends in a toast and same-render-cycle propagation (§10).

### 7.1 Edit profile details / emergency contact
Landing → **Edit** → full-page form pre-filled from `customers` → edit → **Save** → validate (§5.6); on fail show inline field errors, preserve input; on pass write `customers` via store → toast "Profile updated" → return to landing → admin customer profile (PRD 07) reflects instantly.

### 7.2 Toggle auto-renew
Plan screen → flip the active membership's auto-renew `Switch` → write the (⚠️ additive) `customer_plans.auto_renew` via store → toast "Auto-renew turned on/off" → mirrors to admin customer Plans tab. Renew/Upgrade button → route to Products checkout.

### 7.3 Add / remove payment method
Add → simulated card form → write `payment_methods` row → toast "Card added" → appears in admin POS picker. Remove → if selected in in-progress checkout/auto-renew → blocked inline (§5.4), no confirm proceeds; else confirmation modal → Confirm → delete row → toast "Card removed" (promote next as default if the removed one was default).

### 7.4 Toggle notification / marketing preference
Notification settings → flip a `Switch` → optimistic write; transactional categories refuse to disable the in-app record (rule 3) → toast "Preferences updated"; on failure revert + error toast.

### 7.5 Apply a voucher ⚠️ additive
Vouchers → enter code → validate against `promo_codes` (status/validity/targeting/per-customer limit) → valid: store to (⚠️ additive) `customer_vouchers` + toast "Voucher added"; invalid: inline reason, no write.

### 7.6 Copy referral link / code
Referrals (visible only if `program_active`) → **Copy link** / **Copy code** → clipboard → toast "Referral link copied" / "Referral code copied". No notification (non-event). Simulated native-share is an optional alternate path.

### 7.7 Connect an integration ⚠️ additive
Integrations → Connect → modal → simulated connect → write (⚠️ additive) `customer_integrations` row `connected_at` + `account_label` → toast "Connected to Google Calendar."

### 7.8 Change email / password
Account → **Change email** modal → new email + current-password confirm → collision check (§5.5): collision → inline error, abort; else update auth + `customers.email` → toast "Email updated". **Change password** modal → current + new + confirm (eye-toggle on each input) → validate → success toast "Password changed"; fail → inline error, inputs preserved.

### 7.9 Sign out / logout
Account (or landing) → **Sign out** → confirmation modal → Confirm → clear Supabase session + member store state → redirect to `/member` login.

---

## 8. States

Implement the five PRD 13 §13 states on every data-bearing surface:

- **Loading** — skeleton placeholders matching final layout (header card, list rows, plan cards, payment rows, activity rows, gift-card rows). Never a blank flash or spinner-only screen.
- **Empty** — section-specific empty states (§11). Sections that should vanish when empty (referrals when program disabled) are **hidden**, not empty boxes.
- **Success** — normal render; actions confirm with a toast + immediate reactive update of dependent surfaces.
- **Error** — inline, non-destructive: field-validation, email collision, remove-card-blocked, password mismatch, voucher-invalid, copy-failure. Preserve member input; never a raw error code; always offer recovery.
- **Offline** — persistent "You're offline" banner; last-loaded profile/cards/plan/activity shown read-only; all mutations disabled with "Reconnect to continue"; auto re-sync clears the banner on reconnect.

---

## 9. Edge Cases (PRD 13 §14)

- **Email collision** — blocked with inline error before any write; current email retained (rule 5).
- **Remove-card-mid-checkout** — card selected in an in-progress member checkout / in-flight auto-renew cannot be removed; blocked until that flow completes/aborts (rule 4).
- **Card removed elsewhere (admin)** — shared card disappears reactively (same store); an open remove modal resolves gracefully ("This card is no longer available").
- **Account suspended/archived mid-session** — mutating actions disabled with a "contact the studio" banner; read access to own history retained; sign-out still works (§6).
- **Default studio becomes inactive** — falls back to home/active studio with a toast (PRD 13 §4.4); single-branch studios never show the control.
- **Agreement version updated** — accepted-agreements list shows the member's accepted version; a newer active version is **not** auto-accepted here (gated at booking) — no action on this screen.
- **Photo upload fails** — non-destructive error, previous avatar retained, retry CTA.
- **Referral program disabled** — §3.10 view + menu row hidden entirely (rule 8); achievements/streaks (Home) unaffected.
- **Monthly cap reached** ⚠️ (if enforced) — over-cap referrals recorded but issue no reward; "Monthly referral limit reached" banner; rewards-earned does not increase that month.
- **Gift card expired** — shown in the §3.9 list with an Expired badge; not selectable at checkout.
- **Voucher invalid at apply** ⚠️ — inline reason, no write (§7.5).
- **Additive section not yet wired** — integrations / timezone / vouchers render feature-flagged-off or read-only fallback rather than fabricating a seed.

---

## 10. Cross-Module Sync (PRD 13 §15)

| Member action here | Tables written | Surfaces that must reflect it (same render cycle) |
|---|---|---|
| Edit profile details / emergency contact / photo | `customers` | Admin customer Details tab (PRD 07 §6); any avatar/name usage (rosters, customer list); recommendation inputs. |
| Toggle auto-renew | `customer_plans.auto_renew` ⚠️ additive | Admin customer Plans tab; auto-renew behavior (PRD 13 §9.6). |
| Add / remove payment method | `payment_methods` (⚠️ `customer_id` additive) | Admin POS card picker for this customer (PRD 05); admin customer Payments tab (PRD 07 §9.1). |
| Toggle marketing / push preference | `customers` marketing flags (+ honored with `notification_settings`) | Notification gating (PRD 13 §12.4, consumed by Home's center + source modules); marketing campaign targeting (PRD 08) respects the opt-out. |
| Apply / store voucher ⚠️ additive | `customer_vouchers` ⚠️ additive | Products checkout promo field (PRD 13 §10.4). |
| Connect integration ⚠️ additive | `customer_integrations` ⚠️ additive | (self-only; no admin mirror required). |
| Change email / password | auth + `customers.email` / `account_profile` | Admin customer Details email; login credential. |

Reads here (`customer_plans`, `customer_transactions`, `customer_agreements`, `customer_referrals`, `referral_settings`, `notification_settings`, `issued_gift_cards`, `promo_codes`) reflect upstream admin/booking/purchase/referral changes reactively. All writes flow through the existing Zustand store (`onra-demo-state` persistence) so admin and instructor surfaces update without a manual refresh.

---

## 11. Empty States (mandatory)

| Surface | Condition | Empty state |
|---|---|---|
| Plan summary strip / plan screen | No active membership/package | "No active plan — browse products" + CTA → `/member/products` |
| Payment methods | No saved cards | "Add a card to check out faster." + Add CTA |
| Emergency contact | None on file | "No emergency contact on file." + "Add emergency contact" |
| Integrations ⚠️ | None / not wired | "Coming soon" or disabled card (no fabricated data) |
| Vouchers ⚠️ | No applied vouchers | "No vouchers yet — enter a code to add one." |
| Gift cards | None owned | "No gift cards yet — buy one in Products." + CTA |
| Referrals — list | Program enabled, zero successful referrals | "You haven't referred anyone yet — share your link to start earning." (code/link + Copy buttons remain visible) |
| Referrals — whole view | `program_active === false` | Entire view **+ menu row hidden** (gone, not an empty box) |
| Activity → Attended classes | No attended bookings | "Your attended classes will appear here." |
| Activity → Purchases | No transactions | "No purchases yet." |
| Activity → Referrals | No successful referrals | "No referrals yet." (or hidden if program disabled) |
| Activity → Achievements | No achievements | Section hidden (not an empty box) — per PRD 13 §6.3 |
| Agreements | None accepted | "No agreements on file." |
| Activity history (whole tab) | Brand-new member, nothing anywhere | "No activity yet." |

---

## 12. Notifications & Toasts

Every CRUD / state-change emits a toast (CLAUDE.md #4) via the project `Toast` component + the store's `showToast(...)`:

- Profile updated → "Profile updated."
- Auto-renew → "Auto-renew turned on." / "Auto-renew turned off."
- Card added → "Card added." / Card removed → "Card removed." / blocked → "This card is in use at checkout. Finish checkout to remove it."
- Notification/marketing preference → "Preferences updated."
- Voucher applied ⚠️ → "Voucher added." / invalid → inline reason (no toast-success).
- Integration connected ⚠️ → "Connected to [provider]."
- Referral link/code copied → "Referral link copied." / "Referral code copied." / copy failure → "Couldn't copy — try again."
- Email updated → "Email updated." / collision → inline error (no toast-success).
- Password changed → "Password changed."
- Signed out → return to login (no lingering toast).
- Failures surface a non-destructive error toast/inline with a clear reason and recovery.

**This module does not author `notifications` rows** — profile/settings edits are UI-toast events, not notification triggers. It **writes the member preferences** that gate which notifications the source modules + Home's center produce/push. The notification **center panel** itself is Home's.

---

## 13. Rules Footer

1. **Attention to detail** — pixel-accurate to the member DS at 375px; reuse existing components/patterns (settings list rows, full-page edit forms, switches, confirmation modals, eye-toggle password inputs, phone-input, simulated card form); `<Button>` everywhere with the correct variant; never invent UI that already exists.
2. **One membership / multiple packages** — the plan screen and entry points honor: at most one membership, multiple packages; auto-renew applies to the single membership.
3. **Reuse existing design** — layout, flow, components, modals, toasts reused from existing admin/member surfaces; no new variants where one exists.
4. **Don't break existing UI/modules/flows** — adding the member Profile settings surface must not alter admin or instructor screens; `payment_methods` and `customers` are shared records, so changes stay backward-compatible with admin POS and the customer module.
5. **Data is connected & synced** — every add/remove/edit/toggle reflects to the relevant table and all dependent modules (admin customer profile, POS card picker, notification gating, checkout) in the same render cycle, via the live store.
6. **Mandatory empty states** — every data-bearing section uses its defined empty state (§11); sections that vanish when empty (referrals when disabled) are hidden, not empty boxes.
7. **Mock data is read-only** — `src/data/mock/*` seeds are the single source of truth and must be preserved as-is; never modify, delete, regenerate, or reshape a seed. Demo-session member writes go through the live store and persist via `onra-demo-state`. **Every additive/flagged field (§4.1) must be surfaced and confirmed before any append-only type/seed change** — until then the affected section is feature-flagged-off or validate-and-toast-only. Currency is always `AED [amount]`.
