# Brief — Customer Profile Module (`/customer/profile`)

> Surface: **customer** (mobile-only, centred `max-w-[400px]` column, no phone frame, `@untitledui/icons`, AED currency). Companion to `Brief-for-customer-search-module.md`. Reuses the already-built customer shell: bottom sheet primitive, full-page back-headers, options/radio rows (from the Time Zone selector), `Switch`, `Toast`, `Button`, and the phone-input from admin add-customer.
>
> **Scope of this brief:** the **Profile** tab — the customer's account & settings hub (tab 5 of the five-tab bottom nav: Home · Search · Bookings · Products · **Profile**). It is a **settings landing** with one sub-page per menu item. This brief documents only what the provided Figma designs and this prompt specify; behaviours not shown are left undocumented. Business rules, terminology, and data definitions are **consumed** from the Admin brief (source of truth), never redefined here.

---

## 1. Overview

The **Profile** module is the customer app's account hub. Its landing (`/customer/profile`) has **no top header** (top padding of the main content = **32px**), and renders, top to bottom: a **profile header card**, a **class-balance / plan card**, then grouped **menu rows**, and a **Logout** row. Each menu row navigates to its own page (or opens a bottom sheet, for Logout). The Profile bottom-nav icon is the customer's own avatar.

Everything is **self-scoped** to the demo customer and **read-only over the seed data** — edits, toggles, plan actions, card add/remove, gift-card redemptions, and integration connects persist to the live `onra-demo-state` store, never to seed files. Membership/package terminology, plan states, payment-method records, gift cards, promo codes, and referral config are consumed from the existing Admin model.

---

## 2. Goals / Purpose

1. **One account hub.** Surface every account/preference destination from a single scrolling landing — profile, plan, integrations, notifications, payment, emergency contact, timezone, promo, gift card, referral, and logout.
2. **Reuse, don't reinvent.** Every sub-page reuses already-built customer patterns: bottom sheets, options/radio rows, the Time Zone selector, the checkout promo page, full-page back-headers, `Switch`, phone-input, and `Toast`.
3. **Self-service over shared records.** The customer edits their own `customers` record, manages their own saved cards (shared with the admin POS), views their own plan/gift cards/referrals — mirroring instantly to the admin side via the shared store.
4. **Match the designs exactly.** UI structure, copy, toasts, and flows follow the provided Figma frames; no behaviour is added beyond what they show.

---

## 3. Module Structure

### 3.1 Routes / screens

| # | Screen | Route | Type | Bottom nav |
|---|---|---|---|---|
| 0 | **Profile landing** | `/customer/profile` | Tab screen (no header, `pt-8` = 32px) | Visible (Profile active) |
| 1 | **Profile information** | `/customer/profile/information` | Full-page form (back-header) | Hidden |
| 1a | **Change photo → Crop** | `…/information/photo` (or in-flow) | Full-page crop (Cancel / Done) | Hidden |
| 1b | **Date of birth picker** | — | Bottom sheet over (1) | — |
| 1c | **Gender picker** | — | Bottom sheet over (1) | — |
| 2 | **My plan** | `/customer/profile/plan` | Full-page (back-header) | Hidden |
| 2a | **Freeze plan** | — | Bottom sheet over (2) | — |
| 2b | **Cancel plan** ("Please select a reason") | — | Bottom sheet over (2) | — |
| 3 | **Integrations** | `/customer/profile/integrations` | Full-page (back-header) | Hidden |
| 3a | **Connect app** | — | Bottom sheet → simulated 3rd-party OAuth | — |
| 4 | **Notification settings** | `/customer/profile/notifications` | Full-page (back-header) | Hidden |
| 5 | **Payment settings** | `/customer/profile/payment-methods` | Full-page (back-header) | Hidden |
| 5a | **Select method** (Scan / Enter manually) | — | Bottom sheet over (5) | — |
| 5b | **Scan card** | `…/payment-methods/scan` | Full-page camera | Hidden |
| 5c | **Scanning card** (loader) | transient (in-flow) | Full-page loader | Hidden |
| 5d | **Add payment method** | `…/payment-methods/new` | Full-page form | Hidden |
| 5e | **Edit payment method** | `…/payment-methods/[cardId]/edit` | Full-page form (back + trash) | Hidden |
| 5f | **Delete / Can't-delete card** | — | Bottom sheet over (5e) | — |
| 5g | **Redirecting** (Apple/Google Pay) | transient (in-flow) | Full-page loader | Hidden |
| 5h | **Disconnect** (Apple/Google Pay) | — | Bottom sheet over (5) | — |
| 6 | **Emergency contact** | `/customer/profile/emergency` | Full-page form (back-header) | Hidden |
| 7 | **Timezone** | `/customer/profile/timezone` | Full-page (**reuses Search Time Zone selector**) | Hidden |
| 8 | **Promo** | `/customer/profile/promo` | Full-page (**reuses checkout Promo page**) | Hidden |
| 9 | **Gift card** | `/customer/profile/gift-cards` | Full-page (back-header) | Hidden |
| 9a | **Redeem gift card** | `…/gift-cards/redeem` | Full-page modal (close-only) | Hidden |
| 10 | **Invite friends / Referral** | `/customer/profile/referrals` | Full-page (back-header) | Hidden |
| 10a | **Share** | — | Bottom sheet over (10) | — |
| 11 | **Logout** | — | Bottom sheet over (0) | — |

> **Full-screen rule:** every screen except the landing (0) hides the 5-tab bottom nav (add their path prefixes to the customer layout's `isFullScreen` check, as the Search/Select-branch flows already do).

### 3.2 Reusable components (build-once, reuse everywhere)

| Component | Source / status | Reused by |
|---|---|---|
| **Bottom sheet primitive** (`CustomerSheet`, shell) | ✅ built | DOB, Gender, Freeze, Cancel, Connect, Select method, Delete card, Disconnect, Share, Logout |
| **Options / radio rows** (Time Zone selector pattern) | ✅ built | Gender, Freeze reason, Cancel reason |
| **Time Zone selector page** | ✅ built (Search) | §5.7 (reused as-is) |
| **Promo page** | ✅ built (checkout) | §5.8 (reused as-is) |
| **Phone input** (country code + number) | ✅ built (admin add-customer) | Profile information, Emergency contact |
| `Switch` | ✅ DS | Notification settings |
| `Button`, `Toast`, confirmation sheet | ✅ DS | throughout |
| **Calendar date picker** (`DatePicker`) in a sheet | ✅ DS | Date of birth |
| **Profile header card** | ⬜ new `ProfileHeaderCard` | Landing |
| **Class-balance card** | ⬜ new `ClassBalanceCard` | Landing |
| **Settings menu row** | ⬜ new `ProfileMenuRow` (leading icon + label + chevron) | Landing menu groups |
| **Plan card** | ⬜ new `PlanCard` (membership **and** package) | My plan |
| **Card row** + **card-details form** | ⬜ new `PaymentCardRow` / `CardDetailsForm` | Payment settings, Add / Edit |
| **Redeem gift-card modal** | ⬜ new `GiftCardRedeemModal` (Forma illustration) | Gift card |
| **Referral hero + metrics + referred list** | ⬜ new `ReferralView` | Invite friends |

### 3.3 Data consumed (read-only — writes via store)

`customers` (name, email, phone, DOB, gender, photo, emergency contact, `referral_code`), `customer_plans` + `memberships` / `packages` (My plan), `payment_methods` (saved cards — shared with admin POS), `issued_gift_cards` (owned gift cards), `promo_codes` (Promo), `customer_referrals` + `referral_settings` (Invite friends + the admin-set share message), `notification_settings` (channels). Integrations + scan/redirect 3rd-party steps are **simulated**. **No new tables, no seed edits** — every customer write persists via `onra-demo-state`.

---

## 4. Entry Points

1. **Bottom nav → Profile tab** (primary) — from every customer screen; the nav icon is the customer's avatar.
2. **Gift card** is also reachable from the **"Add gift card"** action in the checkout card's *Pay with* section (cross-ref; that checkout flow is not built yet).
3. **Promo** applied from here routes into the **Products** module with the promo pre-applied (cross-ref).
4. Each landing menu row opens its own page (§5); Logout opens a bottom sheet.

---

## 5. Flows / Phases — detailed screen breakdown

### Phase 0 — Profile landing (`/customer/profile`)
**No top header.** Main content top padding = **32px**. Vertically scrolling, top to bottom; bottom nav visible (Profile active):

1. **Profile header card** — customer avatar (photo, or **initials** fallback e.g. "KM"), full name (e.g. "Kate Morrinson"), email (e.g. "kate@untitled.com"), and a **chevron-right** → **Profile information** (§5.1).
2. **Class-balance card** — label **"Credit balance"** + a progress bar, in one of two states:
   - **No active plan** — heading "No active plan", empty bar, and a **"Browse plan"** button → `/customer/products`.
   - **Active plan** — heading = credit state (e.g. "Unlimited credits"), filled bar, and a two-column footer: **Membership** (e.g. "Unlimited") · **Expires on** (e.g. "April 20, 2027"). Tapping the card → **My plan** (§5.2).
3. **Menu group A** (one card, list rows — leading icon, label, chevron, ≥44px targets): **Integrations** → §5.3 · **Notification settings** → §5.4 · **Payment settings** → §5.5 · **Emergency contact** → §5.6 · **Timezone** → §5.7.
4. **Menu group B** (one card): **Promo** → §5.8 · **Gift card** → §5.9 · **Invite friends** → §5.10.
5. **Logout** — destructive (red) row in its own card → opens the **Logout** bottom sheet (§5.11).

### Phase 1 — Profile information (`/customer/profile/information`)
Full-page form; **back** button (circular, top-left); no centred title (the avatar leads). Sign-up already captured First name, Last name, Email, Phone — this page edits those plus the remaining fields.

- **Avatar + change photo** — centred avatar (photo or initials) with a **camera badge**. Tapping it lets the customer pick a photo → a **Crop** screen (full-page, circular crop frame, **Cancel** / **Done**); Done sets the avatar.
- **First name** / **Last name** — text inputs (pre-filled, e.g. "Kate" / "Morrinson").
- **Date of birth** — read-only field ("Enter date of birth" placeholder + calendar icon). Tapping opens a **bottom sheet month-view date picker**: title "Date of birth" + `x-close`, a month header ("February 1980") with `‹ ›` navigation, a Mo–Su day grid, and a **"Select date"** button (disabled until a day is picked, then green). Selecting writes the field (e.g. "12 February 1980").
- **Gender** — read-only field ("Select gender" placeholder + chevron). Tapping opens a **bottom sheet** (reuse the Time Zone selector's sheet + options rows): title "Gender" + `x-close`, options **Male** / **Female** (radio), and a **"Confirm"** button (disabled until one is selected, then green). Selecting writes the field.
- **Email** — text input (pre-filled).
- **Phone number** — country-code selector (e.g. flag + "+971") + number input (reuse the admin phone-input).
- **Save changes** — sticky bottom `Button` (disabled until a change is made, then primary green). On save → toast **"Your profile is updated"** / subtext **"All changes has been saved"**.

### Phase 2 — My plan (`/customer/profile/plan`)
Full-page; **back** + centred title **"My plan"**. One **`PlanCard`** per active plan (the **same card** for membership and credit package). A card carries: plan **name**, **status**, **price + duration** (top-right), **credit amount** + progress bar, **dates**, and **actions** (state-driven).

- **Membership card** — e.g. "Unlimited Membership" · status · "AED 2800" / "per month" · credit row ("8 credits left" or "Unlimited credits") + bar · **Next billing date** + **Expiry date** rows · actions.
- **Credit-package card** — e.g. "10-Class Package" · status · "AED 1390" / "1 month" · credit row ("5 credits left") with **End [date]** inline (e.g. "End Feb 16, 2026") + bar · actions. **Multiple packages** stack as multiple cards.

**Status → actions:**
- **Active** → actions **Cancel** + **Freeze**.
- **Frozen** → the status line reads **"Frozen until: [date]"** (e.g. "Frozen until: 16 Mar 2026"); actions **Cancel** + **Unfreeze**.
- **Cancelled** (with remaining duration) → status **"Cancelled"**, a red info banner **"Your subscription ends on [date]. You will keep access until then."**, and a single full-width **Reactivate plan** action.

Membership and credit package share the **same actions and states**.

#### 5.2a Freeze plan (bottom sheet)
Opened by **Freeze** on an active plan. Title **"Freeze membership"** + `x-close`. Fields: **Duration** (number input, e.g. "30") + **Unit** (Select, e.g. "Day"); **Freeze reason** (radio): "I want to cancel", "I'm moving to a new area", "I'll be traveling", "I have an injury or medical issue", "I need a seasonal break". **Confirm** button (disabled until duration + reason; green when valid). On confirm → the card becomes **Frozen** ("Frozen until: [date]"), action → **Unfreeze**; toast (error-colour freeze icon, per design) **"Membership has been frozen"** / **"All active benefits and bookings for this membership will be frozen until reactivated."** *(Same copy for both plan types — swap "membership" → "credit package".)*

#### 5.2b Unfreeze
**Unfreeze** on a frozen plan **immediately** reactivates it (no sheet). Toast (success-colour check icon, per design) **"Membership has been unfreeze"** / **"All benefits and bookings have been reactivated for this membership."** *(Swap plan name for credit package.)*

#### 5.2c Cancel plan (bottom sheet)
Opened by **Cancel** on an active plan. Title **"Please select a reason"** + `x-close`. Reason (radio): "I want to cancel", "I'm having trouble with payment", "I'm moving to a new area", "I have an injury or medical issue", "It's not in my budget right now". **Cancel** button (destructive red; disabled until a reason is selected, then red-filled). On confirm → the card becomes **Cancelled** with the red "ends on [date]… keep access until then" banner + **Reactivate plan**; toast (error-colour icon) **"Membership has been cancelled"** / **"All benefits and bookings under this membership are no longer active."** *(Swap plan name for credit package.)*

### Phase 3 — Integrations (`/customer/profile/integrations`)
Full-page; **back** + title **"Integrations"**. A list of integration cards; design shows **Calendar** — "Sync your schedule events" + a **Connect** button.

- **Connect** → bottom sheet **"Connect to your calendar"** / "Allow Onra to integrate with Google Calendar to view and sync class schedule." + **Connect** button.
- Connect → a **simulated 3rd-party (Google) authorization** sequence (choose account → sign in to Onra → "Onra wants access to your Google Account" → select access → continue).
- On success → the card's button becomes **Disconnect** (red).

### Phase 4 — Notification settings (`/customer/profile/notifications`)
Full-page; **back** + title **"Notification settings"**. A card with three `Switch` rows: **Email notifications** ("Receive updates via email"), **WhatsApp notifications** ("Receive quick updates"), **Push notifications** ("Get instant alerts on your device"). Toggling any switch → a success toast confirming it was turned on / off.

### Phase 5 — Payment settings (`/customer/profile/payment-methods`)
Full-page; **back** + title **"Payment settings"**.

- **Credit card** section — header + a count (e.g. "1 card added") and a list of saved cards (brand icon, cardholder name e.g. "Kelly M", `**** **** **** 0000`, chevron → **Edit**). Below the list: **"+ Add new card"** button.
- **Others** section — **Apple pay** and **Google pay** rows with a connection state ("Not connected" / "Connected") and a chevron.

#### 5.5a Add new card → Select method (bottom sheet)
**+ Add new card** → bottom sheet **"Select method"** + `x-close`: **Scan card** / **Enter details manually**.

- **Scan card** → a full-page camera screen (`x-close` + flash toggle, a card frame in the centre, helper "Place your card inside the frame and make sure all details are visible.", and a shutter button). Tapping the shutter → a **"Scanning card"** / "Getting card details" loader (3-dot), then the **Add payment method** form (§5.5b) pre-filled from the scan.
- **Enter details manually** → the **Add payment method** form (§5.5b) with empty placeholder fields.

#### 5.5b Add payment method (full page)
Title **"Add payment method"** + back. A card illustration + fields: **Card holder name**, **Card number**, **Expiry**, **CVV**. **Add card** button → saves the method; toast **"Payment method has been added"** / **"New payment method has been added, now you can start buy product."** Returns to the list (the new card appears).

#### 5.5c Edit payment method (full page)
Opened by tapping a saved card. Same card-details layout, title **"Edit payment method"**, with **back** + a **trash** (remove) button in the header; save button = **"Save changes"**.

- **Remove** (trash) → bottom sheet confirmation **"Delete this payment method?"** / "This will remove all of the payment information and no longer can be use." + **Delete** (red). On delete → the card is removed; toast **"Payment method has been removed"** / **"Payment method successfully removed and no longer be use."**
- **Blocked case** — when the card cannot be removed (the membership has recurring payments and this is the only card), the sheet instead reads **"You can't delete this payment method"** / "Your membership has recurring payments. Please add a new card before removing this one." + **Add new card**. (With two cards, one can be removed.)

#### 5.5d Connect / disconnect Apple Pay · Google Pay
- **Connect** (tap a "Not connected" method) → a **"Redirecting to Apple Pay…"** page ("You'll be redirected to Apple Pay to authorize and access your account.") → simulated authorize → connected. Toast **"Apple Pay has been connected"** / **"Apple Pay has been connected, now you can start buy product."** The row shows **Connected** + a disconnect (broken-link) icon.
- **Disconnect** (the broken-link icon on a connected method) → bottom sheet **"Disconnect Apple Pay?"** / "This will remove all of the payment information and no longer can be use." + **Disconnect** (red). On disconnect → toast (error colour) **"Apple pay has been disconnected"** / **"Apple pay successfully disconnected and no longer be use."**

### Phase 6 — Emergency contact (`/customer/profile/emergency`)
Full-page; **back** + title **"Emergency contact"**. The emergency contact is captured at sign-up (built later); here the customer **edits/updates** it. Fields: **First name**, **Last name**, **Phone number** (country code + number), **Relation** (Select, e.g. "Siblings"). **Save changes** button (sticky bottom).

### Phase 7 — Timezone (`/customer/profile/timezone`)
**Reuses the Search module's Time Zone selector** as-is (full-page, sticky search subBar, flat radio rows, city + UTC offset). Changing the timezone reflects across the customer app (display-only).

### Phase 8 — Promo (`/customer/profile/promo`)
**Reuses the checkout Promo page** as-is. Tapping **"Apply"** on a voucher card (or **"Apply promo"** on a promo detail) → opens the **Products** module with a toast that the promo is applied; the customer continues selecting a product to purchase / add to cart, and the **checkout card shows the promo already applied**.

### Phase 9 — Gift card (`/customer/profile/gift-cards`)
Full-page; **back** + title **"Gift card"**. Top: a gift icon + **"Redeem gift code"** / "Enter the digit code to redeem your gift card", an **"Enter gift card code"** input, and a **Confirm** button. Below: a **"Redeemed gift card"** section.

- **Empty redeemed** → "No redeemed gift card yet" / "Redeemed gift cards will appear here."
- **Confirm** (with a code) → a **Redeem gift card** full-page modal (**close-only**): the **Forma** gift-card illustration, "**[Sender name] sent you a gift**" + the message (e.g. "Sam Lee sent you a gift" / "Happy birthday Kate! Enjoy your classes"), and a **Redeem gift card** button. The card is **not** redeemed until the button is tapped.
- **Redeem gift card** → the illustration changes to the gift-card **balance** (e.g. "AED 250 Gift Card") and the button turns to **Close**.
- **Close** → back to the Gift card page; the redeemed card now appears in the **Redeemed gift card** list (each: code, balance e.g. "AED 150/250 left", end date e.g. "End Apr 15, 2026", and a **Use gift card** button; depleted cards show "AED 0/250 left", greyed).

### Phase 10 — Invite friends / Referral (`/customer/profile/referrals`)
Full-page; **back** + title **"Invite friends"**.

- **Hero** — icon + **"Refer friends, get free credits"** / "Get 2 free credits for each you invite."
- **Code + actions** — the referral code (e.g. "Jtr.888") in a field with a **Copy** button, and a full-width **Share** button.
- **Steps card** — "Share your unique link to your friends to join the program." · "Your friends signs up and makes a purchase of membership/product." · "1 day after the purchase, you and your friend will both get 2 free class credits."
- **Metrics row** — **Total bonus class** (e.g. "0 class" / "4 class") · **Successful referrals** (e.g. "0" / "2").
- **Referred customers** list — **empty:** "No referrals yet" / "refer friends and get free class!"; **with data:** rows of referred people (avatar, name, email, and a status badge **Success** / **Pending**).
- **Share** → a bottom sheet to share the referral code, carrying the **referral message set from the admin dashboard**.
- Each **successful** referral grants **2 free credits**.

### Phase 11 — Logout (bottom sheet)
The **Logout** row opens a confirmation bottom sheet; confirming **signs the customer out** of the account.

---

## 6. States & conditional rendering

- **Class-balance card** — "No active plan" + Browse plan (no plan) vs credit state + Membership/Expires footer (active plan).
- **Plan card** — actions and status switch by state: Active (Cancel + Freeze) → Frozen ("Frozen until: [date]", Cancel + Unfreeze) → Cancelled (red banner + Reactivate plan). Membership and credit package share these.
- **Plan card body** — membership shows Next billing + Expiry rows; package shows the End date inline with credits. Credit row shows "N credits left" or "Unlimited credits".
- **Save / Confirm buttons** — disabled until valid (a change made / required selections set), then primary green (Cancel reason → red).
- **Integration card button** — Connect ↔ Disconnect by connection state.
- **Others payment rows** — "Not connected" (tap → connect) vs "Connected" (broken-link icon → disconnect).
- **Card delete** — "Delete this payment method?" vs the blocked "You can't delete this payment method" sheet (recurring-membership / last-card case).
- **Gift card redeem button** — "Redeem gift card" before redemption → "Close" after; the illustration switches sender-message → balance.
- **Referral list** — empty state vs referred-customer rows (Success / Pending badges).

## 7. Empty states

| Surface | Condition | Empty state |
|---|---|---|
| Class-balance card | No active plan | "No active plan" + **Browse plan** → Products |
| Gift card — redeemed list | None redeemed | "No redeemed gift card yet" / "Redeemed gift cards will appear here." |
| Invite friends — referred list | No referrals | "No referrals yet" / "refer friends and get free class!" (code + Copy + Share remain) |

## 8. Toasts & messages

| Action | Copy |
|---|---|
| Save profile information | "Your profile is updated" / "All changes has been saved" |
| Freeze plan | "Membership has been frozen" / "All active benefits and bookings for this membership will be frozen until reactivated." *(swap for credit package)* |
| Unfreeze plan | "Membership has been unfreeze" / "All benefits and bookings have been reactivated for this membership." *(swap for credit package)* |
| Cancel plan | "Membership has been cancelled" / "All benefits and bookings under this membership are no longer active." *(swap for credit package)* |
| Add card | "Payment method has been added" / "New payment method has been added, now you can start buy product." |
| Remove card | "Payment method has been removed" / "Payment method successfully removed and no longer be use." |
| Connect Apple/Google Pay | "Apple Pay has been connected" / "Apple Pay has been connected, now you can start buy product." |
| Disconnect Apple/Google Pay | "Apple pay has been disconnected" / "Apple pay successfully disconnected and no longer be use." |
| Toggle a notification channel | Success toast confirming the channel was turned on / off |
| Apply promo (in Products) | Toast that the promo is applied |

*(Integration connect, gift-card redeem, referral copy/share, and emergency-contact save show their standard success toast; exact copy not specified in the designs — keep consistent with the existing customer toast pattern.)*

## 9. Cross-module sync

- **Profile information / emergency contact / photo** → writes `customers`; mirrors to the admin customer profile and any avatar/name usage.
- **Payment methods** (add / remove / connect) → writes `payment_methods`; shared with the admin POS card picker (single source of truth).
- **Plan actions** (freeze / unfreeze / cancel / reactivate) → write `customer_plans` state; mirror to the admin customer Plans tab.
- **Promo apply** → routes into Products with the promo pre-applied at checkout.
- **Gift card redeem** → updates the customer's `issued_gift_cards`.
- **Referral** → reads `customer_referrals` + `referral_settings` (share message); successful referral = 2 credits.

All writes flow through the live Zustand store (`onra-demo-state`) so dependent admin/customer surfaces update in the same render cycle.

---

## 10. Rules footer

1. **Reuse, don't reinvent** — bottom sheet primitive, options/radio rows (Time Zone), the Time Zone selector page, the checkout Promo page, the phone-input, `Switch`, `Button`, `Toast`. `<Button>` everywhere with the correct variant; destructive actions red.
2. **Full-page data entry, bottom-sheet confirmations/pickers** — profile/emergency/card forms are full-page routes; DOB, gender, freeze, cancel, connect, select-method, delete, disconnect, share, logout are bottom sheets (CLAUDE.md conventions #2/#3).
3. **Self-scope, no admin overrides** — the customer edits only their own records; freeze/unfreeze/cancel here are the customer-facing plan controls shown in these designs (membership + credit package share the same actions/states).
4. **Every state-change emits a toast** with the exact copy above; data stays connected and synced to dependent modules in the same render cycle.
5. **Match the designs** — document and build only what the provided Figma frames and this prompt specify; do not add flows, validations, empty states, or edge cases that are not shown.
6. **Mock data is read-only** — `src/data/mock/*` seeds are preserved as-is; demo-session writes persist via `onra-demo-state`. Currency is always `AED [amount]`.
