// ─────────────────────────────────────────────────────────────────────────────
// Export specs — Services & Class categories  (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────
//
// Services (private / recovery session definitions): id, `category_id` +
// `branch_id` + `room_id` FKs (+ readable names), `type`, `status`, and the
// booking config (duration / capacity / price / open-session).
//
// Class categories: id, name, color — a small config table other entities FK to
// via `category_id`. (ClassCategory has no status lifecycle — edit + delete only.)

import type { Service, ClassCategory } from "@/lib/store";
import type { ExportColumn, ExportData } from "@/lib/export/export-data";

export function servicesExportData(rows: Service[], roomName: (id: string) => string): ExportData<Service> {
    const columns: ExportColumn<Service>[] = [
        { key: "id", value: s => s.id },
        { key: "name", value: s => s.name },
        { key: "description", value: s => s.description },
        { key: "status", value: s => s.status },
        { key: "type", value: s => s.type },
        { key: "category_id", value: s => s.categoryId },
        { key: "category_name", value: s => s.category },
        { key: "branch_id", value: s => s.branchId },
        { key: "branch_name", value: s => s.branchName },
        { key: "room_id", value: s => s.roomId },
        { key: "room_name", value: s => (s.roomId ? roomName(s.roomId) : "") },
        { key: "open_session", value: s => (s.openSession ? "true" : "false") },
        { key: "duration_min", value: s => s.durationMin },
        { key: "capacity", value: s => s.capacity },
        { key: "price_aed", value: s => s.price },
    ];
    return { entity: "services", columns, rows };
}

export function classCategoriesExportData(rows: ClassCategory[]): ExportData<ClassCategory> {
    const columns: ExportColumn<ClassCategory>[] = [
        { key: "id", value: c => c.id },
        { key: "name", value: c => c.name },
        { key: "color_hex", value: c => c.color_hex },
    ];
    return { entity: "class-categories", columns, rows };
}
