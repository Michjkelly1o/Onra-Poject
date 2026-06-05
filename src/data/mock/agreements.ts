// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `agreements` seed (PRD 11 §9 / Phase 1)
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors Figma `4232-52279` (Agreements list — 3 demo rows):
//   1. Waiver booking      — Active   · Multi-branch    · v2
//   2. Liability Waiver    — Active   · Specific branch · v1  (South)
//   3. Liability Waiver    — Archived · Specific branch · v1  (East — superseded)
//
// The list view's "Type" column is the LOCATION scope, derived from
// `all_locations` + `location_ids.length`:
//   • all_locations = true              → "Multi-branch"
//   • location_ids.length > 1           → "Multi-branch"
//   • location_ids.length === 1         → "Specific branch"
//
// `agreement_type` (legal type — liability_waiver etc.) is captured for the
// detail page / filter but doesn't render in the list.
//
// FK: `location_ids[]` → `branches.id`.

import type { AgreementSeed } from "./_types";

export const agreements: AgreementSeed[] = [
    // ── Row 1 — Active · Multi-branch · v2 ──────────────────────────────────
    {
        id: "agr_waiver_booking",
        name: "Waiver booking",
        type: "liability_waiver",
        description: "Default booking liability waiver — covers risks of physical activity and class participation across all branches.",
        required: true,
        current_version: 5,
        all_locations: true,
        location_ids: [],
        effective_from: "2025-04-22",
        effective_until: "2027-04-22",
        status: "active",
        updated_at: "2026-05-12T10:00:00Z",
        created_at: "2025-04-22T10:00:00Z",
    },

    // ── Row 2 — Active · Specific branch (South) · v1 ───────────────────────
    {
        id: "agr_liability_south",
        name: "Liability Waiver",
        type: "liability_waiver",
        description: "South branch liability waiver — includes Reformer-specific equipment risks.",
        required: true,
        current_version: 1,
        all_locations: false,
        location_ids: ["branch_forma_south"],
        effective_from: "2025-04-22",
        effective_until: "2026-12-31",
        status: "active",
        updated_at: "2025-04-22T10:00:00Z",
        created_at: "2025-04-22T10:00:00Z",
    },

    // ── Row 3 — Archived · Specific branch (East) · v1 ──────────────────────
    {
        id: "agr_liability_east",
        name: "Liability Waiver",
        type: "liability_waiver",
        description: "East branch liability waiver — superseded by the multi-branch Waiver booking, archived.",
        required: false,
        current_version: 1,
        all_locations: false,
        location_ids: ["branch_forma_east"],
        effective_from: "2025-04-22",
        effective_until: "2026-04-22",
        status: "archived",
        updated_at: "2026-01-15T10:00:00Z",
        created_at: "2025-04-22T10:00:00Z",
    },
];
