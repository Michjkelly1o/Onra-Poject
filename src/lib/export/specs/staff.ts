// ─────────────────────────────────────────────────────────────────────────────
// Export specs — Staff & Roles  (Phase 1 #2 of the export-migration plan)
// ─────────────────────────────────────────────────────────────────────────────
//
// Staff: the record `id`, the `role_id` + `branch_id` FKs (+ readable names),
// `status`, the full profile, the pay FKs (`pay_rate_id` + the whole multi-track
// `pay_config` as JSON), and the instructor `category_ids`.
//
// Roles: the record `id`, the DEFINING payload serialized in full — the
// `permissions` matrix and `grant_limits` config as JSON — plus `locked` and the
// timestamps. A role export without its permission matrix cannot be re-imported;
// this is the fix for that.

import type { Staff, Role, Shift } from "@/lib/store";
import type { ExportColumn, ExportData } from "@/lib/export/export-data";

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface StaffExportLookups {
    /** role id → display name (readable column alongside `role_id`). */
    roleName: (id: string) => string;
    /** branch id → display name (readable column alongside `branch_id`). */
    branchName: (id: string | null) => string;
}

export function staffExportData(rows: Staff[], look: StaffExportLookups): ExportData<Staff> {
    const columns: ExportColumn<Staff>[] = [
        { key: "id", value: s => s.id },
        { key: "role_id", value: s => s.roleId },
        { key: "role_name", value: s => look.roleName(s.roleId) },
        { key: "branch_id", value: s => s.branchId ?? "" },
        { key: "branch_name", value: s => look.branchName(s.branchId) },
        { key: "first_name", value: s => s.firstName },
        { key: "last_name", value: s => s.lastName },
        { key: "full_name", value: s => s.fullName },
        { key: "initials", value: s => s.initials },
        { key: "email", value: s => s.email },
        { key: "phone", value: s => s.phone },
        { key: "status", value: s => s.status },
        { key: "joined_date", value: s => s.joinedDate },
        { key: "specialties", value: s => (s.specialties ?? []).join("; ") },
        { key: "short_intro", value: s => s.shortIntro ?? "" },
        { key: "working_experience_years", value: s => s.workingExperienceYears ?? "" },
        { key: "pay_rate_id", value: s => s.payRateId ?? "" },
        { key: "pay_config", value: s => (s.payConfig ? JSON.stringify(s.payConfig) : "") },
        { key: "category_ids", value: s => (s.categoryIds ?? []).join("; ") },
        { key: "shift_id", value: s => s.shiftId ?? "" },
        { key: "invite_sent_at", value: s => s.inviteSentAt ?? "" },
        { key: "first_login_completed", value: s => (s.firstLoginCompleted ? "true" : "false") },
        { key: "color", value: s => s.color },
    ];
    return { entity: "staff", columns, rows };
}

// ─── Shifts ──────────────────────────────────────────────────────────────────

export function shiftsExportData(rows: Shift[], branchName: (id: string) => string, assignedCount?: (shiftId: string) => number): ExportData<Shift> {
    const workingDayNames = (days: boolean[]) => days.map((on, i) => (on ? DAY_ABBR[i] : null)).filter(Boolean).join("; ");
    const columns: ExportColumn<Shift>[] = [
        { key: "id", value: s => s.id },
        { key: "name", value: s => s.name },
        { key: "branch_id", value: s => s.branch_id },
        { key: "branch_name", value: s => branchName(s.branch_id) },
        { key: "status", value: s => s.status },
        { key: "type", value: s => s.type ?? "" },
        { key: "repeat_every", value: s => s.repeat_every ?? "" },
        { key: "start_time", value: s => s.start_time },
        { key: "end_time", value: s => s.end_time },
        { key: "working_days", value: s => workingDayNames(s.working_days) },
        { key: "staffing_target", value: s => s.staffing_target },
        { key: "assigned_count", value: s => (assignedCount ? assignedCount(s.id) : "") },
        { key: "created_at", value: s => s.created_at },
    ];
    return { entity: "shifts", columns, rows };
}

// ─── Compensation (payroll entries, one row per instructor × period) ─────────

export interface CompensationExportRow {
    entryId: string;
    instructorId: string;
    instructorName: string;
    instructorEmail: string;
    branchId: string;
    payRateId?: string;
    payRateName: string;
    classesCount: number;
    grossRevenue: number;
    earnings: number;
    status: string;
    periodStart: string;
    periodEnd: string;
}

export function compensationExportData(rows: CompensationExportRow[], branchName: (id: string) => string): ExportData<CompensationExportRow> {
    const columns: ExportColumn<CompensationExportRow>[] = [
        { key: "entry_id", value: r => r.entryId },
        { key: "instructor_id", value: r => r.instructorId },
        { key: "instructor_name", value: r => r.instructorName },
        { key: "instructor_email", value: r => r.instructorEmail },
        { key: "branch_id", value: r => r.branchId },
        { key: "branch_name", value: r => branchName(r.branchId) },
        { key: "pay_rate_id", value: r => r.payRateId ?? "" },
        { key: "pay_rate_name", value: r => r.payRateName },
        { key: "classes_count", value: r => r.classesCount },
        { key: "gross_revenue_aed", value: r => Math.round(r.grossRevenue) },
        { key: "earnings_aed", value: r => Math.round(r.earnings) },
        { key: "status", value: r => r.status },
        { key: "period_start", value: r => r.periodStart },
        { key: "period_end", value: r => r.periodEnd },
    ];
    return { entity: "compensation", columns, rows };
}

export function rolesExportData(rows: Role[], staffByRole: Map<string, number>): ExportData<Role> {
    const columns: ExportColumn<Role>[] = [
        { key: "id", value: r => r.id },
        { key: "name", value: r => r.name },
        { key: "description", value: r => r.description },
        { key: "type", value: r => r.type },
        { key: "status", value: r => r.status },
        { key: "locked", value: r => (r.locked ? "true" : "false") },
        { key: "staff_count", value: r => staffByRole.get(r.id) ?? 0 },
        { key: "grant_limits", value: r => JSON.stringify(r.grantLimits) },
        { key: "permissions", value: r => JSON.stringify(r.permissions) },
        { key: "created_at", value: r => r.createdAt ?? "" },
        { key: "archived_at", value: r => r.archivedAt ?? "" },
    ];
    return { entity: "roles", columns, rows };
}
