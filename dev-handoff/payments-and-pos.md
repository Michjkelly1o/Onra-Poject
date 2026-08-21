# Payments & POS — prototype vs. production (dev handoff)

**Verdict:** the entire payment layer is a UI/state simulation over the Zustand store. There is **no payment gateway, no network call, no settlement, no idempotency, no webhook, and no failure path** anywhere. Every "payment" is a `setTimeout` followed by a local store write. Confirmed: zero `fetch`/`stripe.`/`paymentIntent`/`webhook`/`idempoten` references in `src/app/pos`, `src/app/admin/pos`, `src/components/checkout`, `src/app/schedule`.

Depends on [`backend-and-auth.md`](backend-and-auth.md) (a server must exist) and [`integrations.md`](integrations.md) §2 (Stripe/wallet *connection* is also faked).

---

## 1. Card approval — auto-approved — CRITICAL

**Now:** select a saved card → "Confirm" → `loading=true` → wait **1600ms** → receipt with a hardcoded status **"Approved"**. No authorization, CVV, 3DS, or tokenization. Only gate is `selectedCardId !== null`. Saved cards are static seed rows (brand + last4).

- `src/app/pos/checkout/page.tsx:173-177` (`handleConfirmPurchase` → `setTimeout(…1600)`); `src/components/checkout/PosCheckoutPanel.tsx:134-138`
- `src/components/checkout/CheckoutScreen.tsx:982` — receipt hardcodes `Status = "Approved"`
- Saved cards: `CheckoutScreen.tsx:58-63` (`savedCardsFor` over `PAYMENT_METHODS`)

**Build:** Stripe PaymentIntents (or Terminal). Create the intent server-side, tokenize the card via **hosted fields / Elements / Terminal (never store PAN — PCI-DSS SAQ-A)**, handle `requires_action`/3DS, and mark "Approved" only on gateway confirmation. Add **idempotency keys** per sale and a **webhook** to reconcile async state (`payment_intent.succeeded`/`.payment_failed`).

---

## 2. Cash — change math real, drawer absent — MEDIUM

**Now:** `change = max(0, cashReceived − total)` (correct, but not persisted onto the transaction). No cash-drawer action exists at all (no ESC/POS kick, no reconciliation).

- Change/gate: `src/app/pos/checkout/page.tsx:153-154,166`; UI `CheckoutScreen.tsx:661-692`

**Build:** cash-drawer hardware (ESC/POS drawer-kick via a local print agent, or OPOS/JavaPOS); persist `cashReceived`/`changeGiven`; a cash-management layer (float, cash-in/out, end-of-day count).

---

## 3. Split / gift-card / wallet — store-only debits, no settlement — CRITICAL

**Now:**
- **Split payments: not implemented.** A single `paymentMethod` is chosen. Gift-card + account-credit act as pre-payment *reductions* to the total (`computeTotals` order: subtotal → tax → discount → account credit → gift card → total, `CheckoutScreen.tsx:1157-1185`); there is no multi-tender UI.
- **Gift card:** `redeemGiftCards()` debits the local store only, oldest-expiry first, flips spent cards to `redeemed` (`store.ts:5051`, balance `:10262`).
- **Member wallet:** debited inside `applyPurchase` as a local ledger write (`WalletTransaction`, `referenceType:"pos_sale"`); no real money movement.

**Build:** a true multi-tender/split engine (allocate a sale across N tenders, each authorized separately). Gift-card + wallet are **stored value** → must live in a transactional backend with **atomic debit + optimistic locking** (the current client cap-then-debit is race-prone across devices), double-entry ledger integrity, and settlement reconciliation. Redeeming a stored-value instrument must be one atomic server transaction, not two client `set()` calls.

---

## 4. Refunds — store-only status flip, NO role enforcement — CRITICAL

**Now:** `refundTransaction(id, method)` flips the transaction to `refunded`, reverses local side-effects (wallet credit-back, gift-card restore, retail stock restore, session cancel). **No gateway refund is issued** — no money returns. Refund method is a free `"cash" | "card"` choice unrelated to the original tender. **Role limits: NONE** — the only guards are `status === "complete"` and `isRefundable !== false`; there is **no role/permission check anywhere**, contradicting the PRD (Operator up to a limit, Front Desk no access).

- `store.ts:9296-9417` (impl), `:9316-9319` (only guards)
- UI: `src/components/customers/CustomerPaymentsTab.tsx:638-645`, gate `:823` (same two flags, no role)

**Build:** real gateway refund (Stripe Refund against the original charge, to the **original tender only**), idempotency key, `refund.updated` webhook reconciliation, a true negative/double-entry ledger row (not an in-place flip), and **server-side role/limit enforcement** (see [`rbac-and-permissions.md`](rbac-and-permissions.md)).

---

## 4b. Transactions module — all-customers ledger — INFO

The **Sales** nav group (formerly the top-level "Point of Sale" item) is now a
dropdown holding **Point of Sale** (`/admin/pos`) + **Transactions**
(`/admin/transactions`). The Transactions page is the **all-customers payment
ledger**: every `customerTransactions` row, newest first, with a Customer column,
a synthesized Transaction number (`#R-…`), Location filter, search (transaction
or customer), Status, Date & Time, and a per-row **Refund** action.

It **reuses the exact same view + refund flow as the customer-detail Payment
History tab** — the table atoms (`TxnIcon` / `TxnStatusBadge` / `RefundModal` /
`PaymentFilterPanel` / formatters / refund gating) are exported from
[`CustomerPaymentsTab.tsx`](../src/components/customers/CustomerPaymentsTab.tsx)
and shared, and refunds run through the same store `refundTransaction`. So this
table, the customer profile, and the Refunds report stay in lock-step — **and it
inherits every §4 refund caveat** (store-only status flip, no gateway refund, and
**no role/limit enforcement**). Layout mirrors the Private-sessions list (flush
on the admin chrome, table scrolls internally). File:
[`src/app/admin/transactions/page.tsx`](../src/app/admin/transactions/page.tsx).

## 5. Receipts / print — no print, fake delivery — MEDIUM

**Now:** the receipt is a React card only. **No print path exists** (no `window.print()`, PDF, or ESC/POS). Receipt/transaction IDs are `Math.random()`-generated client-side. Delivery is hardcoded copy: "This receipt will be automatically sent to the customer via email and SMS." — nothing sends.

- `CheckoutScreen.tsx:877-1005` (`ReceiptStep`), `:989` (fake email/SMS copy)
- IDs: `pos/checkout/page.tsx:117-118`

**Build:** server-generated **gapless sequential** receipt numbering; real receipt delivery (email/SMS — see [`notifications-delivery.md`](notifications-delivery.md)); thermal-printer support and/or PDF; **UAE tax-compliant fields (VAT/TRN)**.

---

## 6. Tax — real but client-side — MEDIUM

**Now:** settings-driven and genuinely computed (not fake) via `@/lib/tax-calc` (inclusive/exclusive, per-line vs per-invoice rounding, exempt/zero-rated) — but entirely **client-side**.

- Wiring `pos/checkout/page.tsx:147-152`; engine `CheckoutScreen.tsx:1089-1197`

**Build:** move tax computation **server-side to be authoritative** (client math is tamperable); persist the per-line tax breakdown on the transaction; ensure TRN compliance + immutable tax records for filing. (Minor: refactor the inline `require("@/lib/tax-calc")` at `CheckoutScreen.tsx:1125`.)

---

## 7. Processing states — simulated, no failure path — HIGH

**Now:** POS shows a spinner for a hardcoded 1600ms then jumps to the receipt (`CheckoutScreen.tsx:796-820`). The customer portal cycles 3 fake steps at 900ms each and **writes the purchase on mount regardless of any "approval"** (`PaymentProcessing.tsx:30-31,160-164`). **There is no decline/failure/timeout/retry path — every payment always succeeds.**

**Build:** drive the processing UI off real PaymentIntent status transitions; handle decline/failure/timeout/retry; never commit the purchase optimistically before authorization.

---

## Cross-cutting must-fix for production
- No backend / gateway / idempotency / webhooks (all client state).
- **No failure handling** — success is unconditional.
- **PCI**: saved "cards" are plaintext brand+last4 seed rows — a real build must never touch PAN.
- **IDs** are `Math.random()` (collision-prone, non-sequential) — must be server-issued and gapless for tax/audit.
- **No auth/roles on money-moving mutations** (refunds especially) — enforce server-side.
