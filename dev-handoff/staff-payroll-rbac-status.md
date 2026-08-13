# Staff / Payroll / RBAC — implementation status (dev handoff)

**Audience:** the engineer taking this prototype toward production.
**Purpose:** state plainly what in the Staff domain is real vs. prototype-simplified, so nothing here is mistaken for finished production behavior.
**Last updated:** 2026-08-13.

This prototype is a **demo built on a client-side Zustand store** (`src/lib/store.ts`) seeded from `src/data/mock/`. There is no backend yet. Everything below reflects that reality.

---

## ✅ Implemented and real (no action needed to demo)

- **Staff Overview charts** (`src/components/staff/StaffDetailPage.tsx`) — the three charts (Overall performance / Class bookings / Attendance overview) are derived **live** from the instructor's real `class_schedule` + `class_bookings`, bucketed by day. No hardcoded sample series. The metric-card **trend badges were removed** (not faked) because a reliable comparison period isn't derivable from the seed dates — the metric *values* are real.
- **Payroll counts real attendance** (`src/lib/payroll-calc.ts`) — per-attendee / tiered / revenue rates pay on the number of members marked **Present** (via `attendeesForClass`), not the booked count. A completed class where attendance was never taken falls back to `booked` so it never silently pays 0. Threaded through every payroll surface (`PayrollRunPage`, `PayrollInstructorDetailPage`, `admin/compensation`, `instructor/earnings`).

---

## 🟡 Deferred / prototype-simplified (a real dev must build these)

### 6. RBAC permissions matrix is **decorative** — HEADLINE ITEM
- **What you see:** each role has a grid of permission checkboxes (Roles & Permissions module). You can toggle and save them.
- **Reality:** those checkboxes are **display/edit only**. No module reads the matrix to gate what a user can actually do. Real gating is **hardcoded on the demo role string** (`currentRole`) — e.g. `canApplyCustomDiscount` / `maxCustomDiscountPct` in `src/lib/store.ts`, consumed at `src/app/admin/pos/page.tsx` and `src/app/schedule/[classId]/page.tsx`. Branch scope on the dashboard comes from a manual location multi-select, not from role assignment.
- **Why it's like this:** PRD 11 explicitly scopes "User Roles & Permissions" as **view-only for the prototype** (no custom role enforcement). So this is as-specced for the demo — but a production build must wire the matrix to an actual authorization layer (server-side checks + client capability reads) and drive branch scope from role assignments.
- **Exception — the AI-agent module already does real per-cell RBAC:** see [`dev-handoff/ai-agent-rbac.md`](ai-agent-rbac.md). Use that as the pattern to generalize.

### 3. Payroll adjustments (bonus / deduction) — store action exists, no UI
- **PRD:** `new-prd/10-staff-management.md` §"Manual Adjustment" (lines ~379–383): each instructor row should have an "Add Adjustment" field (amount + required reason), included in the total and logged.
- **Reality:** the store action `setPayrollEntryAdjustment` exists (`src/lib/store.ts`) but is **called from nowhere**. The payroll run flow only creates entries and flips status.
- **To build:** an adjustments input in the payroll run screen (`src/components/staff/PayrollRunPage.tsx`) that calls `setPayrollEntryAdjustment`, plus display of applied adjustments in the run + instructor detail.

### 4. Pay-rate edit is in-place (no "create new rate" model)
- **PRD / CLAUDE.md (Module 10):** "Create new rate when rate changes, never edit old one" — a used rate should be immutable; changes spawn a new rate.
- **Reality:** editing a rate calls `updatePayRate` in place regardless of usage (`src/components/staff/PayRateFormPage.tsx`). **Past PAID payroll is still safe** because earnings/commission are snapshotted onto the payroll entry at confirm time — but the rate record itself mutates, which deviates from the immutable-rate rule.
- **To build:** when editing a rate that has payroll usage, create a new rate version and archive/supersede the old one instead of mutating it.

### 5. No compensation / payroll report in Analytics
- **PRD:** `new-prd/09-analytics-reports.md` §10 "Compensation Reports" — instructor earnings summary accessible from the Analytics module.
- **Reality:** `payrollEntries` is consumed **only** inside the compensation module (`admin/compensation`, `PayrollRunPage`, `PayrollInstructorDetailPage`). The Reports module offers `instructor-performance` and `staff-attendance` but **no compensation/payroll report**, and no dashboard/KPI reads confirmed-run data.
- **To build:** a compensation report in the Reports registry (`src/config/reports-registry.ts` + a selector in `src/lib/reports/`) that reads confirmed payroll runs, by pay-rate type and period, RBAC-scoped (Owner/Branch Admin; Instructors own row only).

---

## Notes for whoever picks this up
- The payroll earnings math lives in **one** place — `earningsForClass` / `attendeesForClass` in `src/lib/payroll-calc.ts`. Change attendance/rate logic there; every surface inherits it.
- When a real backend lands, the seed files in `src/data/mock/` map one-to-one to future Supabase tables (snake_case), so they double as the initial migration/seed data.
