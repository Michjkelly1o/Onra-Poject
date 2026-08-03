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
    // Named after the class type it hosts — every seeded East class is Hot
    // Yoga (instructor Lucy Hale), so "Hot Yoga Studio" reads cleanly in
    // customer-facing booking confirmations and the schedule grid. Was
    // previously the generic "Studio A".
    {
        id: "room_east_studio_a",
        branch_id: "branch_forma_east",
        name: "Hot Yoga Studio",
        capacity: 20,
        status: "active",
    },

    // ── Forma Spa (active, Spa kind) — NO rooms seeded ───────────────────────
    // Spa branches are deliberately room-less in the prototype — recovery
    // sessions aren't room-scoped. Appointments at this branch carry
    // room_id="" (Appointment.room_id is optional; the detail panel only
    // renders the Room subline when roomName is present, so empty values
    // degrade cleanly).
];
