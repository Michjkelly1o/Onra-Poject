// ─────────────────────────────────────────────────────────────────────────────
// Export specs — Products  (Phase 1 #3 of the export-migration plan)
// ─────────────────────────────────────────────────────────────────────────────
//
// Three entities off the Products module:
//   • Memberships + Packages — one combined file with a `product_type`
//     discriminator (mirrors the merged on-screen table). Carries the record
//     `id`, `branch_ids` FK list (+ readable names), `status`, the raw machine
//     numbers (credits / duration_months / validity_days), the config flags, and
//     the `purchase_rules` payload as JSON.
//   • Gift-card designs — full config incl. value mode + validity + price.
//   • Issued gift cards — the child financial records (added — previously had NO
//     export), each with its `design_id` / `customer_id` / `transaction_id` FKs.

import type { Membership, Package, GiftCardDesign, IssuedGiftCard } from "@/lib/store";
import type { ExportColumn, ExportData } from "@/lib/export/export-data";

const boolCell = (v?: boolean): string => (v === undefined ? "" : v ? "true" : "false");

// ─── Memberships + Packages (combined) ───────────────────────────────────────

export type ProductExportRow =
    | { type: "membership"; rec: Membership }
    | { type: "package"; rec: Package };

export function productsExportData(
    memberships: Membership[],
    packages: Package[],
    branchName: (id: string) => string,
): ExportData<ProductExportRow> {
    const rows: ProductExportRow[] = [
        ...memberships.map(m => ({ type: "membership" as const, rec: m })),
        ...packages.map(p => ({ type: "package" as const, rec: p })),
    ];
    const branchNames = (ids: string[]) => ids.map(branchName).filter(Boolean).join("; ");
    const columns: ExportColumn<ProductExportRow>[] = [
        { key: "id", value: r => r.rec.id },
        { key: "product_type", value: r => r.type },
        { key: "name", value: r => r.rec.name },
        { key: "description", value: r => r.rec.description ?? "" },
        { key: "status", value: r => r.rec.status },
        { key: "price_aed", value: r => r.rec.price_aed },
        // Membership credits can be the literal "unlimited"; packages are always
        // numeric. Return the raw value so Excel keeps numeric package credits as
        // numbers (only "unlimited" lands as text).
        { key: "credits", value: r => r.rec.credits },
        { key: "duration_months", value: r => (r.type === "membership" ? r.rec.duration_months : "") },
        { key: "validity_days", value: r => (r.type === "package" ? r.rec.validity_days : "") },
        { key: "branch_ids", value: r => r.rec.branch_ids.join("; ") },
        { key: "branch_names", value: r => branchNames(r.rec.branch_ids) },
        { key: "welcome_message", value: r => r.rec.welcome_message ?? "" },
        { key: "auto_renew", value: r => (r.type === "membership" ? boolCell(r.rec.auto_renew) : "") },
        { key: "active_on_first_use", value: r => (r.type === "membership" ? boolCell(r.rec.active_on_first_use) : "") },
        { key: "is_intro_offer", value: r => (r.type === "package" ? boolCell(r.rec.is_intro_offer) : "") },
        { key: "purchase_rules", value: r => (r.rec.purchase_rules ? JSON.stringify(r.rec.purchase_rules) : "") },
        { key: "created_at", value: r => r.rec.created_at ?? "" },
    ];
    return { entity: "memberships-packages", columns, rows };
}

// ─── Gift-card designs ───────────────────────────────────────────────────────

export function giftCardDesignsExportData(rows: GiftCardDesign[]): ExportData<GiftCardDesign> {
    const columns: ExportColumn<GiftCardDesign>[] = [
        { key: "id", value: d => d.id },
        { key: "name", value: d => d.name },
        { key: "status", value: d => d.status },
        { key: "value_type", value: d => d.value_type },
        { key: "fixed_value_aed", value: d => d.fixed_value_aed ?? "" },
        { key: "min_value_aed", value: d => d.min_value_aed ?? "" },
        { key: "max_value_aed", value: d => d.max_value_aed ?? "" },
        { key: "price_aed", value: d => d.price_aed ?? "" },
        { key: "validity_days", value: d => d.validity_days },
        { key: "no_expiry", value: d => boolCell(d.no_expiry) },
        { key: "issue_date", value: d => d.issue_date ?? "" },
        { key: "valid_until_date", value: d => d.valid_until_date ?? "" },
        { key: "gift_card_number", value: d => d.gift_card_number ?? "" },
        { key: "description", value: d => d.description ?? "" },
        { key: "welcome_message", value: d => d.welcome_message ?? "" },
        { key: "created_at", value: d => d.created_at ?? "" },
    ];
    return { entity: "gift-card-designs", columns, rows };
}

// ─── Issued gift cards (child financial records) ─────────────────────────────

export interface IssuedGiftCardLookups {
    customerName: (id: string) => string;
}

export function issuedGiftCardsExportData(rows: IssuedGiftCard[], look: IssuedGiftCardLookups): ExportData<IssuedGiftCard> {
    const columns: ExportColumn<IssuedGiftCard>[] = [
        { key: "id", value: g => g.id },
        { key: "design_id", value: g => g.design_id },
        { key: "customer_id", value: g => g.customer_id },
        { key: "customer_name", value: g => look.customerName(g.customer_id) },
        { key: "code", value: g => g.code },
        { key: "status", value: g => g.status },
        { key: "face_value_aed", value: g => g.face_value_aed },
        { key: "current_balance_aed", value: g => g.current_balance_aed },
        { key: "issued_at", value: g => g.issued_at },
        { key: "expires_at", value: g => g.expires_at },
        { key: "last_redeemed_at", value: g => g.last_redeemed_at ?? "" },
        { key: "recipient_name", value: g => g.recipient_name ?? "" },
        { key: "recipient_email", value: g => g.recipient_email ?? "" },
        { key: "sender_name", value: g => g.sender_name ?? "" },
        { key: "message", value: g => g.message ?? "" },
        { key: "transaction_id", value: g => g.transaction_id ?? "" },
        { key: "sold_by_staff_id", value: g => g.sold_by_staff_id ?? "" },
    ];
    return { entity: "issued-gift-cards", columns, rows };
}
