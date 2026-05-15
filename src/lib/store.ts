"use client";

import { create } from "zustand";
import type { UserRole, User } from "@/types";
import { adminUser } from "./mock-data";

// ─── Seed imports (snake_case, DB-ready) ─────────────────────────────────────
//
// The store now reads its initial state from `@/data/mock`. The seeds live in
// snake_case (one file per future Supabase table) so a CSV/SQL export can
// convert them 1-to-1. The adapter functions below translate to the legacy
// camelCase shape the rest of the app already consumes — minimizes consumer
// churn while preserving the Supabase-readiness of the seed layer.

import {
    customers as SEED_CUSTOMERS,
    class_schedule as SEED_CLASS_SCHEDULE,
    class_bookings as SEED_CLASS_BOOKINGS,
    class_ratings as SEED_CLASS_RATINGS,
    class_templates as SEED_CLASS_TEMPLATES,
    class_categories as SEED_CLASS_CATEGORIES,
    branches as SEED_BRANCHES,
    rooms as SEED_ROOMS,
    staff_profiles as SEED_STAFF_PROFILES,
    memberships as SEED_MEMBERSHIPS,
    packages as SEED_PACKAGES,
    payment_methods as SEED_PAYMENT_METHODS,
    type Customer as SeedCustomer,
    type ClassSchedule as SeedClassSchedule,
    type ClassBooking as SeedClassBooking,
    type ClassRating as SeedClassRating,
    type ClassTemplate as SeedClassTemplate,
    type ClassCategory,
    type Branch,
    type Room,
    type StaffProfile,
    type Membership,
    type Package,
    type PaymentMethod,
} from "@/data/mock";

// Re-export raw seed types — consumers can read these directly from the store.
export type {
    ClassCategory, Branch, Room, StaffProfile, Membership, Package, PaymentMethod,
};

// Also re-export the raw arrays for screens that filter against the entire table.
export {
    SEED_BRANCHES as BRANCHES,
    SEED_ROOMS as ROOMS,
    SEED_CLASS_CATEGORIES as CLASS_CATEGORIES,
    SEED_MEMBERSHIPS as MEMBERSHIPS,
    SEED_PACKAGES as PACKAGES,
    SEED_PAYMENT_METHODS as PAYMENT_METHODS,
};

// ─── Legacy camelCase types (kept stable for existing consumers) ────────────

export type TemplateStatus = "Active" | "Archived" | "Inactive";
export type ClassStatus    = "Upcoming" | "Ongoing" | "Completed" | "Cancelled";

/** Class template — camelCase shape used by all current consumers. */
export interface ClassTemplate {
    id: string;
    name: string;
    description: string;
    categoryId: string;
    /** Category display name — denormalized for fast UI render (resolved from class_categories). */
    category: string;
    locationType: string;
    durationMin: number;
    capacity: number;
    status: TemplateStatus;
    coverImage?: string;
    /** Tile background hex — resolved from class_categories.color_hex. */
    coverColor: string;
    applicableMembershipIds: string[];
    applicablePackageIds: string[];
    /** @deprecated kept for older code paths; superseded by applicableMembershipIds + applicablePackageIds. */
    applicableMemberships: string[];
}

/** Instructor display shape used by Schedule list / form pickers / class detail. */
export interface ScheduleInstructor {
    id: string;
    name: string;
    initials: string;
    color: string;
    imageUrl?: string;
}

/**
 * Class schedule row — renamed from `ClassInstance` (the previous name).
 * `ClassInstance` is kept as a deprecated alias below for migration safety.
 */
export interface ClassSchedule {
    id: string;
    templateId: string;
    /** Denormalized template fields for fast UI render. */
    name: string;
    description: string;
    category: string;
    branchId: string;
    instructorId: string;
    instructorName: string;
    instructorInitials: string;
    instructorColor: string;
    location: string;
    roomId: string;
    room: string;
    date: string;
    dateISO: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    displayTime: string;
    booked: number;
    capacity: number;
    equipment: string;
    spotSelectionEnabled: boolean;
    waitlistEnabled: boolean;
    rating: number;
    ratingCount: number;
    status: ClassStatus;
    recurrenceGroupId?: string;
    cancelledAt?: string;
    cancelledBy?: string;
    coverColor: string;
    coverImage?: string;
}

/** @deprecated use `ClassSchedule`. */
export type ClassInstance = ClassSchedule;

/**
 * Booking record. Customer details are looked up via `customers` at render
 * time — no `customerName`/`customerInitials`/`customerColor` copies live
 * on the row anymore.
 */
export interface ClassBooking {
    id: string;
    classScheduleId: string;
    customerId: string;
    branchId: string;
    /** Plan id used to pay (FK to memberships or packages). Empty string if no plan. */
    planId: string;
    /** Plan display name — resolved from plan_id_used at boot. */
    planName: string;
    /** Which plan kind paid the booking. */
    planKindUsed?: "membership" | "package";
    bookingTime: string;
    status: "booked" | "waitlisted" | "cancelled";
    attendanceStatus: "pending" | "present" | "no_show" | "late_cancel";
    cancelledAt?: string;
    cancellationReason?: string;
    refundCreditIssued?: boolean;
    waitlistPosition?: number;
}

/** Customer record — store shape (camelCase). Extends the lean seed shape
 *  with Module 07 fields the current customer-create form already collects. */
export interface Customer {
    id: string;
    firstName: string;
    lastName: string;
    initials: string;
    email: string;
    phone?: string;
    branchId: string;
    imageUrl?: string;
    planKind: "membership" | "package" | null;
    /** Single membership FK (when planKind === "membership"). */
    membershipId?: string;
    /** Package FKs (when planKind === "package"). Customer may hold multiple. */
    packageIds?: string[];
    /** Legacy denormalized name — kept for back-compat with screens that
     *  haven't migrated to id lookups yet. */
    planName?: string;
    createdAt: string;
    // Optional Module-07 fields — only the customer-create form sets these today.
    dateOfBirth?: string;
    gender?: string;
    country?: string;
    state?: string;
    city?: string;
    postalCode?: string;
    streetAddress?: string;
}

/** Class rating — same ID-only ref pattern as ClassBooking. */
export interface ClassRating {
    id: string;
    classScheduleId: string;
    customerId: string;
    instructorId: string;
    score: number;
    comment: string;
    tags?: string[];
    submittedAt: string;
    deletedAt?: string;
    deletedBy?: string;
}

// ─── Toast + POS purchase flow (unchanged shape) ────────────────────────────

export interface ToastData {
    id: string;
    title: string;
    message: string;
    type: "success" | "error";
    icon?: "check" | "trash" | "archive" | "slash" | "refresh";
}

export interface PurchaseLineItem {
    productId: string;
    productType: "membership" | "package";
    name: string;
    unitPrice: number;
    quantity: number;
}

export interface PendingPurchase {
    /** Renamed from `classInstanceId`. */
    classScheduleId: string;
    customerId: string;
    items: PurchaseLineItem[];
    discountPercent: number;
    promoCode?: string;
}

// ─── SCHEDULE_INSTRUCTORS — built from staff_profiles seed ──────────────────

export const SCHEDULE_INSTRUCTORS: ScheduleInstructor[] = SEED_STAFF_PROFILES.map(s => ({
    id: s.id,
    name: s.full_name,
    initials: s.initials,
    color: s.color_hex,
    imageUrl: s.image_url,
}));

// ─── Adapters (snake_case seed → camelCase store shape) ─────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function dateLabelFromISO(iso: string): string {
    const d = new Date(iso + "T00:00:00Z");
    return `${WEEKDAYS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function dayOfWeekFromISO(iso: string): string {
    const d = new Date(iso + "T00:00:00Z");
    return WEEKDAYS[d.getUTCDay()];
}

function templateFromSeed(t: SeedClassTemplate): ClassTemplate {
    const cat = SEED_CLASS_CATEGORIES.find(c => c.id === t.category_id);
    return {
        id: t.id,
        name: t.name,
        description: t.description,
        categoryId: t.category_id,
        category: cat?.name ?? "",
        locationType: t.location_type,
        durationMin: t.duration_min,
        capacity: t.capacity,
        status: t.status,
        coverImage: t.cover_image_url,
        coverColor: cat?.color_hex ?? "#f1f2ed",
        applicableMembershipIds: t.applicable_membership_ids,
        applicablePackageIds: t.applicable_package_ids,
        applicableMemberships: [...t.applicable_membership_ids, ...t.applicable_package_ids],
    };
}

function scheduleFromSeed(s: SeedClassSchedule, templates: ClassTemplate[]): ClassSchedule {
    const tpl = templates.find(t => t.id === s.template_id);
    const inst = SEED_STAFF_PROFILES.find(p => p.id === s.instructor_id);
    const branch = SEED_BRANCHES.find(b => b.id === s.branch_id);
    const room = SEED_ROOMS.find(r => r.id === s.room_id);
    return {
        id: s.id,
        templateId: s.template_id,
        name: tpl?.name ?? "",
        description: tpl?.description ?? "",
        category: tpl?.category ?? "",
        branchId: s.branch_id,
        instructorId: s.instructor_id,
        instructorName: inst?.full_name ?? "",
        instructorInitials: inst?.initials ?? "",
        instructorColor: inst?.color_hex ?? "#e0e0e0",
        location: branch?.name ?? "",
        roomId: s.room_id,
        room: room?.name ?? "",
        date: dateLabelFromISO(s.date_iso),
        dateISO: s.date_iso,
        dayOfWeek: dayOfWeekFromISO(s.date_iso),
        startTime: s.start_time,
        endTime: s.end_time,
        displayTime: s.display_time,
        booked: s.booked,
        capacity: s.capacity,
        equipment: "",
        spotSelectionEnabled: false,
        waitlistEnabled: true,
        rating: s.rating,
        ratingCount: s.rating_count,
        status: s.status,
        cancelledAt: s.cancelled_at,
        cancelledBy: s.cancelled_by,
        coverColor: tpl?.coverColor ?? "#f1f2ed",
        coverImage: tpl?.coverImage,
    };
}

function bookingFromSeed(b: SeedClassBooking): ClassBooking {
    let planId = "";
    let planName = "—";
    if (b.plan_kind_used === "membership" && b.plan_id_used) {
        const m = SEED_MEMBERSHIPS.find(m => m.id === b.plan_id_used);
        planId = b.plan_id_used;
        planName = m?.name ?? "—";
    } else if (b.plan_kind_used === "package" && b.plan_id_used) {
        const p = SEED_PACKAGES.find(p => p.id === b.plan_id_used);
        planId = b.plan_id_used;
        planName = p?.name ?? "—";
    }
    return {
        id: b.id,
        classScheduleId: b.class_schedule_id,
        customerId: b.customer_id,
        branchId: b.branch_id,
        planId,
        planName,
        planKindUsed: b.plan_kind_used,
        bookingTime: b.booked_at,
        status: b.status,
        attendanceStatus: b.attendance_status,
        cancelledAt: b.cancelled_at,
        cancellationReason: b.cancellation_reason,
        refundCreditIssued: b.refund_credit_issued,
        waitlistPosition: b.waitlist_position,
    };
}

function customerFromSeed(c: SeedCustomer): Customer {
    return {
        id: c.id,
        firstName: c.first_name,
        lastName: c.last_name,
        initials: c.initials,
        email: c.email,
        phone: c.phone,
        branchId: c.branch_id,
        imageUrl: c.image_url,
        planKind: c.plan_kind,
        membershipId: c.membership_id,
        packageIds: c.package_ids,
        planName: c.plan_name,
        createdAt: c.created_at,
    };
}

function ratingFromSeed(r: SeedClassRating): ClassRating {
    return {
        id: r.id,
        classScheduleId: r.class_schedule_id,
        customerId: r.customer_id,
        instructorId: r.instructor_id,
        score: r.score,
        comment: r.comment,
        tags: r.tags,
        submittedAt: r.submitted_at,
        deletedAt: r.deleted_at,
        deletedBy: r.deleted_by,
    };
}

// ─── Initial state — adapt seeds at boot ────────────────────────────────────

const INITIAL_TEMPLATES: ClassTemplate[] = SEED_CLASS_TEMPLATES.map(templateFromSeed);
const INITIAL_SCHEDULES: ClassSchedule[] = SEED_CLASS_SCHEDULE.map(s => scheduleFromSeed(s, INITIAL_TEMPLATES));
const INITIAL_BOOKINGS:  ClassBooking[]  = SEED_CLASS_BOOKINGS.map(bookingFromSeed);
const INITIAL_RATINGS:   ClassRating[]   = SEED_CLASS_RATINGS.map(ratingFromSeed);
const INITIAL_CUSTOMERS: Customer[]      = SEED_CUSTOMERS.map(customerFromSeed);

// ─── Store ──────────────────────────────────────────────────────────────────

interface AppState {
    currentRole: UserRole;
    currentUser: User;
    sidebarCollapsed: boolean;
    classTemplates: ClassTemplate[];
    /** Renamed from `classInstances`. */
    classSchedules: ClassSchedule[];
    classBookings: ClassBooking[];
    classRatings: ClassRating[];
    customers: Customer[];
    pendingPurchase: PendingPurchase | null;
    toast: ToastData | null;

    setRole: (role: UserRole) => void;
    setCurrentUser: (user: User) => void;
    toggleSidebar: () => void;
    setSidebarCollapsed: (collapsed: boolean) => void;

    addClassTemplate: (template: Omit<ClassTemplate, "id">) => void;
    updateClassTemplate: (id: string, updates: Partial<Omit<ClassTemplate, "id">>) => void;
    deleteClassTemplate: (id: string) => void;

    addClassSchedule: (schedule: Omit<ClassSchedule, "id">) => string;
    addClassSchedules: (schedules: Omit<ClassSchedule, "id">[]) => void;
    updateClassSchedule: (id: string, updates: Partial<Omit<ClassSchedule, "id">>) => void;
    cancelClassSchedule: (id: string, refundCredits: boolean) => void;

    cancelClassBooking: (id: string, reason: string, refund: boolean) => void;
    removeClassBooking: (id: string) => void;
    removeClassBookings: (ids: string[]) => void;
    cancelClassBookings: (ids: string[], reason: string, refund: boolean) => void;
    updateAttendance: (bookingId: string, status: ClassBooking["attendanceStatus"]) => void;

    deleteClassRating: (id: string, deletedBy: string) => void;

    addCustomer: (customer: Omit<Customer, "id" | "createdAt" | "initials" | "branchId"> & { initials?: string; branchId?: string }) => string;

    setPendingPurchase: (purchase: PendingPurchase | null) => void;
    applyPurchase: (customerId: string, items: PurchaseLineItem[]) => void;

    showToast: (title: string, message: string, type?: "success" | "error", icon?: ToastData["icon"]) => void;
    clearToast: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    currentRole: "admin",
    currentUser: adminUser,
    sidebarCollapsed: false,
    classTemplates: INITIAL_TEMPLATES,
    classSchedules: INITIAL_SCHEDULES,
    classBookings: INITIAL_BOOKINGS,
    classRatings: INITIAL_RATINGS,
    customers: INITIAL_CUSTOMERS,
    pendingPurchase: null,
    toast: null,

    setRole: (role) => set({ currentRole: role }),
    setCurrentUser: (user) => set({ currentUser: user, currentRole: user.role }),
    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

    addClassTemplate: (template) =>
        set((state) => ({
            classTemplates: [{ ...template, id: `t-${Date.now()}` }, ...state.classTemplates],
        })),
    updateClassTemplate: (id, updates) =>
        set((state) => ({
            classTemplates: state.classTemplates.map(t => t.id === id ? { ...t, ...updates } : t),
        })),
    deleteClassTemplate: (id) =>
        set((state) => ({ classTemplates: state.classTemplates.filter(t => t.id !== id) })),

    addClassSchedule: (schedule) => {
        const id = `cs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((state) => ({ classSchedules: [...state.classSchedules, { ...schedule, id }] }));
        return id;
    },
    addClassSchedules: (schedules) =>
        set((state) => ({
            classSchedules: [
                ...state.classSchedules,
                ...schedules.map((s, i) => ({ ...s, id: `cs-${Date.now()}-${i}` })),
            ],
        })),
    updateClassSchedule: (id, updates) =>
        set((state) => ({
            classSchedules: state.classSchedules.map(s => s.id === id ? { ...s, ...updates } : s),
        })),
    cancelClassSchedule: (id, refundCredits) =>
        set((state) => {
            const now = new Date().toISOString();
            return {
                classSchedules: state.classSchedules.map(s =>
                    s.id === id ? { ...s, status: "Cancelled" as ClassStatus, cancelledAt: now, cancelledBy: "Alex Owen" } : s
                ),
                classBookings: state.classBookings.map(b =>
                    b.classScheduleId === id && b.status === "booked"
                        ? { ...b, status: "cancelled" as const, cancelledAt: now, cancellationReason: "Class cancelled", refundCreditIssued: refundCredits, waitlistPosition: undefined }
                        : b
                ),
            };
        }),

    cancelClassBooking: (id, reason, refund) =>
        set((state) => ({
            classBookings: state.classBookings.map(b =>
                b.id === id ? { ...b, status: "cancelled" as const, cancelledAt: new Date().toISOString(), cancellationReason: reason, refundCreditIssued: refund } : b
            ),
            classSchedules: state.classSchedules.map(s => {
                const booking = state.classBookings.find(b => b.id === id);
                if (booking && booking.status === "booked" && s.id === booking.classScheduleId && s.booked > 0) {
                    return { ...s, booked: s.booked - 1 };
                }
                return s;
            }),
        })),
    cancelClassBookings: (ids, reason, refund) =>
        set((state) => {
            const idSet = new Set(ids);
            const now = new Date().toISOString();
            const targets = state.classBookings.filter(b => idSet.has(b.id));
            const decrementByClass = new Map<string, number>();
            for (const t of targets) {
                if (t.status === "booked") {
                    decrementByClass.set(t.classScheduleId, (decrementByClass.get(t.classScheduleId) ?? 0) + 1);
                }
            }
            return {
                classBookings: state.classBookings.map(b =>
                    idSet.has(b.id)
                        ? { ...b, status: "cancelled" as const, cancelledAt: now, cancellationReason: reason, refundCreditIssued: refund }
                        : b
                ),
                classSchedules: state.classSchedules.map(s => {
                    const dec = decrementByClass.get(s.id);
                    return dec ? { ...s, booked: Math.max(0, s.booked - dec) } : s;
                }),
            };
        }),
    removeClassBooking: (id) =>
        set((state) => {
            const target = state.classBookings.find(b => b.id === id);
            return {
                classBookings: state.classBookings.filter(b => b.id !== id),
                classSchedules: target && target.status === "booked"
                    ? state.classSchedules.map(s =>
                        s.id === target.classScheduleId && s.booked > 0 ? { ...s, booked: s.booked - 1 } : s
                    )
                    : state.classSchedules,
            };
        }),
    removeClassBookings: (ids) =>
        set((state) => {
            const idSet = new Set(ids);
            const decrementByClass = new Map<string, number>();
            for (const b of state.classBookings) {
                if (idSet.has(b.id) && b.status === "booked") {
                    decrementByClass.set(b.classScheduleId, (decrementByClass.get(b.classScheduleId) ?? 0) + 1);
                }
            }
            return {
                classBookings: state.classBookings.filter(b => !idSet.has(b.id)),
                classSchedules: state.classSchedules.map(s => {
                    const dec = decrementByClass.get(s.id);
                    return dec ? { ...s, booked: Math.max(0, s.booked - dec) } : s;
                }),
            };
        }),
    updateAttendance: (bookingId, status) =>
        set((state) => ({
            classBookings: state.classBookings.map(b =>
                b.id === bookingId ? { ...b, attendanceStatus: status } : b
            ),
        })),

    deleteClassRating: (id, deletedBy) =>
        set((state) => ({
            classRatings: state.classRatings.map(r =>
                r.id === id ? { ...r, deletedAt: new Date().toISOString(), deletedBy } : r
            ),
        })),

    addCustomer: (input) => {
        const id = `cu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const initials = input.initials ?? `${input.firstName.charAt(0)}${input.lastName.charAt(0)}`.toUpperCase();
        const customer: Customer = {
            ...input,
            id,
            initials,
            branchId: input.branchId ?? "branch_forma_south",
            createdAt: new Date().toISOString(),
        };
        set((state) => ({ customers: [customer, ...state.customers] }));
        return id;
    },

    setPendingPurchase: (purchase) => set({ pendingPurchase: purchase }),
    applyPurchase: (customerId, items) =>
        set((state) => {
            // Business rule (per CLAUDE.md): 1 membership OR multiple packages — never both.
            const membership = items.find(it => it.productType === "membership");
            const packageItems = items.filter(it => it.productType === "package");
            const planKind: Customer["planKind"] = membership ? "membership" : packageItems.length > 0 ? "package" : null;
            const planName = membership?.name
                ?? (packageItems.length === 1
                    ? packageItems[0].name
                    : packageItems.length > 1
                        ? `${packageItems.reduce((sum, p) => sum + p.quantity, 0)} credit packages`
                        : undefined);
            return {
                customers: state.customers.map(c => {
                    if (c.id !== customerId) return c;
                    if (planKind === "membership" && membership) {
                        // Switching to a membership wipes any previous packages.
                        return { ...c, planKind, planName, membershipId: membership.productId, packageIds: undefined };
                    }
                    if (planKind === "package") {
                        // Merge new packages with whatever the customer already holds
                        // (per CLAUDE.md: customer can hold multiple packages).
                        const existing = c.planKind === "package" ? (c.packageIds ?? []) : [];
                        const merged = Array.from(new Set([...existing, ...packageItems.map(p => p.productId)]));
                        return { ...c, planKind, planName, packageIds: merged, membershipId: undefined };
                    }
                    return { ...c, planKind, planName };
                }),
            };
        }),

    showToast: (title, message, type = "success", icon) =>
        set({ toast: { id: Date.now().toString(), title, message, type, icon } }),
    clearToast: () => set({ toast: null }),
}));
