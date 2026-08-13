# Backend, Auth & Storage — prototype vs. production (dev handoff)

**This is the foundational doc — read it first.** Everything else in `dev-handoff/` assumes the reader understands that there is **no backend today**.

**Verdict:** the app is a client-only Next.js prototype whose entire "database" is a single Zustand store persisted to `localStorage`. The only server code is the AI-agent LLM proxy (`src/app/api/ai-agent/*`) — not a data API. Confirmed: no `supabase`/`createClient`/`axios` imports anywhere in `src/`; the only `fetch()` calls target the local AI-agent routes.

The intended target (per CLAUDE.md and the mock-data structure) is **Supabase** (Postgres + Auth + Storage + RLS).

---

## 1. State / persistence — the store IS the backend — CRITICAL, largest effort

**Now:** one ~14,000-line Zustand store (`src/lib/store.ts`) holds all state and ~180 action methods (`applyPurchase`, booking creation, staff edits, refunds, payroll…). The `persist` middleware writes the whole app state to `localStorage` under key `onra-demo-state`; rehydration re-seeds from the mock files; a schema `version` + `migrate` chain handles shape changes; cross-tab sync is a manual `window` `storage` listener.

- `src/lib/store.ts:6280` — `PERSIST_KEY = "onra-demo-state"`
- `src/lib/store.ts:6308` — `create<AppState>()(persist(...))`
- `src/lib/store.ts:13543` — `version: 116` (bumped to flush/reseed)
- `src/lib/store.ts:13640-13977` — `migrate` chain
- `src/lib/store.ts:14064-14069` — cross-tab sync via `storage` event → `persist.rehydrate()`

**Build:**
- Supabase Postgres tables (one per mock file — see §4).
- A data/API layer (Next.js server actions or route handlers, or the typed Supabase client) replacing every `set`/`get` mutation. Each of the store's action methods becomes a **server-side transactional write** — money-moving ones (`applyPurchase`, `refundTransaction`, payroll confirm) must be atomic and server-authoritative.
- Cross-tab / cross-device sync → **Supabase Realtime** subscriptions instead of the `storage` event.
- The `version`/`migrate` chain → real SQL migrations.

> This is the single biggest piece of work: `store.ts` is effectively the entire backend written on the client.

---

## 2. Auth — there is no login — CRITICAL

**Now:** the store boots as the admin persona, and each route section's layout auto-flips `currentUser`/`currentRole` to a fixed demo persona via `useEffect` → `setCurrentUser`. Navigating between URL sections silently changes "who you are." Identity/role are excluded from persistence (per-tab only).

- Boot identity: `src/lib/store.ts:6310-6311` (`currentRole:"admin"`, `currentUser: account_profile`)
- Setter: `src/lib/store.ts:6643` — `setCurrentUser` also sets `currentRole`
- Persona flips: `src/app/attendee/layout.tsx:24-29` (Robin Vega), `src/app/instructor/layout.tsx:51-72` (Liam Chen), `src/app/admin/layout.tsx:35-37` (Jonathan/admin); also `src/app/class/[classId]/page.tsx`, `src/app/earnings/[classId]/page.tsx`
- Demo personas: `src/data/mock/account_profile.ts` (admin), `instructor_profile.ts` (Liam), `attendee_profile.ts` (Robin); customer persona "Ava Wright" (`store.ts:4084`)
- Excluded from persistence: `src/lib/store.ts:14034-14051` (`partialize` strips `currentUser`/`currentRole`/ephemeral UI)
- `src/app/customer/auth/page.tsx` exists but is a **UI mock**, not real auth.

**Build:** Supabase Auth (email/OAuth) + real sessions; Next.js **middleware** to gate routes by authenticated role (delete the `useEffect` persona flips in every `layout.tsx`); seed the 5 demo users as real auth users mapped to `staff`/`customers` rows; **Postgres RLS** scoping data by branch + role. The 5-role model already exists in data (`roles.ts`, `permission_templates.ts`, `user_role_assignments.ts`) — see [`rbac-and-permissions.md`](rbac-and-permissions.md), because today the roles matrix is **not enforced**.

---

## 3. File / image storage — base64 in localStorage — HIGH

**Now:** every uploaded image (logo, avatar, class cover, branding, category image) is read with `FileReader.readAsDataURL` and stored **inline as a base64 data-URL inside the persisted store blob**. No upload endpoint, no object storage. A code comment flags it: "data-URL via FileReader — Phase 4 swaps for real CDN."

- `src/components/settings/business/StudioProfileFormPage.tsx:92-94` (+comment :12)
- `src/components/settings/branding/CustomizeDesignPanel.tsx:274-276`
- `src/components/settings/branches/BranchFormPage.tsx:137-139`
- `src/components/settings/booking-rules/CategoryModal.tsx:89-91`
- `src/components/account/AccountModals.tsx:390-392` (avatar), `src/components/instructor/account/EditInstructorProfileModal.tsx:72-76`
- `src/components/ui/RichTextEditor.tsx:248-254` (inline images)

**Build:** Supabase Storage (or S3 + CDN). Upload the `File` to a bucket, persist only the returned URL on the record. This also removes the ~5MB `localStorage` ceiling that base64 images will blow through. **Pattern already exists:** the AI-agent has a real upload route at `src/app/api/ai-agent/upload/route.ts`.

---

## 4. Mock data → migrations — MEDIUM (mechanical)

**Now:** `src/data/mock/` is **one file per future table** (~70 files), snake_case fields, designed to map 1:1 to Supabase (`customers.ts`, `class_bookings.ts`, `customer_transactions.ts`, `staff.ts`, `roles.ts`…). Customers are **synthetically bulk-generated**: 10 hand-authored rows + `generateSyntheticCustomers(1520)` — deterministic/index-derived (no `Math.random()`), with a documented uniqueness invariant.

- Directory: `src/data/mock/` (+ `_types.ts`, `index.ts`, `README.md`)
- Synthetic customers: `src/data/mock/customers.ts:468-537`, `:708`

**Build:** convert each mock file into a Supabase migration (table DDL) + seed script — field names largely become column names. **Do NOT seed the 1,520 synthetic customers into production** (they're demo volume for realistic KPIs); keep the generator for staging/load-test only.

---

## 5. Client-side IDs / timestamps — HIGH (correctness/audit)

**Now:** new records get IDs and timestamps from the browser — `Date.now()` + `Math.random().toString(36)` string IDs, and the client clock for `createdAt`. ~66 occurrences in `store.ts` alone (e.g. `:6752`, `:6800`, `:6884`, `:7530`).

**Build:** move ID generation DB-side (`gen_random_uuid()` / identity columns) and timestamps to `default now()` on the server. Client `Date.now()`+`Math.random()` IDs risk collisions and are forgeable; client clocks corrupt ordering, reporting, and audit trails — unacceptable for financial tables (`customer_transactions`, `payroll_entries`, promo usage). The store already builds audit logs off these timestamps (`store.ts:~10907`).

---

## Priority order
1. **Data layer + Postgres** replacing `store.ts` (largest).
2. **Auth + RLS + middleware** replacing the layout persona-flips.
3. **Object storage** replacing base64 data-URLs.
4. **Migrations/seed** from `src/data/mock/` (drop the synthetic customers).
5. **Server-side IDs/timestamps.**
