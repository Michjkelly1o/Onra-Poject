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
import { useAppStore, type ClassBooking, type ClassSchedule } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { useClassDetail, type ClassDetailVM } from "@/lib/customer/search-data";
import { REAL_TODAY_ISO } from "@/lib/customer/dates";
import { formatShortDate, formatTime12 } from "@/lib/customer/format";
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
const GRAY_PILL = "border-[#e4e7ec] bg-white/90 text-[#344054]";
// Status card tints — Figma 3696-33904 uses the brand secondary palette for the
// confirmed (green) card; red/gray follow the error/neutral families.
const GREEN_CARD = "border-[#c4edd6] bg-[#e9fff3]";
const RED_CARD = "border-[#fecdca] bg-[#fef3f2]";
const GRAY_CARD = "border-[#eaecf0] bg-[#f9fafb]";
/** Concentric-ring decoration colour per card tint. */
export const STATUS_RING: Record<BookingViewStatus, string> = {
    booked: "#c4edd6",
    attended: "#c4edd6",
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
    // Upcoming = the class hasn't happened yet vs the real today (admin uses the
    // live clock too), and isn't completed/cancelled. Date-driven, not the fixed
    // seed status — so seed rows anchored to an older "today" age out correctly.
    const future = s.dateISO >= REAL_TODAY_ISO && s.status !== "Completed" && s.status !== "Cancelled";
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
    /** Group = class bookings · Appointment = appointment bookings (mirrors the
     *  admin schedule module's Group/Appointment filter). */
    classType: "Group" | "Appointment" | null;
    instructorIds: string[];
    categories: string[];
}

export const EMPTY_BOOKING_FILTERS: BookingFilters = { classType: null, instructorIds: [], categories: [] };

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
    return (f.classType ? 1 : 0) + f.instructorIds.length + f.categories.length;
}

export function applyBookingFilters(list: BookingListItemVM[], f: BookingFilters): BookingListItemVM[] {
    // Class bookings ARE the "Group" kind — selecting "Appointment" hides them all
    // (appointment bookings are filtered separately on the Bookings page).
    if (f.classType === "Appointment") return [];
    return list.filter(
        (b) =>
            (f.instructorIds.length === 0 || f.instructorIds.includes(b.instructorId)) &&
            (f.categories.length === 0 || f.categories.includes(b.category)),
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
