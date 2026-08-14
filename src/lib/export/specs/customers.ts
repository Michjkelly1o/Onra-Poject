// ─────────────────────────────────────────────────────────────────────────────
// Export spec — Customers  (Phase 1 #1 of the export-migration plan)
// ─────────────────────────────────────────────────────────────────────────────
//
// The migration-complete column set for the `customers` table: the record `id`
// first, the `branch_id` FK (+ a readable `branch_name`), the archive `status`
// (active/archived — NEVER merged into one bucket), the plan FKs
// (`membership_id` / `package_ids`), the full profile + address + emergency
// contact, all 8 marketing preferences, the lifecycle + follow-up fields, the
// lead `source_id` / `referral_code`, and `created_at`. Aligns 1:1 with the
// `Customer` store shape → future Supabase `customers` columns.

import type { Customer } from "@/lib/store";
import type { ExportColumn, ExportData } from "@/lib/export/export-data";

export interface CustomerExportLookups {
    /** branch id → display name (readable column alongside `branch_id`). */
    branchName: (id: string) => string;
    /** staff id → display name (for `assigned_to_name`). */
    staffName: (id: string) => string;
}

/** Optional boolean → "true" / "false"; undefined → "" (distinguishes
 *  "not set" from an explicit false, which matters for import). */
const boolCell = (v?: boolean): string => (v === undefined ? "" : v ? "true" : "false");

export function customersExportData(rows: Customer[], look: CustomerExportLookups): ExportData<Customer> {
    const columns: ExportColumn<Customer>[] = [
        { key: "id", value: c => c.id },
        { key: "branch_id", value: c => c.branchId },
        { key: "branch_name", value: c => look.branchName(c.branchId) },
        { key: "first_name", value: c => c.firstName },
        { key: "last_name", value: c => c.lastName },
        { key: "initials", value: c => c.initials },
        { key: "email", value: c => c.email },
        { key: "phone", value: c => c.phone ?? "" },
        { key: "status", value: c => c.status },
        { key: "plan_kind", value: c => c.planKind ?? "" },
        { key: "membership_id", value: c => c.membershipId ?? "" },
        { key: "package_ids", value: c => (c.packageIds ?? []).join("; ") },
        { key: "plan_name", value: c => c.planName ?? "" },
        { key: "credits_remaining", value: c => c.creditsRemaining ?? "" },
        { key: "plan_expiry", value: c => c.planExpiryISO ?? "" },
        { key: "date_of_birth", value: c => c.dateOfBirth ?? "" },
        { key: "gender", value: c => c.gender ?? "" },
        { key: "country", value: c => c.country ?? "" },
        { key: "state", value: c => c.state ?? "" },
        { key: "city", value: c => c.city ?? "" },
        { key: "postal_code", value: c => c.postalCode ?? "" },
        { key: "street_address", value: c => c.streetAddress ?? "" },
        { key: "emergency_contact_name", value: c => c.emergencyContactName ?? "" },
        { key: "emergency_contact_phone", value: c => c.emergencyContactPhone ?? "" },
        { key: "emergency_contact_relation", value: c => c.emergencyContactRelation ?? "" },
        { key: "marketing_channel_email", value: c => boolCell(c.marketingChannelEmail) },
        { key: "marketing_channel_whatsapp", value: c => boolCell(c.marketingChannelWhatsapp) },
        { key: "marketing_channel_sms", value: c => boolCell(c.marketingChannelSms) },
        { key: "marketing_channel_push", value: c => boolCell(c.marketingChannelPush) },
        { key: "marketing_topic_studio_announcements", value: c => boolCell(c.marketingTopicStudioAnnouncements) },
        { key: "marketing_topic_new_class_launch", value: c => boolCell(c.marketingTopicNewClassLaunch) },
        { key: "marketing_topic_special_offers", value: c => boolCell(c.marketingTopicSpecialOffers) },
        { key: "marketing_topic_promo_code_offers", value: c => boolCell(c.marketingTopicPromoCodeOffers) },
        { key: "lifecycle_tag", value: c => c.lifecycleTag ?? "" },
        { key: "lifecycle_tagged_on", value: c => c.lifecycleTaggedOn ?? "" },
        { key: "is_vip", value: c => boolCell(c.isVip) },
        { key: "follow_up_status", value: c => c.followUpStatus ?? "" },
        { key: "assigned_to", value: c => c.assignedTo ?? "" },
        { key: "assigned_to_name", value: c => (c.assignedTo ? look.staffName(c.assignedTo) : "") },
        { key: "source_id", value: c => c.sourceId ?? "" },
        { key: "referral_code", value: c => c.referralCode ?? "" },
        { key: "marketing_source", value: c => c.marketingSource ?? "" },
        { key: "converted_from", value: c => c.convertedFrom ?? "" },
        { key: "first_visit", value: c => c.firstVisitISO ?? "" },
        { key: "last_visit", value: c => c.lastVisitISO ?? "" },
        { key: "created_at", value: c => c.createdAt },
    ];
    return { entity: "customers", columns, rows };
}
