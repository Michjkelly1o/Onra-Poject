# Analytics — Reports & Insights — status & production work (dev handoff)

**Verdict — real, correct, and largely production-shaped.** The reporting layer is genuinely store-derived and mathematically sound, not a mock:

- **33 reports** are thin wrappers over one shared `PivotableReportShell` driven by a registry (`src/config/reports-registry.ts`) + 14 real selectors (`src/lib/reports/selectors.ts`). No hardcoded tables; 0 stub reports.
- The **refund model is correct**: a same-day + unsettled refund is a **void** (sale erased from its period), a later refund is a **negative row in the refund's own period**, and **past months are never restated** (`src/lib/reports/refunds.ts:85-155`).
- **Recognized revenue** is correct and shared with the dashboard/insights (`src/lib/reports/recognized-revenue.ts`).
- **Export is real** — Excel via SheetJS and CSV both produce real downloads that respect the active filters + visible columns.
- **Insights** (`/admin/insights`) is a fully live tiles dashboard; its `src/lib/kpi/*` selectors reuse the same report selectors, so tiles and reports agree by construction.

This doc lists what a real dev still needs to close.

Cross-references: [`rbac-and-permissions.md`](rbac-and-permissions.md), [`backend-and-auth.md`](backend-and-auth.md), [`payments-and-pos.md`](payments-and-pos.md).

---

## Fixed during this audit
- **Insights referrals now respect branch scope.** The Marketing "Referrals" tile and the Customer "Win-back rate" tile read `customerReferrals` raw, ignoring the Location filter (every sibling slice was branch-scoped). Now filtered by the referral's `originBranchId`.
- **ARPM's fabricated delta dropped.** "Avg revenue per member" used `activeMembersPrior = activeMembersCur` (a demo approximation), so its trend chip wasn't a real prior-period comparison. It now shows no chip (a snapshot metric, like MRR/LTV) rather than a fake delta.

---

## 1. RBAC is decorative at the list level — HIGH (security, app-wide theme)

- The per-report `rbac` field in every config is **dead metadata** — nothing reads it anywhere (`types.ts:158` types it; only a comment references it).
- The reports landing `/admin/reports` filters the catalogue **only by feature-flags**, not role — every persona sees all reports (`src/app/admin/reports/page.tsx:199-207`). Instructors simply have no reports nav link (access-by-omission, not enforcement).
- **Branch-admin branch scoping is not enforced** — the shell defaults `visibleBranchIds` to all branches for everyone (`PivotableReportShell.tsx:253-255`); `total-sales/page.tsx:205` even admits scope "is enforced upstream." The helper `use-default-branch-filter.ts` exists but is **used by zero pages**.
- No route-level guard on `/admin/insights` (or `/admin/reports`) — reachable by direct URL regardless of `view_reports` (`src/app/admin/layout.tsx` + `src/middleware.ts` do no role checks).

**What IS real:** instructor **data-level** scoping works on the 4 instructor-facing reports (`instructor-performance`, `class-performance`, `bookings`, `staff-attendance`) via `use-instructor-scope.ts` — they filter rows to the signed-in instructor.

**Build:** enforce `rbac` in the landing list + a route guard, and derive branch scope from the authenticated user's assigned branches (RLS) — see [`rbac-and-permissions.md`](rbac-and-permissions.md).

---

## 2. Stubbed data fields in selectors — MEDIUM

These are real reports whose specific columns are hardcoded pending upstream wiring:
- **Cancellations & No-shows: `charge` is always `0`** and `paymentStatus` always `""` (`selectors.ts:707-708`). The report can't show real late-cancel/no-show penalty AED until penalty settings thread through — the `computeCancellationPenalty` logic exists (`store.ts:8203`) but isn't wired into `selectBookings`.
- **`waitlistConverted` is a dead field** — declared and emitted but never incremented (`selectors.ts:757,796`), so waitlist-conversion always reads 0.
- **Retail tax = 0** — reads `t.taxAed ?? 0` but the seed carries none (`selectors.ts:1126,1233`); retail tax "lands in a later commit."

**Build:** wire the cancellation penalty into `selectBookings.charge`; compute `waitlistConverted` from promoted bookings; populate retail tax.

---

## 3. Consistency / refactor items — MEDIUM/LOW

- **Revenue Recognition report re-implements recognition inline** (`revenue-recognition/page.tsx:104-140`) instead of calling the shared `recognizedRevenueLineItems` engine — a drift risk (the report could disagree with the dashboard). Route it through the shared engine.
- **Classes "Sales/Revenue" tiles include private + recovery** money (`class.ts:143` via `revenueTotals` → the full ledger), though the comment states "membership + package = the class economy." This overlaps the dedicated Private/Recovery tabs. Decide: relabel the tiles, or filter the ledger to membership+package for the Classes tab.
- **Retail same-day refund is never collapsed to a void** — `selectRetailSales` always emits a later-style negative row (`selectors.ts:1249-1261`) because retail has no settlement timeline. Safe (never restates a past period) but diverges from the ledger's void rule; disclosed in-code.
- **Payments report `revenueCategory`** is TS-cast to `"membership" | "package"` but private/recovery kinds also flow through (`selectors.ts:487`) — the runtime value is the real kind, but the narrow cast/label handling should be widened.
- **Marketing spend attribution** counts any month intersecting the window in full (no pro-rata) — a documented approximation affecting CPL/CAC/ROAS (`marketing.ts:145`).

---

## 4. Dead code to remove — LOW
- `src/components/reports/ExportDropdown.tsx:59` — legacy "export coming soon" toast, **not used** by any report page (the pivot shell uses its own real exporter).
- `reports-registry.ts:89-94` — a `DEFERRED()` throwing stub, **unreferenced** by any dispatch entry.
- `src/components/reports/use-default-branch-filter.ts` — real but **unused** hook (branch-admin scoping never wired).

---

## Priority
1. **RBAC enforcement + route guards + branch-admin scope** (§1) — security, and part of the app-wide RBAC work.
2. Wire the stubbed selector fields (§2) — cancellation charge, waitlist conversions, retail tax.
3. Route the Revenue Recognition report through the shared engine; resolve the Classes revenue label/overlap (§3).
4. Remove the dead export/branch-filter code (§4).
