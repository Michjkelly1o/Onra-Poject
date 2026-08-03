// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `staff_attendance_log` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per (staff × scheduled class) recording whether they taught,
// substituted, or no-showed + clock-in/out timing. Feeds Staff Attendance
// report's "Actual hours" / "Late start" / "Hours variance" columns.
//
// The seed is DERIVED at store-init time from `class_schedule` in
// src/lib/store.ts (see the `staffAttendanceLog` slice init) rather than
// declared here — this keeps the seed in lock-step with the schedule.
//
// Derivation rule (deterministic — same seed → same rows):
//   • Every non-cancelled schedule → 1 row with attendance_status="taught"
//   • Cancelled schedules → 1 row with attendance_status="no-show"
//   • ~15% of taught rows get a late_start_minutes value (1-10 minutes)
//     via a deterministic hash on the schedule id so numbers are stable
//   • actual_hours = scheduled_hours (matches until real clock-in
//     data lands post-demo)
//
// This module exports the interface + an empty seed. The store's
// initialiser populates the runtime slice from class_schedule at boot.

import type { StaffAttendanceLog } from "./_types";

export const staff_attendance_log: StaffAttendanceLog[] = [];
