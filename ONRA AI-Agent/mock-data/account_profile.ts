// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `account_profile` seed (PRD 12 §account / Phase 3)
// ─────────────────────────────────────────────────────────────────────────────
//
// The single source of truth for the **currently-logged-in user's profile**.
// Drives the Account settings page (/admin/settings/account), the Sidebar
// avatar chip, and any "by-current-user" attribution (e.g. the granter name
// recorded on complimentary-credit grants in Customer Management).
//
// Cross-module sync map — every consumer subscribes to `currentUser` on the
// Zustand store and re-renders the moment the account-settings modals call
// `updateAccountProfile`:
//
//   1. /admin/settings/account     — primary read; the page itself
//   2. <Sidebar>                   — avatar + name + email chip (bottom of
//                                    the rail; honours `avatar_url` as of
//                                    Phase 3, falls back to ui-avatars.com)
//   3. <CustomerDetailPage>        — uses `currentUser.first_name +
//                                    last_name` as the "removed by" name on
//                                    the Plan-tab Remove-credit history row
//   4. <AddComplimentaryCreditPage>— same, as the granter name persisted on
//                                    the resulting credit-grant record
//   5. data-store.ts (legacy)      — joins this record into the demo `users`
//                                    array used by the older customer flow
//
// Editing through the Account settings modals goes through the
// `updateAccountProfile` action on the store (see lib/store.ts) — it does a
// partial merge over `currentUser` so any field NOT in the patch keeps its
// previous value.
//
// NOTE — this is the "logged-in owner" record, distinct from `users.ts`
// (which seeds the five demo personas for the role switcher). When the demo
// switcher flips between roles, it overwrites `currentUser` wholesale; this
// seed is only the initial value at boot.
//
// Persona aligned with Figma 2858:110671 (the Account settings reference
// frame) — Jonathan Miles / jonathan@email.com / +971 55 200 2001 — so the
// page renders pixel-for-pixel against the design out of the box.

import type { User } from "@/types";

export const account_profile: User = {
    id: "u-admin-1",
    studio_id: "s1",
    role: "admin",
    first_name: "Jonathan",
    last_name: "Miles",
    email: "jonathan@email.com",
    phone: "+971 55 200 2001",
    avatar_url: "",
    // Demo password from CLAUDE.md — every demo persona uses `Demo1234!`. The
    // Account page Password row reveals this via the eye-toggle; the Change
    // password modal overwrites it on submit so the toggle always reflects
    // the current value.
    password: "Demo1234!",
    // Seed a plausible last-changed date so the Account settings page
    // renders the "Last changed Mar 14, 2026 · N days ago" info line
    // straight out of the box (Figma 2858:110671). Subsequent Change
    // password submits overwrite this via `updateAccountProfile`.
    password_changed_at: "2026-03-14T00:00:00Z",
    waiver_signed: true,
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    permissions: ["all"],
};
