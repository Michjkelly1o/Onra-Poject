"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Centralized Zustand store
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Phase 3 admin ↔ instructor sync contract ─────────────────────────────────
//
// This file is the SINGLE source of truth for every cross-module slice the
// admin and the instructor experience read. Both sides subscribe to the
// SAME selectors — no forked seeds, no parallel "instructor stores".
// Per-instructor scoping is a client-side `.filter(c => c.instructorId
// === staffId)`; when this project moves to Supabase the filter becomes
// an RLS policy on the matching FK.
//
//   ─ Schedule rows ........... `classSchedules` slice
//   ─ Booking lifecycle ....... `classBookings` slice
//   ─ Class ratings .......... `classRatings` slice
//   ─ Per-class earnings math . `payroll-calc.ts::earningsForClass`
//   ─ Customer profile ....... `customers` slice
//   ─ Staff / Instructor ..... `staff[]` + `instructors[]` (mirrored)
//   ─ Pay rates .............. `payRates` slice
//   ─ Branches / Rooms ....... `branches` + `rooms` slices
//   ─ Business hours ......... `businessHours` slice
//   ─ Notifications .......... `notifications` slice, audience-scoped
//                              via `targetInstructorId`
//   ─ Account profile ........ `currentUser` slice; bi-directional
//                              cascade to staff[] + instructors[] +
//                              classSchedules[] denormalized snapshots
//
// ── Mutators that cascade to multiple slices in ONE `set()` call ─────────────
//
//   • `addClassSchedule` / `updateClassSchedule` / `cancelClassSchedule`
//     ─ schedule rows id+merge, no fork
//     ─ **Tab-preservation cancel model**: when a class is cancelled,
//       bookings keep their ORIGINAL `status` (booked / waitlisted /
//       cancelled). The class.status flips to "Cancelled" and the
//       refund flag is set on booked + waitlisted rows. Detail page
//       tabs render unchanged — Booked / Waitlisted / Cancelled tabs
//       each show their original customers. Visual indication of
//       cancellation comes from the row's status badge (kind="class")
//       on the Booked tab when class.status === "Cancelled".
//     ─ emits dual-audience notifications (admin + instructor-scoped)
//   • `updateAttendance` (Present / No-show / Late-cancel)
//     ─ updates booking row; both schedule detail pages re-render
//   • `updateRoom({ name })` → cascades to `classSchedules.room`
//     denormalized snapshot (Phase 3 gap closure)
//   • `updateBranch({ name })` → cascades to `classSchedules.location`
//     denormalized snapshot (Phase 3 gap closure)
//   • `updatePayRate` / `assignInstructorPayRate`
//     ─ rate edits cascade to BOTH `instructors[]` and `staff[]` slices
//     ─ centralized `earningsForClass` recomputes for both surfaces
//   • `updateAccountProfile(patch)` (instructor side)
//     ─ patches `currentUser` AND cascades identity (name / email /
//       phone / avatar / **bio** as `introduction`) to staff[] +
//       instructors[] + classSchedules[] denormalized fields
//   • `updateStaff(id, patch)` (admin side, reverse cascade)
//     ─ if editing the currently-logged-in instructor, mirrors identity
//       (name / email / phone / avatar / **bio**) back into `currentUser`
//       so /instructor/account stays in sync
//
// ── Notification scoping ─────────────────────────────────────────────────────
//
//   • `audience: "admin"` rows land in admin notification center
//   • `audience: "instructor"` + `targetInstructorId: <staffId>` rows
//     land in that one instructor's bell only — never cross-leak
//
// ── Hardcoded attribution rules ──────────────────────────────────────────────
//
// All mutators that stamp a "by" field (cancelledBy, etc.) resolve via:
//   explicit param > `currentUser.first_name + last_name` > "Alex Owen"
//
// Old call-sites stay backward-compatible (optional params); new surfaces
// pass the active user's name automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
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
    classes_settings as SEED_CLASSES_SETTINGS,
    cancellation_policies as SEED_CANCELLATION_POLICIES,
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
    notification_settings as SEED_NOTIFICATION_SETTINGS,
    notifications as SEED_NOTIFICATIONS,
    notifications_instructor as SEED_NOTIFICATIONS_INSTRUCTOR,
    instructor_integrations as SEED_INSTRUCTOR_INTEGRATIONS,
    type InstructorIntegrationSeed,
    type InstructorIntegrationSlugSeed,
    type InstructorIntegrationStatusSeed,
    referral_settings as SEED_REFERRAL_SETTINGS,
    tax_rates as SEED_TAX_RATES,
    tax_settings as SEED_TAX_SETTINGS,
    tax_rules as SEED_TAX_RULES,
    agreements as SEED_AGREEMENTS,
    agreement_versions as SEED_AGREEMENT_VERSIONS,
    integrations as SEED_INTEGRATIONS,
    payment_providers as SEED_PAYMENT_PROVIDERS,
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
    type ClassesSettings,
    type CancellationPolicy,
    type PolicyType,
    type CancellationChoice,
    type NoShowChoice,
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
    type NotificationSettingSeed,
    type NotificationCategorySeed,
    type NotificationSeed,
    type NotificationEventSeed,
    type NotificationTabSeed,
    type NotificationIconSeed,
    type NotificationSourceSeed,
    type TaxRateSeed,
    type TaxRateStatusSeed,
    type TaxCalculationModeSeed,
    type TaxSettingsSeed,
    type TaxRuleSeed,
    type TaxRuleCategorySeed,
    type TaxRuleStatusSeed,
    type AgreementSeed,
    type AgreementTypeSeed,
    type AgreementStatusSeed,
    type AgreementContentTypeSeed,
    type AgreementVersionSeed,
    type IntegrationSeed,
    type IntegrationSlugSeed,
    type IntegrationStatusSeed,
    type PaymentProviderSeed,
    type PaymentProviderSlugSeed,
    type PaymentProviderKindSeed,
    type PaymentProviderStatusSeed,
    type ReferralSettingsSeed,
    type ReferralTriggerSeed,
    type PermissionsMapSeed,
    type PermissionCellSeed,
    type PermissionRowSeed,
    type GrantLimitsSeed,
    type PayRateHybridConditionSeed,
    type PayrollEntrySeed,
    type PayrollEntryStatusSeed,
    branding_settings as SEED_BRANDING_SETTINGS,
} from "@/data/mock";

// Re-export raw seed types — consumers can read these directly from the store.
export type {
    ClassCategory, ClassesSettings, CancellationPolicy, PolicyType, CancellationChoice, NoShowChoice, Branch, Room, BusinessHours, StaffProfile, Membership, Package, GiftCardDesign, IssuedGiftCard, PromoCode, MarketingItem, PaymentMethod,
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

/** Return the open/close hours for `branchId` on the weekday of `dateISO`.
 *  Pass the live `businessHours` slice (`useAppStore(s => s.businessHours)`)
 *  so edits made through the Business & Locations module propagate to every
 *  consumer on the same render — DO NOT read the static seed here. */
export function getBusinessHours(rows: BusinessHours[], branchId: string, dateISO: string): HoursWindow {
    const d = new Date(dateISO + "T00:00:00Z");
    const dow = d.getUTCDay();
    const row = rows.find(r => r.branch_id === branchId && r.day_of_week === dow);
    if (!row || row.is_closed) return null;
    return { open: row.open_time, close: row.close_time };
}

/** Union of every branch's open hours for a weekday — used when a view shows
 *  more than one branch and the grid needs the widest envelope. Same
 *  contract as `getBusinessHours`: pass the live slice. */
export function getUnionBusinessHours(rows: BusinessHours[], branchIds: string[], dateISO: string): HoursWindow {
    const d = new Date(dateISO + "T00:00:00Z");
    const dow = d.getUTCDay();
    const matches = rows.filter(r => branchIds.includes(r.branch_id) && r.day_of_week === dow && !r.is_closed);
    if (matches.length === 0) return null;
    const open  = matches.reduce((acc, r) => r.open_time  < acc ? r.open_time  : acc, matches[0].open_time);
    const close = matches.reduce((acc, r) => r.close_time > acc ? r.close_time : acc, matches[0].close_time);
    return { open, close };
}

/** "07:00" → 7, "07:30" → 7.5 — used to drive grid start/end hours. */
export function hourFloatFromTime(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h + (m ?? 0) / 60;
}

/** Effective cover image for a class template — falls back to the parent
 *  category's `image_url` when the template itself has no banner. So the
 *  flow:
 *   1. Admin uploads an image on a Service category in Booking Rules.
 *   2. Admin creates a class template, picks that category, doesn't
 *      upload a separate banner.
 *   3. The template list, detail page, and schedule preview all show the
 *      category image automatically.
 *  Templates that have their own uploaded banner keep showing it. */
export function resolveTemplateCoverImage(
    template: { coverImage?: string; categoryId: string },
    categories: ClassCategory[],
): string | undefined {
    return template.coverImage || categories.find(c => c.id === template.categoryId)?.image_url;
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

// ─── Demo-mode role mapping ────────────────────────────────────────────────
//
// The legacy `currentUser.role` carries the three-bucket prototype role
// ("admin" / "instructor" / "member"). The Staff & Permissions module owns
// the 5 predefined Staff roles (owner / branch_admin / operator /
// front_desk / instructor). Phase 4 — cross-module sync — needs ONE
// function callers can use to resolve "what Staff role is the current user
// playing?" so features like Grant Limits read from the right role record.

/** Map the demo `currentUser.role` to one of the 5 Staff role TYPES.
 *  Returns null when no Staff role maps (e.g. a "member" demo persona). */
export function demoRoleToStaffType(role: UserRole | string): RoleTypeSeed | null {
    if (role === "admin")      return "owner";
    if (role === "instructor") return "instructor";
    // Member personas aren't Staff and don't get a Staff role.
    return null;
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
    /** Per-schedule override for applicable memberships. When undefined, fall
     *  back to the parent template's `applicableMembershipIds` (cascade). When
     *  set, the schedule is detached from the template for this field. Empty
     *  array is a meaningful "no plans allowed" state — distinct from undefined. */
    applicableMembershipIds?: string[];
    /** Per-schedule override for applicable packages. Same cascade as
     *  `applicableMembershipIds`. */
    applicablePackageIds?: string[];
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
    /** Origin surface where the booking was created (camel-case mirror
     *  of `ClassBookingSeed.booking_source`). */
    bookingSource?: "customer_portal" | "admin" | "front_desk" | "pos";
    /** Origin surface that cancelled the booking. */
    cancelledSource?: "customer_portal" | "admin" | "front_desk" | "instructor" | "system";
    /** ISO timestamp recorded the moment a staff member flipped
     *  `attendanceStatus` away from "pending" via `updateAttendance`.
     *  Drives the team-activity feed's attendance event. */
    attendanceMarkedAt?: string;
    /** Display name of the staff member who marked attendance. Stamped
     *  by `updateAttendance` from `currentUser` (the persona auto-flip
     *  guarantees this is the instructor when the action originates from
     *  /instructor/*). */
    attendanceMarkedBy?: string;
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
    /** Phase 4 FK → agreements.id. The tab joins on this to display the live
     *  agreement name + open the View modal with the joined version's content. */
    agreementId: string;
    /** Snapshot of the agreement name at issue time. Live consumers should
     *  prefer the joined `agreements` row's name when present. */
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

// ─── Customer notification settings (PRD 11 §12) ───────────────────────────

export type NotificationCategory = NotificationCategorySeed;

/** Camel-cased mirror of `NotificationSettingSeed`. Drives the per-event
 *  channel toggles + template editor on Settings → Customer notifications. */
export interface NotificationSetting {
    id: string;
    category: NotificationCategory;
    notificationType: string;
    label: string;
    emailEnabled: boolean;
    whatsappEnabled: boolean;
    pushEnabled: boolean;
    emailSubject?: string;
    emailTemplate?: string;
    whatsappTemplate?: string;
}

// ─── Tax module (PRD 11 §10) ───────────────────────────────────────────────

export type TaxRateStatus = TaxRateStatusSeed;
export type TaxCalculationMode = TaxCalculationModeSeed;

/** Camel-cased mirror of `TaxRateSeed`. Drives /admin/settings/tax → Tax
 *  rates list. Phase 4 cross-module wiring: every membership / package /
 *  gift card / pay rate gets an optional `taxRateId` FK to this row. */
export interface TaxRate {
    id: string;
    name: string;
    ratePercentage: number;
    description?: string;
    calculationMode: TaxCalculationMode;
    status: TaxRateStatus;
    createdAt: string;
}

/** Studio-wide tax display settings. */
export interface TaxSettings {
    pricesIncludeTax: boolean;
}

export type TaxRuleCategory = TaxRuleCategorySeed;
export type TaxRuleStatus = TaxRuleStatusSeed;

/** Camel-cased mirror of `TaxRuleSeed`. One row per applied tax rule on the
 *  /admin/settings/tax → Apply tax rates tab. */
export interface TaxRule {
    id: string;
    category: TaxRuleCategory;
    taxRateId?: string;
    allLocations: boolean;
    locationIds: string[];
    status: TaxRuleStatus;
    createdAt: string;
}

// ─── Agreements module (PRD 11 §9) ─────────────────────────────────────────

export type AgreementType        = AgreementTypeSeed;
export type AgreementStatus      = AgreementStatusSeed;
export type AgreementContentType = AgreementContentTypeSeed;

/** Camel-cased mirror of `AgreementSeed`. Drives /admin/settings/agreements
 *  list + detail. */
export interface Agreement {
    id: string;
    name: string;
    type: AgreementType;
    description?: string;
    required: boolean;
    currentVersion: number;
    allLocations: boolean;
    locationIds: string[];
    /** Class templates (services) this agreement covers — empty = applies
     *  to every active service. Phase 2 captures this from the Rules step's
     *  "Applicable services" multi-select (grouped by branch). FK →
     *  class_templates.id. */
    applicableClassTemplateIds: string[];
    effectiveFrom: string;
    effectiveUntil: string;
    status: AgreementStatus;
    updatedAt: string;
    createdAt: string;
}

/** Camel-cased mirror of `AgreementVersionSeed`. */
export interface AgreementVersion {
    id: string;
    agreementId: string;
    versionNumber: number;
    contentType: AgreementContentType;
    contentText?: string;
    fileName?: string;
    fileUrl?: string;
    fileSizeBytes?: number;
    /** Extracted HTML content for uploaded files. The View modal renders
     *  this directly, so PDF/DOCX uploads appear as styled text. */
    extractedHtml?: string;
    publishedAt: string;
    publishedBy: string;
}

// ─── Integrations module (PRD 11 §8) ───────────────────────────────────────

export type IntegrationSlug   = IntegrationSlugSeed;
export type IntegrationStatus = IntegrationStatusSeed;

/** Camel-cased mirror of `IntegrationSeed`. Drives the card grid at
 *  /admin/settings/integrations. Connect / disconnect actions flip the
 *  `status` and stamp / clear `connectedAt` + `accountLabel`. The actual
 *  "connection" is simulated — no real OAuth (see Phase 3 brief). */
export interface Integration {
    id: string;
    slug: IntegrationSlug;
    name: string;
    description: string;
    status: IntegrationStatus;
    connectedAt?: string;
    accountLabel?: string;
}

// ─── Instructor calendar integrations (per-instructor) ─────────────────────
//
// Distinct from the studio `Integration` above — instructor calendar
// connections are per-staff (Liam's Google Calendar ≠ Maya's). Stays in
// its own slice so the admin Integrations list never picks up these rows
// + Phase 4 can lift the whole table cleanly into Supabase.

export type InstructorIntegrationSlug = InstructorIntegrationSlugSeed;
export type InstructorIntegrationStatus = InstructorIntegrationStatusSeed;

/** Camel-cased mirror of `InstructorIntegrationSeed`. */
export interface InstructorIntegration {
    id: string;
    staffProfileId: string;
    slug: InstructorIntegrationSlug;
    status: InstructorIntegrationStatus;
    connectedAt?: string;
    accountLabel?: string;
}

// ─── Business profile (PRD 11 §4.1) ────────────────────────────────────────

/** Studio-wide profile data — name, contact, locale. Powers the Studio
 *  profile edit page + the Branch / Room forms' country / city / currency
 *  / timezone defaults. Phase 4 will lift this into a centralized seed
 *  (`src/data/mock/business_profile.ts`) and propagate the timezone to the
 *  schedule + dashboard date displays. */
export interface BusinessProfile {
    name: string;
    logoUrl: string;
    website: string;
    /** Country full name (matches `Country.name` in `lib/data/locales.ts`). */
    country: string;
    /** Currency ISO code (e.g. "AED"). */
    currency: string;
    /** IANA timezone (e.g. "Asia/Dubai"). The schedule + dashboard will read
     *  this to render date-times in the studio's local time, instead of the
     *  browser's. */
    timezone: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
}

// ─── Branding module (PRD 11 §5) ───────────────────────────────────────────

/** A single menu item on the customer-portal nav. The `enabled` flag drives
 *  whether the chip is visible in the portal's nav bar. */
export interface PortalMenuItem {
    id: string;
    label: string;
    enabled: boolean;
    /** Deep link URL the portal points at — surfaced on Step 2 (Embed
     *  website) so the admin can grab a copyable share/link target. */
    url: string;
}

/** Single source of truth for the studio's brand identity + customer-portal
 *  preferences. Phase 2 holds it in store memory; Phase 3 will repoint the
 *  initial state at `src/data/mock/branding_settings.ts`. Field shape
 *  mirrors PRD 11 §13.2 plus the brief's Portal-preferences additions. */
export interface BrandingSettings {
    displayName:     string;
    primaryColor:    string;
    backgroundColor: string;
    textColor:       string;
    /** Human label for the text colour (e.g. "Black") — displayed in the
     *  landing preview where the hex would read poorly. */
    textColorLabel:  string;
    portalUrl:       string;
    /** Master switch — when off, the portal renders without a menu bar even
     *  if individual items are enabled. */
    menuBarVisible:  boolean;
    menuItems:       PortalMenuItem[];
    /** The HTML/JS snippet the admin pastes into their site to embed the
     *  Forma portal. Held as a single multi-line string. */
    embedCode:       string;
}

// ─── Payments module (PRD 11 §7) ───────────────────────────────────────────

export type PaymentProviderSlug   = PaymentProviderSlugSeed;
export type PaymentProviderKind   = PaymentProviderKindSeed;
export type PaymentProviderStatus = PaymentProviderStatusSeed;

/** Camel-cased mirror of `PaymentProviderSeed`. Drives the card grid at
 *  /admin/settings/payments. Connect / Enable / Disconnect actions flip
 *  the `status`. Disconnecting a gateway cascades — every wallet whose
 *  `requiresProviderSlug` points at it auto-disconnects too. */
export interface PaymentProvider {
    id: string;
    slug: PaymentProviderSlug;
    name: string;
    description: string;
    kind: PaymentProviderKind;
    requiresProviderSlug?: PaymentProviderSlug;
    status: PaymentProviderStatus;
    connectedAt?: string;
    accountLabel?: string;
}

// ─── In-app notifications (PRD 12 — feed records) ──────────────────────────

export type NotificationEvent = NotificationEventSeed;
export type NotificationTab = NotificationTabSeed;
export type NotificationIcon = NotificationIconSeed;
export type NotificationSource = NotificationSourceSeed;
export type NotificationAudience = "admin" | "instructor";

/** Camel-cased mirror of `NotificationSeed`. Drives the bell-icon dropdown
 *  + the `/admin/notifications` full page (PRD 12 §3). Distinct from
 *  `NotificationSetting` which is the per-event config table. */
export interface Notification {
    id: string;
    /** Audience scope — drives which feed shows the row. Optional; an
     *  undefined value behaves like `"admin"` so legacy seeds keep
     *  appearing in the admin bell + page. Instructor rows MUST set
     *  this to `"instructor"` or they'll leak into the admin feed. */
    audience?: NotificationAudience;
    tab: NotificationTab;
    event: NotificationEvent;
    title: string;
    body: string;
    icon: NotificationIcon;
    sourceModule: NotificationSource;
    sourceId?: string;
    customerId?: string;
    branchId?: string;
    /** Class schedule id — used by the click-through resolver to deep-link
     *  booking / class events into `/schedule/[id]`. Always populated by
     *  the booking + class action triggers in this store. */
    classScheduleId?: string;
    /** Per-instructor scope (FK to `staff_profiles.id`). Required when
     *  `audience === "instructor"` so the instructor bell shows only
     *  notifications for THIS instructor's classes. Undefined for admin
     *  rows. */
    targetInstructorId?: string;
    /** Customer transaction id — populated for payment events so the
     *  click-through can deep-link to the receipt on the customer profile. */
    transactionId?: string;
    isRead: boolean;
    createdAt: string;
}

// ─── Referral settings (PRD 11 §11) ────────────────────────────────────────

export type ReferralTrigger = ReferralTriggerSeed;

/** Camel-cased mirror of `ReferralSettingsSeed`. Drives Settings → Referral
 *  AND the customer-detail Referrals tab (which gates its CTA on
 *  `programActive` and quotes the configured benefit numbers). */
export interface ReferralSettings {
    programActive: boolean;
    newCustomerCredits: number;
    newCustomerMessage: string;
    existingCustomerTrigger: ReferralTrigger;
    existingCustomerMinReferred: number;
    existingCustomerCredits: number;
    existingCustomerMessage: string;
    infoDescription: string;
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
    /** Origin surface that initiated the freeze. Mirrors the
     *  `customer_plans.freeze_source` seed column. */
    freezeSource?: "customer_portal" | "admin" | "front_desk";
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
    /** Gross amount paid. When the breakdown fields below are present this
     *  equals `subtotalAed + taxAed`. */
    amountAed: number;
    /** Phase 4 — pre-tax line amount. Undefined on historical rows. */
    subtotalAed?: number;
    /** Phase 4 — tax portion of `amountAed`. */
    taxAed?: number;
    /** Phase 4 — tax rate applied (percentage). */
    taxRatePercentage?: number;
    /** Phase 4 — true when the global "Prices include tax" toggle was ON at
     *  purchase time. */
    taxInclusive?: boolean;
    status: "complete" | "pending" | "failed" | "refunded";
    paymentMethod: "card" | "cash";
    /** Origin surface that processed the payment. Mirrors the
     *  `customer_transactions.payment_source` seed column. */
    paymentSource?: "pos" | "customer_portal" | "admin";
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

/**
 * Audit log entry — captures every back-office action across every persona
 * so the team-activity feed can surface configuration / management events
 * (membership edits, comp credits, settings changes, payroll runs, etc.)
 * alongside the customer-facing event stream.
 *
 * Each entry is created by the `recordAudit(...)` mutator. The actor is
 * resolved from `currentUser` at write time — when an instructor edits
 * their profile via `/instructor/account`, `actorRole === "instructor"`;
 * when an admin freezes a membership from `/admin/customers/[id]`,
 * `actorRole === "admin"`.
 *
 * `targetName` is denormalized so an entry survives a downstream delete of
 * the target (the feed never goes "edited <undefined>").
 */
export interface AuditLogEntry {
    id: string;
    actorId: string;
    actorName: string;
    actorRole: UserRole | string;
    /** Verb phrase shown in the feed, e.g. "Edited customer profile",
     *  "Froze membership", "Updated booking rules". */
    action: string;
    /** Entity category — drives the icon picker in the deriver. */
    targetType:
        | "customer" | "customer_plan" | "class_template" | "class_schedule"
        | "membership" | "package" | "gift_card" | "promo_code"
        | "branch" | "room" | "settings" | "marketing" | "staff"
        | "pay_rate" | "payroll" | "rating" | "account";
    targetId: string;
    /** Display name of the target — read at write time and frozen here so
     *  the audit row survives even if the target is later renamed / deleted. */
    targetName: string;
    /** Free-form context (e.g. `{ from: "2026-07-01", to: "2026-07-31" }`
     *  for a freeze; `{ creditsGranted: 2 }` for a comp credit). Surfaced
     *  in the feed copy when meaningful. */
    metadata?: Record<string, string | number | boolean>;
    createdAt: string;
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
        applicableMembershipIds: s.applicable_membership_ids,
        applicablePackageIds: s.applicable_package_ids,
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
        bookingSource: b.booking_source,
        cancelledSource: b.cancelled_source,
        attendanceMarkedAt: b.attendance_marked_at,
        attendanceMarkedBy: b.attendance_marked_by,
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
        agreementId: a.agreement_id,
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
        freezeSource: p.freeze_source,
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
        subtotalAed: t.subtotal_aed,
        taxAed: t.tax_aed,
        taxRatePercentage: t.tax_rate_percentage,
        taxInclusive: t.tax_inclusive,
        status: t.status,
        paymentMethod: t.payment_method,
        paymentSource: t.payment_source,
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
    /** Optional per-rate tax override. When set, payroll for this pay rate
     *  applies this `tax_rate` instead of (or alongside) the global pay-rate
     *  tax rule. Unset = "No tax rate" — the rate inherits whatever the
     *  global Tax module's pay-rate rule provides. */
    taxRateId?: string;
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
        taxRateId: p.tax_rate_id,
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

function notificationSettingFromSeed(n: NotificationSettingSeed): NotificationSetting {
    return {
        id: n.id,
        category: n.category,
        notificationType: n.notification_type,
        label: n.label,
        emailEnabled: n.email_enabled,
        whatsappEnabled: n.whatsapp_enabled,
        pushEnabled: n.push_enabled,
        emailSubject: n.email_subject,
        emailTemplate: n.email_template,
        whatsappTemplate: n.whatsapp_template,
    };
}

function taxRateFromSeed(t: TaxRateSeed): TaxRate {
    return {
        id: t.id,
        name: t.name,
        ratePercentage: t.rate_percentage,
        description: t.description,
        calculationMode: t.calculation_mode,
        status: t.status,
        createdAt: t.created_at,
    };
}

function taxSettingsFromSeed(t: TaxSettingsSeed): TaxSettings {
    return { pricesIncludeTax: t.prices_include_tax };
}

function taxRuleFromSeed(t: TaxRuleSeed): TaxRule {
    return {
        id: t.id,
        category: t.category,
        taxRateId: t.tax_rate_id,
        allLocations: t.all_locations,
        locationIds: [...t.location_ids],
        status: t.status,
        createdAt: t.created_at,
    };
}

function agreementFromSeed(a: AgreementSeed): Agreement {
    return {
        id: a.id,
        name: a.name,
        type: a.type,
        description: a.description,
        required: a.required,
        currentVersion: a.current_version,
        allLocations: a.all_locations,
        locationIds: [...a.location_ids],
        applicableClassTemplateIds: [...(a.applicable_class_template_ids ?? [])],
        effectiveFrom: a.effective_from,
        effectiveUntil: a.effective_until,
        status: a.status,
        updatedAt: a.updated_at,
        createdAt: a.created_at,
    };
}

function agreementVersionFromSeed(v: AgreementVersionSeed): AgreementVersion {
    return {
        id: v.id,
        agreementId: v.agreement_id,
        versionNumber: v.version_number,
        contentType: v.content_type,
        contentText: v.content_text,
        fileName: v.file_name,
        fileUrl: v.file_url,
        fileSizeBytes: v.file_size_bytes,
        extractedHtml: v.extracted_html,
        publishedAt: v.published_at,
        publishedBy: v.published_by,
    };
}

function integrationFromSeed(i: IntegrationSeed): Integration {
    return {
        id: i.id,
        slug: i.slug,
        name: i.name,
        description: i.description,
        status: i.status,
        connectedAt: i.connected_at,
        accountLabel: i.account_label,
    };
}

function paymentProviderFromSeed(p: PaymentProviderSeed): PaymentProvider {
    return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        kind: p.kind,
        requiresProviderSlug: p.requires_provider_slug,
        status: p.status,
        connectedAt: p.connected_at,
        accountLabel: p.account_label,
    };
}

function notificationFromSeed(n: NotificationSeed): Notification {
    return {
        id: n.id,
        audience: n.audience,
        tab: n.tab,
        event: n.event,
        title: n.title,
        body: n.body,
        icon: n.icon,
        sourceModule: n.source_module,
        sourceId: n.source_id,
        customerId: n.customer_id,
        branchId: n.branch_id,
        classScheduleId: n.class_schedule_id,
        targetInstructorId: n.target_instructor_id,
        transactionId: n.transaction_id,
        isRead: n.is_read,
        createdAt: n.created_at,
    };
}
function referralSettingsFromSeed(r: ReferralSettingsSeed): ReferralSettings {
    return {
        programActive: r.program_active,
        newCustomerCredits: r.new_customer_credits,
        newCustomerMessage: r.new_customer_message,
        existingCustomerTrigger: r.existing_customer_trigger,
        existingCustomerMinReferred: r.existing_customer_min_referred,
        existingCustomerCredits: r.existing_customer_credits,
        existingCustomerMessage: r.existing_customer_message,
        infoDescription: r.info_description,
    };
}

const INITIAL_PAY_RATES:        PayRate[]        = SEED_PAY_RATES.map(payRateFromSeed);
const INITIAL_INSTRUCTORS:      Instructor[]     = SEED_INSTRUCTORS.map(instructorFromSeed);
const INITIAL_PAYROLL_ENTRIES:  PayrollEntry[]   = SEED_PAYROLL_ENTRIES.map(payrollEntryFromSeed);
const INITIAL_ROLES:            Role[]           = SEED_ROLES.map(roleFromSeed);
const INITIAL_STAFF:            Staff[]          = SEED_STAFF.map(staffFromSeed);
const INITIAL_NOTIFICATION_SETTINGS: NotificationSetting[] = SEED_NOTIFICATION_SETTINGS.map(notificationSettingFromSeed);
// Admin + instructor notifications live in one initial array — the bell +
// page components filter by `audience` based on the current user role.
const INITIAL_NOTIFICATIONS:         Notification[]         = [
    ...SEED_NOTIFICATIONS,
    ...SEED_NOTIFICATIONS_INSTRUCTOR,
].map(notificationFromSeed);
const INITIAL_REFERRAL_SETTINGS:     ReferralSettings       = referralSettingsFromSeed(SEED_REFERRAL_SETTINGS);
const INITIAL_TAX_RATES:             TaxRate[]              = SEED_TAX_RATES.map(taxRateFromSeed);
const INITIAL_TAX_SETTINGS:          TaxSettings            = taxSettingsFromSeed(SEED_TAX_SETTINGS);
const INITIAL_TAX_RULES:             TaxRule[]              = SEED_TAX_RULES.map(taxRuleFromSeed);
const INITIAL_AGREEMENTS:            Agreement[]            = SEED_AGREEMENTS.map(agreementFromSeed);
const INITIAL_AGREEMENT_VERSIONS:    AgreementVersion[]     = SEED_AGREEMENT_VERSIONS.map(agreementVersionFromSeed);
const INITIAL_INTEGRATIONS:          Integration[]          = SEED_INTEGRATIONS.map(integrationFromSeed);
const INITIAL_PAYMENT_PROVIDERS:     PaymentProvider[]      = SEED_PAYMENT_PROVIDERS.map(paymentProviderFromSeed);

function instructorIntegrationFromSeed(s: InstructorIntegrationSeed): InstructorIntegration {
    return {
        id: s.id,
        staffProfileId: s.staff_profile_id,
        slug: s.slug,
        status: s.status,
        connectedAt: s.connected_at,
        accountLabel: s.account_label,
    };
}
const INITIAL_INSTRUCTOR_INTEGRATIONS: InstructorIntegration[] =
    SEED_INSTRUCTOR_INTEGRATIONS.map(instructorIntegrationFromSeed);

// ─── Phase 4 — staff ↔ instructors sync helpers ────────────────────────────
//
// The legacy `instructors` slice still drives pay-rate / payroll / schedule
// reads, while the new `staff` slice owns adds/edits/status changes from the
// Staff & Permissions module. To make both stay in sync (so deactivating a
// staff in S&P also deactivates them in pay-rate, etc.), every staff mutation
// runs through `applyStaffSync()` which mirrors the change into instructors.
// The reverse helpers (`writeInstructorBackToStaff`) keep the pay-rate
// detail / payroll wizard's instructor writes echoed into staff.
//
// Status mapping: `instructor.status` only has 3 values, so `pending` staff
// (an invited but never-logged-in user) is treated as `inactive` in the
// instructor view — they don't appear in payroll runs, schedule pickers,
// etc. until they log in and flip to Active.

/** Map a staff status to its instructor-view equivalent. */
function mapStaffStatusToInstructor(s: StaffStatus): InstructorStatus {
    return s === "pending" ? "inactive" : (s as InstructorStatus);
}

/** Project a Staff row into the Instructor shape, preserving any
 *  instructor-only fields the pay-rate / payroll views may read. Returns
 *  null when the staff's role isn't `instructor`. */
function projectStaffAsInstructor(
    staff: Staff,
    roles: Role[],
    existingInstructor: Instructor | undefined,
): Instructor | null {
    const role = roles.find(r => r.id === staff.roleId);
    if (role?.type !== "instructor") return null;
    return {
        id: staff.id,
        name: staff.fullName,
        initials: staff.initials,
        color: staff.color,
        imageUrl: staff.imageUrl,
        email: staff.email,
        phone: staff.phone,
        joinedDate: staff.joinedDate,
        // Staff branch can be null (Owner = all locations); instructors carry
        // a concrete branch. Fall back to the existing instructor branch when
        // present, otherwise the default seed branch.
        branchId: staff.branchId
            ?? existingInstructor?.branchId
            ?? DEFAULT_BRANCH_ID,
        payRateId: staff.payRateId ?? existingInstructor?.payRateId,
        status: mapStaffStatusToInstructor(staff.status),
    };
}

/** Recompute the `instructors` slice for a list of affected staff ids.
 *  Rows whose role flipped from / to instructor are added or removed. */
function syncInstructorsFromStaff(
    instructors: Instructor[],
    nextStaff: Staff[],
    roles: Role[],
    affectedIds: string[],
): Instructor[] {
    const staffById = new Map(nextStaff.map(s => [s.id, s] as const));
    let next = [...instructors];
    for (const id of affectedIds) {
        const staffRow = staffById.get(id);
        const existing = next.find(i => i.id === id);
        if (!staffRow) {
            // Staff row deleted → remove instructor mirror too.
            next = next.filter(i => i.id !== id);
            continue;
        }
        const projected = projectStaffAsInstructor(staffRow, roles, existing);
        if (!projected) {
            // Role changed off "instructor" → drop from instructors slice.
            next = next.filter(i => i.id !== id);
            continue;
        }
        if (existing) {
            next = next.map(i => i.id === id ? projected : i);
        } else {
            next = [...next, projected];
        }
    }
    return next;
}

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

/** Phase 3 — initial branding now derives from the centralized seed at
 *  `src/data/mock/branding_settings.ts`. The deep-copy below ensures runtime
 *  mutations through `updateBrandingSettings` never leak back into the seed
 *  module's exported object (Zustand state lives in its own reference). */
const INITIAL_BRANDING_SETTINGS: BrandingSettings = {
    ...SEED_BRANDING_SETTINGS,
    menuItems: SEED_BRANDING_SETTINGS.menuItems.map(i => ({ ...i })),
};

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

    /** Branding module (PRD 11 §5) — single source of truth for studio
     *  identity + customer-portal preferences. Read by the Branding landing,
     *  the Design settings sub-page, the Portal preferences sub-page, and
     *  (eventually) the customer-facing portal. */
    brandingSettings: BrandingSettings;
    /** Partial-merge patch over `brandingSettings`. Both branding sub-pages
     *  call this on save; landing re-renders automatically because it
     *  subscribes to the same slice. */
    updateBrandingSettings: (patch: Partial<BrandingSettings>) => void;

    /** Business profile (PRD 11 §4.1) — studio name, locale, contact. */
    businessProfile: BusinessProfile;
    updateBusinessProfile: (patch: Partial<BusinessProfile>) => void;

    /** Branches + Rooms state — live, mutable copies of the seed data so
     *  archive / delete / status-toggle actions persist across navigation.
     *  Phase 4 will migrate the cross-module consumers (Schedule, Customers,
     *  POS, etc.) to read from these slices too. */
    branches: Branch[];
    rooms: Room[];
    businessHours: BusinessHours[];
    addBranch:    (b: Branch) => void;
    updateBranch: (id: string, patch: Partial<Branch>) => void;
    deleteBranch: (id: string) => void;
    addRoom:    (r: Room) => void;
    updateRoom: (id: string, patch: Partial<Room>) => void;
    deleteRoom: (id: string) => void;
    /** Replace a branch's full weekly hours (7 rows, one per day). Adding,
     *  editing, or recovering a branch routes through here so the landing
     *  page, branch detail, and any consumer of `useAppStore(s => s.businessHours)`
     *  reflect the new hours on the same render. */
    setBranchHours: (branchId: string, hours: BusinessHours[]) => void;

    /** Global "Classes settings" record (PRD 11 §6). Booking Rules landing
     *  reads display fields; Customize classes settings 3-step page writes
     *  through `updateClassesSettings` so the landing summary cards and
     *  every downstream consumer (schedule form booking window, waitlist
     *  flow, SMS dispatch, overbooking enforcement) see edits on the same
     *  render. */
    classesSettings: ClassesSettings;
    updateClassesSettings: (patch: Partial<ClassesSettings>) => void;

    /** Cancellation & no-show policies (Booking Rules Phase 2). The
     *  populated container view, the add/edit page, the delete confirm
     *  modal, and any future booking-cancel / booking-no-show flow all
     *  read from this slice so changes propagate on the same render. */
    cancellationPolicies: CancellationPolicy[];
    addCancellationPolicy:    (policy: CancellationPolicy) => void;
    updateCancellationPolicy: (id: string, patch: Partial<CancellationPolicy>) => void;
    deleteCancellationPolicy: (id: string) => void;

    /** Service categories (Booking Rules Phase 3 + Phase 4 wiring) — the
     *  same rows that drive class-template + schedule category selection.
     *  Class-types list/filter, Class-type create/edit, and Schedule
     *  create/edit all read from this slice (Phase 4 migration), so
     *  adding / editing / deleting a category in Booking Rules surfaces
     *  in those modules on the same render. */
    classCategories: ClassCategory[];
    addClassCategory:    (category: ClassCategory) => void;
    updateClassCategory: (id: string, patch: Partial<ClassCategory>) => void;
    /** Removes the category record. Refuses (no-op) when any class
     *  template still references the id — `canDeleteClassCategory` is the
     *  read-side guard the UI consults before calling this. */
    deleteClassCategory: (id: string) => void;
    /** True when no class template references this category id. */
    canDeleteClassCategory: (id: string) => boolean;

    setRole: (role: UserRole) => void;
    setCurrentUser: (user: User) => void;
    /** Phase 3 — partial-merge patch over `currentUser`. The Account
     *  settings modals (Edit profile / Change email / Change phone /
     *  Change password) call this with only the field(s) they edit; every
     *  consumer that subscribes to `currentUser` (Sidebar avatar chip,
     *  Customer Plan-tab "removed by" attribution, Add complimentary
     *  credit granter, the Account page itself) re-renders in the same
     *  render cycle. */
    updateAccountProfile: (patch: Partial<User>) => void;
    toggleSidebar: () => void;
    setSidebarCollapsed: (collapsed: boolean) => void;

    addClassTemplate: (template: Omit<ClassTemplate, "id">) => void;
    updateClassTemplate: (id: string, updates: Partial<Omit<ClassTemplate, "id">>) => void;
    deleteClassTemplate: (id: string) => void;

    addClassSchedule: (schedule: Omit<ClassSchedule, "id">) => string;
    addClassSchedules: (schedules: Omit<ClassSchedule, "id">[]) => void;
    updateClassSchedule: (id: string, updates: Partial<Omit<ClassSchedule, "id">>) => void;
    /**
     *  Cancel a class. `cancelledBy` records the human-readable attribution
     *  on the schedule row (admin name, instructor name, system label). If
     *  omitted, falls back to the active user's `full_name`, then to
     *  "Alex Owen" — the seed Owner persona — so legacy call-sites stay
     *  backward-compatible while new callers can pass an explicit name.
     */
    cancelClassSchedule: (id: string, refundCredits: boolean, cancelledBy?: string) => void;
    // ── Booking lifecycle: source params let UI callers attribute a
    //    cancellation to the surface that triggered it (admin / customer
    //    portal / front_desk / system). Defaulting to "admin" preserves
    //    existing behaviour for any caller that hasn't migrated yet.

    cancelClassBooking: (id: string, reason: string, refund: boolean, source?: ClassBooking["cancelledSource"]) => void;
    removeClassBooking: (id: string) => void;
    removeClassBookings: (ids: string[]) => void;
    cancelClassBookings: (ids: string[], reason: string, refund: boolean, source?: ClassBooking["cancelledSource"]) => void;
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
    freezeCustomerPlan: (planId: string, startISO: string, endISO: string, source?: CustomerPlan["freezeSource"]) => void;
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

    // ── Customer notification settings (PRD 11 §12) ───────────────────────
    notificationSettings: NotificationSetting[];
    /** Flip a single event's channel toggle. */
    setNotificationEventChannel: (id: string, channel: "email" | "whatsapp" | "push", enabled: boolean) => void;
    /** Save a template edit (subject / email body / whatsapp body) for one event. */
    updateNotificationTemplate: (id: string, patch: Partial<Pick<NotificationSetting, "emailSubject" | "emailTemplate" | "whatsappTemplate">>) => void;

    // ── In-app notifications feed (PRD 12) ────────────────────────────────
    /** Notification feed records — drives the bell-icon dropdown and the
     *  `/admin/notifications` page. Records are appended by other actions
     *  (`addClassBooking`, `applyPurchase`, `cancelClassBooking`, etc.) so
     *  the feed stays in lock-step with the rest of the data. */
    notifications: Notification[];
    /** Audit log — every back-office mutation that the team-activity feed
     *  needs to surface. Capped at the 200 most-recent entries so the
     *  persisted blob stays small (older rows roll off automatically when
     *  `recordAudit` pushes a new one). */
    auditLog: AuditLogEntry[];
    /** One-liner helper called by mutators across the store to record a
     *  back-office action. Reads `currentUser` internally for the actor;
     *  callers only pass action + target + optional metadata. */
    recordAudit: (action: string, targetType: AuditLogEntry["targetType"], targetId: string, targetName: string, metadata?: AuditLogEntry["metadata"]) => void;
    /** Append a new notification — used by the cross-module triggers below. */
    addNotification: (input: Omit<Notification, "id" | "createdAt" | "isRead"> & { id?: string; createdAt?: string; isRead?: boolean }) => string;
    /** Fan-out emitter — single point through which every cross-module
     *  trigger publishes notifications to one OR both audiences. Each
     *  payload is appended via `addNotification` with the matching
     *  `audience` stamped on the row, so the bell + the page can scope
     *  to the right viewer without any other plumbing. Skipping a key
     *  (admin or instructor) means that audience gets no row.
     *
     *  Use this — not `addNotification` directly — for every new
     *  cross-module event so the admin/instructor feeds stay in lockstep. */
    emitNotifications: (input: {
        admin?:      Omit<Notification, "id" | "createdAt" | "isRead" | "audience">;
        instructor?: Omit<Notification, "id" | "createdAt" | "isRead" | "audience">;
    }) => void;
    /** Mark a single notification as read (e.g. on click-through). */
    markNotificationRead: (id: string) => void;
    /** Mark every unread notification as read at once. */
    markAllNotificationsRead: () => void;
    /** Soft-dismiss a notification (removes from the bell + page feed). */
    dismissNotification: (id: string) => void;

    // ── Referral settings (PRD 11 §11) ────────────────────────────────────
    referralSettings: ReferralSettings;
    /** Flip the referral-program master switch. Customer-facing referral UI
     *  reads this — when off, the customer detail Referrals tab hides the
     *  share CTA and surfaces a "program inactive" notice. */
    setReferralProgramActive: (active: boolean) => void;
    /** Save the "Edit referral settings" wizard — covers BOTH the new-customer
     *  benefit (step 1) and the existing-customer benefit (step 2). */
    updateReferralRewards: (patch: Partial<Pick<ReferralSettings,
        | "newCustomerCredits" | "newCustomerMessage"
        | "existingCustomerTrigger" | "existingCustomerMinReferred"
        | "existingCustomerCredits" | "existingCustomerMessage"
    >>) => void;
    /** Save the "Customize referral information" form — customer-facing copy. */
    updateReferralInformation: (patch: Partial<Pick<ReferralSettings,
        "infoDescription"
    >>) => void;

    // ── Tax module (PRD 11 §10) ────────────────────────────────────────────
    /** Live tax rates — powers /admin/settings/tax → Tax rates list +
     *  (Phase 3) the "Apply tax rates" tab dropdowns. */
    taxRates: TaxRate[];
    /** Studio-wide tax display mode toggle. */
    taxSettings: TaxSettings;
    /** Flip the global "Prices include tax" toggle. */
    setPricesIncludeTax: (value: boolean) => void;
    /** Append a new tax rate. Auto-generates id + createdAt when not
     *  supplied. Returns the resolved id. (Phase 2 wires the modal to this.) */
    addTaxRate: (input: Omit<TaxRate, "id" | "createdAt"> & { id?: string; createdAt?: string }) => string;
    /** Patch a tax rate — used by the Edit modal in Phase 2. */
    updateTaxRate: (id: string, patch: Partial<Omit<TaxRate, "id">>) => void;
    /** Bulk status flip — row + bulk Archive / Deactivate / Reactivate /
     *  Recover all route through this single action. */
    setTaxRatesStatus: (ids: string[], status: TaxRateStatus) => void;
    /** Hard-delete tax rates. Active rows with no usage delete cleanly;
     *  the cross-module sync in this action also clears any `tax_rules`
     *  that referenced the deleted rate (their `taxRateId` falls back to
     *  undefined and the row drops to the "Select tax rate" placeholder). */
    deleteTaxRates: (ids: string[]) => { deleted: string[]; blocked: string[] };

    // ── Tax rules (Apply tax rates tab) ────────────────────────────────────
    /** Live tax rules — one row per applied rule across the four
     *  predefined categories (Membership / Credit package / Gift card /
     *  Pay rate). Drives `hasUsage` derivation for the Tax rates list. */
    taxRules: TaxRule[];
    /** Append a blank rule under `category` — created by the "+ Add another
     *  tax rule" button. Returns the new rule's id so the caller can scroll
     *  / focus it. */
    addTaxRule: (category: TaxRuleCategory) => string;
    /** Patch any field on a tax rule — used by the rate + location dropdowns. */
    updateTaxRule: (id: string, patch: Partial<Omit<TaxRule, "id" | "createdAt">>) => void;
    /** Flip the per-rule active/inactive toggle. */
    setTaxRuleStatus: (id: string, status: TaxRuleStatus) => void;
    /** Hard-delete one tax rule (the trash-icon button on each row). */
    deleteTaxRule: (id: string) => void;

    // ── Agreements module (PRD 11 §9) ─────────────────────────────────────
    /** Live agreements — drives /admin/settings/agreements list + detail. */
    agreements: Agreement[];
    /** Per-version content (text or uploaded file). Phase 3's version-history
     *  table reads from here; Phase 1's list view only uses the parent
     *  `Agreement.currentVersion` for the "Version N" subtext. */
    agreementVersions: AgreementVersion[];
    /** Append a new agreement. Phase 2's create wizard wires through this.
     *  Auto-generates id + timestamps when not supplied. */
    addAgreement: (input: Omit<Agreement, "id" | "createdAt" | "updatedAt"> & {
        id?: string; createdAt?: string; updatedAt?: string;
    }) => string;
    /** Patch any field on an agreement (used by the Edit flow in Phase 2 +
     *  the new-version flow in Phase 3 to bump `currentVersion`). Bumps
     *  `updatedAt` automatically. */
    updateAgreement: (id: string, patch: Partial<Omit<Agreement, "id" | "createdAt">>) => void;
    /** Bulk status flip — row + bulk Archive / Recover both route here.
     *  Brief excludes delete/deactivate for agreements (legal records). */
    setAgreementsStatus: (ids: string[], status: AgreementStatus) => void;
    /** Append a new published version. Phase 3 "Add new version" flow uses
     *  this — it both inserts the version row AND patches the parent's
     *  `currentVersion` + `updatedAt` to keep the list view's "Version N"
     *  subtext in sync. */
    addAgreementVersion: (input: Omit<AgreementVersion, "id" | "publishedAt"> & {
        id?: string; publishedAt?: string;
    }) => string;
    /** Republish — flip every customer's `customer_agreements` row for this
     *  (agreementId, versionNumber) pair from "signed" back to "unsigned" so
     *  they have to re-sign on the customer side. Older versions stay
     *  signed (historical record preserved). */
    republishAgreementVersion: (agreementId: string, versionNumber: number) => void;

    // ── Integrations module (PRD 11 §8) ───────────────────────────────────
    /** Live integrations — drives /admin/settings/integrations card grid. */
    integrations: Integration[];
    /** Simulated connect — flip status to "connected", stamp `connectedAt`,
     *  and persist an optional account label (shown later in the Phase 2
     *  View modal). No real OAuth — see Phase 3 brief. */
    connectIntegration: (id: string, accountLabel?: string) => void;
    /** Reverse of `connectIntegration` — flip back to "not_connected" and
     *  clear `connectedAt` + `accountLabel`. */
    disconnectIntegration: (id: string) => void;

    // ── Instructor calendar integrations (per-instructor) ─────────────────
    /** Per-staff calendar connections — drives the Integrations tab on
     *  /instructor/account. One row per (staffProfileId, slug). */
    instructorIntegrations: InstructorIntegration[];
    /** Connect a specific (staffProfileId, slug) row — flip status to
     *  "connected", stamp `connectedAt`, persist the account email so the
     *  View modal can render it. */
    connectInstructorIntegration: (staffProfileId: string, slug: InstructorIntegrationSlug, accountLabel?: string) => void;
    /** Reverse — flip back to "not_connected" + clear timestamp/email. */
    disconnectInstructorIntegration: (staffProfileId: string, slug: InstructorIntegrationSlug) => void;

    // ── Payments module (PRD 11 §7) ───────────────────────────────────────
    /** Live payment providers — drives /admin/settings/payments card grid
     *  AND (Phase 3) the POS Checkout payment-method selector. */
    paymentProviders: PaymentProvider[];
    /** Connect a gateway / Enable a wallet. Flips status to "connected",
     *  stamps `connectedAt` + optional `accountLabel`. Phase 1 fires
     *  directly from the button; Phase 2 routes through the Connect modal. */
    connectPaymentProvider: (id: string, accountLabel?: string) => void;
    /** Disconnect a provider. Cascades — when a GATEWAY is disconnected,
     *  every wallet whose `requiresProviderSlug` points at it is also
     *  flipped back to "not_connected" in the same render cycle (so the
     *  POS payment grid never shows orphaned wallets). */
    disconnectPaymentProvider: (id: string) => void;

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
     *  records (zero classes taught, zero ratings received, zero payroll
     *  entries). Status must also be Pending (never accepted invite) or
     *  Archive (intentionally retired) — Active/Inactive rows must be
     *  Archived first. UI surfaces should gate the Delete affordance on
     *  `canDeleteStaff(id)` to avoid offering an action the store will refuse. */
    canDeleteStaff: (id: string) => boolean;
    deleteStaff: (ids: string[]) => { deleted: string[]; blocked: string[] };

    setPendingPurchase: (purchase: PendingPurchase | null) => void;
    applyPurchase: (customerId: string, items: PurchaseLineItem[], paymentSource?: CustomerTransaction["paymentSource"]) => void;

    showToast: (title: string, message: string, type?: "success" | "error", icon?: ToastData["icon"]) => void;
    clearToast: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence — Zustand `persist` middleware (localStorage)
// ─────────────────────────────────────────────────────────────────────────────
//
// Every data slice survives a page refresh and syncs across browser
// tabs. Anything a tester creates / edits / cancels / marks present
// during a demo session sticks until they explicitly wipe the demo
// state from the browser.
//
// ── Resetting back to the seeded mock data ─────────────────────────
//
// Option A (surgical, dev-friendly):
//   Chrome / Firefox DevTools → Application → Local Storage → right-
//   click the `onra-demo-state` key → Delete → refresh the page.
//
// Option B (full reset, tester-friendly):
//   Browser settings → Privacy → Clear browsing data for this site
//   (NOTE: this also clears cookies / cache / other site storage).
//
// Either way, the next page load finds no persisted state, falls back
// to the seed files in `src/data/mock/`, and re-builds the store from
// scratch.
//
// ── What's EXCLUDED from persistence (per-tab state) ──────────────
//
//   • currentUser / currentRole — the URL-driven persona auto-flip in
//     each layout sets these per tab. Persisting them would mean Tab A
//     (admin) switches persona when Tab B (instructor) loads.
//   • sidebarCollapsed — tab-local UI preference.
//   • toast — ephemeral notification, must NOT survive refresh.
//   • pendingPurchase — in-flight POS checkout state.
//
// Everything else (every business data slice, every settings record,
// every action-snapshot) IS persisted.
//
// ── Schema versioning ──────────────────────────────────────────────
//
// `version: 1` — when the AppState shape changes in a breaking way,
// bump this number. Zustand will discard the old payload and re-seed
// from the mock files (acceptable for a demo — no migration logic
// needed; testers get fresh seed data after a deploy with schema
// changes).
//
// ── Cross-tab sync ────────────────────────────────────────────────
//
// The `window.storage` listener at the bottom of this file rehydrates
// the active tab's store whenever ANOTHER tab writes. Result: open
// admin in Tab A and instructor in Tab B — admin creates a class →
// instructor tab sees the new row instantly without a manual refresh.

const PERSIST_KEY = "onra-demo-state";

export const useAppStore = create<AppState>()(persist(
    (set, get) => ({
    currentRole: "admin",
    currentUser: adminUser,
    brandingSettings: { ...INITIAL_BRANDING_SETTINGS, menuItems: [...INITIAL_BRANDING_SETTINGS.menuItems] },
    businessProfile: {
        name: "Forma Studio",
        logoUrl: "",
        website: "forma.studio.com",
        country: "United Arab Emirates",
        currency: "AED",
        timezone: "Asia/Dubai",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
    },
    branches:      SEED_BRANCHES.map(b => ({ ...b })),
    rooms:         SEED_ROOMS.map(r => ({ ...r })),
    businessHours: SEED_BUSINESS_HOURS.map(h => ({ ...h })),
    classesSettings: { ...SEED_CLASSES_SETTINGS },
    cancellationPolicies: SEED_CANCELLATION_POLICIES.map(p => ({ ...p })),
    classCategories: SEED_CLASS_CATEGORIES.map(c => ({ ...c })),
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
    notificationSettings: [...INITIAL_NOTIFICATION_SETTINGS],
    notifications: [...INITIAL_NOTIFICATIONS],
    auditLog: [],
    referralSettings: { ...INITIAL_REFERRAL_SETTINGS },
    taxRates: [...INITIAL_TAX_RATES],
    taxSettings: { ...INITIAL_TAX_SETTINGS },
    taxRules: [...INITIAL_TAX_RULES],
    agreements: [...INITIAL_AGREEMENTS],
    agreementVersions: [...INITIAL_AGREEMENT_VERSIONS],
    integrations: [...INITIAL_INTEGRATIONS],
    instructorIntegrations: [...INITIAL_INSTRUCTOR_INTEGRATIONS],
    paymentProviders: [...INITIAL_PAYMENT_PROVIDERS],
    pendingPurchase: null,
    toast: null,

    updateBusinessProfile: (patch) => {
        const name = get().businessProfile.name;
        set(state => ({
            businessProfile: { ...state.businessProfile, ...patch },
        }));
        get().recordAudit("Updated business profile", "settings", "business_profile", name);
    },

    addBranch:    (b)         => {
        set(state => ({ branches: [b, ...state.branches] }));
        get().recordAudit("Created branch", "branch", b.id, b.name);
    },
    updateBranch: (id, patch) => {
        const target = get().branches.find(b => b.id === id);
        set(state => {
            const nextBranches = state.branches.map(b => b.id === id ? { ...b, ...patch } : b);
            // Phase 3 cascade — `classSchedules.location` is a denormalized
            // snapshot of the branch's name. Renaming a branch must update
            // every schedule row that lives there, otherwise the admin +
            // instructor schedule cards keep showing the old branch name.
            if (patch.name === undefined) return { branches: nextBranches };
            const newName = patch.name;
            return {
                branches: nextBranches,
                classSchedules: state.classSchedules.map(s =>
                    s.branchId === id ? { ...s, location: newName } : s,
                ),
            };
        });
        if (target) get().recordAudit("Edited branch", "branch", id, target.name);
    },
    setBranchHours: (branchId, hours) => {
        const target = get().branches.find(b => b.id === branchId);
        set(state => ({
            businessHours: [
                ...state.businessHours.filter(h => h.branch_id !== branchId),
                ...hours,
            ],
        }));
        if (target) get().recordAudit("Updated business hours", "branch", branchId, target.name);
    },
    updateClassesSettings: (patch) => {
        set(state => ({
            classesSettings: { ...state.classesSettings, ...patch },
        }));
        get().recordAudit("Updated booking rules", "settings", "classes_settings", "Booking rules");
    },
    addCancellationPolicy: (policy) => {
        set(state => ({
            cancellationPolicies: [policy, ...state.cancellationPolicies],
        }));
        get().recordAudit("Created cancellation policy", "settings", policy.id, policy.name);
    },
    updateCancellationPolicy: (id, patch) => {
        const target = get().cancellationPolicies.find(p => p.id === id);
        set(state => ({
            cancellationPolicies: state.cancellationPolicies.map(p => p.id === id ? { ...p, ...patch } : p),
        }));
        if (target) get().recordAudit("Edited cancellation policy", "settings", id, target.name);
    },
    deleteCancellationPolicy: (id) => {
        const target = get().cancellationPolicies.find(p => p.id === id);
        set(state => ({
            cancellationPolicies: state.cancellationPolicies.filter(p => p.id !== id),
        }));
        if (target) get().recordAudit("Deleted cancellation policy", "settings", id, target.name);
    },
    addClassCategory: (category) => {
        set(state => ({
            classCategories: [category, ...state.classCategories],
        }));
        get().recordAudit("Created class category", "settings", category.id, category.name);
    },
    updateClassCategory: (id, patch) => {
        const target = get().classCategories.find(c => c.id === id);
        set(state => ({
            classCategories: state.classCategories.map(c => c.id === id ? { ...c, ...patch } : c),
        }));
        if (target) get().recordAudit("Edited class category", "settings", id, target.name);
    },
    deleteClassCategory: (id) => set(state => {
        // Refuse the delete when any class template still references the
        // category. The UI consults `canDeleteClassCategory` first and
        // surfaces a friendly toast; this guard is the belt-and-suspenders
        // store-side enforcement.
        const referenced = state.classTemplates.some(t => t.categoryId === id);
        if (referenced) return {};
        return { classCategories: state.classCategories.filter(c => c.id !== id) };
    }),
    canDeleteClassCategory: (id) => {
        return !get().classTemplates.some(t => t.categoryId === id);
    },
    deleteBranch: (id)        => set(state => ({
        branches: state.branches.filter(b => b.id !== id),
        // Cascade — rooms + business hours under a deleted branch go with it.
        rooms:         state.rooms.filter(r => r.branch_id !== id),
        businessHours: state.businessHours.filter(h => h.branch_id !== id),
    })),
    addRoom:    (r)         => {
        set(state => ({ rooms: [r, ...state.rooms] }));
        get().recordAudit("Created room", "room", r.id, r.name);
    },
    updateRoom: (id, patch) => {
        const target = get().rooms.find(r => r.id === id);
        set(state => {
            const nextRooms = state.rooms.map(r => r.id === id ? { ...r, ...patch } : r);
            // Phase 3 cascade — `classSchedules.room` is a denormalized snapshot
            // of the room's name. Without this cascade, renaming a room leaves
            // every existing schedule card (admin + instructor) showing the OLD
            // name. Patch all schedules whose roomId matches.
            if (patch.name === undefined) return { rooms: nextRooms };
            const newName = patch.name;
            return {
                rooms: nextRooms,
                classSchedules: state.classSchedules.map(s =>
                    s.roomId === id ? { ...s, room: newName } : s,
                ),
            };
        });
        if (target) get().recordAudit("Edited room", "room", id, target.name);
    },
    deleteRoom: (id)        => {
        const target = get().rooms.find(r => r.id === id);
        set(state => ({ rooms: state.rooms.filter(r => r.id !== id) }));
        if (target) get().recordAudit("Deleted room", "room", id, target.name);
    },

    updateBrandingSettings: (patch) => {
        set((state) => ({
            brandingSettings: {
                ...state.brandingSettings,
                ...patch,
                // Defensive deep-copy for menuItems so callers can mutate
                // their local arrays without leaking into store state.
                menuItems: patch.menuItems
                    ? patch.menuItems.map(i => ({ ...i }))
                    : state.brandingSettings.menuItems,
            },
        }));
        get().recordAudit("Updated branding", "settings", "branding", "Branding");
    },

    setRole: (role) => set({ currentRole: role }),
    setCurrentUser: (user) => set({ currentUser: user, currentRole: user.role }),
    updateAccountProfile: (patch) => {
        const before = get().currentUser;
        const beforeName = before ? `${before.first_name} ${before.last_name}`.trim() : "Account";
        // Phase 4 centralization cascade — when the currently-logged-in user
        // is an instructor (role === "instructor" + staff_profile_id set),
        // mirror identity edits to every other slice that holds a copy of
        // the same instructor. Without this, an instructor renaming
        // themselves in /instructor/account would leave the admin Staff
        // list, Pay rate, Payroll, Schedule (denormalized instructorName),
        // and class-detail roster all showing the OLD name + email + phone
        // + avatar.
        //
        // The cascade is single-direction (instructor profile → other
        // slices). Admin edits to staff still flow through their dedicated
        // mutators, which already keep the other admin slices in sync —
        // none of those touch `currentUser` since the admin isn't editing
        // their own auth profile when they update a staff row.
        set((state) => {
            const nextUser = { ...state.currentUser, ...patch };
            const staffId = (nextUser as typeof nextUser & { staff_profile_id?: string }).staff_profile_id;

            // Bail out of the cascade when we're not editing an instructor
            // persona — admin/member edits stay as a simple currentUser merge.
            if (nextUser.role !== "instructor" || !staffId) {
                return { currentUser: nextUser };
            }

            // Derive the cascade fields off the merged user — `patch` may
            // change only one of (first_name, last_name, avatar_url, email,
            // phone, password) so we always compute from the merged shape.
            const fullName = `${nextUser.first_name ?? ""} ${nextUser.last_name ?? ""}`.trim();
            const initials = `${(nextUser.first_name?.[0] ?? "").toUpperCase()}${(nextUser.last_name?.[0] ?? "").toUpperCase()}` || "??";
            const imageUrl = nextUser.avatar_url ?? undefined;
            const email = nextUser.email ?? "";
            const phone = nextUser.phone ?? "";

            // Phase 3 cascade — instructor's `introduction` (User-level
            // free-text bio shown in /instructor/account) mirrors to
            // `staff[].bio` so admin sees the same copy on the staff
            // profile page. The merged user shape carries it via
            // optional chaining (instructor_profile augments User).
            const introduction = (nextUser as typeof nextUser & { introduction?: string }).introduction;

            return {
                currentUser: nextUser,
                // staff[] (camelCase store) — drives admin Staff & Permissions list
                staff: state.staff.map(s =>
                    s.id === staffId
                        ? {
                            ...s,
                            firstName: nextUser.first_name ?? s.firstName,
                            lastName:  nextUser.last_name  ?? s.lastName,
                            fullName,
                            email,
                            phone,
                            imageUrl: imageUrl ?? s.imageUrl,
                            initials,
                            // Bio cascade: only patch when the merged user
                            // has a defined introduction so callers that
                            // edit just the name/email don't accidentally
                            // clobber an existing staff bio.
                            bio: introduction !== undefined ? introduction : s.bio,
                        }
                        : s,
                ),
                // instructors[] — drives pay-rate + payroll + class roster
                instructors: state.instructors.map(i =>
                    i.id === staffId
                        ? {
                            ...i,
                            fullName,
                            email,
                            phone,
                            imageUrl: imageUrl ?? i.imageUrl,
                            initials,
                        }
                        : i,
                ),
                // classSchedules[] denormalizes instructor identity for fast
                // list render — keep those snapshots fresh too.
                classSchedules: state.classSchedules.map(c =>
                    c.instructorId === staffId
                        ? {
                            ...c,
                            instructorName: fullName,
                            instructorInitials: initials,
                        }
                        : c,
                ),
            };
        });
        get().recordAudit("Updated own profile", "account", before?.id ?? "self", beforeName);
    },
    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

    addClassTemplate: (template) => {
        const id = `t-${Date.now()}`;
        set((state) => ({
            classTemplates: [{ ...template, id }, ...state.classTemplates],
        }));
        get().recordAudit("Created class template", "class_template", id, template.name);
    },
    updateClassTemplate: (id, updates) => {
        const target = get().classTemplates.find(t => t.id === id);
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
        });
        if (target) get().recordAudit("Edited class template", "class_template", id, updates.name ?? target.name);
    },
    deleteClassTemplate: (id) => {
        const target = get().classTemplates.find(t => t.id === id);
        set((state) => ({ classTemplates: state.classTemplates.filter(t => t.id !== id) }));
        if (target) get().recordAudit("Deleted class template", "class_template", id, target.name);
    },

    addClassSchedule: (schedule) => {
        const id = `cs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((state) => ({ classSchedules: [...state.classSchedules, { ...schedule, id }] }));
        // Phase 4 sync — fire a notification to the instructor whose
        // schedule just got a new class. Admin gets a parallel audit row.
        if (schedule.instructorId) {
            get().emitNotifications({
                admin: {
                    tab: "booking",
                    event: "class_scheduled",
                    title: "Class scheduled",
                    body: `${schedule.name} added — ${schedule.dayOfWeek} ${schedule.displayTime}, assigned to ${schedule.instructorName}.`,
                    icon: "calendar-check",
                    sourceModule: "class",
                    sourceId: id,
                    classScheduleId: id,
                    branchId: schedule.branchId,
                },
                instructor: {
                    tab: "booking",
                    event: "class_scheduled",
                    title: "New class on your schedule",
                    body: `${schedule.name} added — ${schedule.dayOfWeek} ${schedule.displayTime} at ${schedule.room}.`,
                    icon: "calendar-check",
                    sourceModule: "class",
                    sourceId: id,
                    classScheduleId: id,
                    branchId: schedule.branchId,
                    targetInstructorId: schedule.instructorId,
                },
            });
        }
        return id;
    },
    addClassSchedules: (schedules) => {
        const withIds = schedules.map((s, i) => ({ ...s, id: `cs-${Date.now()}-${i}` }));
        set((state) => ({
            classSchedules: [...state.classSchedules, ...withIds],
        }));
        // Phase 4 sync — admin's schedule form creates classes through
        // THIS mutator (covers both single-day and recurring multi-day
        // creation via [ScheduleFormPage.tsx:1497](src/components/schedule/ScheduleFormPage.tsx#L1497)).
        // Group the new rows by `instructorId` so a recurring set of N
        // instances notifies the instructor ONCE (summary) instead of N
        // times — a cleaner bell, same admin↔instructor sync guarantee.
        const byInstructor = new Map<string, typeof withIds>();
        for (const sched of withIds) {
            if (!sched.instructorId) continue;
            const bucket = byInstructor.get(sched.instructorId) ?? [];
            bucket.push(sched);
            byInstructor.set(sched.instructorId, bucket);
        }
        // Use Array.from(...) for the iteration so we don't depend on the
        // tsconfig `target` allowing `Map` to be `for..of`-iterated directly.
        for (const [instructorId, group] of Array.from(byInstructor.entries())) {
            const sample = group[0];
            const isRecurring = group.length > 1;
            // Use the first row as the click-through anchor for both
            // single + recurring (admin's schedule detail will surface
            // the recurrence group via `recurrenceGroupId`).
            const adminBody = isRecurring
                ? `${group.length} ${sample.name} classes added, assigned to ${sample.instructorName}.`
                : `${sample.name} added — ${sample.dayOfWeek} ${sample.displayTime}, assigned to ${sample.instructorName}.`;
            const instructorBody = isRecurring
                ? `${group.length} new ${sample.name} classes added to your schedule.`
                : `${sample.name} added — ${sample.dayOfWeek} ${sample.displayTime} at ${sample.room}.`;
            get().emitNotifications({
                admin: {
                    tab: "booking",
                    event: "class_scheduled",
                    title: isRecurring ? "Classes scheduled" : "Class scheduled",
                    body: adminBody,
                    icon: "calendar-check",
                    sourceModule: "class",
                    sourceId: sample.id,
                    classScheduleId: sample.id,
                    branchId: sample.branchId,
                },
                instructor: {
                    tab: "booking",
                    event: "class_scheduled",
                    title: isRecurring ? "New classes on your schedule" : "New class on your schedule",
                    body: instructorBody,
                    icon: "calendar-check",
                    sourceModule: "class",
                    sourceId: sample.id,
                    classScheduleId: sample.id,
                    branchId: sample.branchId,
                    targetInstructorId: instructorId,
                },
            });
        }
    },
    updateClassSchedule: (id, updates) => {
        const stateBefore = get();
        const before = stateBefore.classSchedules.find(s => s.id === id);
        set((state) => ({
            classSchedules: state.classSchedules.map(s => s.id === id ? { ...s, ...updates } : s),
        }));
        // Phase 4 sync — fire a notification only when an instructor-
        // relevant field actually changed. Quiet for cover-image swaps,
        // capacity tweaks, etc. that don't affect the instructor's day.
        if (!before) return;
        const after = { ...before, ...updates };
        const dateChanged    = updates.dateISO !== undefined && updates.dateISO !== before.dateISO;
        const timeChanged    = (updates.startTime !== undefined && updates.startTime !== before.startTime)
                            || (updates.endTime   !== undefined && updates.endTime   !== before.endTime);
        const roomChanged    = updates.roomId !== undefined && updates.roomId !== before.roomId;
        const reassignedAway = updates.instructorId !== undefined && updates.instructorId !== before.instructorId;
        // Notify the new instructor when reassigned (they got a class);
        // notify the old instructor when reassigned away (they lost one);
        // notify the same instructor for date/time/room changes.
        if (reassignedAway) {
            // New instructor got a class
            get().emitNotifications({
                instructor: {
                    tab: "booking",
                    event: "class_scheduled",
                    title: "New class on your schedule",
                    body: `${after.name} added — ${after.dayOfWeek} ${after.displayTime} at ${after.room}.`,
                    icon: "calendar-check",
                    sourceModule: "class",
                    sourceId: id,
                    classScheduleId: id,
                    branchId: after.branchId,
                    targetInstructorId: after.instructorId,
                },
            });
            // Old instructor lost a class — re-use class_rescheduled
            // with copy that signals removal so the bell still narrates
            // the change for them.
            get().emitNotifications({
                instructor: {
                    tab: "booking",
                    event: "class_rescheduled",
                    title: "Class reassigned",
                    body: `${before.name} on ${before.dayOfWeek} ${before.displayTime} was reassigned to another instructor.`,
                    icon: "calendar-check",
                    sourceModule: "class",
                    sourceId: id,
                    classScheduleId: id,
                    branchId: before.branchId,
                    targetInstructorId: before.instructorId,
                },
            });
        } else if (dateChanged || timeChanged || roomChanged) {
            const changes: string[] = [];
            if (dateChanged) changes.push(`date → ${after.date}`);
            if (timeChanged) changes.push(`time → ${after.displayTime}`);
            if (roomChanged) changes.push(`room → ${after.room}`);
            const summary = changes.join(", ");
            get().emitNotifications({
                admin: {
                    tab: "booking",
                    event: "class_rescheduled",
                    title: "Class rescheduled",
                    body: `${after.name} updated — ${summary}.`,
                    icon: "calendar-check",
                    sourceModule: "class",
                    sourceId: id,
                    classScheduleId: id,
                    branchId: after.branchId,
                },
                instructor: {
                    tab: "booking",
                    event: "class_rescheduled",
                    title: "Your class was updated",
                    body: `${after.name} updated — ${summary}.`,
                    icon: "calendar-check",
                    sourceModule: "class",
                    sourceId: id,
                    classScheduleId: id,
                    branchId: after.branchId,
                    targetInstructorId: after.instructorId,
                },
            });
        }
    },
    cancelClassSchedule: (id, refundCredits, cancelledBy) =>
        {
            const stateBefore = get();
            const schedule = stateBefore.classSchedules.find(s => s.id === id);
            // "Affected" count for the notification suffix — everyone who
            // had a live claim on the class at cancel time (booked OR
            // waitlisted). Both groups get refund credit + a single
            // Cancelled-tab row per the consolidated cancel model below.
            const affected = stateBefore.classBookings.filter(b =>
                b.classScheduleId === id && (b.status === "booked" || b.status === "waitlisted"),
            ).length;
            // Resolve attribution: explicit param > active user's name >
            // "Alex Owen" fallback. Keeps every legacy caller working
            // while new admin / instructor surfaces can pass the correct
            // attribution. `currentUser` uses `first_name` + `last_name`
            // (the Supabase-compatible shape), so we join them here.
            const u = stateBefore.currentUser;
            const userFullName = u ? `${u.first_name} ${u.last_name}`.trim() : "";
            const attribution = cancelledBy
                ?? (userFullName.length > 0 ? userFullName : "Alex Owen");
            set((state) => {
                const now = new Date().toISOString();
                return {
                    classSchedules: state.classSchedules.map(s =>
                        s.id === id ? { ...s, status: "Cancelled" as ClassStatus, cancelledAt: now, cancelledBy: attribution } : s
                    ),
                    // **Tab-preservation cancel model** — bookings keep
                    // their ORIGINAL `status` (booked / waitlisted /
                    // cancelled) so each tab on the class detail page
                    // stays populated. The page renders a "Cancelled"
                    // status badge on rows when the parent class is
                    // Cancelled — the visual flips, but the tab
                    // classification doesn't change.
                    //
                    // Only the refund flag is set on booked + waitlisted
                    // rows so the refund-tracking column reflects
                    // that those customers were eligible for refund.
                    //
                    // Effect on the detail page tabs after this runs:
                    //   • Booked tab     → still shows originally-booked
                    //                      customers, with a "Cancelled"
                    //                      status badge per row
                    //   • Waitlisted tab → still shows originally-
                    //                      waitlisted customers (no
                    //                      status column on this tab per
                    //                      Figma)
                    //   • Cancelled tab  → still shows customer-self-
                    //                      cancelled bookings, with the
                    //                      timing-based late/no-charge
                    //                      badge
                    classBookings: state.classBookings.map(b =>
                        b.classScheduleId === id
                        && (b.status === "booked" || b.status === "waitlisted")
                            ? { ...b, refundCreditIssued: refundCredits }
                            : b
                    ),
                };
            });
            // Feed: surface in the notification center (PRD 12). Click-
            // through routes to /schedule/[id] via `classScheduleId`. The
            // instructor of the cancelled class gets their own row —
            // attributed via `targetInstructorId` so it lands in their
            // bell and nobody else's.
            if (schedule) {
                const suffix = affected > 0
                    ? ` ${affected} booking${affected === 1 ? "" : "s"} ${affected === 1 ? "was" : "were"} affected.`
                    : "";
                get().emitNotifications({
                    admin: {
                        tab: "booking",
                        event: "class_cancelled",
                        title: "Class Cancelled",
                        body: `${schedule.name} on ${schedule.dayOfWeek} at ${schedule.displayTime} was cancelled.${suffix}`,
                        icon: "calendar-x",
                        sourceModule: "class",
                        sourceId: id,
                        classScheduleId: id,
                        branchId: schedule.branchId,
                    },
                    instructor: {
                        tab: "booking",
                        event: "class_cancelled",
                        title: "Class Cancelled",
                        body: `Your ${schedule.name} class on ${schedule.dayOfWeek} at ${schedule.displayTime} was cancelled.${suffix}`,
                        icon: "calendar-x",
                        sourceModule: "class",
                        sourceId: id,
                        classScheduleId: id,
                        branchId: schedule.branchId,
                        targetInstructorId: schedule.instructorId,
                    },
                });
            }
        },

    cancelClassBooking: (id, reason, refund, source) => {
        const stateBefore = get();
        const booking = stateBefore.classBookings.find(b => b.id === id);
        const customer = booking ? stateBefore.customers.find(c => c.id === booking.customerId) : undefined;
        const schedule = booking ? stateBefore.classSchedules.find(s => s.id === booking.classScheduleId) : undefined;
        // Default origin: an admin clicked the cancel button. Callers
        // from the customer portal or front desk should pass their own.
        const cancelledSource = source ?? "admin" as const;
        set((state) => ({
            classBookings: state.classBookings.map(b =>
                b.id === id ? { ...b, status: "cancelled" as const, cancelledAt: new Date().toISOString(), cancellationReason: reason, refundCreditIssued: refund, cancelledSource } : b
            ),
            classSchedules: state.classSchedules.map(s => {
                const booking = state.classBookings.find(b => b.id === id);
                if (booking && booking.status === "booked" && s.id === booking.classScheduleId && s.booked > 0) {
                    return { ...s, booked: s.booked - 1 };
                }
                return s;
            }),
        }));
        // Feed: a cancelled booking surfaces as "Late Cancellation" in
        // the admin notification center AND as "Cancellation" on the
        // instructor side — body copy matches the instructor Figma
        // ("X cancelled. Y/Z spots filled."). Both rows fire through
        // `emitNotifications` so admin + instructor stay in lockstep.
        if (booking && customer && schedule) {
            const verb = refund ? "Class session has been returned." : "1 class session was forfeited.";
            const customerName = `${customer.firstName} ${customer.lastName}`.trim();
            // Booked count was decremented in the set() above, so re-read it.
            const updatedBooked = get().classSchedules.find(s => s.id === schedule.id)?.booked ?? schedule.booked;
            get().emitNotifications({
                admin: {
                    tab: "booking",
                    event: "late_cancellation",
                    title: "Late Cancellation",
                    body: `${customerName} cancelled ${schedule.name} on ${schedule.dayOfWeek} at ${schedule.displayTime}. ${verb}`,
                    icon: "calendar-minus",
                    sourceModule: "booking",
                    sourceId: id,
                    classScheduleId: schedule.id,
                    customerId: customer.id,
                    branchId: schedule.branchId,
                },
                instructor: {
                    tab: "booking",
                    event: "cancellation",
                    title: "Cancellation",
                    body: `${customerName} cancelled. ${updatedBooked}/${schedule.capacity} spots filled.`,
                    icon: "calendar-minus",
                    sourceModule: "booking",
                    sourceId: id,
                    classScheduleId: schedule.id,
                    customerId: customer.id,
                    branchId: schedule.branchId,
                    targetInstructorId: schedule.instructorId,
                },
            });
        }
    },
    cancelClassBookings: (ids, reason, refund, source) => {
        const stateBefore = get();
        const targets = stateBefore.classBookings.filter(b => ids.includes(b.id));
        const cancelledSource = source ?? "admin" as const;
        set((state) => {
            const idSet = new Set(ids);
            const now = new Date().toISOString();
            const decrementByClass = new Map<string, number>();
            for (const t of state.classBookings.filter(b => idSet.has(b.id))) {
                if (t.status === "booked") {
                    decrementByClass.set(t.classScheduleId, (decrementByClass.get(t.classScheduleId) ?? 0) + 1);
                }
            }
            return {
                classBookings: state.classBookings.map(b =>
                    idSet.has(b.id)
                        ? { ...b, status: "cancelled" as const, cancelledAt: now, cancellationReason: reason, refundCreditIssued: refund, cancelledSource }
                        : b
                ),
                classSchedules: state.classSchedules.map(s => {
                    const dec = decrementByClass.get(s.id);
                    return dec ? { ...s, booked: Math.max(0, s.booked - dec) } : s;
                }),
            };
        });
        // Feed: emit one admin + one instructor notification per cancelled
        // booking so each row stays attributable to a specific customer +
        // class. Instructor rows are scoped via `targetInstructorId` so
        // each instructor sees only their own classes.
        const verb = refund ? "Class session has been returned." : "1 class session was forfeited.";
        for (const t of targets) {
            const customer = stateBefore.customers.find(c => c.id === t.customerId);
            const schedule = stateBefore.classSchedules.find(s => s.id === t.classScheduleId);
            if (customer && schedule) {
                const customerName = `${customer.firstName} ${customer.lastName}`.trim();
                const updatedBooked = get().classSchedules.find(s => s.id === schedule.id)?.booked ?? schedule.booked;
                get().emitNotifications({
                    admin: {
                        tab: "booking",
                        event: "late_cancellation",
                        title: "Late Cancellation",
                        body: `${customerName} cancelled ${schedule.name} on ${schedule.dayOfWeek} at ${schedule.displayTime}. ${verb}`,
                        icon: "calendar-minus",
                        sourceModule: "booking",
                        sourceId: t.id,
                        classScheduleId: schedule.id,
                        customerId: customer.id,
                        branchId: schedule.branchId,
                    },
                    instructor: {
                        tab: "booking",
                        event: "cancellation",
                        title: "Cancellation",
                        body: `${customerName} cancelled. ${updatedBooked}/${schedule.capacity} spots filled.`,
                        icon: "calendar-minus",
                        sourceModule: "booking",
                        sourceId: t.id,
                        classScheduleId: schedule.id,
                        customerId: customer.id,
                        branchId: schedule.branchId,
                        targetInstructorId: schedule.instructorId,
                    },
                });
            }
        }
    },
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
    updateAttendance: (bookingId, status) => {
        const stateBefore = get();
        const booking = stateBefore.classBookings.find(b => b.id === bookingId);
        const wasNoShow = booking?.attendanceStatus === "no_show";
        // Audit stamps for the team-activity feed — drop attribution back
        // to undefined when the user is RESETTING a marking to "pending"
        // (no live action), but keep stamps for every active mark.
        const u = stateBefore.currentUser;
        const markedByName = u ? `${u.first_name} ${u.last_name}`.trim() : "";
        const stamping = status !== "pending";
        const nowISO = new Date().toISOString();
        set((state) => ({
            classBookings: state.classBookings.map(b =>
                b.id === bookingId
                    ? {
                        ...b,
                        attendanceStatus: status,
                        attendanceMarkedAt: stamping ? nowISO : undefined,
                        attendanceMarkedBy: stamping
                            ? (markedByName.length > 0 ? markedByName : "Studio team")
                            : undefined,
                    }
                    : b
            ),
        }));
        // Feed: a fresh no-show stamp surfaces on BOTH feeds. Admin sees
        // a follow-up cue; the affected instructor sees the same event
        // attributed to their class via `targetInstructorId`.
        if (status === "no_show" && !wasNoShow && booking) {
            const customer = stateBefore.customers.find(c => c.id === booking.customerId);
            const schedule = stateBefore.classSchedules.find(s => s.id === booking.classScheduleId);
            if (customer && schedule) {
                const customerName = `${customer.firstName} ${customer.lastName}`.trim();
                get().emitNotifications({
                    admin: {
                        tab: "booking",
                        event: "no_show",
                        title: "No-Show",
                        body: `${customerName} did not attend ${schedule.name} on ${schedule.dayOfWeek} at ${schedule.displayTime}.`,
                        icon: "user-x",
                        sourceModule: "booking",
                        sourceId: bookingId,
                        classScheduleId: schedule.id,
                        customerId: customer.id,
                        branchId: schedule.branchId,
                    },
                    instructor: {
                        tab: "booking",
                        event: "no_show",
                        title: "No-Show",
                        body: `${customerName} did not attend your ${schedule.name} class on ${schedule.dayOfWeek} at ${schedule.displayTime}.`,
                        icon: "user-x",
                        sourceModule: "booking",
                        sourceId: bookingId,
                        classScheduleId: schedule.id,
                        customerId: customer.id,
                        branchId: schedule.branchId,
                        targetInstructorId: schedule.instructorId,
                    },
                });
            }
        }
    },

    deleteClassRating: (id, deletedBy) => {
        const target = get().classRatings.find(r => r.id === id);
        set((state) => ({
            classRatings: state.classRatings.map(r =>
                r.id === id ? { ...r, deletedAt: new Date().toISOString(), deletedBy } : r
            ),
        }));
        if (target) {
            const schedule = get().classSchedules.find(s => s.id === target.classScheduleId);
            get().recordAudit("Deleted class rating", "rating", id, schedule?.name ?? "Class rating");
        }
    },

    addCustomer: (input) => {
        const id = `cu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const initials = input.initials ?? `${input.firstName.charAt(0)}${input.lastName.charAt(0)}`.toUpperCase();
        const customer: Customer = {
            ...input,
            id,
            initials,
            // Form callers always pass an explicit `branchId`. The fallback
            // resolves to the configured default (main active branch) so
            // legacy callers / future seed paths still land somewhere valid
            // instead of being silently pinned to one hardcoded branch.
            branchId: input.branchId ?? DEFAULT_BRANCH_ID,
            // Newly-created customers are Active by default — a brand-new
            // account is never seeded inactive/archived.
            status: input.status ?? "active",
            createdAt: new Date().toISOString(),
        };
        set((state) => ({ customers: [customer, ...state.customers] }));
        return id;
    },
    updateCustomer: (id, patch) => {
        const target = get().customers.find(c => c.id === id);
        set((state) => ({
            customers: state.customers.map(c => c.id === id ? { ...c, ...patch } : c),
        }));
        if (target) {
            get().recordAudit("Edited customer profile", "customer", id, `${target.firstName} ${target.lastName}`.trim());
        }
    },
    setCustomerStatus: (ids, status) => {
        const targets = get().customers.filter(c => ids.includes(c.id));
        set((state) => {
            const idSet = new Set(ids);
            return { customers: state.customers.map(c => idSet.has(c.id) ? { ...c, status } : c) };
        });
        const actionLabel = status === "active" ? "Reactivated customer"
            : status === "inactive" ? "Deactivated customer"
            : "Archived customer";
        targets.forEach(t => {
            get().recordAudit(actionLabel, "customer", t.id, `${t.firstName} ${t.lastName}`.trim(), { status });
        });
    },
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
            const deletedTargets = state.customers.filter(c => deletedSet.has(c.id));
            set(s => ({ customers: s.customers.filter(c => !deletedSet.has(c.id)) }));
            deletedTargets.forEach(t => {
                get().recordAudit("Deleted customer", "customer", t.id, `${t.firstName} ${t.lastName}`.trim());
            });
        }
        return { deleted, blocked };
    },

    // ── Customer plans ─────────────────────────────────────────────────────

    freezeCustomerPlan: (planId, startISO, endISO, source) => {
        const target = get().customerPlans.find(p => p.id === planId);
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
                    // Default origin: an admin clicked freeze on a
                    // customer detail page. Callers from the customer
                    // portal or front desk should pass their own.
                    freezeSource: source ?? "admin" as const,
                    expiryISO: extendedExpiry,
                };
            }),
        }));
        if (target) {
            const customer = get().customers.find(c => c.id === target.customerId);
            const customerName = customer ? `${customer.firstName} ${customer.lastName}`.trim() : "a customer";
            get().recordAudit(`Froze ${customerName}'s plan`, "customer_plan", planId, target.name, { from: startISO, to: endISO });
        }
    },

    unfreezeCustomerPlan: (planId) => {
        const target = get().customerPlans.find(p => p.id === planId);
        set(state => ({
            customerPlans: state.customerPlans.map(p =>
                p.id === planId
                    ? { ...p, status: "active" as const, freezeStartISO: undefined, freezeEndISO: undefined }
                    : p,
            ),
        }));
        if (target) {
            const customer = get().customers.find(c => c.id === target.customerId);
            const customerName = customer ? `${customer.firstName} ${customer.lastName}`.trim() : "a customer";
            get().recordAudit(`Unfroze ${customerName}'s plan`, "customer_plan", planId, target.name);
        }
    },

    cancelCustomerPlan: (planId, mode, reason) => {
        const targetPlan = get().customerPlans.find(p => p.id === planId);
        const targetCustomer = targetPlan ? get().customers.find(c => c.id === targetPlan.customerId) : undefined;
        const customerName = targetCustomer ? `${targetCustomer.firstName} ${targetCustomer.lastName}`.trim() : "a customer";
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
        });
        if (targetPlan) {
            get().recordAudit(`Cancelled ${customerName}'s plan`, "customer_plan", planId, targetPlan.name, { mode });
        }
    },

    removeComplimentaryPlan: (planId, reason, removedBy, removedByRole) => {
        const targetPlan = get().customerPlans.find(p => p.id === planId);
        const targetCustomer = targetPlan ? get().customers.find(c => c.id === targetPlan.customerId) : undefined;
        const customerName = targetCustomer ? `${targetCustomer.firstName} ${targetCustomer.lastName}`.trim() : "a customer";
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
        });
        if (targetPlan) {
            get().recordAudit(`Removed ${customerName}'s complimentary credit`, "customer_plan", planId, targetPlan.name, { reason });
        }
    },

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
        const targetCustomer = get().customers.find(c => c.id === input.customerId);
        const customerName = targetCustomer ? `${targetCustomer.firstName} ${targetCustomer.lastName}`.trim() : "a customer";
        get().recordAudit(`Added complimentary credit to ${customerName}`, "customer_plan", id, input.name, { credits: input.freeCredits ?? 0 });
        return id;
    },

    // ── Customer transactions ──────────────────────────────────────────────

    refundTransaction: (id, method) => {
        const target = get().customerTransactions.find(t => t.id === id);
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
        }));
        if (target) {
            const targetCustomer = get().customers.find(c => c.id === target.customerId);
            const customerName = targetCustomer ? `${targetCustomer.firstName} ${targetCustomer.lastName}`.trim() : "a customer";
            get().recordAudit(`Refunded ${customerName}'s payment`, "customer", target.customerId, target.name, { amount: target.amountAed, method });
        }
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
        get().recordAudit("Created membership", "membership", id, next.name);
        return id;
    },
    updateMembership: (id, patch) => {
        const target = get().memberships.find(m => m.id === id);
        set(state => ({ memberships: state.memberships.map(m => m.id === id ? { ...m, ...patch } : m) }));
        if (target) get().recordAudit("Edited membership", "membership", id, target.name);
    },
    setMembershipStatus: (ids, status) => {
        const targets = get().memberships.filter(m => ids.includes(m.id));
        set(state => {
            const idSet = new Set(ids);
            return { memberships: state.memberships.map(m => idSet.has(m.id) ? { ...m, status } : m) };
        });
        const verb = status === "active" ? "Reactivated" : status === "inactive" ? "Deactivated" : "Archived";
        targets.forEach(t => get().recordAudit(`${verb} membership`, "membership", t.id, t.name, { status }));
    },
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
        get().recordAudit("Created class package", "package", id, next.name);
        return id;
    },
    updatePackage: (id, patch) => {
        const target = get().packages.find(p => p.id === id);
        set(state => ({ packages: state.packages.map(p => p.id === id ? { ...p, ...patch } : p) }));
        if (target) get().recordAudit("Edited class package", "package", id, target.name);
    },
    setPackageStatus: (ids, status) => {
        const targets = get().packages.filter(p => ids.includes(p.id));
        set(state => {
            const idSet = new Set(ids);
            return { packages: state.packages.map(p => idSet.has(p.id) ? { ...p, status } : p) };
        });
        const verb = status === "active" ? "Reactivated" : status === "inactive" ? "Deactivated" : "Archived";
        targets.forEach(t => get().recordAudit(`${verb} class package`, "package", t.id, t.name, { status }));
    },
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
        get().recordAudit("Created gift card design", "gift_card", id, next.name);
        return id;
    },
    updateGiftCardDesign: (id, patch) => {
        const target = get().giftCardDesigns.find(g => g.id === id);
        set(state => ({ giftCardDesigns: state.giftCardDesigns.map(g => g.id === id ? { ...g, ...patch } : g) }));
        if (target) get().recordAudit("Edited gift card design", "gift_card", id, target.name);
    },
    setGiftCardDesignStatus: (ids, status) => {
        const targets = get().giftCardDesigns.filter(g => ids.includes(g.id));
        set(state => {
            const idSet = new Set(ids);
            return { giftCardDesigns: state.giftCardDesigns.map(g => idSet.has(g.id) ? { ...g, status } : g) };
        });
        const verb = status === "active" ? "Reactivated" : status === "inactive" ? "Deactivated" : "Archived";
        targets.forEach(t => get().recordAudit(`${verb} gift card design`, "gift_card", t.id, t.name, { status }));
    },
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
        get().recordAudit("Created promo code", "promo_code", id, next.code);
        return id;
    },
    updatePromoCode: (id, patch) => {
        const target = get().promoCodes.find(p => p.id === id);
        set(state => ({ promoCodes: state.promoCodes.map(p => p.id === id ? { ...p, ...patch } : p) }));
        if (target) get().recordAudit("Edited promo code", "promo_code", id, target.code);
    },
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
        get().recordAudit("Created marketing campaign", "marketing", id, next.title);
        return id;
    },
    updateMarketingItem: (id, patch) => {
        const target = get().marketingItems.find(m => m.id === id);
        set(state => ({ marketingItems: state.marketingItems.map(m => m.id === id ? { ...m, ...patch } : m) }));
        if (target) get().recordAudit("Edited marketing campaign", "marketing", id, target.title);
    },
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
        get().recordAudit("Created pay rate", "pay_rate", id, next.name);
        return id;
    },
    updatePayRate: (id, patch) => {
        const stateBefore = get();
        const before = stateBefore.payRates.find(p => p.id === id);
        // Merging discriminated unions with Partial is awkward in TS — we cast
        // the result back to PayRate after merge. Callers are responsible for
        // not mixing fields across variants.
        set(state => ({
            payRates: state.payRates.map(p => p.id === id ? ({ ...p, ...patch } as PayRate) : p),
        }));
        // Phase 4 sync — fan out a notification to every instructor
        // currently assigned to this rate, so they know their pay terms
        // changed. Only fires when the visible fields (name / amounts)
        // actually moved — status toggles and config-flag flips stay
        // quiet to avoid notification spam.
        if (!before) return;
        const after = get().payRates.find(p => p.id === id);
        if (!after) return;
        const nameChanged = patch.name !== undefined && patch.name !== before.name;
        const amountChanged = (() => {
            // Only the flat-rate variant ships a single comparable scalar;
            // for tiered / revenue / hybrid / monthly we compare JSON
            // shape so any visible change to the math fires the notice.
            if (before.type === "flat" && after.type === "flat") {
                return before.flatAmount !== after.flatAmount;
            }
            return JSON.stringify(before) !== JSON.stringify(after);
        })();
        if (!nameChanged && !amountChanged) return;
        const assignedInstructors = get().instructors.filter(i => i.payRateId === id);
        if (assignedInstructors.length === 0) return;
        // Admin gets one summary row; each affected instructor gets a
        // scoped row with their `targetInstructorId` set.
        get().emitNotifications({
            admin: {
                tab: "payment",
                event: "pay_rate_updated",
                title: "Pay rate updated",
                body: `${after.name} updated — ${assignedInstructors.length} instructor${assignedInstructors.length === 1 ? "" : "s"} affected.`,
                icon: "bank-note",
                sourceModule: "transaction",
                sourceId: id,
            },
        });
        assignedInstructors.forEach(i => {
            get().emitNotifications({
                instructor: {
                    tab: "earnings",
                    event: "pay_rate_updated",
                    title: "Your pay rate changed",
                    body: `${after.name} was updated. Open Earnings to see the new figures.`,
                    icon: "bank-note",
                    sourceModule: "transaction",
                    sourceId: id,
                    targetInstructorId: i.id,
                },
            });
        });
        get().recordAudit("Edited pay rate", "pay_rate", id, after.name);
    },
    setPayRatesStatus: (ids, status) => {
        const targets = get().payRates.filter(p => ids.includes(p.id));
        set(state => ({
            payRates: state.payRates.map(p => ids.includes(p.id) ? { ...p, status } : p),
        }));
        const verb = status === "active" ? "Reactivated" : "Archived";
        targets.forEach(t => get().recordAudit(`${verb} pay rate`, "pay_rate", t.id, t.name, { status }));
    },
    deletePayRates: (ids) => {
        const deletable = get().payRates.filter(p => ids.includes(p.id) && p.status === "active" && p.usageCount === 0);
        const deletableIds = deletable.map(p => p.id);
        const blocked = ids.filter(id => !deletableIds.includes(id));
        if (deletableIds.length > 0) {
            // Also clear the rate from any instructor / staff that still
            // references it — the relationship survives the delete in
            // DB-land but the UI shouldn't dangle. Both slices are wiped
            // together so the cross-module displays stay in sync.
            set(state => ({
                payRates: state.payRates.filter(p => !deletableIds.includes(p.id)),
                instructors: state.instructors.map(i =>
                    i.payRateId && deletableIds.includes(i.payRateId) ? { ...i, payRateId: undefined } : i,
                ),
                staff: state.staff.map(s =>
                    s.payRateId && deletableIds.includes(s.payRateId) ? { ...s, payRateId: undefined } : s,
                ),
            }));
        }
        return { deleted: deletableIds, blocked };
    },

    assignInstructorPayRate: (instructorId, payRateId) => {
        const stateBefore = get();
        const beforeInstructor = stateBefore.instructors.find(i => i.id === instructorId);
        const previousPayRateId = beforeInstructor?.payRateId;
        // Mirror the write into `staff` too — the Staff & Permissions
        // module reads payRateId from staff, so a pay-rate change must
        // propagate or the staff detail will show a stale rate.
        set(state => ({
            instructors: state.instructors.map(i =>
                i.id === instructorId ? { ...i, payRateId } : i,
            ),
            staff: state.staff.map(s =>
                s.id === instructorId ? { ...s, payRateId } : s,
            ),
        }));
        // Phase 4 sync — only fire when the pay rate actually changed.
        // Re-assigning the same rate (e.g. via a save-without-change form
        // submit) is a no-op for the bell.
        if (previousPayRateId === payRateId) return;
        const newRate = payRateId ? get().payRates.find(p => p.id === payRateId) : undefined;
        const bodyForInstructor = newRate
            ? `You're now on the ${newRate.name} pay rate. Open Earnings to see the new figures.`
            : "Your pay rate assignment was removed. Reach out to admin for details.";
        const bodyForAdmin = newRate
            ? `${beforeInstructor?.name ?? "Instructor"} assigned to ${newRate.name}.`
            : `${beforeInstructor?.name ?? "Instructor"} pay rate assignment cleared.`;
        get().emitNotifications({
            admin: {
                tab: "payment",
                event: "pay_rate_assigned",
                title: "Pay rate assigned",
                body: bodyForAdmin,
                icon: "bank-note",
                sourceModule: "transaction",
                sourceId: payRateId ?? previousPayRateId,
            },
            instructor: {
                tab: "earnings",
                event: "pay_rate_assigned",
                title: "Pay rate updated",
                body: bodyForInstructor,
                icon: "bank-note",
                sourceModule: "transaction",
                sourceId: payRateId ?? previousPayRateId,
                targetInstructorId: instructorId,
            },
        });
        get().recordAudit(
            newRate ? `Assigned pay rate to ${beforeInstructor?.name ?? "instructor"}` : `Cleared pay rate for ${beforeInstructor?.name ?? "instructor"}`,
            "pay_rate",
            payRateId ?? previousPayRateId ?? "—",
            newRate?.name ?? "—",
        );
    },
    setInstructorStatus: (ids, status) => {
        const targets = get().instructors.filter(i => ids.includes(i.id));
        // Mirror status back to staff (instructor statuses are a strict
        // subset of staff statuses — no mapping needed in this direction).
        set(state => ({
            instructors: state.instructors.map(i =>
                ids.includes(i.id) ? { ...i, status } : i,
            ),
            staff: state.staff.map(s =>
                ids.includes(s.id) ? { ...s, status } : s,
            ),
        }));
        const verb = status === "active" ? "Reactivated" : status === "inactive" ? "Deactivated" : "Archived";
        targets.forEach(t => get().recordAudit(`${verb} instructor`, "staff", t.id, t.name, { status }));
    },

    setPayrollEntriesStatus: (ids, status, payrollRunId) => {
        set(state => ({
            payrollEntries: state.payrollEntries.map(e =>
                ids.includes(e.id)
                    ? { ...e, status, ...(payrollRunId ? { payrollRunId } : {}) }
                    : e,
            ),
        }));
        if (status === "paid") {
            get().recordAudit("Ran payroll", "payroll", payrollRunId ?? "run", `${ids.length} entries`, { entries: ids.length });
        }
    },
    setPayrollEntryAdjustment: (id, amount, reason) => {
        set(state => ({
            payrollEntries: state.payrollEntries.map(e =>
                e.id === id
                    ? { ...e, adjustmentAmount: amount, adjustmentReason: reason, totalEarnings: e.baseEarnings + amount }
                    : e,
            ),
        }));
        const target = get().payrollEntries.find(e => e.id === id);
        if (target) {
            const instructor = get().instructors.find(i => i.id === target.instructorId);
            get().recordAudit("Adjusted payroll entry", "payroll", id, instructor?.name ?? target.payRateName, { amount, reason: reason ?? "" });
        }
    },

    // ── Customer notification settings ────────────────────────────────────
    setNotificationEventChannel: (id, channel, enabled) =>
        set(state => ({
            notificationSettings: state.notificationSettings.map(n =>
                n.id !== id ? n :
                channel === "email"    ? { ...n, emailEnabled:    enabled } :
                channel === "whatsapp" ? { ...n, whatsappEnabled: enabled } :
                                         { ...n, pushEnabled:     enabled },
            ),
        })),
    updateNotificationTemplate: (id, patch) =>
        set(state => ({
            notificationSettings: state.notificationSettings.map(n =>
                n.id === id ? { ...n, ...patch } : n,
            ),
        })),

    // ── In-app notifications feed ─────────────────────────────────────────
    //
    // Append-only by default. Reads are sorted by `createdAt` DESC so newest
    // events appear first in the bell + the page. Other actions in this store
    // call `addNotification` directly via `get().addNotification(...)` so the
    // cross-module sync logic stays co-located with the action it mirrors.

    addNotification: (input) => {
        const id = input.id ?? `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const record: Notification = {
            ...input,
            id,
            createdAt: input.createdAt ?? new Date().toISOString(),
            isRead: input.isRead ?? false,
        };
        set(state => ({ notifications: [record, ...state.notifications] }));
        return id;
    },

    recordAudit: (action, targetType, targetId, targetName, metadata) => {
        const state = get();
        const u = state.currentUser;
        const actorName = u ? `${u.first_name} ${u.last_name}`.trim() : "Studio team";
        const actorRole = state.currentRole;
        const entry: AuditLogEntry = {
            id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            actorId: u?.id ?? "unknown",
            actorName: actorName.length > 0 ? actorName : "Studio team",
            actorRole,
            action,
            targetType,
            targetId,
            targetName,
            metadata,
            createdAt: new Date().toISOString(),
        };
        // Cap at 200 most-recent entries so the persisted blob stays small.
        // The team-activity feed only ever surfaces the top N anyway.
        set(s => ({ auditLog: [entry, ...s.auditLog].slice(0, 200) }));
    },
    emitNotifications: (input) => {
        // Stamp the `audience` field per payload + delegate to
        // `addNotification` so both feeds (admin bell, instructor bell)
        // pick the row up in the same render cycle. Skip undefined
        // payloads silently — many events fire for only one audience.
        if (input.admin) {
            get().addNotification({ ...input.admin, audience: "admin" });
        }
        if (input.instructor) {
            get().addNotification({ ...input.instructor, audience: "instructor" });
        }
    },
    markNotificationRead: (id) =>
        set(state => ({
            notifications: state.notifications.map(n =>
                n.id === id ? { ...n, isRead: true } : n,
            ),
        })),
    markAllNotificationsRead: () =>
        set(state => ({
            notifications: state.notifications.map(n =>
                n.isRead ? n : { ...n, isRead: true },
            ),
        })),
    dismissNotification: (id) =>
        set(state => ({
            notifications: state.notifications.filter(n => n.id !== id),
        })),

    // ── Referral settings ─────────────────────────────────────────────────
    setReferralProgramActive: (active) => {
        set(state => ({
            referralSettings: { ...state.referralSettings, programActive: active },
        }));
        get().recordAudit(active ? "Activated referral program" : "Deactivated referral program", "settings", "referral_program", "Referral program");
    },
    updateReferralRewards: (patch) => {
        set(state => ({
            referralSettings: { ...state.referralSettings, ...patch },
        }));
        get().recordAudit("Updated referral rewards", "settings", "referral_rewards", "Referral rewards");
    },
    updateReferralInformation: (patch) => {
        set(state => ({
            referralSettings: { ...state.referralSettings, ...patch },
        }));
        get().recordAudit("Updated referral information", "settings", "referral_information", "Referral information");
    },

    // ── Tax module ────────────────────────────────────────────────────────
    setPricesIncludeTax: (value) =>
        set(state => ({
            taxSettings: { ...state.taxSettings, pricesIncludeTax: value },
        })),
    addTaxRate: (input) => {
        const id = input.id ?? `tax_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const record: TaxRate = {
            ...input,
            id,
            createdAt: input.createdAt ?? new Date().toISOString(),
        };
        set(state => ({ taxRates: [record, ...state.taxRates] }));
        // Note: no bell-feed entry. Tax events are admin-only config — the
        // toast emitted by the TaxRateModal is sufficient feedback, and the
        // bell is reserved for customer-visible events (bookings / payments).
        get().recordAudit("Created tax rate", "settings", id, record.name);
        return id;
    },
    updateTaxRate: (id, patch) => {
        const target = get().taxRates.find(t => t.id === id);
        set(state => ({
            taxRates: state.taxRates.map(t => t.id === id ? { ...t, ...patch } : t),
        }));
        if (target) get().recordAudit("Edited tax rate", "settings", id, target.name);
    },
    setTaxRatesStatus: (ids, status) =>
        set(state => {
            const idSet = new Set(ids);
            // Cross-module sync: archiving a rate clears it off every
            // referencing tax rule so the Apply tax rates row drops to the
            // "Select tax rate" placeholder. Deactivate keeps the reference
            // (admin can still see what was assigned) but the rule's runtime
            // effect is gated on the rate being active.
            const shouldClearRefs = status === "archived";
            return {
                taxRates: state.taxRates.map(t => idSet.has(t.id) ? { ...t, status } : t),
                taxRules: shouldClearRefs
                    ? state.taxRules.map(r =>
                        r.taxRateId && idSet.has(r.taxRateId)
                            ? { ...r, taxRateId: undefined }
                            : r,
                    )
                    : state.taxRules,
            };
        }),
    deleteTaxRates: (ids) => {
        // Phase 1 had no usage gate. Phase 3 wires the real gate at the page
        // layer via `hasUsage()`, and this action mirrors the gift-card /
        // pay-rate pattern: it accepts all ids the caller passed, but the
        // sync below also clears any `tax_rules.taxRateId` that referenced
        // a deleted rate so the rule drops to the placeholder state.
        const idSet = new Set(ids);
        const deleted: string[] = [];
        const blocked: string[] = [];
        for (const id of ids) {
            const existing = get().taxRates.find(t => t.id === id);
            if (existing) deleted.push(id);
            else blocked.push(id);
        }
        if (deleted.length > 0) {
            set(state => ({
                taxRates: state.taxRates.filter(t => !idSet.has(t.id)),
                // Cross-module sync — clear taxRateId on every referencing rule.
                taxRules: state.taxRules.map(r =>
                    r.taxRateId && idSet.has(r.taxRateId)
                        ? { ...r, taxRateId: undefined }
                        : r,
                ),
            }));
        }
        return { deleted, blocked };
    },

    // ── Tax rules ─────────────────────────────────────────────────────────
    addTaxRule: (category) => {
        const id = `trl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const record: TaxRule = {
            id,
            category,
            taxRateId: undefined,
            allLocations: false,
            locationIds: [],
            status: "active",
            createdAt: new Date().toISOString(),
        };
        set(state => ({ taxRules: [...state.taxRules, record] }));
        return id;
    },
    updateTaxRule: (id, patch) =>
        set(state => ({
            taxRules: state.taxRules.map(r => r.id === id ? { ...r, ...patch } : r),
        })),
    setTaxRuleStatus: (id, status) =>
        set(state => ({
            taxRules: state.taxRules.map(r => r.id === id ? { ...r, status } : r),
        })),
    deleteTaxRule: (id) =>
        set(state => ({
            taxRules: state.taxRules.filter(r => r.id !== id),
        })),

    // ── Agreements actions ────────────────────────────────────────────────
    addAgreement: (input) => {
        const id = input.id ?? `agr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const now = new Date().toISOString();
        const record: Agreement = {
            ...input,
            id,
            createdAt: input.createdAt ?? now,
            updatedAt: input.updatedAt ?? now,
        };
        set(state => ({ agreements: [record, ...state.agreements] }));
        get().recordAudit("Created agreement", "settings", id, record.name);
        return id;
    },
    updateAgreement: (id, patch) => {
        const target = get().agreements.find(a => a.id === id);
        set(state => ({
            agreements: state.agreements.map(a =>
                a.id === id
                    ? { ...a, ...patch, updatedAt: new Date().toISOString() }
                    : a,
            ),
        }));
        if (target) get().recordAudit("Edited agreement", "settings", id, target.name);
    },
    setAgreementsStatus: (ids, status) =>
        set(state => {
            const idSet = new Set(ids);
            const stamp = new Date().toISOString();
            return {
                agreements: state.agreements.map(a =>
                    idSet.has(a.id) ? { ...a, status, updatedAt: stamp } : a,
                ),
            };
        }),
    addAgreementVersion: (input) => {
        const id = input.id ?? `agr_v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const now = new Date().toISOString();
        const record: AgreementVersion = {
            ...input,
            id,
            publishedAt: input.publishedAt ?? now,
        };
        set(state => {
            // Phase 4 cross-module sync: every customer who already has a
            // `customer_agreements` row for this agreement gets a new
            // `unsigned` row for the new version. Their existing rows stay
            // (history). One row per (customer, agreement) snapshot —
            // duplicates by (customer + version) are guarded with a check.
            const parent = state.agreements.find(a => a.id === input.agreementId);
            const parentName = parent?.name ?? "";

            const customersForAgreement = new Map<string, string>(); // customerId → branchId
            for (const ca of state.customerAgreements) {
                if (ca.agreementId !== input.agreementId) continue;
                if (!customersForAgreement.has(ca.customerId)) {
                    customersForAgreement.set(ca.customerId, ca.branchId);
                }
            }
            const newCustomerRows: CustomerAgreement[] = [];
            customersForAgreement.forEach((branchId, customerId) => {
                const already = state.customerAgreements.some(ca =>
                    ca.agreementId === input.agreementId
                    && ca.customerId === customerId
                    && ca.version === input.versionNumber,
                );
                if (already) return;
                newCustomerRows.push({
                    id: `agr_${customerId}_v${input.versionNumber}_${Math.random().toString(36).slice(2, 6)}`,
                    customerId,
                    agreementId: input.agreementId,
                    title: parentName,
                    version: input.versionNumber,
                    branchId,
                    classTemplateIds: parent?.applicableClassTemplateIds ?? [],
                    status: "unsigned",
                });
            });

            return {
                agreementVersions: [...state.agreementVersions, record],
                // Keep the parent's cached `currentVersion` in lock-step so the
                // list view's "Version N" subtext doesn't drift behind the
                // version-history table.
                agreements: state.agreements.map(a =>
                    a.id === input.agreementId
                        ? {
                            ...a,
                            currentVersion: Math.max(a.currentVersion, input.versionNumber),
                            updatedAt: now,
                        }
                        : a,
                ),
                customerAgreements: [...state.customerAgreements, ...newCustomerRows],
            };
        });
        return id;
    },
    republishAgreementVersion: (agreementId, versionNumber) =>
        set(state => ({
            customerAgreements: state.customerAgreements.map(ca =>
                ca.agreementId === agreementId
                && ca.version === versionNumber
                && ca.status === "signed"
                    ? { ...ca, status: "unsigned" as const, signedAtISO: undefined }
                    : ca,
            ),
        })),

    // ── Integrations actions ──────────────────────────────────────────────
    connectIntegration: (id, accountLabel) =>
        set(state => {
            const stamp = new Date().toISOString();
            return {
                integrations: state.integrations.map(i =>
                    i.id === id
                        ? {
                            ...i,
                            status: "connected" as const,
                            connectedAt: stamp,
                            accountLabel: accountLabel ?? i.accountLabel,
                        }
                        : i,
                ),
            };
        }),
    disconnectIntegration: (id) =>
        set(state => ({
            integrations: state.integrations.map(i =>
                i.id === id
                    ? {
                        ...i,
                        status: "not_connected" as const,
                        connectedAt: undefined,
                        accountLabel: undefined,
                    }
                    : i,
            ),
        })),

    // ── Instructor calendar integrations ──────────────────────────────────
    connectInstructorIntegration: (staffProfileId, slug, accountLabel) =>
        set(state => {
            const stamp = new Date().toISOString();
            return {
                instructorIntegrations: state.instructorIntegrations.map(i =>
                    i.staffProfileId === staffProfileId && i.slug === slug
                        ? {
                            ...i,
                            status: "connected" as const,
                            connectedAt: stamp,
                            accountLabel: accountLabel ?? i.accountLabel,
                        }
                        : i,
                ),
            };
        }),
    disconnectInstructorIntegration: (staffProfileId, slug) =>
        set(state => ({
            instructorIntegrations: state.instructorIntegrations.map(i =>
                i.staffProfileId === staffProfileId && i.slug === slug
                    ? {
                        ...i,
                        status: "not_connected" as const,
                        connectedAt: undefined,
                        accountLabel: undefined,
                    }
                    : i,
            ),
        })),

    // ── Payments actions ──────────────────────────────────────────────────
    connectPaymentProvider: (id, accountLabel) =>
        set(state => {
            const stamp = new Date().toISOString();
            return {
                paymentProviders: state.paymentProviders.map(p =>
                    p.id === id
                        ? {
                            ...p,
                            status: "connected" as const,
                            connectedAt: stamp,
                            accountLabel: accountLabel ?? p.accountLabel,
                        }
                        : p,
                ),
            };
        }),
    disconnectPaymentProvider: (id) =>
        set(state => {
            const target = state.paymentProviders.find(p => p.id === id);
            // Cascade rule: disconnecting a gateway auto-disconnects every
            // wallet whose `requiresProviderSlug` points at this gateway's
            // slug. Wallets disconnect cleanly (just themselves).
            const cascadedSlug = target?.kind === "gateway" ? target.slug : undefined;
            return {
                paymentProviders: state.paymentProviders.map(p => {
                    if (p.id === id) {
                        return {
                            ...p,
                            status: "not_connected" as const,
                            connectedAt: undefined,
                            accountLabel: undefined,
                        };
                    }
                    if (cascadedSlug && p.requiresProviderSlug === cascadedSlug) {
                        return {
                            ...p,
                            status: "not_connected" as const,
                            connectedAt: undefined,
                            accountLabel: undefined,
                        };
                    }
                    return p;
                }),
            };
        }),

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
    //
    // Every mutation here also syncs the legacy `instructors` slice through
    // `syncInstructorsFromStaff` so pay-rate / payroll / schedule views
    // reflect Staff & Permissions changes immediately.
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
        set(state => {
            const nextStaff = [...state.staff, next];
            return {
                staff: nextStaff,
                instructors: syncInstructorsFromStaff(state.instructors, nextStaff, state.roles, [id]),
            };
        });
        return id;
    },
    updateStaff: (id, patch) =>
        // Phase 4 reverse cascade — admin → instructor.
        // If the edited staff row is the currently-logged-in instructor,
        // mirror identity edits back to `currentUser` so the instructor
        // side (Sidebar chip, Header welcome, Personal info tab) sees
        // changes admin made on `/admin/staff/[id]/edit` immediately.
        // Together with the forward cascade on `updateAccountProfile`,
        // edits flow bi-directionally and the two views never drift.
        set(state => {
            const nextStaff = state.staff.map(s => s.id === id ? { ...s, ...patch } : s);
            const nextInstructors = syncInstructorsFromStaff(state.instructors, nextStaff, state.roles, [id]);

            const currentStaffId = (state.currentUser as typeof state.currentUser & { staff_profile_id?: string }).staff_profile_id;
            const editingCurrent = state.currentUser.role === "instructor" && currentStaffId === id;
            const editedRow = nextStaff.find(s => s.id === id);

            if (editingCurrent && editedRow) {
                // Phase 3 cascade — `staff[].bio` mirrors back to
                // `currentUser.introduction` so when admin edits Liam's
                // bio via /admin/staff/[id]/edit, Liam's own
                // /instructor/account reads the new copy. Only patch
                // when bio is defined on the edited row (admin may have
                // only changed identity fields without touching bio).
                const introductionPatch = editedRow.bio !== undefined
                    ? { introduction: editedRow.bio }
                    : {};
                return {
                    staff: nextStaff,
                    instructors: nextInstructors,
                    currentUser: {
                        ...state.currentUser,
                        first_name: editedRow.firstName,
                        last_name:  editedRow.lastName,
                        email:      editedRow.email,
                        phone:      editedRow.phone,
                        avatar_url: editedRow.imageUrl ?? state.currentUser.avatar_url,
                        ...introductionPatch,
                    },
                };
            }

            return {
                staff: nextStaff,
                instructors: nextInstructors,
            };
        }),
    setStaffStatus: (ids, status) =>
        set(state => {
            const nextStaff = state.staff.map(s => ids.includes(s.id) ? { ...s, status } : s);
            const nextInstructors = syncInstructorsFromStaff(state.instructors, nextStaff, state.roles, ids);

            // Phase 4 reverse cascade — if the current instructor was in
            // the batch, mirror `status` back to `currentUser.is_active`
            // so the instructor side knows it's been deactivated.
            const currentStaffId = (state.currentUser as typeof state.currentUser & { staff_profile_id?: string }).staff_profile_id;
            const editingCurrent = state.currentUser.role === "instructor"
                && currentStaffId !== undefined
                && ids.includes(currentStaffId);

            if (editingCurrent) {
                return {
                    staff: nextStaff,
                    instructors: nextInstructors,
                    currentUser: {
                        ...state.currentUser,
                        is_active: status === "active",
                    },
                };
            }

            return {
                staff: nextStaff,
                instructors: nextInstructors,
            };
        }),
    resendStaffInvite: (id) => {
        const target = get().staff.find(s => s.id === id);
        if (!target || target.firstLoginCompleted) return false;
        // Pure timestamp bump — no instructor-visible field changes, so we
        // skip the sync here to avoid unnecessary re-renders downstream.
        set(state => ({
            staff: state.staff.map(s =>
                s.id === id ? { ...s, inviteSentAt: new Date().toISOString() } : s,
            ),
        }));
        return true;
    },
    canDeleteStaff: (id) => {
        // Hard-delete rule: status is Pending or Archive AND zero references
        // in payrollEntries / classSchedules / classRatings (classBookings
        // carries no instructor FK in this codebase). Mirrors deleteMembership's
        // "block when history exists" pattern.
        const state = get();
        const staff = state.staff.find(s => s.id === id);
        if (!staff) return false;
        if (staff.status !== "pending" && staff.status !== "archive") return false;
        if (state.payrollEntries.some(p => p.instructorId === id)) return false;
        if (state.classSchedules.some(s => s.instructorId === id)) return false;
        if (state.classRatings.some(r => r.instructorId === id)) return false;
        return true;
    },
    deleteStaff: (ids) => {
        const canDelete = get().canDeleteStaff;
        const deletable = ids.filter(id => canDelete(id));
        const blocked = ids.filter(id => !deletable.includes(id));
        if (deletable.length > 0) {
            const deletableSet = new Set(deletable);
            set(state => {
                const nextStaff = state.staff.filter(s => !deletableSet.has(s.id));
                // Belt-and-suspenders: scrub any stray FK references in
                // dependent slices. Layer 1 only allows delete when these
                // arrays already have zero matches, so these filters are
                // no-ops in steady state — they protect against drift from
                // future seed data or out-of-band mutations.
                return {
                    staff: nextStaff,
                    instructors: syncInstructorsFromStaff(state.instructors, nextStaff, state.roles, deletable),
                    payrollEntries: state.payrollEntries.filter(p => !deletableSet.has(p.instructorId)),
                    classSchedules: state.classSchedules.filter(s => !deletableSet.has(s.instructorId)),
                    classRatings: state.classRatings.filter(r => !deletableSet.has(r.instructorId)),
                };
            });
        }
        return { deleted: deletable, blocked };
    },

    setPendingPurchase: (purchase) => set({ pendingPurchase: purchase }),
    applyPurchase: (customerId, items, paymentSource) => {
        // Snapshot the buyer + a description of what they bought BEFORE the
        // `set` so the notification body reads natural ("X purchased the Y
        // Package for AED Z") even if subsequent sets re-enter.
        const stateBefore = get();
        const buyerSnapshot = stateBefore.customers.find(c => c.id === customerId);
        const purchaseTotal = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
        const productLabel = (() => {
            const membership = items.find(it => it.productType === "membership");
            const packages = items.filter(it => it.productType === "package");
            const giftCards = items.filter(it => it.productType === "gift_card");
            if (membership) return `the ${membership.name}`;
            if (packages.length === 1) return `the ${packages[0].name}`;
            if (packages.length > 1) return `${packages.reduce((sum, p) => sum + p.quantity, 0)} credit packages`;
            if (giftCards.length > 0) return giftCards.length === 1
                ? `a ${giftCards[0].name} gift card`
                : `${giftCards.length} gift cards`;
            return "items at checkout";
        })();
        // Pre-compute the first transaction id so the notification record can
        // deep-link the click-through to the exact receipt on the customer
        // profile (Payments tab → highlighted row).
        const txnStamp = Date.now();
        const firstSaleIdx = items.findIndex(it => it.productType === "membership" || it.productType === "package");
        const firstTxnId = firstSaleIdx >= 0 ? `txn_sale_${txnStamp}_${firstSaleIdx}` : undefined;
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
            // Reuse the stamp captured outside the set so the txn id the
            // notification points at matches the one the set writes.
            const stamp = txnStamp;
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
                // Phase 4 — snapshot the tax breakdown onto the transaction
                // so the Payments tab + receipt views stay truthful even if
                // the rule / toggle later changes. Inlined (instead of using
                // `tax-calc.ts`) to avoid a circular import — tax-calc reads
                // the store's TaxRule type.
                const lineGross = it.unitPrice * it.quantity;
                const txnCategory = isMembership ? "membership" as const : "credit_package" as const;
                const taxRule = state.taxRules.find(r =>
                    r.category === txnCategory
                    && r.status === "active"
                    && r.taxRateId !== undefined
                    && (r.allLocations || r.locationIds.includes(saleBranchId)),
                );
                const taxRate = taxRule?.taxRateId
                    ? state.taxRates.find(t => t.id === taxRule.taxRateId && t.status === "active")
                    : undefined;
                let txnExtra: Partial<CustomerTransaction> = {};
                if (taxRate) {
                    const rPct = taxRate.ratePercentage;
                    const pricesInclude = state.taxSettings.pricesIncludeTax;
                    const taxAed = pricesInclude
                        ? Math.round(lineGross * rPct / (100 + rPct))
                        : Math.round(lineGross * rPct / 100);
                    const subtotalAed = pricesInclude ? lineGross - taxAed : lineGross;
                    txnExtra = {
                        subtotalAed,
                        taxAed,
                        taxRatePercentage: rPct,
                        taxInclusive: pricesInclude,
                    };
                }
                newTransactions.push({
                    id: `txn_sale_${stamp}_${idx}`,
                    customerId,
                    branchId: saleBranchId,
                    kind: isMembership ? "membership" : "package",
                    productId: it.productId,
                    name: it.name,
                    amountAed: lineGross,
                    ...txnExtra,
                    status: "complete",
                    paymentMethod: "card",
                    // Default origin: a POS checkout. Customer-portal +
                    // admin callers pass their own value via `paymentSource`.
                    paymentSource: paymentSource ?? "pos" as const,
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
        });
        // Feed: a completed sale surfaces in the notification center as
        // "Payment Confirmed". Amount is formatted with thousands separators
        // to match the visual treatment used in /admin/insights and POS.
        if (buyerSnapshot && purchaseTotal > 0) {
            const buyerName = `${buyerSnapshot.firstName} ${buyerSnapshot.lastName}`.trim();
            get().addNotification({
                tab: "payment",
                event: "payment_confirmed",
                title: "Payment Confirmed",
                body: `${buyerName} purchased ${productLabel} for AED ${purchaseTotal.toLocaleString("en-US")}.`,
                icon: "credit-card",
                sourceModule: "transaction",
                sourceId: firstTxnId,
                transactionId: firstTxnId,
                customerId: buyerSnapshot.id,
                branchId: buyerSnapshot.branchId,
            });
        }
    },

    showToast: (title, message, type = "success", icon) =>
        set({ toast: { id: Date.now().toString(), title, message, type, icon } }),
    clearToast: () => set({ toast: null }),
}),
    {
        name: PERSIST_KEY,
        version: 1,
        storage: createJSONStorage(() => localStorage),
        // `partialize` strips per-tab + ephemeral state from the serialized
        // payload. Action functions (set / get callbacks) are dropped
        // automatically by JSON.stringify — they don't survive serialization
        // and the store keeps its initial-definition implementations after
        // rehydrate, which is what we want.
        partialize: (state) => {
            const {
                currentUser:    _currentUser,
                currentRole:    _currentRole,
                sidebarCollapsed: _sidebarCollapsed,
                toast:          _toast,
                pendingPurchase: _pendingPurchase,
                ...persistable
            } = state;
            return persistable;
        },
    },
));

// ─────────────────────────────────────────────────────────────────────────────
// Cross-tab sync — Zustand `persist` writes to localStorage but doesn't
// auto-rehydrate other tabs. Browsers fire a `storage` event on every
// OTHER tab (not the one that wrote) when localStorage changes; we use
// that event to re-read the persisted state into the in-memory store.
//
// Effect: admin creates a class in Tab A → instructor view in Tab B
// updates in the same render cycle, no manual refresh required.
// ─────────────────────────────────────────────────────────────────────────────
if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
        if (e.key === PERSIST_KEY) {
            void useAppStore.persist.rehydrate();
        }
    });
}
