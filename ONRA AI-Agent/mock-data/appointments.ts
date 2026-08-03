// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `appointments` + `appointment_bookings` seeds (Module 13 — Phase 4)
// ─────────────────────────────────────────────────────────────────────────────
//
// Every demo service ships with appointments covering ALL 5 status states
// so the Service detail Appointments tab + the Appointment detail page +
// the schedule grid all have something to render on first load:
//
//   • Completed              — finished a few days ago
//   • Cancelled              — past, with a cancel reason
//   • Ongoing                — happening right now
//   • Upcoming over 24hrs    — tomorrow or later
//   • Upcoming under 24hrs   — later today / very early tomorrow
//
// Status is STORED (not derived) so an admin can flip an appointment to
// Cancelled without time-travel. The Phase 4 store mutators bump the
// stored status alongside the cancelled_* fields.
//
// PRIVATE vs OPEN SESSION shape:
//   • Private services      → 1 customer per appointment (1 booking each)
//   • Open session services → 2–3 customers per appointment, capacity from
//                             the service row
//
// Dates anchor to NOW via `daysAgo()` / `daysAhead()` so the demo always
// has fresh state — when a tester opens the prototype tomorrow, "Ongoing"
// still means right-now and "Upcoming under 24hrs" still falls inside the
// next 24h window.
//
// FKs:
//   service_id     → services.id
//   branch_id      → branches.id
//   room_id        → rooms.id
//   instructor_id  → staff_profiles.id (Private only)
//   appointment_id → appointments.id
//   customer_id    → customers.id

import type { Appointment, AppointmentBooking, AppointmentRating } from "./_types";

// ─── Time helpers (NOW-anchored) ─────────────────────────────────────────────

const NOW = new Date();
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isoDay(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
function isoStamp(d: Date): string { return d.toISOString(); }
function daysAgo(n: number): Date { return new Date(NOW.getTime() - n * MS_PER_DAY); }
function daysAhead(n: number): Date { return new Date(NOW.getTime() + n * MS_PER_DAY); }
function hoursAhead(n: number): Date { return new Date(NOW.getTime() + n * 60 * 60 * 1000); }
function hoursAgo(n: number): Date { return new Date(NOW.getTime() - n * 60 * 60 * 1000); }

/** "9:00 - 10:00 AM" style display string. */
function fmtDisplay(start: string, end: string): string {
    const fmt = (t: string): string => {
        const [h, m] = t.split(":").map(Number);
        const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const period = h < 12 ? "AM" : "PM";
        return `${hh}:${String(m ?? 0).padStart(2, "0")} ${period}`;
    };
    // Drop the AM/PM suffix on the start when both halves share it for
    // brevity ("9:00 - 10:00 AM") — otherwise show both ("11:00 AM - 12:00 PM").
    const [sh] = start.split(":").map(Number);
    const [eh] = end.split(":").map(Number);
    const sameMeridiem = sh < 12 === eh < 12;
    if (sameMeridiem) {
        const startTrim = fmt(start).replace(/\s(AM|PM)$/, "");
        return `${startTrim} - ${fmt(end)}`;
    }
    return `${fmt(start)} - ${fmt(end)}`;
}

/** Compute end_time given start + duration. */
function addMinutes(time: string, mins: number): string {
    const [h, m] = time.split(":").map(Number);
    const total  = h * 60 + (m ?? 0) + mins;
    const hh     = Math.floor(total / 60) % 24;
    const mm     = total % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Build the start time string that lines up "Ongoing right now" — picks
 *  the nearest 30-min slot before NOW and returns its HH:MM. */
function ongoingStartTime(durationMin: number): string {
    // Half an hour into the duration so NOW falls inside the window.
    const ms = NOW.getTime() - Math.floor((durationMin / 3) * 60 * 1000);
    const d = new Date(ms);
    const h = d.getHours();
    const m = d.getMinutes() < 30 ? 0 : 30;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Service specs (matches src/data/mock/services.ts) ───────────────────────

interface ServiceSpec {
    id: string;
    durationMin: number;
    capacity: number;
    open: boolean;
    branch: string;
    instructorPool: readonly string[];  // ignored for Open session services
    /** Empty for Spa-branch services (recovery sessions aren't room-scoped).
     *  `roomFor` returns "" in that case and Appointment.room_id is optional
     *  in the type — the detail panel's Room subline gates on `roomName` so
     *  empty rooms never render. */
    roomPool: readonly string[];
}

const SOUTH = "branch_forma_south";
const EAST  = "branch_forma_east";
// Spa branch hosts every is_recovery=true service per the Module 13
// update — keeps the appointment-side branch FK in sync with services.ts
// so the schedule grid + appointment detail location both resolve to
// "Forma Spa" for Massage / Sauna / Breathwork / IV therapy.
const SPA   = "branch_forma_spa";

const SOUTH_INSTRUCTORS = ["staff_maya_johnson", "staff_phoenix_baker", "staff_sara_al_rashid"] as const;
const EAST_INSTRUCTORS  = ["staff_demi_wilkinson", "staff_lana_steiner"] as const;

const SOUTH_ROOMS = ["room_south_reformer", "room_south_mat", "room_south_barre"] as const;
const EAST_ROOMS  = ["room_east_studio_a"] as const;
// Spa branch ships with NO rooms — recovery services aren't room-scoped.
// Pool stays empty; `roomFor` returns "" and Appointment.room_id is
// optional in the type, so the renderers cope gracefully.
const SPA_ROOMS: readonly string[] = [];
// Recovery services aren't instructor-led either (no Spa staff seeded).
// Private recovery (Massage / IV) still get a placeholder pool — recall
// `instructor_id` is only written when `open=false`, but recovery
// open=true overrides that and skips it entirely.
const SPA_INSTRUCTORS: readonly string[] = [];

// Services routed to the Spa branch — kept in sync with services.ts so
// the schedule grid + detail-page Location both resolve to "Forma Spa".
// Massage / IV therapy are private recovery (no instructor either in this
// prototype — Spa has no instructor pool). Sauna / Breathwork are open.
const SERVICES: ServiceSpec[] = [
    { id: "svc_private_reformer",    durationMin: 60, capacity: 1,  open: false, branch: SOUTH, instructorPool: SOUTH_INSTRUCTORS, roomPool: SOUTH_ROOMS },
    { id: "svc_private_mat_pilates", durationMin: 45, capacity: 1,  open: false, branch: SOUTH, instructorPool: SOUTH_INSTRUCTORS, roomPool: SOUTH_ROOMS },
    { id: "svc_massage",             durationMin: 60, capacity: 1,  open: false, branch: SPA,   instructorPool: SPA_INSTRUCTORS,   roomPool: SPA_ROOMS   },
    { id: "svc_sauna",               durationMin: 30, capacity: 6,  open: true,  branch: SPA,   instructorPool: SPA_INSTRUCTORS,   roomPool: SPA_ROOMS   },
    { id: "svc_breathwork",          durationMin: 45, capacity: 10, open: true,  branch: SPA,   instructorPool: SPA_INSTRUCTORS,   roomPool: SPA_ROOMS   },
    { id: "svc_iv_therapy",          durationMin: 30, capacity: 1,  open: false, branch: SPA,   instructorPool: SPA_INSTRUCTORS,   roomPool: SPA_ROOMS   },
];

// ─── Customer pool (matches src/data/mock/customers.ts) ──────────────────────

const CUSTOMERS = [
    "cust_ahmed_zayn", "cust_ava_wright", "cust_bosa_ahmed", "cust_fatima_al_sayed",
    "cust_james_taylor", "cust_lucas_brown", "cust_mia_anderson", "cust_rosale_martin",
    "cust_sophia_lee", "cust_zahra_mahen",
] as const;

// ─── Status specs ────────────────────────────────────────────────────────────

type StatusSpec = "completed" | "cancelled" | "ongoing" | "upcoming_far" | "upcoming_soon";
const STATUS_SPECS: StatusSpec[] = ["completed", "cancelled", "ongoing", "upcoming_far", "upcoming_soon"];

/** Per-status anchor — returns the start date/time for an appointment of
 *  the given service in the given status state. */
function anchorForStatus(spec: StatusSpec, service: ServiceSpec): { date: Date; startTime: string } {
    switch (spec) {
        case "completed": {
            // 4 days ago at 09:00 — well in the past, so "Completed".
            const date = daysAgo(4);
            return { date, startTime: "09:00" };
        }
        case "cancelled": {
            // 3 days ago at 11:00 — past + flagged as cancelled.
            const date = daysAgo(3);
            return { date, startTime: "11:00" };
        }
        case "ongoing": {
            // Right now — start ~ duration/3 ago so NOW lands inside the window.
            const date = NOW;
            return { date, startTime: ongoingStartTime(service.durationMin) };
        }
        case "upcoming_soon": {
            // Same-day later or tomorrow morning — within 24h.
            const inFour = hoursAhead(4);
            const date = inFour;
            const h = inFour.getHours();
            const startTime = `${String(h).padStart(2, "0")}:00`;
            return { date, startTime };
        }
        case "upcoming_far": {
            // 3 days from now at 14:00 — > 24h ahead.
            const date = daysAhead(3);
            return { date, startTime: "14:00" };
        }
    }
}

// ─── Customer rotation (avoid dupes per service) ─────────────────────────────

function customersForOpenSession(service: ServiceSpec, statusSpec: StatusSpec, count: number): string[] {
    // Stable per-(service,status) rotation so multiple loads yield the
    // same seed — but spread the customer roster across services so the
    // demo feels populated.
    const seed =
        (Array.from(service.id).reduce((a, c) => a + c.charCodeAt(0), 0) +
         Array.from(statusSpec).reduce((a, c) => a + c.charCodeAt(0), 0)) % CUSTOMERS.length;
    return Array.from({ length: count }, (_, i) => CUSTOMERS[(seed + i) % CUSTOMERS.length]);
}

function customerForPrivate(service: ServiceSpec, statusSpec: StatusSpec): string {
    const seed =
        (Array.from(service.id).reduce((a, c) => a + c.charCodeAt(0), 0) +
         Array.from(statusSpec).reduce((a, c) => a + c.charCodeAt(0), 0)) % CUSTOMERS.length;
    return CUSTOMERS[seed];
}

function instructorFor(service: ServiceSpec, statusSpec: StatusSpec): string {
    const pool = service.instructorPool;
    // Empty pool (Spa branch services have no instructor pool seeded) —
    // return empty string and let the caller decide whether to include the
    // field on the row (instructor_id is optional on Appointment).
    if (pool.length === 0) return "";
    const seed = Array.from(statusSpec).reduce((a, c) => a + c.charCodeAt(0), 0) % pool.length;
    return pool[seed];
}
function roomFor(service: ServiceSpec, statusSpec: StatusSpec): string {
    const pool = service.roomPool;
    if (pool.length === 0) return "";
    const seed = Array.from(statusSpec).reduce((a, c) => a + c.charCodeAt(0), 0) % pool.length;
    return pool[seed];
}

// ─── Build seed ──────────────────────────────────────────────────────────────

const appointmentRows: Appointment[] = [];
const bookingRows: AppointmentBooking[] = [];
const ratingRows: AppointmentRating[] = [];

/** Sample comments / tags for rating seed — rotated per appointment so the
 *  Ratings tab shows variety even though every Completed appointment seeds
 *  the same shape. */
const SAMPLE_COMMENTS = [
    "Loved the energy in the room — instructor really pushed me.",
    "Pacing felt right, great mix of difficulty.",
    "Atmosphere was calming. Would book again.",
    "Solid session — recovered well after.",
    "Instructor walked me through every move clearly.",
] as const;
const SAMPLE_TAGS: AppointmentRating["tags"][] = [
    ["Instructor", "Pacing"],
    ["Atmosphere"],
    ["Difficulty", "Instructor"],
    ["Pacing"],
    ["Instructor"],
];

for (const service of SERVICES) {
    for (const statusSpec of STATUS_SPECS) {
        const { date, startTime } = anchorForStatus(statusSpec, service);
        const endTime  = addMinutes(startTime, service.durationMin);
        const dateISO  = isoDay(date);
        const apptId   = `appt_${dateISO}_${startTime.replace(":", "")}_${service.id}`;

        // ── Customer roster for this appointment ────────────────────────────
        const customerIds: string[] = service.open
            ? customersForOpenSession(service, statusSpec, Math.min(3, service.capacity))
            : [customerForPrivate(service, statusSpec)];

        // ── Booking statuses derived from appointment status ────────────────
        const bookingStatus: AppointmentBooking["status"] = (() => {
            switch (statusSpec) {
                case "completed":   return "Attended";  // most attended; first row flipped to NoShow below
                case "cancelled":   return "Cancelled";
                case "ongoing":     return "Booked";
                case "upcoming_far":
                case "upcoming_soon": return "Booked";
            }
        })();

        // ── Appointment status (stored, mirrors ClassSchedule) ──────────────
        const apptStatus: Appointment["status"] = (() => {
            switch (statusSpec) {
                case "completed":     return "Completed";
                case "cancelled":     return "Cancelled";
                case "ongoing":       return "Ongoing";
                case "upcoming_far":
                case "upcoming_soon": return "Upcoming";
            }
        })();

        // ── Booked count = customers whose booking is still active ─────────
        const bookedCount = bookingStatus === "Cancelled" ? 0 : customerIds.length;

        // ── Ratings — only Completed appointments seed ratings ─────────────
        // Most Attended customers leave a 4–5 star rating; one Attended
        // customer leaves a 3-star for variety so the avg is realistic.
        let ratingForAppt = 0;
        let ratingCountForAppt = 0;
        if (statusSpec === "completed") {
            const attendedCustomers = customerIds.filter((_id, idx) =>
                !(service.open && idx === 0) // skip the No-show row on Open session Completed
            );
            const ratingsForRow: number[] = attendedCustomers.map((_id, idx) => {
                if (idx === 0) return 3;            // first attended → 3
                if (idx === 1) return 5;            // second attended → 5
                return 4;                            // rest → 4
            });
            ratingsForRow.forEach((score, idx) => {
                const customerId = attendedCustomers[idx];
                const submittedAt = isoStamp(daysAgo(3));
                const ratingInstructor = service.open ? "" : instructorFor(service, statusSpec);
                ratingRows.push({
                    id: `appt_rating_${apptId}_${customerId}`,
                    appointment_id: apptId,
                    customer_id: customerId,
                    ...(ratingInstructor ? { instructor_id: ratingInstructor } : {}),
                    score,
                    comment: SAMPLE_COMMENTS[idx % SAMPLE_COMMENTS.length],
                    tags: SAMPLE_TAGS[idx % SAMPLE_TAGS.length],
                    submitted_at: submittedAt,
                });
            });
            ratingCountForAppt = ratingsForRow.length;
            ratingForAppt = ratingCountForAppt > 0
                ? ratingsForRow.reduce((a, b) => a + b, 0) / ratingCountForAppt
                : 0;
        }

        // Resolve room + instructor first so we can drop the keys entirely
        // when their respective pools are empty (Spa branch — no rooms, no
        // instructor staff). The Appointment type makes both fields
        // optional so omitting them keeps the seed shape lean.
        const resolvedRoom = roomFor(service, statusSpec);
        const resolvedInstructor = service.open ? "" : instructorFor(service, statusSpec);
        appointmentRows.push({
            id: apptId,
            service_id: service.id,
            branch_id: service.branch,
            ...(resolvedRoom ? { room_id: resolvedRoom } : {}),
            ...(resolvedInstructor ? { instructor_id: resolvedInstructor } : {}),
            date_iso: dateISO,
            start_time: startTime,
            end_time: endTime,
            display_time: fmtDisplay(startTime, endTime),
            capacity: service.capacity,
            booked: bookedCount,
            status: apptStatus,
            ...(statusSpec === "cancelled" ? {
                cancelled_reason: "Instructor unavailable",
                cancelled_at: isoStamp(hoursAgo(48)),
                cancelled_by: "Alex Owen",
            } : {}),
            ...(ratingCountForAppt > 0
                ? { rating: ratingForAppt, rating_count: ratingCountForAppt }
                : {}),
            created_at: isoStamp(daysAgo(7)),
        });

        // ── Bookings — one per customer ─────────────────────────────────────
        customerIds.forEach((customerId, idx) => {
            // For Completed Open session appointments make the first row a
            // NoShow so the demo has at least one of each attendance state.
            const status: AppointmentBooking["status"] =
                statusSpec === "completed" && idx === 0 && service.open
                    ? "NoShow"
                    : bookingStatus;

            const bookedAt =
                statusSpec === "completed" || statusSpec === "cancelled"
                    ? isoStamp(daysAgo(5))
                    : isoStamp(daysAgo(2));

            bookingRows.push({
                id: `appt_book_${apptId}_${customerId}`,
                appointment_id: apptId,
                customer_id: customerId,
                status,
                booked_at: bookedAt,
                ...(status === "Cancelled" ? {
                    cancelled_at: isoStamp(daysAgo(1)),
                    cancelled_by: "admin",
                } : {}),
                ...(status === "Attended" || status === "NoShow"
                    ? { attendance_marked_at: isoStamp(daysAgo(3)) }
                    : {}),
            });
        });
    }
}

export const appointments: Appointment[] = appointmentRows;
export const appointment_bookings: AppointmentBooking[] = bookingRows;
export const appointment_ratings: AppointmentRating[] = ratingRows;
