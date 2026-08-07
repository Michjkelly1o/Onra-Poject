// ─────────────────────────────────────────────────────────────────────────────
// Lead assignment feature flag
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-08-05 — a boutique studio doesn't route leads / follow-ups to a
// specific person ("when do we assign tasks to someone? we don't"). So every
// person-assignment surface is HIDDEN, not deleted, behind this single flag:
//
//   • customers list — "Assigned to me" scope toggle
//   • customers CSV export — "Assigned to" column
//   • Follow-ups tab — "Assigned to" task column
//   • Follow-up settings panel — "Assigned to" staff dropdown
//
// A bigger, multi-staff club flips this to `true` to bring the whole layer back
// with no rebuild. The underlying store fields (`customer.assignedTo`, task
// `assigneeId`) stay intact, so nothing has to be re-seeded when it's switched
// on again — the follow-up workflow (lifecycle tag + follow-up status + AI
// task detection) is unaffected either way; only the ownership layer hides.
export const LEAD_ASSIGNMENT_ENABLED: boolean = false;
