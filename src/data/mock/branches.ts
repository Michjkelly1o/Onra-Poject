// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `branches` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 3 Forma Studio branches. South is the main active branch (most demo data
// lives there). East is also active but lightly populated. West is inactive,
// kept around so the branch-status filter has something to filter against.
//
// Replaces the legacy "FitLab" naming used in the original prototype.

import type { Branch } from "./_types";

export const branches: Branch[] = [
    {
        id: "branch_forma_south",
        name: "Forma Studio (South)",
        status: "active",
        is_main: true,
        address: "12 Marina Walk, Dubai Marina, Dubai",
    },
    {
        id: "branch_forma_east",
        name: "Forma Studio (East)",
        status: "active",
        is_main: false,
        address: "8 Festival Boulevard, Dubai Festival City, Dubai",
    },
    {
        id: "branch_forma_west",
        name: "Forma Studio (West)",
        status: "inactive",
        is_main: false,
        address: "32 The Greens Avenue, Emirates Living, Dubai",
    },
];
