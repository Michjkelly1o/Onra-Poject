// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Centralized "demo now" seed augmentation
// ─────────────────────────────────────────────────────────────────────────────
//
// Single source of truth for the rows we splice into each base seed so the
// Reports module (and every related module — schedule, customer profile,
// payments tab, etc.) demos with a rich current-month dataset.
//
// Rules followed:
//   1. Every row's foreign keys reference IDs that already exist in the
//      base seeds — same customer IDs, same branch IDs, same membership /
//      package IDs, same instructor / room / template / gift-card-design
//      IDs. There are NO gaps between the reports module and the source
//      modules.
//   2. Dates anchor to `NOW` at module-load time (the same trick
//      `payroll_entries.ts` uses) so the dataset stays current regardless
//      of when the prototype is opened.
//   3. Generators are DETERMINISTIC — no `Math.random`. Each row's
//      properties come from modular arithmetic over its index so a given
//      load always produces the same rows (avoids React hydration
//      surprises).
//   4. IDs use a `*_demo_*` prefix so they never clash with seeded rows.
//
// Consumer convention: each base seed `spread(...DEMO_NOW_<KIND>)` at the
// bottom of its existing array. The augmentation is non-destructive —
// existing historical seed rows continue to render.

import type {
    ClassSchedule,
    ClassBooking,
    ClassRating,
    CustomerTransaction,
    CustomerPlan,
    CustomerReferral,
    IssuedGiftCard,
} from "./_types";

// ─── Time anchor ────────────────────────────────────────────────────────────
//
// Anchored once at module load. `daysAgo(N)` walks back from NOW; `daysAhead`
// walks forward.

const NOW = new Date();
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isoDay(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
function isoStamp(d: Date): string {
    return d.toISOString();
}
function daysAgo(n: number): Date {
    return new Date(NOW.getTime() - n * MS_PER_DAY);
}
function daysAhead(n: number): Date {
    return new Date(NOW.getTime() + n * MS_PER_DAY);
}
function dayOfWeekShort(d: Date): string {
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
}

// ─── ID inventories (kept in sync with the base seeds) ──────────────────────

const SOUTH = "branch_forma_south";
const EAST  = "branch_forma_east";

const CUSTOMERS = [
    "cust_ahmed_zayn", "cust_ava_wright", "cust_bosa_ahmed", "cust_fatima_al_sayed",
    "cust_james_taylor", "cust_lucas_brown", "cust_mia_anderson", "cust_rosale_martin",
    "cust_sophia_lee", "cust_zahra_mahen",
] as const;

const MEMBERSHIPS = [
    "mem_beginner_monthly",
    "mem_advanced_monthly",
    "mem_unlimited_monthly",
    "mem_yoga_focused",
] as const;
const MEMBERSHIP_PRICE: Record<typeof MEMBERSHIPS[number], number> = {
    mem_beginner_monthly:  1200,
    mem_advanced_monthly:  1500,
    mem_unlimited_monthly: 2800,
    mem_yoga_focused:      1800,
};

const PACKAGES = [
    "pkg_5_class",
    "pkg_10_class",
    "pkg_20_class",
    "pkg_1_class_intro",
    "pkg_3_class_trial",
] as const;
const PACKAGE_PRICE: Record<typeof PACKAGES[number], number> = {
    pkg_5_class:        750,
    pkg_10_class:       1390,
    pkg_20_class:       2400,
    pkg_1_class_intro:  170,
    pkg_3_class_trial:  450,
};
const PACKAGE_CREDITS: Record<typeof PACKAGES[number], number> = {
    pkg_5_class:        5,
    pkg_10_class:       10,
    pkg_20_class:       20,
    pkg_1_class_intro:  1,
    pkg_3_class_trial:  3,
};

// Instructor + room IDs — must match the existing seeds.
const INSTRUCTORS_BY_BRANCH: Record<string, readonly string[]> = {
    [SOUTH]: ["staff_maya_johnson", "staff_phoenix_baker", "staff_sara_al_rashid", "staff_olivia_rhye", "staff_liam_chen"],
    [EAST]:  ["staff_demi_wilkinson", "staff_lana_steiner", "staff_lucy_hale", "staff_candice_wu", "staff_natali_craig"],
};
const ROOMS_BY_BRANCH: Record<string, readonly string[]> = {
    [SOUTH]: ["room_south_reformer", "room_south_mat", "room_south_barre"],
    [EAST]:  ["room_east_studio_a"],
};

const TEMPLATES = [
    { id: "tpl_reformer_pilates", name: "Reformer Pilates", category: "Pilates",
      coverColor: "#fee4e2", durationMin: 60 },
    { id: "tpl_barre",            name: "Barre",            category: "Barre",
      coverColor: "#fef0c7", durationMin: 60 },
    { id: "tpl_hot_yoga",         name: "Hot Yoga",         category: "Yoga",
      coverColor: "#d1fadf", durationMin: 75 },
] as const;

const GIFT_CARD_DESIGNS = [
    "gc_design_aed_250_dated",
    "gc_design_aed_250_no_expiry",
    "gc_design_aed_500_dated",
] as const;

// ─── Schedules ──────────────────────────────────────────────────────────────
//
// 32 classes — 21 days back through 10 days forward (so the demo always
// has completed + upcoming + cancelled mixed in). Slot windows: 09:00,
// 11:00, 17:00, 19:00 across the four branches' rooms.

const SLOT_TIMES: { start: string; end: string }[] = [
    { start: "09:00", end: "10:00" },
    { start: "11:00", end: "12:00" },
    { start: "17:00", end: "18:00" },
    { start: "19:00", end: "20:00" },
];

interface ScheduleSpec {
    daysFromNow: number;        // negative = past
    slotIdx: number;            // 0–3
    branchId: string;
    templateIdx: number;        // 0–2
    capacity: number;
    booked: number;
    status: "Completed" | "Upcoming" | "Cancelled";
}

const SCHEDULE_SPECS: ScheduleSpec[] = [
    // Last 3 weeks — Completed
    { daysFromNow: -21, slotIdx: 0, branchId: SOUTH, templateIdx: 0, capacity: 6,  booked: 6,  status: "Completed" },
    { daysFromNow: -20, slotIdx: 1, branchId: SOUTH, templateIdx: 2, capacity: 12, booked: 11, status: "Completed" },
    { daysFromNow: -19, slotIdx: 2, branchId: EAST,  templateIdx: 1, capacity: 10, booked: 9,  status: "Completed" },
    { daysFromNow: -18, slotIdx: 0, branchId: SOUTH, templateIdx: 1, capacity: 10, booked: 10, status: "Completed" },
    { daysFromNow: -17, slotIdx: 3, branchId: SOUTH, templateIdx: 0, capacity: 6,  booked: 5,  status: "Completed" },
    { daysFromNow: -16, slotIdx: 1, branchId: EAST,  templateIdx: 2, capacity: 12, booked: 10, status: "Completed" },
    { daysFromNow: -15, slotIdx: 2, branchId: SOUTH, templateIdx: 0, capacity: 6,  booked: 6,  status: "Completed" },
    { daysFromNow: -14, slotIdx: 0, branchId: SOUTH, templateIdx: 1, capacity: 10, booked: 8,  status: "Completed" },
    // Last 2 weeks
    { daysFromNow: -13, slotIdx: 3, branchId: EAST,  templateIdx: 0, capacity: 6,  booked: 6,  status: "Completed" },
    { daysFromNow: -12, slotIdx: 1, branchId: SOUTH, templateIdx: 2, capacity: 12, booked: 12, status: "Completed" },
    { daysFromNow: -11, slotIdx: 2, branchId: SOUTH, templateIdx: 0, capacity: 6,  booked: 5,  status: "Completed" },
    { daysFromNow: -10, slotIdx: 0, branchId: EAST,  templateIdx: 1, capacity: 10, booked: 8,  status: "Completed" },
    { daysFromNow: -9,  slotIdx: 3, branchId: SOUTH, templateIdx: 2, capacity: 12, booked: 11, status: "Completed" },
    { daysFromNow: -8,  slotIdx: 1, branchId: SOUTH, templateIdx: 1, capacity: 10, booked: 9,  status: "Completed" },
    // Last week
    { daysFromNow: -7,  slotIdx: 2, branchId: EAST,  templateIdx: 0, capacity: 6,  booked: 6,  status: "Completed" },
    { daysFromNow: -6,  slotIdx: 0, branchId: SOUTH, templateIdx: 2, capacity: 12, booked: 10, status: "Completed" },
    { daysFromNow: -5,  slotIdx: 3, branchId: SOUTH, templateIdx: 1, capacity: 10, booked: 9,  status: "Completed" },
    { daysFromNow: -4,  slotIdx: 1, branchId: EAST,  templateIdx: 2, capacity: 12, booked: 3,  status: "Cancelled" },
    { daysFromNow: -3,  slotIdx: 2, branchId: SOUTH, templateIdx: 0, capacity: 6,  booked: 4,  status: "Completed" },
    { daysFromNow: -2,  slotIdx: 0, branchId: SOUTH, templateIdx: 1, capacity: 10, booked: 9,  status: "Completed" },
    { daysFromNow: -1,  slotIdx: 3, branchId: EAST,  templateIdx: 2, capacity: 12, booked: 10, status: "Completed" },
    // Today + next 10 days — Upcoming
    { daysFromNow: 0,   slotIdx: 1, branchId: SOUTH, templateIdx: 0, capacity: 6,  booked: 5,  status: "Upcoming" },
    { daysFromNow: 1,   slotIdx: 2, branchId: SOUTH, templateIdx: 1, capacity: 10, booked: 8,  status: "Upcoming" },
    { daysFromNow: 2,   slotIdx: 0, branchId: EAST,  templateIdx: 0, capacity: 6,  booked: 4,  status: "Upcoming" },
    { daysFromNow: 3,   slotIdx: 3, branchId: SOUTH, templateIdx: 2, capacity: 12, booked: 7,  status: "Upcoming" },
    { daysFromNow: 4,   slotIdx: 1, branchId: SOUTH, templateIdx: 1, capacity: 10, booked: 6,  status: "Upcoming" },
    { daysFromNow: 5,   slotIdx: 2, branchId: EAST,  templateIdx: 2, capacity: 12, booked: 8,  status: "Upcoming" },
    { daysFromNow: 6,   slotIdx: 0, branchId: SOUTH, templateIdx: 0, capacity: 6,  booked: 5,  status: "Upcoming" },
    { daysFromNow: 7,   slotIdx: 3, branchId: SOUTH, templateIdx: 1, capacity: 10, booked: 7,  status: "Upcoming" },
    { daysFromNow: 8,   slotIdx: 1, branchId: EAST,  templateIdx: 0, capacity: 6,  booked: 3,  status: "Upcoming" },
    { daysFromNow: 9,   slotIdx: 2, branchId: SOUTH, templateIdx: 2, capacity: 12, booked: 8,  status: "Upcoming" },
    { daysFromNow: 10,  slotIdx: 0, branchId: SOUTH, templateIdx: 1, capacity: 10, booked: 5,  status: "Upcoming" },
];

export const DEMO_NOW_SCHEDULES: ClassSchedule[] = SCHEDULE_SPECS.map((s, idx) => {
    const date = s.daysFromNow >= 0 ? daysAhead(s.daysFromNow) : daysAgo(-s.daysFromNow);
    const dateIso = isoDay(date);
    const slot = SLOT_TIMES[s.slotIdx];
    const template = TEMPLATES[s.templateIdx];
    const instructors = INSTRUCTORS_BY_BRANCH[s.branchId];
    const rooms       = ROOMS_BY_BRANCH[s.branchId];
    const instructor  = instructors[idx % instructors.length];
    const room        = rooms[idx % rooms.length];

    return {
        id: `class_sched_demo_${String(idx + 1).padStart(3, "0")}`,
        template_id: template.id,
        branch_id: s.branchId,
        room_id: room,
        instructor_id: instructor,
        date_iso: dateIso,
        start_time: slot.start,
        end_time: slot.end,
        display_time: `${slot.start} – ${slot.end}`,
        capacity: s.capacity,
        booked: s.booked,
        rating: s.status === "Completed" ? 4 + (idx % 2) * 0.5 : 0,
        rating_count: s.status === "Completed" ? s.booked - 1 : 0,
        status: s.status,
        cancelled_at: s.status === "Cancelled" ? isoStamp(daysAgo(-s.daysFromNow - 1)) : undefined,
        cancelled_by: s.status === "Cancelled" ? "system" : undefined,
        gender_access: "all",
        class_type: "Group",
        waitlist_enabled: true,
    };
});

// ─── Bookings ───────────────────────────────────────────────────────────────
//
// Generated to satisfy each schedule's `booked` count. For completed
// schedules: attendance is mostly "present" with some "no_show" /
// "late_cancel" sprinkled in. For upcoming: status is "booked" with
// attendance pending. For cancelled schedules: bookings are marked
// "cancelled".

let bookingSeq = 0;
function nextBookingId(): string {
    bookingSeq++;
    return `bk_demo_${String(bookingSeq).padStart(4, "0")}`;
}

function pickCustomers(count: number, scheduleIdx: number): string[] {
    // Rotate through customers deterministically — start offset by
    // scheduleIdx so different classes pull different customers.
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
        out.push(CUSTOMERS[(scheduleIdx + i) % CUSTOMERS.length]);
    }
    return out;
}

// Deterministic source rotators — give each booking / transaction / freeze
// row a varied-but-stable origin so the Reports module "Source" columns
// don't read as a wall of identical strings. Distribution favours the
// most common real-world origin for each surface.

const BOOKING_SOURCE_DIST: ClassBooking["booking_source"][] = [
    "customer_portal", "customer_portal", "customer_portal", "customer_portal", "customer_portal",  // 50%
    "front_desk",      "front_desk",                                                                 // 20%
    "admin",           "admin",                                                                      // 20%
    "pos",                                                                                           // 10%
];
const CANCELLED_SOURCE_DIST: ClassBooking["cancelled_source"][] = [
    "customer_portal", "customer_portal", "customer_portal",  // 60% — most cancellations happen self-serve
    "front_desk",      "front_desk",                          // 25%
    "admin",           "system",                              // 15%
];
const PAYMENT_SOURCE_DIST: CustomerTransaction["payment_source"][] = [
    "pos", "pos", "pos", "pos",            // 50% in-studio
    "customer_portal", "customer_portal",  // 40% online
    "admin",                               // 10% manual entry
];
const FREEZE_SOURCE_DIST: CustomerPlan["freeze_source"][] = [
    "admin",           "admin",            // 40% — admin assistance during freeze flow
    "front_desk",      "front_desk",       // 40%
    "customer_portal",                     // 20%
];

export const DEMO_NOW_BOOKINGS: ClassBooking[] = [];

DEMO_NOW_SCHEDULES.forEach((sched, sIdx) => {
    const spec = SCHEDULE_SPECS[sIdx];
    const date = spec.daysFromNow >= 0 ? daysAhead(spec.daysFromNow) : daysAgo(-spec.daysFromNow);

    if (spec.status === "Cancelled") {
        // Tab-preservation cancel seed — every Cancelled class
        // populates ALL three detail-page tabs:
        //   • 3 originally-booked customers (status="booked",
        //     refund_credit_issued=true) → Booked tab with the class-
        //     level "Cancelled" badge per row
        //   • 1 originally-waitlisted customer (status="waitlisted",
        //     refund_credit_issued=true) → Waitlisted tab
        //   • 1 customer-self-cancelled BEFORE the class died
        //     (status="cancelled", reason="Customer cancelled") →
        //     Cancelled tab
        const bookedAt = isoStamp(daysAgo(Math.max(3, -spec.daysFromNow + 3)));
        // 3 booked customers (refund credit issued at class-cancel time).
        pickCustomers(3, sIdx).forEach((custId, i) => {
            DEMO_NOW_BOOKINGS.push({
                id: nextBookingId(),
                class_schedule_id: sched.id,
                customer_id: custId,
                branch_id: sched.branch_id,
                status: "booked",
                attendance_status: "pending",
                booked_at: bookedAt,
                refund_credit_issued: true,
                plan_kind_used: i % 2 === 0 ? "membership" : "package",
                booking_source: BOOKING_SOURCE_DIST[(sIdx + i) % BOOKING_SOURCE_DIST.length],
            });
        });
        // 1 waitlisted customer (also refunded).
        pickCustomers(1, sIdx + 50).forEach((custId, _i) => {
            DEMO_NOW_BOOKINGS.push({
                id: nextBookingId(),
                class_schedule_id: sched.id,
                customer_id: custId,
                branch_id: sched.branch_id,
                status: "waitlisted",
                attendance_status: "pending",
                booked_at: bookedAt,
                waitlist_position: 1,
                refund_credit_issued: true,
                plan_kind_used: "membership",
                booking_source: BOOKING_SOURCE_DIST[(sIdx + 1) % BOOKING_SOURCE_DIST.length],
            });
        });
        // 1 customer-self-cancelled BEFORE the class died.
        pickCustomers(1, sIdx + 100).forEach((custId, _i) => {
            DEMO_NOW_BOOKINGS.push({
                id: nextBookingId(),
                class_schedule_id: sched.id,
                customer_id: custId,
                branch_id: sched.branch_id,
                status: "cancelled",
                attendance_status: "pending",
                booked_at: bookedAt,
                cancelled_at: isoStamp(daysAgo(-spec.daysFromNow + 2)),
                cancellation_reason: "Customer cancelled — schedule conflict",
                refund_credit_issued: false,
                plan_kind_used: "package",
                booking_source: BOOKING_SOURCE_DIST[(sIdx + 2) % BOOKING_SOURCE_DIST.length],
                cancelled_source: "customer_portal",
            });
        });
        return;
    }

    const isPast = spec.status === "Completed";
    const customers = pickCustomers(spec.booked, sIdx);

    customers.forEach((custId, i) => {
        const bookedAt = isoStamp(new Date(date.getTime() - 3 * MS_PER_DAY));
        // Attendance mix for past classes: ~75% present, ~12% no_show,
        // ~13% late_cancel.
        let attendance: "pending" | "present" | "no_show" | "late_cancel" = "pending";
        let bookingStatus: "booked" | "waitlisted" | "cancelled" = "booked";
        let cancelledAt: string | undefined;
        let refundCreditIssued: boolean | undefined;

        if (isPast) {
            const mod = (sIdx * 7 + i) % 8;
            if (mod === 0) {
                attendance = "no_show";
            } else if (mod === 1) {
                // Late cancel: booking stays "booked" but attendance flags it.
                attendance = "late_cancel";
                cancelledAt = isoStamp(new Date(date.getTime() - 2 * 60 * 60 * 1000));
                refundCreditIssued = false;
                bookingStatus = "cancelled";
            } else {
                attendance = "present";
            }
        }

        // Stable rotators keyed off (scheduleIdx + customerIdx) so the
        // same booking row always produces the same source on reload.
        const sourceKey = sIdx * 13 + i * 7;
        const bookingSource = BOOKING_SOURCE_DIST[sourceKey % BOOKING_SOURCE_DIST.length];
        const cancelledSource = cancelledAt
            ? CANCELLED_SOURCE_DIST[sourceKey % CANCELLED_SOURCE_DIST.length]
            : undefined;

        DEMO_NOW_BOOKINGS.push({
            id: nextBookingId(),
            class_schedule_id: sched.id,
            customer_id: custId,
            branch_id: sched.branch_id,
            status: bookingStatus,
            attendance_status: attendance,
            booked_at: bookedAt,
            cancelled_at: cancelledAt,
            cancellation_reason: cancelledAt ? "Late cancel by customer" : undefined,
            refund_credit_issued: refundCreditIssued,
            plan_kind_used: (sIdx + i) % 2 === 0 ? "membership" : "package",
            booking_source: bookingSource,
            cancelled_source: cancelledSource,
        });
    });

    // Add 1 waitlisted booking per high-capacity completed class so the
    // Bookings-by-class-events Waitlisted column lights up.
    if (isPast && spec.capacity >= 10 && spec.booked >= spec.capacity - 2) {
        const waitCust = CUSTOMERS[(sIdx + 5) % CUSTOMERS.length];
        DEMO_NOW_BOOKINGS.push({
            id: nextBookingId(),
            class_schedule_id: sched.id,
            customer_id: waitCust,
            branch_id: sched.branch_id,
            status: "waitlisted",
            attendance_status: "pending",
            booked_at: isoStamp(new Date(date.getTime() - 2 * MS_PER_DAY)),
            waitlist_position: 1,
            plan_kind_used: "membership",
            booking_source: BOOKING_SOURCE_DIST[(sIdx + 5) % BOOKING_SOURCE_DIST.length],
        });
    }
});

// ─── Liam Chen rich-data block (instructor Earnings demo) ──────────────────
//
// 3 dedicated rows for `staff_liam_chen` so the instructor-side Earnings
// module + admin Payroll instructor detail demo with variety on every
// surface:
//   • 2 Completed Reformer classes → both surfaces show earnings totals,
//     attendance counts, ratings, and reviewer comments
//   • 1 Cancelled Reformer class   → shows AED 0 + cancelled badge +
//     refund-issued bookings tab
//
// Anchored relative to NOW (not a hardcoded ISO date) so the rows always
// fall inside the default "This week" period filter — which is what
// makes them visible the moment the user opens /instructor/earnings.
//
// IDs are namespaced `*_demo_liam_*` so they never collide with the static
// seed rows in class_schedule.ts / class_bookings.ts / class_ratings.ts.
//
// FK invariants (same as the rest of the demo block):
//   • customer_id     → existing CUSTOMERS row
//   • branch_id       → branch_forma_south (Liam's home branch)
//   • instructor_id   → staff_liam_chen
//   • template_id     → tpl_reformer_pilates (Liam's specialty)
//   • room_id         → room_south_mat (Liam's usual room)

interface LiamClassSpec {
    /** ID slug, e.g. "001" */
    n: string;
    /** Days back from NOW. NEGATIVE values mean future (-1 = tomorrow). */
    daysAgo: number;
    startTime: string;   // "HH:MM"
    endTime: string;
    displayTime: string;
    capacity: number;
    status: "Completed" | "Cancelled" | "Upcoming" | "Ongoing";
    /** Customers in the "booked" state for this class. Semantics by status:
     *   • Completed       → attendance="present" (rateable)
     *   • Upcoming/Ongoing → status="booked", attendance="pending"
     *   • Cancelled       → empty (everyone moved to cancelledCustomerIds) */
    bookedCustomerIds: string[];
    /** Customers marked "no_show" — Completed only. Still count toward
     *  the schedule's booked total (they had reserved a slot). */
    noShowCustomerIds: string[];
    /** Customers on the waitlist — Upcoming/Ongoing only. Positions are
     *  assigned in array order (#1, #2, ...). */
    waitlistedCustomerIds: string[];
    /** Cancelled customers. Semantics by status:
     *   • Cancelled class → all affected (class cancelled, refund issued)
     *   • Upcoming/Ongoing → individual customer cancellations
     *     (populates the Cancelled tab on the class detail page).
     *  For variety, the booking generator rotates early vs. late cancel
     *  flags off the index so the Cancelled tab shows mixed badge kinds. */
    cancelledCustomerIds: string[];
    /** Reviews — Completed only. Each customerId must be a "present"
     *  attendee (the generator asserts this implicitly). */
    reviews: { customerId: string; score: number; comment: string; tags: string[] }[];
}

const LIAM_SPECS: LiamClassSpec[] = [
    // ──────────────────────────────────────────────────────────────
    // PAST (Completed + Cancelled) — populate Earnings + class
    // detail Reviews/Cancelled tabs with rich review + cancellation
    // history.
    // ──────────────────────────────────────────────────────────────

    {
        // (1) Evening Reformer, 2 days ago — Completed
        n: "001",
        daysAgo: 2,
        startTime: "18:00", endTime: "18:45", displayTime: "06:00 - 06:45 PM",
        capacity: 8,
        status: "Completed",
        bookedCustomerIds: [
            "cust_ahmed_zayn", "cust_ava_wright", "cust_zahra_mahen",
            "cust_sophia_lee", "cust_fatima_al_sayed",
        ],
        noShowCustomerIds: ["cust_lucas_brown"],
        waitlistedCustomerIds: [],
        cancelledCustomerIds: [],
        reviews: [
            { customerId: "cust_ahmed_zayn", score: 5, comment: "Liam's cueing is on another level. Felt my form click during the long-stretch series — first time it's ever felt right. Genuinely the best Reformer class I've taken at Forma.", tags: ["Instructor", "Pacing"] },
            { customerId: "cust_ava_wright", score: 5, comment: "Loved the focus on core stability tonight. Liam gave me a precise spring tip during the footwork and it transformed the whole class for me.", tags: ["Instructor", "Difficulty"] },
            { customerId: "cust_zahra_mahen", score: 4, comment: "Great session — challenging in all the right ways. Pacing felt slightly rushed in the abdominal block but otherwise excellent.", tags: ["Pacing"] },
            { customerId: "cust_fatima_al_sayed", score: 5, comment: "Such a calm, controlled energy in the room. Liam corrects without disrupting flow — exactly the teaching style I respond to.", tags: ["Atmosphere", "Instructor"] },
        ],
    },
    {
        // (2) Morning Reformer, 1 day ago — Completed, near full
        n: "002",
        daysAgo: 1,
        startTime: "09:30", endTime: "10:30", displayTime: "09:30 - 10:30 AM",
        capacity: 8,
        status: "Completed",
        bookedCustomerIds: [
            "cust_ahmed_zayn", "cust_bosa_ahmed", "cust_sophia_lee",
            "cust_james_taylor", "cust_fatima_al_sayed",
            "cust_rosale_martin", "cust_zahra_mahen",
        ],
        noShowCustomerIds: [],
        waitlistedCustomerIds: [],
        cancelledCustomerIds: [],
        reviews: [
            { customerId: "cust_bosa_ahmed", score: 5, comment: "Packed studio this morning but Liam still managed to give every person at least one direct correction. That's a rare gift.", tags: ["Instructor"] },
            { customerId: "cust_james_taylor", score: 4, comment: "Strong full-body session — the side-lying series wrecked me in the best way. Slightly warm in the mat studio with 7 of us in, ventilation could be better.", tags: ["Difficulty", "Atmosphere"] },
            { customerId: "cust_rosale_martin", score: 4, comment: "Solid technical class — pacing was perfect for a Thursday morning. Would love a slightly longer cool-down sequence next time.", tags: ["Pacing"] },
        ],
    },
    {
        // (3) Evening Reformer, 1 day ago — Cancelled by Liam (illness)
        //     Tab-preservation seed: 4 originally-booked + 2 originally-
        //     waitlisted (all marked refund_credit_issued at class-
        //     cancel time) + 1 customer-self-cancelled BEFORE the class
        //     died. The Booked tab will render with the "Cancelled"
        //     class-level badge per row; Waitlisted shows the 2 who
        //     were on standby; Cancelled tab shows the early self-
        //     canceller.
        n: "003",
        daysAgo: 1,
        startTime: "17:00", endTime: "17:45", displayTime: "05:00 - 05:45 PM",
        capacity: 8,
        status: "Cancelled",
        bookedCustomerIds: [
            "cust_ava_wright", "cust_james_taylor",
            "cust_lucas_brown", "cust_fatima_al_sayed",
        ],
        noShowCustomerIds: [],
        waitlistedCustomerIds: [
            "cust_zahra_mahen", "cust_ahmed_zayn",
        ],
        cancelledCustomerIds: ["cust_sophia_lee"],
        reviews: [],
    },
    {
        // (4) Morning Reformer, TODAY morning — Completed (already wrapped)
        //     Full house: 7 present + 1 no-show, 5 reviewers.
        n: "004",
        daysAgo: 0,
        startTime: "09:00", endTime: "09:45", displayTime: "09:00 - 09:45 AM",
        capacity: 8,
        status: "Completed",
        bookedCustomerIds: [
            "cust_ava_wright", "cust_bosa_ahmed", "cust_sophia_lee",
            "cust_fatima_al_sayed", "cust_rosale_martin",
            "cust_zahra_mahen", "cust_ahmed_zayn",
        ],
        noShowCustomerIds: ["cust_mia_anderson"],
        waitlistedCustomerIds: [],
        cancelledCustomerIds: [],
        reviews: [
            { customerId: "cust_ava_wright", score: 5, comment: "Excellent start to the day — Liam's intentional pacing in the warmup makes everything that follows land harder. Five stars, every time.", tags: ["Instructor", "Pacing"] },
            { customerId: "cust_bosa_ahmed", score: 5, comment: "Full studio and Liam still circulated through every reformer with hands-on adjustments. Genuinely the most attentive instructor at this studio.", tags: ["Instructor"] },
            { customerId: "cust_sophia_lee", score: 4, comment: "Loved the focus on rotational core work today. Spring transitions were quick — could use one extra beat between sequences for setup.", tags: ["Difficulty"] },
            { customerId: "cust_fatima_al_sayed", score: 5, comment: "The mat studio acoustics at 9 AM are something else — quiet, focused, and Liam's voice carries clearly without a mic. Perfect environment.", tags: ["Atmosphere", "Instructor"] },
            { customerId: "cust_rosale_martin", score: 4, comment: "Strong session, finished the long-spine series feeling balanced. Music was great today.", tags: ["Music"] },
        ],
    },
    {
        // (5) Midday Reformer, TODAY — Ongoing (currently in progress)
        //     Demos the "class actively happening, mark present"
        //     workflow — instructor can hit Present + bulk Mark all
        //     present from here. Cancelled tab shows 1 early cancel.
        n: "005",
        daysAgo: 0,
        startTime: "13:00", endTime: "13:45", displayTime: "01:00 - 01:45 PM",
        capacity: 8,
        status: "Ongoing",
        bookedCustomerIds: [
            "cust_ahmed_zayn", "cust_zahra_mahen", "cust_james_taylor",
            "cust_lucas_brown", "cust_sophia_lee", "cust_fatima_al_sayed",
        ],
        noShowCustomerIds: [],
        waitlistedCustomerIds: ["cust_ava_wright"],
        cancelledCustomerIds: ["cust_rosale_martin"],
        reviews: [],
    },
    {
        // (6) Evening Reformer, TODAY — Upcoming
        //     Present button disabled (per brief). 1 cancelled early,
        //     2 waitlisted (class is full).
        n: "006",
        daysAgo: 0,
        startTime: "18:00", endTime: "18:45", displayTime: "06:00 - 06:45 PM",
        capacity: 6,
        status: "Upcoming",
        bookedCustomerIds: [
            "cust_ahmed_zayn", "cust_bosa_ahmed", "cust_james_taylor",
            "cust_fatima_al_sayed", "cust_zahra_mahen", "cust_rosale_martin",
        ],
        noShowCustomerIds: [],
        waitlistedCustomerIds: ["cust_ava_wright", "cust_sophia_lee"],
        cancelledCustomerIds: ["cust_lucas_brown"],
        reviews: [],
    },
    {
        // (7) Morning Reformer, 4 days ago — Completed
        n: "007",
        daysAgo: 4,
        startTime: "09:30", endTime: "10:30", displayTime: "09:30 - 10:30 AM",
        capacity: 8,
        status: "Completed",
        bookedCustomerIds: [
            "cust_sophia_lee", "cust_rosale_martin", "cust_ahmed_zayn",
            "cust_bosa_ahmed", "cust_james_taylor", "cust_ava_wright",
        ],
        noShowCustomerIds: ["cust_fatima_al_sayed"],
        waitlistedCustomerIds: [],
        cancelledCustomerIds: [],
        reviews: [
            { customerId: "cust_sophia_lee", score: 5, comment: "First class back after a break and Liam met me right where I was. Modifications for the bridge sequence were perfect.", tags: ["Instructor"] },
            { customerId: "cust_rosale_martin", score: 4, comment: "Solid Saturday session — straight into the deep core work, exactly what I needed.", tags: ["Difficulty"] },
            { customerId: "cust_ahmed_zayn", score: 5, comment: "Liam's spring choices today were spot on — felt every rep without overloading.", tags: ["Equipment"] },
            { customerId: "cust_bosa_ahmed", score: 4, comment: "Class was great, but the studio temp ran warm by the end. Otherwise excellent.", tags: ["Atmosphere"] },
        ],
    },
    {
        // (8) Afternoon Reformer, 5 days ago — Cancelled
        //     Tab-preservation seed: 3 originally-booked + 1
        //     originally-waitlisted + 1 customer-self-cancelled before
        //     the class died.
        n: "008",
        daysAgo: 5,
        startTime: "14:00", endTime: "14:45", displayTime: "02:00 - 02:45 PM",
        capacity: 6,
        status: "Cancelled",
        bookedCustomerIds: [
            "cust_zahra_mahen", "cust_mia_anderson", "cust_ahmed_zayn",
        ],
        noShowCustomerIds: [],
        waitlistedCustomerIds: ["cust_bosa_ahmed"],
        cancelledCustomerIds: ["cust_ava_wright"],
        reviews: [],
    },

    // ──────────────────────────────────────────────────────────────
    // FUTURE (Upcoming) — populate the schedule with classes Liam
    // hasn't taught yet. Mix of capacities + waitlists + early
    // customer cancellations so each detail page tab has data.
    // ──────────────────────────────────────────────────────────────

    {
        // (9) Tomorrow morning — Upcoming, mid-fill, 1 waitlisted
        n: "009",
        daysAgo: -1,
        startTime: "10:00", endTime: "10:45", displayTime: "10:00 - 10:45 AM",
        capacity: 8,
        status: "Upcoming",
        bookedCustomerIds: [
            "cust_ahmed_zayn", "cust_sophia_lee", "cust_rosale_martin",
            "cust_ava_wright", "cust_bosa_ahmed",
        ],
        noShowCustomerIds: [],
        waitlistedCustomerIds: ["cust_fatima_al_sayed"],
        cancelledCustomerIds: [],
        reviews: [],
    },
    {
        // (10) Day after tomorrow, late afternoon — Upcoming
        //      Almost full + 3 waitlisted + 2 customer cancellations.
        //      Best demo for the Waitlisted + Cancelled tabs at once.
        n: "010",
        daysAgo: -2,
        startTime: "17:00", endTime: "17:45", displayTime: "05:00 - 05:45 PM",
        capacity: 8,
        status: "Upcoming",
        bookedCustomerIds: [
            "cust_zahra_mahen", "cust_james_taylor", "cust_ahmed_zayn",
            "cust_bosa_ahmed", "cust_sophia_lee", "cust_lucas_brown",
            "cust_fatima_al_sayed",
        ],
        noShowCustomerIds: [],
        waitlistedCustomerIds: [
            "cust_ava_wright", "cust_rosale_martin", "cust_mia_anderson",
        ],
        cancelledCustomerIds: ["cust_ahmed_zayn", "cust_sophia_lee"],
        reviews: [],
    },
    {
        // (11) Weekend morning, 4 days from now — Upcoming, half full
        n: "011",
        daysAgo: -4,
        startTime: "09:30", endTime: "10:30", displayTime: "09:30 - 10:30 AM",
        capacity: 8,
        status: "Upcoming",
        bookedCustomerIds: [
            "cust_ava_wright", "cust_rosale_martin",
            "cust_fatima_al_sayed", "cust_bosa_ahmed",
        ],
        noShowCustomerIds: [],
        waitlistedCustomerIds: [],
        cancelledCustomerIds: ["cust_mia_anderson"],
        reviews: [],
    },
    {
        // (12) Next Monday evening — Upcoming, light booking
        n: "012",
        daysAgo: -7,
        startTime: "18:00", endTime: "18:45", displayTime: "06:00 - 06:45 PM",
        capacity: 8,
        status: "Upcoming",
        bookedCustomerIds: [
            "cust_ahmed_zayn", "cust_zahra_mahen", "cust_james_taylor",
        ],
        noShowCustomerIds: [],
        waitlistedCustomerIds: [],
        cancelledCustomerIds: [],
        reviews: [],
    },
    {
        // (13) Next Wednesday morning — Upcoming, busy + 1 waitlisted
        n: "013",
        daysAgo: -9,
        startTime: "09:00", endTime: "09:45", displayTime: "09:00 - 09:45 AM",
        capacity: 8,
        status: "Upcoming",
        bookedCustomerIds: [
            "cust_sophia_lee", "cust_bosa_ahmed", "cust_rosale_martin",
            "cust_lucas_brown", "cust_ava_wright", "cust_ahmed_zayn",
        ],
        noShowCustomerIds: [],
        waitlistedCustomerIds: ["cust_fatima_al_sayed"],
        cancelledCustomerIds: ["cust_zahra_mahen"],
        reviews: [],
    },
    {
        // (14) ~11 days out — Upcoming, sparse (just getting filled)
        n: "014",
        daysAgo: -11,
        startTime: "11:00", endTime: "11:45", displayTime: "11:00 - 11:45 AM",
        capacity: 8,
        status: "Upcoming",
        bookedCustomerIds: [
            "cust_ava_wright", "cust_ahmed_zayn",
        ],
        noShowCustomerIds: [],
        waitlistedCustomerIds: [],
        cancelledCustomerIds: [],
        reviews: [],
    },
];

/** Compute the avg score for a Completed class — used to set
 *  `class_schedule.rating` so the rating column on the earnings list
 *  matches the count of `class_ratings` rows backing it. */
function avgScore(reviews: LiamClassSpec["reviews"]): number {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + r.score, 0);
    return Math.round((sum / reviews.length) * 100) / 100;
}

/** `class_schedule.booked` denormalized count — derived from the spec's
 *  per-state arrays so a single edit to the spec automatically updates
 *  every dependent denormalized field. Semantics by status:
 *   • Completed       → booked + no-show count (everyone who reserved)
 *   • Upcoming/Ongoing → currently-booked count
 *   • Cancelled       → preserves the originally-booked count (tab-
 *                       preservation model: bookings keep their
 *                       status, so the schedule row's `booked` total
 *                       still reflects who was on the list when the
 *                       class died) */
function liamBookedCount(spec: LiamClassSpec): number {
    if (spec.status === "Completed") {
        return spec.bookedCustomerIds.length + spec.noShowCustomerIds.length;
    }
    return spec.bookedCustomerIds.length;
}

export const DEMO_NOW_LIAM_SCHEDULES: ClassSchedule[] = LIAM_SPECS.map(spec => {
    const date = daysAgo(spec.daysAgo);
    return {
        id: `class_sched_demo_liam_${spec.n}`,
        template_id: "tpl_reformer_pilates",
        branch_id: SOUTH,
        room_id: "room_south_mat",
        instructor_id: "staff_liam_chen",
        date_iso: isoDay(date),
        start_time: spec.startTime,
        end_time: spec.endTime,
        display_time: spec.displayTime,
        capacity: spec.capacity,
        booked: liamBookedCount(spec),
        rating: avgScore(spec.reviews),
        rating_count: spec.reviews.length,
        status: spec.status,
        cancelled_at: spec.status === "Cancelled" ? isoStamp(daysAgo(spec.daysAgo + 1)) : undefined,
        cancelled_by: spec.status === "Cancelled" ? "Liam Chen" : undefined,
        gender_access: "all",
        class_type: "Group",
        waitlist_enabled: true,
    };
});

/** Booking rows backing Liam's rich classes — generated off the spec's
 *  per-state arrays. The booking generator emits one row per customer
 *  with the right status/attendance combo per class status, populating
 *  the Booked / Waitlisted / Cancelled tabs on every class detail page. */
export const DEMO_NOW_LIAM_BOOKINGS: ClassBooking[] = LIAM_SPECS.flatMap(spec => {
    const sched = DEMO_NOW_LIAM_SCHEDULES.find(s => s.id === `class_sched_demo_liam_${spec.n}`)!;
    // Always a safely-past timestamp — even for future classes, the
    // booking itself was made in the past.
    const bookedAt = isoStamp(daysAgo(Math.max(3, spec.daysAgo + 3)));
    const rows: ClassBooking[] = [];

    const classLevelCancelled = spec.status === "Cancelled";

    // ── status="cancelled" rows ───────────────────────────────────────
    //
    // For ALL class statuses, these are customer-SELF-cancellations
    // (the customer cancelled their booking BEFORE anything else
    // happened). Stagger early vs late so the badge kind helper shows
    // a mix of "Cancelled" vs "Cancelled (late)" treatments.
    //
    // NOTE — class-level cancellation does NOT flip bookings to
    // status="cancelled" anymore (tab-preservation model). On a
    // Cancelled class, the originally-booked customers stay status=
    // "booked" so they render on the Booked tab; the row's status
    // badge flips to a class-level "Cancelled" pill via kind="class".
    spec.cancelledCustomerIds.forEach((custId, i) => {
        const cancelledDate = i % 2 === 0
            ? daysAgo(spec.daysAgo + 4)
            : new Date(daysAgo(spec.daysAgo).getTime() - 2 * 60 * 60 * 1000);
        rows.push({
            id: `bk_demo_liam_${spec.n}_c${String(i + 1).padStart(2, "0")}`,
            class_schedule_id: sched.id,
            customer_id: custId,
            branch_id: SOUTH,
            status: "cancelled",
            attendance_status: "pending",
            booked_at: bookedAt,
            cancelled_at: isoStamp(cancelledDate),
            cancellation_reason: i % 2 === 0
                ? "Customer cancelled — schedule conflict"
                : "Customer cancelled — late cancellation",
            refund_credit_issued: false,
            plan_kind_used: i % 2 === 0 ? "membership" : "package",
            plan_id_used:   i % 2 === 0 ? "mem_unlimited_monthly" : "pkg_10_class",
            booking_source: BOOKING_SOURCE_DIST[i % BOOKING_SOURCE_DIST.length],
            cancelled_source: "customer_portal",
        });
    });

    // ── status="booked" rows ──────────────────────────────────────────
    //
    // attendance_status splits by class status:
    //   • Completed                → "present"  (rateable; reviews must match)
    //   • Upcoming / Ongoing /
    //     Cancelled (class-level)  → "pending"  (no attendance to record)
    //
    // For class-level Cancelled, `refund_credit_issued=true` flags that
    // the studio owed these customers a refund — same field admin sets
    // via the cancel-class confirmation modal.
    // Attendance audit stamps — for Completed classes we synthesize an
    // `attendance_marked_at` ~10 min after class-end and attribute it to
    // Liam, so the team-activity feed surfaces recent instructor
    // attendance actions out of the box. The 10-minute offset mirrors
    // typical real-world behaviour (mark-up at desk after class wraps).
    const classEndMs = daysAgo(spec.daysAgo).getTime() + 60 * 60 * 1000; // ~1hr from class start
    const attendanceMarkedAt = spec.status === "Completed"
        ? isoStamp(new Date(classEndMs + 10 * 60 * 1000))
        : undefined;
    const attendanceMarkedBy = spec.status === "Completed" ? "Liam Chen" : undefined;

    spec.bookedCustomerIds.forEach((custId, i) => {
        rows.push({
            id: `bk_demo_liam_${spec.n}_b${String(i + 1).padStart(2, "0")}`,
            class_schedule_id: sched.id,
            customer_id: custId,
            branch_id: SOUTH,
            status: "booked",
            attendance_status: spec.status === "Completed" ? "present" : "pending",
            booked_at: bookedAt,
            refund_credit_issued: classLevelCancelled ? true : undefined,
            plan_kind_used: i % 2 === 0 ? "membership" : "package",
            plan_id_used:   i % 2 === 0 ? "mem_unlimited_monthly" : "pkg_10_class",
            booking_source: BOOKING_SOURCE_DIST[i % BOOKING_SOURCE_DIST.length],
            attendance_marked_at: attendanceMarkedAt,
            attendance_marked_by: attendanceMarkedBy,
        });
    });

    // ── status="booked" + attendance="no_show" — Completed only ──────
    spec.noShowCustomerIds.forEach((custId, i) => {
        rows.push({
            id: `bk_demo_liam_${spec.n}_n${String(i + 1).padStart(2, "0")}`,
            class_schedule_id: sched.id,
            customer_id: custId,
            branch_id: SOUTH,
            status: "booked",
            attendance_status: "no_show",
            booked_at: bookedAt,
            plan_kind_used: "package",
            plan_id_used:   "pkg_10_class",
            booking_source: BOOKING_SOURCE_DIST[(i + 3) % BOOKING_SOURCE_DIST.length],
            attendance_marked_at: attendanceMarkedAt,
            attendance_marked_by: attendanceMarkedBy,
        });
    });

    // ── status="waitlisted" — Upcoming / Ongoing / Cancelled ─────────
    //
    // Includes class-level Cancelled so the Waitlisted tab on a
    // cancelled class isn't empty. `refund_credit_issued=true` is set
    // for class-level cancellation since the studio commits to
    // refunding waitlisters too once the class died.
    spec.waitlistedCustomerIds.forEach((custId, i) => {
        rows.push({
            id: `bk_demo_liam_${spec.n}_w${String(i + 1).padStart(2, "0")}`,
            class_schedule_id: sched.id,
            customer_id: custId,
            branch_id: SOUTH,
            status: "waitlisted",
            attendance_status: "pending",
            booked_at: bookedAt,
            waitlist_position: i + 1,
            refund_credit_issued: classLevelCancelled ? true : undefined,
            plan_kind_used: i % 2 === 0 ? "membership" : "package",
            plan_id_used:   i % 2 === 0 ? "mem_unlimited_monthly" : "pkg_10_class",
            booking_source: BOOKING_SOURCE_DIST[(i + 5) % BOOKING_SOURCE_DIST.length],
        });
    });

    return rows;
});

/** Rating rows backing Liam's rich Completed classes. Only customers
 *  with attendance="present" can rate — verified by the spec design. */
export const DEMO_NOW_LIAM_RATINGS: ClassRating[] = LIAM_SPECS.flatMap(spec => {
    const sched = DEMO_NOW_LIAM_SCHEDULES.find(s => s.id === `class_sched_demo_liam_${spec.n}`)!;
    return spec.reviews.map((r, i): ClassRating => ({
        id: `rt_demo_liam_${spec.n}_${String(i + 1).padStart(2, "0")}`,
        class_schedule_id: sched.id,
        customer_id: r.customerId,
        instructor_id: "staff_liam_chen",
        score: r.score,
        // Stamp the rating shortly after the class ended.
        submitted_at: isoStamp(new Date(daysAgo(spec.daysAgo).getTime() + 90 * 60 * 1000)),
        comment: r.comment,
        tags: r.tags,
    }));
});

// ─── Transactions ──────────────────────────────────────────────────────────
//
// 24 sales spread across the past 30 days — 14 memberships + 10 packages —
// with a 5% tax breakdown so the Total sales report's tax + net-without-tax
// columns light up. Two transactions are refunded; one is pending.

interface TxnSpec {
    daysAgo: number;
    customerIdx: number;
    branchId: string;
    kind: "membership" | "package";
    productKey: typeof MEMBERSHIPS[number] | typeof PACKAGES[number];
    status: "complete" | "pending" | "failed" | "refunded";
    paymentMethod: "card" | "cash";
}

const TXN_SPECS: TxnSpec[] = [
    { daysAgo: 28, customerIdx: 0, branchId: SOUTH, kind: "membership", productKey: "mem_unlimited_monthly", status: "complete", paymentMethod: "card" },
    { daysAgo: 26, customerIdx: 1, branchId: SOUTH, kind: "membership", productKey: "mem_advanced_monthly",  status: "complete", paymentMethod: "card" },
    { daysAgo: 24, customerIdx: 2, branchId: EAST,  kind: "package",    productKey: "pkg_10_class",          status: "complete", paymentMethod: "cash" },
    { daysAgo: 22, customerIdx: 3, branchId: SOUTH, kind: "membership", productKey: "mem_beginner_monthly",  status: "complete", paymentMethod: "card" },
    { daysAgo: 21, customerIdx: 4, branchId: EAST,  kind: "package",    productKey: "pkg_5_class",           status: "complete", paymentMethod: "card" },
    { daysAgo: 19, customerIdx: 5, branchId: SOUTH, kind: "package",    productKey: "pkg_1_class_intro",     status: "complete", paymentMethod: "card" },
    { daysAgo: 17, customerIdx: 6, branchId: SOUTH, kind: "membership", productKey: "mem_yoga_focused",      status: "complete", paymentMethod: "card" },
    { daysAgo: 15, customerIdx: 7, branchId: EAST,  kind: "package",    productKey: "pkg_20_class",          status: "complete", paymentMethod: "card" },
    { daysAgo: 14, customerIdx: 8, branchId: SOUTH, kind: "membership", productKey: "mem_advanced_monthly",  status: "refunded", paymentMethod: "card" },
    { daysAgo: 13, customerIdx: 9, branchId: SOUTH, kind: "package",    productKey: "pkg_5_class",           status: "complete", paymentMethod: "cash" },
    { daysAgo: 12, customerIdx: 0, branchId: SOUTH, kind: "package",    productKey: "pkg_3_class_trial",     status: "complete", paymentMethod: "card" },
    { daysAgo: 11, customerIdx: 1, branchId: EAST,  kind: "membership", productKey: "mem_unlimited_monthly", status: "complete", paymentMethod: "card" },
    { daysAgo: 10, customerIdx: 2, branchId: SOUTH, kind: "package",    productKey: "pkg_10_class",          status: "complete", paymentMethod: "card" },
    { daysAgo: 9,  customerIdx: 3, branchId: SOUTH, kind: "membership", productKey: "mem_advanced_monthly",  status: "complete", paymentMethod: "card" },
    { daysAgo: 8,  customerIdx: 4, branchId: EAST,  kind: "package",    productKey: "pkg_5_class",           status: "complete", paymentMethod: "cash" },
    { daysAgo: 7,  customerIdx: 5, branchId: SOUTH, kind: "membership", productKey: "mem_beginner_monthly",  status: "complete", paymentMethod: "card" },
    { daysAgo: 6,  customerIdx: 6, branchId: SOUTH, kind: "package",    productKey: "pkg_10_class",          status: "complete", paymentMethod: "card" },
    { daysAgo: 5,  customerIdx: 7, branchId: EAST,  kind: "membership", productKey: "mem_yoga_focused",      status: "complete", paymentMethod: "card" },
    { daysAgo: 4,  customerIdx: 8, branchId: SOUTH, kind: "package",    productKey: "pkg_5_class",           status: "refunded", paymentMethod: "card" },
    { daysAgo: 3,  customerIdx: 9, branchId: SOUTH, kind: "membership", productKey: "mem_advanced_monthly",  status: "complete", paymentMethod: "card" },
    { daysAgo: 2,  customerIdx: 0, branchId: SOUTH, kind: "package",    productKey: "pkg_20_class",          status: "complete", paymentMethod: "card" },
    { daysAgo: 1,  customerIdx: 1, branchId: EAST,  kind: "package",    productKey: "pkg_10_class",          status: "complete", paymentMethod: "card" },
    { daysAgo: 0,  customerIdx: 2, branchId: SOUTH, kind: "membership", productKey: "mem_unlimited_monthly", status: "pending",  paymentMethod: "card" },
    { daysAgo: 0,  customerIdx: 3, branchId: SOUTH, kind: "package",    productKey: "pkg_1_class_intro",     status: "complete", paymentMethod: "card" },
];

export const DEMO_NOW_TRANSACTIONS: CustomerTransaction[] = TXN_SPECS.map((t, idx) => {
    const customerId = CUSTOMERS[t.customerIdx];
    const grossAed = t.kind === "membership"
        ? MEMBERSHIP_PRICE[t.productKey as typeof MEMBERSHIPS[number]]
        : PACKAGE_PRICE[t.productKey as typeof PACKAGES[number]];
    // 5% inclusive tax — matches the default `Tax module` rule for
    // membership / credit_package categories.
    const taxRate = 5;
    const subtotal = +(grossAed / (1 + taxRate / 100)).toFixed(2);
    const taxAed   = +(grossAed - subtotal).toFixed(2);
    const productName = t.kind === "membership"
        ? humanizeMembership(t.productKey as typeof MEMBERSHIPS[number])
        : humanizePackage(t.productKey as typeof PACKAGES[number]);
    const createdAt = isoStamp(daysAgo(t.daysAgo));

    return {
        id: `txn_demo_${String(idx + 1).padStart(3, "0")}`,
        customer_id: customerId,
        branch_id: t.branchId,
        kind: t.kind,
        product_id: t.productKey,
        name: productName,
        amount_aed: grossAed,
        subtotal_aed: subtotal,
        tax_aed: taxAed,
        tax_rate_percentage: taxRate,
        tax_inclusive: true,
        status: t.status,
        payment_method: t.paymentMethod,
        // Deterministic source rotation — varies the Payments report's
        // "Payment source" column without faking data at render time.
        payment_source: PAYMENT_SOURCE_DIST[idx % PAYMENT_SOURCE_DIST.length],
        created_at: createdAt,
        refunded_at: t.status === "refunded" ? isoStamp(daysAgo(Math.max(0, t.daysAgo - 1))) : undefined,
        refund_method: t.status === "refunded" ? t.paymentMethod : undefined,
    };
});

function humanizeMembership(id: typeof MEMBERSHIPS[number]): string {
    return id === "mem_beginner_monthly"  ? "Beginner Monthly Membership"
         : id === "mem_advanced_monthly"  ? "Advanced Monthly Membership"
         : id === "mem_unlimited_monthly" ? "Unlimited Monthly Membership"
         :                                  "Yoga Focused Monthly";
}
function humanizePackage(id: typeof PACKAGES[number]): string {
    return id === "pkg_5_class"        ? "5-Class Package for One Month"
         : id === "pkg_10_class"       ? "10-Class Package for One Month"
         : id === "pkg_20_class"       ? "20-Class Package for Two Months"
         : id === "pkg_1_class_intro"  ? "1-Class Intro Package for 7 Days"
         :                               "3-Class Trial Package";
}

// ─── Customer plans (current memberships / packages / freezes) ──────────────
//
// One active plan per customer + four overlapping freeze rows so the
// Frozen package reports populate richly.

interface PlanSpec {
    customerIdx: number;
    kind: "membership" | "package";
    productKey: typeof MEMBERSHIPS[number] | typeof PACKAGES[number];
    purchasedDaysAgo: number;
    expiryDaysAhead: number;
    status: "active" | "frozen" | "cancelled" | "expired";
    /** Freeze offset days — populated when status="frozen". */
    freezeStartDaysAgo?: number;
    freezeEndDaysAhead?: number;
}

// Plan-exclusivity invariant (client Jul 2026): each customer holds
// EITHER one active membership OR one+ active credit packages — never
// both, and never two memberships. Every hand-authored customer in
// `customer_plans.ts` already ships with a valid current plan (`cp_*`
// rows) so this seed no longer piles ACTIVE / FROZEN rows on top of
// them — that pile was the entire source of the "membership + package
// on the same customer" bug the client spotted.
//
// What stays here now: only the CANCELLED and EXPIRED history rows.
// Historical statuses don't count as "held" for exclusivity, they
// only feed report columns (Subscription end date, "Cancelled" /
// "Expired" pills on the Memberships tab, etc). The frozen-package
// report demo is covered by hand-authored `cp_bosa_2` (frozen
// package on Bosa) so removing the frozen entries here doesn't blank
// the Frozen package report.
const PLAN_SPECS: PlanSpec[] = [
    // ── End-of-life subscriptions / packages — feeds Subscription end +
    //    expired columns + the Memberships "Cancelled" / "Expired" pills.
    //    Each row triggers a different combination of dates so the
    //    columns render with meaningful values instead of em-dashes.
    //    NONE of these count as "held" (status !== "active"/"frozen") so
    //    they don't violate the one-membership-OR-packages invariant.
    { customerIdx: 2, kind: "membership", productKey: "mem_advanced_monthly",  purchasedDaysAgo: 40, expiryDaysAhead: -2,  status: "cancelled" },
    { customerIdx: 4, kind: "membership", productKey: "mem_beginner_monthly",  purchasedDaysAgo: 28, expiryDaysAhead: 1,   status: "cancelled" },
    { customerIdx: 6, kind: "membership", productKey: "mem_yoga_focused",      purchasedDaysAgo: 22, expiryDaysAhead: 4,   status: "cancelled" },
    { customerIdx: 8, kind: "membership", productKey: "mem_advanced_monthly",  purchasedDaysAgo: 60, expiryDaysAhead: -28, status: "expired" },
    { customerIdx: 3, kind: "package",    productKey: "pkg_1_class_intro",     purchasedDaysAgo: 33, expiryDaysAhead: -26, status: "expired" },
    { customerIdx: 5, kind: "package",    productKey: "pkg_3_class_trial",     purchasedDaysAgo: 28, expiryDaysAhead: -7,  status: "expired" },
];

export const DEMO_NOW_PLANS: CustomerPlan[] = PLAN_SPECS.map((p, idx) => {
    const customerId = CUSTOMERS[p.customerIdx];
    const productName = p.kind === "membership"
        ? humanizeMembership(p.productKey as typeof MEMBERSHIPS[number])
        : humanizePackage(p.productKey as typeof PACKAGES[number]);
    const creditsLabel = p.kind === "membership"
        ? (p.productKey === "mem_unlimited_monthly" ? "Unlimited" : "Monthly billing")
        : `${PACKAGE_CREDITS[p.productKey as typeof PACKAGES[number]]} credits`;
    const priceAed = p.kind === "membership"
        ? MEMBERSHIP_PRICE[p.productKey as typeof MEMBERSHIPS[number]]
        : undefined;

    const purchasedAt = isoStamp(daysAgo(p.purchasedDaysAgo));
    const expiryISO   = p.expiryDaysAhead >= 0
        ? isoStamp(daysAhead(p.expiryDaysAhead))
        : isoStamp(daysAgo(-p.expiryDaysAhead));

    return {
        id: `plan_demo_${String(idx + 1).padStart(3, "0")}`,
        customer_id: customerId,
        kind: p.kind,
        product_id: p.productKey,
        name: productName,
        plan_type_label: p.kind === "membership" ? "Membership" : "Credit package",
        credits_label: creditsLabel,
        status: p.status,
        purchased_at: purchasedAt,
        expiry_iso: expiryISO,
        price_aed: priceAed,
        freeze_start_iso: p.freezeStartDaysAgo !== undefined
            ? isoStamp(daysAgo(p.freezeStartDaysAgo))
            : undefined,
        freeze_end_iso: p.freezeEndDaysAhead !== undefined
            ? (p.freezeEndDaysAhead >= 0 ? isoStamp(daysAhead(p.freezeEndDaysAhead)) : isoStamp(daysAgo(-p.freezeEndDaysAhead)))
            : undefined,
        // Rotate freeze source so the Frozen reports' "Freeze source"
        // column shows a healthy mix (admin / front desk / customer
        // portal) instead of a single repeated value.
        freeze_source: p.freezeStartDaysAgo !== undefined
            ? FREEZE_SOURCE_DIST[idx % FREEZE_SOURCE_DIST.length]
            : undefined,
        // Cancellation timestamp anchored to the period before expiry —
        // matches the customer-detail "Cancelled on" line and feeds the
        // Subscription end date column on the Subscriptions report.
        cancelled_at: p.status === "cancelled"
            ? isoStamp(daysAgo(Math.max(1, Math.abs(p.expiryDaysAhead) + 7)))
            : undefined,
        cancel_mode: p.status === "cancelled" ? "period_end" : undefined,
        cancel_reason: p.status === "cancelled" ? "Customer requested cancellation" : undefined,
    };
});

// ─── Referrals (current month) ─────────────────────────────────────────────
//
// 6 referrals — 3 Active (rewarded), 2 Pending (in window), 1 Expired.

interface RefSpec {
    referrerIdx: number;
    referredName: string;
    referredEmail: string;
    daysAgo: number;
    benefitCredits: number;
}
const REF_SPECS: RefSpec[] = [
    { referrerIdx: 0, referredName: "Olivia Bennett",  referredEmail: "olivia.b@example.com",  daysAgo: 5,  benefitCredits: 2 },
    { referrerIdx: 1, referredName: "Liam Carter",     referredEmail: "liam.c@example.com",    daysAgo: 8,  benefitCredits: 2 },
    { referrerIdx: 2, referredName: "Noah Patel",      referredEmail: "noah.p@example.com",    daysAgo: 12, benefitCredits: 1 },
    { referrerIdx: 3, referredName: "Emma Foster",     referredEmail: "emma.f@example.com",    daysAgo: 18, benefitCredits: 0 },
    { referrerIdx: 4, referredName: "Ethan Roberts",   referredEmail: "ethan.r@example.com",   daysAgo: 22, benefitCredits: 0 },
    { referrerIdx: 5, referredName: "Hannah Mitchell", referredEmail: "hannah.m@example.com",  daysAgo: 45, benefitCredits: 0 },
];

export const DEMO_NOW_REFERRALS: CustomerReferral[] = REF_SPECS.map((r, idx) => ({
    id: `ref_demo_${String(idx + 1).padStart(3, "0")}`,
    referrer_customer_id: CUSTOMERS[r.referrerIdx],
    referred_name: r.referredName,
    referred_email: r.referredEmail,
    benefit_credits: r.benefitCredits,
    referred_at: isoStamp(daysAgo(r.daysAgo)),
    // Expiry = referred_at + 90 days (the seeded
    // referral_settings.earned_reward_expiry_days). Demo rows aren't
    // expired by default — picks an offset that lands a few weeks in
    // the future so the Customer Referrals tab Expiry column shows
    // realistic upcoming dates instead of a wash of "expired".
    expires_at:  isoStamp(daysAhead(90 - r.daysAgo)),
    // v25 — Referrer branch captured at referral-creation. All demo
    // referrers sit on Forma South so the branch-gate helper
    // restricts every seeded credit to South when the admin flips
    // "Credits redeemable across all branches" off.
    origin_branch_id: "branch_forma_south",
}));

// ─── Gift cards (current-month purchases) ──────────────────────────────────

interface GcSpec {
    customerIdx: number;
    designIdx: number;
    faceValue: number;
    balance: number;          // < faceValue once redeemed
    daysAgo: number;
    expiresInDays: number;
    status: "active" | "redeemed" | "expired";
    senderName?: string;
    recipientName?: string;
    recipientEmail?: string;
}
const GC_SPECS: GcSpec[] = [
    { customerIdx: 0, designIdx: 0, faceValue: 250, balance: 250, daysAgo: 3,  expiresInDays: 180, status: "active",
      senderName: "Ahmed Z.",      recipientName: "Layla A.",  recipientEmail: "layla.a@example.com" },
    { customerIdx: 1, designIdx: 0, faceValue: 250, balance: 100, daysAgo: 10, expiresInDays: 165, status: "active",
      senderName: "Ava W.",        recipientName: "Sam P.",    recipientEmail: "sam.p@example.com" },
    { customerIdx: 2, designIdx: 2, faceValue: 500, balance: 500, daysAgo: 14, expiresInDays: 180, status: "active",
      senderName: "Bosa A.",       recipientName: "Ella R.",   recipientEmail: "ella.r@example.com" },
    { customerIdx: 3, designIdx: 1, faceValue: 250, balance: 0,   daysAgo: 21, expiresInDays: 9999,status: "redeemed",
      senderName: "Fatima S.",     recipientName: "Yusuf K.",  recipientEmail: "yusuf.k@example.com" },
    { customerIdx: 5, designIdx: 2, faceValue: 500, balance: 300, daysAgo: 25, expiresInDays: 155, status: "active",
      senderName: "Lucas B.",      recipientName: "Tariq H.",  recipientEmail: "tariq.h@example.com" },
];

export const DEMO_NOW_GIFT_CARDS: IssuedGiftCard[] = GC_SPECS.map((g, idx) => ({
    id: `issued_gc_demo_${String(idx + 1).padStart(3, "0")}`,
    design_id: GIFT_CARD_DESIGNS[g.designIdx],
    customer_id: CUSTOMERS[g.customerIdx],
    code: `DEMO${String(1000 + idx)}`,
    face_value_aed: g.faceValue,
    current_balance_aed: g.balance,
    issued_at: isoStamp(daysAgo(g.daysAgo)),
    expires_at: isoStamp(daysAhead(g.expiresInDays)),
    status: g.status,
    sender_name: g.senderName,
    recipient_name: g.recipientName,
    recipient_email: g.recipientEmail,
}));
