// ─────────────────────────────────────────────────────────────────────────────
// Export spec — Pay rates  (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────
//
// `PayRate` is a discriminated union (flat / tiered / revenue / hybrid /
// monthly). The export carries the record `id`, `branch_id` FK (+ readable
// name), `status`, the `type` discriminant, and every variant's numeric fields
// in their own columns (blank when N/A). Structured sub-tables (tiers, hybrid
// condition, commissions, bonuses) are JSON-encoded so they round-trip.

import type { PayRate } from "@/lib/store";
import type { ExportColumn, ExportData } from "@/lib/export/export-data";

export function payRatesExportData(rows: PayRate[], branchName: (id: string) => string): ExportData<PayRate> {
    const columns: ExportColumn<PayRate>[] = [
        { key: "id", value: r => r.id },
        { key: "name", value: r => r.name },
        { key: "branch_id", value: r => r.branchId },
        { key: "branch_name", value: r => branchName(r.branchId) },
        { key: "status", value: r => r.status },
        { key: "type", value: r => r.type },
        // Flat
        { key: "flat_amount", value: r => (r.type === "flat" ? r.flatAmount : "") },
        // Tiered
        { key: "tiers", value: r => (r.type === "tiered" ? JSON.stringify(r.tiers) : "") },
        // Revenue
        { key: "split_percent", value: r => (r.type === "revenue" ? r.splitPercent : "") },
        { key: "pay_per_customer", value: r => (r.type === "revenue" ? (r.payPerCustomer ?? "") : "") },
        // Hybrid
        { key: "base_rate", value: r => (r.type === "hybrid" ? r.baseRate : "") },
        { key: "hybrid_condition", value: r => (r.type === "hybrid" ? JSON.stringify(r.condition) : "") },
        // Monthly
        { key: "fixed_salary", value: r => (r.type === "monthly" ? r.fixedSalary : "") },
        { key: "bonus_of_salary_percent", value: r => (r.type === "monthly" ? (r.bonusOfSalaryPercent ?? "") : "") },
        { key: "bonus_cap", value: r => (r.type === "monthly" ? (r.bonusCap ?? "") : "") },
        { key: "sales_commission_packages_percent", value: r => (r.type === "monthly" ? (r.salesCommissionPackagesPercent ?? "") : "") },
        { key: "sales_commission_memberships_percent", value: r => (r.type === "monthly" ? (r.salesCommissionMembershipsPercent ?? "") : "") },
        // Shared config
        { key: "only_checked_in", value: r => (r.onlyCheckedIn === undefined ? "" : r.onlyCheckedIn ? "true" : "false") },
        { key: "include_late_cancelled", value: r => (r.includeLateCancelled === undefined ? "" : r.includeLateCancelled ? "true" : "false") },
        { key: "tax_rate_id", value: r => r.taxRateId ?? "" },
        { key: "commissions", value: r => (r.commissions ? JSON.stringify(r.commissions) : "") },
        { key: "bonuses", value: r => (r.bonuses ? JSON.stringify(r.bonuses) : "") },
        { key: "usage_count", value: r => r.usageCount },
        { key: "created_at", value: r => r.createdAt ?? "" },
    ];
    return { entity: "pay-rates", columns, rows };
}
