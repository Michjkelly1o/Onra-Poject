// ─────────────────────────────────────────────────────────────────────────────
// Export specs — Business / Locations  (Phase 2, highest priority)
// ─────────────────────────────────────────────────────────────────────────────
//
// Branches are the entity EVERYTHING else FKs to (branch_id), so a complete
// migration needs them exported cleanly first. Three related tables:
//   • branches       — id, status, is_main, full address + timezone, contact
//   • rooms          — id, branch_id FK (+ readable branch name), capacity, grid
//   • business_hours — id, branch_id FK, day_of_week (+ readable day name),
//                      open/close times, is_closed

import type { Branch, Room, BusinessHours } from "@/lib/store";
import type { ExportColumn, ExportData } from "@/lib/export/export-data";

const DAY_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function branchesExportData(rows: Branch[]): ExportData<Branch> {
    const columns: ExportColumn<Branch>[] = [
        { key: "id", value: b => b.id },
        { key: "name", value: b => b.name },
        { key: "status", value: b => b.status },
        { key: "is_main", value: b => (b.is_main ? "true" : "false") },
        { key: "address", value: b => b.address ?? "" },
        { key: "city", value: b => b.city ?? "" },
        { key: "state", value: b => b.state ?? "" },
        { key: "country", value: b => b.country ?? "" },
        { key: "timezone", value: b => b.timezone ?? "" },
        { key: "phone", value: b => b.phone ?? "" },
        { key: "email", value: b => b.email ?? "" },
    ];
    return { entity: "branches", columns, rows };
}

export function roomsExportData(rows: Room[], branchName: (id: string) => string): ExportData<Room> {
    const columns: ExportColumn<Room>[] = [
        { key: "id", value: r => r.id },
        { key: "branch_id", value: r => r.branch_id },
        { key: "branch_name", value: r => branchName(r.branch_id) },
        { key: "name", value: r => r.name },
        { key: "capacity", value: r => r.capacity },
        { key: "status", value: r => r.status },
        { key: "equipment_notes", value: r => r.equipment_notes ?? "" },
        { key: "columns", value: r => r.columns ?? "" },
        { key: "rows", value: r => r.rows ?? "" },
    ];
    return { entity: "rooms", columns, rows };
}

export function businessHoursExportData(rows: BusinessHours[], branchName: (id: string) => string): ExportData<BusinessHours> {
    const columns: ExportColumn<BusinessHours>[] = [
        { key: "id", value: h => h.id },
        { key: "branch_id", value: h => h.branch_id },
        { key: "branch_name", value: h => branchName(h.branch_id) },
        { key: "day_of_week", value: h => h.day_of_week },
        { key: "day_name", value: h => DAY_NAME[h.day_of_week] ?? "" },
        { key: "open_time", value: h => h.open_time },
        { key: "close_time", value: h => h.close_time },
        { key: "is_closed", value: h => (h.is_closed ? "true" : "false") },
    ];
    return { entity: "business-hours", columns, rows };
}
