"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration — client-side import applier
// ─────────────────────────────────────────────────────────────────────────────
//
// The server's `commit_import` tool is pure and stateless — it can only COUNT
// what would be imported (it has no access to the client's Zustand store). This
// module is the client half: when a confirmed `import_result` card lands in the
// chat, ChatThread calls `applyImportToStore` once per import to actually write
// the parsed rows into the live store AND drop a row into the Migrations module
// (importHistory) so the import is visible where the studio expects it.
//
// Phased rollout — one entity per phase so we never ship a half-wired writer:
//   • Phase 1 (this file): customers.
//   • Phase 2+: leads, memberships, packages, class_templates, class_schedule.
// Entities not yet wired return `null` (no write, no history) — exactly the
// pre-existing "counts only" behaviour, so nothing regresses.

import type { ParsedFile } from "@/ai-agent/migration/migration-cards";
import type { EntityKey } from "@/ai-agent/migration/entities";
import { materialize } from "@/ai-agent/migration/parser";

/** The narrow slice of store actions the applier needs. Structurally satisfied
 *  by the real Zustand actions passed from ChatThread via `getState()`. */
export interface ImportDeps {
    addCustomer: (input: {
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
        planKind: "membership" | "package" | null;
        gender?: string;
        dateOfBirth?: string;
        country?: string;
        state?: string;
        city?: string;
        postalCode?: string;
        streetAddress?: string;
        branchId?: string;
    }) => string;
    addImportHistory: (input: {
        data_type:
            | "customers"
            | "memberships"
            | "packages"
            | "class_templates"
            | "class_schedule"
            | "leads";
        file_name: string;
        file_type: "csv" | "xlsx" | "xls";
        total_rows: number;
        imported_rows: number;
        invalid_rows: number;
        invalid_rows_file_name?: string;
        status: "imported" | "partial" | "failed" | "pending";
        branch_id: string;
    }) => string;
    /** Branch the import is attributed to in the Migrations history row. */
    branchId: string;
}

export interface ApplyResult {
    created: number;
    failed: number;
}

/** Migration entity → ImportHistory `data_type`. Only the entities the applier
 *  actually writes appear here; others fall through with no history row. */
type HistoryType = Parameters<ImportDeps["addImportHistory"]>[0]["data_type"];
const HISTORY_TYPE: Partial<Record<EntityKey, HistoryType>> = {
    customers: "customers",
};

/** Write a confirmed import into the live store. Returns the created/failed
 *  counts, or `null` when the entity isn't wired yet (no-op, no history). */
export function applyImportToStore(
    entity: EntityKey,
    file: ParsedFile | null,
    fileName: string,
    deps: ImportDeps,
): ApplyResult | null {
    if (!file) return null;

    if (entity === "customers") {
        const records = materialize("customers", file);
        let created = 0;
        for (const rec of records) {
            // materialize already dropped rows that fail the entity validator,
            // but guard the required trio defensively before we insert.
            if (!rec.first_name || !rec.last_name || !rec.email) continue;
            deps.addCustomer({
                firstName: rec.first_name,
                lastName: rec.last_name,
                email: rec.email,
                phone: rec.phone || undefined,
                planKind: null,
                gender: rec.gender || undefined,
                dateOfBirth: rec.date_of_birth || undefined,
                country: rec.country || undefined,
                state: rec.state || undefined,
                city: rec.city || undefined,
                postalCode: rec.postal_code || undefined,
                streetAddress: rec.street_address || undefined,
                // branch left to the store's default so imported customers
                // always land on a valid branch.
            });
            created++;
        }
        const total = file.rows.length;
        const failed = Math.max(0, total - created);
        writeHistory(entity, fileName, total, created, failed, deps);
        return { created, failed };
    }

    // Not wired yet — leave the pre-existing counts-only behaviour untouched.
    return null;
}

/** Append the Migrations-module history row for a completed import. */
function writeHistory(
    entity: EntityKey,
    fileName: string,
    total: number,
    created: number,
    failed: number,
    deps: ImportDeps,
): void {
    const dataType = HISTORY_TYPE[entity];
    if (!dataType) return;
    deps.addImportHistory({
        data_type: dataType,
        file_name: fileName || "Imported file.csv",
        file_type: "csv",
        total_rows: total,
        imported_rows: created,
        invalid_rows: failed,
        invalid_rows_file_name: failed > 0 ? "Invalid rows data report.csv" : undefined,
        status: created === 0 ? "failed" : failed > 0 ? "partial" : "imported",
        branch_id: deps.branchId,
    });
}
