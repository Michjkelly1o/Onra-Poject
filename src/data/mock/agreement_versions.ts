// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `agreement_versions` seed (PRD 11 §9 / Phase 1)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per published version of an agreement. The list view's "Version N"
// subtext is `agreements.current_version` (cached on the parent row); Phase 3
// will surface the full version history table from these rows.
//
// Demo coverage:
//   • Waiver booking      — 2 versions (v1 published 2025-04, v2 in 2026-05)
//   • Liability Waiver SX — 1 version  (v1 only)
//   • Liability Waiver EX — 1 version  (v1 only — agreement itself archived)
//
// Content for v1 of every agreement is text-based (rich editor); v2 of Waiver
// booking is an upload to demo the file-attached state — the file_size_bytes
// drives the "1.2 MB" display next to the filename in the version table.
//
// FK: `agreement_id` → `agreements.id`, `published_by` → `users.id`.

import type { AgreementVersionSeed } from "./_types";

export const agreement_versions: AgreementVersionSeed[] = [
    // ── Waiver booking ──────────────────────────────────────────────────────
    {
        id: "agr_v_waiver_booking_v1",
        agreement_id: "agr_waiver_booking",
        version_number: 1,
        content_type: "text",
        content_text: "<p>By booking a class, I acknowledge that participation in physical activity carries inherent risks. I confirm that I am physically able to participate and release Onra Studio from liability for injuries arising from my own conduct.</p>",
        published_at: "2025-04-22T10:00:00Z",
        published_by: "user_alex_owen",
    },
    {
        id: "agr_v_waiver_booking_v2",
        agreement_id: "agr_waiver_booking",
        version_number: 2,
        content_type: "text",
        content_text: "<p>v2 — added Reformer-specific risk language and explicit consent for instructor-led adjustments.</p>",
        published_at: "2025-07-12T10:00:00Z",
        published_by: "user_alex_owen",
    },
    {
        id: "agr_v_waiver_booking_v3",
        agreement_id: "agr_waiver_booking",
        version_number: 3,
        content_type: "text",
        content_text: "<p>v3 — refreshed health-declaration clause and added the late-arrival policy.</p>",
        published_at: "2025-09-22T10:00:00Z",
        published_by: "user_alex_owen",
    },
    {
        id: "agr_v_waiver_booking_v4",
        agreement_id: "agr_waiver_booking",
        version_number: 4,
        content_type: "text",
        content_text: "<p>v4 — updated photography/media consent and clarified the cancellation window.</p>",
        published_at: "2025-12-15T10:00:00Z",
        published_by: "user_alex_owen",
    },
    {
        id: "agr_v_waiver_booking_v5",
        agreement_id: "agr_waiver_booking",
        version_number: 5,
        content_type: "text",
        content_text: "<p>By booking Reformer Pilates, Private Reformer, Barre, or Roller Release, you accept all risks associated with physical activity. You confirm you are fit for exercise and have no medical restrictions. The studio is not liable for injuries, health issues, or lost property. You agree to follow all instructor safety guidelines. Your booking serves as a digital signature to this liability waiver and our standard cancellation policies.</p>",
        published_at: "2026-05-12T10:00:00Z",
        published_by: "user_alex_owen",
    },

    // ── Liability Waiver (South) ────────────────────────────────────────────
    {
        id: "agr_v_liability_south_v1",
        agreement_id: "agr_liability_south",
        version_number: 1,
        content_type: "text",
        content_text: "<p>South-branch Liability Waiver — includes Reformer equipment specific risks (springs, carriage movement, foot bar). I have been instructed on safe usage and assume responsibility for following instructor guidance.</p>",
        published_at: "2025-04-22T10:00:00Z",
        published_by: "user_alex_owen",
    },

    // ── Liability Waiver (East) — archived ──────────────────────────────────
    {
        id: "agr_v_liability_east_v1",
        agreement_id: "agr_liability_east",
        version_number: 1,
        content_type: "text",
        content_text: "<p>East-branch Liability Waiver — superseded by the multi-branch Waiver booking on 2026-01-15.</p>",
        published_at: "2025-04-22T10:00:00Z",
        published_by: "user_alex_owen",
    },
];
