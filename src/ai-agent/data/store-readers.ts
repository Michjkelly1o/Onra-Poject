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
}

export function buildRefs(state: AppState): Refs {
    const branchById = new Map(state.branches.map(b => [b.id, b.name] as const));
    const templateById = new Map(state.classTemplates.map(t => [t.id, t.name] as const));
    const instructorById = new Map(state.instructors.map(i => [i.id, i.name] as const));
    const customerNameById = new Map(
        state.customers.map(c => [c.id, `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()] as const),
    );
    return {
        branchName:     (id: string) => branchById.get(id)     ?? id,
        templateName:   (id: string) => templateById.get(id)   ?? id,
        instructorName: (id: string) => instructorById.get(id) ?? id,
        customerName:   (id: string) => customerNameById.get(id) ?? id,
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
