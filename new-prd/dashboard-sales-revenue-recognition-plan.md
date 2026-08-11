# Dashboard — Sales vs Revenue (credits-used) + Renewal-window fix — Implementation Plan

**Status:** PLAN ONLY (2026-08-11). Nothing implemented. Confirm the formulas + sub-decisions
below, then I build phase-by-phase, committed locally, verified real (no cosmetic / no wrong math).

---

## 1. Client feedback (source of truth)
- "for today — it shows **2 up for renewal** in needs attention then I open and it shows **5** people
  renewing." → the card count and its pop-up must match.
- "**Revenue is the credits used. Sales is the full packages.**" → two deliberately different numbers.
- User clarifications: renewal window = **today**; **Revenue = value of credits used, where credits
  come from packages OR credit-based memberships**; apply **consistently across all dashboard tabs +
  reports**; must be **correct math**, not cosmetic.

---

## 2. Target definitions
- **Sales = gross at point of sale** — the full amount charged when a customer buys (package /
  membership / etc.). Buy a 10-credit pack for AED 1,390 → **Sales +1,390** that day.
- **Revenue = recognized / earned** — the value of class credits actually consumed. Use 1 of 10
  credits → **Revenue +139** (1,390 ÷ 10). Credits come from **packages AND credit-based
  memberships**.
- Plain: **Sales = money in; Revenue = money earned.**

---

## 3. Current reality (audit 2026-08-11, file:line)

| Surface | Where | Current formula |
|---|---|---|
| Today · **Sales** | `admin/dashboard/page.tsx:817,873` | **COUNT** of today's billable sale txns (not money) |
| Today · **Revenue** | `:818,880` | **SUM full `amountAed`** of today's billable sales (gross cash-basis) |
| Performance · Sales | `:972,1080` | SUM full `amountAed` in period ✅ already = gross |
| Performance · **Revenue** | `:979-1034,1088` | **Accrual engine `accrueRevenue`**: packages = `amount/credits × credits-used-in-range` (dated bookings); **all** memberships = straight-line by `duration_months×30` |
| Coming Up · Revenue (expected) | `:1200-1208` | Forward **projection**: recurring next-billing + past-window gross sales |
| Coming Up · Recurring revenue | `:1168,1343` | Σ full `nextBillingAmountAed` of auto-renewing memberships |
| Reports · Total Sales / ledger | `lib/reports/selectors.ts:442` | full gross `amountAed` (signed) ✅ = gross |
| Reports · **Revenue Recognition** | `reports/revenue-recognition/page.tsx:100,124-153` | **packages recognize 0** (`classBookings:[]` passed in); memberships straight-line, **term hardcoded to 1 month** (ignores `duration_months`) |
| Insights tab revenue tiles | `admin/insights/page.tsx:55-82` | **hardcoded static AED** (mock, unwired) |

**Two recognition implementations exist and disagree:** the Performance card (`accrueRevenue`)
recognizes package revenue from dated bookings; the Recognition report deliberately passes
`classBookings: []` and recognizes nothing for packages. **Neither** treats credit-based memberships
as per-credit.

**Data available (verified):**
- **Gross sales** per product: `CustomerTransaction.amountAed` grouped by `kind`/`productId`
  (`store.ts:2171-2225`). One flat row per sale — no line-items.
- **Dated "credit used" events: YES** — `ClassBooking` carries `planId`, `planKindUsed`
  ("package" | "membership"), dated `bookingTime`, `status` (`store.ts:1211-1219`). A non-cancelled
  booking = one dated credit consumption against that contract. (Performance already uses this for
  packages at `page.tsx:1015-1021`.) → derivable for **packages AND credit-based memberships**; no
  schema change needed.
- **Per-credit value = `price_aed ÷ credits`**, computable for packages (`packages.ts`: `credits`,
  `price_aed`) and credit-based memberships (`memberships.ts`: numeric `credits`, `price_aed`).
  Unlimited memberships have `credits: "unlimited"` → no denominator.
- ⚠️ Verify at build: for a membership booking, `ClassBooking.planId === membership txn `productId``
  (booking sets `planId = customer.membershipId`; the membership sale txn's `productId` is the
  membership id) so credits-used can be attributed to the right contract.

---

## 4. Exact formulas (the engine)

Build ONE shared recognition engine (extend/replace the Performance `accrueRevenue`, move it to
`src/lib/reports/recognized-revenue.ts`) used by **Today, Performance, and the Recognition report**
so all three always agree.

**Sales(period, scope)** = `Σ amountAed` over transactions where `isBillableSale(t)` (status
`complete`, `transactionType ∈ {undefined,"sale"}`, `kind ∉ {cancellation_penalty, freeze_fee}`),
`createdAtISO ∈ period`, matching the location + session-type scope. Refunds subtract. (Same gross
model Performance/Reports already use — just applied to Today too.)

**Revenue(period, scope)** = Σ, per billable sale txn `t`, the value **recognized within the period**:
- **Package** (`kind="package"`): `perCredit = t.amountAed / pkg.credits`; `revenue += perCredit ×
  (# non-cancelled class_bookings with customerId=t.customerId, planKindUsed="package",
  planId=t.productId, bookingTime ∈ period)`.
- **Credit-based membership** (`kind="membership"`, `mem.credits` numeric): identical to package,
  `perCredit = t.amountAed / mem.credits`, counting bookings with `planKindUsed="membership"`,
  `planId=t.productId`. **(NEW — this is the piece missing everywhere today.)**
- **Unlimited membership** (`kind="membership"`, `mem.credits="unlimited"`): straight-line —
  `revenue += t.amountAed × (overlapDays(membership active window ∩ period) / (duration_months×30))`.
  (No credits → time basis. **Sub-decision D-B.**)
- **Retail** (`kind="retail"`): delivered at sale → recognize `amountAed` if `createdAtISO ∈ period`.
- **Private / Recovery** (`kind ∈ {"private","recovery"}`): a single delivered session →
  **Sub-decision D-C** (recognize at sale, or at the appointment's delivered date).
- **Gift card**: deferred → recognize at redemption; excluded from billable sales today anyway
  (**Sub-decision D-F** — leave excluded for now).
- **Refunds**: subtract the recognized-to-date portion (keep existing signed handling).

Everything reads existing helpers (`derivePlanBalances`, `packages.credits`, `memberships.credits`,
`memberships.duration_months`, `ClassBooking.{planId,planKindUsed,bookingTime,status}`) — no new
data model.

---

## 5. Surfaces to change (kept consistent by the shared engine)
1. **Today · Sales** (`page.tsx:817,873`) — **Sub-decision D-A**: change from a COUNT to the **gross
   AED** value (so it means "full packages," consistent with Performance/Reports).
2. **Today · Revenue** (`page.tsx:818,880`) — switch from gross to **Revenue(engine, today)**.
3. **Performance · Revenue** (`page.tsx:979-1034`) — extend `accrueRevenue` so **credit-based
   memberships recognize per-credit-used** (today they're time-based); unlimited stay time-based.
4. **Reports · Revenue Recognition** (`revenue-recognition/page.tsx:100,62,124-153`) — pass the **real
   `classBookings`** (remove `classBookings: []`), use **real `duration_months`** (drop the hardcoded
   1-month term), and add the **per-credit basis for packages + credit-based memberships**. Reuse the
   shared engine.
5. **Reports · Total Sales / ledger** (`selectors.ts:442`) — already gross → **keep as Sales**, no
   change (just confirm it stays the Sales side).
6. **Coming Up · Revenue / Recurring** (`page.tsx:1168-1208,1343`) — **Sub-decision D-D**: this is a
   forward *projection* (expected future income), a different metric from recognized Revenue. Recommend
   **leave the math**, only make the label unambiguous ("Projected/Expected") so it isn't confused
   with recognized Revenue.
7. **Insights tab tiles** (`insights/page.tsx:55-82`) — **Sub-decision D-E**: currently hardcoded;
   either wire to the shared engine or leave as mock for now.

---

## 6. Renewal-window fix (the 2-vs-5)
- **Card** (`page.tsx:1509-1511`): `expiryISO === today && autoRenew` → e.g. 2.
- **Modal** it opens (`NeedsAttentionModals.tsx:349-365`, invoked with `forwardRangeDays={comingRange}`
  at `page.tsx:2114`): `expiryISO ∈ [today, today+N]`, **no autoRenew filter** → e.g. 5.
- **Fix:** the Needs-Attention renewal card + its modal both use **`expiryISO === today && autoRenew`**
  (per your "today" answer). Give `RenewalDueModal` a same-day / auto-renew-only scope when opened from
  Needs Attention, so the count equals the list. The **Coming-Up** "Renewals due" card keeps the
  forward window (its count already matches the modal in that mode).

---

## 7. Sub-decisions to confirm (defaults in **bold**)
- **D-A** — Today "Sales" card: change COUNT → **gross AED value** (recommended, matches "full
  packages" + Performance). Or keep it a count?
- **D-B** — Unlimited memberships in Revenue: **straight-line over duration** (recommended; no credits
  to use). Or exclude unlimited memberships from Revenue?
- **D-C** — Private/Recovery in Revenue: **recognize at sale** (simple) or at the appointment's
  delivered date?
- **D-D** — Coming-Up "Revenue/Recurring": **keep as a forward projection, relabel for clarity**
  (recommended) — don't fold it into recognized Revenue.
- **D-E** — Insights revenue tiles: **wire to the shared engine** (recommended) or leave as mock?
- **D-F** — Gift cards: **leave excluded** from Revenue for now (recognize at redemption later).

---

## 8. Phased implementation (after confirmation)
- **Phase 1 — Renewal-window fix.** Make the Needs-Attention renewal card + its modal both today +
  auto-renew. Smallest, self-contained. Accept: card count === modal list.
- **Phase 2 — Shared recognition engine.** Create `src/lib/reports/recognized-revenue.ts` (one
  Sales() + one Revenue() with the §4 formulas), unit-tested against seed data (package, credit-based
  membership, unlimited membership).
- **Phase 3 — Wire the dashboard.** Today Sales → gross (D-A); Today Revenue → engine; Performance
  Revenue → engine (adds per-credit memberships). Accept: each card == its drill-down modal, and
  Today/Performance agree on the same definition.
- **Phase 4 — Reports.** Fix the Revenue Recognition report to use the engine (real bookings, real
  term, per-credit memberships); confirm Total Sales stays gross. (D-E: Insights.)
- **Phase 5 — QA.** Verify Sales ≥ Revenue always (you can't earn more than you sold), refunds
  reduce both correctly, past periods never restate, and location/type filters flow through.

---

## 9. Hard rules
1. **One engine, used everywhere** — Today, Performance, and the Recognition report must return the
   same recognized Revenue for the same period (today they disagree).
2. **Real data only** — recognized Revenue derived from dated `class_bookings`, not from a static
   balance; Sales from real `amountAed`. No hardcoded numbers.
3. **Sales ≥ Revenue** as an invariant (recognized never exceeds gross sold).
4. **History never restated** — recognition is computed per period from immutable bookings/txns.
5. Commit local per phase; verify `tsc` + `next build`; card always equals its modal.
