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

import type { AppState } from "@/lib/store";

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

/** customerTransactions → snake_case (matches the POC's `customer_transactions` seed shape). */
export function readTransactions(state: AppState): Row[] {
    return state.customerTransactions.map(t => ({
        id: t.id,
        amount_aed: t.amountAed,
        status: t.status,
        kind: t.kind,
        payment_method: t.paymentMethod,
        name: t.name, // product name — kept for the `product` field
        branch_id: t.branchId,
        created_at: t.createdAtISO,
    }));
}

/** customers → snake_case (matches the POC's `customers` seed shape). */
export function readCustomers(state: AppState): Row[] {
    return state.customers.map(c => ({
        id: c.id,
        first_name: c.firstName,
        last_name: c.lastName,
        email: c.email,
        phone: c.phone,
        status: c.status,
        plan_kind: c.planKind,
        plan_name: c.planName,
        gender: c.gender,
        city: c.city,
        state: c.state,
        branch_id: c.branchId,
        created_at: c.createdAt,
        last_visit_iso: c.lastVisitISO,
        plan_expiry_iso: c.planExpiryISO,
    }));
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
