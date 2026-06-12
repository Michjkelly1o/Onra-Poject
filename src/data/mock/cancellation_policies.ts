// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `cancellation_policies` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Empty at boot so the Booking Rules landing renders the empty state
// (Figma 4580:29978 "No policy found"). Phase 4 will optionally seed a
// realistic set per the PRD's defaults — for now the admin builds the
// list themselves via the Add new flow.

import type { CancellationPolicy } from "./_types";

export const cancellation_policies: CancellationPolicy[] = [];
