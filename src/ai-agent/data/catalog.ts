// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Data catalog (live from Zustand)
// ─────────────────────────────────────────────────────────────────────────────
//
// The queryable surface the agent reasons over. Adapted from
// ONRA AI-Agent/lib/data/catalog.ts — the POC read from static seed arrays;
// this build reads LIVE from Syncfit's Zustand store per request so the
// AI's answers reflect anything the admin created / edited seconds ago.
//
// Shape stays identical to the POC (`Row` / `FieldMeta` / `Dataset`) so
// the engine (data/engine.ts) is a near-verbatim port.
//
// One entry per dataset (7 total in Phase 2 — matches the POC coverage).
// Extending the catalog with a new dataset in Phase 8+ is a one-file edit:
//   1. Add a `readX` reader in `store-readers.ts` returning snake_case rows.
//   2. Add a `X: { key, label, rows: readX(state), fields: {...} }` entry
//      to the map returned by `buildCatalog` below.
//   3. Nothing else — the engine picks it up via `dataset` string.

import type { AppState } from "@/lib/store";
import {
    buildRefs,
    readTransactions,
    readCustomers,
    readClassSchedules,
    readClassBookings,
    readLeads,
    readCampaigns,
    readSpend,
    // Phase 8 datasets:
    readAppointments,
    readServices,
    readWalletTransactions,
    readPayrollEntries,
    readPromoCodes,
    // Phase 2 (2026-07-30) — retail catalog readers:
    readRetailProducts,
    readRetailStock,
    readRetailStockAdjustments,
    // Phase 3 Batch A (2026-07-30) — Product catalog:
    readMemberships,
    readPackages,
    readGiftCardDesigns,
    readIssuedGiftCards,
    type Row,
} from "@/ai-agent/data/store-readers";

export type FieldType = "enum" | "string" | "number" | "date" | "ref";

export interface FieldMeta {
    /** Actual key on the row object. */
    row: string;
    type: FieldType;
    /** Human label shown in card headers + CSV columns. */
    label: string;
    /** Enum options (used for the model's schema prompt). */
    values?: string[];
    /** Resolver: raw id → human label. Present when type === "ref". */
    ref?: (v: string) => string;
}

export interface Dataset {
    key: string;
    label: string;
    rows: Row[];
    fields: Record<string, FieldMeta>;
}

export type Catalog = Record<string, Dataset>;

/**
 * Build a full catalog from the current Zustand snapshot. Called ONCE per
 * agent request in the tools layer (Phase 3); every dataset in the returned
 * catalog sees the same store snapshot so a query that touches multiple
 * datasets (revenue + attendance to explain a dip) reads consistent data.
 */
export function buildCatalog(state: AppState): Catalog {
    const refs = buildRefs(state);
    // Reusable branch field — every table has it, so declared once.
    const branchField: FieldMeta = {
        row: "branch_id",
        type: "ref",
        label: "branch",
        ref: refs.branchName,
    };

    return {
        transactions: {
            key: "transactions",
            label: "revenue & payments (one row per payment)",
            rows: readTransactions(state),
            fields: {
                amount_aed:      { row: "amount_aed",      type: "number", label: "amount (AED)" },
                subtotal_aed:    { row: "subtotal_aed",    type: "number", label: "subtotal (AED, pre-tax)" },
                tax_aed:         { row: "tax_aed",         type: "number", label: "tax (AED)" },
                status:          { row: "status",          type: "enum",   label: "status", values: ["complete", "pending", "failed", "refunded"] },
                kind:            { row: "kind",            type: "enum",   label: "kind",   values: ["membership", "package", "cancellation_penalty", "freeze_fee", "retail"] },
                payment_method:  { row: "payment_method",  type: "enum",   label: "payment method", values: ["card", "cash"] },
                payment_source:  { row: "payment_source",  type: "enum",   label: "payment source", values: ["pos", "customer_portal", "admin"] },
                transaction_type:{ row: "transaction_type",type: "enum",   label: "ledger kind",    values: ["sale", "refund", "void", "write_off"] },
                product:         { row: "name",            type: "string", label: "product" },
                customer:        { row: "customer_id",     type: "ref",    label: "customer",       ref: refs.customerName },
                branch:          branchField,
                created_at:      { row: "created_at",      type: "date",   label: "date" },
                refunded_at:     { row: "refunded_at",     type: "date",   label: "refunded on" },
                refund_reason:   { row: "refund_reason",   type: "string", label: "refund reason" },
                card_type:       { row: "card_type",       type: "enum",   label: "card scheme", values: ["visa", "mastercard", "amex"] },
                // Retail snapshot on the transaction row (populated when kind === "retail")
                retail_product_id:   { row: "retail_product_id",              type: "string", label: "retail product id" },
                product_snapshot_name: { row: "product_snapshot_name",        type: "string", label: "product name at sale time" },
                product_snapshot_sku:  { row: "product_snapshot_sku",         type: "string", label: "SKU at sale time" },
                quantity:             { row: "quantity",                      type: "number", label: "quantity" },
                branch_id_at_sale:    { row: "branch_id_at_sale",             type: "string", label: "sale branch id" },
            },
        },

        customers: {
            key: "customers",
            label: "customers",
            rows: readCustomers(state),
            fields: {
                // Derived — combined first+last so the model's `contains`
                // filter works on multi-word queries like "Ava Wright".
                // Always prefer this over first_name/last_name for
                // name-based lookups; the anti-hallucination rule in the
                // prompt points here explicitly.
                full_name:   { row: "full_name",       type: "string", label: "full name" },
                first_name:  { row: "first_name",      type: "string", label: "first name" },
                last_name:   { row: "last_name",       type: "string", label: "last name" },
                email:       { row: "email",           type: "string", label: "email" },
                phone:       { row: "phone",           type: "string", label: "phone" },
                status:      { row: "status",          type: "enum",   label: "status", values: ["active", "inactive", "archived"] },
                plan_kind:   { row: "plan_kind",       type: "enum",   label: "plan kind", values: ["membership", "package"] },
                gender:      { row: "gender",          type: "enum",   label: "gender", values: ["Male", "Female"] },
                city:        { row: "city",            type: "string", label: "city" },
                state:       { row: "state",           type: "string", label: "state / region" },
                plan_name:   { row: "plan_name",       type: "string", label: "plan" },
                branch:      branchField,
                created_at:  { row: "created_at",      type: "date",   label: "joined date" },
                last_visit:  { row: "last_visit_iso",  type: "date",   label: "last visit" },
                first_visit: { row: "first_visit_iso", type: "date",   label: "first visit" },
                plan_expiry: { row: "plan_expiry_iso", type: "date",   label: "plan expiry" },
                // v83 Customer & Lead Management fields (client 2026-07-28 audit-4)
                lifecycle_tag:    { row: "lifecycle_tag",    type: "enum",   label: "lifecycle stage", values: ["Lead", "Trialist", "New Active", "Loyal Active", "At Risk", "Churned", "Won-back"] },
                follow_up_status: { row: "follow_up_status", type: "enum",   label: "follow-up status", values: ["New", "Contacted", "Trial booked", "Follow-up", "Won", "Lost"] },
                is_vip:           { row: "is_vip",           type: "enum",   label: "VIP", values: ["true", "false"] },
                marketing_source: { row: "marketing_source", type: "string", label: "source" },
                converted_from:   { row: "converted_from",   type: "enum",   label: "converted from", values: ["first-visit", "intro-offer", "trial-class", "referral"] },
                // ── Phase 1 widening (2026-07-30) ───────────────────────────────
                // Personal + safety — surfaced on the customer detail page and
                // used by front-desk / instructors during on-floor incidents.
                date_of_birth:              { row: "date_of_birth",              type: "date",   label: "date of birth" },
                emergency_contact_name:     { row: "emergency_contact_name",     type: "string", label: "emergency contact name" },
                emergency_contact_phone:    { row: "emergency_contact_phone",    type: "string", label: "emergency contact phone" },
                emergency_contact_relation: { row: "emergency_contact_relation", type: "string", label: "emergency contact relation" },
                // Address
                country:        { row: "country",       type: "string", label: "country" },
                postal_code:    { row: "postal_code",   type: "string", label: "postal code" },
                street_address: { row: "street_address",type: "string", label: "street address" },
                // Plan usage — credits / balance
                credits_remaining:  { row: "credits_remaining",  type: "number", label: "credits remaining" },
                credits_total:      { row: "credits_total",      type: "number", label: "credits total" },
                credits_used:       { row: "credits_used",       type: "number", label: "credits used" },
                account_credit_aed: { row: "account_credit_aed", type: "number", label: "account credit (AED)" },
                referral_code:      { row: "referral_code",      type: "string", label: "referral code" },
                membership_id:      { row: "membership_id",      type: "string", label: "held membership id" },
                // Marketing preferences — channels
                marketing_email:    { row: "marketing_email",    type: "enum", label: "marketing email opt-in", values: ["true", "false"] },
                marketing_whatsapp: { row: "marketing_whatsapp", type: "enum", label: "marketing WhatsApp opt-in", values: ["true", "false"] },
                marketing_sms:      { row: "marketing_sms",      type: "enum", label: "marketing SMS opt-in", values: ["true", "false"] },
                marketing_push:     { row: "marketing_push",     type: "enum", label: "push notifications opt-in", values: ["true", "false"] },
                // Marketing preferences — topics
                marketing_topic_announcements:    { row: "marketing_topic_announcements",    type: "enum", label: "studio announcements opt-in", values: ["true", "false"] },
                marketing_topic_new_class_launch: { row: "marketing_topic_new_class_launch", type: "enum", label: "new class launch opt-in", values: ["true", "false"] },
                marketing_topic_special_offers:   { row: "marketing_topic_special_offers",   type: "enum", label: "special offers opt-in", values: ["true", "false"] },
                marketing_topic_promo_codes:      { row: "marketing_topic_promo_codes",      type: "enum", label: "promo code offers opt-in", values: ["true", "false"] },
                // Integration + lifecycle transition date
                google_connected:    { row: "google_connected",    type: "enum", label: "Google account linked", values: ["true", "false"] },
                lifecycle_tagged_on: { row: "lifecycle_tagged_on", type: "date", label: "current stage tagged on" },
            },
        },

        classes: {
            key: "classes",
            label: "scheduled class sessions",
            rows: readClassSchedules(state),
            fields: {
                booked:     { row: "booked",        type: "number", label: "bookings" },
                capacity:   { row: "capacity",      type: "number", label: "capacity" },
                rating:     { row: "rating",        type: "number", label: "rating" },
                status:     { row: "status",        type: "enum",   label: "status", values: ["Completed", "Cancelled", "Ongoing", "Upcoming"] },
                class:      { row: "template_id",   type: "ref",    label: "class",      ref: refs.templateName },
                instructor: { row: "instructor_id", type: "ref",    label: "instructor", ref: refs.instructorName },
                branch:     branchField,
                date:       { row: "date_iso",      type: "date",   label: "date" },
            },
        },

        bookings: {
            key: "bookings",
            label: "class bookings (one row per booked seat)",
            rows: readClassBookings(state),
            fields: {
                attendance: { row: "attendance_status", type: "enum", label: "attendance", values: ["present", "no_show", "pending", "late_cancel"] },
                status:     { row: "status",            type: "enum", label: "status",     values: ["booked", "waitlisted", "cancelled"] },
                branch:     branchField,
            },
        },

        leads: {
            key: "leads",
            label: "sales leads / funnel",
            rows: readLeads(state),
            fields: {
                stage:             { row: "stage",                     type: "enum",   label: "stage",     values: ["new", "contacted", "trial-booked", "trial-attended", "paid", "lost"] },
                source:            { row: "source",                    type: "enum",   label: "source",    values: ["Instagram", "Google", "Website", "Walk-in", "Referral", "WhatsApp"] },
                engagement:        { row: "engagement_status",         type: "enum",   label: "engagement", values: ["cold", "warm", "hot", "converted", "lost"] },
                gender:            { row: "gender",                    type: "enum",   label: "gender",    values: ["Male", "Female"] },
                first_purchase_aed:{ row: "first_purchase_amount_aed", type: "number", label: "first purchase (AED)" },
                branch:            branchField,
                added_at:          { row: "added_at",                  type: "date",   label: "added date" },
            },
        },

        campaigns: {
            key: "campaigns",
            label: "marketing campaign performance",
            rows: readCampaigns(state),
            fields: {
                channel:                { row: "channel",                 type: "enum",   label: "channel", values: ["email", "whatsapp", "sms", "push"] },
                campaign:               { row: "campaign_name",           type: "string", label: "campaign" },
                sends:                  { row: "sends",                   type: "number", label: "sends" },
                opens:                  { row: "opens_reads",             type: "number", label: "opens" },
                clicks:                 { row: "clicks_taps",             type: "number", label: "clicks" },
                attributed_bookings:    { row: "attributed_bookings",     type: "number", label: "attributed bookings" },
                attributed_revenue_aed: { row: "attributed_revenue_aed", type: "number", label: "attributed revenue (AED)" },
                branch:                 branchField,
            },
        },

        spend: {
            key: "spend",
            label: "marketing spend",
            rows: readSpend(state),
            fields: {
                channel:   { row: "channel",  type: "enum",   label: "channel", values: ["Instagram", "Google", "WhatsApp", "Website"] },
                month:     { row: "month",    type: "string", label: "month" },
                spend_aed: { row: "spend_aed", type: "number", label: "spend (AED)" },
                branch:    branchField,
            },
        },

        // ─── Phase 8 datasets ────────────────────────────────────────────

        appointments: {
            key: "appointments",
            label: "private + recovery session bookings (opposite of classes)",
            rows: readAppointments(state),
            fields: {
                type:             { row: "type",             type: "enum",   label: "session type", values: ["private", "recovery"] },
                status:           { row: "status",           type: "enum",   label: "status",       values: ["Completed", "Cancelled", "Ongoing", "Upcoming"] },
                open_session:     { row: "open_session",     type: "enum",   label: "open session", values: ["true", "false"] },
                booked:           { row: "booked",           type: "number", label: "bookings" },
                capacity:         { row: "capacity",         type: "number", label: "capacity" },
                rating:           { row: "rating",           type: "number", label: "rating" },
                service:          { row: "service_id",       type: "ref",    label: "service",     ref: refs.serviceName },
                service_name:     { row: "service_name",     type: "string", label: "service name" },
                service_category: { row: "service_category", type: "string", label: "category" },
                instructor:       { row: "instructor_id",    type: "ref",    label: "instructor",  ref: refs.instructorName },
                branch:           branchField,
                date:             { row: "date_iso",         type: "date",   label: "date" },
            },
        },

        services: {
            key: "services",
            label: "private + recovery service catalog (what admin configures)",
            rows: readServices(state),
            fields: {
                type:         { row: "type",         type: "enum",   label: "session type", values: ["private", "recovery"] },
                status:       { row: "status",       type: "enum",   label: "status",       values: ["active", "inactive", "archived"] },
                open_session: { row: "open_session", type: "enum",   label: "open session", values: ["true", "false"] },
                price:        { row: "price",        type: "number", label: "price (AED)" },
                duration_min: { row: "duration_min", type: "number", label: "duration (min)" },
                capacity:     { row: "capacity",     type: "number", label: "capacity" },
                name:         { row: "name",         type: "string", label: "service" },
                category:     { row: "category",     type: "string", label: "category" },
                branch:       branchField,
            },
        },

        wallet_transactions: {
            key: "wallet_transactions",
            label: "customer account-credit ledger (AED — credit/debit)",
            rows: readWalletTransactions(state),
            fields: {
                type:            { row: "type",            type: "enum",   label: "type",           values: ["credit", "debit"] },
                reference_type:  { row: "reference_type",  type: "enum",   label: "reference type", values: ["referral", "pos_sale", "refund", "manual"] },
                amount_aed:      { row: "amount_aed",      type: "number", label: "amount (AED)" },
                customer:        { row: "customer_id",     type: "ref",    label: "customer",       ref: refs.customerName },
                reason:          { row: "reason",          type: "string", label: "reason" },
                branch:          branchField,
                created_at:      { row: "created_at",      type: "date",   label: "date" },
            },
        },

        payroll_entries: {
            key: "payroll_entries",
            label: "instructor payroll — one row per (instructor, period)",
            rows: readPayrollEntries(state),
            fields: {
                status:                 { row: "status",              type: "enum",   label: "status",           values: ["draft", "confirmed"] },
                classes_count:          { row: "classes_count",       type: "number", label: "classes taught" },
                total_attendees:        { row: "total_attendees",     type: "number", label: "attendees" },
                total_hours:            { row: "total_hours",         type: "number", label: "hours" },
                gross_revenue:          { row: "gross_revenue",       type: "number", label: "gross revenue (AED)" },
                base_earnings:          { row: "base_earnings",       type: "number", label: "base earnings (AED)" },
                commission_amount:      { row: "commission_amount",   type: "number", label: "commission (AED)" },
                total_earnings:         { row: "total_earnings",      type: "number", label: "total earnings (AED)" },
                instructor:             { row: "instructor_id",       type: "ref",    label: "instructor",       ref: refs.instructorName },
                pay_rate:               { row: "pay_rate_name",       type: "string", label: "pay rate" },
                branch:                 branchField,
                period_start:           { row: "period_start",        type: "date",   label: "period start" },
                period_end:              { row: "period_end",          type: "date",   label: "period end" },
            },
        },

        promo_codes: {
            key: "promo_codes",
            label: "promo codes (marketing discounts, POS redemption)",
            rows: readPromoCodes(state),
            fields: {
                status:           { row: "status",           type: "enum",   label: "status",          values: ["active", "inactive", "archived"] },
                discount_type:    { row: "discount_type",    type: "enum",   label: "discount type",   values: ["percentage", "fixed"] },
                offer_type:       { row: "offer_type",       type: "enum",   label: "offer type",      values: ["free_class", "free_trial", "percentage", "fixed_amount"] },
                action:           { row: "action",           type: "enum",   label: "action",          values: ["book_class", "buy_package"] },
                discount_value:   { row: "discount_value",   type: "number", label: "discount value" },
                usage_count:      { row: "usage_count",      type: "number", label: "uses so far" },
                usage_limit:      { row: "usage_limit",      type: "number", label: "usage limit" },
                min_purchase_aed: { row: "min_purchase_aed", type: "number", label: "min purchase (AED)" },
                code:             { row: "code",             type: "string", label: "code" },
                name:             { row: "name",             type: "string", label: "promo name" },
                valid_from:       { row: "valid_from",       type: "date",   label: "valid from" },
                valid_until:      { row: "valid_until",      type: "date",   label: "expires" },
            },
        },

        // ── Phase 2 (2026-07-30) — Retail catalog ────────────────────────────
        //
        // Three new datasets so the AI Agent can answer stock, retail-sales,
        // and audit-log questions. Retail products are studio-global (no
        // branch_id on the product row); retail_stock + retail_stock_adjustments
        // ARE branch-scoped, so they flow through branchFilter the same way
        // transactions do. Every stock + adjustment row denormalizes the
        // product name / SKU / category so group_by product renders nice
        // labels without joins.
        retail_products: {
            key: "retail_products",
            label: "retail catalog (studio-global — apparel, supplements, equipment, accessories)",
            rows: readRetailProducts(state),
            fields: {
                name:              { row: "name",              type: "string", label: "product name" },
                sku:               { row: "sku",               type: "string", label: "SKU" },
                category:          { row: "category",          type: "string", label: "category" },
                description:       { row: "description",       type: "string", label: "description" },
                status:            { row: "status",            type: "enum",   label: "status", values: ["active", "inactive", "archived"] },
                price_aed:         { row: "price_aed",         type: "number", label: "price (AED)" },
                unit_cost_aed:     { row: "unit_cost_aed",     type: "number", label: "unit cost (AED)" },
                reorder_threshold: { row: "reorder_threshold", type: "number", label: "reorder threshold" },
                created_at:        { row: "created_at",        type: "date",   label: "created" },
            },
        },

        retail_stock: {
            key: "retail_stock",
            label: "retail stock — one row per (product × branch), with on-hand units + reorder flag",
            rows: readRetailStock(state),
            fields: {
                product_name:      { row: "product_name",      type: "string", label: "product name" },
                sku:               { row: "sku",               type: "string", label: "SKU" },
                category:          { row: "category",          type: "string", label: "category" },
                units_on_hand:     { row: "units_on_hand",     type: "number", label: "units on hand" },
                reorder_threshold: { row: "reorder_threshold", type: "number", label: "reorder threshold" },
                stock_value_aed:   { row: "stock_value_aed",   type: "number", label: "stock value (AED)" },
                below_reorder:     { row: "below_reorder",     type: "enum",   label: "below reorder threshold", values: ["true", "false"] },
                branch:            branchField,
                last_adjusted_at:  { row: "last_adjusted_at",  type: "date",   label: "last adjusted" },
            },
        },

        retail_stock_adjustments: {
            key: "retail_stock_adjustments",
            label: "retail stock movements audit log (sale / receive / adjust / loss / refund)",
            rows: readRetailStockAdjustments(state),
            fields: {
                product_name:          { row: "product_name",          type: "string", label: "product name" },
                sku:                   { row: "sku",                   type: "string", label: "SKU" },
                kind:                  { row: "kind",                  type: "enum",   label: "movement kind", values: ["sale", "receive", "adjust", "loss", "refund"] },
                delta:                 { row: "delta",                 type: "number", label: "unit delta (signed)" },
                reason:                { row: "reason",                type: "string", label: "reason" },
                source_transaction_id: { row: "source_transaction_id", type: "string", label: "source transaction id" },
                created_by:            { row: "created_by",            type: "string", label: "actor" },
                branch:                branchField,
                created_at:            { row: "created_at",            type: "date",   label: "date" },
            },
        },

        // ── Phase 3 Batch A (2026-07-30) — Product catalog ─────────────────
        //
        // Memberships / packages / gift cards. Studio-global; `branch_id`
        // is only present when the product is single-branch scoped, so
        // multi-branch and "all branches" products correctly skip the
        // Branch Admin / Front Desk branch filter (matches admin behaviour).
        memberships: {
            key: "memberships",
            label: "memberships (recurring plans — Unlimited / Yoga Focused / Advanced / Beginner…)",
            rows: readMemberships(state),
            fields: {
                name:                { row: "name",                type: "string", label: "membership name" },
                description:         { row: "description",         type: "string", label: "description" },
                credits:             { row: "credits",             type: "string", label: "credits per cycle (or 'unlimited')" },
                credits_numeric:     { row: "credits_numeric",     type: "number", label: "credits per cycle (numeric — unlimited is blank)" },
                duration_months:     { row: "duration_months",     type: "number", label: "duration (months)" },
                price_aed:           { row: "price_aed",           type: "number", label: "price (AED)" },
                auto_renew:          { row: "auto_renew",          type: "enum",   label: "auto-renew default", values: ["true", "false"] },
                active_on_first_use: { row: "active_on_first_use", type: "enum",   label: "starts on first use", values: ["true", "false"] },
                branch_scope:        { row: "branch_scope",        type: "enum",   label: "branch scope", values: ["all", "single", "multi"] },
                branch_ids:          { row: "branch_ids",          type: "string", label: "branch ids (comma-separated)" },
                branch:              branchField,
                status:              { row: "status",              type: "enum",   label: "status", values: ["active", "inactive", "archived"] },
                created_at:          { row: "created_at",          type: "date",   label: "created" },
            },
        },

        packages: {
            key: "packages",
            label: "credit packages (one-time class-credit packs)",
            rows: readPackages(state),
            fields: {
                name:            { row: "name",            type: "string", label: "package name" },
                description:     { row: "description",     type: "string", label: "description" },
                credits:         { row: "credits",         type: "number", label: "credits included" },
                validity_days:   { row: "validity_days",   type: "number", label: "validity (days)" },
                price_aed:       { row: "price_aed",       type: "number", label: "price (AED)" },
                per_class_aed:   { row: "per_class_aed",   type: "number", label: "per-class price (AED)" },
                is_intro_offer:  { row: "is_intro_offer",  type: "enum",   label: "intro offer (new customers only)", values: ["true", "false"] },
                branch_scope:    { row: "branch_scope",    type: "enum",   label: "branch scope", values: ["all", "single", "multi"] },
                branch_ids:      { row: "branch_ids",      type: "string", label: "branch ids (comma-separated)" },
                branch:          branchField,
                status:          { row: "status",          type: "enum",   label: "status", values: ["active", "inactive", "archived"] },
                created_at:      { row: "created_at",      type: "date",   label: "created" },
            },
        },

        gift_card_designs: {
            key: "gift_card_designs",
            label: "gift card designs (POS-sellable templates)",
            rows: readGiftCardDesigns(state),
            fields: {
                name:             { row: "name",             type: "string", label: "design name" },
                value_type:       { row: "value_type",       type: "enum",   label: "value type", values: ["fixed", "custom"] },
                fixed_value_aed:  { row: "fixed_value_aed",  type: "number", label: "fixed value (AED)" },
                min_value_aed:    { row: "min_value_aed",    type: "number", label: "min custom value (AED)" },
                max_value_aed:    { row: "max_value_aed",    type: "number", label: "max custom value (AED)" },
                price_aed:        { row: "price_aed",        type: "number", label: "purchase price (AED)" },
                validity_days:    { row: "validity_days",    type: "number", label: "validity (days)" },
                no_expiry:        { row: "no_expiry",        type: "enum",   label: "no expiry", values: ["true", "false"] },
                status:           { row: "status",           type: "enum",   label: "status", values: ["active", "inactive", "archived"] },
                description:      { row: "description",      type: "string", label: "description" },
                issue_date:       { row: "issue_date",       type: "date",   label: "issue date" },
                valid_until_date: { row: "valid_until_date", type: "date",   label: "valid until" },
                created_at:       { row: "created_at",       type: "date",   label: "created" },
            },
        },

        issued_gift_cards: {
            key: "issued_gift_cards",
            label: "issued gift cards (sold instances with live balance)",
            rows: readIssuedGiftCards(state),
            fields: {
                design_name:         { row: "design_name",         type: "string", label: "design" },
                code:                { row: "code",                type: "string", label: "code" },
                customer:            { row: "customer_id",         type: "ref",    label: "customer",       ref: refs.customerName },
                recipient_name:      { row: "recipient_name",      type: "string", label: "recipient" },
                recipient_email:     { row: "recipient_email",     type: "string", label: "recipient email" },
                face_value_aed:      { row: "face_value_aed",      type: "number", label: "face value (AED)" },
                current_balance_aed: { row: "current_balance_aed", type: "number", label: "current balance (AED)" },
                status:              { row: "status",              type: "enum",   label: "status", values: ["active", "redeemed", "expired"] },
                issued_at:           { row: "issued_at",           type: "date",   label: "issued" },
                expires_at:          { row: "expires_at",          type: "date",   label: "expires" },
            },
        },
    };
}

/** Compact schema text for the system prompt so the model knows what it can
 *  query. Rebuilt per request from the same catalog the engine uses so the
 *  prompt + the query surface stay in agreement. */
export function schemaForPrompt(catalog: Catalog): string {
    return Object.values(catalog)
        .map((ds) => {
            const fields = Object.entries(ds.fields)
                .map(([name, m]) => {
                    return m.type === "enum"
                        ? `${name}(${m.values?.join("|")})`
                        : `${name}(${m.type})`;
                })
                .join(", ");
            return `• ${ds.key} — ${ds.label}. fields: ${fields}`;
        })
        .join("\n");
}
