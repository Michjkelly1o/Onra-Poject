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

export const branches: Branch[] = [
    {
        id: "branch_forma_south",
        name: "Forma Studio (South)",
        status: "active",
        is_main: true,
        address: "12 Marina Walk, Dubai Marina, Dubai",
        email: "forma.south@formastudio.ae",
        phone: "+971 55 200 2001",
        city: "Dubai",
        country: "United Arab Emirates",
    },
    {
        id: "branch_forma_east",
        name: "Forma Studio (East)",
        status: "active",
        is_main: false,
        address: "8 Festival Boulevard, Dubai Festival City, Dubai",
        email: "forma.east@formastudio.ae",
        phone: "+971 55 200 2002",
        city: "Dubai",
        country: "United Arab Emirates",
    },
    {
        id: "branch_forma_west",
        name: "Forma Studio (West)",
        status: "inactive",
        is_main: false,
        address: "32 The Greens Avenue, Emirates Living, Dubai",
        email: "forma.west@formastudio.ae",
        phone: "+971 55 200 2003",
        city: "Dubai",
        country: "United Arab Emirates",
    },
];
