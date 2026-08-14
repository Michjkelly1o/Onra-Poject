// ─────────────────────────────────────────────────────────────────────────────
// Export specs — Settings: Tax rates & Agreements  (Phase 1 #5 of the plan)
// ─────────────────────────────────────────────────────────────────────────────
//
// Tax rates: the record `id`, machine values (raw `rate_percentage`, ISO
// `valid_from`/`valid_until` — not the display window string), and `status`.
// (Branch scope lives on the separate `tax_rules` entity, not on TaxRate.)
//
// Agreements: the record `id`, `location_ids` FK list (+ readable names), the
// `applicable_class_template_ids` FKs, machine dates, the policy flags, AND the
// CURRENT VERSION's document body (`content_type` / `content_text` / `file_name`
// / `file_url`) resolved from the versions table — the load-bearing payload the
// old export dropped entirely.

import type { TaxRate, Agreement, AgreementVersion } from "@/lib/store";
import type { ExportColumn, ExportData } from "@/lib/export/export-data";

// ─── Tax rates ───────────────────────────────────────────────────────────────

export function taxRatesExportData(rows: TaxRate[]): ExportData<TaxRate> {
    const columns: ExportColumn<TaxRate>[] = [
        { key: "id", value: r => r.id },
        { key: "name", value: r => r.name },
        { key: "kind", value: r => r.kind },
        { key: "type", value: r => r.type },
        { key: "rate_percentage", value: r => (r.type === "exempt" ? "" : r.ratePercentage) },
        { key: "calculation_mode", value: r => r.calculationMode },
        { key: "status", value: r => r.status },
        { key: "valid_from", value: r => r.validFromISO ?? "" },
        { key: "valid_until", value: r => r.validUntilISO ?? "" },
        { key: "description", value: r => r.description ?? "" },
        { key: "created_at", value: r => r.createdAt },
    ];
    return { entity: "tax-rates", columns, rows };
}

// ─── Agreements ──────────────────────────────────────────────────────────────

export interface AgreementExportLookups {
    /** branch id → display name (for the readable `location_names` column). */
    branchName: (id: string) => string;
    /** Resolve the agreement's CURRENT version row (for the document body). */
    currentVersion: (a: Agreement) => AgreementVersion | undefined;
}

export function agreementsExportData(rows: Agreement[], look: AgreementExportLookups): ExportData<Agreement> {
    const columns: ExportColumn<Agreement>[] = [
        { key: "id", value: a => a.id },
        { key: "name", value: a => a.name },
        { key: "type", value: a => a.type },
        { key: "status", value: a => a.status },
        { key: "required", value: a => (a.required ? "true" : "false") },
        { key: "current_version", value: a => a.currentVersion },
        { key: "all_locations", value: a => (a.allLocations ? "true" : "false") },
        { key: "location_ids", value: a => a.locationIds.join("; ") },
        { key: "location_names", value: a => a.locationIds.map(look.branchName).filter(Boolean).join("; ") },
        { key: "applicable_class_template_ids", value: a => a.applicableClassTemplateIds.join("; ") },
        { key: "effective_dates_mode", value: a => a.effectiveDatesMode },
        { key: "effective_from", value: a => a.effectiveFrom },
        { key: "effective_until", value: a => a.effectiveUntil },
        { key: "require_re_acceptance", value: a => (a.requireReAcceptance ? "true" : "false") },
        { key: "require_guardian_consent", value: a => (a.requireGuardianConsent ? "true" : "false") },
        { key: "content_type", value: a => look.currentVersion(a)?.contentType ?? "" },
        { key: "content_text", value: a => look.currentVersion(a)?.contentText ?? "" },
        { key: "file_name", value: a => look.currentVersion(a)?.fileName ?? "" },
        { key: "file_url", value: a => look.currentVersion(a)?.fileUrl ?? "" },
        { key: "updated_at", value: a => a.updatedAt },
        { key: "created_at", value: a => a.createdAt },
    ];
    return { entity: "agreements", columns, rows };
}
