// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — rooms
// ─────────────────────────────────────────────────────────────────────────────
//
// Rooms belong to a branch (branch_id FK). The adapter resolves the branch by
// name and falls back to the studio's default branch, so a room always lands
// on a real branch.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const roomsEntity: EntityDef = {
    key: "rooms",
    label: "rooms",
    singular: "room",
    fields: [
        { key: "name",            label: "Room name", required: true },
        { key: "branch",          label: "Branch" },
        { key: "capacity",        label: "Capacity" },
        { key: "equipment_notes", label: "Equipment notes" },
    ],
    dict: {
        name:              "name",
        "room name":       "name",
        room:              "name",
        title:             "name",
        branch:            "branch",
        location:          "branch",
        club:              "branch",
        capacity:          "capacity",
        "max capacity":    "capacity",
        spots:             "capacity",
        seats:             "capacity",
        equipment:         "equipment_notes",
        "equipment notes": "equipment_notes",
        notes:             "equipment_notes",
    },
    validate: (row, inv) => {
        const name = inv.name ? row[inv.name]?.trim() : "";
        return !!name;
    },
    dedupeKey: (row, inv) => {
        const name = inv.name ? row[inv.name]?.trim().toLowerCase() : "";
        const branch = inv.branch ? row[inv.branch]?.trim().toLowerCase() : "";
        return name ? `${name}::${branch}` : null;
    },
};
