// ─────────────────────────────────────────────────────────────────────────────
// Export spec — Schedule (class instances)  (Phase 1 #4 of the export plan)
// ─────────────────────────────────────────────────────────────────────────────
//
// The `class_schedule` row: the record `id`, all four FKs as ids
// (`template_id` / `branch_id` / `instructor_id` / `room_id`) alongside their
// readable denormalized names, the RAW `start_time`/`end_time`/`date_iso`
// (not the 12h display string), the `type` (class/private/recovery) + delivery
// `class_type`, `gender_access`, `recurrence_group_id`, the per-schedule
// `applicable_*_ids` plan overrides, and the `spot_layout`.
//
// The two `applicable_*_ids` overrides are JSON-encoded so the export preserves
// the load-bearing distinction the plain-list encoding would flatten:
//   undefined → "" (cascade from template)   ·   [] → "[]" (explicitly no plans)

import type { ClassSchedule } from "@/lib/store";
import type { ExportColumn, ExportData } from "@/lib/export/export-data";

/** Preserve cascade (undefined → "") vs explicit-empty ([] → "[]") vs a real
 *  list. JSON round-trips all three unambiguously. */
const overrideIds = (ids?: string[]): string => (ids === undefined ? "" : JSON.stringify(ids));

export function scheduleExportData(rows: ClassSchedule[]): ExportData<ClassSchedule> {
    const columns: ExportColumn<ClassSchedule>[] = [
        { key: "id", value: c => c.id },
        { key: "template_id", value: c => c.templateId },
        { key: "type", value: c => c.type },
        { key: "name", value: c => c.name },
        { key: "category", value: c => c.category },
        { key: "branch_id", value: c => c.branchId },
        { key: "branch_name", value: c => c.location },
        { key: "instructor_id", value: c => c.instructorId },
        { key: "instructor_name", value: c => c.instructorName },
        { key: "room_id", value: c => c.roomId },
        { key: "room_name", value: c => c.room },
        { key: "date_iso", value: c => c.dateISO },
        { key: "day_of_week", value: c => c.dayOfWeek },
        { key: "start_time", value: c => c.startTime },
        { key: "end_time", value: c => c.endTime },
        { key: "class_type", value: c => c.classType },
        { key: "capacity", value: c => c.capacity },
        { key: "booked", value: c => c.booked },
        { key: "status", value: c => c.status },
        { key: "gender_access", value: c => c.genderAccess },
        { key: "equipment", value: c => c.equipment },
        { key: "spot_selection_enabled", value: c => (c.spotSelectionEnabled ? "true" : "false") },
        { key: "spot_layout", value: c => (c.spotLayout ? JSON.stringify(c.spotLayout) : "") },
        { key: "waitlist_enabled", value: c => (c.waitlistEnabled ? "true" : "false") },
        { key: "rating", value: c => c.rating },
        { key: "rating_count", value: c => c.ratingCount },
        { key: "recurrence_group_id", value: c => c.recurrenceGroupId ?? "" },
        { key: "applicable_membership_ids", value: c => overrideIds(c.applicableMembershipIds) },
        { key: "applicable_package_ids", value: c => overrideIds(c.applicablePackageIds) },
        { key: "cancelled_at", value: c => c.cancelledAt ?? "" },
        { key: "cancelled_by", value: c => c.cancelledBy ?? "" },
    ];
    return { entity: "schedule", columns, rows };
}
