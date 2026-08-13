# RBAC & Permissions — prototype vs. production (dev handoff)

**Verdict:** roles and a full permissions matrix are **modeled and displayed**, but **enforcement is largely decorative**. Nothing is enforced server-side (there is no server — see [`backend-and-auth.md`](backend-and-auth.md)), and most client-side gating keys off the **demo persona string**, not the permissions matrix. In production, RBAC must be re-implemented as real authorization (Supabase Auth + Postgres RLS + server checks).

This is a **security-relevant** area: several money-moving actions have no role check at all today.

---

## 1. The permissions matrix is decorative — HIGH

**Now:** each role has a grid of permission checkboxes (Roles & Permissions module), editable and saved to the store. But **no module reads the matrix to gate what a user can do.** The matrix is read only to display/edit itself (`RoleDetailPage.tsx`, `StaffDetailPage.tsx`, `RoleFormPage.tsx`).

This is partly **as-specced**: PRD 11 scopes "User Roles & Permissions" as **view-only for the prototype**. But production needs the matrix wired to a real authorization layer.

Model already exists in data: `src/data/mock/roles.ts`, `permission_templates.ts`, `user_role_assignments.ts`. See [`staff-payroll-rbac-status.md`](staff-payroll-rbac-status.md) for the staff-module framing.

**Build:** persist roles + per-permission cells in Postgres; enforce them **server-side** on every mutation and **RLS** on every read; drive client affordances (show/hide/disable) off the same capability set.

---

## 2. Real gating is hardcoded on the demo role string — HIGH

**Now:** the few places that *do* gate behavior branch on the demo `currentRole` string (or heuristics), not the matrix:
- Custom discount / refund-ish caps: `canApplyCustomDiscount` / `maxCustomDiscountPct` in `src/lib/store.ts:541-551`, consumed at `src/app/admin/pos/page.tsx:768,1040`, `src/app/schedule/[classId]/page.tsx:1781`.
- Complimentary-credit grant limits: resolved from the role record's `grantLimits` (this one is genuinely wired — `AddComplimentaryCreditPage.tsx`).
- Branch scope on the dashboard comes from a **manual location multi-select**, not the signed-in user's assigned branches (`src/app/admin/dashboard/page.tsx`).

**Build:** replace role-string branches with capability checks resolved from the authenticated user's role assignments; derive branch scope from the user's `user_role_assignments`, enforced by RLS, not a UI picker.

---

## 3. Money-moving actions lack role enforcement — CRITICAL

**Now:** **Refunds have no role/permission check anywhere.** The only guards are `status === "complete"` and `isRefundable !== false` (`store.ts:9316-9319`; UI gate `CustomerPaymentsTab.tsx:823`). This **contradicts the PRD** (Owner/Branch Admin unlimited, Operator up to a configured limit, Front Desk no access). Any user who can see the Refund action can refund any refundable transaction.

Related: POS custom discounts gate on the role string (§2) but the limit isn't server-enforced; there is no server authorization on `applyPurchase`, payroll confirm, etc.

**Build:** server-side authorization + amount limits on every money-moving mutation (refunds, discounts, comp credits, payroll confirm). Refund limits by role + manager-approval threshold per the PRD. See [`payments-and-pos.md`](payments-and-pos.md) §4.

---

## 4. Auth model can't distinguish the 5 roles yet — HIGH

**Now:** the app collapses all admin personas into a single `admin` `UserRole`, and personas are set by **URL-driven layout auto-flips**, not login (see [`backend-and-auth.md`](backend-and-auth.md) §2). The AI agent's auth even **infers role from a `branch_id` heuristic** (undefined ⇒ owner, else branch_admin) with `studioId` hardcoded `"s1"` (`src/ai-agent/agent/auth.ts:112,118-134`) — so Operator vs. Front Desk **cannot be produced** from live data.

**Build:** real Supabase Auth users mapped to `staff` rows with a real role enum; split the collapsed `admin` into the five studio roles (Owner, Branch Admin, Operator, Front Desk, Instructor); route middleware gates sections by authenticated role; the AI agent then reads the real role instead of the heuristic.

---

## 5. The AI agent's write RBAC is the reference pattern — GOOD (reuse it)

**Now (this part is genuinely done well):** the AI agent enforces per-capability gating at **tool-availability level** (Layer 1) by reading matrix cells (`classes.schedule.create`, `settings.locations_rooms.create`, `staff.pay_rates_payroll.view`) via `cellTrue`, never branching on role name (`src/ai-agent/agent/auth.ts:46,60-66`; denials at `schedule-tools.ts:385,407,443,564`). Spec: [`ai-agent-rbac.md`](ai-agent-rbac.md) (note its header status line is stale — the gate **is** implemented).

**Reuse:** generalize this "resolve capabilities from the matrix, gate the action, never branch on role name" pattern across the whole app when wiring real RBAC.

---

## Priority
1. **Server-side authorization on money-moving mutations** (refunds especially) — CRITICAL, security.
2. **Real auth + 5-role model + RLS** (arrives with the backend) — enables everything else.
3. **Wire the permissions matrix to real enforcement**, using the AI agent's capability pattern as the template.
4. Derive branch scope from role assignments, not the UI picker.
