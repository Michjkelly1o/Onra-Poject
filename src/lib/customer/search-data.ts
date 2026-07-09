"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer Search — data layer (browse classes by day + class detail)
// ─────────────────────────────────────────────────────────────────────────────
//
// Pure derivations over the live store (read-only). Resolves each
// `class_schedule` instance into a view-model with its customer-facing
// availability state (Available / Waitlist / Full / Booked / Waitlisted),
// scoped to the active branch + a selected day. Booking writes go through the
// store action `createMemberBooking` (added separately); nothing here mutates.

import { useMemo } from "react";
import { useAppStore, type ClassSchedule, type ClassBooking, type Instructor, type Branch } from "@/lib/store";
import { ALL_BRANCHES, useCurrentCustomerContext } from "./context";
import { durationMins, nowHHMM, REAL_TODAY_ISO } from "./dates";

export type ClassState = "available" | "waitlist" | "full" | "booked" | "waitlisted" | "closed";

export interface SearchClassVM {
    id: string;
    name: string;
    category: string;
    coverImage?: string;
    coverColor: string;
    instructorId: string;
    instructorName: string;
    instructorInitials: string;
    instructorColor: string;
    instructorImageUrl?: string;
    room: string;
    branchId: string;
    branchName: string;
    dateISO: string;
    startTime: string;
    endTime: string;
    durationMins: number;
    booked: number;
    capacity: number;
    spotsLeft: number;
    waitlistEnabled: boolean;
    /** Remaining waitlist slots (max − current waitlisted), or null when no waitlist. */
    waitlistSpotsLeft: number | null;
    state: ClassState;
}

export interface ClassDetailVM extends SearchClassVM {
    description: string;
    equipment: string[];
    classType: "Group" | "Private";
    rating: number;
    ratingCount: number;
    branchAddress: string;
    spotSelectionEnabled: boolean;
    spotLayout?: { cols: number; rows: number; blockedSpots: string[] };
}

function resolveState(
    schedule: ClassSchedule,
    memberBooking: ClassBooking | undefined,
    waitlistSpotsLeft: number | null,
): ClassState {
    if (memberBooking?.status === "booked") return "booked";
    if (memberBooking?.status === "waitlisted") return "waitlisted";
    // Today's classes whose start time has already passed (device clock) can no
    // longer be booked — they show as Closed with no booking action.
    if (schedule.dateISO === REAL_TODAY_ISO && schedule.startTime < nowHHMM()) return "closed";
    if (schedule.booked < schedule.capacity) return "available";
    if (schedule.waitlistEnabled && (waitlistSpotsLeft ?? 0) > 0) return "waitlist";
    return "full";
}

function buildDetailVM(
    schedule: ClassSchedule,
    deps: {
        instructors: Instructor[];
        branches: Branch[];
        bookings: ClassBooking[];
        memberId: string;
        maxWaitingSpots: number;
    },
): ClassDetailVM {
    const { instructors, branches, bookings, memberId, maxWaitingSpots } = deps;
    const instructor = instructors.find((i) => i.id === schedule.instructorId);
    const branch = branches.find((b) => b.id === schedule.branchId);
    const branchAddress = branch ? [branch.address, branch.country].filter(Boolean).join(", ") : "";

    const waitlistCount = bookings.filter(
        (b) => b.classScheduleId === schedule.id && b.status === "waitlisted",
    ).length;
    const waitlistSpotsLeft = schedule.waitlistEnabled ? Math.max(0, maxWaitingSpots - waitlistCount) : null;

    const memberBooking = bookings.find(
        (b) =>
            b.classScheduleId === schedule.id &&
            b.customerId === memberId &&
            (b.status === "booked" || b.status === "waitlisted"),
    );

    const equipment =
        typeof schedule.equipment === "string" && schedule.equipment.trim().length > 0
            ? schedule.equipment.split(",").map((e) => e.trim()).filter(Boolean)
            : [];

    return {
        id: schedule.id,
        name: schedule.name,
        category: schedule.category,
        coverImage: schedule.coverImage,
        coverColor: schedule.coverColor,
        instructorId: schedule.instructorId,
        // Prefer the LIVE instructor row (always complete) over the schedule's
        // denormalized snapshot — older persisted demo state can carry an empty
        // name + the #e0e0e0 default for instructors not in staff_profiles.
        instructorName: instructor?.name || schedule.instructorName,
        instructorInitials: instructor?.initials || schedule.instructorInitials,
        instructorColor: instructor?.color || schedule.instructorColor,
        instructorImageUrl: instructor?.imageUrl,
        room: schedule.room,
        branchId: schedule.branchId,
        branchName: branch?.name ?? schedule.location,
        dateISO: schedule.dateISO,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        durationMins: durationMins(schedule.startTime, schedule.endTime),
        booked: schedule.booked,
        capacity: schedule.capacity,
        spotsLeft: Math.max(0, schedule.capacity - schedule.booked),
        waitlistEnabled: schedule.waitlistEnabled,
        waitlistSpotsLeft,
        state: resolveState(schedule, memberBooking, waitlistSpotsLeft),
        description: schedule.description,
        equipment,
        classType: schedule.classType,
        rating: schedule.rating,
        ratingCount: schedule.ratingCount,
        branchAddress,
        spotSelectionEnabled: schedule.spotSelectionEnabled,
        spotLayout: schedule.spotLayout,
    };
}

/** The active-branch, bookable classes on `dateISO`, ascending by start time. */
export function useDayClasses(dateISO: string): SearchClassVM[] {
    const { member, selectedBranchId } = useCurrentCustomerContext();
    const classSchedules = useAppStore((s) => s.classSchedules);
    const instructors = useAppStore((s) => s.instructors);
    const branches = useAppStore((s) => s.branches);
    const bookings = useAppStore((s) => s.classBookings);
    const maxWaitingSpots = useAppStore((s) => s.classesSettings.max_waiting_spots);

    return useMemo(() => {
        // Classes are PUBLIC — a guest (member === null) browses the same schedule
        // as a logged-in member; only the per-card booked/waitlisted state (which
        // needs a member id) differs, and an empty id simply resolves to none.
        const isAll = selectedBranchId === ALL_BRANCHES;
        return classSchedules
            .filter((s) => s.status === "Upcoming" && s.dateISO === dateISO && (isAll || s.branchId === selectedBranchId))
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map((s) => buildDetailVM(s, { instructors, branches, bookings, memberId: member?.id ?? "", maxWaitingSpots }));
    }, [member, selectedBranchId, classSchedules, instructors, branches, bookings, maxWaitingSpots, dateISO]);
}

/** The instructor's upcoming classes on `dateISO` (any branch), ascending by
 *  start time. Same `buildDetailVM` + state model as Search, so the instructor
 *  detail's schedule tab shows identical class data (availability, booked state)
 *  straight from the live admin `classSchedules`. */
export function useInstructorDayClasses(instructorId: string, dateISO: string): SearchClassVM[] {
    const { member } = useCurrentCustomerContext();
    const classSchedules = useAppStore((s) => s.classSchedules);
    const instructors = useAppStore((s) => s.instructors);
    const branches = useAppStore((s) => s.branches);
    const bookings = useAppStore((s) => s.classBookings);
    const maxWaitingSpots = useAppStore((s) => s.classesSettings.max_waiting_spots);

    return useMemo(() => {
        // Public — a guest sees the instructor's classes too (booked state needs an
        // id, so an empty id resolves to none).
        return classSchedules
            .filter((s) => s.instructorId === instructorId && s.status === "Upcoming" && s.dateISO === dateISO)
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map((s) => buildDetailVM(s, { instructors, branches, bookings, memberId: member?.id ?? "", maxWaitingSpots }));
    }, [member, instructorId, classSchedules, instructors, branches, bookings, maxWaitingSpots, dateISO]);
}

/** A single class instance's full detail view-model. */
export function useClassDetail(id: string): ClassDetailVM | null {
    const { member } = useCurrentCustomerContext();
    const classSchedules = useAppStore((s) => s.classSchedules);
    const instructors = useAppStore((s) => s.instructors);
    const branches = useAppStore((s) => s.branches);
    const bookings = useAppStore((s) => s.classBookings);
    const maxWaitingSpots = useAppStore((s) => s.classesSettings.max_waiting_spots);

    return useMemo(() => {
        const schedule = classSchedules.find((s) => s.id === id);
        // The class detail is PUBLIC — a guest (member === null) sees the same page;
        // only the per-member booked/waitlisted state needs an id (empty = none).
        if (!schedule) return null;
        return buildDetailVM(schedule, { instructors, branches, bookings, memberId: member?.id ?? "", maxWaitingSpots });
    }, [id, member, classSchedules, instructors, branches, bookings, maxWaitingSpots]);
}

/** Card badge + CTA presentation derived from a class's availability state. */
export function cardPresentation(vm: SearchClassVM): {
    badgeLabel: string;
    badgeTone: "success" | "neutral" | "error";
    ctaLabel: string;
    ctaVariant: "primary" | "secondary";
    ctaDisabled: boolean;
} {
    switch (vm.state) {
        case "available":
            return {
                badgeLabel: `${vm.spotsLeft} spot${vm.spotsLeft === 1 ? "" : "s"} left`,
                badgeTone: "success",
                ctaLabel: "Book now",
                ctaVariant: "primary",
                ctaDisabled: false,
            };
        case "waitlist":
            return {
                badgeLabel: `${vm.waitlistSpotsLeft} waitlist spot${vm.waitlistSpotsLeft === 1 ? "" : "s"}`,
                badgeTone: "neutral",
                ctaLabel: "Join waitlist",
                ctaVariant: "primary",
                ctaDisabled: false,
            };
        case "booked":
            return { badgeLabel: "Booked", badgeTone: "neutral", ctaLabel: "View details", ctaVariant: "secondary", ctaDisabled: false };
        case "waitlisted":
            return { badgeLabel: "Waitlisted", badgeTone: "neutral", ctaLabel: "View details", ctaVariant: "secondary", ctaDisabled: false };
        case "closed":
            return { badgeLabel: "Closed", badgeTone: "neutral", ctaLabel: "Closed", ctaVariant: "secondary", ctaDisabled: true };
        case "full":
        default:
            return { badgeLabel: "FULL", badgeTone: "error", ctaLabel: "Full", ctaVariant: "secondary", ctaDisabled: true };
    }
}

// ── Search filters (Classes Filter modal) ──────────────────────────────────────

export interface SearchFilters {
    /** "HH:MM" — keep classes starting at/after this. */
    startTime: string | null;
    /** "HH:MM" — keep classes ending at/before this. */
    endTime: string | null;
    /** Instructor ids (multi-select, OR within the dimension). */
    instructorIds: string[];
    /** Category names (OR within the dimension). */
    categories: string[];
}

export const EMPTY_FILTERS: SearchFilters = { startTime: null, endTime: null, instructorIds: [], categories: [] };

export function hasActiveFilters(f: SearchFilters): boolean {
    return !!f.startTime || !!f.endTime || f.instructorIds.length > 0 || f.categories.length > 0;
}

export function filterCount(f: SearchFilters): number {
    return (f.startTime || f.endTime ? 1 : 0) + f.instructorIds.length + f.categories.length;
}

/** AND across dimensions, OR within instructors + categories. Times compare lexically ("HH:MM"). */
export function applyFilters(list: SearchClassVM[], f: SearchFilters): SearchClassVM[] {
    return list.filter((c) => {
        // Time-of-day slots window by the class START time: a class belongs to the
        // slot its start falls in (Morning / Afternoon / Evening).
        if (f.startTime && c.startTime < f.startTime) return false;
        if (f.endTime && c.startTime >= f.endTime) return false;
        if (f.instructorIds.length && !f.instructorIds.includes(c.instructorId)) return false;
        if (f.categories.length && !f.categories.includes(c.category)) return false;
        return true;
    });
}

/**
 * Module-level Search UI state — persists across navigation WITHIN the Search
 * module (e.g. Search → Instructor selection → back, or Search → class detail →
 * back) so the selected day, applied filters, the in-progress filter draft, and
 * whether the filter modal is open all survive a page remount. Resets on reload.
 */
export const searchUi: {
    tab: "classes" | "appointments";
    selectedISO: string | null;
    /** Classes tab filters (Time + Instructor + Categories). */
    applied: SearchFilters;
    draft: SearchFilters;
    /** Appointments tab filters (Categories only). */
    apptApplied: SearchFilters;
    apptDraft: SearchFilters;
    filterOpen: boolean;
} = {
    tab: "classes",
    selectedISO: null,
    applied: EMPTY_FILTERS,
    draft: EMPTY_FILTERS,
    apptApplied: EMPTY_FILTERS,
    apptDraft: EMPTY_FILTERS,
    filterOpen: false,
};

/** Whether the member has any booking history (drives the first-time waiver gate). */
export function useHasBookingHistory(): boolean {
    const { member } = useCurrentCustomerContext();
    const bookings = useAppStore((s) => s.classBookings);
    return useMemo(
        () => !!member && bookings.some((b) => b.customerId === member.id),
        [member, bookings],
    );
}

/** True when the member still has an unsigned booking-waiver agreement — they
 *  must sign it before a first booking goes through (Phase 4 gate). */
export function useNeedsWaiver(): boolean {
    const { member } = useCurrentCustomerContext();
    const customerAgreements = useAppStore((s) => s.customerAgreements);
    return useMemo(
        // v24: "not signed" means either terminal not-signed state
        // (never_signed OR re_accept_due) — the customer needs to
        // sign before booking either way.
        () => !!member && customerAgreements.some((ca) => ca.customerId === member.id && ca.status !== "signed"),
        [member, customerAgreements],
    );
}
