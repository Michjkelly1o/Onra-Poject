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
    pay_rates as SEED_PAY_RATES,
    instructors as SEED_INSTRUCTORS,
    roles as SEED_ROLES,
    DEFAULT_PERMISSIONS_BY_TYPE as SEED_DEFAULT_PERMISSIONS_BY_TYPE,
    DEFAULT_GRANT_LIMITS as SEED_DEFAULT_GRANT_LIMITS,
    staff as SEED_STAFF,
    payroll_entries as SEED_PAYROLL_ENTRIES,
    customer_plans as SEED_CUSTOMER_PLANS,
    customer_transactions as SEED_CUSTOMER_TRANSACTIONS,
    customer_agreements as SEED_CUSTOMER_AGREEMENTS,
    customer_referrals as SEED_CUSTOMER_REFERRALS,
    type Customer as SeedCustomer,
    type CustomerPlan as SeedCustomerPlan,
    type CustomerTransaction as SeedCustomerTransaction,
    type CustomerAgreement as SeedCustomerAgreement,
    type CustomerReferral as SeedCustomerReferral,
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
    type PayRateSeed,
    type InstructorSeed,
    type RoleSeed,
    type RoleTypeSeed,
    type RoleStatusSeed,
    type StaffSeed,
    type StaffStatusSeed,
    type PermissionsMapSeed,
    type PermissionCellSeed,
    type PermissionRowSeed,
    type GrantLimitsSeed,
    type PayRateHybridConditionSeed,
    type PayrollEntrySeed,
    type PayrollEntryStatusSeed,
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
    /** Per-line breakdown. When provided, the validator restricts a promo to
     *  only the products it targets (`applies_to_product_ids`) and computes
     *  the discount against the eligible lines alone. Without it the check
     *  falls back to the cart-level type list. */
    lines?: { productId: string; kind: "membership" | "package" | "gift_card"; lineTotal: number }[];
    /** Branch the sale happens at — gates branch-scoped promos. Empty /
     *  undefined (e.g. "All locations") skips branch gating. */
    branchId?: string;
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
        // `valid_until` may be a full ISO datetime ("2025-12-31T00:00:00Z")
        // from the seed OR a bare date ("2025-12-31") from the create form —
        // parse it directly so we never double-append a time and produce an
        // Invalid Date (which previously rendered as "NaN undefined NaN").
        const expiry = new Date(promo.valid_until);
        if (!Number.isNaN(expiry.getTime()) && Date.now() > expiry.getTime()) {
            const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const label = `${expiry.getUTCDate()} ${MONTHS[expiry.getUTCMonth()]} ${expiry.getUTCFullYear()}`;
            return { ok: false, reason: `This promo code expired on ${label}.` };
        }
    }
    if (promo.usage_limit != null && promo.usage_count >= promo.usage_limit) {
        return { ok: false, reason: "This promo code has reached its usage limit." };
    }
    // Branch scope — empty `branch_ids` means "all branches". Only enforce
    // when the sale carries a specific branch (POS "All locations" = skip).
    if (promo.branch_ids && promo.branch_ids.length > 0 && cart.branchId
        && !promo.branch_ids.includes(cart.branchId)) {
        return { ok: false, reason: "This promo code isn't available at the selected branch." };
    }

    // Eligibility — a line qualifies when it passes BOTH the product-type
    // filter (`applies_to`) AND the specific-product filter
    // (`applies_to_product_ids`). Empty filters mean "applies to all". This is
    // the gate the promo's "Applicable products" / visibility settings feed:
    // products the admin didn't select are NOT discounted, even though they
    // share the same type.
    const allowedTypes = promo.applies_to ?? [];
    const allowedProductIds = promo.applies_to_product_ids ?? [];
    const lineEligible = (kind: "membership" | "package" | "gift_card", productId: string): boolean => {
        if (allowedTypes.length > 0 && !allowedTypes.includes(kind)) return false;
        if (allowedProductIds.length > 0 && !allowedProductIds.includes(productId)) return false;
        return true;
    };

    // Eligible subtotal — with line detail the discount applies only to
    // qualifying lines; without it we fall back to the cart-level type list.
    let eligibleSubtotal: number;
    if (cart.lines) {
        eligibleSubtotal = cart.lines
            .filter(l => lineEligible(l.kind, l.productId))
            .reduce((s, l) => s + l.lineTotal, 0);
    } else {
        const typeOk = allowedTypes.length === 0 || cart.productTypes.some(t => allowedTypes.includes(t));
        // Without line detail we can't enforce product-id targeting, so a
        // product-scoped promo is treated as not-applicable here.
        eligibleSubtotal = (typeOk && allowedProductIds.length === 0) ? cart.subtotalAed : 0;
    }
    if (eligibleSubtotal <= 0) {
        return { ok: false, reason: "This promo code doesn't apply to the items in your cart." };
    }

    if (promo.min_purchase_aed != null && cart.subtotalAed < promo.min_purchase_aed) {
        return { ok: false, reason: `This promo code requires a minimum purchase of AED ${promo.min_purchase_aed}.` };
    }
    // Discount comes off the ELIGIBLE subtotal only — so a promo targeting
    // one membership never discounts the rest of the cart.
    let discountAed = promo.discount_type === "percentage"
        ? eligibleSubtotal * (promo.discount_value / 100)
        : promo.discount_value;
    if (promo.max_discount_aed != null) discountAed = Math.min(discountAed, promo.max_discount_aed);
    discountAed = Math.min(discountAed, eligibleSubtotal);
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

/** Status for a directory instructor. Mirrors the customer/staff status model:
 *  active → working; inactive → temporary leave; archive → left the studio. */
export type InstructorStatus = "active" | "inactive" | "archive";

/** Full instructor record — extends ScheduleInstructor with the contact +
 *  pay rate relationship needed by the pay rate detail page ("Assigned
 *  instructor" tab) and (eventually) the staff module. */
export interface Instructor extends ScheduleInstructor {
    email: string;
    phone: string;
    /** Pre-formatted "Feb 1, 2024" string for the table. */
    joinedDate: string;
    branchId: string;
    /** FK → payRates.id. Nullable when the instructor has no rate assigned. */
    payRateId?: string;
    status: InstructorStatus;
}

// ─── Roles & permissions (Staff & Permissions module — PRD 10 §5) ──────────
//
// Mirror of `RoleSeed` in camelCase. Roles drive the Staff & Permissions
// list page (Roles tab), the role detail page, every staff member's
// permission shape, and the customer module's add-complimentary-credit
// limits (via grantLimits).

export type RoleType   = RoleTypeSeed;
export type RoleStatus = RoleStatusSeed;
export type PermissionCell = PermissionCellSeed;
export type PermissionRow  = PermissionRowSeed;
export type PermissionsMap  = PermissionsMapSeed;
/** Camel-cased mirror of `GrantLimitsSeed`. Per-row enabled flags carry the
 *  same defaults — undefined treated as "enabled when section is on". */
export interface GrantLimits {
    enabled: boolean;
    unlimited: boolean;
    grants_per_month: number;
    grants_per_month_enabled?: boolean;
    max_grant_value_aed: number;
    max_grant_value_enabled?: boolean;
    allow_remove_unused: boolean;
}

export interface Role {
    id: string;
    name: string;
    description: string;
    type: RoleType;
    /** Branch FK — null for Owner (all-locations scope). */
    branchId: string | null;
    status: RoleStatus;
    grantLimits: GrantLimits;
    permissions: PermissionsMap;
    /** Locked rows (Owner) can't be edited or deactivated. */
    locked: boolean;
    createdAt?: string;
    archivedAt?: string;
}

/** Re-exports of the type-template helpers so consumers (the create-role
 *  form, the edit-permissions wizard) can copy the predefined matrix at
 *  insert time without re-importing from the seed barrel directly. */
export const DEFAULT_PERMISSIONS_BY_TYPE = SEED_DEFAULT_PERMISSIONS_BY_TYPE;
export const DEFAULT_GRANT_LIMITS        = SEED_DEFAULT_GRANT_LIMITS;
// Permission section + module ordering (lives in permission_templates.ts).
export {
    STAFF_PERMISSION_SECTIONS,
    INSTRUCTOR_PERMISSION_SECTIONS,
    permissionSectionsFor,
} from "@/data/mock/permission_templates";
export type {
    PermissionSectionSpec,
    PermissionModuleSpec,
} from "@/data/mock/permission_templates";

// ─── Staff (PRD 10 §3 + PRD 01 §10) ────────────────────────────────────────
//
// Camel-case mirror of `StaffSeed`. One row per person with system access.
// Instructor-specific fields (bio / specialties / payRateId) live as optional
// columns and only render when role.type === "instructor".

export type StaffStatus = StaffStatusSeed;

export interface Staff {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone: string;
    imageUrl?: string;
    initials: string;
    color: string;
    roleId: string;
    branchId: string | null;
    status: StaffStatus;
    tempPassword?: string;
    inviteSentAt?: string;
    firstLoginCompleted: boolean;
    joinedDate: string;
    bio?: string;
    specialties?: string[];
    payRateId?: string;
}

/** Payroll entry — one row per (instructor, period). Camel-case mirror of
 *  PayrollEntrySeed; the store drives the compensation list page and (later)
 *  the Run Payroll + instructor-earnings detail pages. */
export type PayrollEntryStatus = PayrollEntryStatusSeed;

export interface PayrollEntry {
    id: string;
    instructorId: string;
    branchId: string;
    payRateId: string;
    /** Display snapshot — pay rate's name as of entry creation. */
    payRateName: string;
    /** ISO yyyy-mm-dd. */
    periodStart: string;
    periodEnd: string;
    classesCount: number;
    totalAttendees: number;
    /** Sum of class durations in hours — "Total time (hour)" column. */
    totalHours: number;
    /** Studio revenue from those classes (AED) — "Gross revenue" column. */
    grossRevenue: number;
    baseEarnings: number;
    adjustmentAmount: number;
    adjustmentReason?: string;
    totalEarnings: number;
    status: PayrollEntryStatus;
    /** Set once a payroll run confirms this entry. */
    payrollRunId?: string;
    createdAt?: string;
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
    /** Class delivery format — Group / Private. */
    classType: "Group" | "Private";
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
    /** Account lifecycle status — `active` / `inactive` (suspended) /
     *  `archived` (hidden from default list). Drives the customer-list status
     *  badge, the Status filter, and which row/bulk actions are available. */
    status: "active" | "inactive" | "archived";
    /** Most recent attended-class date (ISO `YYYY-MM-DD`). Omitted when the
     *  customer has never visited. */
    lastVisitISO?: string;
    /** Current plan's expiry date (ISO `YYYY-MM-DD`). Omitted for no-plan
     *  customers. Drives the "Plan expiry date range" filter. */
    planExpiryISO?: string;
    // Optional Module-07 fields — set by the customer-create form + the seed.
    dateOfBirth?: string;
    gender?: string;
    country?: string;
    state?: string;
    city?: string;
    postalCode?: string;
    streetAddress?: string;
    // Profile-detail fields surfaced on the customer-detail "Details" tab.
    googleConnected?: boolean;
    marketingEmails?: boolean;
    marketingSms?: boolean;
    transactionalEmails?: boolean;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelation?: string;
    referralCode?: string;
}

/** Customer agreement record — store shape (camelCase) of a
 *  `customer_agreements` row. Drives the customer-detail Agreements tab. */
export interface CustomerAgreement {
    id: string;
    customerId: string;
    title: string;
    version: number;
    branchId: string;
    classTemplateIds: string[];
    status: "signed" | "unsigned";
    signedAtISO?: string;
}

/** Customer referral record — store shape (camelCase) of a
 *  `customer_referrals` row. Drives the customer-detail Referrals tab. */
export interface CustomerReferral {
    id: string;
    referrerCustomerId: string;
    referredName: string;
    referredEmail: string;
    benefitCredits: number;
    referredAtISO: string;
}

/** Customer plan record — store shape (camelCase) of a `customer_plans` row.
 *  One per purchased membership / package or complimentary grant; drives the
 *  customer-detail Plan tab + its freeze / unfreeze / cancel / remove actions. */
export interface CustomerPlan {
    id: string;
    customerId: string;
    kind: "membership" | "package" | "complimentary";
    productId?: string;
    name: string;
    planTypeLabel: string;
    creditsLabel: string;
    status: "active" | "expired" | "frozen" | "cancelled" | "removed";
    purchasedAtISO: string;
    expiryISO: string;
    priceAed?: number;
    freezeStartISO?: string;
    freezeEndISO?: string;
    freeCredits?: number;
    grantReason?: string;
    grantIssuedBy?: string;
    grantIssuedRole?: string;
    cancelMode?: "today" | "period_end";
    cancelReason?: string;
    cancelledAtISO?: string;
    removeReason?: string;
    removedBy?: string;
    removedByRole?: string;
    removedAtISO?: string;
}

/** Customer transaction record — store shape (camelCase) of a
 *  `customer_transactions` row. One per membership / package payment; drives
 *  the customer-detail Payments tab (Overview metrics + history table). */
export interface CustomerTransaction {
    id: string;
    customerId: string;
    branchId: string;
    kind: "membership" | "package";
    productId: string;
    name: string;
    amountAed: number;
    status: "complete" | "pending" | "failed" | "refunded";
    paymentMethod: "card" | "cash";
    createdAtISO: string;
    refundedAtISO?: string;
    refundMethod?: "cash" | "card";
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
    /** Promo discount as a flat AED amount (promos can be percentage- OR
     *  fixed-value, so we carry the resolved AED figure rather than a
     *  percent). Kept separate from `discountPercent`, which is the
     *  custom-discount lever. */
    promoDiscountAed?: number;
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
        status: c.status,
        lastVisitISO: c.last_visit_iso,
        planExpiryISO: c.plan_expiry_iso,
        dateOfBirth: c.date_of_birth,
        country: c.country,
        state: c.state,
        city: c.city,
        postalCode: c.postal_code,
        streetAddress: c.street_address,
        googleConnected: c.google_connected,
        marketingEmails: c.marketing_emails,
        marketingSms: c.marketing_sms,
        transactionalEmails: c.transactional_emails,
        emergencyContactName: c.emergency_contact_name,
        emergencyContactPhone: c.emergency_contact_phone,
        emergencyContactRelation: c.emergency_contact_relation,
        referralCode: c.referral_code,
    };
}

function customerReferralFromSeed(r: SeedCustomerReferral): CustomerReferral {
    return {
        id: r.id,
        referrerCustomerId: r.referrer_customer_id,
        referredName: r.referred_name,
        referredEmail: r.referred_email,
        benefitCredits: r.benefit_credits,
        referredAtISO: r.referred_at,
    };
}

function customerAgreementFromSeed(a: SeedCustomerAgreement): CustomerAgreement {
    return {
        id: a.id,
        customerId: a.customer_id,
        title: a.title,
        version: a.version,
        branchId: a.branch_id,
        classTemplateIds: a.class_template_ids,
        status: a.status,
        signedAtISO: a.signed_at,
    };
}

function customerPlanFromSeed(p: SeedCustomerPlan): CustomerPlan {
    return {
        id: p.id,
        customerId: p.customer_id,
        kind: p.kind,
        productId: p.product_id,
        name: p.name,
        planTypeLabel: p.plan_type_label,
        creditsLabel: p.credits_label,
        status: p.status,
        purchasedAtISO: p.purchased_at,
        expiryISO: p.expiry_iso,
        priceAed: p.price_aed,
        freezeStartISO: p.freeze_start_iso,
        freezeEndISO: p.freeze_end_iso,
        freeCredits: p.free_credits,
        grantReason: p.grant_reason,
        grantIssuedBy: p.grant_issued_by,
        grantIssuedRole: p.grant_issued_role,
        cancelMode: p.cancel_mode,
        cancelReason: p.cancel_reason,
        cancelledAtISO: p.cancelled_at,
        removeReason: p.remove_reason,
        removedBy: p.removed_by,
        removedByRole: p.removed_by_role,
        removedAtISO: p.removed_at,
    };
}

function customerTransactionFromSeed(t: SeedCustomerTransaction): CustomerTransaction {
    return {
        id: t.id,
        customerId: t.customer_id,
        branchId: t.branch_id,
        kind: t.kind,
        productId: t.product_id,
        name: t.name,
        amountAed: t.amount_aed,
        status: t.status,
        paymentMethod: t.payment_method,
        createdAtISO: t.created_at,
        refundedAtISO: t.refunded_at,
        refundMethod: t.refund_method,
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

// ─── Pay rate (PRD 10 §6) — types + seed + display helper ───────────────────
//
// Pay rates are a discriminated union by `type`. The variant carries the
// fields the payroll engine needs to compute earnings:
//   • flat     — single AED amount per class
//   • tiered   — list of (from, to, amount) rules over attendee count
//   • revenue  — % split of class revenue (+ optional per-customer top-up)
//   • hybrid   — base AED + bonus_attendance (Once N → AED Y/customer) OR
//                base AED + revenue (% split)
//   • monthly  — fixed monthly salary + optional performance bonus + optional
//                sales commission on Packages / Memberships
//
// `branchId` is single per the existing list shape. Status is active/archive
// only — pay rates have no inactive state (PRD 10 §6.1).

export type PayRateStatus = "active" | "archive";
export type PayRateType = "flat" | "tiered" | "revenue" | "hybrid" | "monthly";

export interface PayRateTier {
    id: string;
    from: number;
    to: number;
    /** AED amount paid when attendee count falls in [from, to]. */
    aed: number;
}

export type PayRateHybridCondition =
    | { kind: "bonus_attendance"; bonusThreshold: number; bonusPerCustomer: number }
    | { kind: "revenue"; splitPercent: number };

interface PayRateBase {
    id: string;
    name: string;
    branchId: string;
    status: PayRateStatus;
    /** Toggle — "Only count checked-in customers" (false = count all booked). */
    onlyCheckedIn?: boolean;
    /** Toggle — "Include late-cancelled customers" (false = exclude). */
    includeLateCancelled?: boolean;
    /** Staff assignments + payroll uses — gates Delete (only when 0). */
    usageCount: number;
    createdAt?: string;
}

export interface FlatPayRate    extends PayRateBase { type: "flat";    flatAmount: number }
export interface TieredPayRate  extends PayRateBase { type: "tiered";  tiers: PayRateTier[] }
export interface RevenuePayRate extends PayRateBase { type: "revenue"; splitPercent: number; payPerCustomer?: number }
export interface HybridPayRate  extends PayRateBase { type: "hybrid";  baseRate: number; condition: PayRateHybridCondition }
export interface MonthlyPayRate extends PayRateBase {
    type: "monthly";
    fixedSalary: number;
    /** "Bonus of monthly salary" — % of fixedSalary. */
    bonusOfSalaryPercent?: number;
    /** Optional AED cap on the bonus. */
    bonusCap?: number;
    /** Sales commission % on Packages product sales. */
    salesCommissionPackagesPercent?: number;
    /** Sales commission % on Memberships product sales. */
    salesCommissionMembershipsPercent?: number;
}

export type PayRate = FlatPayRate | TieredPayRate | RevenuePayRate | HybridPayRate | MonthlyPayRate;

/** Derived list-row display strings. Computed live so the rate column
 *  always reflects the underlying structured data. */
export function computePayRateDisplay(p: PayRate): { main: string; subtitle: string } {
    const aed = (n: number) => `AED ${n.toLocaleString("en-US")}`;
    switch (p.type) {
        case "flat":
            return { main: aed(p.flatAmount), subtitle: "per class" };
        case "tiered": {
            const amounts = p.tiers.map(t => t.aed);
            const lo = Math.min(...amounts);
            const hi = Math.max(...amounts);
            const main = lo === hi ? aed(lo) : `${aed(lo)} – ${hi.toLocaleString("en-US")}`;
            return { main, subtitle: `${p.tiers.length} tier${p.tiers.length === 1 ? "" : "s"} based on attendance` };
        }
        case "revenue":
            return { main: `${p.splitPercent}%`, subtitle: "of total class revenue" };
        case "hybrid":
            if (p.condition.kind === "bonus_attendance") {
                return {
                    main: `${aed(p.baseRate)} + ${aed(p.condition.bonusPerCustomer)}`,
                    subtitle: `AED ${p.condition.bonusPerCustomer.toLocaleString("en-US")} applies after ${p.condition.bonusThreshold} customers`,
                };
            }
            return {
                main: `${aed(p.baseRate)} + ${p.condition.splitPercent}%`,
                subtitle: "base per class + revenue share",
            };
        case "monthly":
            return { main: aed(p.fixedSalary), subtitle: "per month" };
    }
}

// ─── Adapters (snake_case seed → camelCase store shape) ────────────────────
//
// These keep the store's runtime shape ergonomic for React components while
// preserving the Supabase-ready snake_case shape in src/data/mock/. Each
// adapter mirrors a single seed file so a future Postgres migration is a
// straight CSV/SQL export.

function payRateConditionFromSeed(c: PayRateHybridConditionSeed): PayRateHybridCondition {
    if (c.kind === "bonus_attendance") {
        return { kind: "bonus_attendance", bonusThreshold: c.bonus_threshold, bonusPerCustomer: c.bonus_per_customer };
    }
    return { kind: "revenue", splitPercent: c.split_percent };
}

function payRateFromSeed(p: PayRateSeed): PayRate {
    const baseShared = {
        id: p.id,
        name: p.name,
        branchId: p.branch_id,
        status: p.status,
        onlyCheckedIn: p.only_checked_in,
        includeLateCancelled: p.include_late_cancelled,
        usageCount: p.usage_count,
        createdAt: p.created_at,
    };
    switch (p.type) {
        case "flat":
            return { ...baseShared, type: "flat", flatAmount: p.flat_amount };
        case "tiered":
            return { ...baseShared, type: "tiered", tiers: p.tiers };
        case "revenue":
            return {
                ...baseShared, type: "revenue",
                splitPercent: p.split_percent,
                payPerCustomer: p.pay_per_customer,
            };
        case "hybrid":
            return {
                ...baseShared, type: "hybrid",
                baseRate: p.base_rate,
                condition: payRateConditionFromSeed(p.condition),
            };
        case "monthly":
            return {
                ...baseShared, type: "monthly",
                fixedSalary: p.fixed_salary,
                bonusOfSalaryPercent: p.bonus_of_salary_percent,
                bonusCap: p.bonus_cap,
                salesCommissionPackagesPercent: p.sales_commission_packages_percent,
                salesCommissionMembershipsPercent: p.sales_commission_memberships_percent,
            };
    }
}

function instructorFromSeed(i: InstructorSeed): Instructor {
    return {
        id: i.id,
        name: i.full_name,
        initials: i.initials,
        color: i.color_hex,
        imageUrl: i.image_url,
        email: i.email,
        phone: i.phone,
        joinedDate: i.joined_date,
        branchId: i.branch_id,
        payRateId: i.pay_rate_id,
        status: i.status,
    };
}

function roleFromSeed(r: RoleSeed): Role {
    return {
        id: r.id,
        name: r.name,
        description: r.description,
        type: r.type,
        branchId: r.branch_id,
        status: r.status,
        grantLimits: r.grant_limits,
        permissions: r.permissions,
        locked: r.locked,
        createdAt: r.created_at,
        archivedAt: r.archived_at,
    };
}

function staffFromSeed(s: StaffSeed): Staff {
    return {
        id: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        fullName: s.full_name,
        email: s.email,
        phone: s.phone,
        imageUrl: s.image_url,
        initials: s.initials,
        color: s.color_hex,
        roleId: s.role_id,
        branchId: s.branch_id,
        status: s.status,
        tempPassword: s.temp_password,
        inviteSentAt: s.invite_sent_at,
        firstLoginCompleted: s.first_login_completed,
        joinedDate: s.joined_date,
        bio: s.bio,
        specialties: s.specialties,
        payRateId: s.pay_rate_id,
    };
}

function payrollEntryFromSeed(e: PayrollEntrySeed): PayrollEntry {
    return {
        id: e.id,
        instructorId: e.instructor_id,
        branchId: e.branch_id,
        payRateId: e.pay_rate_id,
        payRateName: e.pay_rate_name,
        periodStart: e.period_start,
        periodEnd: e.period_end,
        classesCount: e.classes_count,
        totalAttendees: e.total_attendees,
        totalHours: e.total_hours,
        grossRevenue: e.gross_revenue,
        baseEarnings: e.base_earnings,
        adjustmentAmount: e.adjustment_amount,
        adjustmentReason: e.adjustment_reason,
        totalEarnings: e.total_earnings,
        status: e.status,
        payrollRunId: e.payroll_run_id,
        createdAt: e.created_at,
    };
}

const INITIAL_PAY_RATES:        PayRate[]        = SEED_PAY_RATES.map(payRateFromSeed);
const INITIAL_INSTRUCTORS:      Instructor[]     = SEED_INSTRUCTORS.map(instructorFromSeed);
const INITIAL_PAYROLL_ENTRIES:  PayrollEntry[]   = SEED_PAYROLL_ENTRIES.map(payrollEntryFromSeed);
const INITIAL_ROLES:            Role[]           = SEED_ROLES.map(roleFromSeed);
const INITIAL_STAFF:            Staff[]          = SEED_STAFF.map(staffFromSeed);

// ─── Initial state — adapt seeds at boot ────────────────────────────────────

const INITIAL_TEMPLATES: ClassTemplate[] = SEED_CLASS_TEMPLATES.map(templateFromSeed);
const INITIAL_SCHEDULES: ClassSchedule[] = SEED_CLASS_SCHEDULE.map(s => scheduleFromSeed(s, INITIAL_TEMPLATES));
const INITIAL_BOOKINGS:  ClassBooking[]  = SEED_CLASS_BOOKINGS.map(bookingFromSeed);
const INITIAL_RATINGS:   ClassRating[]   = SEED_CLASS_RATINGS.map(ratingFromSeed);
const INITIAL_CUSTOMERS: Customer[]      = SEED_CUSTOMERS.map(customerFromSeed);
const INITIAL_CUSTOMER_PLANS: CustomerPlan[] = SEED_CUSTOMER_PLANS.map(customerPlanFromSeed);
const INITIAL_CUSTOMER_TRANSACTIONS: CustomerTransaction[] = SEED_CUSTOMER_TRANSACTIONS.map(customerTransactionFromSeed);
const INITIAL_CUSTOMER_AGREEMENTS: CustomerAgreement[] = SEED_CUSTOMER_AGREEMENTS.map(customerAgreementFromSeed);
const INITIAL_CUSTOMER_REFERRALS: CustomerReferral[] = SEED_CUSTOMER_REFERRALS.map(customerReferralFromSeed);

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
    /** Customer plan records — the customer-detail Plan tab reads + mutates these. */
    customerPlans: CustomerPlan[];
    /** Customer transaction records — the customer-detail Payments tab reads
     *  these (Overview metrics + history table) and mutates them on refund. */
    customerTransactions: CustomerTransaction[];
    /** Customer agreement records — the customer-detail Agreements tab reads these. */
    customerAgreements: CustomerAgreement[];
    /** Customer referral records — the customer-detail Referrals tab reads these. */
    customerReferrals: CustomerReferral[];
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
    /** Live pay rates — powers /admin/staff/pay-rate list/detail/payroll (PRD 10 §6). */
    payRates: PayRate[];
    /** Live instructors — the pay rate detail page's "Assigned instructor" tab
     *  filters this by `payRateId`. The staff module (PRD 10 §3) will own the
     *  fuller list; this slice is the minimum surface for cross-module sync. */
    instructors: Instructor[];
    /** Live payroll entries — drives /admin/compensation list, the Run
     *  Payroll review step, and the instructor-earnings detail page. */
    payrollEntries: PayrollEntry[];
    /** Live roles — drives /admin/staff Roles tab + every staff member's
     *  effective permission shape. Owner row is `locked: true` and cannot
     *  be deactivated or edited via the UI. */
    roles: Role[];
    /** Live staff — drives /admin/staff Staff tab + every staff details
     *  page. Phase 4 folds the dedicated `instructors` slice into a
     *  derived selector off this one. */
    staff: Staff[];
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

    addCustomer: (customer: Omit<Customer, "id" | "createdAt" | "initials" | "branchId" | "status"> & { initials?: string; branchId?: string; status?: Customer["status"] }) => string;
    /** Mutate any field on a customer — used by the Edit Customer flow. */
    updateCustomer: (id: string, patch: Partial<Omit<Customer, "id">>) => void;
    /** Change lifecycle status for one or many customers. Deactivate, archive,
     *  recover and reactivate all route through here so every call-site lands
     *  on the same propagation + toast pattern. */
    setCustomerStatus: (ids: string[], status: Customer["status"]) => void;
    /** Hard-delete customers. Blocked for any customer that has booking
     *  history (archive instead). Returns the split so the UI can report
     *  exactly what was removed and what was kept. */
    deleteCustomers: (ids: string[]) => { deleted: string[]; blocked: string[] };

    // ── Customer plans (customer-detail Plan tab) ──────────────────────────
    /** Freeze a plan — status → frozen, freeze window stored, and the expiry
     *  date pushed back by the freeze duration so frozen days aren't lost. */
    freezeCustomerPlan: (planId: string, startISO: string, endISO: string) => void;
    /** Unfreeze a plan — status → active. The extended expiry date is kept. */
    unfreezeCustomerPlan: (planId: string) => void;
    /** Cancel a plan — status → cancelled, with the mode + reason recorded. */
    cancelCustomerPlan: (planId: string, mode: "today" | "period_end", reason: string) => void;
    /** Remove a complimentary grant — status → removed, with reason + actor. */
    removeComplimentaryPlan: (planId: string, reason: string, removedBy: string, removedByRole: string) => void;
    /** Append a complimentary grant as a new plan row (from the add-credit flow). */
    addComplimentaryPlan: (input: Omit<CustomerPlan, "id" | "kind" | "status" | "planTypeLabel">) => string;

    // ── Customer transactions (customer-detail Payments tab) ───────────────
    /** Refund a completed transaction — status → refunded, with the refund
     *  method + timestamp recorded. Only `complete` transactions are eligible. */
    refundTransaction: (id: string, method: "cash" | "card") => void;

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

    // ── Pay rates ──────────────────────────────────────────────────────────
    /** Append a new pay rate. Auto-generates id when not supplied. Returns id. */
    addPayRate: (input: Omit<PayRate, "id"> & { id?: string }) => string;
    /** Patch a pay rate. Caller supplies the same `type` (or no `type` change)
     *  — switching types is a "replace" semantically and goes through add+delete. */
    updatePayRate: (id: string, patch: Partial<PayRate>) => void;
    setPayRatesStatus: (ids: string[], status: PayRateStatus) => void;
    /** Hard-delete only allowed when every selected row is Active AND
     *  zero-usage. Returns the list of ids that were actually deleted. */
    deletePayRates: (ids: string[]) => { deleted: string[]; blocked: string[] };

    // ── Instructors ────────────────────────────────────────────────────────
    /** Assign or clear an instructor's pay rate. Pass `payRateId = undefined`
     *  to remove the assignment (the instructor reverts to "—" in the table). */
    assignInstructorPayRate: (instructorId: string, payRateId: string | undefined) => void;
    /** Bulk status change — used by the detail page's row actions
     *  (Archive / Deactivate / Reactivate / Recover). */
    setInstructorStatus: (ids: string[], status: InstructorStatus) => void;

    // ── Payroll entries ────────────────────────────────────────────────────
    /** Mark one or more entries as paid (used by the Run Payroll wizard's
     *  per-row "Mark as paid" action). If `payrollRunId` is supplied the
     *  entries are stamped with it; otherwise just status flips. */
    setPayrollEntriesStatus: (ids: string[], status: PayrollEntryStatus, payrollRunId?: string) => void;
    /** Apply an adjustment to a single entry — used in the Run Payroll review
     *  step. Recomputes `totalEarnings` automatically. */
    setPayrollEntryAdjustment: (id: string, amount: number, reason?: string) => void;

    // ── Roles ──────────────────────────────────────────────────────────────
    /** Append a role. Auto-generates id + createdAt + copies the type's
     *  default permission matrix when `permissions` is omitted. */
    addRole: (input: Omit<Role, "id" | "createdAt"> & { id?: string }) => string;
    updateRole: (id: string, patch: Partial<Omit<Role, "id">>) => void;
    /** Bulk status flip — used by the Roles tab toggle + archive bulk action.
     *  No-ops on locked rows (Owner). */
    setRolesStatus: (ids: string[], status: RoleStatus) => void;
    /** Hard-delete only allowed when the role has zero assigned staff AND
     *  isn't locked. Returns ids actually deleted + ids blocked. */
    deleteRoles: (ids: string[]) => { deleted: string[]; blocked: string[] };

    // ── Staff ──────────────────────────────────────────────────────────────
    /** Append a staff member. Auto-generates id + sets status to "pending"
     *  + stamps inviteSentAt unless overridden. */
    addStaff: (input: Omit<Staff, "id" | "inviteSentAt" | "firstLoginCompleted"> & {
        id?: string; inviteSentAt?: string; firstLoginCompleted?: boolean;
    }) => string;
    updateStaff: (id: string, patch: Partial<Omit<Staff, "id">>) => void;
    setStaffStatus: (ids: string[], status: StaffStatus) => void;
    /** Resend invite — stamps a new inviteSentAt timestamp. Returns false if
     *  the staff member is already past first-login (resend is a no-op). */
    resendStaffInvite: (id: string) => boolean;
    /** Hard-delete only allowed when the staff member has zero historical
     *  records (zero classes taught, zero transactions, zero payroll
     *  entries). For the prototype we approximate by allowing delete only
     *  on Pending rows or rows with no `payRateId`. */
    deleteStaff: (ids: string[]) => { deleted: string[]; blocked: string[] };

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
    customerPlans: INITIAL_CUSTOMER_PLANS,
    customerTransactions: INITIAL_CUSTOMER_TRANSACTIONS,
    customerAgreements: INITIAL_CUSTOMER_AGREEMENTS,
    customerReferrals: INITIAL_CUSTOMER_REFERRALS,
    memberships: [...SEED_MEMBERSHIPS],
    packages: [...SEED_PACKAGES],
    giftCardDesigns: [...SEED_GIFT_CARD_DESIGNS],
    issuedGiftCards: [...SEED_ISSUED_GIFT_CARDS],
    promoCodes: [...SEED_PROMO_CODES],
    marketingItems: [...SEED_MARKETING_ITEMS],
    payRates: [...INITIAL_PAY_RATES],
    instructors: [...INITIAL_INSTRUCTORS],
    payrollEntries: [...INITIAL_PAYROLL_ENTRIES],
    roles: [...INITIAL_ROLES],
    staff: [...INITIAL_STAFF],
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
            // Newly-created customers are Active by default — a brand-new
            // account is never seeded inactive/archived.
            status: input.status ?? "active",
            createdAt: new Date().toISOString(),
        };
        set((state) => ({ customers: [customer, ...state.customers] }));
        return id;
    },
    updateCustomer: (id, patch) =>
        set((state) => ({
            customers: state.customers.map(c => c.id === id ? { ...c, ...patch } : c),
        })),
    setCustomerStatus: (ids, status) =>
        set((state) => {
            const idSet = new Set(ids);
            return { customers: state.customers.map(c => idSet.has(c.id) ? { ...c, status } : c) };
        }),
    deleteCustomers: (ids) => {
        const state = get();
        const deleted: string[] = [];
        const blocked: string[] = [];
        for (const id of ids) {
            // A customer with any booking on record is history-bearing — it
            // can only be archived, never hard-deleted (CLAUDE.md archive rule).
            const hasHistory = state.classBookings.some(b => b.customerId === id);
            if (hasHistory) blocked.push(id);
            else deleted.push(id);
        }
        if (deleted.length > 0) {
            const deletedSet = new Set(deleted);
            set(s => ({ customers: s.customers.filter(c => !deletedSet.has(c.id)) }));
        }
        return { deleted, blocked };
    },

    // ── Customer plans ─────────────────────────────────────────────────────

    freezeCustomerPlan: (planId, startISO, endISO) =>
        set(state => ({
            customerPlans: state.customerPlans.map(p => {
                if (p.id !== planId) return p;
                // Frozen days are added back onto the expiry so the customer
                // doesn't lose the paused time (Brief: expiry is extended).
                const days = Math.max(0, Math.round(
                    (new Date(`${endISO}T00:00:00Z`).getTime() - new Date(`${startISO}T00:00:00Z`).getTime()) / 86_400_000,
                ));
                const extendedExpiry = new Date(new Date(p.expiryISO).getTime() + days * 86_400_000).toISOString();
                return {
                    ...p,
                    status: "frozen" as const,
                    freezeStartISO: startISO,
                    freezeEndISO: endISO,
                    expiryISO: extendedExpiry,
                };
            }),
        })),

    unfreezeCustomerPlan: (planId) =>
        set(state => ({
            customerPlans: state.customerPlans.map(p =>
                p.id === planId
                    ? { ...p, status: "active" as const, freezeStartISO: undefined, freezeEndISO: undefined }
                    : p,
            ),
        })),

    cancelCustomerPlan: (planId, mode, reason) =>
        set(state => {
            const target = state.customerPlans.find(p => p.id === planId);
            const customerPlans = state.customerPlans.map(p =>
                p.id === planId
                    ? {
                        ...p,
                        status: "cancelled" as const,
                        cancelMode: mode,
                        cancelReason: reason,
                        cancelledAtISO: new Date().toISOString(),
                    }
                    : p,
            );
            // Clamp the customer's live `creditsRemaining` to the new
            // allotment ceiling so a cancelled plan visibly removes credits
            // from the side-panel widget (and anywhere else reading the
            // balance). Unlimited plans keep credits uncapped.
            const customers = !target ? state.customers : state.customers.map(c => {
                if (c.id !== target.customerId) return c;
                const stillCounted = customerPlans.filter(p =>
                    p.customerId === c.id
                    && (p.status === "active" || p.status === "frozen"));
                let cap = 0;
                for (const p of stillCounted) {
                    if (p.creditsLabel.toLowerCase().includes("unlimited")) {
                        return c; // any remaining unlimited plan → no clamp
                    }
                    const m = p.creditsLabel.match(/\d+/);
                    cap += p.freeCredits ?? (m ? Number(m[0]) : 0);
                }
                return { ...c, creditsRemaining: Math.min(c.creditsRemaining ?? 0, cap) };
            });
            return { customerPlans, customers };
        }),

    removeComplimentaryPlan: (planId, reason, removedBy, removedByRole) =>
        set(state => {
            const plan = state.customerPlans.find(p => p.id === planId);
            const customerPlans = state.customerPlans.map(p =>
                p.id === planId
                    ? {
                        ...p,
                        status: "removed" as const,
                        removeReason: reason,
                        removedBy,
                        removedByRole,
                        removedAtISO: new Date().toISOString(),
                    }
                    : p,
            );
            // Revoke the still-unused free credits from the customer's balance.
            const customers = (plan && plan.freeCredits)
                ? state.customers.map(c =>
                    c.id === plan.customerId
                        ? { ...c, creditsRemaining: Math.max(0, (c.creditsRemaining ?? 0) - (plan.freeCredits ?? 0)) }
                        : c,
                )
                : state.customers;
            return { customerPlans, customers };
        }),

    addComplimentaryPlan: (input) => {
        const id = `cp_comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const plan: CustomerPlan = {
            ...input,
            id,
            kind: "complimentary",
            status: "active",
            planTypeLabel: "Free credit",
        };
        set(state => ({ customerPlans: [plan, ...state.customerPlans] }));
        return id;
    },

    // ── Customer transactions ──────────────────────────────────────────────

    refundTransaction: (id, method) =>
        set(state => ({
            customerTransactions: state.customerTransactions.map(t =>
                t.id === id && t.status === "complete"
                    ? {
                        ...t,
                        status: "refunded" as const,
                        refundedAtISO: new Date().toISOString(),
                        refundMethod: method,
                    }
                    : t,
            ),
        })),

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

    addPayRate: (input) => {
        const id = input.id ?? `pr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const next = {
            ...input,
            id,
            createdAt: input.createdAt ?? new Date().toISOString(),
        } as PayRate;
        set(state => ({ payRates: [...state.payRates, next] }));
        return id;
    },
    updatePayRate: (id, patch) =>
        // Merging discriminated unions with Partial is awkward in TS — we cast
        // the result back to PayRate after merge. Callers are responsible for
        // not mixing fields across variants.
        set(state => ({
            payRates: state.payRates.map(p => p.id === id ? ({ ...p, ...patch } as PayRate) : p),
        })),
    setPayRatesStatus: (ids, status) =>
        set(state => ({
            payRates: state.payRates.map(p => ids.includes(p.id) ? { ...p, status } : p),
        })),
    deletePayRates: (ids) => {
        const deletable = get().payRates.filter(p => ids.includes(p.id) && p.status === "active" && p.usageCount === 0);
        const deletableIds = deletable.map(p => p.id);
        const blocked = ids.filter(id => !deletableIds.includes(id));
        if (deletableIds.length > 0) {
            // Also clear the rate from any instructor that still references
            // it — the relationship survives the delete in DB-land but the
            // UI shouldn't dangle.
            set(state => ({
                payRates: state.payRates.filter(p => !deletableIds.includes(p.id)),
                instructors: state.instructors.map(i =>
                    i.payRateId && deletableIds.includes(i.payRateId) ? { ...i, payRateId: undefined } : i,
                ),
            }));
        }
        return { deleted: deletableIds, blocked };
    },

    assignInstructorPayRate: (instructorId, payRateId) =>
        set(state => ({
            instructors: state.instructors.map(i =>
                i.id === instructorId ? { ...i, payRateId } : i,
            ),
        })),
    setInstructorStatus: (ids, status) =>
        set(state => ({
            instructors: state.instructors.map(i =>
                ids.includes(i.id) ? { ...i, status } : i,
            ),
        })),

    setPayrollEntriesStatus: (ids, status, payrollRunId) =>
        set(state => ({
            payrollEntries: state.payrollEntries.map(e =>
                ids.includes(e.id)
                    ? { ...e, status, ...(payrollRunId ? { payrollRunId } : {}) }
                    : e,
            ),
        })),
    setPayrollEntryAdjustment: (id, amount, reason) =>
        set(state => ({
            payrollEntries: state.payrollEntries.map(e =>
                e.id === id
                    ? { ...e, adjustmentAmount: amount, adjustmentReason: reason, totalEarnings: e.baseEarnings + amount }
                    : e,
            ),
        })),

    // ── Role actions ───────────────────────────────────────────────────────
    addRole: (input) => {
        const id = input.id ?? `role_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const next: Role = {
            ...input,
            id,
            createdAt: new Date().toISOString(),
            // If caller didn't supply permissions, copy the type's template.
            permissions: input.permissions ?? DEFAULT_PERMISSIONS_BY_TYPE[input.type],
        };
        set(state => ({ roles: [...state.roles, next] }));
        return id;
    },
    updateRole: (id, patch) =>
        set(state => ({
            // Locked rows (Owner) ignore patches except status flips coming
            // from setRolesStatus (which uses a separate code path below).
            roles: state.roles.map(r =>
                r.id === id && !r.locked ? { ...r, ...patch } : r,
            ),
        })),
    setRolesStatus: (ids, status) =>
        set(state => ({
            roles: state.roles.map(r =>
                ids.includes(r.id) && !r.locked ? { ...r, status } : r,
            ),
        })),
    deleteRoles: (ids) => {
        // Delete only when: NOT locked AND zero assigned staff.
        const staffByRole = new Map<string, number>();
        for (const s of get().staff) {
            staffByRole.set(s.roleId, (staffByRole.get(s.roleId) ?? 0) + 1);
        }
        const deletable = get().roles
            .filter(r => ids.includes(r.id) && !r.locked && (staffByRole.get(r.id) ?? 0) === 0)
            .map(r => r.id);
        const blocked = ids.filter(i => !deletable.includes(i));
        if (deletable.length > 0) {
            set(state => ({ roles: state.roles.filter(r => !deletable.includes(r.id)) }));
        }
        return { deleted: deletable, blocked };
    },

    // ── Staff actions ──────────────────────────────────────────────────────
    addStaff: (input) => {
        const id = input.id ?? `staff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const next: Staff = {
            ...input,
            id,
            // New staff start Pending unless the caller overrides.
            status: input.status,
            inviteSentAt: input.inviteSentAt ?? new Date().toISOString(),
            firstLoginCompleted: input.firstLoginCompleted ?? false,
        };
        set(state => ({ staff: [...state.staff, next] }));
        return id;
    },
    updateStaff: (id, patch) =>
        set(state => ({
            staff: state.staff.map(s => s.id === id ? { ...s, ...patch } : s),
        })),
    setStaffStatus: (ids, status) =>
        set(state => ({
            staff: state.staff.map(s => ids.includes(s.id) ? { ...s, status } : s),
        })),
    resendStaffInvite: (id) => {
        const target = get().staff.find(s => s.id === id);
        if (!target || target.firstLoginCompleted) return false;
        set(state => ({
            staff: state.staff.map(s =>
                s.id === id ? { ...s, inviteSentAt: new Date().toISOString() } : s,
            ),
        }));
        return true;
    },
    deleteStaff: (ids) => {
        // Prototype rule: delete only when the staff row has no payroll /
        // pay rate history. We approximate with `payRateId` absence + Pending
        // status. The real rule (zero classes / zero transactions / zero
        // payroll entries) will land once those tables are joinable.
        const deletable = get().staff
            .filter(s => ids.includes(s.id) && (s.status === "pending" || !s.payRateId))
            .map(s => s.id);
        const blocked = ids.filter(i => !deletable.includes(i));
        if (deletable.length > 0) {
            set(state => ({ staff: state.staff.filter(s => !deletable.includes(s.id)) }));
        }
        return { deleted: deletable, blocked };
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

            // ─── Plan + transaction records ────────────────────────────────
            // Each membership / package line item becomes a `customer_plans`
            // row (customer-detail Plan tab) and a `customer_transactions` row
            // (Payments tab + its Overview metrics), so a completed POS /
            // checkout sale propagates across the whole customer module.
            const buyer = state.customers.find(c => c.id === customerId);
            const saleBranchId = buyer?.branchId ?? DEFAULT_BRANCH_ID;
            const stamp = Date.now();
            const nowISO = new Date().toISOString();
            const newPlans: CustomerPlan[] = [];
            const newTransactions: CustomerTransaction[] = [];
            items.forEach((it, idx) => {
                if (it.productType !== "membership" && it.productType !== "package") return;
                const isMembership = it.productType === "membership";
                const expiry = new Date();
                let creditsLabel: string;
                if (isMembership) {
                    const m = state.memberships.find(mm => mm.id === it.productId);
                    expiry.setMonth(expiry.getMonth() + (m?.duration_months ?? 1));
                    creditsLabel = m && m.credits !== "unlimited" ? `${m.credits} credits` : "Unlimited";
                } else {
                    const p = state.packages.find(pp => pp.id === it.productId);
                    expiry.setDate(expiry.getDate() + (p?.validity_days ?? 30));
                    const credits = (typeof p?.credits === "number" ? p.credits : 0) * it.quantity;
                    creditsLabel = `${credits} ${credits === 1 ? "credit" : "credits"}`;
                }
                newPlans.push({
                    id: `cp_sale_${stamp}_${idx}`,
                    customerId,
                    kind: isMembership ? "membership" : "package",
                    productId: it.productId,
                    name: it.name,
                    planTypeLabel: isMembership ? "Membership" : "Credit package",
                    creditsLabel,
                    status: "active",
                    purchasedAtISO: nowISO,
                    expiryISO: expiry.toISOString(),
                    ...(isMembership ? { priceAed: it.unitPrice } : {}),
                });
                newTransactions.push({
                    id: `txn_sale_${stamp}_${idx}`,
                    customerId,
                    branchId: saleBranchId,
                    kind: isMembership ? "membership" : "package",
                    productId: it.productId,
                    name: it.name,
                    amountAed: it.unitPrice * it.quantity,
                    status: "complete",
                    paymentMethod: "card",
                    createdAtISO: nowISO,
                });
            });

            return {
                customers,
                ...(newIssued.length > 0
                    ? { issuedGiftCards: [...state.issuedGiftCards, ...newIssued] }
                    : {}),
                ...(newPlans.length > 0
                    ? { customerPlans: [...newPlans, ...state.customerPlans] }
                    : {}),
                ...(newTransactions.length > 0
                    ? { customerTransactions: [...newTransactions, ...state.customerTransactions] }
                    : {}),
            };
        }),

    showToast: (title, message, type = "success", icon) =>
        set({ toast: { id: Date.now().toString(), title, message, type, icon } }),
    clearToast: () => set({ toast: null }),
}));
