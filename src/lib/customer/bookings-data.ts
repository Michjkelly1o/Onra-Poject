"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Bookings data layer (list + detail + reviews)
// ─────────────────────────────────────────────────────────────────────────────
//
// Self-scoped view-models over the live store, anchored to the real today
// (REAL_TODAY_ISO — the admin uses the live clock too). Classifies each booking into
// the Upcoming / Past tabs and a customer-facing status (booked · waitlisted ·
// attended · cancelled-no-charge · cancelled-late · no-show), and carries the
// per-status presentation (badge + status-card copy + cover treatment).

import { useMemo, type ComponentType, type SVGProps } from "react";
import { CheckCircle, Hourglass03, RefreshCcw01, SlashCircle01, XCircle } from "@untitledui/icons";
import { useAppStore, type ClassBooking, type ClassSchedule, liveScheduleStatus } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { useClassDetail, type ClassDetailVM } from "@/lib/customer/search-data";
import { useAppointmentBookings } from "@/lib/customer/appointment-bookings";
import { formatShortDate, formatTime12 } from "@/lib/customer/format";
import { REAL_TODAY_ISO } from "@/lib/customer/dates";
import { branchTzLabel } from "@/lib/branch-time";
import type { BookingStatus } from "@/components/customer/bookings/BookingCard";

export type BookingViewStatus = "booked" | "waitlisted" | "attended" | "cancelled_free" | "cancelled_late" | "no_show";
export type BookingTab = "upcoming" | "past";

const GREEN = "#17b26a";
const GRAY = "#475467";
const RED = "#d92d20";

export interface StatusPresentation {
    /** For the list <BookingCard>. */
    card: BookingStatus;
    /** Desaturate the cover (cancelled / no-show). */
    mutedCover: boolean;
    /** Hero pill over the cover. */
    heroLabel: string;
    heroClass: string;
    heroIcon: ComponentType<SVGProps<SVGSVGElement>>;
    /** Booking Status card (detail). */
    cardTitle: string;
    cardSub: string;
    cardBg: string;
    cardIcon: ComponentType<SVGProps<SVGSVGElement>>;
    cardIconColor: string;
}

const GREEN_PILL = "border-[#abefc6] bg-[#ecfdf3] text-[#067647]";
const RED_PILL = "border-[#fecdca] bg-[#fef3f2] text-[#b42318]";
const GRAY_PILL = "border-[var(--colors-border-secondary)] bg-white/90 text-[var(--colors-text-secondary)]";
// Status card tints — Figma 3696-33904 uses the brand secondary palette for the
// confirmed (green) card; red/gray follow the error/neutral families.
const GREEN_CARD = "border-[var(--brand-tertiary)] bg-[var(--colors-secondary-50)]";
const RED_CARD = "border-[#fecdca] bg-[#fef3f2]";
const GRAY_CARD = "border-[var(--colors-border-tertiary)] bg-[var(--colors-bg-secondary)]";
/** Concentric-ring decoration colour per card tint. */
export const STATUS_RING: Record<BookingViewStatus, string> = {
    booked: "var(--brand-tertiary)",
    attended: "var(--brand-tertiary)",
    waitlisted: "#e4e7ec",
    cancelled_free: "#fecdca",
    cancelled_late: "#fecdca",
    no_show: "#fecdca",
};

export const BOOKING_STATUS: Record<BookingViewStatus, StatusPresentation> = {
    booked: {
        card: { label: "Booked", tone: "success", icon: CheckCircle, color: GREEN },
        mutedCover: false,
        heroLabel: "Booked", heroClass: GREEN_PILL, heroIcon: CheckCircle,
        cardTitle: "Class booked", cardSub: "Your spot in this class is confirmed.",
        cardBg: GREEN_CARD, cardIcon: CheckCircle, cardIconColor: GREEN,
    },
    waitlisted: {
        card: { label: "Waitlist", tone: "warning", icon: Hourglass03, color: GRAY },
        mutedCover: false,
        heroLabel: "Waitlist", heroClass: GRAY_PILL, heroIcon: Hourglass03,
        cardTitle: "Joined waitlist", cardSub: "You'll be notified if a spot becomes available.",
        cardBg: GRAY_CARD, cardIcon: Hourglass03, cardIconColor: GRAY,
    },
    attended: {
        card: { label: "Attended", tone: "success", icon: CheckCircle, color: GREEN },
        mutedCover: false,
        heroLabel: "Attended", heroClass: GREEN_PILL, heroIcon: CheckCircle,
        cardTitle: "Class attended", cardSub: "Your attendance has been recorded.",
        cardBg: GREEN_CARD, cardIcon: CheckCircle, cardIconColor: GREEN,
    },
    cancelled_free: {
        card: { label: "Cancelled (no charge)", tone: "error", icon: RefreshCcw01, color: RED },
        mutedCover: true,
        heroLabel: "Cancelled", heroClass: RED_PILL, heroIcon: RefreshCcw01,
        cardTitle: "Cancelled (no charge)", cardSub: "Your booking was cancelled and no charge was applied.",
        cardBg: RED_CARD, cardIcon: RefreshCcw01, cardIconColor: RED,
    },
    cancelled_late: {
        card: { label: "Cancelled (late)", tone: "error", icon: SlashCircle01, color: RED },
        mutedCover: true,
        heroLabel: "Cancelled", heroClass: RED_PILL, heroIcon: SlashCircle01,
        cardTitle: "Cancelled (late)", cardSub: "Your booking was cancelled late and a charge was applied.",
        cardBg: RED_CARD, cardIcon: SlashCircle01, cardIconColor: RED,
    },
    no_show: {
        card: { label: "No show", tone: "error", icon: XCircle, color: RED },
        mutedCover: true,
        heroLabel: "No show", heroClass: RED_PILL, heroIcon: XCircle,
        cardTitle: "No show", cardSub: "You didn't attend the class and a charge was applied.",
        cardBg: RED_CARD, cardIcon: XCircle, cardIconColor: RED,
    },
};

/** Derive the customer-facing status + tab from the booking + its schedule. */
export function classifyBooking(b: ClassBooking, s: ClassSchedule): { viewStatus: BookingViewStatus; tab: BookingTab } {
    if (b.status === "cancelled") {
        return { viewStatus: b.attendanceStatus === "late_cancel" ? "cancelled_late" : "cancelled_free", tab: "past" };
    }
    if (b.attendanceStatus === "no_show") return { viewStatus: "no_show", tab: "past" };
    if (b.attendanceStatus === "present") return { viewStatus: "attended", tab: "past" };
    // Upcoming = the class has not finished yet, derived from the DEVICE clock
    // (never the row's baked seed status, which goes stale as the demo runs past
    // its dates). `liveScheduleStatus` is the same helper the admin schedule and
    // customer-detail Bookings tab read through, so the two sides always agree.
    // A class in progress stays Upcoming so it can't jump to Past mid-session.
    const live = liveScheduleStatus(s.dateISO, s.startTime, s.endTime, s.status);
    const future = live === "Upcoming" || live === "Ongoing";
    // A waitlist entry the member never got promoted from (class is over) =
    // they couldn't join → shown as Cancelled (no charge), no credit taken.
    if (b.status === "waitlisted") {
        return future ? { viewStatus: "waitlisted", tab: "upcoming" } : { viewStatus: "cancelled_free", tab: "past" };
    }
    if (future) return { viewStatus: "booked", tab: "upcoming" };
    if (s.status === "Cancelled") return { viewStatus: "cancelled_free", tab: "past" };
    return { viewStatus: "attended", tab: "past" };
}

export interface BookingListItemVM {
    bookingId: string;
    scheduleId: string;
    name: string;
    /** Set when this seat was booked for a guest (not the member). */
    guestName?: string;
    /** Raw class date (ISO `YYYY-MM-DD`) — drives the filter's date range. */
    dateISO: string;
    dateShort: string;
    time: string;
    location: string;
    viewStatus: BookingViewStatus;
    coverImage?: string;
    coverColor?: string;
    sortKey: string;
    // Filter dimensions (Bookings filter modal).
    category: string;
    classType: "Group" | "Private";
    instructorId: string;
    instructorName: string;
    instructorImageUrl?: string;
    instructorInitials: string;
}

export function useMemberBookings(): { upcoming: BookingListItemVM[]; past: BookingListItemVM[] } {
    const member = useCurrentCustomer();
    const bookings = useAppStore((s) => s.classBookings);
    const schedules = useAppStore((s) => s.classSchedules);
    const instructors = useAppStore((s) => s.instructors);

    return useMemo(() => {
        if (!member) return { upcoming: [], past: [] };
        const byId = new Map(schedules.map((s) => [s.id, s]));
        const insImg = new Map(instructors.map((i) => [i.id, i.imageUrl]));
        const upcoming: BookingListItemVM[] = [];
        const past: BookingListItemVM[] = [];
        for (const b of bookings) {
            if (b.customerId !== member.id) continue;
            const sched = byId.get(b.classScheduleId);
            if (!sched) continue;
            const { viewStatus, tab } = classifyBooking(b, sched);
            const vm: BookingListItemVM = {
                bookingId: b.id,
                scheduleId: sched.id,
                name: sched.name,
                guestName: b.guestName,
                dateISO: sched.dateISO,
                dateShort: formatShortDate(sched.dateISO),
                time: formatTime12(sched.startTime),
                location: `${sched.room} - ${sched.location}`,
                viewStatus,
                coverImage: sched.coverImage,
                coverColor: sched.coverColor,
                sortKey: `${sched.dateISO}T${sched.startTime}`,
                category: sched.category,
                classType: sched.classType,
                instructorId: sched.instructorId,
                instructorName: sched.instructorName,
                instructorImageUrl: insImg.get(sched.instructorId),
                instructorInitials: sched.instructorInitials,
            };
            (tab === "upcoming" ? upcoming : past).push(vm);
        }
        upcoming.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
        past.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
        return { upcoming, past };
    }, [member, bookings, schedules, instructors]);
}

export interface BookingFilters {
    /** Booking kind — Classes (group class bookings) · Private / Recovery
     *  (appointment bookings by session type). Single-select. */
    type: "Classes" | "Private" | "Recovery" | null;
    instructorIds: string[];
    categories: string[];
    /** Inclusive date range (ISO `YYYY-MM-DD`), either bound optional. Filters the
     *  active tab (upcoming or past) by the booking's class / slot date. */
    dateFrom: string | null;
    dateTo: string | null;
}

export const EMPTY_BOOKING_FILTERS: BookingFilters = { type: null, instructorIds: [], categories: [], dateFrom: null, dateTo: null };

/** Module cache so the Bookings tab + filter survive list → detail → back AND
 *  the "See all" instructor screen (mirrors `searchUi`): tab, applied filters,
 *  the in-progress draft, and whether the filter modal was open. */
export const bookingsUi: { tab: BookingTab; applied: BookingFilters; draft: BookingFilters; filterOpen: boolean } = {
    tab: "upcoming",
    applied: EMPTY_BOOKING_FILTERS,
    draft: EMPTY_BOOKING_FILTERS,
    filterOpen: false,
};

export function bookingFilterCount(f: BookingFilters): number {
    return (f.type ? 1 : 0) + f.instructorIds.length + f.categories.length + (f.dateFrom || f.dateTo ? 1 : 0);
}

export function applyBookingFilters(list: BookingListItemVM[], f: BookingFilters): BookingListItemVM[] {
    // Class bookings ARE the "Classes" kind — selecting an appointment type
    // (Private / Recovery) hides them all (appointment bookings are filtered
    // separately on the Bookings page).
    if (f.type === "Private" || f.type === "Recovery") return [];
    return list.filter(
        (b) =>
            (f.instructorIds.length === 0 || f.instructorIds.includes(b.instructorId)) &&
            (f.categories.length === 0 || f.categories.includes(b.category)) &&
            (!f.dateFrom || b.dateISO >= f.dateFrom) &&
            (!f.dateTo || b.dateISO <= f.dateTo),
    );
}

/** The reserved seat — the chosen spot, or a stable auto-assigned one derived from
 *  the booking id (so every class booking can surface a seat, per Figma). */
function deriveSpot(b: ClassBooking, s: ClassSchedule): string {
    if (b.spot) return b.spot;
    const layout = s.spotLayout;
    const cols = layout?.cols ?? 5;
    const rows = layout?.rows ?? Math.max(1, Math.ceil((s.capacity || 10) / cols));
    const blocked = new Set(layout?.blockedSpots ?? []);
    const all: string[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 1; c <= cols; c++) {
            const id = `${String.fromCharCode(65 + r)}${c}`;
            if (!blocked.has(id)) all.push(id);
        }
    }
    if (all.length === 0) return "A1";
    const hash = Array.from(b.id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return all[hash % all.length];
}

export interface BookingDetailVM {
    booking: ClassBooking;
    detail: ClassDetailVM;
    viewStatus: BookingViewStatus;
    tab: BookingTab;
    /** Date/time line for the hero, e.g. "Sun, 20 Feb 2025 at 10:00 AM". */
    heroSubtitle: string;
    /** Second hero line — the branch's timezone label, stacked under the
     *  subtitle. Empty when the branch can't be resolved. */
    heroSubtitleLine2: string;
    /** Reserved seat (chosen or auto-assigned). */
    spot: string;
}

export function useBookingDetail(bookingId: string): BookingDetailVM | null {
    const member = useCurrentCustomer();
    const bookings = useAppStore((s) => s.classBookings);
    const schedules = useAppStore((s) => s.classSchedules);
    const branches = useAppStore((s) => s.branches);
    const booking = bookings.find((b) => b.id === bookingId && b.customerId === member?.id);
    const detail = useClassDetail(booking?.classScheduleId ?? "");

    return useMemo(() => {
        if (!booking || !detail) return null;
        const sched = schedules.find((s) => s.id === booking.classScheduleId);
        if (!sched) return null;
        const { viewStatus, tab } = classifyBooking(booking, sched);
        // The class branch's TZ label goes on its own line under the hero
        // subtitle (client Jul 2026 — inline was too busy).
        const branch = branches.find((b) => b.id === sched.branchId);
        const heroSubtitleLine2 = branch ? branchTzLabel(branch) : "";
        const heroSubtitle = `${new Date(`${sched.dateISO}T00:00:00`).toLocaleString("en-US", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
        })} at ${formatTime12(sched.startTime)}`;
        return { booking, detail, viewStatus, tab, heroSubtitle, heroSubtitleLine2, spot: deriveSpot(booking, sched) };
    }, [booking, detail, schedules, branches]);
}

// ─── Reviews (ratings) ───────────────────────────────────────────────────────

export interface ReviewVM {
    id: string;
    authorName: string;
    authorInitials: string;
    authorAvatar?: string;
    score: number;
    comment: string;
    timeAgo: string;
    submittedAt: string;
    tags: string[];
}

function timeAgo(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const diff = Date.now() - then;
    const mins = Math.round(diff / 60000);
    if (mins < 60) return `${Math.max(1, mins)} minute${mins === 1 ? "" : "s"} ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
    const days = Math.round(hrs / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    const wks = Math.round(days / 7);
    if (wks < 5) return `${wks} week${wks === 1 ? "" : "s"} ago`;
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export interface ClassReviewsVM {
    average: number;
    count: number;
    reviews: ReviewVM[];
    /** Top tags by frequency, e.g. [{ tag: "Instructor", count: 4 }]. */
    tags: { tag: string; count: number }[];
}

/** Has the current member already rated this class instance? (hides the Rate CTA). */
export function useHasRated(scheduleId: string): boolean {
    const member = useCurrentCustomer();
    const ratings = useAppStore((s) => s.classRatings);
    return useMemo(
        () => !!member && ratings.some((r) => r.classScheduleId === scheduleId && r.customerId === member.id && !r.deletedAt),
        [ratings, member, scheduleId],
    );
}

export function useClassReviews(scheduleId: string): ClassReviewsVM {
    const ratings = useAppStore((s) => s.classRatings);
    const customers = useAppStore((s) => s.customers);

    return useMemo(() => {
        const custById = new Map(customers.map((c) => [c.id, c]));
        const rows = ratings
            .filter((r) => r.classScheduleId === scheduleId && !r.deletedAt)
            .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

        const reviews: ReviewVM[] = rows.map((r) => {
            const c = custById.get(r.customerId);
            const name = c ? `${c.firstName} ${c.lastName}`.trim() : "Member";
            return {
                id: r.id,
                authorName: name,
                authorInitials: c?.initials ?? "M",
                authorAvatar: c?.imageUrl,
                score: r.score,
                comment: r.comment,
                timeAgo: timeAgo(r.submittedAt),
                submittedAt: r.submittedAt,
                tags: r.tags ?? [],
            };
        });

        const average = reviews.length
            ? Math.round((reviews.reduce((s, r) => s + r.score, 0) / reviews.length) * 10) / 10
            : 0;

        const tagCounts = new Map<string, number>();
        for (const r of reviews) for (const t of r.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
        const tags = Array.from(tagCounts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count);

        return { average, count: reviews.length, reviews, tags };
    }, [ratings, customers, scheduleId]);
}

// ─── Appointment reviews (mirror the class rating flow) ──────────────────────
//
// Appointments rate the same way classes do, but their ratings live in the
// shared `appointmentRatings` store (keyed by appointment id) so admin + customer
// read one source. Ratings already carry the denormalized author fields, so no
// customer join is needed. Reuses the ClassReviewsVM shape → same <RatingsSection>.

/** Has the current member already rated this appointment? (hides the Rate CTA). */
export function useHasRatedAppointment(appointmentId: string | undefined): boolean {
    const member = useCurrentCustomer();
    const ratings = useAppStore((s) => s.appointmentRatings);
    return useMemo(
        () =>
            !!member &&
            !!appointmentId &&
            ratings.some((r) => r.appointmentId === appointmentId && r.customerId === member.id && !r.deletedAt),
        [ratings, member, appointmentId],
    );
}

export function useAppointmentReviews(appointmentId: string | undefined): ClassReviewsVM {
    const ratings = useAppStore((s) => s.appointmentRatings);
    return useMemo(() => {
        const rows = ratings
            .filter((r) => !!appointmentId && r.appointmentId === appointmentId && !r.deletedAt)
            .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

        const reviews: ReviewVM[] = rows.map((r) => ({
            id: r.id,
            authorName: r.customerName || "Member",
            authorInitials: r.customerInitials || "M",
            authorAvatar: r.customerImageUrl,
            score: r.score,
            comment: r.comment,
            timeAgo: timeAgo(r.submittedAt),
            submittedAt: r.submittedAt,
            tags: r.tags ?? [],
        }));

        const average = reviews.length
            ? Math.round((reviews.reduce((s, r) => s + r.score, 0) / reviews.length) * 10) / 10
            : 0;

        const tagCounts = new Map<string, number>();
        for (const r of reviews) for (const t of r.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
        const tags = Array.from(tagCounts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count);

        return { average, count: reviews.length, reviews, tags };
    }, [ratings, appointmentId]);
}

// ─── Unified upcoming (classes + appointments) ───────────────────────────────
//
// The Home "Upcoming bookings" section shows the SINGLE next upcoming booking
// regardless of type — a Class, a Private appointment, or a Recovery appointment.
// This merges both sources into one render-ready card VM, sorted soonest-first.

export interface UpcomingCardVM {
    key: string;
    name: string;
    dateShort: string;
    time: string;
    location: string;
    status: BookingStatus;
    mutedCover: boolean;
    coverImage?: string;
    coverColor?: string;
    sortKey: string;
    /** Detail route for this booking (class vs appointment). */
    href: string;
}

/** Every upcoming booking (classes + private/recovery appointments), soonest-first. */
export function useUpcomingBookingsMerged(): UpcomingCardVM[] {
    const { upcoming } = useMemberBookings();
    const apptBookings = useAppointmentBookings();
    const appointments = useAppStore((s) => s.appointments);

    return useMemo(() => {
        const classCards: UpcomingCardVM[] = upcoming.map((b) => ({
            key: `class-${b.bookingId}`,
            name: b.name,
            dateShort: b.dateShort,
            time: b.time,
            location: b.location,
            status: BOOKING_STATUS[b.viewStatus].card,
            mutedCover: BOOKING_STATUS[b.viewStatus].mutedCover,
            coverImage: b.coverImage,
            coverColor: b.coverColor,
            sortKey: b.sortKey,
            href: `/customer/bookings/${b.bookingId}`,
        }));

        // Appointment "upcoming" mirrors the Bookings list: not cancelled by the
        // customer OR admin, and the slot is today or later (device clock).
        const now = new Date();
        const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const adminCancelled = new Map(appointments.map((a) => [a.id, a.status === "Cancelled"] as const));
        const apptCards: UpcomingCardVM[] = apptBookings
            .filter(
                (a) =>
                    a.status !== "cancelled" &&
                    !(a.adminAppointmentId != null && adminCancelled.get(a.adminAppointmentId)) &&
                    a.slotISO >= todayISO,
            )
            .map((a) => ({
                key: `appt-${a.id}`,
                name: a.name,
                dateShort: formatShortDate(a.slotISO),
                time: formatTime12(a.slotTime),
                location: a.branchName,
                status: { label: "Booked", tone: "success" as const },
                mutedCover: false,
                coverImage: a.coverImage,
                coverColor: a.coverColor,
                sortKey: `${a.slotISO}T${a.slotTime}`,
                href: `/customer/bookings/appointment/${a.id}`,
            }));

        return [...classCards, ...apptCards].sort((x, y) => x.sortKey.localeCompare(y.sortKey));
    }, [upcoming, apptBookings, appointments]);
}


// ─── Merged PAST bookings (classes + appointments) + Home stat counts ─────────
//
// The Home "Previous bookings" section mirrors "Upcoming bookings": the single
// most-recent past booking regardless of type, rendered through the shared
// <BookingCard>. Attended-and-not-yet-rated bookings expose a "Rate class" CTA.

export interface PastCardVM extends UpcomingCardVM {
    /** The session was attended (rateable). Stays true after rating so the
     *  card remains in the Previous bookings section — client 2026-08-06. */
    attended: boolean;
    /** Attended & not yet rated → show the "Rate class" CTA. */
    canRate: boolean;
    /** Route to the rating flow for this booking. */
    rateHref: string;
}

/** Every past booking (classes + private/recovery appointments), most-recent-first. */
export function usePastBookingsMerged(): PastCardVM[] {
    const member = useCurrentCustomer();
    const { past } = useMemberBookings();
    const apptBookings = useAppointmentBookings();
    const appointments = useAppStore((s) => s.appointments);
    const classRatings = useAppStore((s) => s.classRatings);
    const appointmentRatings = useAppStore((s) => s.appointmentRatings);

    return useMemo(() => {
        const ratedSchedule = new Set(
            classRatings.filter((r) => member && r.customerId === member.id && !r.deletedAt).map((r) => r.classScheduleId),
        );
        const ratedAppt = new Set(
            appointmentRatings.filter((r) => member && r.customerId === member.id && !r.deletedAt).map((r) => r.appointmentId),
        );

        const classCards: PastCardVM[] = past.map((b) => {
            const pres = BOOKING_STATUS[b.viewStatus];
            return {
                key: `class-${b.bookingId}`,
                name: b.name,
                dateShort: b.dateShort,
                time: b.time,
                location: b.location,
                status: pres.card,
                mutedCover: pres.mutedCover,
                coverImage: b.coverImage,
                coverColor: b.coverColor,
                sortKey: b.sortKey,
                href: `/customer/bookings/${b.bookingId}`,
                attended: b.viewStatus === "attended",
                canRate: b.viewStatus === "attended" && !ratedSchedule.has(b.scheduleId),
                rateHref: `/customer/bookings/${b.bookingId}/rate`,
            };
        });

        // A past appointment = not cancelled (by customer or admin) and its slot is
        // in the past. Treated as attended, so it's rateable until rated.
        const now = new Date();
        const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const adminCancelled = new Map(appointments.map((a) => [a.id, a.status === "Cancelled"] as const));
        const apptCards: PastCardVM[] = apptBookings
            .filter(
                (a) =>
                    a.status !== "cancelled" &&
                    !(a.adminAppointmentId != null && adminCancelled.get(a.adminAppointmentId)) &&
                    a.slotISO < todayISO,
            )
            .map((a) => ({
                key: `appt-${a.id}`,
                name: a.name,
                dateShort: formatShortDate(a.slotISO),
                time: formatTime12(a.slotTime),
                location: a.branchName,
                status: { label: "Attended", tone: "success" as const },
                mutedCover: false,
                coverImage: a.coverImage,
                coverColor: a.coverColor,
                sortKey: `${a.slotISO}T${a.slotTime}`,
                href: `/customer/bookings/appointment/${a.id}`,
                attended: true,
                canRate: !ratedAppt.has(a.adminAppointmentId ?? a.id),
                rateHref: `/customer/bookings/appointment/${a.id}/rate`,
            }));

        return [...classCards, ...apptCards].sort((x, y) => y.sortKey.localeCompare(x.sortKey));
    }, [past, apptBookings, appointments, classRatings, appointmentRatings, member]);
}

/**
 * Home metric counts across ALL booking types (classes + private/recovery
 * appointments). "Total bookings" excludes customer/admin-cancelled bookings;
 * "this month" is scoped to the current calendar month (real clock).
 */
export function useMemberBookingStats(): { totalBookings: number; bookingsThisMonth: number } {
    const { upcoming, past } = useMemberBookings();
    const apptBookings = useAppointmentBookings();
    const appointments = useAppStore((s) => s.appointments);

    return useMemo(() => {
        const classRows = [
            ...upcoming,
            ...past.filter((b) => b.viewStatus !== "cancelled_free" && b.viewStatus !== "cancelled_late"),
        ];
        const adminCancelled = new Map(appointments.map((a) => [a.id, a.status === "Cancelled"] as const));
        const apptRows = apptBookings.filter(
            (a) => a.status !== "cancelled" && !(a.adminAppointmentId != null && adminCancelled.get(a.adminAppointmentId)),
        );

        const monthKey = REAL_TODAY_ISO.slice(0, 7);
        const inMonth = (iso: string) => iso.slice(0, 7) === monthKey;

        return {
            totalBookings: classRows.length + apptRows.length,
            bookingsThisMonth:
                classRows.filter((b) => inMonth(b.dateISO)).length + apptRows.filter((a) => inMonth(a.slotISO)).length,
        };
    }, [upcoming, past, apptBookings, appointments]);
}
