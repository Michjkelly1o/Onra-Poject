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
                amount_aed:     { row: "amount_aed",     type: "number", label: "amount (AED)" },
                status:         { row: "status",         type: "enum",   label: "status", values: ["complete", "pending", "failed", "refunded"] },
                kind:           { row: "kind",           type: "enum",   label: "kind",   values: ["membership", "package", "cancellation_penalty", "freeze_fee"] },
                payment_method: { row: "payment_method", type: "enum",   label: "payment method", values: ["card", "cash"] },
                product:        { row: "name",           type: "string", label: "product" },
                branch:         branchField,
                created_at:     { row: "created_at",     type: "date",   label: "date" },
            },
        },

        customers: {
            key: "customers",
            label: "customers",
            rows: readCustomers(state),
            fields: {
                status:      { row: "status",          type: "enum",   label: "status", values: ["active", "inactive", "archived"] },
                plan_kind:   { row: "plan_kind",       type: "enum",   label: "plan kind", values: ["membership", "package"] },
                gender:      { row: "gender",          type: "enum",   label: "gender", values: ["Male", "Female"] },
                city:        { row: "city",            type: "string", label: "city" },
                state:       { row: "state",           type: "string", label: "state" },
                plan_name:   { row: "plan_name",       type: "string", label: "plan" },
                branch:      branchField,
                created_at:  { row: "created_at",      type: "date",   label: "joined date" },
                last_visit:  { row: "last_visit_iso",  type: "date",   label: "last visit" },
                plan_expiry: { row: "plan_expiry_iso", type: "date",   label: "plan expiry" },
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
