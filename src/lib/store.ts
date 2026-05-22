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
    business_hours as SEED_BUSINESS_HOURS,
    staff_profiles as SEED_STAFF_PROFILES,
    memberships as SEED_MEMBERSHIPS,
    packages as SEED_PACKAGES,
    gift_card_designs as SEED_GIFT_CARD_DESIGNS,
    issued_gift_cards as SEED_ISSUED_GIFT_CARDS,
    promo_codes as SEED_PROMO_CODES,
    marketing_items as SEED_MARKETING_ITEMS,
    payment_methods as SEED_PAYMENT_METHODS,
    type Customer as SeedCustomer,
    type ClassSchedule as SeedClassSchedule,
    type ClassBooking as SeedClassBooking,
    type ClassRating as SeedClassRating,
    type ClassTemplate as SeedClassTemplate,
    type ClassCategory,
    type Branch,
    type Room,
    type BusinessHours,
    type StaffProfile,
    type Membership,
    type Package,
    type GiftCardDesign,
    type IssuedGiftCard,
    type PromoCode,
    type MarketingItem,
    type PaymentMethod,
    type PurchaseRulesData,
    type DurationUnit,
    type Weekday,
} from "@/data/mock";

// Re-export raw seed types — consumers can read these directly from the store.
export type {
    ClassCategory, Branch, Room, BusinessHours, StaffProfile, Membership, Package, GiftCardDesign, IssuedGiftCard, PromoCode, MarketingItem, PaymentMethod,
    PurchaseRulesData, DurationUnit, Weekday,
};

// Also re-export the raw arrays for screens that filter against the entire table.
export {
    SEED_BRANCHES as BRANCHES,
    SEED_ROOMS as ROOMS,
    SEED_BUSINESS_HOURS as BUSINESS_HOURS,
    SEED_CLASS_CATEGORIES as CLASS_CATEGORIES,
    SEED_MEMBERSHIPS as MEMBERSHIPS,
    SEED_PACKAGES as PACKAGES,
    SEED_GIFT_CARD_DESIGNS as GIFT_CARD_DESIGNS,
    SEED_ISSUED_GIFT_CARDS as ISSUED_GIFT_CARDS,
    SEED_PROMO_CODES as PROMO_CODES,
    SEED_MARKETING_ITEMS as MARKETING_ITEMS,
    SEED_PAYMENT_METHODS as PAYMENT_METHODS,
};

/**
 * Default branch every "branch picker" lands on at first render.
 *
 * Resolves from the `branches` seed:
 *   1. The active branch flagged `is_main: true` (Forma South today)
 *   2. Falls back to the first active branch
 *   3. Falls back to the first branch in the table
 *
 * Centralized so the dashboard, schedule, POS and any future module's branch
 * dropdown all open pre-selecting the same "current" branch. When the Staff
 * & Permissions module lands and branch-scoped users arrive, this becomes
 * the place to swap in the logged-in user's primary branch.
 */
export const DEFAULT_BRANCH_ID: string =
    SEED_BRANCHES.find(b => b.is_main && b.status === "active")?.id
    ?? SEED_BRANCHES.find(b => b.status === "active")?.id
    ?? SEED_BRANCHES[0]?.id
    ?? "";

// ─── business_hours helpers ─────────────────────────────────────────────────
//
// Resolve a branch's open/close window for a given ISO date so the schedule
// form's Start/End time dropdowns AND the day/week grid agree on what's
// inside business hours.

/** Hours window in 24h "HH:mm" strings. `null` when the branch is closed. */
export type HoursWindow = { open: string; close: string } | null;

/** Return the open/close hours for `branchId` on the weekday of `dateISO`. */
export function getBusinessHours(branchId: string, dateISO: string): HoursWindow {
    const d = new Date(dateISO + "T00:00:00Z");
    const dow = d.getUTCDay();
    const row = SEED_BUSINESS_HOURS.find(r => r.branch_id === branchId && r.day_of_week === dow);
    if (!row || row.is_closed) return null;
    return { open: row.open_time, close: row.close_time };
}

/** Union of every branch's open hours for a weekday — used when a view shows
 *  more than one branch and the grid needs the widest envelope.
 *  Returns null only when every branch is closed that weekday. */
export function getUnionBusinessHours(branchIds: string[], dateISO: string): HoursWindow {
    const d = new Date(dateISO + "T00:00:00Z");
    const dow = d.getUTCDay();
    const rows = SEED_BUSINESS_HOURS.filter(r => branchIds.includes(r.branch_id) && r.day_of_week === dow && !r.is_closed);
    if (rows.length === 0) return null;
    const open  = rows.reduce((acc, r) => r.open_time  < acc ? r.open_time  : acc, rows[0].open_time);
    const close = rows.reduce((acc, r) => r.close_time > acc ? r.close_time : acc, rows[0].close_time);
    return { open, close };
}

/** "07:00" → 7, "07:30" → 7.5 — used to drive grid start/end hours. */
export function hourFloatFromTime(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h + (m ?? 0) / 60;
}

/** Build 15-min start-time slots within a business-hours window.
 *
 *  When `durationMin` is supplied, the list is capped at `close - durationMin`
 *  so a class of that length always finishes before the branch closes — i.e.
 *  a 7am–10pm branch + 60min class lists 07:00…21:00 (not 22:00) because
 *  starting at 22:00 would push the end-time past close.
 *
 *  Without `durationMin` the full open→close range is returned. */
export function buildTimeSlots(window: HoursWindow, durationMin?: number): string[] {
    if (!window) return [];
    const [oh, om] = window.open.split(":").map(Number);
    const [ch, cm] = window.close.split(":").map(Number);
    const startMins     = oh * 60 + (om ?? 0);
    const closeMins     = ch * 60 + (cm ?? 0);
    const lastStartMins = durationMin != null ? closeMins - durationMin : closeMins;
    const out: string[] = [];
    for (let mins = startMins; mins <= lastStartMins; mins += 15) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
    return out;
}

// ─── promo_codes helpers ────────────────────────────────────────────────────

/** Cart-summary input to the promo validator. */
export interface PromoValidationCart {
    /** Pre-discount cart subtotal in AED. */
    subtotalAed: number;
    /** Distinct product types currently in the cart. */
    productTypes: ("membership" | "package" | "gift_card")[];
}

export type PromoValidationResult =
    | { ok: true; promo: PromoCode; discountAed: number }
    | { ok: false; reason: string };

/**
 * Validate a typed code against the promo table + the current cart state.
 * `promos` defaults to the static seed; POS passes the LIVE `promoCodes`
 * store slice so created / edited / deactivated promos stay in sync.
 */
export function validatePromoCode(
    rawCode: string,
    cart: PromoValidationCart,
    promos: PromoCode[] = SEED_PROMO_CODES,
): PromoValidationResult {
    const code = rawCode.trim().toUpperCase();
    if (!code) return { ok: false, reason: "Enter a promo code." };
    const promo = promos.find(p => p.code.toUpperCase() === code);
    if (!promo) return { ok: false, reason: "This promo code doesn't exist. Check the code and try again." };
    if (promo.status !== "active") return { ok: false, reason: "This promo code is no longer active." };
    if (promo.valid_until) {
        const today = new Date().toISOString().slice(0, 10);
        if (today > promo.valid_until) {
            const d = new Date(promo.valid_until + "T00:00:00Z");
            const label = `${d.getUTCDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
            return { ok: false, reason: `This promo code expired on ${label}.` };
        }
    }
    if (promo.usage_limit != null && promo.usage_count >= promo.usage_limit) {
        return { ok: false, reason: "This promo code has reached its usage limit." };
    }
    if (promo.applies_to.length > 0 && !cart.productTypes.some(t => promo.applies_to.includes(t))) {
        return { ok: false, reason: "This promo code doesn't apply to the items in your cart." };
    }
    if (promo.min_purchase_aed != null && cart.subtotalAed < promo.min_purchase_aed) {
        return { ok: false, reason: `This promo code requires a minimum purchase of AED ${promo.min_purchase_aed}.` };
    }
    // Compute the AED discount against eligible-line subtotal. For the
    // prototype we apply against the full subtotal — line-level allocation
    // can come when the transactions table ships.
    let discountAed = promo.discount_type === "percentage"
        ? cart.subtotalAed * (promo.discount_value / 100)
        : promo.discount_value;
    if (promo.max_discount_aed != null) discountAed = Math.min(discountAed, promo.max_discount_aed);
    discountAed = Math.min(discountAed, cart.subtotalAed);
    return { ok: true, promo, discountAed: Math.round(discountAed * 100) / 100 };
}

// ─── Role-based POS permissions ─────────────────────────────────────────────
//
// Custom-discount access is role-gated per PRD 05 §2. The prototype's
// `UserRole` type only carries one bucket ("admin"), so we mirror PRD intent
// using the role string the demo switcher exposes today and leave room for
// finer roles when the Staff & Permissions module ships.

/** Can this role apply a custom discount at all? */
export function canApplyCustomDiscount(role: UserRole | string): boolean {
    // Owner + Branch Admin only for now (brief rule 3). Operator gating
    // arrives with the Staff & Permissions module.
    return role === "admin";
}

/** Max custom-discount % this role can apply. 100 = unlimited. */
export function maxCustomDiscountPct(role: UserRole | string): number {
    if (role === "admin") return 100;
    return 0;
}

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

/** Gender restriction on who may book a class. "all" = open to everyone. */
export type GenderAccess = "all" | "female" | "male";

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
    /** Class delivery format — Group / Private / Semi-private. */
    classType: "Group" | "Private" | "Semi-private";
    equipment: string;
    spotSelectionEnabled: boolean;
    /** Spot-grid layout — only set when spot selection is enabled. */
    spotLayout?: { cols: number; rows: number; blockedSpots: string[] };
    waitlistEnabled: boolean;
    rating: number;
    ratingCount: number;
    status: ClassStatus;
    /** Gender restriction on who may book this class. */
    genderAccess: GenderAccess;
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
    /** Class credits left on the current plan. Omitted for unlimited
     *  memberships + no-plan customers; `0` means the plan is exhausted. */
    creditsRemaining?: number;
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
    productType: "membership" | "package" | "gift_card";
    name: string;
    unitPrice: number;
    quantity: number;
    /** Optional metadata for gift-card line items (recipient + message). */
    giftCard?: {
        recipientName: string;
        recipientEmail?: string;
        senderName: string;
        message?: string;
    };
}

export interface PendingPurchase {
    /** Class booking origin — empty when the purchase started from the POS module. */
    classScheduleId: string;
    customerId: string;
    items: PurchaseLineItem[];
    discountPercent: number;
    promoCode?: string;
    /** Where to redirect after the checkout flow completes. Defaults to the
     *  class detail page when classScheduleId is set; POS sets this to "/admin/pos". */
    returnTo?: string;
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
        classType: s.class_type ?? "Group",
        equipment: s.equipment ?? "",
        spotSelectionEnabled: s.spot_selection_enabled ?? false,
        spotLayout: s.spot_layout
            ? { cols: s.spot_layout.cols, rows: s.spot_layout.rows, blockedSpots: s.spot_layout.blocked_spots }
            : undefined,
        waitlistEnabled: s.waitlist_enabled ?? true,
        rating: s.rating,
        ratingCount: s.rating_count,
        status: s.status,
        genderAccess: s.gender_access ?? "all",
        recurrenceGroupId: s.recurrence_group_id,
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
        gender: c.gender,
        creditsRemaining: c.credits_remaining,
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
    /** Live memberships/packages — admins mutate these from /admin/products
     *  and every consumer (POS catalog, class-types Applicable Plans tab,
     *  etc.) reads the updated state. Seeded from `memberships.ts` /
     *  `packages.ts` at boot. */
    memberships: Membership[];
    packages: Package[];
    /** Live gift-card designs. Powered by /admin/products/gift-cards CRUD
     *  and consumed by the POS catalog. */
    giftCardDesigns: GiftCardDesign[];
    /** Live issued gift cards — real cards sold to customers. Drives the
     *  gift-card detail "Active customers" tab + the list view's holder
     *  count / delete gate. */
    issuedGiftCards: IssuedGiftCard[];
    /** Live promo codes — powers the Promo module list/detail (PRD 06 §6). */
    promoCodes: PromoCode[];
    /** Live marketing items — powers the Marketing module list/detail (PRD 08). */
    marketingItems: MarketingItem[];
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

    // ── Memberships ────────────────────────────────────────────────────────
    /** Append a new membership to the store. Generates an id if one is not
     *  provided; returns the resolved id so the caller can route to it. */
    addMembership: (input: Omit<Membership, "id"> & { id?: string }) => string;
    /** Mutate any field on a membership. Used by the Edit flow + status changes. */
    updateMembership: (id: string, patch: Partial<Omit<Membership, "id">>) => void;
    /** Change status (active | inactive | archived). Centralized so all
     *  call-sites land on the same toast + audit pattern later. */
    setMembershipStatus: (ids: string[], status: Membership["status"]) => void;
    /** Hard-delete only allowed when no customer currently holds this plan.
     *  Returns true on success, false if the gate blocks it. */
    deleteMembership: (id: string) => boolean;
    deleteMemberships: (ids: string[]) => { deleted: string[]; blocked: string[] };

    // ── Packages ───────────────────────────────────────────────────────────
    /** Append a new credit package to the store. Same id-handling as
     *  `addMembership`. */
    addPackage: (input: Omit<Package, "id"> & { id?: string }) => string;
    updatePackage: (id: string, patch: Partial<Omit<Package, "id">>) => void;
    setPackageStatus: (ids: string[], status: Package["status"]) => void;
    deletePackage: (id: string) => boolean;
    deletePackages: (ids: string[]) => { deleted: string[]; blocked: string[] };

    // ── Gift card designs ───────────────────────────────────────────────────
    /** Append a new gift-card design. Auto-generates id + created_at when
     *  not supplied. Returns the resolved id so the caller can route to it. */
    addGiftCardDesign: (input: Omit<GiftCardDesign, "id"> & { id?: string }) => string;
    updateGiftCardDesign: (id: string, patch: Partial<Omit<GiftCardDesign, "id">>) => void;
    setGiftCardDesignStatus: (ids: string[], status: GiftCardDesign["status"]) => void;
    deleteGiftCardDesign: (id: string) => boolean;
    deleteGiftCardDesigns: (ids: string[]) => { deleted: string[]; blocked: string[] };

    // ── Issued gift cards ───────────────────────────────────────────────────
    /** Append a new issued gift card (a real card sold to a customer).
     *  Auto-generates id + issued_at when not supplied. Returns the id. */
    addIssuedGiftCard: (input: Omit<IssuedGiftCard, "id"> & { id?: string }) => string;

    // ── Promo codes ─────────────────────────────────────────────────────────
    /** Append a new promo. Auto-generates id + created_at. Returns the id. */
    addPromoCode: (input: Omit<PromoCode, "id"> & { id?: string }) => string;
    updatePromoCode: (id: string, patch: Partial<Omit<PromoCode, "id">>) => void;
    /** Delete a promo. Blocked (returns false) once the code has been redeemed. */
    deletePromoCode: (id: string) => boolean;

    // ── Marketing items ─────────────────────────────────────────────────────
    /** Append a new marketing item. Auto-generates id + created_at. Returns the id. */
    addMarketingItem: (input: Omit<MarketingItem, "id"> & { id?: string }) => string;
    updateMarketingItem: (id: string, patch: Partial<Omit<MarketingItem, "id">>) => void;
    /** Delete a marketing item. Blocked (returns false) once it has any views. */
    deleteMarketingItem: (id: string) => boolean;

    setPendingPurchase: (purchase: PendingPurchase | null) => void;
    applyPurchase: (customerId: string, items: PurchaseLineItem[]) => void;

    showToast: (title: string, message: string, type?: "success" | "error", icon?: ToastData["icon"]) => void;
    clearToast: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
    currentRole: "admin",
    currentUser: adminUser,
    sidebarCollapsed: false,
    classTemplates: INITIAL_TEMPLATES,
    classSchedules: INITIAL_SCHEDULES,
    classBookings: INITIAL_BOOKINGS,
    classRatings: INITIAL_RATINGS,
    customers: INITIAL_CUSTOMERS,
    memberships: [...SEED_MEMBERSHIPS],
    packages: [...SEED_PACKAGES],
    giftCardDesigns: [...SEED_GIFT_CARD_DESIGNS],
    issuedGiftCards: [...SEED_ISSUED_GIFT_CARDS],
    promoCodes: [...SEED_PROMO_CODES],
    marketingItems: [...SEED_MARKETING_ITEMS],
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
        set((state) => {
            const nextTemplates = state.classTemplates.map(t => t.id === id ? { ...t, ...updates } : t);
            // Cascade the fields that schedules denormalize from the template —
            // name, description, category, coverImage, coverColor — so an admin
            // editing a template sees the change reflected on every existing
            // scheduled class that still derives from it. Schedule-level
            // overrides (capacity, equipment, instructor, time) are NOT touched.
            const tpl = nextTemplates.find(t => t.id === id);
            if (!tpl) return { classTemplates: nextTemplates };
            return {
                classTemplates: nextTemplates,
                classSchedules: state.classSchedules.map(s => s.templateId === id ? {
                    ...s,
                    name: tpl.name,
                    description: tpl.description,
                    category: tpl.category,
                    coverImage: tpl.coverImage,
                    coverColor: tpl.coverColor,
                } : s),
            };
        }),
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

    // ── Memberships / Packages ─────────────────────────────────────────────

    addMembership: (input) => {
        const id = input.id ?? `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const next: Membership = {
            ...input,
            id,
            created_at: input.created_at ?? new Date().toISOString(),
        };
        // Append to the END so it shows up at the tail of the list view
        // when sorted by insertion order. Sort columns on the list view
        // will re-order as appropriate.
        set(state => ({ memberships: [...state.memberships, next] }));
        return id;
    },
    updateMembership: (id, patch) =>
        set(state => ({ memberships: state.memberships.map(m => m.id === id ? { ...m, ...patch } : m) })),
    setMembershipStatus: (ids, status) =>
        set(state => {
            const idSet = new Set(ids);
            return { memberships: state.memberships.map(m => idSet.has(m.id) ? { ...m, status } : m) };
        }),
    deleteMembership: (id) => {
        // Block deletion if any customer currently holds this membership.
        // Returns false so the UI can show "X customers still hold this — archive instead".
        const holders = get().customers.some(c => c.planKind === "membership" && c.membershipId === id);
        if (holders) return false;
        set(state => ({ memberships: state.memberships.filter(m => m.id !== id) }));
        return true;
    },
    deleteMemberships: (ids) => {
        const state = get();
        const deleted: string[] = [];
        const blocked: string[] = [];
        for (const id of ids) {
            const holders = state.customers.some(c => c.planKind === "membership" && c.membershipId === id);
            if (holders) blocked.push(id);
            else deleted.push(id);
        }
        if (deleted.length > 0) {
            const deletedSet = new Set(deleted);
            set(s => ({ memberships: s.memberships.filter(m => !deletedSet.has(m.id)) }));
        }
        return { deleted, blocked };
    },

    addPackage: (input) => {
        const id = input.id ?? `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const next: Package = {
            ...input,
            id,
            created_at: input.created_at ?? new Date().toISOString(),
        };
        set(state => ({ packages: [...state.packages, next] }));
        return id;
    },
    updatePackage: (id, patch) =>
        set(state => ({ packages: state.packages.map(p => p.id === id ? { ...p, ...patch } : p) })),
    setPackageStatus: (ids, status) =>
        set(state => {
            const idSet = new Set(ids);
            return { packages: state.packages.map(p => idSet.has(p.id) ? { ...p, status } : p) };
        }),
    deletePackage: (id) => {
        const holders = get().customers.some(c => c.planKind === "package" && (c.packageIds ?? []).includes(id));
        if (holders) return false;
        set(state => ({ packages: state.packages.filter(p => p.id !== id) }));
        return true;
    },
    deletePackages: (ids) => {
        const state = get();
        const deleted: string[] = [];
        const blocked: string[] = [];
        for (const id of ids) {
            const holders = state.customers.some(c => c.planKind === "package" && (c.packageIds ?? []).includes(id));
            if (holders) blocked.push(id);
            else deleted.push(id);
        }
        if (deleted.length > 0) {
            const deletedSet = new Set(deleted);
            set(s => ({ packages: s.packages.filter(p => !deletedSet.has(p.id)) }));
        }
        return { deleted, blocked };
    },

    // ── Gift card designs ──────────────────────────────────────────────────

    addGiftCardDesign: (input) => {
        const id = input.id ?? `gc_design_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const next: GiftCardDesign = {
            ...input,
            id,
            created_at: input.created_at ?? new Date().toISOString(),
        };
        set(state => ({ giftCardDesigns: [...state.giftCardDesigns, next] }));
        return id;
    },
    updateGiftCardDesign: (id, patch) =>
        set(state => ({ giftCardDesigns: state.giftCardDesigns.map(g => g.id === id ? { ...g, ...patch } : g) })),
    setGiftCardDesignStatus: (ids, status) =>
        set(state => {
            const idSet = new Set(ids);
            return { giftCardDesigns: state.giftCardDesigns.map(g => idSet.has(g.id) ? { ...g, status } : g) };
        }),
    deleteGiftCardDesign: (id) => {
        // Block deletion when the design has issued cards on file — those are
        // financial records, so the design can only be archived/deactivated.
        const hasIssued = get().issuedGiftCards.some(c => c.design_id === id);
        if (hasIssued) return false;
        set(state => ({ giftCardDesigns: state.giftCardDesigns.filter(g => g.id !== id) }));
        return true;
    },
    deleteGiftCardDesigns: (ids) => {
        const state = get();
        const deleted: string[] = [];
        const blocked: string[] = [];
        for (const id of ids) {
            if (state.issuedGiftCards.some(c => c.design_id === id)) blocked.push(id);
            else deleted.push(id);
        }
        if (deleted.length > 0) {
            const deletedSet = new Set(deleted);
            set(s => ({ giftCardDesigns: s.giftCardDesigns.filter(g => !deletedSet.has(g.id)) }));
        }
        return { deleted, blocked };
    },

    // ── Issued gift cards ──────────────────────────────────────────────────

    addIssuedGiftCard: (input) => {
        const id = input.id ?? `issued_gc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const next: IssuedGiftCard = {
            ...input,
            id,
            issued_at: input.issued_at ?? new Date().toISOString(),
        };
        set(state => ({ issuedGiftCards: [...state.issuedGiftCards, next] }));
        return id;
    },

    // ── Promo codes ────────────────────────────────────────────────────────

    addPromoCode: (input) => {
        const id = input.id ?? `promo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const next: PromoCode = {
            ...input,
            id,
            created_at: input.created_at ?? new Date().toISOString(),
        };
        set(state => ({ promoCodes: [...state.promoCodes, next] }));
        return id;
    },
    updatePromoCode: (id, patch) =>
        set(state => ({ promoCodes: state.promoCodes.map(p => p.id === id ? { ...p, ...patch } : p) })),
    deletePromoCode: (id) => {
        // Block deletion once the code has been redeemed — archive instead so
        // the financial trail survives. Returns false so the UI can explain.
        const promo = get().promoCodes.find(p => p.id === id);
        if (promo && promo.usage_count > 0) return false;
        set(state => ({ promoCodes: state.promoCodes.filter(p => p.id !== id) }));
        return true;
    },

    addMarketingItem: (input) => {
        const id = input.id ?? `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const next: MarketingItem = {
            ...input,
            id,
            created_at: input.created_at ?? new Date().toISOString(),
        };
        set(state => ({ marketingItems: [...state.marketingItems, next] }));
        return id;
    },
    updateMarketingItem: (id, patch) =>
        set(state => ({ marketingItems: state.marketingItems.map(m => m.id === id ? { ...m, ...patch } : m) })),
    deleteMarketingItem: (id) => {
        // Block deletion once the item has been seen — archive instead so the
        // analytics trail survives (PRD 08 §8.4 — delete only at 0 views).
        const item = get().marketingItems.find(m => m.id === id);
        if (item && item.view_count > 0) return false;
        set(state => ({ marketingItems: state.marketingItems.filter(m => m.id !== id) }));
        return true;
    },

    setPendingPurchase: (purchase) => set({ pendingPurchase: purchase }),
    applyPurchase: (customerId, items) =>
        set((state) => {
            // Business rule (per CLAUDE.md): 1 membership OR multiple packages — never both.
            const membership = items.find(it => it.productType === "membership");
            const packageItems = items.filter(it => it.productType === "package");
            const giftCardItems = items.filter(it => it.productType === "gift_card");
            const planKind: Customer["planKind"] = membership ? "membership" : packageItems.length > 0 ? "package" : null;
            const planName = membership?.name
                ?? (packageItems.length === 1
                    ? packageItems[0].name
                    : packageItems.length > 1
                        ? `${packageItems.reduce((sum, p) => sum + p.quantity, 0)} credit packages`
                        : undefined);
            // Credits the purchase grants. A numbered membership contributes
            // its credit count; an unlimited membership has no cap. Each
            // package contributes `credits × quantity`.
            const membershipCredits = membership
                ? state.memberships.find(m => m.id === membership.productId)?.credits
                : undefined;
            const packageCreditsAdded = packageItems.reduce((sum, pi) => {
                const pkg = state.packages.find(p => p.id === pi.productId);
                return sum + (typeof pkg?.credits === "number" ? pkg.credits * pi.quantity : 0);
            }, 0);

            // ─── Customer plan update ──────────────────────────────────────
            const customers = state.customers.map(c => {
                if (c.id !== customerId) return c;
                if (planKind === "membership" && membership) {
                    // Switching to a membership wipes any previous packages.
                    // creditsRemaining → the membership's credit count, or
                    // cleared for an unlimited membership (no credit cap).
                    return {
                        ...c, planKind, planName,
                        membershipId: membership.productId, packageIds: undefined,
                        creditsRemaining: typeof membershipCredits === "number" ? membershipCredits : undefined,
                    };
                }
                if (planKind === "package") {
                    // Merge new packages with whatever the customer already holds
                    // (per CLAUDE.md: customer can hold multiple packages).
                    const existing = c.planKind === "package" ? (c.packageIds ?? []) : [];
                    const merged = Array.from(new Set([...existing, ...packageItems.map(p => p.productId)]));
                    // Packages stack — add to any credits the customer still holds.
                    const existingCredits = c.planKind === "package" ? (c.creditsRemaining ?? 0) : 0;
                    return {
                        ...c, planKind, planName,
                        packageIds: merged, membershipId: undefined,
                        creditsRemaining: existingCredits + packageCreditsAdded,
                    };
                }
                // Gift-card-only purchase — leave the customer's existing plan
                // untouched (buying a gift card must not wipe their membership).
                return c;
            });

            // ─── Gift-card issuance ────────────────────────────────────────
            // Each gift-card line item spawns one `issued_gift_cards` row per
            // unit — a fresh full-balance card carrying the buyer's
            // recipient / sender / message captured at POS.
            const newIssued: IssuedGiftCard[] = [];
            for (const it of giftCardItems) {
                const design = state.giftCardDesigns.find(g => g.id === it.productId);
                for (let q = 0; q < Math.max(1, it.quantity); q++) {
                    const issuedAt = new Date();
                    const expires = new Date(issuedAt);
                    if (design?.no_expiry) expires.setFullYear(expires.getFullYear() + 100);
                    else expires.setDate(expires.getDate() + (design?.validity_days || 365));
                    newIssued.push({
                        id: `issued_gc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${q}`,
                        design_id: it.productId,
                        customer_id: customerId,
                        code: `GC-${issuedAt.getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
                        face_value_aed: it.unitPrice,
                        current_balance_aed: it.unitPrice,
                        issued_at: issuedAt.toISOString(),
                        expires_at: expires.toISOString(),
                        status: "active",
                        recipient_name: it.giftCard?.recipientName,
                        recipient_email: it.giftCard?.recipientEmail,
                        sender_name: it.giftCard?.senderName,
                        message: it.giftCard?.message,
                    });
                }
            }

            return {
                customers,
                ...(newIssued.length > 0
                    ? { issuedGiftCards: [...state.issuedGiftCards, ...newIssued] }
                    : {}),
            };
        }),

    showToast: (title, message, type = "success", icon) =>
        set({ toast: { id: Date.now().toString(), title, message, type, icon } }),
    clearToast: () => set({ toast: null }),
}));
