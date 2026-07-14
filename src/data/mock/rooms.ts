// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `rooms` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 5 rooms across the two active branches. The West branch is inactive in
// `branches.ts`, so it intentionally has no rooms seeded — preserves the
// "no rooms when branch is inactive" invariant.
//
// South carries a "Recovery" room so recovery services have a room to
// (optionally) use — recovery is a session type that lives inside a real
// branch, not a separate location. Room use is optional per service (some
// recovery sessions are room-less — see appointments.ts).
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
    // Recovery room — the space recovery/wellness sessions optionally use.
    // Recovery is a session type inside a real branch, not a location of its
    // own. Massage + IV therapy appointments book this room; the open
    // sessions (Sauna, Breathwork) run room-less to exercise both paths.
    {
        id: "room_south_recovery",
        branch_id: "branch_forma_south",
        name: "Recovery Room",
        capacity: 10,
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

];
