// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Zustand → snake_case store readers
// ─────────────────────────────────────────────────────────────────────────────
//
// Pure functions that pull a slice off Syncfit's Zustand store and return
// snake_case rows the AI engine's catalog can query. One function per
// dataset the catalog exposes. Adapters live here — the engine + catalog
// stay generic + schema-agnostic.
//
// Syncfit stores rows in TWO shapes:
//   • camelCase (Customer, ClassSchedule, ClassBooking, CustomerTransaction)
//     — these need real adapters that rename every field.
//   • snake_case (Lead, MarketingCampaignStat, MarketingSpend) — Reports v33
//     kept them as-is; those readers are a pass-through cast.
//
// Everything here is a synchronous read off `AppState`; no mutation, no
// side effects. The caller (data/catalog.ts) grabs
// `useAppStore.getState()` once per request and passes it through, so
// every dataset in a single query sees a consistent snapshot of the store.

import type { AppState, WalletTransaction } from "@/lib/store";
import { computeLifecycleTag } from "@/lib/customer/lifecycle";

/** Inlined wallet-balance derivation. Kept LOCAL to the server-side agent
 *  readers so we don't have to import from `@/lib/store` (which is marked
 *  `"use client"` — pulling that into the API route would break the
 *  server bundle). Matches the store's own `walletBalanceAed` exactly. */
function computeAccountCreditAed(
    transactions: readonly WalletTransaction[],
    customerId: string,
): number {
    let sum = 0;
    for (const t of transactions) {
        if (t.customerId !== customerId) continue;
        sum += t.type === "credit" ? t.amountAed : -t.amountAed;
    }
    return sum;
}

/** Row shape the engine works with. Every field is snake_case + primitive-ish. */
export type Row = Record<string, unknown>;

// ─── Reference dictionaries (id → human label) ───────────────────────────────
//
// Built once per call from the store snapshot; the catalog's `ref`-type
// fields close over these so `runList` / `runAnalyze` can substitute a
// pretty label without the engine touching the store.

export interface Refs {
    branchName: (id: string) => string;
    templateName: (id: string) => string;
    instructorName: (id: string) => string;
    customerName: (id: string) => string;
    /** Phase 8 — private/recovery service name lookup. */
    serviceName: (id: string) => string;
}

export function buildRefs(state: AppState): Refs {
    const branchById = new Map(state.branches.map(b => [b.id, b.name] as const));
    const templateById = new Map(state.classTemplates.map(t => [t.id, t.name] as const));
    const instructorById = new Map(state.instructors.map(i => [i.id, i.name] as const));
    const customerNameById = new Map(
        state.customers.map(c => [c.id, `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()] as const),
    );
    const serviceById = new Map(state.services.map(s => [s.id, s.name] as const));
    return {
        branchName:     (id: string) => branchById.get(id)     ?? id,
        templateName:   (id: string) => templateById.get(id)   ?? id,
        instructorName: (id: string) => instructorById.get(id) ?? id,
        customerName:   (id: string) => customerNameById.get(id) ?? id,
        serviceName:    (id: string) => serviceById.get(id)    ?? id,
    };
}

// ─── Adapters — camelCase Zustand rows → snake_case Row for the engine ──────
//
// Field maps intentionally target ONLY the columns the catalog exposes to
// the model. Adding a new queryable field means adding it to BOTH the
// reader here AND the field map in `catalog.ts` — kept side by side so
// the pair stays in sync.

/** customerTransactions → snake_case (matches the POC's `customer_transactions` seed shape).
 *  Phase 2 (2026-07-30) widens the projection so the AI can slice retail
 *  sales by product / quantity / branch-at-sale + reason customers about
 *  refunds. Every new field is optional on the store type; the projection
 *  emits undefined when the row doesn't carry it (e.g. non-retail rows have
 *  no retail_product_id). */
export function readTransactions(state: AppState): Row[] {
    return state.customerTransactions.map(t => ({
        id: t.id,
        customer_id: t.customerId,
        amount_aed: t.amountAed,
        subtotal_aed: t.subtotalAed,
        tax_aed: t.taxAed,
        status: t.status,
        kind: t.kind,
        payment_method: t.paymentMethod,
        payment_source: t.paymentSource,
        transaction_type: t.transactionType,
        name: t.name, // product name — kept for the `product` field
        branch_id: t.branchId,
        staff_id: t.staffId,
        created_at: t.createdAtISO,
        refunded_at: t.refundedAtISO,
        refund_reason: t.refundReason,
        card_type: t.cardType,
        // ── Retail-line-item snapshot (Phase 2 widen) ──
        retail_product_id: t.retailProductId,
        product_snapshot_name: t.productSnapshotName,
        product_snapshot_sku: t.productSnapshotSku,
        product_snapshot_price_aed: t.productSnapshotPriceAed,
        product_snapshot_unit_cost_aed: t.productSnapshotUnitCostAed,
        quantity: t.quantity,
        branch_id_at_sale: t.branchIdAtSale,
    }));
}

/** customers → snake_case (matches the POC's `customers` seed shape).
 *  Client 2026-07-28 audit-4 — Customer & Lead Management fields
 *  (lifecycle_tag, source_id, follow_up_status, assigned_to, is_vip,
 *  first_visit_iso, converted_from, marketing_source) added so the AI
 *  Agent can answer questions like "who's at churn risk?", "leads from
 *  Instagram", "customers assigned to me", "top VIPs". image_url added
 *  so `find_customer` cards can render avatars. */
export function readCustomers(state: AppState): Row[] {
    // v83 audit-1 (2026-07-29) — emit the LIVE lifecycle tag, computed
    // per-customer against the current store slices, NOT the stored
    // `c.lifecycleTag`. The admin list / profile pill / dashboard widget
    // all use live compute; a persisted stale tag (pre-rehydrate seed)
    // would make the AI Agent report a DIFFERENT stage than the admin
    // sees for the same person. Live compute keeps everyone in agreement.
    //
    // v83 audit-2 (2026-07-29) — defensive guard. computeLifecycleTag
    // reads customers / classBookings / customerPlans / customerTransactions.
    // In the AI Agent request path these come from `pickStoreSnapshot`;
    // if any of those slices ever go missing from the snapshot again
    // (audit-2 caught customerPlans missing), skip the live compute and
    // fall back to the stored tag instead of throwing on undefined.filter.
    const canComputeLive =
        Array.isArray(state.customers) &&
        Array.isArray(state.classBookings) &&
        Array.isArray(state.customerPlans) &&
        Array.isArray(state.customerTransactions);
    // Pre-index held-plan totals per customer so the credits_remaining +
    // credits_used projections don't scan customerPlans on every row.
    // Only ACTIVE / FROZEN plans count — cancelled or expired plans
    // wouldn't contribute credits the customer can still use.
    const planTotalsByCustomer = new Map<string, { total: number; used: number }>();
    if (Array.isArray(state.customerPlans)) {
        for (const p of state.customerPlans) {
            if (p.status !== "active" && p.status !== "frozen" && p.status !== "freeze_requested") continue;
            const prev = planTotalsByCustomer.get(p.customerId) ?? { total: 0, used: 0 };
            planTotalsByCustomer.set(p.customerId, {
                total: prev.total + (p.totalCredits ?? 0),
                used: prev.used + (p.creditsUsed ?? 0),
            });
        }
    }
    return state.customers.map(c => {
        const live = canComputeLive
            ? computeLifecycleTag(c.id, {
                customers: state.customers,
                classBookings: state.classBookings,
                customerPlans: state.customerPlans,
                customerTransactions: state.customerTransactions,
            })
            : null;
        const planTotals = planTotalsByCustomer.get(c.id);
        // Wallet balance is DERIVED (never persisted) via the same helper
        // every consumer surface uses, so the AI reads exactly the number
        // the customer's own Account Credit tab shows.
        const walletTxns = Array.isArray(state.walletTransactions) ? state.walletTransactions : [];
        const accountCreditAed = computeAccountCreditAed(walletTxns, c.id);
        // Derived helper for name-based lookups. The AI's `contains` filter
        // over `first_name` alone can't match a multi-word query like
        // "Ava Wright" — building the full name here lets the AI filter
        // full_name contains "<any substring>" and always find the right
        // person.
        const fullName = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
        return {
            id: c.id,
            first_name: c.firstName,
            last_name: c.lastName,
            full_name: fullName,
            email: c.email,
            phone: c.phone,
            image_url: c.imageUrl,
            status: c.status,
            plan_kind: c.planKind,
            plan_name: c.planName,
            membership_id: c.membershipId,
            gender: c.gender,
            city: c.city,
            state: c.state,
            country: c.country,
            postal_code: c.postalCode,
            street_address: c.streetAddress,
            branch_id: c.branchId,
            created_at: c.createdAt,
            last_visit_iso: c.lastVisitISO,
            plan_expiry_iso: c.planExpiryISO,
            first_visit_iso: c.firstVisitISO,
            // ── Personal / safety (Phase 1 widening 2026-07-30) ───────
            date_of_birth: c.dateOfBirth,
            emergency_contact_name: c.emergencyContactName,
            emergency_contact_phone: c.emergencyContactPhone,
            emergency_contact_relation: c.emergencyContactRelation,
            // ── Plan usage + money ────────────────────────────────────
            credits_remaining: c.creditsRemaining,
            credits_total: planTotals?.total,
            credits_used: planTotals?.used,
            account_credit_aed: accountCreditAed,
            referral_code: c.referralCode,
            // ── Marketing preferences (channels + topics) ─────────────
            marketing_email: c.marketingChannelEmail,
            marketing_whatsapp: c.marketingChannelWhatsapp,
            marketing_sms: c.marketingChannelSms,
            marketing_push: c.marketingChannelPush,
            marketing_topic_announcements: c.marketingTopicStudioAnnouncements,
            marketing_topic_new_class_launch: c.marketingTopicNewClassLaunch,
            marketing_topic_special_offers: c.marketingTopicSpecialOffers,
            marketing_topic_promo_codes: c.marketingTopicPromoCodeOffers,
            google_connected: c.googleConnected,
            // ── v83 Customer & Lead Management fields ─────────────────
            lifecycle_tag: live?.tag ?? c.lifecycleTag,
            lifecycle_tagged_on: c.lifecycleTaggedOn,
            source_id: c.sourceId,
            follow_up_status: c.followUpStatus,
            assigned_to: c.assignedTo,
            is_vip: c.isVip,
            converted_from: c.convertedFrom,
            marketing_source: c.marketingSource,
        };
    });
}

/** classSchedules → snake_case (matches the POC's `class_schedule` seed shape).
 *  Only class-type sessions surface here — appointments (private / recovery)
 *  are a separate dataset in a later phase. */
export function readClassSchedules(state: AppState): Row[] {
    return state.classSchedules
        .filter(s => s.type === "class")
        .map(s => ({
            id: s.id,
            template_id: s.templateId,
            instructor_id: s.instructorId,
            branch_id: s.branchId,
            booked: s.booked,
            capacity: s.capacity,
            rating: s.rating,
            status: s.status,
            date_iso: s.dateISO,
        }));
}

/** classBookings → snake_case (matches the POC's `class_bookings` seed shape). */
export function readClassBookings(state: AppState): Row[] {
    return state.classBookings.map(b => ({
        id: b.id,
        class_schedule_id: b.classScheduleId,
        customer_id: b.customerId,
        status: b.status,
        attendance_status: b.attendanceStatus,
        branch_id: b.branchId,
    }));
}

// ─── Pass-through readers (Reports v33 seeds — already snake_case) ──────────

/** leads — Reports v33, stored snake_case in Zustand. Cast is safe. */
export function readLeads(state: AppState): Row[] {
    return state.leads as unknown as Row[];
}

/** marketing_campaign_stats — Reports v33, stored snake_case. */
export function readCampaigns(state: AppState): Row[] {
    return state.marketingCampaignStats as unknown as Row[];
}

/** marketing_spend — Reports v33, stored snake_case. */
export function readSpend(state: AppState): Row[] {
    return state.marketingSpend as unknown as Row[];
}

// ─── Phase 8 datasets (private/recovery, wallet, services, payroll, promos) ─
//
// Each reader targets ONLY the fields the catalog exposes as queryable —
// adding a field to the model's query surface means editing this reader
// AND `catalog.ts` in lockstep.

/** appointments — private + recovery sessions (opposite of classSchedules,
 *  which is class-type only). Denormalised service name + category so the
 *  model can group_by them without joining. */
export function readAppointments(state: AppState): Row[] {
    return state.appointments.map(a => ({
        id: a.id,
        service_id: a.serviceId,
        service_name: a.serviceName,
        service_category: a.serviceCategory,
        type: a.type, // "private" | "recovery"
        open_session: a.openSession,
        instructor_id: a.instructorId,
        branch_id: a.branchId,
        booked: a.booked,
        capacity: a.capacity,
        rating: a.rating,
        status: a.status,
        date_iso: a.dateISO,
    }));
}

/** services — the private/recovery catalog admins configure. Not to be
 *  confused with class TEMPLATES (which live under `classTemplates`). */
export function readServices(state: AppState): Row[] {
    return state.services.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        category_id: s.categoryId,
        type: s.type,
        open_session: s.openSession,
        duration_min: s.durationMin,
        capacity: s.capacity,
        price: s.price,
        branch_id: s.branchId,
        status: s.status,
    }));
}

/** wallet_transactions — the account-credit (AED) ledger. `type` carries
 *  the sign (credit adds, debit subtracts); the model can sum by type or
 *  filter by reference_type to answer "how much did we credit to
 *  referrals" / "how much came back as refunds". */
export function readWalletTransactions(state: AppState): Row[] {
    return state.walletTransactions.map(w => ({
        id: w.id,
        customer_id: w.customerId,
        branch_id: w.branchId,
        type: w.type, // "credit" | "debit"
        amount_aed: w.amountAed,
        reason: w.reason,
        reference_type: w.referenceType,
        created_at: w.createdAtISO,
    }));
}

/** payroll_entries — one row per (instructor, period). Drives Compensation
 *  reports and instructor earnings questions ("who earned the most last
 *  month", "which pay rate paid out most"). */
export function readPayrollEntries(state: AppState): Row[] {
    return state.payrollEntries.map(p => ({
        id: p.id,
        instructor_id: p.instructorId,
        branch_id: p.branchId,
        pay_rate_id: p.payRateId,
        pay_rate_name: p.payRateName,
        period_start: p.periodStart,
        period_end: p.periodEnd,
        classes_count: p.classesCount,
        total_attendees: p.totalAttendees,
        total_hours: p.totalHours,
        gross_revenue: p.grossRevenue,
        base_earnings: p.baseEarnings,
        adjustment_amount: p.adjustmentAmount,
        commission_amount: p.commissionAmount ?? 0,
        total_earnings: p.totalEarnings,
        status: p.status,
    }));
}

/** promo_codes — already snake_case in the seed (`_types.ts`'s PromoCode
 *  interface uses snake_case fields). Cast + expose the query surface.
 *  The model can list active promos, sum usage_count, group by
 *  discount_type, or find codes above a redemption threshold. */
export function readPromoCodes(state: AppState): Row[] {
    return state.promoCodes.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name ?? p.code,
        discount_type: p.discount_type,
        discount_value: p.discount_value,
        max_discount_aed: p.max_discount_aed,
        min_purchase_aed: p.min_purchase_aed,
        usage_count: p.usage_count,
        usage_limit: p.usage_limit,
        valid_from: p.valid_from,
        valid_until: p.valid_until,
        status: p.status,
        offer_type: p.offer_type,
        action: p.action,
        // branch_id is left off — promo scoping uses a `branch_ids` array
        // (multi-branch) that scope.ts doesn't understand. Filtered by
        // `applies_to` product type + `customer_targeting` instead.
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — Retail catalog readers (2026-07-30)
// ─────────────────────────────────────────────────────────────────────────────
//
// Three new datasets so the AI Agent can answer stock, retail-sales, and
// audit-log questions. Consistent with the "denormalize display strings on
// dependent rows" pattern the schedule/booking readers use — stock rows and
// adjustment rows both carry `product_name` + `category_label` so a query
// like "which items are low on stock at Forma South?" doesn't need a join.
//
// Retail products are STUDIO-GLOBAL — no `branch_id` on the product row.
// Stock + adjustments ARE branch-scoped, so both flow through branchFilter
// via `branch_id` the same way transactions do.

/** retail_products — studio-global catalog: name, sku, price, cost,
 *  reorder threshold, category, status. */
export function readRetailProducts(state: AppState): Row[] {
    const categoryLabel = new Map(
        (state.retailCategories ?? []).map(c => [c.id, c.label] as const),
    );
    return (state.retailProducts ?? []).map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category_id: p.categoryId,
        category: categoryLabel.get(p.categoryId) ?? "Retail",
        description: p.description,
        price_aed: p.priceAed,
        unit_cost_aed: p.unitCostAed,
        reorder_threshold: p.reorderThreshold,
        image_url: p.imageUrl,
        sizes: (p.sizes ?? []).join(", "),
        status: p.status,
        created_at: p.createdAt,
    }));
}

/** retail_stock — one row per (product × branch × size); `size` is blank for
 *  sizeless products. Product name +
 *  category + reorder_threshold denormalized on the row so the model can
 *  filter units_on_hand <= reorder_threshold without a join, and group_by
 *  product_name / category / branch renders sensible axis labels. */
export function readRetailStock(state: AppState): Row[] {
    const productById = new Map((state.retailProducts ?? []).map(p => [p.id, p] as const));
    const categoryLabel = new Map(
        (state.retailCategories ?? []).map(c => [c.id, c.label] as const),
    );
    return (state.retailStock ?? []).map(s => {
        const product = productById.get(s.productId);
        return {
            id: s.id,
            product_id: s.productId,
            product_name: product?.name ?? "—",
            sku: product?.sku ?? "",
            category: product ? (categoryLabel.get(product.categoryId) ?? "Retail") : "Retail",
            branch_id: s.branchId,
            size: s.size ?? "",
            units_on_hand: s.unitsOnHand,
            reorder_threshold: product?.reorderThreshold ?? 0,
            stock_value_aed: (product?.unitCostAed ?? 0) * s.unitsOnHand,
            below_reorder:
                product != null && s.unitsOnHand <= (product.reorderThreshold ?? 0)
                    ? "true"
                    : "false",
            last_adjusted_at: s.lastAdjustedAt,
        };
    });
}

/** retail_stock_adjustments — audit log for stock movements. Kind =
 *  sale / receive / adjust / loss / refund. Delta is signed (negative on
 *  sale/loss, positive on receive/refund). Product name + branch id
 *  denormalized so the model can group_by product without a join. */
export function readRetailStockAdjustments(state: AppState): Row[] {
    const productById = new Map((state.retailProducts ?? []).map(p => [p.id, p] as const));
    return (state.retailStockAdjustments ?? []).map(a => {
        const product = productById.get(a.productId);
        return {
            id: a.id,
            product_id: a.productId,
            product_name: product?.name ?? "—",
            sku: product?.sku ?? "",
            branch_id: a.branchId,
            delta: a.delta,
            kind: a.kind,
            reason: a.reason,
            source_transaction_id: a.sourceTransactionId,
            created_by: a.createdBy,
            created_at: a.createdAt,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 Batch A — Product catalog (2026-07-30)
// ─────────────────────────────────────────────────────────────────────────────
//
// Memberships / packages / gift cards / issued gift cards. Memberships +
// packages are seeded snake_case and pass through the store without an
// adapter — the reader just re-exports the fields the AI cares about.
// A helper `branch_id` is emitted equal to the FIRST branch id in
// `branch_ids` when that list has one entry so single-branch products
// still flow through branchFilter cleanly; multi-branch / global products
// leave it undefined and skip the branch filter (matches the admin UI's
// "available at every active branch" semantic).

function primaryBranchId(branchIds: readonly string[] | undefined): string | undefined {
    if (!branchIds || branchIds.length !== 1) return undefined;
    return branchIds[0];
}

export function readMemberships(state: AppState): Row[] {
    return state.memberships.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        credits: m.credits === "unlimited" ? "unlimited" : String(m.credits),
        credits_numeric: m.credits === "unlimited" ? undefined : m.credits,
        duration_months: m.duration_months,
        price_aed: m.price_aed,
        auto_renew: m.auto_renew ? "true" : "false",
        active_on_first_use: m.active_on_first_use ? "true" : "false",
        branch_scope: m.branch_ids.length === 0 ? "all" : m.branch_ids.length === 1 ? "single" : "multi",
        branch_ids: m.branch_ids.join(","),
        branch_id: primaryBranchId(m.branch_ids),
        status: m.status,
        created_at: m.created_at,
    }));
}

export function readPackages(state: AppState): Row[] {
    return state.packages.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        credits: p.credits,
        validity_days: p.validity_days,
        price_aed: p.price_aed,
        per_class_aed: p.credits > 0 ? Math.round(p.price_aed / p.credits) : undefined,
        is_intro_offer: p.is_intro_offer ? "true" : "false",
        branch_scope: p.branch_ids.length === 0 ? "all" : p.branch_ids.length === 1 ? "single" : "multi",
        branch_ids: p.branch_ids.join(","),
        branch_id: primaryBranchId(p.branch_ids),
        status: p.status,
        created_at: p.created_at,
    }));
}

export function readGiftCardDesigns(state: AppState): Row[] {
    return state.giftCardDesigns.map(g => ({
        id: g.id,
        name: g.name,
        value_type: g.value_type,
        fixed_value_aed: g.fixed_value_aed,
        min_value_aed: g.min_value_aed,
        max_value_aed: g.max_value_aed,
        price_aed: g.price_aed,
        validity_days: g.validity_days,
        no_expiry: g.no_expiry ? "true" : "false",
        status: g.status,
        description: g.description,
        issue_date: g.issue_date,
        valid_until_date: g.valid_until_date,
        created_at: g.created_at,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 Batch B — Class + facility catalog (2026-07-30)
// ─────────────────────────────────────────────────────────────────────────────
//
// Class templates / categories / ratings / rooms / branches. Templates are
// camelCase in the store; ratings the same. Rooms + branches + categories
// are snake_case seed rows spread into the store, so pass-through.

export function readClassTemplates(state: AppState): Row[] {
    return state.classTemplates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        category_id: t.categoryId,
        location_type: t.locationType,
        duration_min: t.durationMin,
        capacity: t.capacity,
        status: t.status,
        applicable_memberships_count: t.applicableMembershipIds.length,
        applicable_packages_count: t.applicablePackageIds.length,
    }));
}

export function readClassCategories(state: AppState): Row[] {
    return state.classCategories.map(c => ({
        id: c.id,
        name: c.name,
        color_hex: c.color_hex,
    }));
}

/** class_ratings — one row per submitted rating. Denormalises class name,
 *  instructor name, customer name so `group_by instructor` / `avg score by
 *  category` queries render sensible labels. Soft-deleted ratings are
 *  excluded (matches admin behaviour). */
export function readClassRatings(state: AppState): Row[] {
    const scheduleById = new Map(state.classSchedules.map(s => [s.id, s] as const));
    const customerName = new Map(
        state.customers.map(c => [c.id, `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()] as const),
    );
    const instructorName = new Map(state.instructors.map(i => [i.id, i.name] as const));
    return state.classRatings
        .filter(r => !r.deletedAt)
        .map(r => {
            const sched = scheduleById.get(r.classScheduleId);
            return {
                id: r.id,
                class_schedule_id: r.classScheduleId,
                class_name: sched?.name ?? "—",
                category: sched?.category ?? "—",
                branch_id: sched?.branchId,
                customer_id: r.customerId,
                customer_name: customerName.get(r.customerId) ?? "—",
                instructor_id: r.instructorId,
                instructor_name: instructorName.get(r.instructorId) ?? "—",
                score: r.score,
                comment: r.comment,
                submitted_at: r.submittedAt,
            };
        });
}

export function readRooms(state: AppState): Row[] {
    return state.rooms.map(r => ({
        id: r.id,
        name: r.name,
        capacity: r.capacity,
        status: r.status,
        branch_id: r.branch_id,
        equipment_notes: r.equipment_notes,
    }));
}

export function readBranches(state: AppState): Row[] {
    return state.branches.map(b => ({
        id: b.id,
        name: b.name,
        status: b.status,
        is_main: b.is_main ? "true" : "false",
        address: b.address,
        phone: b.phone,
        email: b.email,
        city: b.city,
        state: b.state,
        country: b.country,
        // branch_id maps to itself so branchFilter treats each row as its
        // own branch — a Branch Admin scoped to Forma South still sees the
        // Forma South row, but not Forma East / West.
        branch_id: b.id,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 Batch C — Staff catalog (2026-07-30)
// ─────────────────────────────────────────────────────────────────────────────
//
// Staff members / pay rates / shifts / shift assignments / time off. Staff
// live camelCase in the store; pay rates are a discriminated union — the
// projection flattens to (type, primary_amount) so the AI can filter without
// knowing the shape of each variant. Shifts/assignments/blocked times are
// snake_case seed rows spread as-is; passthrough.

export function readStaff(state: AppState): Row[] {
    const roleName = new Map(state.roles.map(r => [r.id, r.name] as const));
    return state.staff.map(s => ({
        id: s.id,
        first_name: s.firstName,
        last_name: s.lastName,
        full_name: s.fullName || `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim(),
        email: s.email,
        phone: s.phone,
        role_id: s.roleId,
        role: roleName.get(s.roleId) ?? s.roleId,
        branch_id: s.branchId,
        status: s.status,
        first_login_completed: s.firstLoginCompleted ? "true" : "false",
        joined_date: s.joinedDate,
        specialties: (s.specialties ?? []).join(", "),
        pay_rate_id: s.payRateId,
        shift_id: s.shiftId,
    }));
}

export function readPayRates(state: AppState): Row[] {
    const branchName = new Map(state.branches.map(b => [b.id, b.name] as const));
    return state.payRates.map(pr => {
        // Flatten each variant to a single `primary_amount_aed` so the AI can
        // sort / group / filter without knowing the shape of each rate type.
        // Full detail (tiers / commissions / bonuses) lives on the admin
        // detail page — the AI just needs the summary figure and type.
        let primary = 0;
        if (pr.type === "flat") primary = pr.flatAmount;
        else if (pr.type === "revenue") primary = pr.splitPercent;
        else if (pr.type === "hybrid") primary = pr.baseRate;
        else if (pr.type === "monthly") primary = pr.fixedSalary;
        else if (pr.type === "tiered" && pr.tiers.length > 0) {
            primary = pr.tiers[0].aed ?? 0;
        }
        return {
            id: pr.id,
            name: pr.name,
            type: pr.type,
            branch_id: pr.branchId,
            branch: branchName.get(pr.branchId) ?? pr.branchId,
            primary_amount_aed: primary,
            status: pr.status,
            usage_count: pr.usageCount,
            only_checked_in: pr.onlyCheckedIn ? "true" : "false",
            include_late_cancelled: pr.includeLateCancelled ? "true" : "false",
            created_at: pr.createdAt,
        };
    });
}

export function readShifts(state: AppState): Row[] {
    return state.shifts.map(s => ({
        id: s.id,
        name: s.name,
        branch_id: s.branch_id,
        start_time: s.start_time,
        end_time: s.end_time,
        staffing_target: s.staffing_target,
        status: s.status,
        // Number of days per week the shift covers (sum of true bits).
        working_days_count: s.working_days.filter(Boolean).length,
        created_at: s.created_at,
    }));
}

export function readShiftAssignments(state: AppState): Row[] {
    const staffName = new Map(state.staff.map(s => [s.id, `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim()] as const));
    const shiftName = new Map(state.shifts.map(s => [s.id, s.name] as const));
    const shiftBranch = new Map(state.shifts.map(s => [s.id, s.branch_id] as const));
    return state.shiftAssignments.map(a => ({
        id: a.id,
        shift_id: a.shift_id,
        shift_name: shiftName.get(a.shift_id) ?? "—",
        staff_id: a.staff_id,
        staff_name: staffName.get(a.staff_id) ?? "—",
        branch_id: shiftBranch.get(a.shift_id),
        days_of_week_count: a.days_of_week.filter(Boolean).length,
        created_at: a.created_at,
    }));
}

export function readBlockedTimes(state: AppState): Row[] {
    const staffName = new Map(state.staff.map(s => [s.id, `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim()] as const));
    return state.blockedTimes.map(b => ({
        id: b.id,
        title: b.title,
        date_from_iso: b.date_from_iso,
        date_to_iso: b.date_to_iso,
        all_day: b.all_day ? "true" : "false",
        start_time: b.start_time,
        end_time: b.end_time,
        reason: b.reason,
        note: b.note,
        staff_ids: b.staff_ids.join(","),
        // First-assigned staff (if any) as a resolvable ref — the AI can
        // filter by `staff_name contains "River"` on a single-staff entry.
        staff_id: b.staff_ids[0],
        staff_name: b.staff_ids[0] ? staffName.get(b.staff_ids[0]) ?? "—" : "",
        branch_id: b.branch_id,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 Batch D — Settings catalog (2026-07-30)
// ─────────────────────────────────────────────────────────────────────────────
//
// Tax rates / agreements + single-row policy config (cancellation, freeze,
// referral) exposed as datasets so the AI can answer "what's our late-cancel
// policy?" without the model inventing a value. Single-row config datasets
// return exactly one row so list_records({dataset:"cancellation_policy"})
// returns a table with 1 row × N columns.

export function readTaxRates(state: AppState): Row[] {
    return state.taxRates.map(t => ({
        id: t.id,
        name: t.name,
        rate_percentage: t.ratePercentage,
        kind: t.kind,
        type: t.type,
        calculation_mode: t.calculationMode,
        status: t.status,
        description: t.description,
        valid_from: t.validFromISO,
        valid_until: t.validUntilISO,
        created_at: t.createdAt,
    }));
}

export function readAgreements(state: AppState): Row[] {
    return state.agreements.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        description: a.description,
        required: a.required ? "true" : "false",
        current_version: a.currentVersion,
        all_locations: a.allLocations ? "true" : "false",
        effective_dates_mode: a.effectiveDatesMode ?? "ongoing",
        effective_from: a.effectiveFrom,
        effective_until: a.effectiveUntil,
        require_re_acceptance: a.requireReAcceptance ? "true" : "false",
        require_guardian_consent: a.requireGuardianConsent ? "true" : "false",
        status: a.status,
        updated_at: a.updatedAt,
        created_at: a.createdAt,
    }));
}

/** Single-row cancellation policy — the studio's rule set for late cancels
 *  + no-shows. Returned as a 1-row table so `list_records({dataset:"cancellation_policy"})`
 *  is a natural way to ask "what's our cancellation policy?". */
export function readCancellationPolicy(state: AppState): Row[] {
    const c = state.cancellationPolicy;
    if (!c) return [];
    return [{
        id: c.id,
        credit_before_window: `${c.credit_before_window_value} ${c.credit_before_window_unit}`,
        credit_before_outcome: c.credit_before_outcome,
        credit_within_window: `${c.credit_within_window_value} ${c.credit_within_window_unit}`,
        credit_within_outcome: c.credit_within_outcome,
        membership_penalty_enabled: c.membership_penalty_after_cancellations_enabled ? "true" : "false",
        membership_penalty_threshold: c.membership_penalty_after_cancellations_count,
        membership_late_cancel_fee_enabled: c.membership_late_cancel_fee_enabled ? "true" : "false",
        membership_late_cancel_fee_aed: c.membership_late_cancel_fee_aed,
        membership_no_show_fee_enabled: c.membership_no_show_fee_enabled ? "true" : "false",
        membership_no_show_fee_aed: c.membership_no_show_fee_aed,
        applied_to_package_count: c.applied_to_package_ids.length,
        applied_to_class_template_count: c.applied_to_class_template_ids.length,
    }];
}

/** Single-row freeze policy — the studio's rules for pausing memberships. */
export function readFreezePolicy(state: AppState): Row[] {
    const f = state.freezePolicy;
    if (!f) return [];
    return [{
        id: f.id,
        enabled: f.enabled ? "true" : "false",
        billing_behavior: f.billing_behavior,
        who_can_freeze: f.who_can_freeze,
        min_duration_value: f.min_duration_value,
        min_duration_unit: f.min_duration_unit,
        max_freezes_period: f.max_freezes_period,
        max_freezes: f.max_freezes,
        limit_freezes_enabled: f.limit_freezes_enabled ? "true" : "false",
        fee_enabled: f.fee_enabled ? "true" : "false",
        fee_type: f.fee_type,
        fee_amount_aed: f.fee_amount_aed,
        require_reason: f.require_reason ? "true" : "false",
        reasons_count: (f.reasons ?? []).length,
    }];
}

/** Single-row referral settings — the studio's rewards program config. */
export function readReferralSettings(state: AppState): Row[] {
    const r = state.referralSettings;
    if (!r) return [];
    return [{
        id: "referral_settings_default",
        program_active: r.programActive ? "true" : "false",
        referrer_earn_type: r.referrerEarnType,
        referrer_earn_amount: r.referrerEarnAmount,
        friend_earn_type: r.friendEarnType,
        friend_earn_amount: r.friendEarnAmount,
        reward_unlock_trigger: r.rewardUnlockTrigger,
        max_referrals_per_member: r.maxReferralsPerMember,
        earned_reward_expiry_days: r.earnedRewardExpiryDays,
        monthly_program_budget_aed: r.monthlyProgramBudgetAed,
        prevent_self_referral: r.preventSelfReferral ? "true" : "false",
    }];
}

/** notification_settings — one row per event × recipient. Channels + template
 *  approval status + criticality flags exposed so admin can answer "what
 *  notifications are enabled?" / "which templates are pending approval?". */
export function readNotificationSettings(state: AppState): Row[] {
    return state.notificationSettings.map(n => ({
        id: n.id,
        category: n.category,
        notification_type: n.notificationType,
        label: n.label,
        email_enabled: n.emailEnabled ? "true" : "false",
        whatsapp_enabled: n.whatsappEnabled ? "true" : "false",
        sms_enabled: n.smsEnabled ? "true" : "false",
        whatsapp_approval_status: n.whatsappApprovalStatus,
        is_critical: n.isCritical ? "true" : "false",
        send_mode: n.sendMode,
        sent_during_campaigns: n.sentDuringCampaigns ? "true" : "false",
        recipient_source: n.recipientSource ?? "customer",
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 Batch E — Customer relations catalog (2026-07-30)
// ─────────────────────────────────────────────────────────────────────────────
//
// customer_plans (which customer holds which membership / package) +
// customer_referrals (who referred whom + reward). Both denormalise the
// customer name so the AI can filter / group by name without a join.

export function readCustomerPlans(state: AppState): Row[] {
    const customerName = new Map(
        state.customers.map(c => [c.id, `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()] as const),
    );
    const customerBranch = new Map(state.customers.map(c => [c.id, c.branchId] as const));
    return state.customerPlans.map(p => ({
        id: p.id,
        customer_id: p.customerId,
        customer_name: customerName.get(p.customerId) ?? "—",
        branch_id: customerBranch.get(p.customerId),
        kind: p.kind,
        product_id: p.productId,
        name: p.name,
        plan_type_label: p.planTypeLabel,
        credits_label: p.creditsLabel,
        status: p.status,
        purchased_at: p.purchasedAtISO,
        expiry_iso: p.expiryISO,
        price_aed: p.priceAed,
        freeze_start: p.freezeStartISO,
        freeze_end: p.freezeEndISO,
        freeze_source: p.freezeSource,
        freeze_reason: p.freezeReason,
        freeze_count: p.freezeCount,
        total_credits: p.totalCredits,
        credits_used: p.creditsUsed,
        auto_renew: p.autoRenew ? "true" : "false",
    }));
}

export function readCustomerReferrals(state: AppState): Row[] {
    const customerName = new Map(
        state.customers.map(c => [c.id, `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()] as const),
    );
    const customerBranch = new Map(state.customers.map(c => [c.id, c.branchId] as const));
    return state.customerReferrals.map(r => ({
        id: r.id,
        referrer_customer_id: r.referrerCustomerId,
        referrer_name: customerName.get(r.referrerCustomerId) ?? "—",
        referred_name: r.referredName,
        referred_email: r.referredEmail,
        benefit_type: r.benefitType,
        benefit_amount: r.benefitAmount,
        benefit_credits: r.benefitCredits,
        referred_at: r.referredAtISO,
        expires_at: r.expiresAtISO,
        origin_branch_id: r.originBranchId,
        // Refer to referrer's branch for scope filtering when originBranchId
        // is unset (legacy rows) — keeps rows visible to Branch Admins.
        branch_id: r.originBranchId ?? customerBranch.get(r.referrerCustomerId),
    }));
}

/** issued_gift_cards — sold gift card instances. Carries the live balance
 *  and links back to the design + the customer who owns it. */
export function readIssuedGiftCards(state: AppState): Row[] {
    const designById = new Map(state.giftCardDesigns.map(d => [d.id, d] as const));
    return state.issuedGiftCards.map(g => {
        const design = designById.get(g.design_id);
        return {
            id: g.id,
            design_id: g.design_id,
            design_name: design?.name ?? "—",
            code: g.code,
            customer_id: g.customer_id,
            recipient_name: g.recipient_name,
            recipient_email: g.recipient_email,
            face_value_aed: g.face_value_aed,
            current_balance_aed: g.current_balance_aed,
            status: g.status,
            issued_at: g.issued_at,
            expires_at: g.expires_at,
        };
    });
}
