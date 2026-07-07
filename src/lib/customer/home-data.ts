// ─────────────────────────────────────────────────────────────────────────────
// Customer experience — Home screen data layer (PRD 13 §6)
// ─────────────────────────────────────────────────────────────────────────────
//
// Pure derivations from the store slices + the current member → a single Home
// view-model the section components render. Read-only over the seeds (PRD 13
// §17): nothing here mutates. Every section binds to a field on `HomeViewModel`,
// so the UI work (Achievement card, stat tiles, upcoming bookings, instructor
// rail, category grid, what's-on) is plug-and-play.
//
// "Today": the seed is authored around 2026-05-15 (see class_schedule.ts). The
// builder takes `todayISO` so it is deterministic/testable; `useHomeData`
// defaults to `DEMO_TODAY_ISO` so the demo shows the seed's rich May data.
// Switch to the live clock by passing `new Date().toISOString().slice(0, 10)`.
//
// Grounding notes (seeds, not assumptions):
//   • Attendance = `classBookings.attendanceStatus === "present"` (NOT a booking
//     status). Streak / total / this-month / most-in-a-month all key off it.
//   • Bookings join schedules via `classScheduleId`; "upcoming" = a booked /
//     waitlisted booking whose schedule `status === "Upcoming"`.
//   • `instructor.id === schedule.instructorId` (both `staff_*`).
//   • `classCategories` is global (no branchId) and carries `color_hex` /
//     `image_url` (snake) — categories shown are the active ones that actually
//     have upcoming classes at the active branch (reflects admin config).
//   • Notifications have no `"member"` audience yet — the member feed filters by
//     `customerId === member.id` (PRD 18 data-layer flag).

import { useMemo } from "react";
import {
    useAppStore,
    type Customer,
    type ClassBooking,
    type ClassSchedule,
    type Instructor,
    type Notification,
} from "@/lib/store";
import type { ClassCategory, MarketingItem, Branch } from "@/data/mock";
import { ALL_BRANCHES, useCurrentCustomerContext } from "./context";
import { useCustomerInstructors } from "./instructors";
import { REAL_TODAY_ISO } from "./dates";

/** Seed-anchored "today" — the date the schedule/booking seeds are built around. */
export const DEMO_TODAY_ISO = "2026-05-15";

// ── View-model shapes ────────────────────────────────────────────────────────

export interface HomeStudioVM {
    id: string;
    name: string;
}

export interface HomeMetricsVM {
    /** Total classes attended (lifetime `present` bookings). */
    totalClasses: number;
    /** Attended classes whose date falls in `todayISO`'s calendar month. */
    classesThisMonth: number;
    /** Consecutive days (ending at the most recent attended day) with ≥1 attended class. */
    dayStreak: number;
    /** Longest day streak ever — feeds personal-best achievements. */
    longestStreak: number;
    /**
     * The "Classes remaining" tile. `unlimited` is true for an unlimited
     * membership (no numeric credit balance); otherwise `value` is the member's
     * remaining credits.
     */
    classesRemaining: { value: number | null; unlimited: boolean };
    /** Count of upcoming (booked + waitlisted) bookings — the "or upcoming" half of the tile. */
    upcomingCount: number;
    /** The Achievement Highlight: best single calendar month by attendance, or null. */
    mostClassesInMonth: { count: number; monthLabel: string } | null;
}

export interface HomeUpcomingBookingVM {
    bookingId: string;
    scheduleId: string;
    className: string;
    category: string;
    dateISO: string;
    startTime: string;
    /** e.g. "Thursday, May 15" (denormalized schedule label). */
    dateLabel: string;
    /** e.g. "09:30 - 10:30 AM" (denormalized schedule label). */
    timeLabel: string;
    instructorName: string;
    studioName: string;
    roomName: string;
    status: "booked" | "waitlisted";
    statusLabel: string;
    waitlistPosition: number | null;
    coverImage?: string;
    coverColor?: string;
}

export interface HomeInstructorVM {
    id: string;
    name: string;
    initials: string;
    color: string;
    imageUrl?: string;
    activeClasses: number;
    /** e.g. "3 active classes" / "1 active class". */
    activeClassesLabel: string;
}

export interface HomeCategoryVM {
    id: string;
    name: string;
    colorHex: string;
    imageUrl?: string;
}

export interface HomeWhatsOnVM {
    id: string;
    title: string;
    image?: string;
    type: MarketingItem["type"];
    actionType: MarketingItem["action_type"];
    countdown: boolean;
    expiryISO?: string;
    ticketPrice?: number;
    externalUrl?: string;
}

export interface HomeViewModel {
    member: Customer | null;
    studio: HomeStudioVM | null;
    /** Active branches the member could switch to (drives the studio selector sheet). */
    switchableStudios: HomeStudioVM[];
    metrics: HomeMetricsVM;
    upcomingBookings: HomeUpcomingBookingVM[];
    instructors: HomeInstructorVM[];
    categories: HomeCategoryVM[];
    whatsOn: HomeWhatsOnVM[];
    /** Unread member notifications → the header bell badge. */
    unreadNotifications: number;
}

// ── Date helpers (UTC, ISO `YYYY-MM-DD`) ─────────────────────────────────────

/** "2026-05-08" → "2026-05". */
function monthKey(dateISO: string): string {
    return dateISO.slice(0, 7);
}

/** "2026-05" → "May". */
function monthLabelFromKey(key: string): string {
    return new Date(`${key}-01T00:00:00Z`).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
}

function daysBetween(aISO: string, bISO: string): number {
    const a = new Date(`${aISO}T00:00:00Z`).getTime();
    const b = new Date(`${bISO}T00:00:00Z`).getTime();
    return Math.round((b - a) / 86_400_000);
}

/**
 * Day streak from a set of attended-day ISO strings.
 * `current` = consecutive days ending at the most recent attended day;
 * `longest` = longest consecutive run ever. Same-day duplicates collapse.
 */
function computeDayStreak(attendedDayISOs: string[]): { current: number; longest: number } {
    const days = Array.from(new Set(attendedDayISOs)).sort();
    if (days.length === 0) return { current: 0, longest: 0 };

    let longest = 1;
    let run = 1;
    for (let i = 1; i < days.length; i++) {
        run = daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
        if (run > longest) longest = run;
    }

    let current = 1;
    for (let i = days.length - 1; i > 0; i--) {
        if (daysBetween(days[i - 1], days[i]) === 1) current++;
        else break;
    }

    return { current, longest };
}

// ── Builder ──────────────────────────────────────────────────────────────────

export interface HomeDataSlices {
    classBookings: ClassBooking[];
    classSchedules: ClassSchedule[];
    classCategories: ClassCategory[];
    instructors: Instructor[];
    marketingItems: MarketingItem[];
    branches: Branch[];
    notifications: Notification[];
}

/**
 * Pure: build the Home view-model from store slices + the current member.
 * Exported so it can be unit-tested without React.
 */
export function buildHomeViewModel(
    member: Customer | null,
    slices: HomeDataSlices,
    todayISO: string = DEMO_TODAY_ISO,
    scope?: string,
): HomeViewModel {
    const { classBookings, classSchedules, classCategories, instructors, marketingItems, branches, notifications } =
        slices;

    // A GUEST (member === null) still sees the public studio surface: studio +
    // switchable studios, instructors, categories and "What's on". Only the
    // member-specific bits (metrics, streak, upcoming bookings, unread bell) are
    // empty/zero — and the guest Home hides the metrics row entirely anyway.

    // Active branch scope — the persisted Select-branch choice (a `branches.id`)
    // or `ALL_BRANCHES`. Defaults to the member's home branch, else the scope.
    const scopeBranchId = scope ?? member?.branchId ?? ALL_BRANCHES;
    const isAllBranches = scopeBranchId === ALL_BRANCHES;
    const branchId = scopeBranchId; // a branches.id, or "all" (guarded by isAllBranches)
    const scheduleById = new Map(classSchedules.map((s) => [s.id, s]));

    // ── Studio / branch ──
    const branch = isAllBranches ? null : branches.find((b) => b.id === branchId) ?? null;
    const studio: HomeStudioVM | null = isAllBranches
        ? { id: ALL_BRANCHES, name: "All branches" }
        : branch
          ? { id: branch.id, name: branch.name }
          : null;
    const switchableStudios: HomeStudioVM[] = branches
        .filter((b) => b.status === "active")
        .map((b) => ({ id: b.id, name: b.name }));

    // ── Member bookings, joined to their schedule (none for a guest) ──
    const memberBookings = member ? classBookings.filter((b) => b.customerId === member.id) : [];

    const attendedDayISOs: string[] = [];
    for (const b of memberBookings) {
        if (b.attendanceStatus !== "present") continue;
        const sch = scheduleById.get(b.classScheduleId);
        if (sch) attendedDayISOs.push(sch.dateISO);
    }

    // ── Metrics ──
    const totalClasses = attendedDayISOs.length;
    const thisMonthKey = monthKey(todayISO);
    const classesThisMonth = attendedDayISOs.filter((d) => monthKey(d) === thisMonthKey).length;
    const { current: dayStreak, longest: longestStreak } = computeDayStreak(attendedDayISOs);

    const perMonth = new Map<string, number>();
    for (const d of attendedDayISOs) perMonth.set(monthKey(d), (perMonth.get(monthKey(d)) ?? 0) + 1);
    let mostClassesInMonth: HomeMetricsVM["mostClassesInMonth"] = null;
    for (const [key, count] of Array.from(perMonth.entries())) {
        if (!mostClassesInMonth || count > mostClassesInMonth.count) {
            mostClassesInMonth = { count, monthLabel: monthLabelFromKey(key) };
        }
    }

    const upcomingBookingRows = memberBookings
        .filter((b) => b.status === "booked" || b.status === "waitlisted")
        .map((b) => ({ booking: b, schedule: scheduleById.get(b.classScheduleId) }))
        .filter(
            (r): r is { booking: ClassBooking; schedule: ClassSchedule } =>
                !!r.schedule &&
                r.schedule.dateISO >= REAL_TODAY_ISO &&
                r.schedule.status !== "Completed" &&
                r.schedule.status !== "Cancelled",
        )
        .sort((a, b) => {
            const byDate = a.schedule.dateISO.localeCompare(b.schedule.dateISO);
            return byDate !== 0 ? byDate : a.schedule.startTime.localeCompare(b.schedule.startTime);
        });

    const classesRemaining: HomeMetricsVM["classesRemaining"] =
        member == null
            ? { value: null, unlimited: false }
            : typeof member.creditsRemaining === "number"
              ? { value: member.creditsRemaining, unlimited: false }
              : { value: null, unlimited: true };

    const metrics: HomeMetricsVM = {
        totalClasses,
        classesThisMonth,
        dayStreak,
        longestStreak,
        classesRemaining,
        upcomingCount: upcomingBookingRows.length,
        mostClassesInMonth,
    };

    // ── Upcoming bookings VM ──
    const upcomingBookings: HomeUpcomingBookingVM[] = upcomingBookingRows.map(({ booking, schedule }) => {
        const waitlistPosition = booking.status === "waitlisted" ? booking.waitlistPosition ?? null : null;
        return {
            bookingId: booking.id,
            scheduleId: schedule.id,
            className: schedule.name,
            category: schedule.category,
            dateISO: schedule.dateISO,
            startTime: schedule.startTime,
            dateLabel: schedule.date,
            timeLabel: schedule.displayTime,
            instructorName: schedule.instructorName,
            studioName: branch?.name ?? schedule.location,
            roomName: schedule.room,
            status: booking.status as "booked" | "waitlisted",
            statusLabel: booking.status === "waitlisted" ? `Waitlisted${waitlistPosition ? ` #${waitlistPosition}` : ""}` : "Booked",
            waitlistPosition,
            coverImage: schedule.coverImage,
            coverColor: schedule.coverColor,
        };
    });

    // ── Instructors at the active branch ──
    const instructorsVM: HomeInstructorVM[] = instructors
        .filter((ins) => ins.status === "active" && (isAllBranches || ins.branchId === branchId))
        .map((ins) => {
            const activeClasses = classSchedules.filter(
                (s) => s.instructorId === ins.id && (isAllBranches || s.branchId === branchId) && s.status === "Upcoming",
            ).length;
            return {
                id: ins.id,
                name: ins.name,
                initials: ins.initials,
                color: ins.color,
                imageUrl: ins.imageUrl,
                activeClasses,
                activeClassesLabel: `${activeClasses} active class${activeClasses === 1 ? "" : "es"}`,
            };
        });

    // ── Categories — all active categories from the admin (Class Categories) ──
    const categories: HomeCategoryVM[] = classCategories
        .filter((c) => c.status === "active")
        .map((c) => ({ id: c.id, name: c.name, colorHex: c.color_hex, imageUrl: c.image_url }));

    // ── What's on (active, this branch or all, not expired) ──
    // Expiry is checked against the seed's reference date (DEMO_TODAY), not the
    // live clock, so the demo carousel keeps its full campaign set even though the
    // metrics above are anchored to the real current month.
    const whatsOn: HomeWhatsOnVM[] = marketingItems
        .filter((m) => m.status === "active")
        .filter((m) => isAllBranches || m.multi_location || m.branch_ids.includes(branchId))
        .filter((m) => !m.expiry_date || m.expiry_date >= DEMO_TODAY_ISO)
        .map((m) => ({
            id: m.id,
            title: m.title,
            image: m.cover_image_url,
            type: m.type,
            actionType: m.action_type,
            countdown: m.countdown ?? false,
            expiryISO: m.expiry_date,
            ticketPrice: m.ticket_price,
            externalUrl: m.external_url,
        }));

    // ── Notifications (member feed by customerId — audience gap, PRD 18) ──
    const unreadNotifications = member
        ? notifications.filter((n) => n.customerId === member.id && !n.isRead).length
        : 0;

    return {
        member,
        studio,
        switchableStudios,
        metrics,
        upcomingBookings,
        instructors: instructorsVM,
        categories,
        whatsOn,
        unreadNotifications,
    };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * The Home view-model, bound to the current member and recomputed reactively
 * when any feeding slice changes (same render cycle as admin/instructor writes).
 *
 * @param todayISO defaults to `DEMO_TODAY_ISO` (seed-anchored). Pass
 *   `new Date().toISOString().slice(0, 10)` to drive Home off the live clock.
 */
export function useHomeData(todayISO: string = REAL_TODAY_ISO): HomeViewModel {
    const { member, selectedBranchId } = useCurrentCustomerContext();
    const classBookings = useAppStore((s) => s.classBookings);
    const classSchedules = useAppStore((s) => s.classSchedules);
    const classCategories = useAppStore((s) => s.classCategories);
    const instructors = useCustomerInstructors();
    const marketingItems = useAppStore((s) => s.marketingItems);
    const branches = useAppStore((s) => s.branches);
    const notifications = useAppStore((s) => s.notifications);

    return useMemo(
        () =>
            buildHomeViewModel(
                member,
                { classBookings, classSchedules, classCategories, instructors, marketingItems, branches, notifications },
                todayISO,
                selectedBranchId,
            ),
        [member, selectedBranchId, classBookings, classSchedules, classCategories, instructors, marketingItems, branches, notifications, todayISO],
    );
}
