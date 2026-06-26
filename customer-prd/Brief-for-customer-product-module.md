# Brief — Customer Products Module (Storefront · Add-to-Cart · Checkout · Promo · Payment)

> Surface: **customer** (mobile-only, `max-w-[500px]` centred column, no phone frame, `@untitledui/icons`, AED currency). Companion to `Brief-for-customer-search-module.md` and `Brief-for-customer-home-module.md`. Reuses the already-built member shell: shared `MemberHeader`, the **Branch Selector** chip, the fixed decorative background, the internal-scroll layout, `MemberSheet` / `SheetToolbar`, and `MemberToast`.
>
> **Scope of this brief:** the **browse → add to cart → checkout → pay → success** journey for the three sellable product types — **Memberships, Credit Packages, Gift Cards**. This is the storefront the **Search** module's *Purchase Product* dependency routes into (`Brief-for-customer-search-module.md` §5.17). **Viewing** owned plans / package credits / gift-card balances lives in the **Profile** module (this brief *routes into* it on success). This brief introduces **no** business rules, states, payment methods, edge cases, or interactions beyond what the prompt, the referenced Customer briefs, and the Admin brief state.

---

## 1. Overview

The **Products** module is tab 4 of the five-tab bottom nav (Home · Search · Bookings · **Products** · Profile). It is the customer storefront: a **3-tab catalog** (All · Packages · Gift card) of the active branch's purchasable products, each opened through a **Product Details bottom sheet** that adds the product to a cart and runs a **single full-screen checkout** — payment method, a promo/voucher flow, a tax breakdown, **Pay now**, a **loading** sequence, and a **Payment Success** screen.

The module reuses the **already-built purchase machinery** created for the booking flow's *Purchase Product* dependency — the `purchaseCart` singleton + pricing/promo helpers in `src/lib/member/purchase.ts`, the `ProductDetailsSheet`, the checkout / promo-list / promo-detail / processing / success screens, and the `PromoCard` / `ProductBadge` components. The Products tab is the **standalone entry** into that same machinery (origin = the Products catalog rather than a class booking).

Everything is **self-scoped** to the demo member and **read-only over the seed data** — new purchases write to the live `onra-demo-state` store, never to seed files. The **ownership invariant** mirrors the admin/Profile model: a customer may hold **one Membership OR one-or-multiple Credit Packages** — never a membership *and* a package, and never two memberships.

---

## 2. Goals / Purpose

1. **One coherent storefront.** A single catalog surface with three tabs (All · Packages · Gift card) over the active branch's active products, reusing one **Product Card** across tabs.
2. **One add-to-cart pattern.** Every product type opens the **same** Product Details bottom sheet (icon · name · overview · price · quantity · Add to cart), differing only in the overview line.
3. **Rule-correct cart behaviour.** A **membership is exclusive** (adding it goes straight to checkout); **credit packages stack** (adding one returns to the list with a **Floating Cart Card**). The ownership invariant (one membership OR multiple packages) holds at every step.
4. **A complete promo flow.** An **Apply Promo** section that opens a **Voucher List**, drills into **Promo Details**, applies an active promo as a **success badge**, supports **manual code entry**, surfaces **expired / not-found** errors, and **cancels** an applied promo via the destructive-secondary button.
5. **A complete payment flow.** A sticky **Total + Pay now** action → the existing **Loading** screen → a **Payment Success** overview that routes into Profile (*View plan* / *View gift card*).
6. **Reuse, don't reinvent.** The cart, pricing, promo, checkout, processing, and success surfaces already exist — the Products tab adds the **catalog + Active Plan card + Branch-Selector-only header** and wires the catalog into the existing checkout.

---

## 3. Module Structure

### 3.1 Routes / screens

| # | Screen | Route | Type | Bottom nav |
|---|---|---|---|---|
| 1 | **Products catalog** (All · Packages · Gift card tabs) | `/member/products` | Tab screen | Visible (Products active) |
| 2 | **Product Details** bottom sheet | — | Bottom sheet over (1) | Visible |
| 2a | **Gift Card Information** (gift-card add — recipient · amount · message) | `/member/products/gift-card/[designId]` | Full-screen step | Hidden |
| 2b | **Floating Cart Card** (after adding a package / gift card) | — | Overlay above bottom nav on (1) | Visible |
| 3 | **Checkout Cart** | `/member/products/checkout` | Full-screen flow | Hidden |
| 4 | **Voucher List** (Apply Promo) | `/member/products/checkout/promo` | Full-screen (own header) | Hidden |
| 4a | **Promo Details** | `/member/products/checkout/promo/[promoId]` | Full-screen (own header) | Hidden |
| 5 | **Payment Processing / Loading** | `/member/products/checkout/processing` | Full-screen loader (transient) | Hidden |
| 6 | **Payment Success** | `/member/products/checkout/success` | Full-screen (flow end) | Hidden |

> **Full-screen rule:** every screen except (1) hides the shared 5-tab bottom nav. Add `/member/products/checkout` **and** `/member/products/gift-card` to the member layout's `isFullScreen` prefix check (it already gates `/member/classes/`, `/member/search/`, `/member/bookings/`). The Product Details sheet and the Floating Cart are **overlays on the catalog**, so the nav stays visible there.
>
> **Reuse note:** screens (3)–(6) are the **same surfaces already built** at `/member/classes/[id]/book/checkout`, `.../checkout/promo`, `.../checkout/promo/[promoId]`, `.../checkout/processing`, `.../checkout/success`. Either (preferred) **generalize those components** to also serve a Products-origin cart and add the `/member/products/checkout/*` route group, or route the Products tab through the existing checkout with a Products-origin cart. **Do not fork** the checkout/promo logic.

### 3.2 Reusable components (build-once, reuse everywhere)

| Component | Source / status | Reused by |
|---|---|---|
| `MemberHeader` (shared shell) | ✅ built (`src/components/member/MemberHeader.tsx`) | Catalog header, checkout/promo back-headers |
| **Branch Selector chip** | ✅ built (the Home studio chip → `/member/select-branch`, `src/components/member/home/Header.tsx`) | **Reuse as the catalog header's only control** (see §5.1). Extract to a shared `BranchSelector` if not already shared, and reuse across the Customer app (Home, Search, Products). |
| **Product Card** | ⬜ new `ProductCard` (Figma `2225-14011`) — the card used on the **All** tab, reused by Packages + Gift card | Catalog list (all 3 tabs) |
| **Active Plan card** | ⬜ new `ActivePlanCard` (Figma `3298-73796`) | Catalog (shown for members with an active plan) |
| `ProductDetailsSheet` | ✅ built (`src/components/member/ProductDetailsSheet.tsx`) — icon · name · sub · price · qty stepper · Add to cart | Product Details sheet (extend for gift-card overview + icons) |
| `SheetToolbar` / `MemberSheet` | ✅ built | Product Details sheet chrome |
| **Floating Cart Card** | ⬜ new `FloatingCartCard` (Figma `3298-70460`) | Catalog after a package / gift-card add |
| **Gift Card Information page** | ⬜ new `GiftCardInfoForm` (Figma `2452-33549`) | Gift-card add step (§5.7a) |
| Checkout screen | ✅ built (`src/app/member/classes/[id]/book/checkout/page.tsx`) — payment methods + breakdown + Apply-promo row | Checkout Cart (§5.4) |
| `PromoCard` | ✅ built (`src/components/member/PromoCard.tsx`) | Voucher List |
| Promo list / detail screens | ✅ built (`.../checkout/promo/page.tsx`, `.../promo/[promoId]/page.tsx`) | Apply Promo flow (§5.5) |
| `ProductBadge` | ✅ built (`src/components/member/ProductBadge.tsx`) | Checkout item rows |
| Processing screen | ✅ built (`.../checkout/processing/page.tsx`) | Loading (§5.7) |
| Success screen | ✅ built (`.../checkout/success/page.tsx`) | Payment Success (§5.8) |
| `MemberToast` + `showToast` | ✅ built | every action (CLAUDE.md #4) |
| `Button`, `RadioDot`/`SelectIndicators`, `SearchEmptyState` | ✅ DS / built | throughout |

### 3.3 Shared cart + pricing lib (already built — reuse, extend additively)

`src/lib/member/purchase.ts` already provides the entire cart/promo/pricing model — **reuse it**:
- `PlanRow { id, kind: "membership" | "package", name, sub, price }`, `CartItem extends PlanRow { quantity }`.
- `purchaseCart { classId, items, promoId }` — module singleton surviving the round-trip; `ensurePurchaseCart(originId)`.
- `addToCart(item, quantity)` — **membership replaces the cart (exclusive); packages stack** (matches the prompt's add-to-cart rules).
- `usePurchasePlans()` / `usePlan(id)` — active memberships + packages mapped to `PlanRow`.
- `usePromos()` / `usePromo(id)` / `promoDiscount(subtotal, promo)` — non-archived promos → `PromoVM`; only `percentage` / `fixed_amount` offers are `applicable`.
- `computeTotals(subtotal, promo)` → `{ subtotal, discount, tax, total }` with `TAX_RATE_PCT = 10` (the Figma "Tax rate (10%)" line; tax charged on subtotal).
- `OrderSnapshot` / `lastOrder` — carried Pay now → processing → success.

**Additive extensions required for the Products tab (flag — do not reshape seeds):**
1. **Gift cards** are not in today's `PlanKind` (`"membership" | "package"`). The **Gift card** tab + gift-card Add-to-cart require widening `PlanKind`/`PlanRow` to include `"gift_card"` and sourcing `gift_card_designs` in a `usePurchasePlans`-style hook. The gift-card cart item additionally carries the **Gift Card Information** fields (§5.7a): `recipientName`, `recipientEmail`, `amount` (the chosen face value — the design's `fixed_value_aed` for fixed, or the entered value for custom), and an optional `message`. Append the union member + fields; do not edit seeds (§9 gap).
2. **`addToCart` is non-exclusive for gift cards.** Today `addToCart` makes a **membership** replace the whole cart. Gift cards must **coexist** with a membership or packages (the member "can add a gift card with a membership too"), so membership-exclusivity applies only to **membership-vs-package** — gift cards are preserved across a membership/package add and stack on their own. Extend `addToCart` additively to keep gift-card items when a membership/package is added.
3. The cart is keyed by `classId`; the Products tab has **no class** — generalize to an **origin id** (e.g. `"products"` sentinel) so `ensurePurchaseCart` resets the cart correctly when entering from the catalog vs a booking.

---

## 4. Entry Points

The Products module is reachable from:

1. **Bottom nav → Products tab** (primary) — every member screen.
2. **Search → Booking Confirmation → Purchase Product** (`Brief-for-customer-search-module.md` §5.17) — the no-eligible-plan footer opens the Product Details sheet / checkout for an applicable product, then returns to the booking with the new plan active. That flow **reuses this module's** Product Details sheet + checkout; the Search brief owns the return-to-booking handoff.
3. **(Future)** Home "What's on" / CTAs may deep-link into a product detail.

**Checkout is reached only from a cart** (a membership add, or the Floating Cart's "Checkout"/"View cart"). **Payment Success → View plan / View gift card** exits into the **Profile** module; the checkout flow never deep-links elsewhere.

---

## 5. Flows / Phases — detailed screen breakdown

### Phase 1 — Products catalog (`/member/products`) — Figma `2225-14011`

Top → bottom:

**5.1 Header — Branch Selector only.** Reuse the existing `MemberHeader` shell with **only the Branch Selector chip** (`marker-pin-01` + active branch name + `chevron-down` → `/member/select-branch`). **Remove the filter button** — the Products module contains **no filter**, no search, only the Branch Selector. Reuse the **same Branch Selector component** across the Customer app (Home, Search, Products). Hidden/static for single-branch studios. Notification bell follows the existing shared header pattern.

**5.2 Tabs.** A segmented tab strip directly under the header — **All · Packages · Gift card** (underline-active, reuse the Bookings/Search tab pattern):
- **All** — all available products (Memberships + Credit Packages + Gift Cards).
- **Packages** — Memberships **and** Credit Packages.
- **Gift card** — Gift Cards only.

Only `status === "active"` products for the **active branch** are shown (active-studio scoped; switching the branch re-scopes all tabs).

**5.3 Active Plan card (conditional).** Figma `3298-73796`. For a member who **already holds an active plan**, render the **Active Plan card** **below the tabs and above the product list** — summarising the current plan (per the design). Members with no active plan do not see it. (Ownership invariant: one Membership OR one-or-multiple Credit Packages — §6.)

**5.4 Product list.** A vertical list of the reusable **Product Card** (Figma `2225-14011`, built once on the All tab, reused by Packages + Gift card). Each card shows the product per design and a **"+" button**. **Tapping "+" opens the Product Details bottom sheet** (§Phase 2) for that product.
- Primary surface is a bordered "view card" with an explicit **`min-h-[760px]`** (CLAUDE.md #7 — fill, never hug) so the page does not jump when switching tabs.
- **Loading:** skeleton cards filling the view card. **Empty:** per §8.

---

### Phase 2 — Product Details bottom sheet — Figma `3465-46734`

Opened by a card's **"+"**. Reuse `ProductDetailsSheet` (`MemberSheet` + `SheetToolbar`). The **same information structure for all product types**, differing only in the overview line:

**5.5 Content:**
- **Product icon** — by type:
  - **Membership** → Figma `2452-32515`.
  - **Credit Package** → Figma `4014-48508`.
  - **Gift Card** → Figma `2452-32515`.
- **Product name.**
- **Product overview:**
  - **Memberships / Credit Packages:** `Credits amount · Duration` (e.g. "10 credits · 1 month"; `"unlimited"` → "Unlimited"). Reuse the existing `PlanRow.sub` formatting in `purchase.ts`.
  - **Gift Cards:** `Custom amount` (**only shown when customized**) · `Valid until [date]`.
- **Product price** (`AED [price]`).

**5.6 Bottom navigation (sheet footer):**
- **Quantity selector** ( − / + ).
- **Add to cart** button (primary).

### 5.7 Add to Cart logic

| Product added | Behaviour | Reuse |
|---|---|---|
| **Membership** | Continue **directly to Checkout Cart** (§Phase 3). A membership is **exclusive w.r.t. memberships/packages** — it replaces any membership/package in the cart but **keeps any gift card** already added. | `addToCart(item, 1)` (membership branch, extended to preserve gift cards — §3.3 #2) → route to `/member/products/checkout`. |
| **Credit Package** | **Return to the Product List** and show the **Floating Cart Card** (§5.8) above the bottom navigation. Packages **stack** (quantity accumulates). | `addToCart(item, qty)` (package branch) → close sheet, stay on catalog. |
| **Gift Card** | **Add to cart opens the Gift Card Information page first** (§5.7a) to fill in the recipient + amount (custom only) + optional message. **Confirm** adds the gift card to the cart, then **returns to the Product List + Floating Cart**. Gift cards are **non-exclusive** — they coexist with a membership **or** packages ("you can add a gift card with a membership too"). | Requires the additive `"gift_card"` `PlanKind` + non-exclusive `addToCart` + the Information fields (§3.3 #1/#2). |

### 5.7a Gift Card Information page — Figma `2452-33549`

Full-screen step, header "Gift card information" + back. Reached from a **gift card's Add to cart** (§5.7). Fields, top → bottom:
- **Recipient name** — text input ("Recipient name…").
- **Recipient email** — text input ("Recipient email…").
- **Amount** — **custom gift cards only** (`value_type === "custom"`). A numeric amount field ("AED gift card amount") with the helper line **"Enter an amount between AED [min] and AED [max]"** (the design's min/max, e.g. AED 50–250). For **fixed** gift cards this field is **omitted** (the amount is the design's fixed value). Out-of-range blocks **Confirm** with the inline bound reason; **never silently clamp** (§6, §8).
- **Add personal message** *(optional)* — textarea ("e.g Happy birthday Paula! Enjoy your classes 🎉") with a **0/120** character counter.
- **Confirm** (sticky bottom, primary) — **disabled until** recipient name + recipient email (+ a valid custom amount, when applicable) are provided. On Confirm → add the gift card to the cart (carrying recipient/amount/message — §3.3 #1) → return to the catalog + Floating Cart.

**5.8 Floating Cart Card** — Figma `3298-70460`. After a package (or gift-card) add, a card floats **above the bottom navigation** on the catalog showing the cart summary (count + total per design) with an action to open the **Checkout Cart**. Reuse the `purchaseCart` count/total helpers (`cartCount()`, `cartTotal()`).

---

### Phase 3 — Checkout Cart (`/member/products/checkout`) — Figma `3298-70846`

Full-screen, header with back (`x`/`chevron-left`) → returns to the catalog (cart preserved). Reuse the built checkout screen. Top → bottom:

**5.9 Product overview** — the cart item(s): name, per-package quantity stepper where applicable, unit price (reuse `ProductBadge` + the existing item rows).

**5.10 Payment methods** — selectable list (single-select via `RadioDot`):
- **Apple Pay**
- **Visa**
- **Credit Card**
- **Gift Card** *(only shown when available — i.e. the member has a usable gift-card balance)*

**5.11 Add gift card** button — adds a gift card as a payment source (per design).

**5.12 Apply Promo section** — clickable (§Phase 4).

**5.13 Payment details** — breakdown:
- **Subtotal**
- **Tax rate** (10% — `TAX_RATE_PCT`)
- **[Promo discount]** line when a promo is applied
- **Total**

Computed via `computeTotals(cartTotal(), promo)`.

---

### Phase 4 — Apply Promo flow

**5.14 Apply Promo section (clickable)** — Figma `3298-70908`. In the Checkout Cart, the Apply Promo row is tappable → opens the **Voucher List** (§5.15).

**5.15 Voucher List** (`/member/products/checkout/promo`) — Figma `3704-78631`. Reuse the built promo-list screen + `PromoCard`:
- A **manual promo code input** (Figma `3704-78688`) with an **Apply** action.
- The list of **voucher cards** (`usePromos()` → `PromoVM`). Only `applicable` promos (percentage / fixed amount) can be applied; non-discount offers show disabled per the built pattern.
- **Expired promos use grayscale images.**
- Tapping a card → **Promo Details** (§5.16).

**5.16 Promo Details** (`/member/products/checkout/promo/[promoId]`) — Figma `3704-78762`. The voucher's full detail (label, description, validity, locations from `PromoVM`). Primary **Apply** button.

**5.17 Applying a promo:**
- Clicking the primary **Apply** on an active promo/voucher (from the list or detail) sets `purchaseCart.promoId`, returns to the Checkout Cart, and the **Apply Promo section becomes a success badge displaying the promo name** (e.g. **"20% OFF"**) — Figma `3704-80245`. The discount line + Total recompute live. Toast "Promo applied".
- **Clicking the promo section again** reopens the **Voucher List with the selected promo**, and that voucher's button changes from **Apply** → **Cancel** (use the existing **destructive secondary** button style). Cancelling clears `purchaseCart.promoId`, returns to checkout (section reverts to "Apply Promo"). Toast "Promo removed".

**5.18 Promo errors (manual code)** — Figma `3704-78661`. When a manually entered code is invalid, show the inline error state:
- **Expired promo** — the code matched a promo past its validity.
- **Promo not found** — no matching code.

One promo per transaction.

---

### Phase 5 — Checkout Action — Figma `3298-70571`

**5.19 Sticky bottom navigation:**
- **Left:** **Total** amount (`AED [total]`).
- **Right:** primary **Pay now** button.

**5.20** Tapping **Pay now** → snapshot the order (`lastOrder` / `OrderSnapshot`) → open the **Loading** screen (§Phase 6).

---

### Phase 6 — Loading / Payment Processing (`/member/products/checkout/processing`) — Figma `3298-70428`

**5.21** Reuse the **existing Loading Screen component** (the booking processing loader) with **payment-related copy**. Transient full-screen loader (no nav, no back); presentational over the synchronous store write. On completion → **Payment Success** (§Phase 7).

---

### Phase 7 — Payment Success (`/member/products/checkout/success`) — Figma `3298-70578`

**5.22** Full-screen **Payment Success overview** (success mark + order summary per design). The store writes have committed (plan / gift card / transaction — §7). Primary action depends on what was bought:
- **Packages / Memberships → "View plan"** → opens the **plan page under Profile**.
- **Gift cards → "View gift card"** → opens the **gift card page under Profile**.

A close affordance returns to the Products catalog (cart cleared). Toast on the completed purchase (§10).

---

## 6. Ownership & business rules

1. **Active-only, active-studio catalog.** Only `status === "active"` products for the active branch are listed. The Branch Selector scopes the catalog; switching re-scopes all three tabs. (Admin brief; `usePurchasePlans` already filters `status === "active"`.)
2. **Self-scope only.** Members purchase **for themselves**; the cart, plan, gift card, and transaction are always the authenticated member's. No walk-in/anonymous option.
3. **Ownership invariant — one active plan.** A customer may hold **one Membership** OR **one-or-multiple Credit Packages** — never a membership *and* a package, and never two memberships (admin/Profile model). **Gift cards are not "plans"** and fall outside this invariant — a gift card can be bought alongside a membership or packages. The **Active Plan card** (§5.3) surfaces the current plan for members who hold one.
   - *Not specified by this prompt/Figma:* the exact interaction when a member who already holds a membership adds a different membership (replace vs block). **Flag for decision** — do not invent a replace/comparison UI here.
4. **Cart rules.** Membership → exclusive w.r.t. memberships/packages, straight to checkout (keeps any gift card). Credit Package → stack, return to list + Floating Cart. **Gift Card → fill the Gift Card Information page (§5.7a) first, then add non-exclusively** (coexists with a membership or packages) and return to list + Floating Cart.
5. **Tax.** Flat **10%** on the subtotal (`TAX_RATE_PCT`, the Figma "Tax rate (10%)" line) via `computeTotals`.
6. **Promo (one per transaction).** Reuse `usePromos` / `promoDiscount`: only `percentage` / `fixed_amount` offers are applicable; applying sets `purchaseCart.promoId` and shows the success badge; cancelling clears it (destructive-secondary). Manual code → match by `code` (case-insensitive); no match → **Expired promo** / **Promo not found** inline error. Expired vouchers render grayscale.
7. **Payment methods are exactly:** Apple Pay · Visa · Credit Card · **Gift Card (only when available)**, plus the **Add gift card** action. **No other methods** (no wallet, no split — not in this prompt/design). Card payments are **simulated-approved** (prototype convention).
8. **No member overrides.** Members never get custom/manual discount, complimentary/no-charge, cash drawer, refunds, or any role-gated action (Admin brief / Search brief §10).
9. **Mock data is read-only.** Never modify/regenerate/reshape any `src/data/mock/*` seed. Demo purchases are **live store writes** persisted via `onra-demo-state`. Any needed additive schema change (§9) is **flagged and approved first** — append a column/union member, never reshape rows.

---

## 7. Cross-module sync (same render cycle)

Every write goes through the shared Zustand store and reflects on dependent surfaces in the **same render cycle** (CLAUDE.md #6):

| Member action (this module) | Store writes | Surfaces that must reflect it |
|---|---|---|
| **Buy membership** | new active membership plan (`customerPlans`, `kind: "membership"`) + a completed transaction | **Profile › plan page** (View plan); admin customer profile (PRD 07); Dashboard / Analytics revenue |
| **Buy credit package(s)** | new package plan row(s) (`kind: "package"`, credits + expiry) + transaction | **Profile › plan page**; admin customer profile; Dashboard / Analytics |
| **Buy gift card** | issued gift card (`addIssuedGiftCard`) + transaction | **Profile › gift card page** (View gift card); admin issued gift cards; admin customer payments |
| **Apply promo on a completed purchase** | promo usage increment | admin promo usage stats |
| **Pay (any completed purchase)** | one transaction row | admin transaction history; Dashboard revenue |

When entered from **Search → Purchase Product**, a successful purchase returns to the **Booking Confirmation** with the new plan **pre-selected and active** in the footer (Search brief §5.17).

---

## 8. States & empty states

Implement Loading / Empty / Success / Error for the catalog, Product Details sheet, Checkout Cart, Voucher List, and Payment Success.

| State | Behaviour |
|---|---|
| **Loading** | Catalog → skeleton Product Cards inside the `min-h-[760px]` view card. Checkout → skeleton breakdown. Never a blank flash. |
| **Empty** | Reuse `SearchEmptyState` (icon + one-line message), **filling the available height** (the `flex-1` centred pattern used in Search/Bookings/timezone). • **Catalog tab empty** (no active products for the studio) → "No products available yet." • **Voucher List empty** (no promos) → "No vouchers available." • Sections that should vanish when empty (Gift Card payment method when no balance) are **hidden**, not empty boxes. |
| **Success** | Completed purchase → Payment Success screen + success toast + reactive plan/gift-card/transaction update across Profile + admin surfaces (same render cycle). |
| **Error** | Inline, non-destructive, cart/input preserved: • **Promo invalid** → **Expired promo** / **Promo not found** (Figma `3704-78661`). • **Custom gift-card amount out of range** → "Enter an amount between AED [min] and AED [max]." Confirm disabled (§5.7a). • **Simulated payment decline** *(prototype convention)* → cart preserved, no plan/gift card/transaction written. No new error types beyond these. |

> No purchase-history, receipt, refund, upgrade-comparison, auto-renew, wallet, or split-payment surfaces are part of this design — they are **out of scope** for this brief (not in the prompt/Figma).

---

## 9. Data model & seed-shape flags (read-only seeds)

Reads come from the live store over the read-only seeds; writes go through the store. **Flag (do not silently change a seed — append only, bump persist `version` if breaking):**

| Concern | Note |
|---|---|
| `memberships`, `packages` | Catalog + Product Details (active only). Already wired via `usePurchasePlans`. |
| `gift_card_designs` | **Gift card** tab catalog + the Gift Card Information page (§5.7a). `value_type` drives the Amount field: `fixed` → no field (uses `fixed_value_aed`); `custom` → numeric field validated against `min_value_aed`/`max_value_aed`. Requires the additive `"gift_card"` `PlanKind`/source (§3.3 #1). The seed today has only `fixed` designs — the **custom-amount** path has **no custom seed row to exercise it**; flag if a custom design is needed (append only if instructed). |
| `promo_codes` | Voucher List + manual code + discount (`usePromos` / `promoDiscount`). Already wired. |
| `payment_methods` / gift-card balance | Checkout payment list (Apple Pay · Visa · Credit Card · Gift Card-if-available). Saved cards are demo-global (no per-customer FK) — treat as the member's for the demo. |
| `customerPlans` | **Written** on membership/package buy. |
| `issuedGiftCards` (`addIssuedGiftCard`) | **Written** on gift-card buy. |
| `customerTransactions` | **Written** on every completed purchase. `kind` union may need an additive `"gift_card"` member (flag). |
| Cart origin | `purchaseCart.classId` → generalize to an origin id so the Products catalog and the booking flow share the cart without collision (§3.3 #2). |

Resolve the active member via the same demo-persona flip the rest of `/member/*` uses; all reads/writes self-scoped.

---

## 10. Notifications & toasts

- **Toasts** (`showToast`, CLAUDE.md #4 — every action) via the shared `MemberToast`: "Promo applied" / "Promo removed"; "Membership purchased"; "Package purchased"; "Gift card purchased"; manual-code failure surfaces **inline** (Expired promo / Promo not found), not a toast; a generic failure toast on a blocked Pay now.
- A **payment / purchase notification** follows the platform's existing notification pattern on a completed purchase (deep-linking to the relevant Profile page) — no new notification types beyond what the platform already defines.

---

## 11. Navigation paths (map)

```
Bottom nav: Products ──► /member/products ─┬─► [Branch Selector] ► /member/select-branch (back)
                                           ├─► tabs: All · Packages · Gift card
                                           ├─► [Active Plan card]  (shown if member has an active plan)
                                           └─► Product Card "+" ──► Product Details sheet
                                                  │
        Product Details (Add to cart) ─┬─ Membership ─► /member/products/checkout
                                       ├─ Credit Package ─► back to list + Floating Cart Card
                                       └─ Gift card ─► Gift Card Information (/products/gift-card/[id]) ─► Confirm ─► list + Floating Cart
                                                                              │ (Checkout) ▼
   Checkout Cart (/member/products/checkout)
        ├─ Apply Promo section ─► Voucher List (/checkout/promo) ─┬─ Promo Details (/promo/[id]) ─► Apply
        │                                                          ├─ manual code ─► Apply / error (Expired · Not found)
        │                                                          └─ Apply ─► back (success badge "20% OFF")
        │                                                              └─ section tapped again ─► Voucher List (Apply → Cancel)
        └─ Pay now ─► Loading (/checkout/processing) ─► Payment Success (/checkout/success)
                                                              ├─ View plan ──────► Profile › plan page
                                                              └─ View gift card ─► Profile › gift card page
```

---

## 12. Rules footer

1. **Always use `<Button>`** from `src/components/ui/button.tsx` (catalog "+", Add to cart, Apply, Cancel-promo [destructive secondary], Pay now, View plan / View gift card); `className` overrides for one-offs, never raw `<button>` (CLAUDE.md #1).
2. **Create/data-entry = full-screen, bottom nav hidden** (checkout, voucher list/detail, processing, success); **the Product Details sheet + Floating Cart are overlays on the catalog** (nav stays). Add `/member/products/checkout` to `isFullScreen` (CLAUDE.md #2/#3).
3. **Every action emits a toast** via `showToast` (CLAUDE.md #4; §10).
4. **Actions actually work and propagate** through the Zustand store so Profile (plans / gift cards) and admin/analytics/dashboard surfaces update in the **same render cycle** — no stub handlers (CLAUDE.md #6; §7).
5. **Bordered view cards have an explicit min-height** (`min-h-[760px]`) — fill, never hug — for the catalog body (CLAUDE.md #7).
6. **Reuse the existing machinery** — `purchase.ts` cart/promo/totals, `ProductDetailsSheet`, the checkout / promo-list / promo-detail / processing / success screens, `PromoCard`, `ProductBadge`, `MemberHeader` + Branch Selector, `MemberToast`. Extend **additively** (gift-card `PlanKind`, Products-origin cart); **do not fork** (Search brief §5.17; CLAUDE.md).
7. **Preserve mock data — read-only** (Admin brief / Search brief §17): never modify/regenerate/reshape a seed; issued gift cards + transactions are **financial records — never deleted**; demo purchases are live store writes persisted via `onra-demo-state`. Any additive schema change (§9) is **flagged and approved first**. Currency always `AED [amount]`; member surface is mobile-only at 375px in the centred `max-w-[500px]` column with no phone frame, `@untitledui/icons` only.
8. **Introduce nothing new** beyond this prompt + the referenced Customer/Admin briefs — no extra business rules, validation, states, payment methods, empty states, edge cases, or interactions (e.g. no split payment, wallet, upgrade comparison, purchase history, receipts, refunds, or auto-renew mechanics).
