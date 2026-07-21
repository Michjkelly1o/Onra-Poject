// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Coming Up tab data layer
// ─────────────────────────────────────────────────────────────────────────────
//
// Pure selectors that produce every number the Coming Up tab renders —
// the tile strip, the stacked revenue chart, the capacity heatmap, and
// the event chip row. Sits between the dashboard's branch-scoped store
// slices and the tab's presentational components.
//
// All functions are inputs-in / values-out. No React, no store reads,
// no dates from `new Date()` — the "today" anchor is passed in so
// tests and cross-tab sync stay deterministic. Filter semantics:
//
//   • range     — 7 | 30 (calendar days ahead, starting today)
//   • type      — SessionType | "" ("" = all types)
//   • branches  — already applied upstream via the scoped slices; the
//                 caller passes filtered data, so nothing here reads
//                 a branch id
//
// Client 2026-07-21 replaces the old Coming Up KPI grid with this
// data-driven layout — see new-prd/onracomingupv3_7_1_5 (1).html.

import type {
    ClassInstance,
    ClassBooking,
    Customer,
    CustomerTransaction,
    CustomerPlan,
    Appointment,
    AppointmentBooking,
    BlockedTime,
    SessionType,
} from "@/lib/store";
import { DROP_IN_PRICE_AED } from "@/lib/customer/booking-flow";

// ── Public shapes ───────────────────────────────────────────────────────────

/** A single tick on the x-axis. `dateISOs` are the actual days it covers
 *  so downstream metrics can slice per-period without repeating window
 *  math. In 7-day mode each period covers ONE day; in 30-day mode each
 *  covers 7 days. */
export interface Period {
    /** Short primary label (e.g. "Sat", "Wk 1"). */
    label: string;
    /** Subtitle line (e.g. "18 Jul", "18–24 Jul"). */
    sub: string;
    /** ISO days YYYY-MM-DD (local) covered by this period, ordered. */
    dateISOs: string[];
    /** First day of the period — used for the schedule deep-link on
     *  bar click and for the revenue/capacity per-period filters. */
    startISO: string;
    /** Inclusive last day of the period — used for the 30-day-mode range
     *  deep-link (`?dateFrom&dateTo`) and to bound the closing edge. */
    endISO: string;
}

/** Per-period revenue split by session type (AED). */
export interface RevenueByPeriod {
    period: Period;
    /** AED per type — always all three keys, even in single-type mode
     *  (unused keys stay 0). Simplifies the stacked chart's inner loop. */
    rev: Record<SessionType, number>;
    /** Total AED across active types — pre-computed so the y-scale can
     *  read the max in one pass. */
    total: number;
}

/** Per-period capacity fill % (0–100) by session type. `null` means the
 *  period has no sessions of that type (rendered as a "closed" cell in
 *  the heatmap). */
export interface CapacityByPeriod {
    period: Period;
    fill: Record<SessionType, number | null>;
}

/** An event chip on the revenue chart — surfaces studio-affecting
 *  moments in the window (instructor absence, oversized workshop). */
export interface EventChip {
    /** Which period's column the chip sits under. */
    periodIndex: number;
    /** Which type's color the chip's leading dot uses. `null` for
     *  cross-type events. */
    type: SessionType | null;
    /** Short chip label. */
    text: string;
}

// ── Window construction ─────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** Local YYYY-MM-DD for a Date. Matches isoDayLocal in customer/dates. */
function isoDayLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseLocalISO(iso: string): Date {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d);
}

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_ABBR   = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(iso: string): string {
    const d = parseLocalISO(iso);
    return WEEKDAY_ABBR[d.getDay()];
}
function daySub(iso: string): string {
    const d = parseLocalISO(iso);
    return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
}
function weekSub(startISO: string, endISO: string): string {
    const a = parseLocalISO(startISO);
    const b = parseLocalISO(endISO);
    if (a.getMonth() === b.getMonth()) {
        return `${a.getDate()}–${b.getDate()} ${MONTH_ABBR[b.getMonth()]}`;
    }
    return `${a.getDate()} ${MONTH_ABBR[a.getMonth()]} – ${b.getDate()} ${MONTH_ABBR[b.getMonth()]}`;
}

/** Build the array of periods for the current range. 7-day mode returns
 *  7 single-day periods starting today; 30-day mode returns 4 seven-day
 *  weeks starting today (labelled "Wk 1"–"Wk 4"). The 4-week model
 *  matches the mockup — the client picked whole weeks over a rolling
 *  30-day slide because renewal reads more cleanly week-over-week. */
export function windowPeriods(range: 7 | 30, todayISO: string): Period[] {
    const start = parseLocalISO(todayISO);
    if (range === 7) {
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start.getTime() + i * DAY_MS);
            const iso = isoDayLocal(d);
            return {
                label: dayLabel(iso),
                sub: daySub(iso),
                dateISOs: [iso],
                startISO: iso,
                endISO: iso,
            };
        });
    }
    // 30-day mode → 4 weeks of 7 days each = 28 days shown.
    return Array.from({ length: 4 }, (_, w) => {
        const dateISOs = Array.from({ length: 7 }, (_, i) =>
            isoDayLocal(new Date(start.getTime() + (w * 7 + i) * DAY_MS)),
        );
        return {
            label: `Wk ${w + 1}`,
            sub: weekSub(dateISOs[0], dateISOs[6]),
            dateISOs,
            startISO: dateISOs[0],
            endISO: dateISOs[6],
        };
    });
}

/** Full window bounds — first ISO day (inclusive), last ISO day
 *  (inclusive). Handy for "any plan expiring in the window" checks. */
export function windowBounds(range: 7 | 30, todayISO: string): { fromISO: string; toISO: string } {
    const periods = windowPeriods(range, todayISO);
    return {
        fromISO: periods[0].startISO,
        toISO:   periods[periods.length - 1].endISO,
    };
}

// ── Session-per-period helpers ──────────────────────────────────────────────

/** Classes are paid via credits / drop-in — sum booked × drop-in price.
 *  Appointments are per-session pricing — sum booked × service price.
 *  Both are BOOKED-seat projections (empty seats don't count). */
function sessionRevenueAed(s: ClassInstance): number {
    const seats = Math.max(0, s.booked ?? 0);
    if (s.type === "class") return seats * DROP_IN_PRICE_AED;
    // ClassInstance projected from an appointment carries `price` on the
    // upstream Appointment; the projection preserves it as `.price` when
    // present. Fall back to DROP_IN_PRICE_AED for safety.
    const perSeat = (s as ClassInstance & { price?: number }).price;
    return seats * (typeof perSeat === "number" ? perSeat : DROP_IN_PRICE_AED);
}

/** Session-type predicate — respects the "" = all filter convention. */
function typeMatches(sessionType: SessionType, filter: SessionType | ""): boolean {
    return filter === "" || sessionType === filter;
}

// ── Revenue projection ──────────────────────────────────────────────────────

/** Stacked revenue per period × session type. Callers pass the
 *  branch-scoped merged sessions slice; the `type` filter zeroes out
 *  other types so the chart naturally re-renders single-type or all. */
export function revenueByPeriod(
    sessions: ClassInstance[],
    periods: Period[],
    filter: SessionType | "",
): RevenueByPeriod[] {
    const byDay = new Map<string, Record<SessionType, number>>();
    for (const s of sessions) {
        if (!typeMatches(s.type, filter)) continue;
        const key = s.dateISO.slice(0, 10);
        const bucket = byDay.get(key) ?? { class: 0, private: 0, recovery: 0 };
        bucket[s.type] += sessionRevenueAed(s);
        byDay.set(key, bucket);
    }
    return periods.map(period => {
        const rev: Record<SessionType, number> = { class: 0, private: 0, recovery: 0 };
        for (const iso of period.dateISOs) {
            const day = byDay.get(iso);
            if (!day) continue;
            rev.class    += day.class;
            rev.private  += day.private;
            rev.recovery += day.recovery;
        }
        const total = rev.class + rev.private + rev.recovery;
        return { period, rev, total };
    });
}

// ── Capacity heat ───────────────────────────────────────────────────────────

/** Per-period fill % (0–100) by session type. Sums booked / capacity
 *  across every session of that type in the period, weighted by
 *  capacity so a single tiny under-filled class doesn't tank the row
 *  the same way as ten of them. */
export function capacityByPeriod(
    sessions: ClassInstance[],
    periods: Period[],
    filter: SessionType | "",
): CapacityByPeriod[] {
    return periods.map(period => {
        const daySet = new Set(period.dateISOs);
        const inPeriod = sessions.filter(s => daySet.has(s.dateISO.slice(0, 10)));
        const fill: Record<SessionType, number | null> = { class: null, private: null, recovery: null };
        for (const t of ["class", "private", "recovery"] as const) {
            if (!typeMatches(t, filter)) continue;
            const scoped = inPeriod.filter(s => s.type === t);
            const cap = scoped.reduce((n, s) => n + (s.capacity ?? 0), 0);
            const book = scoped.reduce((n, s) => n + (s.booked ?? 0), 0);
            fill[t] = cap > 0 ? Math.round((book / cap) * 100) : null;
        }
        return { period, fill };
    });
}

// ── Event chips ─────────────────────────────────────────────────────────────

/** The two chip signals we surface today:
 *
 *  • Instructor away — a `blocked_time` row falls in one of the periods.
 *    The instructor's initials + "away" render as an appt-tinted chip
 *    (private sessions are the most schedule-sensitive to instructor
 *    absences; recovery + class use different color if we ever add
 *    those).
 *
 *  • Workshop — a class instance whose capacity is >= 20 in a period.
 *    Renders as "Workshop · N/N sold" (class-tinted).
 *
 *  The chip row only fires for the active type filter (or all types).
 *  Returns at most ONE chip per period so the row stays readable.
 */
export function eventChips(
    sessions: ClassInstance[],
    blockedTimes: BlockedTime[],
    staffFullName: (id: string) => string | undefined,
    periods: Period[],
    filter: SessionType | "",
): EventChip[] {
    const chips: EventChip[] = [];
    periods.forEach((period, i) => {
        const daySet = new Set(period.dateISOs);
        // Workshop takes precedence — it's the more actionable signal.
        if (filter === "" || filter === "class") {
            const workshop = sessions.find(
                s => s.type === "class" && daySet.has(s.dateISO.slice(0, 10)) && (s.capacity ?? 0) >= 20,
            );
            if (workshop) {
                chips.push({
                    periodIndex: i,
                    type: "class",
                    text: `Workshop · ${workshop.booked}/${workshop.capacity} sold`,
                });
                return;
            }
        }
        if (filter === "" || filter === "private") {
            const away = blockedTimes.find(bt => daySet.has(bt.date.slice(0, 10)) && bt.staff_ids.length > 0);
            if (away) {
                const name = staffFullName(away.staff_ids[0]);
                if (name) {
                    const shortName = name.split(" ").filter(Boolean).map((p, idx, arr) =>
                        idx === arr.length - 1 ? `${p[0]}.` : p,
                    ).join(" ");
                    chips.push({ periodIndex: i, type: "private", text: `${shortName} away` });
                }
            }
        }
    });
    return chips;
}

// ── Strip metrics ───────────────────────────────────────────────────────────

/** All numbers the strip needs, keyed by the tile they feed. The strip
 *  variants (all / class / private / recovery) pick a subset per the
 *  client's tile map. Every value already respects range + type +
 *  branch — callers pass pre-scoped slices. */
export interface StripMetrics {
    /** Total revenue AED across active types in the window. */
    revenueTotalAed: number;
    /** Split of revenue AED by type — drives the tooltip on the All-mode
     *  Revenue tile. */
    revenueByType: Record<SessionType, number>;
    /** Total bookings in the window (all types). */
    bookingsTotal: number;
    bookingsByType: Record<SessionType, number>;
    /** First-time bookers — customers whose FIRST booking (class OR
     *  appointment) falls in the window. */
    newCustomersTotal: number;
    newCustomersByType: Record<SessionType, number>;
    /** Returning customers — bookings from customers whose FIRST booking
     *  is before the window (i.e. NOT first-timers). */
    returningTotal: number;
    returningByType: Record<SessionType, number>;
    /** Plans expiring in the window (memberships + packages). */
    expiringPlansTotal: number;
    expiringPlansByType: Record<SessionType, number>;
    /** Classes running in the window with < 50% booked. Only meaningful
     *  for the `class` variant strip. */
    underFilledClasses: number;
    /** Top 3 recovery services by booking count in the window. Drives
     *  the `recovery` variant strip's "Top services" tile. */
    topRecoveryServices: { name: string; count: number }[];
    /** Average capacity fill % per type across the window — the
     *  cross-type mini bars on the All-mode "Capacity used" tile. */
    capacityByType: Record<SessionType, number>;
}

/** Fill 0 for every type — a compact way to seed the per-type maps below. */
const emptyByType = (): Record<SessionType, number> => ({ class: 0, private: 0, recovery: 0 });

export function stripMetrics(input: {
    sessions:            ClassInstance[];
    classBookings:       ClassBooking[];
    appointmentBookings: AppointmentBooking[];
    customers:           Customer[];
    transactions:        CustomerTransaction[];
    customerPlans:       CustomerPlan[];
    appointments:        Appointment[];
    periods:             Period[];
    filter:              SessionType | "";
}): StripMetrics {
    const { sessions, classBookings, appointmentBookings, customers, customerPlans, appointments, periods, filter } = input;

    // Window bounds — inclusive on both ends.
    const dateSet = new Set(periods.flatMap(p => p.dateISOs));
    const fromISO = periods[0].startISO;
    const toISO = periods[periods.length - 1].endISO;

    // Session lookup: schedule/appointment id → session type. Bookings
    // reference classScheduleId — for appointments we cross-check
    // appointmentBookings via appointmentId → appointment.type. The
    // slot date also lives on the parent Appointment (AppointmentBooking
    // itself doesn't carry a date).
    const sessionTypeById = new Map<string, SessionType>();
    for (const s of sessions) sessionTypeById.set(s.id, s.type);
    const apptTypeById = new Map<string, SessionType>();
    const apptDateById = new Map<string, string>();
    for (const a of appointments) {
        apptTypeById.set(a.id, a.type);
        apptDateById.set(a.id, a.dateISO.slice(0, 10));
    }

    // ── Revenue: sum booked×price across in-window sessions of each type.
    const revenueByType = emptyByType();
    for (const s of sessions) {
        if (!dateSet.has(s.dateISO.slice(0, 10))) continue;
        if (!typeMatches(s.type, filter)) continue;
        revenueByType[s.type] += sessionRevenueAed(s);
    }
    const revenueTotalAed = revenueByType.class + revenueByType.private + revenueByType.recovery;

    // ── Bookings: count in-window bookings of the active type.
    const bookingsByType = emptyByType();
    for (const b of classBookings) {
        if (b.status === "cancelled") continue;
        const t = sessionTypeById.get(b.classScheduleId);
        if (!t) continue;
        const s = sessions.find(x => x.id === b.classScheduleId);
        if (!s || !dateSet.has(s.dateISO.slice(0, 10))) continue;
        if (!typeMatches(t, filter)) continue;
        bookingsByType[t] += 1;
    }
    for (const ab of appointmentBookings) {
        if (ab.status === "Cancelled") continue;
        const t = apptTypeById.get(ab.appointmentId);
        if (!t) continue;
        const iso = (apptDateById.get(ab.appointmentId) ?? "");
        if (!dateSet.has(iso)) continue;
        if (!typeMatches(t, filter)) continue;
        bookingsByType[t] += 1;
    }
    const bookingsTotal = bookingsByType.class + bookingsByType.private + bookingsByType.recovery;

    // ── New vs Returning: bucket by customer's FIRST-booking date. First
    //    booking = MIN over all class + appointment booking dates that
    //    customer holds. If the min falls in the window, they're new;
    //    otherwise they're returning (any of their in-window bookings
    //    count toward the returning tally). Both counts are per-type by
    //    the type of the customer's first in-window booking.
    const firstBookingDate = new Map<string, string>();
    const trackFirst = (customerId: string | undefined, iso: string) => {
        if (!customerId || !iso) return;
        const prev = firstBookingDate.get(customerId);
        if (!prev || iso < prev) firstBookingDate.set(customerId, iso);
    };
    for (const b of classBookings) {
        const s = sessions.find(x => x.id === b.classScheduleId);
        if (!s) continue;
        trackFirst(b.customerId, s.dateISO.slice(0, 10));
    }
    for (const ab of appointmentBookings) {
        trackFirst(ab.customerId, (apptDateById.get(ab.appointmentId) ?? ""));
    }

    const newCustomersByType = emptyByType();
    const returningByType    = emptyByType();
    // Dedupe per customer per type so a customer with 4 in-window classes
    // is only counted once toward Bookings' "new" or "returning" tallies.
    const seenNewByType       = new Set<string>();
    const seenReturningByType = new Set<string>();

    const bumpNewOrReturning = (customerId: string | undefined, type: SessionType, bookingISO: string) => {
        if (!customerId) return;
        const first = firstBookingDate.get(customerId);
        if (!first) return;
        const firstInWindow = first >= fromISO && first <= toISO;
        const bookingInWindow = bookingISO >= fromISO && bookingISO <= toISO;
        if (!bookingInWindow) return;
        // The "first-time" test: their EARLIEST booking is IN the window,
        // AND this booking is that earliest one (so we don't double-count
        // repeat visits from a truly new customer).
        if (firstInWindow && bookingISO === first) {
            const key = `${customerId}|${type}`;
            if (seenNewByType.has(key)) return;
            seenNewByType.add(key);
            newCustomersByType[type] += 1;
        } else {
            const key = `${customerId}|${type}`;
            if (seenReturningByType.has(key)) return;
            seenReturningByType.add(key);
            returningByType[type] += 1;
        }
    };
    for (const b of classBookings) {
        if (b.status === "cancelled") continue;
        const s = sessions.find(x => x.id === b.classScheduleId);
        if (!s) continue;
        if (!typeMatches(s.type, filter)) continue;
        bumpNewOrReturning(b.customerId, s.type, s.dateISO.slice(0, 10));
    }
    for (const ab of appointmentBookings) {
        if (ab.status === "Cancelled") continue;
        const t = apptTypeById.get(ab.appointmentId);
        if (!t) continue;
        if (!typeMatches(t, filter)) continue;
        bumpNewOrReturning(ab.customerId, t, (apptDateById.get(ab.appointmentId) ?? ""));
    }
    const newCustomersTotal = newCustomersByType.class + newCustomersByType.private + newCustomersByType.recovery;
    const returningTotal    = returningByType.class    + returningByType.private    + returningByType.recovery;

    // ── Expiring plans: memberships + packages expiring in-window.
    //    Splitting by type is a proxy — memberships tally under "class"
    //    (they mostly gate class credits), packages tally under whichever
    //    type they most closely map to. For the demo we group memberships
    //    as "class" and packages proportionally by product type when
    //    known; otherwise all packages count as "class" too.
    const expiringPlansByType = emptyByType();
    for (const p of customerPlans) {
        if (p.kind === "complimentary") continue;
        const expiryDay = (p.expiryISO ?? "").slice(0, 10);
        if (!expiryDay || expiryDay < fromISO || expiryDay > toISO) continue;
        // Simple mapping — every subscription-like plan under "class".
        expiringPlansByType.class += 1;
    }
    const expiringPlansTotal = expiringPlansByType.class + expiringPlansByType.private + expiringPlansByType.recovery;

    // ── Under-filled classes (< 50% booked). Class-only signal.
    let underFilledClasses = 0;
    for (const s of sessions) {
        if (s.type !== "class") continue;
        if (!dateSet.has(s.dateISO.slice(0, 10))) continue;
        const cap = s.capacity ?? 0;
        if (cap <= 0) continue;
        const pct = ((s.booked ?? 0) / cap) * 100;
        if (pct < 50) underFilledClasses += 1;
    }

    // ── Top 3 recovery services (by bookings count in-window).
    const recoveryCounts = new Map<string, number>();
    for (const ab of appointmentBookings) {
        if (ab.status === "Cancelled") continue;
        const iso = (apptDateById.get(ab.appointmentId) ?? "");
        if (!dateSet.has(iso)) continue;
        const t = apptTypeById.get(ab.appointmentId);
        if (t !== "recovery") continue;
        const appt = appointments.find(a => a.id === ab.appointmentId);
        const name = appt?.serviceName ?? "Recovery service";
        recoveryCounts.set(name, (recoveryCounts.get(name) ?? 0) + 1);
    }
    const topRecoveryServices = Array.from(recoveryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));

    // ── Average capacity % per type across the window — cross-type bars
    //    for the All-mode "Capacity used" tile. Computed once here so the
    //    strip and the heatmap read the same numbers.
    const capacityByType: Record<SessionType, number> = { class: 0, private: 0, recovery: 0 };
    for (const t of ["class", "private", "recovery"] as const) {
        const scoped = sessions.filter(s => s.type === t && dateSet.has(s.dateISO.slice(0, 10)));
        const cap = scoped.reduce((n, s) => n + (s.capacity ?? 0), 0);
        const book = scoped.reduce((n, s) => n + (s.booked ?? 0), 0);
        capacityByType[t] = cap > 0 ? Math.round((book / cap) * 100) : 0;
    }

    // Suppress lint on the intentionally-unused `customers` + `transactions`
    // inputs — Phase 1 doesn't need them but keeping them on the signature
    // preserves the option to switch new-customers to an "account created
    // in window" definition (Q4 alternative) without a signature change.
    void customers;

    return {
        revenueTotalAed,
        revenueByType,
        bookingsTotal,
        bookingsByType,
        newCustomersTotal,
        newCustomersByType,
        returningTotal,
        returningByType,
        expiringPlansTotal,
        expiringPlansByType,
        underFilledClasses,
        topRecoveryServices,
        capacityByType,
    };
}

// ── Formatters (shared by the tab components) ───────────────────────────────

/** "1.2K" / "24K" / "980". Used for chart axis + bar totals. */
export function shortNumber(n: number): string {
    if (n >= 1000) {
        const k = n / 1000;
        return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
    }
    return `${n}`;
}

/** "AED 24,750". Used for tile values + chart tooltips. */
export function aedFull(n: number): string {
    return `AED ${Math.round(n).toLocaleString("en-US")}`;
}
