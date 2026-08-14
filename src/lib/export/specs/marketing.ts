// ─────────────────────────────────────────────────────────────────────────────
// Export specs — Promo codes & Marketing  (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────
//
// Promo codes: the full discount definition — id, code, discount config, the
// applies-to product/class targeting, branch FKs (+ names), usage limits/count,
// validity window, and the announce flags.
//
// Marketing: one builder for BOTH campaigns and announcements (same
// `MarketingItem` shape, different `type`). Carries id, branch FKs, targeting,
// the send/audience fields (campaign-only), the engagement counters, and status.
// The caller passes the `entity` so the filename reads campaigns/announcements.

import type { PromoCode, MarketingItem } from "@/lib/store";
import type { ExportColumn, ExportData } from "@/lib/export/export-data";

const list = (xs?: string[]): string => (xs ?? []).join("; ");
const boolCell = (v?: boolean): string => (v === undefined ? "" : v ? "true" : "false");

// ─── Promo codes ─────────────────────────────────────────────────────────────

export function promoCodesExportData(rows: PromoCode[], branchName: (id: string) => string): ExportData<PromoCode> {
    const branchNames = (ids?: string[]) => (ids ?? []).map(branchName).filter(Boolean).join("; ");
    const columns: ExportColumn<PromoCode>[] = [
        { key: "id", value: p => p.id },
        { key: "code", value: p => p.code },
        { key: "name", value: p => p.name ?? "" },
        { key: "description", value: p => p.description ?? "" },
        { key: "status", value: p => p.status },
        { key: "discount_type", value: p => p.discount_type },
        { key: "discount_value", value: p => p.discount_value },
        { key: "max_discount_aed", value: p => p.max_discount_aed ?? "" },
        { key: "min_purchase_aed", value: p => p.min_purchase_aed ?? "" },
        { key: "applies_to", value: p => list(p.applies_to) },
        { key: "applies_to_product_ids", value: p => list(p.applies_to_product_ids) },
        { key: "applies_to_class_ids", value: p => list(p.applies_to_class_ids) },
        { key: "action", value: p => p.action ?? "" },
        { key: "offer_type", value: p => p.offer_type ?? "" },
        { key: "branch_ids", value: p => list(p.branch_ids) },
        { key: "branch_names", value: p => branchNames(p.branch_ids) },
        { key: "multi_location", value: p => boolCell(p.multi_location) },
        { key: "usage_limit", value: p => p.usage_limit ?? "" },
        { key: "usage_count", value: p => p.usage_count },
        { key: "per_customer_limit", value: p => p.per_customer_limit ?? "" },
        { key: "first_time_only", value: p => boolCell(p.first_time_only) },
        { key: "customer_targeting", value: p => p.customer_targeting ?? "" },
        { key: "valid_from", value: p => p.valid_from ?? "" },
        { key: "valid_until", value: p => p.valid_until ?? "" },
        { key: "countdown", value: p => boolCell(p.countdown) },
        { key: "announce_to_customers", value: p => boolCell(p.announce_to_customers) },
        { key: "announced_at", value: p => p.announced_at ?? "" },
        { key: "created_at", value: p => p.created_at ?? "" },
    ];
    return { entity: "promo-codes", columns, rows };
}

// ─── Marketing (campaigns + announcements) ───────────────────────────────────

export function marketingExportData(rows: MarketingItem[], entity: string, branchName: (id: string) => string): ExportData<MarketingItem> {
    const branchNames = (ids?: string[]) => (ids ?? []).map(branchName).filter(Boolean).join("; ");
    const columns: ExportColumn<MarketingItem>[] = [
        { key: "id", value: m => m.id },
        { key: "title", value: m => m.title },
        { key: "type", value: m => m.type },
        { key: "status", value: m => m.status },
        { key: "short_description", value: m => m.short_description },
        { key: "action_type", value: m => m.action_type },
        { key: "ticket_price", value: m => m.ticket_price ?? "" },
        { key: "cta_class_id", value: m => m.cta_class_id ?? "" },
        { key: "external_url", value: m => m.external_url ?? "" },
        { key: "publish_date", value: m => m.publish_date },
        { key: "expiry_date", value: m => m.expiry_date ?? "" },
        { key: "countdown", value: m => boolCell(m.countdown) },
        { key: "branch_ids", value: m => list(m.branch_ids) },
        { key: "branch_names", value: m => branchNames(m.branch_ids) },
        { key: "multi_location", value: m => boolCell(m.multi_location) },
        { key: "target_package_ids", value: m => list(m.target_package_ids) },
        { key: "target_class_ids", value: m => list(m.target_class_ids) },
        { key: "customer_targeting", value: m => m.customer_targeting ?? "" },
        { key: "topic", value: m => m.topic ?? "" },
        { key: "audience_kind", value: m => m.audience_kind ?? "" },
        { key: "audience_membership_ids", value: m => list(m.audience_membership_ids) },
        { key: "audience_segments", value: m => list(m.audience_segments) },
        { key: "audience_customer_ids", value: m => list(m.audience_customer_ids) },
        { key: "delivery_status", value: m => m.delivery_status ?? "" },
        { key: "scheduled_at", value: m => m.scheduled_at ?? "" },
        { key: "sent_at", value: m => m.sent_at ?? "" },
        { key: "view_count", value: m => m.view_count },
        { key: "click_count", value: m => m.click_count },
        { key: "conversion_count", value: m => m.conversion_count },
        { key: "created_at", value: m => m.created_at },
    ];
    return { entity, columns, rows };
}
