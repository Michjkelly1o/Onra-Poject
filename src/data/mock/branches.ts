// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `branches` seed (Phase 4 extended schema)
// ─────────────────────────────────────────────────────────────────────────────
//
// 3 Forma Studio branches. South is the main active branch (most demo data
// lives there). East is also active but lightly populated. West is inactive,
// kept around so the branch-status filter has something to filter against.
//
// Cross-module sync — adding / archiving / deleting branches is now done
// through the live store actions (`addBranch` / `updateBranch` /
// `deleteBranch` in `lib/store.ts`). The static `BRANCHES` export below is
// only the BOOT snapshot — consumers should subscribe to
// `useAppStore(s => s.branches)` to see live updates. Today these places
// still read the static export and only see the boot list:
//
//   • /admin/schedule (branch filter)
//   • /admin/customers (branch column)
//   • /admin/products (Applicable branches)
//   • /admin/staff (branch assignment)
//   • /admin/pos (branch picker)
//   • /admin/compensation + /admin/staff/pay-rate (rate scope)
//   • /admin/settings/agreements (Applies to)
//   • /products/promo-codes (Branches multi-select)
//
// Migrating those to `useAppStore` is a Phase 4.1 / 5 cleanup — each is a
// one-line swap from `BRANCHES` to `useAppStore(s => s.branches)`.

import type { Branch } from "./_types";

// 3 Forma Studio locations, each a real physical branch. A branch hosts
// classes AND appointment-based sessions (private + recovery) — recovery is
// a session `type`, not a separate location. See `services.ts` for the
// service → branch assignment driven by `type`. `kind` is a dead-but-safe
// legacy field (all "club"); it's removed entirely in Phase 2.
export const branches: Branch[] = [
    {
        id: "branch_forma_south",
        name: "Forma Studio (South)",
        status: "active",
        is_main: true,
        kind: "club",
        address: "12 Marina Walk, Dubai Marina, Dubai",
        email: "forma.south@formastudio.ae",
        phone: "+971 55 200 2001",
        state: "Dubai",
        city: "Dubai",
        country: "United Arab Emirates",
        timezone: "Asia/Dubai",
    },
    {
        id: "branch_forma_east",
        name: "Forma Studio (East)",
        status: "active",
        is_main: false,
        kind: "club",
        address: "8 Festival Boulevard, Dubai Festival City, Dubai",
        email: "forma.east@formastudio.ae",
        phone: "+971 55 200 2002",
        state: "Dubai",
        city: "Dubai",
        country: "United Arab Emirates",
        timezone: "Asia/Dubai",
    },
    {
        id: "branch_forma_west",
        name: "Forma Studio (West)",
        status: "inactive",
        is_main: false,
        kind: "club",
        address: "32 The Greens Avenue, Emirates Living, Dubai",
        email: "forma.west@formastudio.ae",
        phone: "+971 55 200 2003",
        state: "Dubai",
        city: "Dubai",
        country: "United Arab Emirates",
        timezone: "Asia/Dubai",
    },
];
