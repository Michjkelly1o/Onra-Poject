// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `rooms` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 4 rooms across the two active branches. The West branch is inactive in
// `branches.ts`, so it intentionally has no rooms seeded — preserves the
// "no rooms when branch is inactive" invariant.
//
// FK: `branch_id` → branches.id

import type { Room } from "./_types";

export const rooms: Room[] = [
    // ── Forma Studio South (main, active) — 3 rooms ──────────────────────────
    {
        id: "room_south_reformer",
        branch_id: "branch_forma_south",
        name: "Reformer Studio",
        capacity: 12,
        status: "active",
    },
    {
        id: "room_south_mat",
        branch_id: "branch_forma_south",
        name: "Mat Studio",
        capacity: 20,
        status: "active",
    },
    {
        id: "room_south_barre",
        branch_id: "branch_forma_south",
        name: "Barre Studio",
        capacity: 15,
        status: "active",
    },

    // ── Forma Studio East (active) — 1 room ──────────────────────────────────
    {
        id: "room_east_studio_a",
        branch_id: "branch_forma_east",
        name: "Studio A",
        capacity: 20,
        status: "active",
    },
];
