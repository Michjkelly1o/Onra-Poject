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
import { firstFreeSpot, balancedSpotGrid } from "@/lib/spot-layout";
import { campaignRecipients, type CampaignTopic } from "@/lib/marketing/dispatch";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserRole, User } from "@/types";
import { account_profile as adminUser } from "@/data/mock/account_profile";
import { capitalizeName } from "./format-name";
import { formatTimeRange12 } from "./utils";
import { commissionForPeriod } from "./payroll-calc";
import { evaluateReferralRewards } from "./referral-helpers";
import { getFrozenActiveMembership } from "./customer/freeze-eligibility";
import {
    computeLifecycleTag,
    applyLifecycleResult,
    autoCloseTasksOnGraduation,
    recomputePatch,
} from "./customer/lifecycle";
import {
    generateFollowUpTasks,
    applyGeneratedTasks,
    lookupStageLabel,
} from "./customer/follow-up-tasks";

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
    AVA_CLASS_BOOKINGS,
    AVA_CUSTOMER_ID,
    AVA_APPOINTMENTS,
    AVA_APPOINTMENT_BOOKINGS,
    AVA_APPOINTMENT_RATINGS,
    class_templates as SEED_CLASS_TEMPLATES,
    services as SEED_SERVICES,
    appointments as SEED_APPOINTMENTS,
    appointment_bookings as SEED_APPOINTMENT_BOOKINGS,
    appointment_ratings as SEED_APPOINTMENT_RATINGS,
    class_categories as SEED_CLASS_CATEGORIES,
    classes_settings as SEED_CLASSES_SETTINGS,
    cancellation_policy as SEED_CANCELLATION_POLICY,
    freeze_policy as SEED_FREEZE_POLICY,
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
    shifts as SEED_SHIFTS,
    shift_assignments as SEED_SHIFT_ASSIGNMENTS,
    blocked_times as SEED_BLOCKED_TIMES,
    payroll_entries as SEED_PAYROLL_ENTRIES,
    notification_settings as SEED_NOTIFICATION_SETTINGS,
    notification_delivery_settings as SEED_NOTIFICATION_DELIVERY_SETTINGS,
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
    wallet_transactions as SEED_WALLET_TRANSACTIONS,
    type WalletTransactionSeed,
    // Reports v33 — new tables for demo data completeness
    leads as SEED_LEADS,
    marketing_campaign_stats as SEED_MARKETING_CAMPAIGN_STATS,
    marketing_spend as SEED_MARKETING_SPEND,
    import_history as SEED_IMPORT_HISTORY,
    // Inventory / Retail (2026-07-29, Phase A)
    retail_categories as SEED_RETAIL_CATEGORIES,
    retail_products as SEED_RETAIL_PRODUCTS,
    retail_stock as SEED_RETAIL_STOCK,
    retail_stock_adjustments as SEED_RETAIL_STOCK_ADJUSTMENTS,
    type RetailCategory as SeedRetailCategory,
    type RetailProduct as SeedRetailProduct,
    type RetailStock as SeedRetailStock,
    type RetailStockAdjustment as SeedRetailStockAdjustment,
    type Lead,
    type MarketingCampaignStat,
    type MarketingSpend,
    type StaffAttendanceLog,
    type ImportHistorySeed,
    type Customer as SeedCustomer,
    type CustomerPlan as SeedCustomerPlan,
    type CustomerTransaction as SeedCustomerTransaction,
    type CustomerAgreement as SeedCustomerAgreement,
    type CustomerReferral as SeedCustomerReferral,
    type ClassSchedule as SeedClassSchedule,
    type ClassBooking as SeedClassBooking,
    type ClassRating as SeedClassRating,
    type ClassTemplate as SeedClassTemplate,
    type Service as SeedService,
    type Appointment as SeedAppointment,
    type AppointmentBooking as SeedAppointmentBooking,
    type AppointmentRating as SeedAppointmentRating,
    type ClassCategory,
    type ClassesSettings,
    type CancellationPolicy,
    type FreezePolicy,
    type FreezeReason,
    type CancellationOutcome,
    type SessionType,
    type ServiceType,
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
    type CommissionCategory,
    type CommissionValueType,
    type InstructorSeed,
    type RoleSeed,
    type RoleTypeSeed,
    type RoleStatusSeed,
    type StaffSeed,
    type Shift,
    type ShiftAssignment,
    type BlockedTime,
    type StaffStatusSeed,
    type NotificationSettingSeed,
    type NotificationCategorySeed,
    type NotificationDeliverySettingsSeed,
    type NotificationSeed,
    type NotificationEventSeed,
    type NotificationTabSeed,
    type NotificationIconSeed,
    type NotificationSourceSeed,
    type TaxRateSeed,
    type TaxRateStatusSeed,
    type TaxCalculationModeSeed,
    type TaxRateKindSeed,
    type TaxRateTypeSeed,
    type TaxRoundingModeSeed,
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
    type ReferralUnlockTriggerSeed,
    type ReferralRewardTypeSeed,
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
    SessionType, ServiceType,
    ClassCategory, ClassesSettings, CancellationPolicy, CancellationOutcome, FreezePolicy, FreezeReason, Branch, Room, BusinessHours, StaffProfile, Membership, Package, GiftCardDesign, IssuedGiftCard, PromoCode, MarketingItem, PaymentMethod,
    PurchaseRulesData, DurationUnit, Weekday,
    CommissionCategory, CommissionValueType,
    // Reports v33 — new seed types the selectors reach into
    Lead, MarketingCampaignStat, MarketingSpend, StaffAttendanceLog,
    // Migration & imports (2026-07-20) — audit log of AI-Agent imports
    ImportHistorySeed,
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

/** Hours window in 24h "HH:mm" strings. `null` when the branch is closed.
 *  The per-day "lunch break" block window was retired — branches now have
 *  a single open/close pair per weekday. */
export type HoursWindow = {
    open: string;
    close: string;
} | null;

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
 *  starting at 22:00 would push the end-time past close. */
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
    /** Distinct product types currently in the cart. `retail` added client
     *  2026-07-31 — merchandise lines are promo-eligible now. */
    productTypes: ("membership" | "package" | "gift_card" | "retail")[];
    /** Per-line breakdown. When provided, the validator restricts a promo to
     *  only the products it targets (`applies_to_product_ids`) and computes
     *  the discount against the eligible lines alone. Without it the check
     *  falls back to the cart-level type list. */
    lines?: { productId: string; kind: "membership" | "package" | "gift_card" | "retail"; lineTotal: number }[];
    /** Branch the sale happens at — gates branch-scoped promos. Empty /
     *  undefined (e.g. "All locations") skips branch gating. */
    branchId?: string;
}

export type PromoValidationResult =
    | { ok: true; promo: PromoCode; discountAed: number }
    | { ok: false; reason: string };

/**
 * Shared "is this promo currently redeemable" gate — the SAME three rules the
 * POS validator enforces below (active status + within `valid_until` + under
 * its usage limit). The admin POS (`validatePromoCode`) and the customer
 * voucher list (`usePromos` in lib/customer/purchase.ts) BOTH key off this, so
 * the set of live vouchers is guaranteed identical on both sides. Keep this in
 * sync with the status/expiry/usage checks in `validatePromoCode`.
 */
export function isPromoRedeemable(promo: PromoCode, nowMs: number = Date.now()): boolean {
    if (promo.status !== "active") return false;
    if (promo.valid_until) {
        const expiry = new Date(promo.valid_until).getTime();
        if (!Number.isNaN(expiry) && nowMs > expiry) return false;
    }
    if (promo.usage_limit != null && promo.usage_count >= promo.usage_limit) return false;
    return true;
}

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
    if (!code) return { ok: false, reason: "Enter a promotion." };
    const promo = promos.find(p => p.code.toUpperCase() === code);
    if (!promo) return { ok: false, reason: "This promotion doesn't exist. Check the code and try again." };
    if (promo.status !== "active") return { ok: false, reason: "This promotion is no longer active." };
    if (promo.valid_until) {
        // `valid_until` may be a full ISO datetime ("2025-12-31T00:00:00Z")
        // from the seed OR a bare date ("2025-12-31") from the create form —
        // parse it directly so we never double-append a time and produce an
        // Invalid Date (which previously rendered as "NaN undefined NaN").
        const expiry = new Date(promo.valid_until);
        if (!Number.isNaN(expiry.getTime()) && Date.now() > expiry.getTime()) {
            const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const label = `${expiry.getUTCDate()} ${MONTHS[expiry.getUTCMonth()]} ${expiry.getUTCFullYear()}`;
            return { ok: false, reason: `This promotion expired on ${label}.` };
        }
    }
    if (promo.usage_limit != null && promo.usage_count >= promo.usage_limit) {
        return { ok: false, reason: "This promotion has reached its usage limit." };
    }
    // Branch scope — empty `branch_ids` means "all branches". Only enforce
    // when the sale carries a specific branch (POS "All locations" = skip).
    if (promo.branch_ids && promo.branch_ids.length > 0 && cart.branchId
        && !promo.branch_ids.includes(cart.branchId)) {
        return { ok: false, reason: "This promotion isn't available at the selected branch." };
    }

    // Eligibility — a line qualifies when it passes BOTH the product-type
    // filter (`applies_to`) AND the specific-product filter
    // (`applies_to_product_ids`). Empty filters mean "applies to all". This is
    // the gate the promo's "Applicable products" / visibility settings feed:
    // products the admin didn't select are NOT discounted, even though they
    // share the same type.
    const allowedTypes = promo.applies_to ?? [];
    const allowedProductIds = promo.applies_to_product_ids ?? [];
    const lineEligible = (kind: "membership" | "package" | "gift_card" | "retail", productId: string): boolean => {
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
        return { ok: false, reason: "This promotion doesn't apply to the items in your cart." };
    }

    if (promo.min_purchase_aed != null && cart.subtotalAed < promo.min_purchase_aed) {
        return { ok: false, reason: `This promotion requires a minimum purchase of AED ${promo.min_purchase_aed}.` };
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
    if (role === "attendee")   return "attendees";
    // Member personas aren't Staff and don't get a Staff role.
    return null;
}

// ─── Legacy camelCase types (kept stable for existing consumers) ────────────

export type TemplateStatus = "Active" | "Archived" | "Inactive";
export type ClassStatus    = "Upcoming" | "Ongoing" | "Completed" | "Cancelled";

/** Class template — camelCase shape used by all current consumers. */
export interface ClassTemplate {
    id: string;
    /** Session type dimension — always "class" for a template (Classes come
     *  from templates; Private/Recovery come from Services). Stamped at
     *  adapter/boot. See new-prd/session-type-dimension-implementation-plan.md. */
    type: SessionType;
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

/** Service status mirrors `TemplateStatus` — separate alias kept so UI
 *  + future appointment surfaces can evolve independently. */
export type ServiceStatus = "Active" | "Archived" | "Inactive";

/**
 * Service — camelCase shape consumed by the Services list, detail page,
 * and the appointment / schedule-grid surfaces.
 *
 * Pricing model is currency-based (`price`, AED). The legacy
 * `applicableMembershipIds` / `applicablePackageIds` fields were dropped
 * — services no longer have access gates, customers just pay the fixed
 * price at appointment checkout.
 *
 * `category` + `coverColor` + `branchName` are denormalized from
 * class_categories / branches at adapter-time so list rows never need
 * a join to render.
 *
 * +later: instructorIds (Private services with pre-pickable trainers),
 *         multi-branch.
 */
export interface Service {
    id: string;
    name: string;
    description: string;
    categoryId: string;
    /** Category display name — denormalized from class_categories. */
    category: string;
    /** Session type dimension — "private" (1:1) or "recovery" (spa/wellness).
     *  The explicit field code filters on. See
     *  new-prd/session-type-dimension-implementation-plan.md. */
    type: ServiceType;
    /** True = Open session (multi-customer, capacity meaningful). Only
     *  meaningful when type="recovery" — private services force this
     *  false at the form layer. */
    openSession: boolean;
    durationMin: number;
    /** 0 for Private services. UI hides it when openSession=false. */
    capacity: number;
    /** Fixed price (AED). Customer pays this on appointment checkout. */
    price: number;
    /** FK → branches.id. Single-branch in Phase 1. */
    branchId: string;
    /** Branch display name — denormalized from branches for fast list render. */
    branchName: string;
    /** Optional default room ("" = no room). FK → rooms.id. A session may or
     *  may not use a room. */
    roomId: string;
    status: ServiceStatus;
    coverImage?: string;
    /** Tile background hex — resolved from class_categories.color_hex. */
    coverColor: string;
}

// ─── Appointments (Module 13 — Phase 4) ─────────────────────────────────────

export type AppointmentStatus = "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
export type AppointmentBookingStatus = "Booked" | "Attended" | "NoShow" | "Cancelled";

/** Appointment — camelCase shape consumed by the Service detail Appointments
 *  tab, the /appointments/[id] page, the schedule grid, and the customer
 *  profile Appointments sub-tab. Denormalizes the parent service's name +
 *  category + branchName + coverColor at adapter-time so list views render
 *  without an extra join.
 *
 *  Why denormalize: every list/grid surface that renders an appointment
 *  needs the service name + category color, and they're hot paths. The
 *  trade-off — name/color cascades when the service is edited — is handled
 *  in `updateService` by repatching denormalized fields on dependent
 *  appointments. */
export interface Appointment {
    id: string;
    serviceId: string;
    /** Session type dimension — inherited from the parent Service
     *  ("private" or "recovery"). Stamped at adapter/boot. */
    type: ServiceType;
    serviceName: string;
    serviceCategory: string;
    /** Tile background hex — resolved from class_categories.color_hex. */
    coverColor: string;
    coverImage?: string;
    branchId: string;
    branchName: string;
    /** Optional — a room is optional for any appointment (some sessions
     *  aren't room-scoped). Empty string when absent; Appointment detail
     *  side panel only renders the Room subline when `roomName` is set. */
    roomId: string;
    roomName: string;
    /** Set for Private services, omitted for Open session. */
    instructorId?: string;
    instructorName?: string;
    instructorInitials?: string;
    instructorColor?: string;
    instructorImageUrl?: string;
    /** True when this private appointment was booked with the customer's
     *  "Preference: Flexible" — the studio auto-assigned the instructor. Drives
     *  the Appointment Details "Flexible" badge + the Reassign-instructor action
     *  (only flexible appointments can be reassigned). Client 2026-07-24. */
    flexible?: boolean;
    /** True when the parent service is open_session — drives "Open session"
     *  badges + the bulk-select roster on the appointment detail page. */
    openSession: boolean;
    /** "2026-05-15" — used for sorting / range filters. */
    dateISO: string;
    /** "Sat, 27 Feb 2026" — UI-friendly. */
    date: string;
    startTime: string;
    endTime: string;
    /** "9:00 - 10:00 AM" */
    displayTime: string;
    capacity: number;
    booked: number;
    status: AppointmentStatus;
    cancelledReason?: string;
    cancelledAt?: string;
    cancelledBy?: string;
    /** Aggregate rating (1–5) for Completed appointments — denormalized
     *  from `appointmentRatings` rows for fast list-view rendering. 0
     *  when there are no ratings. */
    rating: number;
    ratingCount: number;
    createdAt: string;
}

/** AppointmentRating — camelCase shape consumed by the appointment detail
 *  Ratings tab + the service detail Rating column aggregate. Mirrors
 *  `ClassRating`. */
export interface AppointmentRating {
    id: string;
    appointmentId: string;
    customerId: string;
    customerName: string;
    customerInitials: string;
    customerImageUrl?: string;
    instructorId?: string;
    instructorName?: string;
    /** 1-5. */
    score: number;
    comment: string;
    tags?: string[];
    submittedAt: string;
    deletedAt?: string;
    deletedBy?: string;
}

/** One customer slot inside an Appointment. Roster on the detail page is
 *  derived from these rows for the parent appointment. */
export interface AppointmentBooking {
    id: string;
    appointmentId: string;
    customerId: string;
    /** Customer display name — denormalized for fast roster render. */
    customerName: string;
    customerInitials: string;
    customerColor: string;
    customerImageUrl?: string;
    status: AppointmentBookingStatus;
    bookedAt: string;
    cancelledAt?: string;
    cancelledBy?: string;
    attendanceMarkedAt?: string;
}

/** Instructor display shape used by Schedule list / form pickers / class detail. */
export interface ScheduleInstructor {
    id: string;
    name: string;
    initials: string;
    color: string;
    imageUrl?: string;
    /** Branch the instructor belongs to (mirrors staff.branch_id). `null`
     *  for Owner-type staff who span all locations. Consumers filter the
     *  instructor picker by this so a class scheduled at Branch X can
     *  only pick instructors whose branch is X (or is null). */
    branchId: string | null;
    /** Categories this instructor may teach (mirrors staff.categoryIds).
     *  Phase 1 unification (2026-08-05): carried ON the schedule pool so the
     *  form no longer has to reach into a SEPARATE staff table to judge
     *  eligibility — the pool it SELECTS from and the data that judges
     *  CAN-TEACH are now one and the same, killing the divergence that let a
     *  class show a valid instructor in the list yet "unavailable" on edit.
     *  Optional so the `Instructor` directory (which extends this) and any
     *  legacy literal keep compiling; the schedule pool always sets it. */
    categoryIds?: string[];
    /** Assigned shift id (mirrors staff.shiftId) — lets the picker apply the
     *  SAME shift gate the time-slot logic uses. */
    shiftId?: string | null;
    /** Whether the instructor is currently active (mirrors staff.status ===
     *  "active"). Inactive instructors can still be RESOLVED for display but
     *  should not be freshly selectable. */
    active?: boolean;
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

/** Re-export the seed-defined Shift type so consumer modules import a
 *  single canonical name. Mirrors the StaffStatus pattern above. */
export type { Shift, ShiftAssignment } from "@/data/mock/_types";

/** Re-export the seed-defined BlockedTime type so consumer modules import
 *  it from the same canonical name as every other store type. (`ClassCategory`
 *  is already re-exported via the bulk barrel above; see top of file.) */
export type { BlockedTime } from "@/data/mock/_types";

/** One pay-rate configuration slot on a staff member. `enabled` gates whether
 *  it applies; `payRateId` is the chosen rate (FK → payRates.id). */
export interface PayConfigEntry {
    enabled: boolean;
    payRateId?: string;
}
/** Pay-per-class adds a substitute rate + a flat substitution amount (AED paid
 *  per class the instructor covers as a substitute). */
export interface PayConfigClassEntry extends PayConfigEntry {
    substitutePayRateId?: string;
    substitutionAmountAed?: number;
}
/** Multi-configuration pay setup (client 2026-07-24). Instructors can earn on
 *  up to three tracks — a base Default rate, a per-class rate, and a
 *  per-appointment rate. Non-instructor roles only ever use `default` (always
 *  enabled). At least one entry must stay enabled at all times. */
export interface StaffPayConfig {
    default: PayConfigEntry;
    perClass: PayConfigClassEntry;
    perAppointment: PayConfigEntry;
}

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
    /** Canonical "default pay rate" FK (FK → payRates.id). Kept in sync with
     *  `payConfig.default.payRateId` — existing sidebar / preview / payroll
     *  reads still use this single field. */
    payRateId?: string;
    /** Multi-track pay configuration. Instructors get Default + Pay per class +
     *  Pay per appointment; other roles get Default only. */
    payConfig?: StaffPayConfig;
    /** Short introduction (instructor-only). Surfaces on the instructor
     *  detail page + (later) the customer-facing instructor portal. */
    shortIntro?: string;
    /** Years of working experience (instructor-only). */
    workingExperienceYears?: number;
    /** Assigned shift id — FK to a future shifts slice (placeholder for
     *  now — Shift management module designs land next). */
    shiftId?: string;
    /** Class categories this instructor can teach. Drives the
     *  cross-module instructor gating (templates / schedules / services
     *  / appointments). 1:N — one instructor → many categories. */
    categoryIds?: string[];
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
    /** Studio revenue from those classes (AED) — surfaces on the
     *  "Class revenue base" column of the Run Payroll table + CSV. Used
     *  as the reference figure for Split-Rate / revenue-share payout
     *  calculations, not as the instructor's take-home. */
    grossRevenue: number;
    baseEarnings: number;
    adjustmentAmount: number;
    adjustmentReason?: string;
    /** Final take-home: baseEarnings + adjustmentAmount + commissionAmount. */
    totalEarnings: number;
    // ── Sales commission (Monthly rate) — snapshotted at run confirm ────────
    /** Net package sales (AED) attributed to this staff in the period. */
    commissionPackagesSalesAed?: number;
    /** Net membership sales (AED) attributed to this staff in the period. */
    commissionMembershipsSalesAed?: number;
    /** Package commission % applied. */
    commissionPackagesPercent?: number;
    /** Membership commission % applied. */
    commissionMembershipsPercent?: number;
    /** AED commission portion of `totalEarnings`. */
    commissionAmount?: number;
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
    /** Session type dimension. "class" for a real class schedule; when an
     *  Appointment is projected into this shape via `appointmentToClassInstance`
     *  it carries the appointment's "private"/"recovery" type — so the
     *  schedule grid + dashboard filter one field across both surfaces.
     *  See new-prd/session-type-dimension-implementation-plan.md. */
    type: SessionType;
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
    /** True only when this row is a projected Appointment booked with
     *  "Preference: Flexible" (studio auto-assigned instructor). Drives the
     *  schedule List view's Flexible badge. Undefined for real classes.
     *  Client 2026-07-24. */
    flexible?: boolean;
}

/** @deprecated use `ClassSchedule`. */
export type ClassInstance = ClassSchedule;

/**
 * Project an `Appointment` into the schedule grid's `ClassInstance` shape so
 * the admin + instructor day/week/month views can render both surfaces
 * through the same code path. Per the brief, appointments only appear on
 * the grid when they have ≥1 customer booked (the renderer can also check
 * `booked > 0` itself; we leave that to the caller for visibility).
 *
 *   • Open session appointments fill `instructor*` fields with empty
 *     defaults — the grid card hides the instructor row when name is "".
 *   • `classType` is set to "Private" for Private appointments so the
 *     legacy filter UI on the admin schedule still works without a
 *     schema change.
 *   • The id is preserved verbatim (always starts with "appt_") so click
 *     handlers can branch on the prefix to route to /appointments/[id].
 */
export function appointmentToClassInstance(a: Appointment): ClassInstance {
    return {
        id: a.id,
        // Carry the appointment's own type through the projection so the
        // schedule grid + dashboard can filter Class/Private/Recovery on one
        // field even though appointments render through the ClassInstance shape.
        type: a.type,
        templateId: a.serviceId,
        name: a.serviceName,
        description: "",
        category: a.serviceCategory,
        branchId: a.branchId,
        instructorId: a.instructorId ?? "",
        instructorName: a.instructorName ?? "",
        instructorInitials: a.instructorInitials ?? "",
        instructorColor: a.instructorColor ?? "#e0e0e0",
        location: a.branchName,
        roomId: a.roomId,
        room: a.roomName,
        date: a.date,
        dateISO: a.dateISO,
        dayOfWeek: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(a.dateISO + "T00:00:00Z").getUTCDay()] ?? "",
        startTime: a.startTime,
        endTime: a.endTime,
        displayTime: a.displayTime,
        booked: a.booked,
        capacity: a.capacity,
        classType: a.openSession ? "Group" : "Private",
        equipment: "",
        spotSelectionEnabled: false,
        waitlistEnabled: false,
        rating: a.rating,
        ratingCount: a.ratingCount,
        status: a.status,
        genderAccess: "all",
        cancelledAt: a.cancelledAt,
        cancelledBy: a.cancelledBy,
        coverColor: a.coverColor,
        coverImage: a.coverImage,
        // Carry the Flexible flag so the schedule List view can badge
        // appointments booked with "Preference: Flexible".
        flexible: a.flexible,
    };
}

/** True when the given id was minted by the appointments seed/store.
 *  Used by grid click handlers to route to /appointments/[id] vs
 *  /schedule/[id]. */
export function isAppointmentId(id: string): boolean {
    return id.startsWith("appt_");
}

/**
 * Booking record. Customer details are looked up via `customers` at render
 * time — no `customerName`/`customerInitials`/`customerColor` copies live
 * on the row anymore.
 */

// ─── Waitlist promotion — Booking Rules (Settings → Booking rules → Waitlist) ──

/** How long a "Notify to accept" offer stays claimable. There is no admin field
 *  for this yet, so the demo uses a short, legible window; it is always clamped
 *  by the auto-promotion cutoff below (a claim can never outlive the cutoff). */
export const WAITLIST_CLAIM_TTL_MINUTES = 30;

/** Hours before class start at which auto-promotion stops. Mirrors the free
 *  cancellation window when the admin ticked "Match the free cancellation
 *  window" (so nobody is auto-booked straight into a charge), otherwise the
 *  custom "Stop auto promoting" value. */
export function waitlistCutoffHours(cs: ClassesSettings, policy: CancellationPolicy): number {
    if (cs.match_free_cancellation_window) {
        return policy.credit_before_window_unit === "minutes"
            ? policy.credit_before_window_value / 60
            : policy.credit_before_window_value;
    }
    return cs.stop_auto_promoting_unit === "minutes"
        ? cs.stop_auto_promoting_value / 60
        : cs.stop_auto_promoting_value;
}

/** Hours from now until a class starts, on the local wall clock (the convention
 *  every other demo date calculation uses). Negative once the class has begun. */
export function hoursUntilClass(dateISO: string, startTime: string): number {
    const [y, m, d] = dateISO.split("-").map(Number);
    const [hh, mm] = startTime.split(":").map(Number);
    if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return Number.POSITIVE_INFINITY;
    return (new Date(y, m - 1, d, hh, mm, 0, 0).getTime() - Date.now()) / 3_600_000;
}

/** True while `booking` holds a live, unexpired claim on a freed spot. */
export function hasLiveWaitlistClaim(booking: ClassBooking): boolean {
    return (
        booking.status === "waitlisted" &&
        !booking.waitlistClaimDeclinedAt &&
        !!booking.waitlistClaimExpiresAt &&
        Date.parse(booking.waitlistClaimExpiresAt) > Date.now()
    );
}

/** Bridge for customer-facing notifications. `store.ts` must not import the
 *  customer notification feed (that module imports the store), so the feed
 *  registers its writer here on load and the store fires through it. */
export const customerNotificationSink: {
    emit:
        | null
        | ((n: {
              customerId: string;
              event:
                  | "booking_confirmed"
                  | "spot_available"
                  // Freeze policy v2 (client 2026-07-20)
                  | "membership_frozen"
                  | "membership_reactivated"
                  | "freeze_reminder";
              title: string;
              message: string;
              relatedType: "booking" | "customer_plan";
              relatedId: string;
          }) => void);
} = { emit: null };

// Broadcast bridge for Studio announcements (marketing rework 2026-08). The
// store owns publishing but can't import the customer notification feed (that
// module imports the store), so a published announcement fires through this
// sink. The feed-side handler applies the per-viewer consent gate (Push
// channel + Studio-announcements topic) + branch scope before it surfaces.
export const customerAnnouncementSink: {
    emit: null | ((a: { id: string; title: string; message: string; branchIds: string[] }) => void);
} = { emit: null };

// Campaign send bridge — a campaign is pushed to its chosen segment. Same
// pattern as the announcement sink; the feed-side handler applies the
// per-viewer consent gate (Push channel + the campaign's TOPIC) + branch scope.
export const customerCampaignSink: {
    emit: null | ((c: { id: string; title: string; message: string; branchIds: string[]; topic?: CampaignTopic }) => void);
} = { emit: null };

export interface ClassBooking {
    id: string;
    classScheduleId: string;
    customerId: string;
    /** Set when this seat was booked by `customerId` FOR another person (a guest
     *  without their own account). The seat still bumps the class count. */
    guestName?: string;
    /** Guest contact + chosen payment, for the booking-detail "Book to" section.
     *  Guests are captured by PHONE now (client 2026-08); `guestEmail` is kept
     *  optional for pre-existing bookings written before the switch. */
    guestPhone?: string;
    guestEmail?: string;
    guestPayment?: "drop_in" | "guest_package" | "invite_link" | "booker_credit";
    branchId: string;
    /** Plan id used to pay (FK to memberships or packages). Empty string if no plan. */
    planId: string;
    /** Plan display name — resolved from plan_id_used at boot. */
    planName: string;
    /** Which plan kind paid the booking. */
    planKindUsed?: "membership" | "package";
    /** Selected spot id (e.g. "A3") — set when the class has spot selection on. */
    spot?: string;
    bookingTime: string;
    status: "booked" | "waitlisted" | "cancelled";
    attendanceStatus: "pending" | "present" | "no_show" | "late_cancel";
    cancelledAt?: string;
    cancellationReason?: string;
    refundCreditIssued?: boolean;
    waitlistPosition?: number;
    /** Waitlist claim offer — set on the next-in-line seat when a spot frees up
     *  and Booking Rules are in "Notify to accept" mode. The seat stays
     *  `waitlisted` until the member claims it; if the claim lapses or is
     *  declined, the spot passes to the next person. */
    waitlistClaimOfferedAt?: string;
    waitlistClaimExpiresAt?: string;
    /** Set when the member declined, or the claim window lapsed — the seat is
     *  skipped when the spot is re-offered so it can't be offered twice. */
    waitlistClaimDeclinedAt?: string;
    /** ISO timestamp stamped when this booking was promoted from the waitlist
     *  to a confirmed seat. `waitlistPosition` is cleared on promotion, so this
     *  is the ONLY durable signal of a waitlist→booked conversion — the
     *  Insights "Waitlist conversions" KPI counts rows carrying it. */
    promotedFromWaitlistAt?: string;
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
    /** Archive flag, NOT a lifecycle status (client 2026-08-10). `active` =
     *  a normal, visible customer; `archived` = tidied out of the list (a
     *  "place", not a status): excluded from every tab/count/search/campaign,
     *  reachable only via "View archived (n)", access UNCHANGED, and auto-
     *  revived when the customer's own account books/purchases. Inactivity is
     *  no longer stored — it's derived from the wallet (see `customerSegment`). */
    status: "active" | "archived";
    /** Optional internal note captured when a customer is archived (why they
     *  were tidied away). Display-only; never shown to the customer. */
    archiveNote?: string;
    /** ISO timestamp the customer was archived — set on archive, cleared on
     *  recover / auto-revive. Feeds the "Archived (n)" view ordering. */
    archivedAtISO?: string;
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
    // ── Marketing preferences ────────────────────────────────────────
    // 4 delivery channels + 4 content topics. See _types.ts for the
    // dispatch semantics (topic AND channel both opted in = delivered).
    marketingChannelEmail?: boolean;
    marketingChannelWhatsapp?: boolean;
    marketingChannelSms?: boolean;
    marketingChannelPush?: boolean;
    marketingTopicStudioAnnouncements?: boolean;
    marketingTopicNewClassLaunch?: boolean;
    marketingTopicSpecialOffers?: boolean;
    marketingTopicPromoCodeOffers?: boolean;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelation?: string;
    referralCode?: string;
    // ── Reports v33 fields (Customer Data report) ────────────────────────
    firstVisitISO?: string;
    marketingSource?: string;
    convertedFrom?: "first-visit" | "intro-offer" | "trial-class" | "referral";
    // ── Customer & Lead Management v83 — hybrid lifecycle model (client 2026-07-24) ─
    // Two-layer model: AI-owned `lifecycleTag` + human-owned `followUpStatus`
    // (see new-prd/customer-lead-management-implementation-plan.md §Lifecycle
    // rules). Every field is OPTIONAL so pre-v83 rows keep hydrating cleanly;
    // the recompute hook fills them in on the next customer-touching action.
    /** AI-detected lifecycle stage. Computed by `computeLifecycleTag` and
     *  recomputed after every write that touches a customer's behaviour
     *  (booking / cancel / attendance / plan / transaction / rating). */
    lifecycleTag?: LifecycleTag;
    /** ISO date (YYYY-MM-DD) the lifecycleTag was last CHANGED — used by
     *  the profile header pill's hover tooltip ("Tagged Loyal Active on
     *  YYYY-MM-DD"). Stamped only when the recompute produces a NEW tag;
     *  a same-tag recompute leaves this alone so the date reflects the
     *  actual transition, not the last render. */
    lifecycleTaggedOn?: string;
    /** Orthogonal VIP flag — stacks on top of `lifecycleTag`. Auto-computed
     *  (top-10% LTV) or manually flagged; the compute treats it as sticky
     *  once set to true unless a manual override clears it. */
    isVip?: boolean;
    /** Human-owned follow-up state for pre-conversion customers (Lead /
     *  Trialist only). Staff advance this through the funnel; `"Lost"`
     *  suppresses the task engine until the customer books again. */
    followUpStatus?: FollowUpStatus;
    /** Staff member (id) responsible for follow-up. Any role — the plan
     *  is deliberately loose about which roles get assigned. */
    assignedTo?: string;
    /** Lead source (id → `leadSources[].id`). Read-only after intake; the
     *  Settings module manages the list. */
    sourceId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer & Lead Management v83 — lifecycle types (client 2026-07-24)
// ─────────────────────────────────────────────────────────────────────────────
//
// Companion types for the new fields on `Customer`. Kept adjacent so future
// reads don't have to hunt for the union definitions. See the plan doc's
// "Lifecycle rules" table for the source-of-truth definitions.

/** AI-owned lifecycle stage — Layer 1. Precedence within Layer 1 is
 *  Churned > At Risk > Won-back (30d sticky) > New Active > Loyal Active >
 *  Trialist > Lead. The compute picks ONE tag per customer. */
export type LifecycleTag =
    | "Lead"
    | "Trialist"
    | "New Active"
    | "Loyal Active"
    | "At Risk"
    | "Churned"
    | "Won-back";

/** Human-owned pre-conversion follow-up state — Layer 2. Only rendered
 *  when `lifecycleTag ∈ { "Lead", "Trialist" }`; hidden downstream. */
export type FollowUpStatus =
    | "New"
    | "Contacted"
    | "Trial booked"
    | "Follow-up"
    | "Won"
    | "Lost";

/** Trigger source for `FollowUpTask` — the "why this exists" reason. Every
 *  task carries one so the profile activity log can show the origin. */
export type FollowUpTaskTrigger =
    | "enquiry_logged"
    | "lead_form_submitted"
    | "trial_no_rebook_7d"
    | "first_booking_cancelled";

/** Terminal outcome recorded by staff when they close a task. Feeds the
 *  precedence rule: `not_interested` → follow-up status → Lost. */
/** Outcome a follow-up task closes with.
 *   • reached / follow_up / not_interested — staff-picked outcomes.
 *   • auto_closed — v83 audit-3 (2026-07-27): the compute detected the
 *     customer graduated past pre-conversion, so the open task is closed
 *     automatically. Distinguishing this from "reached" keeps the
 *     Activity log honest — nobody actually reached them, the system
 *     just cleaned up. */
export type FollowUpTaskOutcome =
    | "reached"
    | "follow_up"
    | "not_interested"
    | "auto_closed";

/** Signal → task engine row. Materialised by the Phase 4 generator when a
 *  trigger fires; closed by staff on the Dashboard widget or the profile
 *  Follow-ups tab (Phase 5). */
export interface FollowUpTask {
    id: string;
    customerId: string;
    triggerKind: FollowUpTaskTrigger;
    /** Human-readable one-liner rendered on the widget + tab. */
    reason: string;
    assigneeId?: string;
    status: "open" | "closed";
    outcome?: FollowUpTaskOutcome;
    createdAt: string;
    closedAt?: string;
}

/** Studio-editable lead source — surfaced in Settings → Customer →
 *  Customer sources (Phase 6). System-seeded rows are `locked` so they
 *  can be renamed but not deleted. */
export interface LeadSource {
    id: string;
    label: string;
    /** True for the 10 defaults — the row can be renamed but not deleted. */
    locked?: boolean;
}

/** Studio-editable follow-up stage — surfaced in Settings → Customer →
 *  Follow-up stages (Phase 6). `Won` + `Lost` are system-mandatory so the
 *  precedence rules can rely on them existing. Max 8 stages (guardrail). */
export interface FollowUpStage {
    id: string;
    label: string;
    /** True for the 6 defaults — the row can be renamed but not deleted. */
    locked?: boolean;
    /** `Won` + `Lost` — closes the funnel. */
    isTerminal?: boolean;
}

/** Customer agreement record — store shape (camelCase) of a
 *  `customer_agreements` row. Drives the customer-detail Agreements tab. */
export interface CustomerAgreement {
    id: string;
    customerId: string;
    /** True when the customer signed WITH parent/guardian consent (they were a
     *  minor at signing). A minor whose signed waiver lacks this must re-sign. */
    guardianConsent?: boolean;
    /** Phase 4 FK → agreements.id. The tab joins on this to display the live
     *  agreement name + open the View modal with the joined version's content. */
    agreementId: string;
    /** Snapshot of the agreement name at issue time. Live consumers should
     *  prefer the joined `agreements` row's name when present. */
    title: string;
    version: number;
    branchId: string;
    classTemplateIds: string[];
    /** Split into 3 distinct terminal states (v24 — was
     *  `"signed" | "unsigned"` in v23):
     *    • "signed"         — customer signed the CURRENT version.
     *    • "re_accept_due"  — customer signed an OLDER version; must
     *                          accept the newer version before next
     *                          booking. Drives amber pill + surfaces
     *                          in the Acceptance status → Needs
     *                          re-acceptance sub-tab.
     *    • "never_signed"   — customer has never accepted this
     *                          agreement. Drives red pill + surfaces
     *                          in the Acceptance status → Pending /
     *                          never sub-tab. Legacy `"unsigned"` rows
     *                          migrate here on the v23→v24 persist bump. */
    status: "signed" | "re_accept_due" | "never_signed";
    signedAtISO?: string;
}

/** Customer referral record — store shape (camelCase) of a
 *  `customer_referrals` row. Drives the customer-detail Referrals tab. */
export interface CustomerReferral {
    id: string;
    referrerCustomerId: string;
    referredName: string;
    referredEmail: string;
    /** LEGACY — kept populated at boot so any consumer still reading
     *  `benefitCredits` (customer-portal referral page, reports) sees a
     *  sensible number even for `wallet_credit` rows. Read
     *  `benefitType` + `benefitAmount` in new code. */
    benefitCredits: number;
    /** Reward kind stamped at referral-creation from the live
     *  `referralSettings.referrerEarnType`. Drives how the Referrals
     *  tab aggregates + how each row's Benefit cell reads:
     *    • "free_credits"  → row shows "N credits", aggregated into the
     *                        "Class credits" line of the Rewards earned card.
     *    • "wallet_credit" → row shows "AED N", aggregated into the
     *                        "Account credits" line.
     *    • "discount"      → deferred; not surfaced in the prototype. */
    benefitType: ReferralRewardType;
    /** Numeric amount matching `benefitType` — count of class credits for
     *  `free_credits`, AED amount for `wallet_credit`. Always populated
     *  at boot by `customerReferralFromSeed` (falls back to
     *  `benefit_credits` for pre-v56 seed rows). */
    benefitAmount: number;
    referredAtISO: string;
    /** When the earned reward expires. Computed at referral-creation time
     *  as `referredAtISO + referralSettings.earnedRewardExpiryDays`.
     *  Surfaces on the customer-detail Referrals tab's new "Expiry date"
     *  column. Optional on the type so legacy seeds without an expiry
     *  still load; the UI renders "—" when missing. */
    expiresAtISO?: string;
    /** v25 — Branch the credits are locked to when the "Credits
     *  redeemable across all branches" toggle is OFF. Captured at
     *  referral-creation from the REFERRER's `customer.branchId`.
     *  Read by `canRedeemReferralCreditsAt()` in referral-helpers.ts
     *  to gate POS + booking flow redemption. Undefined for legacy
     *  seed rows — treated as "unrestricted" by the helper so
     *  historical data doesn't get inadvertently locked out. */
    originBranchId?: string;
    /** Client 2026-07-31 — when the referrer's reward actually PAID OUT.
     *  Undefined = the referral exists but the unlock condition (see
     *  `referralSettings.rewardUnlockTrigger`) hasn't been met yet, so
     *  the reward is still pending. Set the moment
     *  `evaluateReferralRewards` fires, which also guarantees a reward
     *  can never be issued twice for the same referral.
     *
     *  Seeded rows are backfilled to their `referredAtISO` at boot —
     *  they're historical records whose rewards were already counted in
     *  the Rewards-earned card, so they must not re-fire. */
    rewardIssuedAtISO?: string;
    /** FK → customers.id for the FRIEND once they exist as a real
     *  customer. Referrals start life keyed only by name + email (the
     *  friend hasn't signed up yet); this is stamped when the signup's
     *  referral code resolves, and is what lets a later purchase find
     *  the pending referral without an email round-trip. */
    referredCustomerId?: string;
    // ── Reports v33 fields (Referral Report + Win-back) ──────────────────
    campaign?: string;
    reactivated?: boolean;
    reactivationDateISO?: string;
    newPlanId?: string;
    revenueRecoveredAed?: number;
}

/** Wallet transaction — store shape (camelCase) of a `wallet_transactions`
 *  row. One credit / debit against a customer's account-credit (AED) balance.
 *  The balance is DERIVED (`walletBalanceAed(customerId)`), never stored. */
export interface WalletTransaction {
    id: string;
    customerId: string;
    branchId: string;
    type: "credit" | "debit";
    /** Positive AED amount; `type` carries the sign. */
    amountAed: number;
    reason: string;
    referenceType?: "referral" | "pos_sale" | "refund" | "manual";
    referenceId?: string;
    createdAtISO: string;
    createdBy?: string;
}

/** Derive a customer's account-credit (AED) balance from the wallet ledger:
 *  sum of credits − sum of debits. Single source of truth for every surface
 *  (Wallet tab, POS Member Wallet availability, referral rewards). */
export function walletBalanceAed(transactions: WalletTransaction[], customerId: string): number {
    return transactions
        .filter(t => t.customerId === customerId)
        .reduce((sum, t) => sum + (t.type === "credit" ? t.amountAed : -t.amountAed), 0);
}

// ─── Customer notification settings (PRD 11 §12) ───────────────────────────

export type NotificationCategory = NotificationCategorySeed;

/** v27 — WhatsApp Business template approval workflow states. Mirror
 *  of `WhatsappApprovalStatusSeed` — see the seed for prose. */
export type WhatsappApprovalStatus = "approved" | "pending" | "rejected";

/** v27 — send-timing mode. `immediately` = fire on trigger; `scheduled`
 *  = fire at each offset in `sendOffsets` before the event. */
export type NotificationSendMode = "immediately" | "scheduled";

/** v27 — repeatable send-offset row inside the Manage-timing tab. */
export interface NotificationSendOffset {
    value: number;
    unit: "minutes" | "hours" | "days";
}

/** v27 — single-record delivery window. Drives the "Quiet hours" pill
 *  + "Delivery hours" side-panel on the notifications landing. */
export interface NotificationDeliverySettings {
    id: string;
    onlySendDuringSetHours: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    criticalBypassesQuietHours: boolean;
}

/** Camel-cased mirror of `NotificationSettingSeed`. Drives the per-event
 *  channel toggles + template editor on Settings → Customer notifications
 *  (v27 redesign per Figma 7745:26872). */
export interface NotificationSetting {
    id: string;
    category: NotificationCategory;
    notificationType: string;
    label: string;

    // Channel switches (v27 — Push replaced by SMS)
    emailEnabled:    boolean;
    whatsappEnabled: boolean;
    smsEnabled:      boolean;

    // Template bodies (one per channel)
    emailSubject?:    string;
    emailTemplate?:   string;
    whatsappTemplate?: string;
    smsTemplate?:      string;

    // WhatsApp Business template approval workflow
    whatsappApprovalStatus:   WhatsappApprovalStatus;
    whatsappRejectionReason?: string;

    /** Payment critical flag — blocks disabling the LAST enabled
     *  channel (toast fires) so payment issues always reach the
     *  customer. */
    isCritical: boolean;

    /** Send-timing config — Immediately vs multi-offset. */
    sendMode:    NotificationSendMode;
    sendOffsets: NotificationSendOffset[];

    /** Marketing-only flag — landing renders "Sent during campaigns"
     *  pill in place of the send-time summary. */
    sentDuringCampaigns?: boolean;

    /** Who receives this event's notification. Omitted = "customer"
     *  (the customer tied to the source event, e.g. buyer on a
     *  payment). `"gift_card_recipient"` = the recipient stored on
     *  the IssuedGiftCard row so the person BEING GIFTED the card
     *  gets the redemption code, not the buyer. */
    recipientSource?: "customer" | "gift_card_recipient";

    /** Optional branch scope. When omitted, this row is the studio-wide
     *  DEFAULT. When set, this row is a per-branch OVERRIDE for the
     *  same notificationType — inherits the parent's label + category
     *  identity but carries its own channel toggles, templates, and
     *  timing. Only surfaces on `marketing`-category rows in the UI;
     *  the other categories keep their studio-wide behaviour.
     *
     *  Dispatch look-up (future): given a (notificationType, branchId)
     *  pair, prefer the branchId-scoped row if present, else fall
     *  back to the row with no branchId. */
    branchId?: string;
}

// ─── Tax module (PRD 11 §10) ───────────────────────────────────────────────

export type TaxRateStatus = TaxRateStatusSeed;
export type TaxCalculationMode = TaxCalculationModeSeed;
export type TaxRateKind = TaxRateKindSeed;
export type TaxRateType = TaxRateTypeSeed;
export type TaxRoundingMode = TaxRoundingModeSeed;

/** Camel-cased mirror of `TaxRateSeed`. Drives /admin/settings/tax → Tax
 *  rates list. Phase 4 cross-module wiring: every membership / package /
 *  gift card / pay rate gets an optional `taxRateId` FK to this row. */
export interface TaxRate {
    id: string;
    name: string;
    ratePercentage: number;
    /** VAT vs Income tax bucket. */
    kind: TaxRateKind;
    /** Standard / Zero-rated / Exempt — see TaxRateTypeSeed. */
    type: TaxRateType;
    description?: string;
    calculationMode: TaxCalculationMode;
    status: TaxRateStatus;
    createdAt: string;
    /** Effective-window bounds (ISO `YYYY-MM-DD`). Both optional — see
     *  `TaxRateSeed` for the display rules. */
    validFromISO?:  string;
    validUntilISO?: string;
}

/** Studio-wide tax display + calculation settings. */
export interface TaxSettings {
    pricesIncludeTax: boolean;
    /** Per-line vs per-invoice rounding strategy. */
    roundingMode: TaxRoundingMode;
    /** Tax Registration Number (TRN) — studio's VAT id with the tax
     *  authority. Optional; empty when the studio hasn't been issued
     *  one yet. Free-text for the prototype. */
    trn?: string;
    /** Country whose tax authority issued the TRN. Full country name;
     *  matches `Country.name` in `src/lib/data/locales.ts`. */
    trnCountry?: string;
    /** When true, the TRN prints on every customer invoice + receipt
     *  (Figma 7769:106370 toggle). Defaults on when a TRN is set. */
    displayTrnOnInvoice?: boolean;
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

/** Effective-dates mode from Step 2 of the Agreement create/edit wizard
 *  (Figma 7703:13587 / 7703:13751).
 *    • "ongoing" — no expiry. Agreement stays in effect until updated.
 *                  Detail page + list Effective-until column show an
 *                  "Ongoing" pill (no dates rendered).
 *    • "expiry"  — bounded window. Requires both `issueDate` and
 *                  `expiryDate`; the list column renders the expiry
 *                  date and the detail page shows both. */
export type AgreementEffectiveDatesMode = "ongoing" | "expiry";

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
    /** v24 — new field. Drives which pair of date pickers renders in
     *  Step 2 + how the Effective-until column reads on the list. When
     *  "ongoing", `effectiveFrom` / `effectiveUntil` are ignored. */
    effectiveDatesMode: AgreementEffectiveDatesMode;
    /** Effective-from date (Step 2 "Issue Date"). Required when mode is
     *  "expiry"; kept as-is (or empty) when "ongoing" so the field can
     *  round-trip cleanly if the admin switches back mid-edit. */
    effectiveFrom: string;
    /** Effective-until date (Step 2 "Expiry Date"). Same optionality as
     *  `effectiveFrom`. */
    effectiveUntil: string;
    /** v24 — Re-acceptance policy. When true and a new version
     *  publishes, existing signed customers flip to
     *  `re_accept_due` and are prompted to re-accept before their
     *  next booking. Drives the tooltip "Customers must accept the
     *  latest version before their next booking". */
    requireReAcceptance: boolean;
    /** v24 — Minors & guardian consent. When true, customers under 18
     *  are routed to a guardian-signature flow before booking. Drives
     *  the tooltip "Guardian consent is required for customers under
     *  18". */
    requireGuardianConsent: boolean;
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
    /** Registered legal entity name — surfaced on tax invoices + agreement
     *  PDFs. Optional in the form (admin can leave blank) but seeded with
     *  a realistic value so the demo never renders an empty row. */
    legalBusinessName: string;
    /** Government-issued trade-license id. Same nullability semantics as
     *  `legalBusinessName`. */
    tradeLicenseNumber: string;
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

/** Brand typeface key — drives both the live template preview and the
 *  customer portal font stack. Avenir is the user-visible label only:
 *  we render it with Nunito Sans (free Google font, closest geometric
 *  humanist match) since Avenir itself is Adobe-licensed. */
export type BrandTypeface =
    | "dm_sans"
    | "inter"
    | "avenir"
    | "playfair_display"
    | "cormorant_garamond"
    | "lora";

/** Per-channel "this channel carries my brand identity" toggle. Separate
 *  from `notificationSettings` (per-event email/whatsapp/push booleans) —
 *  this just controls whether the customer-facing notification surfaces
 *  use the studio's display name + logo + colours on each channel. */
export interface BrandingNotificationChannels {
    email:    boolean;
    whatsapp: boolean;
    sms:      boolean;
}

/** Single source of truth for the studio's brand identity + customer-portal
 *  preferences. Phase 2 holds it in store memory; Phase 3 will repoint the
 *  initial state at `src/data/mock/branding_settings.ts`. Field shape
 *  mirrors PRD 11 §13.2 plus the brief's Portal-preferences additions. */
export interface BrandingSettings {
    displayName:     string;
    /** Full-colour primary logo URL (data URL when uploaded via the form,
     *  external URL otherwise). Empty string when not uploaded — the
     *  landing card surfaces "Not uploaded" until set. */
    logoUrl:         string;
    /** App icon (used in the customer portal's PWA install + lock-screen
     *  badges). Square asset, PNG / JPEG up to 2 MB. */
    appIconUrl:      string;
    /** Favicon — small square asset used in browser tabs / bookmark bars. */
    favIconUrl:      string;
    primaryColor:    string;
    backgroundColor: string;
    /** Tertiary colour — used for inner card / tile backgrounds in the
     *  customer portal (Class detail metric tiles, Home category tiles,
     *  What's on subcard chrome) to break the canvas into 3 visual
     *  layers (background ↔ tertiary ↔ surface). */
    tertiaryColor:   string;
    textColor:       string;
    /** Human label for the text colour (e.g. "Black") — displayed in the
     *  landing preview where the hex would read poorly. */
    textColorLabel:  string;
    /** Brand typeface — drives the customer portal font + template preview. */
    typeface:        BrandTypeface;
    /** Per-channel branding toggles — see BrandingNotificationChannels. */
    notificationBranding: BrandingNotificationChannels;
    portalUrl:       string;
    /** Master switch — when off, the portal renders without a menu bar even
     *  if individual items are enabled. */
    menuBarVisible:  boolean;
    menuItems:       PortalMenuItem[];
    /** The HTML/JS snippet the admin pastes into their site to embed the
     *  Forma portal. Held as a single multi-line string. */
    embedCode:       string;
    /** How far ahead the embedded schedule shows (client 2026-08-08).
     *  Optional so pre-existing branding literals don't need it. */
    embedWindow?:    "1w" | "2w" | "3w" | "1m";
    /** Which branch the embed defaults to. "" / undefined = all locations. */
    embedLocationId?: string;
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

// ─── Referral settings (PRD 11 §11 — redesigned per Figma 4620:151863) ─────

/** When the earned reward releases to the referrer. Drives the
 *  "Rewards unlock when" trigger group in the Reward rules & limits side
 *  panel (Figma 7661:54592).
 *
 *    • "friend_signup"          — Fastest, but pays out before any spend.
 *                                  Higher abuse risk.
 *    • "friend_first_purchase"  — Recommended, reward only releases on
 *                                  real revenue.
 *    • "friend_first_class"     — Strongest quality signal; slowest to
 *                                  reward (the friend has to actually
 *                                  attend a class). */
export type ReferralUnlockTrigger =
    | "friend_signup"
    | "friend_first_purchase"
    | "friend_first_class";

/** What both the referrer and the friend earn. Today the only seeded
 *  option is "free_credits"; the dropdown is shipped union-typed so
 *  future iterations can add wallet credit / discount / cash without
 *  reshaping the store. */
export type ReferralRewardType = "free_credits" | "wallet_credit" | "discount";

/** Legacy alias kept to avoid breaking imports while the redesign rolls
 *  out — old call sites that referenced `ReferralTrigger` continue to
 *  compile (and silently degrade to the new trigger enum). New code
 *  should use `ReferralUnlockTrigger`. */
export type ReferralTrigger = ReferralTriggerSeed;

/** Camel-cased mirror of `ReferralSettingsSeed`. Drives:
 *    • /admin/settings/referral landing (3 cards)
 *    • Reward rules & limits side-panel modal (Figma 7661:54592)
 *    • Eligibility & fraud controls side-panel modal (Figma 7661:85303)
 *    • Customize referral information page (Figma 4627:153001)
 *    • Customer-detail Referrals tab KPIs (Total referrals N/maxReferrals)
 *    • Variable substitution in `infoDescription` ({{referrer}}, {{friend}},
 *      {{trigger}}, {{cap}}) */
export interface ReferralSettings {
    /** Master switch — when off, the customer portal hides the referral
     *  CTA and the admin Customer tab's "Refer a friend" action disables. */
    programActive: boolean;

    // ── Reward rules & limits (Figma 7661:54592) ─────────────────────────
    /** What the referrer earns (the existing customer who shared the link). */
    referrerEarnType:   ReferralRewardType;
    referrerEarnAmount: number;
    /** What the friend earns (the new customer arriving via the link). */
    friendEarnType:     ReferralRewardType;
    friendEarnAmount:   number;
    /** When the reward releases — see `ReferralUnlockTrigger`. */
    rewardUnlockTrigger: ReferralUnlockTrigger;
    /** Per-member cap on how many referrals can earn a reward. Drives the
     *  "Total referrals N/X" KPI on the customer detail tab; admins can
     *  still see ALL referrals in the table, but the cap gates payout. */
    maxReferralsPerMember: number;
    /** How long an earned reward stays redeemable, in days. Drives the
     *  new `customerReferrals.expiresAtISO` field at create-time. */
    earnedRewardExpiryDays: number;
    /** Monthly cap on total program AED spend. Soft cap — visible only
     *  in the admin landing card; not yet enforced in the redemption
     *  flow. */
    monthlyProgramBudgetAed: number;

    // ── Eligibility & fraud controls (Figma 7661:85303) ──────────────────
    /** When on, the redemption flow blocks attempts where the friend
     *  shares an email / phone / payment method with the referrer. */
    preventSelfReferral: boolean;
    /** When on, the friend must have no prior account or booking. */
    newCustomersOnly: boolean;
    /** AED amount the friend must spend before the reward releases. 0
     *  means "no minimum spend gate". */
    minFirstSpendAed: number;
    /** When ON, earned credits can be used at ANY branch. When OFF,
     *  credits redeem only at the location they were earned. */
    creditsRedeemableAllBranches: boolean;

    // ── Customize information (Figma 4627:153001) ────────────────────────
    /** Headline shown to customers on the portal referral card. */
    infoTitle: string;
    /** Rich-HTML body. Supports `{{referrer}}` / `{{friend}}` /
     *  `{{trigger}}` / `{{cap}}` substitutions resolved at render time
     *  against the current settings. Customers see the resolved string;
     *  the editor stores the raw token form. */
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
    status: "active" | "expired" | "frozen" | "freeze_requested" | "cancelled" | "removed";
    purchasedAtISO: string;
    expiryISO: string;
    priceAed?: number;
    freezeStartISO?: string;
    freezeEndISO?: string;
    /** Origin surface that initiated the freeze. Mirrors the
     *  `customer_plans.freeze_source` seed column. */
    freezeSource?: "customer_portal" | "admin" | "front_desk";
    /** Lifetime count of times this plan has been frozen — enforces the
     *  freeze policy's "max freezes per membership" on the customer side.
     *  Incremented on every freeze (admin + customer). Kept for legacy
     *  paths + reporting; the rolling-12-months window uses
     *  `freezeHistoryISO` below. */
    freezeCount?: number;
    /** Every freeze START date (YYYY-MM-DD) for this plan, appended on
     *  each freeze. Enforces the rolling-12-months freeze cap — the
     *  eligibility check counts entries whose iso is ≥ (today − 365d).
     *  Never cleared on unfreeze so past freezes still count against
     *  the window. Client 2026-07-22. */
    freezeHistoryISO?: string[];
    /** Reason the member gave when self-freezing (from the freeze policy's
     *  allowed reasons). Surfaced admin-side so the studio sees WHY the
     *  membership was paused. Cleared on unfreeze. */
    freezeReason?: string;
    /** Idempotency stamp for the "freeze reminder" customer notification.
     *  Set to the local ISO day when the reminder fired so a second hydrate
     *  the same day doesn't spam the bell. Cleared on unfreeze so a future
     *  freeze can re-arm. (Freeze policy v2 — client 2026-07-20 Phase 4.) */
    freezeReminderSentAtISO?: string;
    // ── Freeze policy v2 Phase 5 — approval flow (client 2026-07-20) ────────
    /** Requested freeze START date while `status === "freeze_requested"`.
     *  Copied over onto `freezeStartISO` when an admin approves; discarded
     *  on reject. */
    freezeRequestStartISO?: string;
    /** Requested freeze END date while `status === "freeze_requested"`.
     *  Approval copies onto `freezeEndISO`; reject discards. */
    freezeRequestEndISO?: string;
    /** Reason the customer supplied with the request. Shown in the admin
     *  Approve/Reject modal + persisted as `freezeReason` on approve. */
    freezeRequestReason?: string;
    /** ISO timestamp the customer submitted the request — drives the "New
     *  request" pill sort order in the admin surface. */
    freezeRequestedAtISO?: string;
    /** Optional note the admin wrote when rejecting. Cleared once the
     *  customer submits a new request. */
    freezeRejectionNote?: string;
    // ── Freeze policy v2 Phase 5 — Option B (stay_on_schedule) billing ─────
    /** Proration credit applied to the NEXT charge when the studio's
     *  `billing_behavior === "stay_on_schedule"`. Rendered on the plan card
     *  ("Next charge: AED 285 (saved AED 15)") and consumed at renewal
     *  time. Undefined for Option A ("pause") since Pause shifts the
     *  billing date instead of discounting the amount. */
    nextChargeAdjustmentAed?: number;
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
    // ── Reports v33 fields ───────────────────────────────────────────────
    totalCredits?: number;
    creditsUsed?: number;
    autoRenew?: boolean;
    nextBillingAmountAed?: number;
    allowance?: string;
}

/** Customer transaction record — store shape (camelCase) of a
 *  `customer_transactions` row. One per membership / package payment; drives
 *  the customer-detail Payments tab (Overview metrics + history table). */
export interface CustomerTransaction {
    id: string;
    customerId: string;
    branchId: string;
    kind: "membership" | "package" | "cancellation_penalty" | "freeze_fee" | "retail" | "gift_card" | "private" | "recovery";
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
    // ── Reports v30 ledger fields (all optional — see _types.ts for
    //     the full refund/void model documentation) ──
    transactionType?: "sale" | "refund" | "void" | "write_off";
    originalTransactionId?: string;
    settlementISO?: string;
    refundReason?: string;
    taxTreatment?: "standard" | "zero_rated" | "exempt" | "out_of_scope";
    staffId?: string;
    cardType?: "visa" | "mastercard" | "amex";
    paymentType?: "one_off" | "recurring";
    failureReason?: string;
    retryAttempt?: number;
    recovered?: boolean;
    recoveredISO?: string;
    payoutId?: string;
    processorFee?: number;
    // ── Reports v33 fields (Discounts + Promo Redemptions) ──────────────
    discountCode?: string;
    discountValue?: number;
    // ── Cancellation-penalty flow (Jul 2026) ────────────────────────────
    /** Refundability guard. Undefined = refundable (legacy default);
     *  explicit `false` = the Refund action is hidden on Payment
     *  history and `refundTransaction` rejects the call. Always
     *  `false` on `kind: "cancellation_penalty"` rows. */
    isRefundable?: boolean;
    /** For `kind: "cancellation_penalty"` rows only — which scenario
     *  triggered the fee. Drives display copy on Payment history. */
    cancellationScenario?: "late_cancel" | "no_show";
    // ── Refund-request approval queue (dashboard Needs-attention, Jul 2026) ──
    /** Set when a member has requested a refund on this (still `complete`)
     *  transaction and it's awaiting an admin decision. A transaction is
     *  "awaiting decision" when this is set AND `status === "complete"`.
     *  Approve → `refundTransaction` flips status to "refunded" (drops from
     *  the queue). Deny → this field is cleared (stays complete, drops from
     *  the queue). Additive, so no existing status-switch consumer changes. */
    refundRequestedAtISO?: string;
    /** Member's stated reason for the refund request — shown in the
     *  Refund-requests modal. */
    refundRequestReason?: string;
    /** Account-credit AED applied to this sale via the checkout toggle
     *  (client Jul 2026 — the wallet is no longer a standalone payment
     *  method). Remembered on the transaction so refund flows can restore
     *  the credit to the customer's wallet. Absent / 0 = no credit was
     *  used and refunds don't touch the wallet. */
    accountCreditAppliedAed?: number;
    /** Gift-card AED applied to this sale, broken down per card (client
     *  2026-07-31). Stored as a list rather than a single number because
     *  a sale can spend across MULTIPLE cards (partial redemption walks
     *  oldest-expiry first), and a refund has to put each amount back on
     *  the card it came from. Absent / empty = no gift card was used and
     *  refunds don't touch any card balance. */
    giftCardDebits?: { cardId: string; amountAed: number }[];
    // ── Retail line-item snapshot (Phase A groundwork, 2026-07-29) ──────
    // Populated for the retail line items at sale time so past receipts
    // render exactly as sold even after product edits / archives (client
    // Q9 answer). Only `kind: "membership" | "package" | ...` today; the
    // retail kind lands with Phase D's POS integration.
    /** Retail product id at sale time. Enables Retail Sales report's
     *  category resolution (sku → current category, snapshot fallback). */
    retailProductId?: string;
    productSnapshotName?: string;
    productSnapshotSku?: string;
    productSnapshotPriceAed?: number;
    productSnapshotUnitCostAed?: number;
    /** Sale quantity (units on this line). Retail AND package lines can be
     *  qty > 1; `amountAed` is the LINE total (`unitPrice × quantity`) and a
     *  package credits `pkg.credits × quantity`, so revenue recognition divides
     *  by `credits × quantity`. Memberships are always qty 1. Undefined on
     *  legacy / seed rows → treat as 1. */
    quantity?: number;
    /** Branch the sale rang up at — needed for Retail Sales report's
     *  branch filter + Stock on Hand's per-branch drilldown. */
    branchIdAtSale?: string;
    /** Size variant sold, for a sized retail product. Lets a refund restore
     *  the exact (branch × size) stock row. Undefined for sizeless products. */
    retailSize?: RetailSize;
    // ── Gift-card SALE link (client Aug 2026) ──────────────────────────────
    /** On a `kind: "gift_card"` SALE row, the id of the issued card this sale
     *  created. Lets a refund find the card, check it's unused, and void it.
     *  (Distinct from `giftCardDebits`, which records SPENDING a card on some
     *  other sale.) */
    issuedGiftCardId?: string;
    /** On a `kind: "private" | "recovery"` SESSION sale row, the id of the
     *  appointment this sale booked. Lets a refund cancel that customer's
     *  booking so a refunded session doesn't stay live on the schedule. */
    appointmentId?: string;
}

// ─── Inventory / Retail — Phase A store shape (2026-07-29) ──────────────────
// Camelcase mirror of the snake_case seed types in `_types.ts`. Additive —
// four new slices on AppState; no existing type is reshaped.

/** Broad grouping for retail products. Renaming a category cascades to POS
 *  filter chips + report grouping labels via the same "label-lookup by id"
 *  pattern the follow-up stages use. */
export interface RetailCategory {
    id: string;
    label: string;
    imageUrl?: string;
    status: "active" | "inactive";
    createdAt: string;
}

/** Apparel size variant — a FREE-FORM admin-defined label ("Small", "Medium",
 *  "One size", "38", …), not a fixed set. A product with `sizes` is sold +
 *  stocked per size; a product with no sizes is a single sizeless SKU (size
 *  stays undefined on its stock / adjustment / transaction rows). */
export type RetailSize = string;
/** Optional quick-add labels the product form offers — the admin can type any
 *  custom size instead. Not an allow-list; purely a convenience. */
export const RETAIL_SIZE_SUGGESTIONS: string[] = ["Small", "Medium", "Large", "X-Large", "One size"];

/** Studio-global retail product. Stock is per-branch — and, for products with
 *  `sizes`, per (branch × size) — in `RetailStock`, not on this record. */
export interface RetailProduct {
    id: string;
    name: string;
    sku: string;
    categoryId: string;
    description?: string;
    priceAed: number;
    unitCostAed: number;
    reorderThreshold: number;
    imageUrl?: string;
    /** Size variants offered (S/M/L). Empty / undefined = a sizeless product;
     *  price is shared across sizes, only stock differs per size. */
    sizes?: RetailSize[];
    status: "active" | "inactive" | "archived";
    createdAt: string;
    updatedAt?: string;
}

/** One row per (product × branch × size). `size` is undefined for sizeless
 *  products. `unitsOnHand` decrements on POS sale, increments on receive /
 *  refund. Every mutation writes a matching `RetailStockAdjustment`. */
export interface RetailStock {
    id: string;
    productId: string;
    branchId: string;
    /** Size variant this row counts; undefined for sizeless products. */
    size?: RetailSize;
    unitsOnHand: number;
    lastAdjustedAt?: string;
    lastReceivedAt?: string;
}

/** Audit log — every stock delta writes a row. The Stock on Hand report
 *  computes Units received / Sell-through % / Stock turnover × from this
 *  slice + a period window. */
export interface RetailStockAdjustment {
    id: string;
    productId: string;
    branchId: string;
    /** Size variant this delta applied to; undefined for sizeless products. */
    size?: RetailSize;
    delta: number;
    kind: "sale" | "receive" | "adjust" | "loss" | "refund";
    reason?: string;
    sourceTransactionId?: string;
    createdBy: string;
    createdAt: string;
}

/** Reason picker options for the future Configure-stock modal. Kept as a
 *  const-union so consumers can share the same list without duplicating
 *  strings. Phase A defines it; Phase B wires it into the modal. */
export const RETAIL_ADJUST_REASONS = [
    "Received shipment",
    "Manual adjustment",
    "Lost",
    "Damaged",
    "Reconciliation",
] as const;
export type RetailAdjustReason = typeof RETAIL_ADJUST_REASONS[number];

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
    /** "warning" (Figma 7739:175065) is the amber tone used for
     *  soft-block guidance ("this action is critical, keep at least one
     *  channel on"). Distinct from "error" which is a hard failure. */
    type: "success" | "error" | "warning";
    icon?: "check" | "trash" | "archive" | "slash" | "refresh" | "alert" | "bell";
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
        | "pay_rate" | "payroll" | "rating" | "account"
        | "service"        // Services module — appointment templates (Phase 1+)
        | "appointment"    // Services module — concrete appointments (Phase 4)
        | "shift"          // Staff & shift module — shifts CRUD
        | "blocked_time"   // Staff & shift module — blocked time CRUD
        | "retail_product" // Inventory / Retail Phase A — product CRUD + status flips
        | "retail_category"; // Inventory / Retail Phase A — category CRUD
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
    productType: "membership" | "package" | "gift_card" | "retail" | "private" | "recovery";
    name: string;
    unitPrice: number;
    quantity: number;
    /** Private / Recovery session line (2026-08-04). Carries the booked slot so
     *  the checkout commit (`applyPurchase`) can create the real appointment
     *  (via `addCustomerAppointment`) alongside the revenue transaction. The
     *  instructor is already resolved (a "Flexible" pick is assigned a concrete
     *  free instructor at pick time); `null` only for open/capacity sessions. */
    appointment?: {
        dateISO: string;
        startTime: string;
        durationMin: number;
        instructorId: string | null;
        instructorName?: string;
        flexible: boolean;
        openSession: boolean;
    };
    /** Chosen size variant for a sized retail line (free-form label). Decides
     *  which (branch × size) stock row decrements. Undefined for sizeless
     *  products + all non-retail lines. */
    size?: RetailSize;
    /** Optional metadata for gift-card line items (recipient + message). */
    giftCard?: {
        recipientName: string;
        recipientEmail?: string;
        senderName: string;
        message?: string;
    };
    /** Product photo — only set for `productType: "retail"` today, so the
     *  checkout screen's "Detail product" row can render the real image
     *  instead of a category icon. Non-retail lines leave this undefined
     *  and fall back to their category-tinted icon. */
    imageUrl?: string;
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
    /** v83 audit-1 (2026-07-29) — POS-selected sale branch, threaded through
     *  the checkout flow to applyPurchase. Falsy = no override (buyer's home
     *  branch is used). Only retail line items honour this; membership /
     *  package / gift-card flows are branch-agnostic in the current model. */
    saleBranchId?: string;
}

// ─── SCHEDULE_INSTRUCTORS — the ONE schedulable-instructor pool ─────────────
//
// Phase 1 unification (2026-08-05). Historically this pool was built from
// `staff_profiles` (display only — no categories), the CAN-TEACH gate read
// `staff.ts` (`staffById`), and the denormalized list name fell back to
// `instructors.ts`. Three sources, never reconciled → a class could show a
// valid instructor in the list yet grey/blank them on edit. Now ALL of it
// derives from the canonical `staff.ts` table, so display / select / eligibility
// agree by construction.
//
// Membership rule ("a schedulable instructor"): role instructor, active,
// teaches ≥1 category, and based at an ACTIVE branch (or all-locations). That
// reproduces exactly the 10 south/east instructors and deliberately excludes
// West (inactive branch — its classes can't be scheduled), the two recovery
// therapists (no class category), and pending invites — none of which should
// clutter the schedule pickers or list filters.

const ACTIVE_BRANCH_IDS: Set<string> = new Set(
    SEED_BRANCHES.filter(b => b.status === "active").map(b => b.id),
);

/** True when a staff SEED row belongs in the schedulable-instructor pool. */
function isSchedulableStaffSeed(s: (typeof SEED_STAFF)[number]): boolean {
    return s.role_id === "role_instructor"
        && s.status === "active"
        && (s.category_ids?.length ?? 0) > 0
        && (s.branch_id === null || ACTIVE_BRANCH_IDS.has(s.branch_id));
}

export const SCHEDULE_INSTRUCTORS: ScheduleInstructor[] = SEED_STAFF
    .filter(isSchedulableStaffSeed)
    .map(s => ({
        id: s.id,
        name: s.full_name,
        initials: s.initials,
        color: s.color_hex,
        imageUrl: s.image_url,
        branchId: s.branch_id,
        categoryIds: s.category_ids ?? [],
        shiftId: s.shift_id ?? null,
        active: s.status === "active",
    }));

/** Live equivalent of SCHEDULE_INSTRUCTORS, derived from the runtime `staff`
 *  slice so instructor edits made during a demo (rename, re-category, branch
 *  move, deactivate) reflect in the schedule pickers instead of silently
 *  drifting from the frozen seed pool. Same membership rule as the seed pool
 *  above, evaluated against the live branches for active-branch scope. Wired
 *  into the create/edit form in Phase 5. */
export function deriveScheduleInstructors(
    staff: Staff[],
    activeBranchIds: Set<string>,
): ScheduleInstructor[] {
    return staff
        .filter(s =>
            s.roleId === "role_instructor"
            && s.status === "active"
            && (s.categoryIds?.length ?? 0) > 0
            && (s.branchId === null || activeBranchIds.has(s.branchId)),
        )
        .map(s => ({
            id: s.id,
            name: s.fullName,
            initials: s.initials,
            color: s.color,
            imageUrl: s.imageUrl,
            branchId: s.branchId,
            categoryIds: s.categoryIds ?? [],
            shiftId: s.shiftId ?? null,
            active: s.status === "active",
        }));
}

// ─── Adapters (snake_case seed → camelCase store shape) ─────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

/** v83 audit-1 (2026-07-29) — human-readable descriptor for the customer
 *  patch shape `updateCustomer` receives, used by the audit-log entry.
 *  Recognises the well-known fields the profile / Follow-up settings
 *  panel edit; anything else collapses to the generic label. */
function describeCustomerPatch(patch: Record<string, unknown>): string {
    const keys = Object.keys(patch);
    if (keys.length === 0) return "Edited customer profile";
    if (keys.length === 1) {
        switch (keys[0]) {
            // v83 audit-2 (2026-07-29) — distinguish "unassign" (patch
            // value is undefined / empty string) from "reassign" so the
            // audit trail reads honestly.
            case "assignedTo":      return patch.assignedTo ? "Reassigned customer" : "Unassigned customer";
            case "followUpStatus":  return "Updated follow-up status";
            case "sourceId":
            case "marketingSource": return "Updated customer source";
            case "isVip":           return (patch.isVip ? "Marked customer VIP" : "Removed VIP");
            case "notes":           return "Updated customer notes";
            case "assignedBranchIds":
            case "branchId":        return "Updated customer branch access";
            case "planKind":
            case "planName":        return "Updated customer plan";
        }
    }
    return "Edited customer profile";
}

function dateLabelFromISO(iso: string): string {
    const d = new Date(iso + "T00:00:00Z");
    return `${WEEKDAYS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function dayOfWeekFromISO(iso: string): string {
    const d = new Date(iso + "T00:00:00Z");
    return WEEKDAYS[d.getUTCDay()];
}

/** "20 Jul" for a freeze notification body — short, human-facing.
 *  Kept close to the other date helpers so future callers land here. */
function freezeDayLabel(iso: string): string {
    if (!iso) return "";
    const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) return iso;
    return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
}

// ── Freeze policy v2 Phase 5 — Option A/B billing math ─────────────────────
//
// Pure helper: given a plan, a freeze window, and the studio's billing
// behavior, return the resulting next-charge date + adjustment amount.
// Called from `freezeCustomerPlan` when writing the plan row + from
// `approveFreezeRequest` when the admin greenlights a pending request.
// Mirrors `previewFreezeBilling` in `@/lib/customer/freeze-eligibility` —
// kept in this file to avoid a circular import (eligibility imports the
// store, not the other way around).

/** Days per billing cycle for prorate math. 30 matches the client's
 *  worked-example screenshots (Jul 1 → Aug 1 → Sep 1 monthly billing). */
const BILLING_CYCLE_DAYS = 30;

interface FreezeChargePreview {
    frozenDays: number;
    /** New next-charge ISO day (YYYY-MM-DD). Option A: original + frozenDays.
     *  Option B: original (unchanged — the charge stays on schedule). */
    newNextChargeISO: string;
    /** Original next-charge ISO day — the day before the current expiry. */
    originalNextChargeISO: string;
    /** Prorate credit (AED) for Option B; undefined for Option A. */
    savingsAed?: number;
}

// Reason-exception resolver (mirror of the one in freeze-eligibility.ts —
// duplicated to avoid a circular import since eligibility already imports
// from store.ts). Callers pass a reason LABEL; we look it up in the
// policy's enabled reasons and return the three bypass flags. Returns
// all-false when the label matches nothing so `if (bypass.waivesFee)`
// reads cleanly. Keep the shape in sync with the customer-side copy.
interface StoreReasonBypass {
    ignoresMaxDuration: boolean;
    ignoresFreezeLimit: boolean;
    waivesFee: boolean;
}
function resolveReasonExceptions(
    policy: FreezePolicy,
    reasonLabel: string | undefined | null,
): StoreReasonBypass {
    const noBypass: StoreReasonBypass = { ignoresMaxDuration: false, ignoresFreezeLimit: false, waivesFee: false };
    if (!reasonLabel) return noBypass;
    const match = policy.reasons.find(
        r => r.enabled && r.label.trim() === reasonLabel.trim(),
    );
    if (!match || !match.exceptions) return noBypass;
    return {
        ignoresMaxDuration: match.exceptions.ignoresMaxDuration === true,
        ignoresFreezeLimit: match.exceptions.ignoresFreezeLimit === true,
        waivesFee:          match.exceptions.waivesFee === true,
    };
}

function computeNextCharge(
    plan: CustomerPlan,
    policy: FreezePolicy,
    startISO: string,
    endISO: string,
): FreezeChargePreview {
    const startMs = Date.parse(`${startISO.slice(0, 10)}T00:00:00Z`);
    const endMs = Date.parse(`${endISO.slice(0, 10)}T00:00:00Z`);
    const frozenDays = Math.max(0, Math.round((endMs - startMs) / 86_400_000));
    // Convention shared with PlanCard: next-charge = expiry - 1 day.
    const expiryDay = plan.expiryISO.slice(0, 10);
    const originalNextChargeMs = Date.parse(`${expiryDay}T00:00:00Z`) - 86_400_000;
    const originalNextChargeISO = new Date(originalNextChargeMs).toISOString().slice(0, 10);
    if (policy.billing_behavior === "pause") {
        const newMs = originalNextChargeMs + frozenDays * 86_400_000;
        return {
            frozenDays,
            newNextChargeISO: new Date(newMs).toISOString().slice(0, 10),
            originalNextChargeISO,
        };
    }
    // Option B — stay on schedule, prorate down.
    const price = plan.priceAed;
    if (price === undefined || price <= 0) {
        return { frozenDays, newNextChargeISO: originalNextChargeISO, originalNextChargeISO };
    }
    const savingsRaw = Math.round((frozenDays / BILLING_CYCLE_DAYS) * price);
    const savings = Math.min(price, Math.max(0, savingsRaw));
    return {
        frozenDays,
        newNextChargeISO: originalNextChargeISO,
        originalNextChargeISO,
        savingsAed: savings,
    };
}

function templateFromSeed(t: SeedClassTemplate): ClassTemplate {
    const cat = SEED_CLASS_CATEGORIES.find(c => c.id === t.category_id);
    return {
        id: t.id,
        type: "class",
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

function serviceFromSeed(s: SeedService): Service {
    const cat    = SEED_CLASS_CATEGORIES.find(c => c.id === s.category_id);
    const branch = SEED_BRANCHES.find(b => b.id === s.branch_id);
    return {
        id: s.id,
        name: s.name,
        description: s.description,
        categoryId: s.category_id,
        category: cat?.name ?? "",
        type: s.type,
        openSession: s.open_session,
        durationMin: s.duration_min,
        capacity: s.capacity,
        price: s.price,
        branchId: s.branch_id,
        branchName: branch?.name ?? "",
        // Optional default room ("" = no room).
        roomId: s.room_id ?? "",
        status: s.status,
        coverImage: s.cover_image_url,
        coverColor: cat?.color_hex ?? "#f1f2ed",
    };
}

function appointmentFromSeed(a: SeedAppointment, services: Service[]): Appointment {
    const service = services.find(s => s.id === a.service_id);
    const branch  = SEED_BRANCHES.find(b => b.id === a.branch_id);
    const room    = SEED_ROOMS.find(r => r.id === a.room_id);
    const inst    = a.instructor_id ? SEED_STAFF_PROFILES.find(p => p.id === a.instructor_id) : undefined;
    return {
        id: a.id,
        serviceId: a.service_id,
        // Inherit the session type from the parent service. Falls back to
        // "private" only if the service can't be resolved (shouldn't happen).
        type: service?.type ?? "private",
        serviceName: service?.name ?? "",
        serviceCategory: service?.category ?? "",
        coverColor: service?.coverColor ?? "#f1f2ed",
        coverImage: service?.coverImage,
        branchId: a.branch_id,
        branchName: branch?.name ?? "",
        // Spa-branch appointments seed with no `room_id` (optional in
        // SeedAppointment) — coerce to "" so the camelCase shape stays
        // string-typed without forcing every renderer to handle null.
        roomId: a.room_id ?? "",
        roomName: room?.name ?? "",
        ...(inst ? {
            instructorId: a.instructor_id,
            instructorName: inst.full_name,
            instructorInitials: inst.initials,
            instructorColor: inst.color_hex,
            instructorImageUrl: inst.image_url,
        } : {}),
        openSession: service?.openSession ?? false,
        dateISO: a.date_iso,
        date: dateLabelFromISO(a.date_iso),
        startTime: a.start_time,
        endTime: a.end_time,
        // Same canonical 12-hour range as class schedules — derive from the raw
        // times rather than trusting the seed string. client 2026-07-31.
        displayTime: formatTimeRange12(a.start_time, a.end_time),
        capacity: a.capacity,
        booked: a.booked,
        status: a.status,
        cancelledReason: a.cancelled_reason,
        cancelledAt: a.cancelled_at,
        cancelledBy: a.cancelled_by,
        rating: a.rating ?? 0,
        ratingCount: a.rating_count ?? 0,
        createdAt: a.created_at,
    };
}

function appointmentRatingFromSeed(r: SeedAppointmentRating): AppointmentRating {
    const customer = SEED_CUSTOMERS.find(c => c.id === r.customer_id);
    const fullName = customer ? `${customer.first_name} ${customer.last_name}`.trim() : "";
    const inst = r.instructor_id ? SEED_STAFF_PROFILES.find(p => p.id === r.instructor_id) : undefined;
    return {
        id: r.id,
        appointmentId: r.appointment_id,
        customerId: r.customer_id,
        customerName: fullName,
        customerInitials: customer?.initials ?? "?",
        customerImageUrl: customer?.image_url,
        instructorId: r.instructor_id,
        instructorName: inst?.full_name,
        score: r.score,
        comment: r.comment,
        tags: r.tags,
        submittedAt: r.submitted_at,
        deletedAt: r.deleted_at,
        deletedBy: r.deleted_by,
    };
}

function appointmentBookingFromSeed(b: SeedAppointmentBooking): AppointmentBooking {
    const customer = SEED_CUSTOMERS.find(c => c.id === b.customer_id);
    const fullName = customer ? `${customer.first_name} ${customer.last_name}`.trim() : "";
    return {
        id: b.id,
        appointmentId: b.appointment_id,
        customerId: b.customer_id,
        customerName: fullName,
        customerInitials: customer?.initials ?? "?",
        // Customer seed doesn't carry a per-row tint — use a neutral pool
        // deterministically per id so avatars stay stable across renders.
        customerColor: "#e0e0e0",
        customerImageUrl: customer?.image_url,
        status: b.status,
        bookedAt: b.booked_at,
        cancelledAt: b.cancelled_at,
        cancelledBy: b.cancelled_by,
        attendanceMarkedAt: b.attendance_marked_at,
    };
}

/** Live lifecycle status derived from the DEVICE clock.
 *
 *  Demo rows carry a status baked at seed time, which goes stale the moment the
 *  prototype runs past that date — a 19 May class was still reporting
 *  "Upcoming" on 20 July, so it sat in the customer's Upcoming bookings. Both
 *  the admin and the customer read status through here, so they can never
 *  disagree about what is Upcoming. "Cancelled" is an explicit action and
 *  always wins over the clock. */
export function liveScheduleStatus<T extends string>(dateISO: string, startTime: string, endTime: string, current: T): T {
    if (current === "Cancelled") return current;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (dateISO > today) return "Upcoming" as T;
    if (dateISO < today) return "Completed" as T;
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (hhmm < startTime) return "Upcoming" as T;
    if (endTime && hhmm < endTime) return "Ongoing" as T;
    return "Completed" as T;
}

function scheduleFromSeed(s: SeedClassSchedule, templates: ClassTemplate[]): ClassSchedule {
    const tpl = templates.find(t => t.id === s.template_id);
    // Resolve the instructor's denormalized name/initials/colour from the
    // canonical staff.ts table FIRST (Phase 1 unification 2026-08-05) so the
    // list/grid/detail name always matches the pool the edit form selects from.
    // Falls back to staff_profiles / the instructors directory only if an id
    // somehow isn't in staff.ts, so nothing ever renders as a blank grey chip.
    const inst =
        SEED_STAFF.find(p => p.id === s.instructor_id) ??
        SEED_STAFF_PROFILES.find(p => p.id === s.instructor_id) ??
        SEED_INSTRUCTORS.find(p => p.id === s.instructor_id);
    const branch = SEED_BRANCHES.find(b => b.id === s.branch_id);
    const room = SEED_ROOMS.find(r => r.id === s.room_id);
    // Demo: enable spot selection for MOST scheduled classes so the pick-a-spot
    // flow is fully testable on both admin + customer (client 2026-07-28). Any
    // Group class gets it; 1-on-1 Private classes don't use spots. An explicit
    // seed value (`spot_selection_enabled`) always wins.
    const wantsSpots = s.spot_selection_enabled ?? (s.class_type ?? "Group") !== "Private";
    return {
        id: s.id,
        templateId: s.template_id,
        type: "class",
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
        // Re-derive the display string from the raw 24h times so every schedule
        // (seed, demo, imported) renders in ONE canonical 12-hour format —
        // ignores whatever the seed's `display_time` happened to be (padded or
        // 24-hour). client 2026-07-31.
        displayTime: formatTimeRange12(s.start_time, s.end_time),
        booked: s.booked,
        capacity: s.capacity,
        classType: s.class_type ?? "Group",
        equipment: s.equipment ?? "",
        spotSelectionEnabled: wantsSpots,
        // Admin config wins. Otherwise auto-generate the most BALANCED grid for
        // this capacity (10 → 5×2, 15 → 5×3, 11 → 4×3) — the SAME grid both
        // admin and customer read from the store, so the two sides can never
        // show a different room. Blocked spots stay empty until the studio
        // customises.
        spotLayout: s.spot_layout
            ? { cols: s.spot_layout.cols, rows: s.spot_layout.rows, blockedSpots: s.spot_layout.blocked_spots }
            : wantsSpots
              ? { ...balancedSpotGrid(s.capacity), blockedSpots: [] }
              : undefined,
        waitlistEnabled: s.waitlist_enabled ?? true,
        rating: s.rating,
        ratingCount: s.rating_count,
        status: liveScheduleStatus(s.date_iso, s.start_time, s.end_time, s.status),
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

// Reports v33 — deterministic derivation of first_visit / marketing_source
// / converted_from from customer id + existing seed fields. Runs at
// customerFromSeed() so every customer picks up the fields without
// editing 1500+ seed rows. Same inputs → same outputs, so persist doesn't
// churn.
const MARKETING_SOURCES = ["Instagram", "Google", "Website", "Referral", "Walk-in", "WhatsApp"] as const;
function hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
}
function deriveMarketingSource(customerId: string): string {
    return MARKETING_SOURCES[hashString(customerId) % MARKETING_SOURCES.length];
}
function deriveConvertedFrom(customerId: string, planKind: "membership" | "package" | null): "first-visit" | "intro-offer" | "trial-class" | "referral" {
    if (!planKind) return "trial-class";
    const options = ["first-visit", "intro-offer", "trial-class", "referral"] as const;
    return options[hashString(customerId + "conv") % options.length];
}
function deriveFirstVisitISO(createdAt: string, lastVisitISO?: string): string | undefined {
    // Prefer 3 days after creation as "first visit" — realistic for a
    // studio (customer creates account → attends first class within days).
    if (!createdAt) return lastVisitISO;
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return lastVisitISO;
    d.setDate(d.getDate() + 3);
    const iso = d.toISOString().slice(0, 10);
    // Clamp: first_visit can't be after last_visit.
    if (lastVisitISO && iso > lastVisitISO) return lastVisitISO;
    return iso;
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
        marketingChannelEmail:              c.marketing_channel_email,
        marketingChannelWhatsapp:           c.marketing_channel_whatsapp,
        marketingChannelSms:                c.marketing_channel_sms,
        marketingChannelPush:               c.marketing_channel_push,
        marketingTopicStudioAnnouncements:  c.marketing_topic_studio_announcements,
        marketingTopicNewClassLaunch:       c.marketing_topic_new_class_launch,
        marketingTopicSpecialOffers:        c.marketing_topic_special_offers,
        marketingTopicPromoCodeOffers:      c.marketing_topic_promo_code_offers,
        emergencyContactName: c.emergency_contact_name,
        emergencyContactPhone: c.emergency_contact_phone,
        emergencyContactRelation: c.emergency_contact_relation,
        referralCode: c.referral_code,
        // Reports v33 — derived if seed doesn't declare explicitly.
        firstVisitISO: c.first_visit_iso ?? deriveFirstVisitISO(c.created_at, c.last_visit_iso),
        marketingSource: c.marketing_source ?? deriveMarketingSource(c.id),
        convertedFrom: c.converted_from ?? deriveConvertedFrom(c.id, c.plan_kind),
    };
}

// Reports v33 — deterministic derivation for referral rows so the Referral
// Report + Win-back columns render with realistic values without editing
// the seed.
const WINBACK_CAMPAIGNS = ["Spring Come-Back", "Summer Free Week", "New Year Restart", "Loyalty Reactivate"] as const;
function derivedReferralCampaign(id: string): string {
    return WINBACK_CAMPAIGNS[hashString(id) % WINBACK_CAMPAIGNS.length];
}

function customerReferralFromSeed(r: SeedCustomerReferral): CustomerReferral {
    const referredAt = r.referred_at;
    // 60% of referrals reactivate — deterministic on id hash.
    const reactivated = r.reactivated ?? (hashString(r.id + "react") % 10 < 6);
    // Reactivation date = referred_at + 3-14 days.
    let reactivationDateISO: string | undefined = r.reactivation_date;
    if (!reactivationDateISO && reactivated && referredAt) {
        const d = new Date(referredAt);
        d.setDate(d.getDate() + 3 + (hashString(r.id) % 12));
        reactivationDateISO = d.toISOString().slice(0, 10);
    }
    // New plan id = one of the seeded plans (Beginner / Advanced / 10-Class).
    const planPool = ["mem_beginner_monthly", "mem_advanced_monthly", "pkg_10_class_month"];
    const newPlanId = r.new_plan_id ?? (reactivated ? planPool[hashString(r.id + "plan") % planPool.length] : undefined);
    // Revenue recovered based on new_plan_id pricing.
    const planPrice: Record<string, number> = {
        mem_beginner_monthly: 1200,
        mem_advanced_monthly: 1500,
        pkg_10_class_month:   1390,
    };
    const revenueRecoveredAed = r.revenue_recovered_aed ?? (reactivated && newPlanId ? planPrice[newPlanId] : undefined);

    // v56 — Reward-kind stamp. Pre-v56 seed rows carry only `benefit_credits`
    // and are implicitly class credits; treat them that way so historical
    // rows aggregate correctly into the "Class credits" line of the new
    // "Rewards earned" card. New rows should set `benefit_type` +
    // `benefit_amount` explicitly at creation.
    const benefitType: ReferralRewardType = r.benefit_type ?? "free_credits";
    const benefitAmount = r.benefit_amount ?? r.benefit_credits;

    return {
        id: r.id,
        referrerCustomerId: r.referrer_customer_id,
        referredName: r.referred_name,
        referredEmail: r.referred_email,
        benefitCredits: r.benefit_credits,
        benefitType,
        benefitAmount,
        referredAtISO: r.referred_at,
        expiresAtISO:   r.expires_at,
        originBranchId: r.origin_branch_id,
        // Client 2026-07-31 — every SEEDED referral is a historical record
        // whose reward already counted toward the Rewards-earned card, so
        // it's marked issued at boot. Without this the new auto-issuance
        // engine would re-pay every seeded referral the first time its
        // friend made a purchase.
        rewardIssuedAtISO: r.referred_at,
        // Reports v33 derivations
        campaign: r.campaign ?? derivedReferralCampaign(r.id),
        reactivated,
        reactivationDateISO,
        newPlanId,
        revenueRecoveredAed,
    };
}

function walletTransactionFromSeed(w: WalletTransactionSeed): WalletTransaction {
    return {
        id: w.id,
        customerId: w.customer_id,
        branchId: w.branch_id,
        type: w.type,
        amountAed: w.amount_aed,
        reason: w.reason,
        referenceType: w.reference_type,
        referenceId: w.reference_id,
        createdAtISO: w.created_at,
        createdBy: w.created_by,
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

// Reports v33 — derive Memberships & Packages report fields from the
// existing seed. Parses total credits from `credits_label`, assigns
// used-count via id hash (0-90% used), sets auto_renew per kind.
function parseCredits(creditsLabel: string): number {
    if (!creditsLabel) return 0;
    if (/unlimited/i.test(creditsLabel)) return 0;
    const m = /(\d+)/.exec(creditsLabel);
    return m ? Number(m[1]) : 0;
}

function customerPlanFromSeed(p: SeedCustomerPlan): CustomerPlan {
    // Derive Reports v33 fields.
    const totalCredits = p.total_credits ?? parseCredits(p.credits_label);
    // Deterministic used-count between 0 and totalCredits × 0.9.
    const usedRatio = (hashString(p.id) % 91) / 100; // 0-0.90
    const derivedUsed = totalCredits > 0 ? Math.floor(totalCredits * usedRatio) : 0;
    const creditsUsed = p.credits_used ?? derivedUsed;
    const autoRenew = p.auto_renew ?? (p.kind === "membership" && p.status === "active");
    const nextBilling = p.next_billing_amount_aed ?? (autoRenew && p.status === "active" ? (p.price_aed ?? 0) : 0);
    const allowance = p.allowance ?? (
        p.kind === "membership" && /unlimited/i.test(p.credits_label) ? "Unlimited"
        : totalCredits > 0 ? `${totalCredits} credits`
        : p.credits_label || "—"
    );

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
        // Reports v33 derivations
        totalCredits,
        creditsUsed,
        autoRenew,
        nextBillingAmountAed: nextBilling,
        allowance,
    };
}

/** Recompute the denormalized "current plan" fields on a `Customer` row
 *  (`planKind`, `planName`, `membershipId`, `packageIds`, `planExpiryISO`)
 *  from the authoritative `customerPlans[]` array. Used by every store
 *  action that changes plan status (cancel / reactivate / freeze) so
 *  the flat fields stay in lock-step with the plan list — otherwise
 *  Customer badges, Reports v33, and the customer-portal Plan page all
 *  read stale data. Complimentary plans are exempt (free credits, not
 *  the customer's active plan).
 *
 *  Preserves `creditsRemaining` — that's clamped by the caller
 *  (`cancelCustomerPlan`) which has the credits math already.
 *
 *  Client Jul 2026: a customer holds either ONE active membership OR
 *  one+ active packages, never both — this helper is the single point
 *  the invariant is projected onto the flat fields. */
function derivedFlatPlanFields(
    plans: CustomerPlan[],
    customerId: string,
): Pick<Customer, "planKind" | "planName" | "membershipId" | "packageIds" | "planExpiryISO"> {
    // freeze_requested plans still count as held — until the admin acts,
    // the customer's live plan is the same one, just waiting for a
    // decision. Same treatment across every "held plan" check below.
    const heldMemberships = plans.filter(p =>
        p.customerId === customerId
        && p.kind === "membership"
        && (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested"));
    const heldPackages = plans.filter(p =>
        p.customerId === customerId
        && p.kind === "package"
        && (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested"));
    // Membership wins over package if both are present — matches
    // `applyPurchase`'s cascade-cancel bias and reads correctly on the
    // rare interim state before the cascade has run.
    if (heldMemberships.length > 0) {
        const m = heldMemberships[0];
        return {
            planKind: "membership",
            planName: m.name,
            membershipId: m.productId,
            packageIds: undefined,
            planExpiryISO: m.expiryISO,
        };
    }
    if (heldPackages.length > 0) {
        // Latest expiry drives `planExpiryISO`; every held package id
        // is aggregated into `packageIds`.
        const sorted = [...heldPackages].sort((a, b) =>
            (b.expiryISO ?? "").localeCompare(a.expiryISO ?? ""));
        return {
            planKind: "package",
            planName: sorted.length === 1
                ? sorted[0].name
                : `${sorted.length} packages`,
            membershipId: undefined,
            packageIds: sorted.map(p => p.productId).filter((id): id is string => typeof id === "string"),
            planExpiryISO: sorted[0].expiryISO,
        };
    }
    return {
        planKind: null,
        planName: undefined,
        membershipId: undefined,
        packageIds: undefined,
        planExpiryISO: undefined,
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
        // ── Reports v30 ledger fields ───────────────────────────────
        transactionType:       t.transaction_type,
        originalTransactionId: t.original_transaction_id,
        settlementISO:         t.settlement_iso,
        refundReason:          t.refund_reason,
        taxTreatment:          t.tax_treatment,
        staffId:               t.staff_id,
        cardType:              t.card_type,
        paymentType:           t.payment_type,
        failureReason:         t.failure_reason,
        retryAttempt:          t.retry_attempt,
        recovered:             t.recovered,
        recoveredISO:          t.recovered_iso,
        payoutId:              t.payout_id,
        processorFee:          t.processor_fee,
        // Reports v33 — Discounts + Promo Redemptions. Real promo data is
        // authored on the seed sale rows (discount_code / discount_value);
        // no synthetic derivation, so the reports + each promo's usage count
        // reflect actual redemptions only.
        discountCode:          t.discount_code,
        discountValue:         t.discount_value,
        // ── Cancellation-penalty flow (Jul 2026) ────────────────────
        isRefundable:          t.is_refundable,
        cancellationScenario:  t.cancellation_scenario,
        // ── Refund-request approval queue (Jul 2026) ────────────────
        refundRequestedAtISO:  t.refund_requested_at,
        refundRequestReason:   t.refund_request_reason,
        // ── Retail line-item snapshot (Phase D, 2026-07-30) ─────────
        retailProductId:              t.retail_product_id,
        productSnapshotName:          t.product_snapshot_name,
        productSnapshotSku:           t.product_snapshot_sku,
        productSnapshotPriceAed:      t.product_snapshot_price_aed,
        productSnapshotUnitCostAed:   t.product_snapshot_unit_cost_aed,
        quantity:                     t.quantity,
        branchIdAtSale:               t.branch_id_at_sale,
        retailSize:                   t.retail_size,
    };
}

// Reports v33 — one StaffAttendanceLog row per scheduled class. Deterministic
// derivation: non-cancelled → taught (with ~15% getting late-start minutes);
// cancelled → no-show. actual_hours matches scheduled_hours until real
// clock-in/out data lands post-demo.
function deriveStaffAttendanceLog(schedules: ClassSchedule[]): StaffAttendanceLog[] {
    return schedules.map(s => {
        const [sh, sm] = s.startTime.split(":").map(Number);
        const [eh, em] = s.endTime.split(":").map(Number);
        const durationMin = Math.max(0, (eh || 0) * 60 + (em || 0) - ((sh || 0) * 60 + (sm || 0)));
        const scheduled = durationMin / 60;
        const isCancelled = s.status === "Cancelled";
        const cancelledIdHash = hashString(s.id);
        const lateStart = !isCancelled && cancelledIdHash % 7 === 0
            ? 1 + (cancelledIdHash % 10)      // 1-10 min late on ~15% of classes
            : 0;
        return {
            id: `sat_${s.id}`,
            staff_id: s.instructorId,
            class_schedule_id: s.id,
            attendance_status: isCancelled ? "no-show" : "taught",
            covered_by_staff_id: undefined,
            late_start_minutes: lateStart,
            scheduled_hours: scheduled,
            actual_hours: isCancelled ? 0 : scheduled - (lateStart / 60),
        };
    });
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

/** Categorised sales-commission row (camelCase store shape). Lives on any
 *  pay rate — see `PayRateBase.commissions`. */
export interface PayRateCommissionRow {
    id: string;
    category: CommissionCategory;
    valueType: CommissionValueType;
    /** Percentage when valueType === "percent"; AED when "fixed". */
    value: number;
}

/** Categorised threshold-bonus row. */
export interface PayRateBonusRow extends PayRateCommissionRow {
    /** Monthly count in the category that must be crossed for the bonus. */
    threshold: number;
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
    /** Categorised sales commission — available on ANY rate type (client Jul
     *  2026). Replaces the deprecated Monthly-only `salesCommission*Percent`
     *  fields. See new-prd/commission-refactor-implementation-plan.md. */
    commissions?: PayRateCommissionRow[];
    /** Categorised threshold bonuses. */
    bonuses?: PayRateBonusRow[];
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
        commissions: p.commissions?.map(c => ({
            id: c.id, category: c.category, valueType: c.value_type, value: c.value,
        })),
        bonuses: p.bonuses?.map(b => ({
            id: b.id, category: b.category, valueType: b.value_type, value: b.value, threshold: b.threshold,
        })),
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
        shortIntro: s.short_intro,
        workingExperienceYears: s.working_experience_years,
        shiftId: s.shift_id,
        categoryIds: s.category_ids,
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
        commissionPackagesSalesAed:     e.commission_packages_sales_aed,
        commissionMembershipsSalesAed:  e.commission_memberships_sales_aed,
        commissionPackagesPercent:      e.commission_packages_percent,
        commissionMembershipsPercent:   e.commission_memberships_percent,
        commissionAmount:               e.commission_amount,
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

        emailEnabled:    n.email_enabled,
        whatsappEnabled: n.whatsapp_enabled,
        smsEnabled:      n.sms_enabled,

        emailSubject:    n.email_subject,
        emailTemplate:   n.email_template,
        whatsappTemplate: n.whatsapp_template,
        smsTemplate:      n.sms_template,

        whatsappApprovalStatus:   n.whatsapp_approval_status,
        whatsappRejectionReason:  n.whatsapp_rejection_reason,

        isCritical:  n.is_critical,
        sendMode:    n.send_mode,
        sendOffsets: n.send_offsets.map(o => ({ ...o })),

        sentDuringCampaigns: n.sent_during_campaigns,
        recipientSource:     n.recipient_source,
        branchId:            n.branch_id,
    };
}

function notificationDeliverySettingsFromSeed(
    d: NotificationDeliverySettingsSeed,
): NotificationDeliverySettings {
    return {
        id: d.id,
        onlySendDuringSetHours:      d.only_send_during_set_hours,
        quietHoursStart:             d.quiet_hours_start,
        quietHoursEnd:               d.quiet_hours_end,
        criticalBypassesQuietHours:  d.critical_bypasses_quiet_hours,
    };
}

function taxRateFromSeed(t: TaxRateSeed): TaxRate {
    return {
        id: t.id,
        name: t.name,
        ratePercentage: t.rate_percentage,
        kind: t.kind,
        type: t.type,
        description: t.description,
        calculationMode: t.calculation_mode,
        status: t.status,
        createdAt: t.created_at,
        validFromISO:  t.valid_from,
        validUntilISO: t.valid_until,
    };
}

function taxSettingsFromSeed(t: TaxSettingsSeed): TaxSettings {
    return {
        pricesIncludeTax: t.prices_include_tax,
        roundingMode: t.rounding_mode,
        trn: t.trn,
        trnCountry: t.trn_country,
        displayTrnOnInvoice: t.display_trn_on_invoice,
    };
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
        // v24 — new fields with safe defaults for legacy seeds that
        // predate the redesign: if `effective_dates_mode` isn't set,
        // derive it from whether the seed carries `effective_until`
        // (empty string ⇒ ongoing).
        effectiveDatesMode:
            a.effective_dates_mode
            ?? (a.effective_until ? "expiry" : "ongoing"),
        requireReAcceptance:    a.require_re_acceptance    ?? false,
        requireGuardianConsent: a.require_guardian_consent ?? false,
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
        programActive:               r.program_active,
        referrerEarnType:            r.referrer_earn_type,
        referrerEarnAmount:          r.referrer_earn_amount,
        friendEarnType:              r.friend_earn_type,
        friendEarnAmount:            r.friend_earn_amount,
        rewardUnlockTrigger:         r.reward_unlock_trigger,
        maxReferralsPerMember:       r.max_referrals_per_member,
        earnedRewardExpiryDays:      r.earned_reward_expiry_days,
        monthlyProgramBudgetAed:     r.monthly_program_budget_aed,
        preventSelfReferral:         r.prevent_self_referral,
        newCustomersOnly:            r.new_customers_only,
        minFirstSpendAed:            r.min_first_spend_aed,
        creditsRedeemableAllBranches: r.credits_redeemable_all_branches,
        infoTitle:                   r.info_title,
        infoDescription:             r.info_description,
    };
}

const INITIAL_PAY_RATES:        PayRate[]        = SEED_PAY_RATES.map(payRateFromSeed);
const INITIAL_INSTRUCTORS:      Instructor[]     = SEED_INSTRUCTORS.map(instructorFromSeed);
const INITIAL_PAYROLL_ENTRIES:  PayrollEntry[]   = SEED_PAYROLL_ENTRIES.map(payrollEntryFromSeed);
const INITIAL_ROLES:            Role[]           = SEED_ROLES.map(roleFromSeed);
const INITIAL_SHIFTS:              Shift[]           = SEED_SHIFTS;
// Same-branch invariant (client 2026-07-24): a staff member can only hold
// shifts at their OWN branch. The seed carries a few legacy cross-branch rows
// (e.g. a West/East instructor pointed at a South shift); sanitize both the
// legacy `shiftId` and the M2M assignment rows at boot so no surface ever
// renders a cross-branch shift. Owner (null branch) spans every location and
// is exempt. Mirrored on rehydrate (onRehydrateStorage) for persisted state.
const _SHIFT_BRANCH = new Map(INITIAL_SHIFTS.map(sh => [sh.id, sh.branch_id] as const));
const _INSTRUCTOR_ROLE_IDS = new Set(INITIAL_ROLES.filter(r => r.type === "instructor").map(r => r.id));

/** Seed a staff member's multi-track pay configuration (client 2026-07-24).
 *  Instructors get all three tracks enabled with distinct rates so the Pay
 *  rate tab + payroll flows have testable data (a class rate that differs from
 *  the appointment rate); every other role gets Default only, always enabled.
 *  Reuses existing seeded pay-rate ids — no seed-file edits. */
function deriveStaffPayConfig(s: Staff): StaffPayConfig {
    const base = s.payRateId ?? "pr_standard";
    if (!_INSTRUCTOR_ROLE_IDS.has(s.roleId)) {
        return {
            default: { enabled: true, payRateId: base },
            perClass: { enabled: false },
            perAppointment: { enabled: false },
        };
    }
    // Instructors: Default = a MONTHLY base salary (client 2026-07-24), so the
    // three tracks don't overlap — the base salary is paid once, Pay-per-class
    // adds the per-class rate on top, Pay-per-appointment adds the per-appointment
    // rate. (Previously Default mirrored the instructor's per-class rate, which
    // double-counted class pay.) Reuses the seeded monthly rate `pr_monthly`.
    return {
        default:        { enabled: true, payRateId: "pr_monthly" },
        perClass:       { enabled: true, payRateId: "pr_class_tiers", substitutePayRateId: "pr_standard", substitutionAmountAed: 40 },
        perAppointment: { enabled: true, payRateId: "pr_private_sess" },
    };
}

const INITIAL_STAFF:            Staff[]          = SEED_STAFF.map(staffFromSeed).map(s => {
    let row = s;
    if (row.shiftId && row.branchId != null) {
        const shb = _SHIFT_BRANCH.get(row.shiftId);
        if (shb !== undefined && shb !== row.branchId) row = { ...row, shiftId: undefined };
    }
    const payConfig = deriveStaffPayConfig(row);
    // Keep the canonical `payRateId` in sync with the Default track so the
    // sidebar / payroll (which read payRateId) agree with the Pay rate tab.
    return { ...row, payConfig, payRateId: payConfig.default.payRateId ?? row.payRateId };
});
// Mirror each staff instructor's synced Default-track rate onto the legacy
// `instructors` slice so both slices agree (payroll reads instructor.payRateId
// for the rate name + commission; the multi-track base reads staff.payConfig).
// Instructors without a staff row keep their seed rate (single-rate, legacy).
const _STAFF_DEFAULT_RATE = new Map(
    INITIAL_STAFF.map(s => [s.id, s.payConfig?.default.payRateId ?? s.payRateId] as const),
);
const INITIAL_INSTRUCTORS_SYNCED: Instructor[] = INITIAL_INSTRUCTORS.map(i => {
    const r = _STAFF_DEFAULT_RATE.get(i.id);
    return r ? { ...i, payRateId: r } : i;
});
const _STAFF_BRANCH = new Map(INITIAL_STAFF.map(s => [s.id, s.branchId] as const));
const INITIAL_SHIFT_ASSIGNMENTS:   ShiftAssignment[] = SEED_SHIFT_ASSIGNMENTS.filter(a => {
    const sb = _STAFF_BRANCH.get(a.staff_id);
    const shb = _SHIFT_BRANCH.get(a.shift_id);
    if (sb == null || shb === undefined) return true; // owner / unknown → keep
    return sb === shb;
});
const INITIAL_BLOCKED_TIMES:       BlockedTime[]     = SEED_BLOCKED_TIMES;
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
const INITIAL_SERVICES:  Service[]       = SEED_SERVICES.map(serviceFromSeed);
const INITIAL_APPOINTMENTS:         Appointment[]        = [...SEED_APPOINTMENTS, ...AVA_APPOINTMENTS].map(a => appointmentFromSeed(a, INITIAL_SERVICES))
    // Client 2026-07-24 — flag a demonstrable subset of PRIVATE appointments as
    // "booked with Preference: Flexible" (studio-assigned instructor) so the
    // Appointment Details Flexible badge + Reassign-instructor action have live
    // data. Every 2nd private appointment, deterministically. Reuses existing
    // appointment records — no new/duplicate entity, no seed-file change.
    .map((a, i) => (!a.openSession && a.instructorId && i % 2 === 0 ? { ...a, flexible: true } : a));
// Ava (customer demo persona): strip her generated appointment bookings + ratings
// and substitute the 2 curated ones (1 private + 1 recovery, both Attended +
// pre-rated) so admin + customer show the same simplified, in-sync set. The
// curated parent appointments are appended to INITIAL_APPOINTMENTS above.
const INITIAL_APPOINTMENT_BOOKINGS: AppointmentBooking[] = [
    ...SEED_APPOINTMENT_BOOKINGS.filter(b => b.customer_id !== AVA_CUSTOMER_ID),
    ...AVA_APPOINTMENT_BOOKINGS,
].map(appointmentBookingFromSeed);
const INITIAL_APPOINTMENT_RATINGS:  AppointmentRating[]  = [
    ...SEED_APPOINTMENT_RATINGS.filter(r => r.customer_id !== AVA_CUSTOMER_ID),
    ...AVA_APPOINTMENT_RATINGS,
].map(appointmentRatingFromSeed);
const INITIAL_SCHEDULES: ClassSchedule[] = SEED_CLASS_SCHEDULE.map(s => scheduleFromSeed(s, INITIAL_TEMPLATES));
// Ava Wright (the customer demo persona) gets a curated booking set so the demo
// opens with an EMPTY Upcoming tab + exactly 5 Past bookings (3 class + 2
// appointment). Strip ALL her generated class bookings and substitute
// AVA_CLASS_BOOKINGS. Admin + customer read this same list, so the two sides stay
// in sync. (Appointment overrides are applied to INITIAL_APPOINTMENT_* above.)
const INITIAL_BOOKINGS:  ClassBooking[]  = [
    ...SEED_CLASS_BOOKINGS.filter(b => b.customer_id !== AVA_CUSTOMER_ID),
    ...AVA_CLASS_BOOKINGS,
].map(bookingFromSeed);
// Drop ALL of Ava's class ratings — her one attended class stays rateable so the
// "Rate class" submit flow is testable (the pre-rated / completed-review state is
// demonstrated by her two attended appointments instead). Other customers' class
// ratings are untouched.
const INITIAL_RATINGS:   ClassRating[]   = SEED_CLASS_RATINGS
    .filter(r => r.customer_id !== AVA_CUSTOMER_ID)
    .map(ratingFromSeed);
const INITIAL_CUSTOMER_PLANS: CustomerPlan[] = SEED_CUSTOMER_PLANS.map(customerPlanFromSeed);

/** Reconcile `customer.creditsRemaining` from active/frozen finite plans.
 *  If the seed omits `credits_remaining` (undefined) AND the customer has
 *  at least one finite active/frozen plan, initialize the counter to the
 *  sum of the plan allotments so the Plan-tab widget shows a real number
 *  AND subsequent bookings decrement (they skip when the field is
 *  undefined). Customers on an unlimited membership legitimately have no
 *  counter and stay undefined. Pre-set values (from seed or from prior
 *  booking history) are never overwritten — this only backfills undefined. */
function reconcileCreditsRemaining(customers: Customer[], plans: CustomerPlan[]): Customer[] {
    return customers.map(c => {
        if (typeof c.creditsRemaining === "number") return c;
        const cust_plans = plans.filter(p =>
            p.customerId === c.id
            && (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested"),
        );
        if (cust_plans.length === 0) return c;
        // Any active unlimited plan → leave the counter undefined so
        // "Unlimited" renders throughout the UI.
        if (cust_plans.some(p => /unlimited/i.test(p.creditsLabel))) return c;
        // Sum finite allotments. `totalCredits` was already normalized at
        // seed-transform time (falls back to parsing the credits_label).
        const total = cust_plans.reduce((s, p) => s + (p.totalCredits ?? 0), 0);
        if (total <= 0) return c;
        return { ...c, creditsRemaining: total };
    });
}

const INITIAL_CUSTOMERS: Customer[] = reconcileCreditsRemaining(
    SEED_CUSTOMERS.map(customerFromSeed),
    INITIAL_CUSTOMER_PLANS,
);
const INITIAL_CUSTOMER_TRANSACTIONS: CustomerTransaction[] = SEED_CUSTOMER_TRANSACTIONS.map(customerTransactionFromSeed);

// Gift-card SALE transactions, derived 1:1 from the seeded issued cards
// (client Aug 2026). A gift-card sale wasn't recorded as a transaction, so it
// never showed in Payment History and couldn't be refunded. We synthesise one
// per seeded card so every gift card a customer holds appears as a purchase
// they can refund (while unused) — exactly like the live POS path now does.
// EXCLUDED from revenue (see `selectTransactionLedger`): a gift-card sale is
// deferred; revenue is recognised when the card is later redeemed, so counting
// the sale too would double-count. `staffId` (= the card's seller) drives
// commission via the issued-card path, so these are NOT re-summed there.
const INITIAL_GIFT_CARD_SALE_TXNS: CustomerTransaction[] = (() => {
    const custBranch = new Map(INITIAL_CUSTOMERS.map(c => [c.id, c.branchId]));
    const designName = new Map(SEED_GIFT_CARD_DESIGNS.map(d => [d.id, d.name]));
    return SEED_ISSUED_GIFT_CARDS.map((card): CustomerTransaction => ({
        id: `txn_gc_${card.id}`,
        customerId: card.customer_id,
        branchId: custBranch.get(card.customer_id) ?? DEFAULT_BRANCH_ID,
        kind: "gift_card",
        productId: card.design_id,
        name: designName.get(card.design_id) ?? `AED ${card.face_value_aed} Gift Card`,
        amountAed: card.face_value_aed,
        status: "complete",
        paymentMethod: "card",
        paymentSource: "pos",
        transactionType: "sale",
        staffId: card.sold_by_staff_id,
        createdAtISO: card.issued_at,
        issuedGiftCardId: card.id,
        isRefundable: true,
    }));
})();
const INITIAL_CUSTOMER_AGREEMENTS: CustomerAgreement[] = SEED_CUSTOMER_AGREEMENTS.map(customerAgreementFromSeed);
const INITIAL_CUSTOMER_REFERRALS: CustomerReferral[] = SEED_CUSTOMER_REFERRALS.map(customerReferralFromSeed);
const INITIAL_WALLET_TRANSACTIONS: WalletTransaction[] = SEED_WALLET_TRANSACTIONS.map(walletTransactionFromSeed);

// ─── Inventory / Retail seed adapters (Phase A, 2026-07-29) ─────────────────
// Snake_case seed → camelCase store shape. Same shape as class-category /
// membership adapters above; kept next to the other customer-adjacent
// initial-state builders for locality.

function retailCategoryFromSeed(c: SeedRetailCategory): RetailCategory {
    return {
        id: c.id,
        label: c.label,
        imageUrl: c.image_url,
        status: c.status,
        createdAt: c.created_at,
    };
}

function retailProductFromSeed(p: SeedRetailProduct): RetailProduct {
    return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        categoryId: p.category_id,
        description: p.description,
        priceAed: p.price_aed,
        unitCostAed: p.unit_cost_aed,
        reorderThreshold: p.reorder_threshold,
        imageUrl: p.image_url,
        sizes: p.sizes,
        status: p.status,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
    };
}

function retailStockFromSeed(s: SeedRetailStock): RetailStock {
    return {
        id: s.id,
        productId: s.product_id,
        branchId: s.branch_id,
        size: s.size,
        unitsOnHand: s.units_on_hand,
        lastAdjustedAt: s.last_adjusted_at,
        lastReceivedAt: s.last_received_at,
    };
}

function retailStockAdjustmentFromSeed(a: SeedRetailStockAdjustment): RetailStockAdjustment {
    return {
        id: a.id,
        productId: a.product_id,
        branchId: a.branch_id,
        size: a.size,
        delta: a.delta,
        kind: a.kind,
        reason: a.reason,
        sourceTransactionId: a.source_transaction_id,
        createdBy: a.created_by,
        createdAt: a.created_at,
    };
}

const INITIAL_RETAIL_CATEGORIES: RetailCategory[] = SEED_RETAIL_CATEGORIES.map(retailCategoryFromSeed);
const INITIAL_RETAIL_PRODUCTS: RetailProduct[] = SEED_RETAIL_PRODUCTS.map(retailProductFromSeed);
const INITIAL_RETAIL_STOCK: RetailStock[] = SEED_RETAIL_STOCK.map(retailStockFromSeed);
const INITIAL_RETAIL_STOCK_ADJUSTMENTS: RetailStockAdjustment[] =
    SEED_RETAIL_STOCK_ADJUSTMENTS.map(retailStockAdjustmentFromSeed);

/** Phase 3 — initial branding now derives from the centralized seed at
 *  `src/data/mock/branding_settings.ts`. The deep-copy below ensures runtime
 *  mutations through `updateBrandingSettings` never leak back into the seed
 *  module's exported object (Zustand state lives in its own reference). */
const INITIAL_BRANDING_SETTINGS: BrandingSettings = {
    ...SEED_BRANDING_SETTINGS,
    menuItems: SEED_BRANDING_SETTINGS.menuItems.map(i => ({ ...i })),
};

// ─── Store ──────────────────────────────────────────────────────────────────

// Exported (v30 reports rewrite) so `src/lib/reports/selectors.ts` can type
// its function signatures against the full store shape. Pure additive:
// existing consumers using implicit inference are unaffected.
export interface AppState {
    currentRole: UserRole;
    currentUser: User;
    sidebarCollapsed: boolean;
    classTemplates: ClassTemplate[];
    /** Appointment-service blueprints (Phase 1 build). Mirrors
     *  `classTemplates`. Future: appointments derived from these will
     *  flow into the schedule grid (only when ≥1 customer is booked). */
    services: Service[];
    /** Concrete scheduled appointment occurrences (Phase 4 — Module 13). */
    appointments: Appointment[];
    /** Customer slots inside appointments (Phase 4 — Module 13). */
    appointmentBookings: AppointmentBooking[];
    /** Appointment ratings (Phase 4 — Module 13). */
    appointmentRatings: AppointmentRating[];
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
    /** Wallet (account-credit AED) ledger — customer-detail Wallet tab,
     *  referral Account-Credit rewards + POS Member Wallet payments read this.
     *  Balance is derived via `walletBalanceAed`, never stored. */
    walletTransactions: WalletTransaction[];
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
    // ── Reports v33 slices ─────────────────────────────────────────────
    /** Leads captured by the funnel — feeds Lead Data + Lead Conversion +
     *  Acquisition Efficiency reports. Read-only for the demo; add-lead
     *  actions land when the leads module ships.
     *
     *  Client 2026-07-24 — this slice is retained through Phase 1a as the
     *  snake_case source-of-truth for the AI Agent's `leads` dataset
     *  (analyze / migrate / show). Phase 1b will absorb it into
     *  `customers` via `lifecycleTag: "Lead"` and drop this field. */
    leads: Lead[];
    // ── Customer & Lead Management v83 slices (client 2026-07-24) ──
    /** Signal → task engine rows. Materialised by the Phase 4 generator
     *  (attached to existing customer-touching actions); closed by staff
     *  on the Dashboard "Leads to follow up" widget or the profile
     *  Follow-ups tab. Empty at boot; grows as the demo runs. */
    followUpTasks: FollowUpTask[];
    /** Studio-editable lead sources — surfaced in Settings → Customer →
     *  Customer sources (Phase 6). Seeded with the PDF §4.1 default 10. */
    leadSources: LeadSource[];
    /** Studio-editable follow-up stages — surfaced in Settings →
     *  Customer → Follow-up stages (Phase 6). Seeded with the 6 defaults
     *  from PDF §4.2 (Won + Lost are terminal + locked). */
    followUpStages: FollowUpStage[];
    /** Marketing campaign engagement rollups — one row per (campaign ×
     *  channel × send). Feeds Campaign Performance. */
    marketingCampaignStats: MarketingCampaignStat[];
    /** Monthly ad spend per (channel × branch). Feeds Acquisition
     *  Efficiency's CPL / CAC / ROAS / CAC:LTV columns. */
    marketingSpend: MarketingSpend[];
    /** Staff attendance log — one row per (staff × scheduled class).
     *  Feeds Staff Attendance report's Actual hours / Late start / Hours
     *  variance columns. Derived from `classSchedules` at store-init time
     *  since clock-in/out data doesn't have a source module yet. */
    staffAttendanceLog: StaffAttendanceLog[];
    /** AI Agent import audit log (client 2026-07-20). One row per
     *  completed migration/import run — powers the Settings → Operations
     *  → "Migration & imports" table. New rows will land here when the
     *  ONRA AI Agent integration (sibling project) commits an import;
     *  for now the slice is seeded from `import_history.ts`. Snake-case
     *  fields, matching the leads / marketingCampaignStats convention. */
    importHistory: ImportHistorySeed[];
    // ── Inventory / Retail slices (Phase A, 2026-07-29) ─────────────────
    // Additive — no existing slice reshaped. UI wire-up starts in Phase B
    // (list page swaps its hardcoded rows for real store data). See
    // new-prd/inventory-retail-implementation-plan.md for the full plan.
    /** Retail categories (Apparel, Supplements, Equipment, Accessories,
     *  Recovery). Editable in Settings → Operations → Retail categories
     *  (Phase C). Renaming cascades to POS filter chips + report grouping
     *  labels via label-lookup by id. */
    retailCategories: RetailCategory[];
    /** Studio-global retail-product catalog. Stock is per-branch
     *  (`retailStock`); this slice carries the SKU / price / cost /
     *  reorder threshold. */
    retailProducts: RetailProduct[];
    /** One row per (product × branch). POS sale decrements `unitsOnHand`
     *  and writes a matching `retailStockAdjustment` in the same set(). */
    retailStock: RetailStock[];
    /** Audit trail — every stock delta writes a row. Feeds the Stock on
     *  Hand report's Units received / Sell-through % / Stock turnover ×
     *  columns for a period window. */
    retailStockAdjustments: RetailStockAdjustment[];

    // ── Retail actions (Phase A) ─────────────────────────────────────────
    /** Create a retail category. Returns the generated id, or `null` when
     *  the label is empty or collides with an existing category (case-
     *  insensitive). Emits an audit-log entry. */
    addRetailCategory: (input: { label: string; imageUrl?: string }) => string | null;
    /** Patch an existing retail category (label / image / status). Returns
     *  `false` when the id is missing or the new label collides. */
    updateRetailCategory: (id: string, patch: Partial<Omit<RetailCategory, "id" | "createdAt">>) => boolean;
    /** Delete a retail category. Blocked (returns `false`) when any
     *  non-archived product still references it — same guard the class-
     *  category delete uses. */
    deleteRetailCategory: (id: string) => boolean;
    /** Read-only probe: can this category be deleted right now?
     *  Returns `{ deletable: true }` OR `{ deletable: false, reason: "in_use", usageCount }`. */
    canDeleteRetailCategory: (id: string) => { deletable: true } | { deletable: false; reason: "in_use"; usageCount: number };
    /** Create a retail product. Returns the generated id, or `null` when
     *  SKU is blank or collides with an existing active/inactive product. */
    addRetailProduct: (input: Omit<RetailProduct, "id" | "createdAt" | "updatedAt"> & { id?: string }) => string | null;
    /** Patch an existing retail product. Bumps `updatedAt`. */
    updateRetailProduct: (id: string, patch: Partial<Omit<RetailProduct, "id" | "createdAt">>) => boolean;
    /** Bulk status flip (active / inactive / archived). Follows the same
     *  Archive → Reactivate → Recover ladder every other list uses. */
    setRetailProductStatus: (ids: string[], status: RetailProduct["status"]) => void;
    /** Hard-delete retail products. Blocked (returned in `blocked[]`) when
     *  ANY transaction ever referenced them (snapshot fields preserve the
     *  receipt history — deleting would break past receipts otherwise). */
    deleteRetailProducts: (ids: string[]) => { deleted: string[]; blocked: string[] };
    /** Read-only probe for a single product's delete eligibility. */
    canDeleteRetailProduct: (id: string) => { deletable: true } | { deletable: false; reason: "has_history"; transactionCount: number };
    /** Adjust stock for a (product × branch) — negative delta = sale/loss,
     *  positive = receive/refund/positive-adjust. Writes both the
     *  `retailStock` row's `unitsOnHand` AND a matching `retailStockAdjustment`
     *  entry in the same `set()` so the audit log stays in lockstep with
     *  the running balance. Returns the generated adjustment id. Creates a
     *  new `retailStock` row if none exists for the pair (e.g. product
     *  seeded after the stock table). Clamps at 0 for negative deltas so
     *  demo data can't go negative. */
    adjustRetailStock: (input: {
        productId: string;
        branchId: string;
        /** Size variant to adjust; omit for a sizeless product. Stock rows are
         *  keyed by (product × branch × size). */
        size?: RetailSize;
        delta: number;
        kind: RetailStockAdjustment["kind"];
        reason?: string;
        sourceTransactionId?: string;
    }) => string;
    /** Thin convenience wrapper on `adjustRetailStock` with kind = "receive"
     *  and delta forced positive. */
    receiveRetailStock: (input: {
        productId: string;
        branchId: string;
        size?: RetailSize;
        units: number;
        reason?: string;
    }) => string;

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
    /** Shifts — drives the Shift management table + the staff-create
     *  form's Assign shift dropdown + the instructor detail Shift
     *  hours line. */
    shifts: Shift[];
    /** Many-to-many staff ↔ shift assignments (client 2026-07-22).
     *  One row per (staff, shift) pair; carries the per-assignment
     *  days-of-week subset. Feeds the shift list's Staffing column
     *  and the expandable row's per-staff day chips. */
    shiftAssignments: ShiftAssignment[];

    // ── Shift actions (Shift management module) ──────────────────────────
    /** Create a new shift. Returns the generated id. */
    addShift: (input: Omit<Shift, "id" | "created_at"> & { id?: string }) => string;
    /** Add a staff → shift assignment. Idempotent per (shift, staff, week):
     *  the same trio returns the existing row instead of duplicating. Defaults
     *  `days_of_week` to the parent shift's `working_days` when omitted. Pass
     *  `week_start` (this-week Monday ISO) to scope the assignment to ONE week;
     *  omit it for a recurring/all-weeks baseline. */
    addShiftAssignment: (input: { shift_id: string; staff_id: string; days_of_week?: boolean[]; week_start?: string }) => string;
    /** Remove a staff → shift assignment by id. */
    removeShiftAssignment: (id: string) => void;
    /** Update the per-assignment days-of-week subset. */
    updateShiftAssignmentDays: (id: string, days: boolean[]) => void;
    /** Patch an existing shift — name / branch / hours / days / status. */
    updateShift: (id: string, patch: Partial<Omit<Shift, "id" | "created_at">>) => void;
    /** Bulk status flip (Archive / Reactivate / Deactivate / Recover).
     *  Mirrors `setRolesStatus` shape. */
    setShiftsStatus: (ids: string[], status: Shift["status"]) => void;
    /** Bulk delete — always succeeds. Cascades: removes each shift's
     *  `shiftAssignments`, clears the legacy `staff.shiftId` for any staff who
     *  held it, and re-syncs instructors so no dangling reference remains.
     *  `blocked` is kept in the shape for callers but is always empty now. */
    deleteShifts: (ids: string[]) => { deleted: string[]; blocked: string[] };

    // ── Blocked time slice (Staff & shift module → Blocked time tab) ─────
    /** Blocked-time entries — drives the Blocked time tab + any future
     *  schedule grid overlay. */
    blockedTimes: BlockedTime[];
    /** Create a new blocked-time entry. Returns the generated id. */
    addBlockedTime: (input: Omit<BlockedTime, "id" | "created_at"> & { id?: string }) => string;
    /** Patch an existing blocked-time entry — title / date / hours /
     *  note / staff / branch. */
    updateBlockedTime: (id: string, patch: Partial<Omit<BlockedTime, "id" | "created_at">>) => void;
    /** Bulk delete — blocked-time has no archive concept, deletion is
     *  always available. */
    deleteBlockedTimes: (ids: string[]) => void;
    pendingPurchase: PendingPurchase | null;
    /** Transient — a cover image the user uploaded in the AI Agent's
     *  "create class from scratch" flow. Held here (not relayed through the
     *  model) so the publish tool can read it off the request snapshot. Set on
     *  upload, cleared after the class is published. Not persisted. */
    aiScratchCoverImage: string | null;
    setAiScratchCoverImage: (url: string | null) => void;
    toast: ToastData | null;

    /** Client 2026-07-31 — true while ANY admin list page has at least one
     *  row checked (bulk-selection mode). The floating AI Agent button
     *  reads this and hides itself so the bulk-action bar (also bottom-
     *  fixed) never fights the AI pill for the same real estate. Each
     *  page that owns a `selectedIds` Set flips this via the small
     *  `useBulkSelectionSignal` hook — cleanup on unmount guarantees the
     *  flag never leaks between routes. Per-tab, never persisted. */
    bulkSelectionActive: boolean;
    setBulkSelectionActive: (active: boolean) => void;

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

    /** v26 — Single studio-wide cancellation policy (Figma 4580:29847
     *  landing card + 7631:404757 side panel). Replaces the legacy
     *  list of policies (Add/Edit/Delete) with one config edited
     *  via a side panel. The landing card + panel + waitlist "Match
     *  free cancellation window" toggle all read from this slice. */
    cancellationPolicy: CancellationPolicy;
    updateCancellationPolicy: (patch: Partial<CancellationPolicy>) => void;

    /** Studio-wide freeze policy — singleton, governs the CUSTOMER
     *  self-service membership-freeze flow (enable, max duration, max freezes,
     *  fee, allowed reasons, apply-to). Admin freeze/unfreeze is a full
     *  override and does NOT read this. Edited via Settings → Customer →
     *  Freeze policy. Client Jul 2026: flipped from per-branch to studio-
     *  level to match cancellationPolicy / classesSettings storage. */
    freezePolicy: FreezePolicy;
    updateFreezePolicy: (patch: Partial<FreezePolicy>) => void;

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

    /** Services (Phase 1) — create + edit are scaffolded so future Phase 2
     *  add/edit pages can call into the store without another migration.
     *  `setServiceStatus` is the one mutation that ALL Phase 1 row actions
     *  funnel through (archive / deactivate / reactivate / recover), with
     *  `deleteService` reserved for the zero-history terminal action. */
    addService:    (service: Omit<Service, "id">) => string;
    updateService: (id: string, updates: Partial<Omit<Service, "id">>) => void;
    setServiceStatus: (id: string, status: ServiceStatus) => void;
    deleteService: (id: string) => void;

    /** ── Appointments (Phase 4) ────────────────────────────────────────────
     *  Cancel the whole appointment — flips status to "Cancelled", cascades
     *  every Booked customer slot to Cancelled, and clears the booked count.
     *  Mirrors `cancelClassSchedule` 1:1, including the `refund` flag.
     *  Refund-on by default: admin cancellation always returns credits. */
    cancelAppointment: (id: string, refund: boolean, cancelledBy?: string) => void;
    /** Reassign the instructor on a Flexible private appointment (client
     *  2026-07-24). Updates the appointment's instructor fields from the
     *  `instructors` slice + records an audit entry. */
    reassignAppointmentInstructor: (appointmentId: string, instructorId: string) => void;
    /** Mirror a customer-side appointment booking into the shared admin store
     *  as a real `Appointment` (+ its single roster `AppointmentBooking`), so a
     *  session booked in the customer app appears on the admin schedule and
     *  opens in Appointment Details (Flexible badge + Reassign included).
     *  Reuses the existing appointment data model — no separate entity. Returns
     *  the new appointment id (persisted on the customer booking as the link).
     *  Client 2026-07-24. */
    addCustomerAppointment: (input: {
        serviceId: string;
        dateISO: string;
        startTime: string;
        durationMins: number;
        instructorId: string | null;
        flexible: boolean;
        customer: { id: string; name: string; initials: string; color?: string; imageUrl?: string };
    }) => string;
    /** Cancel a single customer's booking. Mirrors `cancelClassBooking`
     *  including the `refund` flag — when true the customer's credit is
     *  returned (no-op for the prototype since credit ledgers aren't
     *  wired, but the audit row records the intent). */
    cancelAppointmentBooking: (bookingId: string, refund: boolean, cancelledBy?: string) => void;
    /** Hard remove a customer from an Open session appointment roster.
     *  Mirrors `removeClassBooking`. `refund` matches the modal toggle. */
    removeAppointmentCustomer: (bookingId: string, refund: boolean) => void;
    /** Mark a customer Present (Attended) on an Ongoing appointment.
     *  Mirrors the class-schedule `Present` action — no No-show counterpart
     *  per the brief. Bulk variant supplied for the bulk-action bar. */
    markAppointmentPresent: (bookingId: string) => void;
    markAppointmentPresentBulk: (bookingIds: string[]) => void;
    /** Soft-delete a customer's rating on a completed appointment.
     *  Mirrors the class-schedule rating deletion — moves the row to
     *  the Deletion log sub-tab and decrements the parent appointment's
     *  `ratingCount` + recomputes the aggregate. */
    deleteAppointmentRating: (id: string, deletedBy?: string) => void;
    deleteAppointmentRatings: (ids: string[], deletedBy?: string) => void;
    /** Submit a customer's rating for a completed appointment (mirrors the
     *  class-schedule `submitClassRating`). Appends an `appointmentRatings` row
     *  AND recomputes the parent appointment's denormalized `rating`/`ratingCount`
     *  so the admin summary + customer review state read one shared source. */
    submitAppointmentRating: (input: {
        appointmentId: string;
        customerId: string;
        score: number;
        comment: string;
        tags?: string[];
    }) => void;

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
    /** Offer a freed spot on this class to the waitlist, honouring Settings →
     *  Booking rules → Waitlist ("Auto add the next person" promotes #1 outright;
     *  "Notify to accept" reserves it for #1 to claim). No-op when the waitlist is
     *  off, the class is full, or the auto-promotion cutoff has passed. */
    offerFreedWaitlistSpot: (classScheduleId: string) => void;
    /** Move a waitlisted seat to booked — spends a credit, bumps the class count
     *  and renumbers the queue. Used by auto-promotion, the member's "Claim spot"
     *  action and any future admin manual promote. */
    promoteWaitlistBooking: (bookingId: string) => void;
    /** Member accepted a "Notify to accept" offer. False when the offer already
     *  lapsed or the class filled up meanwhile. */
    claimWaitlistSpot: (bookingId: string) => boolean;
    /** Member declined the offer — the spot passes to the next person in line. */
    declineWaitlistSpot: (bookingId: string) => void;
    /** Give every BOOKED seat on a spot-selection class a concrete stored spot.
     *  Seeded bookings carry none, and the admin roster used to derive a label
     *  positionally from a fixed 4-column grid — so admin and customer disagreed
     *  about which spots were occupied. Assigns in the CONFIGURED grid's reading
     *  order, skipping blocked spots and any already held. Idempotent. */
    reconcileBookingSpots: () => void;
    /** Re-derive every class's denormalized `booked` count from the ACTUAL
     *  booking rows (status === "booked"). The single source of truth is
     *  `classBookings`; this guarantees the attendance count, the booked
     *  roster, the occupied-spot count and the remaining capacity can never
     *  disagree (a seed / persisted drift used to show e.g. 9/10 with an empty
     *  roster). Idempotent — only rewrites rows whose count changed. */
    reconcileBookedCounts: () => void;
    /** Sweep every upcoming class that has room AND a waitlist, and run the
     *  Booking Rules offer on it. Cancellation is not the only way a spot can be
     *  free — seeded demo data, an admin capacity increase, or a cancellation
     *  made before this logic existed all leave a class sitting at e.g. 5/6 with
     *  people still queued. Idempotent: `offerFreedWaitlistSpot` no-ops when a
     *  claim is already live or nobody is eligible. */
    reconcileWaitlistOffers: () => void;
    /** Lapse any claim offers whose window has closed and re-offer those spots.
     *  Called on render by the surfaces that show waitlist state, so expiry works
     *  without a background timer. */
    expireWaitlistClaims: () => void;
    removeClassBooking: (id: string) => void;
    removeClassBookings: (ids: string[]) => void;
    cancelClassBookings: (ids: string[], reason: string, refund: boolean, source?: ClassBooking["cancelledSource"]) => void;
    /** Customer-portal cancel that ALSO charges the cancellation-penalty
     *  fee when applicable (Jul 2026 client feedback, Figma 7790:27893).
     *  Delegates the booking mutation to `cancelClassBooking` with
     *  `source: "customer_portal"` so the existing admin cancel path
     *  stays untouched, then — if the customer's plan is an unlimited
     *  membership AND the studio's cancellation policy has the penalty
     *  gate ON AND the customer's LIFETIME late-cancel + no-show count
     *  has ALREADY crossed the threshold — emits a non-refundable
     *  `customer_transactions` row of `kind: "cancellation_penalty"`.
     *  Returns `{ bookingCancelled: true, penaltyTransactionId?: string,
     *  penaltyAedCharged?: number }` so the caller UI can show the
     *  "You were charged AED X" confirmation. */
    cancelClassBookingByCustomer: (
        bookingId: string,
        scenario: "late_cancel" | "no_show",
        reason?: string,
    ) => { bookingCancelled: boolean; penaltyTransactionId?: string; penaltyAedCharged?: number };
    /** Pure selector — how much penalty would the customer owe if they
     *  cancelled this booking now with the given scenario? Callers
     *  (customer UI) use it to render the confirmation modal BEFORE
     *  calling `cancelClassBookingByCustomer`. `amountAed` is 0 (and
     *  `applies` is `false`) when the gate is off, the plan isn't
     *  unlimited, the fee toggle for this scenario is off, or the
     *  customer hasn't yet crossed the threshold. */
    computeCancellationPenalty: (
        customerId: string,
        scenario: "late_cancel" | "no_show",
    ) => { applies: boolean; amountAed: number; scenario: "late_cancel" | "no_show" };
    updateAttendance: (bookingId: string, status: ClassBooking["attendanceStatus"]) => void;
    /** Member-portal booking. Adds a booked/waitlisted ClassBooking, bumps the
     *  schedule's booked count + spends one class credit (booked only, package
     *  plans), and fires booking-confirmed / new-booking notifications. The new
     *  row propagates to the admin roster, the customer profile, the member's
     *  Bookings list, and the class detail state in the same render cycle.
     *  Returns the new booking id. */
    addClassBooking: (input: { classScheduleId: string; customerId: string; status: "booked" | "waitlisted"; spot?: string; guestName?: string; guestPhone?: string; guestEmail?: string; guestPayment?: "drop_in" | "guest_package" | "invite_link" | "booker_credit"; chargeBookerCredit?: boolean }) => string;
    /** Insert a booking VERBATIM — no frozen-plan guard, no credit deduction,
     *  no notifications. Used by the AI Agent migration importer to bring
     *  across historical bookings without triggering the "you're frozen" gate
     *  or double-charging credits already spent in the source platform.
     *  Auto id + bookingTime (if not supplied). */
    addImportedClassBooking: (
        input: Omit<ClassBooking, "id" | "bookingTime"> & {
            id?: string;
            bookingTime?: string;
        },
    ) => string;
    /** Member-portal: mark this customer's outstanding (unsigned) booking-waiver
     *  agreements as signed — the first-time waiver gate. */
    signWaiver: (customerId: string, guardianConsent?: boolean) => void;

    deleteClassRating: (id: string, deletedBy: string) => void;
    /** Append a member's class rating + recompute the schedule's rating aggregate. */
    submitClassRating: (input: {
        classScheduleId: string;
        customerId: string;
        instructorId: string;
        score: number;
        comment: string;
        tags?: string[];
    }) => void;

    addCustomer: (customer: Omit<Customer, "id" | "createdAt" | "initials" | "branchId" | "status"> & { initials?: string; branchId?: string; status?: Customer["status"] }) => string;
    /** Mutate any field on a customer — used by the Edit Customer flow. */
    updateCustomer: (id: string, patch: Partial<Omit<Customer, "id">>) => void;
    /** Change lifecycle status for one or many customers. Deactivate, archive,
     *  recover and reactivate all route through here so every call-site lands
     *  on the same propagation + toast pattern. */
    setCustomerStatus: (ids: string[], status: Customer["status"], note?: string) => void;
    /** Hard-delete customers. Blocked for any customer that has booking
     *  history (archive instead). Returns the split so the UI can report
     *  exactly what was removed and what was kept. */
    deleteCustomers: (ids: string[]) => { deleted: string[]; blocked: string[] };

    // ── Customer plans (customer-detail Plan tab) ──────────────────────────
    /** Freeze a plan — status → frozen, freeze window stored, and the expiry
     *  date pushed back by the freeze duration so frozen days aren't lost. */
    freezeCustomerPlan: (planId: string, startISO: string, endISO: string, source?: CustomerPlan["freezeSource"], reason?: string) => { fee: number };
    /** Unfreeze a plan — status → active. The extended expiry date is kept. */
    unfreezeCustomerPlan: (planId: string) => void;
    /** Customer-portal membership freeze — freezes the plan (customer_portal
     *  source, increments freezeCount) AND charges the branch's freeze fee if
     *  the policy sets one (charge-now). The policy gate (enabled / apply-to /
     *  max-freezes / max-duration) is enforced in the customer UI; this action
     *  performs the mutation + fee charge. Returns the fee charged (0 = none). */
    freezeMembershipByCustomer: (planId: string, startISO: string, endISO: string, reason?: string) => { fee: number };
    // ── Freeze policy v2 Phase 5 — approval flow ───────────────────────────
    /** Customer-portal freeze REQUEST — parks the plan in `freeze_requested`
     *  with the requested window + reason. No fee is charged at this stage;
     *  the fee (if any) is applied on approve. Used when the studio's
     *  `who_can_freeze === "members_request_admins_approve"`. */
    requestFreezeByCustomer: (planId: string, startISO: string, endISO: string, reason?: string) => void;
    /** Admin approves a pending freeze request. Transitions the plan to
     *  `frozen` with the requested dates + reason, applies the billing
     *  behavior (Option A/B), clears the request scratch fields, and
     *  charges the freeze fee if configured. Fires customer + admin bell
     *  rows same as a direct freeze. */
    approveFreezeRequest: (planId: string) => void;
    /** Admin rejects a pending freeze request. Reverts to `active` and
     *  stores the optional note so the customer sees why. Bell rows tell
     *  the customer + admin audit log. */
    rejectFreezeRequest: (planId: string, note?: string) => void;
    /** Cancel a plan — status → cancelled, with the mode + reason recorded. */
    cancelCustomerPlan: (planId: string, mode: "today" | "period_end", reason: string) => void;
    reactivateCustomerPlan: (planId: string) => void;
    /** Remove a complimentary grant — status → removed, with reason + actor. */
    removeComplimentaryPlan: (planId: string, reason: string, removedBy: string, removedByRole: string) => void;
    /** Append a complimentary grant as a new plan row (from the add-credit flow). */
    addComplimentaryPlan: (input: Omit<CustomerPlan, "id" | "kind" | "status" | "planTypeLabel">) => string;
    /** Append a full CustomerPlan record — used by the AI Agent migration
     *  importer to bring across a customer's currently-held membership /
     *  package. Distinct from `addComplimentaryPlan` (which is for gifted
     *  credit only). */
    addCustomerPlan: (input: Omit<CustomerPlan, "id"> & { id?: string }) => string;

    // ── Customer transactions (customer-detail Payments tab) ───────────────
    /** Refund a completed transaction — status → refunded, with the refund
     *  method + timestamp recorded. Only `complete` transactions are eligible. */
    refundTransaction: (id: string, method: "cash" | "card") => void;
    /** Append a customer transaction — used by the AI Agent migration importer
     *  to bring across historical payments. Auto id + createdAtISO. */
    addCustomerTransaction: (
        input: Omit<CustomerTransaction, "id" | "createdAtISO"> & {
            id?: string;
            createdAtISO?: string;
        },
    ) => string;
    /** Append a wallet transaction — used by the AI Agent migration importer
     *  to carry across account-credit balances. */
    addWalletTransaction: (
        input: Omit<WalletTransaction, "id" | "createdAtISO"> & {
            id?: string;
            createdAtISO?: string;
        },
    ) => string;
    /** Append a customer referral — used by the AI Agent migration importer. */
    addCustomerReferral: (
        input: Omit<CustomerReferral, "id"> & { id?: string },
    ) => string;
    /** Append a class rating — used by the AI Agent migration importer. */
    addClassRating: (
        input: Omit<ClassRating, "id" | "submittedAt"> & {
            id?: string;
            submittedAt?: string;
        },
    ) => string;
    /** Append a payroll entry — used by the AI Agent migration importer. */
    addPayrollEntry: (
        input: Omit<PayrollEntry, "id"> & { id?: string },
    ) => string;
    /** Append a staff attendance log entry — used by the AI Agent migration
     *  importer to bring across instructor attendance history alongside the
     *  boot-time derived rows. */
    addStaffAttendanceLog: (
        input: Omit<StaffAttendanceLog, "id"> & { id?: string },
    ) => string;
    /** Approve a pending refund request (dashboard Needs-attention). Refunds
     *  the transaction (status → refunded) so it drops from the queue. */
    approveRefundRequest: (id: string) => void;
    /** Deny a pending refund request — clears `refundRequestedAtISO` so the
     *  row stays `complete` and drops from the queue. */
    denyRefundRequest: (id: string) => void;
    /** Promote a waitlisted booking to booked (dashboard Needs-attention
     *  "Waitlist spots opened today"). Bumps the schedule's booked count. */
    confirmWaitlistBooking: (bookingId: string) => void;

    // ── Wallet (account-credit AED) ────────────────────────────────────────
    /** Add an account-credit (AED) credit to a customer's wallet ledger.
     *  Used by referral Account-Credit rewards + manual grants. Returns the
     *  new transaction id. Emits a toast + audit. */
    creditWallet: (input: {
        customerId: string; amountAed: number; reason: string;
        referenceType?: WalletTransaction["referenceType"]; referenceId?: string;
        createdBy?: string; silent?: boolean;
    }) => string;
    /** Debit a customer's wallet (POS Member Wallet payment / adjustment).
     *  Rejects (returns false) when the balance can't cover the amount so
     *  the wallet never goes negative. Emits a toast + audit unless silent. */
    debitWallet: (input: {
        customerId: string; amountAed: number; reason: string;
        referenceType?: WalletTransaction["referenceType"]; referenceId?: string;
        createdBy?: string; silent?: boolean;
    }) => boolean;

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
    /** Append a new package to the store. Same id-handling as
     *  `addMembership`. */
    addPackage: (input: Omit<Package, "id"> & { id?: string }) => string;
    updatePackage: (id: string, patch: Partial<Omit<Package, "id">>) => void;
    setPackageStatus: (ids: string[], status: Package["status"]) => void;
    deletePackage: (id: string) => boolean;
    deletePackages: (ids: string[]) => { deleted: string[]; blocked: string[] };

    // ── Leads ───────────────────────────────────────────────────────────────
    /** Append a lead to the funnel. Auto-generates id + added_at when not
     *  supplied. Used by the AI Agent migration importer (leads entity). */
    addLead: (input: Omit<Lead, "id" | "added_at"> & { id?: string; added_at?: string }) => string;

    // ── Customer & Lead Management v83 — task engine (client 2026-07-24) ───
    /** Manually log an enquiry for a customer — creates a follow-up task
     *  with the `enquiry_logged` trigger. Wired to the Phase-5 "Log
     *  enquiry" button on the profile Follow-ups tab. Returns:
     *    { logged: true; id }                       — task materialised
     *    { logged: false; reason: "lost" }          — customer marked Lost
     *    { logged: false; reason: "post_conversion" } — already a member
     *    { logged: false; reason: "dup" }           — open enquiry exists */
    logCustomerEnquiry: (customerId: string, note?: string) =>
        | { logged: true; id: string }
        | { logged: false; reason: "lost" | "post_conversion" | "dup" };
    /** v83 audit-3 (2026-07-27) — read-only eligibility probe used by
     *  the Follow-ups tab side panel to enable/disable its primary
     *  button + show an inline reason. Mirrors logCustomerEnquiry's
     *  ladder without mutating state so the UI can render the block
     *  BEFORE the admin types anything. */
    getEnquiryEligibility: (customerId: string) =>
        | { canLog: true }
        | { canLog: false; reason: "lost" | "post_conversion" | "dup" };
    /** Close a follow-up task with a staff-picked outcome. Applies the
     *  Phase-5 outcome→followUpStatus mapping:
     *    reached         → status advances from New to Contacted
     *    follow_up       → status stays (a fresh delay-based task may
     *                      re-materialise later via the engine)
     *    not_interested  → status → Lost, suppressing future tasks
     *  Returns false when the task id doesn't exist or is already closed. */
    closeFollowUpTask: (taskId: string, outcome: FollowUpTaskOutcome) => boolean;

    // ── Customer & Lead Management v83 — Settings config (client 2026-07-24) ─
    /** Append a new lead source. Returns the new id; unique across labels
     *  (case-insensitive) — a duplicate label is treated as no-op and the
     *  existing row's id comes back. */
    addLeadSource: (label: string) => string;
    /** Rename an existing lead source. System-seeded rows (locked) can
     *  still be renamed — only delete is blocked. Returns false when the
     *  id isn't found or the label collides with another source. */
    renameLeadSource: (id: string, label: string) => boolean;
    /** Delete a lead source. Blocked when the source is locked OR any
     *  customer references it via `sourceId`. Returns:
     *    { deleted: true }                       — happy path
     *    { deleted: false, reason: "locked" }    — system row
     *    { deleted: false, reason: "in_use"; usageCount: N } — refs exist */
    deleteLeadSource: (id: string) =>
        | { deleted: true }
        | { deleted: false; reason: "locked" }
        | { deleted: false; reason: "in_use"; usageCount: number };

    /** Append a new follow-up stage. Blocked when total stages reached
     *  the plan's max (8 per PDF §4.2 "keep it tight"). Returns the id
     *  on success, null when blocked. */
    addFollowUpStage: (label: string) => string | null;
    /** Rename a follow-up stage. Cascades into every customer's
     *  `followUpStatus` field so a rename doesn't leave stale strings
     *  in the wild. System-mandatory rows (Won + Lost) can be renamed
     *  the same way, but the terminal semantics stay wired to the id. */
    renameFollowUpStage: (id: string, label: string) => boolean;
    /** Delete a follow-up stage. Blocked when the stage is locked OR
     *  any customer references it via `followUpStatus`. */
    deleteFollowUpStage: (id: string) =>
        | { deleted: true }
        | { deleted: false; reason: "locked" }
        | { deleted: false; reason: "in_use"; usageCount: number };

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
    /** Spendable balance a customer holds across every ACTIVE, unexpired
     *  card they own. Drives the "Gift card" payment method's availability
     *  + the balance label at both admin POS and customer checkout. */
    giftCardBalanceFor: (customerId: string) => number;
    /** Redeem `amountAed` against a customer's gift cards, oldest-expiry
     *  first so cards closest to expiring get spent before they lapse.
     *  Partial redemption supported — a card that can't cover the whole
     *  amount contributes its remaining balance and the next card picks up
     *  the rest.
     *
     *  Returns the per-card breakdown actually debited (so callers can
     *  store it on the transaction for a later refund-restore) plus the
     *  total applied. `applied` is capped at the customer's available
     *  balance, so over-requesting is safe — it simply spends everything.
     *
     *  A card whose balance hits 0 flips `status` to "redeemed".
     *  `last_redeemed_at` is stamped on every touched card. */
    redeemGiftCards: (customerId: string, amountAed: number) => {
        applied: number;
        debits: { cardId: string; amountAed: number }[];
    };
    /** Reverse a redemption — used by the refund path. Adds each amount
     *  back onto its card and flips "redeemed" cards back to "active"
     *  when the restored balance is > 0 (expired cards stay expired). */
    restoreGiftCards: (debits: { cardId: string; amountAed: number }[]) => void;

    // ── Import history (Migration & imports audit trail) ────────────────────
    /** Append a completed-import row. Fires when the AI Agent's Migration
     *  thread commits an import (see src/ai-agent/components/ChatThread.tsx
     *  `onFinish` handler). Auto-generates id + imported_at. Returns id. */
    addImportHistory: (
        input: Omit<ImportHistorySeed, "id" | "imported_at"> & {
            id?: string;
            imported_at?: string;
        },
    ) => string;

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
    /** Materialise payroll entries for staff that don't have one yet — used by
     *  the Run Payroll flow so non-instructor staff (Front Desk, Branch Admin,
     *  Operator) can actually be paid. Instructors have entries seeded up
     *  front; non-instructor staff don't, and this closes that gap on demand.
     *  Returns the newly-created entry ids so the caller can pipe them into
     *  `setPayrollEntriesStatus(..., "paid")` in the same run. */
    createPayrollEntries: (specs: Array<Omit<PayrollEntry, "id" | "status" | "createdAt"> & { status?: PayrollEntryStatus }>) => string[];
    /** Apply an adjustment to a single entry — used in the Run Payroll review
     *  step. Recomputes `totalEarnings` automatically. */
    setPayrollEntryAdjustment: (id: string, amount: number, reason?: string) => void;

    // ── Customer notification settings (PRD 11 §12 — v27 redesign) ────────
    notificationSettings: NotificationSetting[];
    /** Flip a single event's channel toggle (v27 — Push replaced by SMS).
     *  Payment critical rows enforce "at least one enabled channel" —
     *  the store REFUSES to disable the last enabled channel on a
     *  critical row + returns false so the UI can fire the toast. */
    setNotificationEventChannel: (id: string, channel: "email" | "whatsapp" | "sms", enabled: boolean) => boolean;
    /** Save a template edit (subject / body / sms / whatsapp body) for
     *  one event. Editing the WhatsApp body ALSO flips
     *  `whatsappApprovalStatus` back to "pending" (mirrors Meta's real
     *  workflow — every content change goes through re-approval). */
    updateNotificationTemplate: (
        id: string,
        patch: Partial<Pick<NotificationSetting,
            | "emailSubject"    | "emailTemplate"
            | "whatsappTemplate" | "smsTemplate"
        >>,
    ) => void;
    /** Save the Manage timing tab (send-mode + offsets). */
    updateNotificationTiming: (
        id: string,
        patch: Partial<Pick<NotificationSetting, "sendMode" | "sendOffsets">>,
    ) => void;
    /** Save the Condition tab — flip the "Notification is critical" flag
     *  on a single event (Figma 7808:58413). Enabling critical when
     *  every channel is already off is refused: a critical row must
     *  have ≥1 channel to satisfy the "at least one channel stays on"
     *  contract. Disabling critical is always allowed. Returns `false`
     *  when the flip was refused so the caller can surface a toast. */
    setNotificationEventCritical: (id: string, isCritical: boolean) => boolean;

    // ── Per-branch marketing overrides (client 2026-07-20) ────────────
    /** Create a per-branch override for a marketing row. Copies the
     *  parent's channel toggles + template bodies as the starting
     *  point (so the override is a "safe clone" the admin can then
     *  tweak). Returns the new override's id.
     *
     *  Parent is looked up by `parentId` (the studio-wide row's id;
     *  the row whose `branchId` is unset). If a branch already has
     *  an override for that parent, returns the existing id
     *  (idempotent). Only allowed on marketing-category rows. */
    addMarketingBranchOverride: (parentId: string, branchId: string) => string;
    /** Remove a per-branch override; the branch reverts to inheriting
     *  the parent (studio-wide) row's settings. No-op if the id
     *  isn't a branch override. */
    removeMarketingBranchOverride: (id: string) => void;

    // ── Delivery hours (v27 — Figma 7733:51010) ───────────────────────────
    /** Single studio-wide record. Every notification respects this
     *  window unless the row is marked critical AND the "critical
     *  bypasses quiet hours" toggle is on. */
    notificationDeliverySettings: NotificationDeliverySettings;
    updateNotificationDeliverySettings: (patch: Partial<NotificationDeliverySettings>) => void;

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
    /** Save the "Reward rules & limits" side-panel modal. Covers the
     *  Who-earns-what + Rewards-unlock + Caps&Limits sections. */
    updateReferralRewards: (patch: Partial<Pick<ReferralSettings,
        | "referrerEarnType"   | "referrerEarnAmount"
        | "friendEarnType"     | "friendEarnAmount"
        | "rewardUnlockTrigger"
        | "maxReferralsPerMember"
        | "earnedRewardExpiryDays"
        | "monthlyProgramBudgetAed"
    >>) => void;
    /** Save the "Eligibility & fraud controls" side-panel modal. */
    updateReferralEligibility: (patch: Partial<Pick<ReferralSettings,
        | "preventSelfReferral"
        | "newCustomersOnly"
        | "minFirstSpendAed"
        | "creditsRedeemableAllBranches"
    >>) => void;
    /** Save the "Customize referral information" form — customer-facing
     *  Title + Description (rich HTML with variable tokens). */
    updateReferralInformation: (patch: Partial<Pick<ReferralSettings,
        "infoTitle" | "infoDescription"
    >>) => void;

    // ── Tax module (PRD 11 §10) ────────────────────────────────────────────
    /** Live tax rates — powers /admin/settings/tax → Tax rates list +
     *  (Phase 3) the "Apply tax rates" tab dropdowns. */
    taxRates: TaxRate[];
    /** Studio-wide tax display mode toggle. */
    taxSettings: TaxSettings;
    /** Flip the global "Prices include tax" toggle. */
    setPricesIncludeTax: (value: boolean) => void;
    /** Flip the per-line vs per-invoice rounding mode. Drives the POS +
     *  customer-checkout `computeTotals` calculation downstream. */
    setRoundingMode: (mode: TaxRoundingMode) => void;
    /** Set the studio's Tax Registration Number (TRN). Empty string
     *  clears the value back to undefined. */
    setTaxTrn: (value: string) => void;
    /** Set the country that issued the TRN. Full country name (matches
     *  `Country.name` in `src/lib/data/locales.ts`). */
    setTaxTrnCountry: (value: string) => void;
    /** Toggle whether the TRN prints on customer invoices + receipts. */
    setDisplayTrnOnInvoice: (value: boolean) => void;
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
     *  predefined categories (Membership / Package / Gift card /
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
    applyPurchase: (
        customerId: string,
        items: PurchaseLineItem[],
        paymentSource?: CustomerTransaction["paymentSource"],
        /** Explicit "Credited to" staff pick from POS/admin checkout — the
         *  staff who gets sales-commission credit for this sale. Required by
         *  the POS UI (no auto-cashier fallback). Ignored for customer-portal
         *  sales (self-service → unattributed). Commission refactor Phase 2. */
        sellerStaffId?: string,
        /** Account credit (AED) applied to this sale — the "Use my balance"
         *  toggle in POS + customer checkout. When > 0, the store debits the
         *  same amount from the customer's wallet ledger in the same tick, so
         *  the account balance stays consistent with what the receipt shows.
         *  Callers pass min(walletBalance, orderTotalPostDiscount) so the debit
         *  never exceeds the sale or the balance. */
        accountCreditAppliedAed?: number,
        /** v83 audit-1 (2026-07-29) — POS-selected sale branch. Membership /
         *  package flows default to the buyer's home branch (unchanged), but
         *  RETAIL lines MUST decrement stock at the physical branch that
         *  processed the sale, not the customer's home branch. Falsy →
         *  falls back to `buyer.branchId ?? DEFAULT_BRANCH_ID`. Only the
         *  retail-line stock loop reads this. */
        saleBranchIdOverride?: string,
        /** Gift-card debits (client 2026-07-31) — the per-card breakdown the
         *  caller got back from `redeemGiftCards`. Stamped onto the first
         *  sale transaction so `refundTransaction` can put each amount back
         *  on the exact card it came from. Omit when no gift card was used. */
        giftCardDebits?: { cardId: string; amountAed: number }[],
        /** Applied promotion (client 2026-08) — the code + resolved AED
         *  discount from the checkout's `validatePromoCode`. When present, the
         *  store stamps `discountCode` / `discountValue` on the sale
         *  transaction (feeding the Discounts + Promo Redemptions reports) and
         *  increments that promo's `usage_count` — the single write-path that
         *  makes a redemption real. Omit when no promo was applied. */
        promo?: { code: string; discountAed: number },
    ) => void;

    showToast: (title: string, message: string, type?: ToastData["type"], icon?: ToastData["icon"]) => void;
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
// `version: N` — bump this number when AppState changes shape in a
// breaking way OR when a seed-level constant the persisted state
// depends on changes (e.g. corrected permission templates). Zustand
// discards the old payload on mismatch and re-seeds from the mock
// files — acceptable for a demo (no migration logic needed; testers
// get fresh seed data after a deploy with schema changes).
//
// History
// • v1 — initial schema
// • v2 — corrected role permission matrices to match Figma
//        6618-158416..158420. Bumped so existing demo sessions pick
//        up the fixed Owner / Branch Admin / Operator matrices the
//        next time they load instead of carrying stale permissions
//        persisted at seed time.
//
// ── Cross-tab sync ────────────────────────────────────────────────
//
// The `window.storage` listener at the bottom of this file rehydrates
// the active tab's store whenever ANOTHER tab writes. Result: open
// admin in Tab A and instructor in Tab B — admin creates a class →
// instructor tab sees the new row instantly without a manual refresh.

// ─── Customer & Lead Management v83 — inline seeds (client 2026-07-24) ───
// Kept adjacent to the store constructor so a future Phase 6 editor can
// spot them in one place. The 10 lead sources come from PDF §4.1's list;
// the 6 follow-up stages come from PDF §4.2. `locked: true` marks the
// system defaults — the Settings UI (Phase 6) can rename them but not
// delete them. `isTerminal` on Won + Lost closes the funnel so the task
// engine can rely on them existing.
// v83 client 2026-07-27 — `locked` + `isTerminal` retired. All rows are
// freely rename/delete-able; the compute + task engine key off stable
// ids (stg_lost / stg_new / stg_contacted) so renames don't disturb the
// wiring. Deletion is only gated by the in-use check on the customers
// slice so we don't orphan `sourceId` / `followUpStatus` references.
const INITIAL_LEAD_SOURCES: LeadSource[] = [
    { id: "src_walkin",       label: "Walk-in"           },
    { id: "src_referral",     label: "Referral"          },
    { id: "src_instagram",    label: "Instagram / Social"},
    { id: "src_website",      label: "Website / Online"  },
    { id: "src_webform",      label: "Web form"          },
    { id: "src_meta_lead",    label: "Meta lead form"    },
    { id: "src_classpass",    label: "ClassPass"         },
    { id: "src_gympass",      label: "Gympass"           },
    { id: "src_expired",      label: "Expired customer"  },
    { id: "src_other",        label: "Other"             },
];
const INITIAL_FOLLOW_UP_STAGES: FollowUpStage[] = [
    { id: "stg_new",          label: "New"           },
    { id: "stg_contacted",    label: "Contacted"     },
    { id: "stg_trial_booked", label: "Trial booked"  },
    { id: "stg_follow_up",    label: "Follow-up"     },
    { id: "stg_won",          label: "Won"           },
    { id: "stg_lost",         label: "Lost"          },
];

// ─── v83 lifecycle showcase personas (client 2026-07-27) ────────────────
//
// Seven demo customers, one per lifecycle stage, so the client can walk
// through every pill / segment / task-engine surface without hand-
// building state. Injected alongside the main seed at boot; a matching
// idempotency guard in `onRehydrateStorage` prevents duplicates on
// version bumps. IDs are deterministic + prefixed with `cust_lc_` so
// they're easy to grep out later if we ship a real demo-reset flow.
//
// Compute reads (see src/lib/customer/lifecycle.ts):
//   • Churned   — no usable plan AND >30d since last visit
//   • At Risk   — usable plan AND (≥14d idle OR cancel-rate >50%/14d)
//   • Won-back  — usable plan AND ever-expired plan AND paid <30d ago
//   • New Active — paid plan <30 days old
//   • Loyal     — paid plan >30 days old + ≥4 attended in 30d
//   • Trialist  — only intro plan, no paid
//   • Lead      — no plan, no attendance (fallback)

const LC_BRANCH = "branch_forma_south";

/** ISO string for `d` days ago (positive = past). Kept as a helper so
 *  the persona builders read like a story instead of a timestamp arith
 *  soup. */
function daysAgoISO(d: number): string {
    return new Date(Date.now() - d * 86_400_000).toISOString();
}
function daysAgoISODate(d: number): string {
    return daysAgoISO(d).slice(0, 10);
}

// Client 2026-07-27 — showcase personas reuse the 5 existing customer
// portraits (rotated) so the profile header + list avatar aren't a plain
// gray "SN" tile on demo day. Non-matching (7th, 8th) fall back to the
// hand-authored Bosa image so all 8 personas render with a face.
const LC_PORTRAITS = [
    "/images/customers/ahmed-zayn.webp",
    "/images/customers/ava-wright.webp",
    "/images/customers/bosa-ahmed.webp",
    "/images/customers/rosale-martin.webp",
    "/images/customers/zahra-mahen.webp",
];
const SHOWCASE_CUSTOMERS: Customer[] = [
    // 1. LEAD — no plan, no bookings, no visits.
    {
        id: "cust_lc_lead", firstName: "Sofia", lastName: "Reyes", initials: "SR",
        email: "sofia.reyes@onradmo.test", phone: "+971 50 999 0001",
        imageUrl: LC_PORTRAITS[1],
        branchId: LC_BRANCH, planKind: null,
        createdAt: daysAgoISO(3), status: "active",
        gender: "Female", sourceId: "src_instagram", marketingSource: "Instagram / Social",
    },
    // 2. TRIALIST — complimentary plan + one recent attended booking.
    {
        id: "cust_lc_trialist", firstName: "Marco", lastName: "Silva", initials: "MS",
        email: "marco.silva@onradmo.test", phone: "+971 50 999 0002",
        imageUrl: LC_PORTRAITS[0],
        branchId: LC_BRANCH, planKind: null,
        createdAt: daysAgoISO(10), status: "active",
        gender: "Male", sourceId: "src_referral", marketingSource: "Referral",
        firstVisitISO: daysAgoISODate(4), lastVisitISO: daysAgoISODate(4),
    },
    // 3. NEW ACTIVE — paid membership 10 days ago + 2 attended.
    {
        id: "cust_lc_new_active", firstName: "Aisha", lastName: "Kumar", initials: "AK",
        email: "aisha.kumar@onradmo.test", phone: "+971 50 999 0003",
        imageUrl: LC_PORTRAITS[4],
        branchId: LC_BRANCH, planKind: "membership",
        createdAt: daysAgoISO(12), status: "active",
        gender: "Female", sourceId: "src_website", marketingSource: "Website / Online",
        firstVisitISO: daysAgoISODate(8), lastVisitISO: daysAgoISODate(2),
    },
    // 4. LOYAL ACTIVE — membership 60 days ago + 6 attended in last 30d.
    {
        id: "cust_lc_loyal", firstName: "David", lastName: "Chen", initials: "DC",
        email: "david.chen@onradmo.test", phone: "+971 50 999 0004",
        imageUrl: LC_PORTRAITS[2],
        branchId: LC_BRANCH, planKind: "membership",
        createdAt: daysAgoISO(90), status: "active",
        gender: "Male", sourceId: "src_walkin", marketingSource: "Walk-in",
        firstVisitISO: daysAgoISODate(88), lastVisitISO: daysAgoISODate(1),
    },
    // 5. AT RISK — active plan but 20 days since last visit.
    {
        id: "cust_lc_at_risk", firstName: "Priya", lastName: "Patel", initials: "PP",
        email: "priya.patel@onradmo.test", phone: "+971 50 999 0005",
        imageUrl: LC_PORTRAITS[3],
        branchId: LC_BRANCH, planKind: "membership",
        createdAt: daysAgoISO(120), status: "active",
        gender: "Female", sourceId: "src_referral", marketingSource: "Referral",
        firstVisitISO: daysAgoISODate(115), lastVisitISO: daysAgoISODate(22),
    },
    // 6. CHURNED — no active plan + no visit 60+ days.
    {
        id: "cust_lc_churned", firstName: "Lucas", lastName: "Grant", initials: "LG",
        email: "lucas.grant@onradmo.test", phone: "+971 50 999 0006",
        imageUrl: LC_PORTRAITS[0],
        branchId: LC_BRANCH, planKind: null,
        createdAt: daysAgoISO(200), status: "active",
        gender: "Male", sourceId: "src_classpass", marketingSource: "ClassPass",
        firstVisitISO: daysAgoISODate(195), lastVisitISO: daysAgoISODate(75),
    },
    // 7. WON-BACK — active plan 15d ago + a previously-expired plan on record.
    {
        id: "cust_lc_wonback", firstName: "Emily", lastName: "Zhang", initials: "EZ",
        email: "emily.zhang@onradmo.test", phone: "+971 50 999 0007",
        imageUrl: LC_PORTRAITS[4],
        branchId: LC_BRANCH, planKind: "membership",
        createdAt: daysAgoISO(240), status: "active",
        gender: "Female", sourceId: "src_expired", marketingSource: "Expired customer",
        firstVisitISO: daysAgoISODate(235), lastVisitISO: daysAgoISODate(6),
    },
    // BONUS — VIP flag on Loyal Active persona.
    {
        id: "cust_lc_vip", firstName: "Nadia", lastName: "Al-Rashid", initials: "NA",
        email: "nadia.alrashid@onradmo.test", phone: "+971 50 999 0008",
        imageUrl: LC_PORTRAITS[1],
        branchId: LC_BRANCH, planKind: "membership",
        createdAt: daysAgoISO(180), status: "active",
        gender: "Female", isVip: true,
        sourceId: "src_referral", marketingSource: "Referral",
        firstVisitISO: daysAgoISODate(175), lastVisitISO: daysAgoISODate(1),
    },
];

const SHOWCASE_PLANS: CustomerPlan[] = [
    // Trialist — 3-credit intro package.
    {
        id: "cp_lc_trialist", customerId: "cust_lc_trialist",
        kind: "package", name: "Intro 3-pack",
        planTypeLabel: "Package", creditsLabel: "3 credits",
        status: "active",
        purchasedAtISO: daysAgoISODate(5), expiryISO: daysAgoISODate(-25),
        totalCredits: 3, creditsUsed: 1,
    },
    // New Active — package purchased 10 days ago.
    {
        id: "cp_lc_new_active", customerId: "cust_lc_new_active",
        kind: "package", name: "10-class package",
        planTypeLabel: "Package", creditsLabel: "10 credits",
        status: "active",
        purchasedAtISO: daysAgoISODate(10), expiryISO: daysAgoISODate(-80),
        totalCredits: 10, creditsUsed: 2, priceAed: 800,
    },
    // Loyal — membership purchased 60 days ago.
    {
        id: "cp_lc_loyal", customerId: "cust_lc_loyal",
        kind: "membership", name: "Unlimited Monthly",
        planTypeLabel: "Membership", creditsLabel: "Unlimited",
        status: "active",
        purchasedAtISO: daysAgoISODate(60), expiryISO: daysAgoISODate(-30),
        priceAed: 1200,
    },
    // At Risk — active membership purchased 40 days ago.
    {
        id: "cp_lc_at_risk", customerId: "cust_lc_at_risk",
        kind: "membership", name: "Unlimited Monthly",
        planTypeLabel: "Membership", creditsLabel: "Unlimited",
        status: "active",
        purchasedAtISO: daysAgoISODate(40), expiryISO: daysAgoISODate(-10),
        priceAed: 1200,
    },
    // Churned — an OLD expired package (needed to distinguish Churned
    // from Lead — Churned requires a paid history).
    {
        id: "cp_lc_churned", customerId: "cust_lc_churned",
        kind: "package", name: "10-class package",
        planTypeLabel: "Package", creditsLabel: "10 credits",
        status: "expired",
        purchasedAtISO: daysAgoISODate(150), expiryISO: daysAgoISODate(60),
        totalCredits: 10, creditsUsed: 10, priceAed: 800,
    },
    // Won-back — fresh membership + expired one on record.
    {
        id: "cp_lc_wonback_new", customerId: "cust_lc_wonback",
        kind: "membership", name: "Unlimited Monthly",
        planTypeLabel: "Membership", creditsLabel: "Unlimited",
        status: "active",
        purchasedAtISO: daysAgoISODate(15), expiryISO: daysAgoISODate(-15),
        priceAed: 1200,
    },
    {
        id: "cp_lc_wonback_old", customerId: "cust_lc_wonback",
        kind: "membership", name: "Unlimited Monthly",
        planTypeLabel: "Membership", creditsLabel: "Unlimited",
        status: "expired",
        purchasedAtISO: daysAgoISODate(180), expiryISO: daysAgoISODate(150),
        priceAed: 1200,
    },
    // VIP — same membership pattern as Loyal.
    {
        id: "cp_lc_vip", customerId: "cust_lc_vip",
        kind: "membership", name: "Unlimited Monthly",
        planTypeLabel: "Membership", creditsLabel: "Unlimited",
        status: "active",
        purchasedAtISO: daysAgoISODate(90), expiryISO: daysAgoISODate(-60),
        priceAed: 1200,
    },
];

/** Build 6 attended bookings for the loyal + VIP personas spread over
 *  the last 30 days so the compute's "≥4 attended in last 30d" branch
 *  matches. */
function buildShowcaseBookings(): ClassBooking[] {
    const rows: ClassBooking[] = [];
    const push = (
        cid: string,
        daysAgo: number,
        status: ClassBooking["status"],
        attendance: ClassBooking["attendanceStatus"],
    ) => {
        rows.push({
            id: `bk_lc_${cid}_${daysAgo}`,
            classScheduleId: "sc_lc_showcase",
            customerId: cid,
            branchId: LC_BRANCH,
            status,
            attendanceStatus: attendance,
            bookingTime: daysAgoISO(daysAgo),
            spot: "1",
            planId: "",
            planName: "",
        });
    };
    // Trialist — 1 attended booking 4 days ago.
    push("cust_lc_trialist", 4, "booked", "present");
    // New Active — 2 attended bookings recent.
    push("cust_lc_new_active", 2, "booked", "present");
    push("cust_lc_new_active", 8, "booked", "present");
    // Loyal — 6 attended in last 30 days.
    for (const d of [1, 5, 10, 15, 22, 28]) {
        push("cust_lc_loyal", d, "booked", "present");
    }
    // At Risk — attended once ages ago, then radio silence.
    push("cust_lc_at_risk", 22, "booked", "present");
    // Churned — old attended history.
    push("cust_lc_churned", 75, "booked", "present");
    push("cust_lc_churned", 90, "booked", "present");
    // Won-back — 3 attended in last 15 days since fresh plan.
    push("cust_lc_wonback", 6, "booked", "present");
    push("cust_lc_wonback", 11, "booked", "present");
    push("cust_lc_wonback", 14, "booked", "present");
    // VIP — 6 attended in last 30 days (Loyal-Active-with-VIP-flag).
    for (const d of [1, 4, 9, 14, 20, 27]) {
        push("cust_lc_vip", d, "booked", "present");
    }
    return rows;
}
const SHOWCASE_BOOKINGS: ClassBooking[] = buildShowcaseBookings();

// ─────────────────────────────────────────────────────────────────────────────
// Follow-up showcase (client 2026-08-05)
// ─────────────────────────────────────────────────────────────────────────────
//
// A named set of leads / lapsed trialists whose REAL state trips the follow-up
// task engine, so the Follow-ups tab + "Leads to follow up" widget show a
// genuine, varied list on a fresh demo — spanning all 3 auto-detected triggers,
// across multiple people, not one. Nothing here is a hand-authored task: the
// tasks are generated by `generateSeedFollowUpTasks` from this customer data.
//
// Each archetype is tuned to the engine's real rules (see follow-up-tasks.ts /
// lifecycle.ts):
//   • Lead (lead_form_submitted): no plan, no booking, but a recent visit so
//     the lifecycle tags them Lead (never-visited would be Churned → excluded).
//   • Trialist (trial_no_rebook_7d): a COMPLIMENTARY plan only (a package would
//     count as "paid" and disqualify), one attended class 9–12 days ago, last
//     visit <14d so they stay Trialist (not At Risk).
//   • Lead (first_booking_cancelled): first + only booking cancelled, recent
//     visit so they tag Lead.
function buildFollowUpShowcase(): {
    customers: Customer[];
    plans: CustomerPlan[];
    bookings: ClassBooking[];
} {
    const customers: Customer[] = [];
    const plans: CustomerPlan[] = [];
    const bookings: ClassBooking[] = [];

    // ── Leads — "New lead from {source} — reach out." ────────────────────────
    const leads: Array<[string, string, string, string, string, number, number]> = [
        // id, first, last, sourceId, marketingSource, createdDaysAgo, lastVisitDaysAgo
        ["cust_fu_lead_1", "Layla",  "Haddad",  "src_instagram", "Instagram / Social", 3, 2],
        ["cust_fu_lead_2", "Omar",   "Farouk",  "src_website",   "Website / Online",   5, 4],
        ["cust_fu_lead_3", "Nadia",  "Rahman",  "src_walkin",    "Walk-in",            2, 1],
    ];
    leads.forEach(([id, first, last, sourceId, marketingSource, created, lastVisit], i) => {
        customers.push({
            id, firstName: first, lastName: last, initials: `${first[0]}${last[0]}`,
            email: `${first}.${last}@onradmo.test`.toLowerCase(),
            phone: `+971 50 991 10${i + 1}`,
            imageUrl: LC_PORTRAITS[i % LC_PORTRAITS.length],
            branchId: LC_BRANCH, planKind: null,
            createdAt: daysAgoISO(created), status: "active",
            gender: i % 2 === 0 ? "Female" : "Male",
            sourceId, marketingSource,
            firstVisitISO: daysAgoISODate(lastVisit), lastVisitISO: daysAgoISODate(lastVisit),
        });
    });

    // ── Lapsed trialists — "{name} did a trial and hasn't returned." ─────────
    const trialists: Array<[string, string, string, string, number, number]> = [
        // id, first, last, sourceId, attendedDaysAgo, planPurchasedDaysAgo
        ["cust_fu_trial_1", "Yusuf", "Karim",  "src_referral",  9,  14],
        ["cust_fu_trial_2", "Hana",  "Saleh",  "src_instagram", 11, 15],
        ["cust_fu_trial_3", "Bilal", "Osman",  "src_website",   12, 16],
    ];
    trialists.forEach(([id, first, last, sourceId, attended, purchased], i) => {
        customers.push({
            id, firstName: first, lastName: last, initials: `${first[0]}${last[0]}`,
            email: `${first}.${last}@onradmo.test`.toLowerCase(),
            phone: `+971 50 992 20${i + 1}`,
            imageUrl: LC_PORTRAITS[(i + 1) % LC_PORTRAITS.length],
            branchId: LC_BRANCH, planKind: null,
            createdAt: daysAgoISO(purchased + 1), status: "active",
            gender: i % 2 === 0 ? "Male" : "Female",
            sourceId, marketingSource: "Referral",
            firstVisitISO: daysAgoISODate(attended), lastVisitISO: daysAgoISODate(attended),
        });
        plans.push({
            id: `cp_${id}`, customerId: id,
            kind: "complimentary", name: "Free trial credit",
            planTypeLabel: "Free credit", creditsLabel: "1 credit",
            status: "active",
            purchasedAtISO: daysAgoISODate(purchased), expiryISO: daysAgoISODate(-14),
            totalCredits: 1, creditsUsed: 1,
        });
        bookings.push({
            id: `bk_${id}_attended`, classScheduleId: "sc_lc_showcase",
            customerId: id, branchId: LC_BRANCH,
            status: "booked", attendanceStatus: "present",
            bookingTime: daysAgoISO(attended), spot: "1", planId: "", planName: "",
        });
    });

    // ── Cancelled first class — "{name} cancelled their first class." ────────
    const cancels: Array<[string, string, string, string, number, number]> = [
        // id, first, last, sourceId, cancelledDaysAgo, lastVisitDaysAgo
        ["cust_fu_cancel_1", "Rania", "Aziz",    "src_classpass", 5, 6],
        ["cust_fu_cancel_2", "Tariq", "Mansour", "src_walkin",    4, 5],
    ];
    cancels.forEach(([id, first, last, sourceId, cancelled, lastVisit], i) => {
        customers.push({
            id, firstName: first, lastName: last, initials: `${first[0]}${last[0]}`,
            email: `${first}.${last}@onradmo.test`.toLowerCase(),
            phone: `+971 50 993 30${i + 1}`,
            imageUrl: LC_PORTRAITS[(i + 2) % LC_PORTRAITS.length],
            branchId: LC_BRANCH, planKind: null,
            createdAt: daysAgoISO(lastVisit + 1), status: "active",
            gender: i % 2 === 0 ? "Female" : "Male",
            sourceId, marketingSource: "Walk-in",
            firstVisitISO: daysAgoISODate(lastVisit), lastVisitISO: daysAgoISODate(lastVisit),
        });
        bookings.push({
            id: `bk_${id}_cancelled`, classScheduleId: "sc_lc_showcase",
            customerId: id, branchId: LC_BRANCH,
            status: "cancelled", attendanceStatus: "late_cancel",
            bookingTime: daysAgoISO(cancelled), spot: "1", planId: "", planName: "",
        });
    });

    return { customers, plans, bookings };
}
const FOLLOWUP_SHOWCASE = buildFollowUpShowcase();

const SHOWCASE_TRANSACTIONS: CustomerTransaction[] = [
    {
        id: "txn_lc_new_active", customerId: "cust_lc_new_active", branchId: LC_BRANCH,
        kind: "package", productId: "cp_lc_new_active", name: "10-class package",
        amountAed: 800, status: "complete", paymentMethod: "card",
        createdAtISO: daysAgoISO(10), transactionType: "sale", isRefundable: true,
    },
    {
        id: "txn_lc_loyal", customerId: "cust_lc_loyal", branchId: LC_BRANCH,
        kind: "membership", productId: "cp_lc_loyal", name: "Unlimited Monthly",
        amountAed: 1200, status: "complete", paymentMethod: "card",
        createdAtISO: daysAgoISO(60), transactionType: "sale", isRefundable: true,
    },
    {
        id: "txn_lc_at_risk", customerId: "cust_lc_at_risk", branchId: LC_BRANCH,
        kind: "membership", productId: "cp_lc_at_risk", name: "Unlimited Monthly",
        amountAed: 1200, status: "complete", paymentMethod: "card",
        createdAtISO: daysAgoISO(40), transactionType: "sale", isRefundable: true,
    },
    {
        id: "txn_lc_churned_old", customerId: "cust_lc_churned", branchId: LC_BRANCH,
        kind: "package", productId: "cp_lc_churned", name: "10-class package",
        amountAed: 800, status: "complete", paymentMethod: "card",
        createdAtISO: daysAgoISO(150), transactionType: "sale", isRefundable: true,
    },
    {
        id: "txn_lc_wonback_new", customerId: "cust_lc_wonback", branchId: LC_BRANCH,
        kind: "membership", productId: "cp_lc_wonback_new", name: "Unlimited Monthly",
        amountAed: 1200, status: "complete", paymentMethod: "card",
        createdAtISO: daysAgoISO(15), transactionType: "sale", isRefundable: true,
    },
    {
        id: "txn_lc_wonback_old", customerId: "cust_lc_wonback", branchId: LC_BRANCH,
        kind: "membership", productId: "cp_lc_wonback_old", name: "Unlimited Monthly",
        amountAed: 1200, status: "complete", paymentMethod: "card",
        createdAtISO: daysAgoISO(180), transactionType: "sale", isRefundable: true,
    },
    {
        id: "txn_lc_vip", customerId: "cust_lc_vip", branchId: LC_BRANCH,
        kind: "membership", productId: "cp_lc_vip", name: "Unlimited Monthly",
        amountAed: 1200, status: "complete", paymentMethod: "card",
        createdAtISO: daysAgoISO(90), transactionType: "sale", isRefundable: true,
    },
];

// ─── Bulk-generated lifecycle-stage demo customers (client 2026-07-27) ──
//
// The 7 hand-authored personas above give each stage ONE showcase row.
// This block generates ~4 more per stage (28 total) so the segment tabs
// + Lifecycle filter chips have real volume to play with and the client
// can slice/dice a populated list. Every generated persona carries the
// minimum data its target stage needs (plan, transaction, bookings)
// alongside varied source / branch / assigned-to values so the profile
// details block reads different for each.
//
// Idempotency comes from deterministic ids (`cust_lcg_<stage>_<i>`); the
// same rehydrate guard we use for the showcase personas skips these
// too when a state already has them.

type ShowcaseSeed = { firstName: string; lastName: string; sourceId: string; sourceLabel: string };
const LC_BULK_NAMES: ShowcaseSeed[] = [
    // 4 seeds each for the 7 stages, cycling deterministically below.
    { firstName: "Fatima",   lastName: "Hassan",  sourceId: "src_instagram", sourceLabel: "Instagram / Social" },
    { firstName: "Omar",     lastName: "Nasser",  sourceId: "src_referral",  sourceLabel: "Referral"          },
    { firstName: "Layla",    lastName: "Ibrahim", sourceId: "src_website",   sourceLabel: "Website / Online"   },
    { firstName: "Ryan",     lastName: "Novak",   sourceId: "src_walkin",    sourceLabel: "Walk-in"            },
    { firstName: "Yara",     lastName: "Faris",   sourceId: "src_referral",  sourceLabel: "Referral"           },
    { firstName: "Ethan",    lastName: "Marlow",  sourceId: "src_meta_lead", sourceLabel: "Meta lead form"     },
    { firstName: "Zara",     lastName: "Khan",    sourceId: "src_instagram", sourceLabel: "Instagram / Social" },
    { firstName: "Noah",     lastName: "Bennett", sourceId: "src_gympass",   sourceLabel: "Gympass"            },
    { firstName: "Amira",    lastName: "Saleh",   sourceId: "src_walkin",    sourceLabel: "Walk-in"            },
    { firstName: "Kai",      lastName: "Turner",  sourceId: "src_classpass", sourceLabel: "ClassPass"          },
    { firstName: "Maya",     lastName: "Farid",   sourceId: "src_referral",  sourceLabel: "Referral"           },
    { firstName: "Ali",      lastName: "Rahim",   sourceId: "src_website",   sourceLabel: "Website / Online"   },
    { firstName: "Sara",     lastName: "Habib",   sourceId: "src_expired",   sourceLabel: "Expired customer"   },
    { firstName: "Jonah",    lastName: "Petit",   sourceId: "src_webform",   sourceLabel: "Web form"           },
    { firstName: "Rania",    lastName: "Kader",   sourceId: "src_meta_lead", sourceLabel: "Meta lead form"     },
    { firstName: "Elias",    lastName: "Hamid",   sourceId: "src_walkin",    sourceLabel: "Walk-in"            },
    { firstName: "Bianca",   lastName: "Reyes",   sourceId: "src_referral",  sourceLabel: "Referral"           },
    { firstName: "Karim",    lastName: "Youssef", sourceId: "src_instagram", sourceLabel: "Instagram / Social" },
    { firstName: "Talia",    lastName: "Mansour", sourceId: "src_website",   sourceLabel: "Website / Online"   },
    { firstName: "Dev",      lastName: "Iyer",    sourceId: "src_classpass", sourceLabel: "ClassPass"          },
    { firstName: "Nora",     lastName: "Amin",    sourceId: "src_webform",   sourceLabel: "Web form"           },
    { firstName: "Faisal",   lastName: "Quadri",  sourceId: "src_walkin",    sourceLabel: "Walk-in"            },
    { firstName: "Isabelle", lastName: "Vance",   sourceId: "src_referral",  sourceLabel: "Referral"           },
    { firstName: "Miguel",   lastName: "Costa",   sourceId: "src_instagram", sourceLabel: "Instagram / Social" },
    { firstName: "Lena",     lastName: "Brandt",  sourceId: "src_gympass",   sourceLabel: "Gympass"            },
    { firstName: "Nikhil",   lastName: "Rao",     sourceId: "src_website",   sourceLabel: "Website / Online"   },
    { firstName: "Sanaa",    lastName: "El-Din",  sourceId: "src_meta_lead", sourceLabel: "Meta lead form"     },
    { firstName: "Tom",      lastName: "Gallo",   sourceId: "src_expired",   sourceLabel: "Expired customer"   },
];

/** Stage-specific data blueprint used by the bulk generator. Small
 *  functions return the deltas the compute needs for each stage. */
type LifecycleStage = "lead" | "trialist" | "new_active" | "loyal" | "at_risk" | "churned" | "wonback";
const BULK_STAGES: LifecycleStage[] = ["lead", "trialist", "new_active", "loyal", "at_risk", "churned", "wonback"];
const BULK_PER_STAGE = 4;

/** Build the bulk customer + plan + booking + transaction rows so all
 *  four sinks stay in sync. Purely deterministic — same inputs, same
 *  ids every render. */
function buildBulkShowcase(): {
    customers: Customer[];
    plans: CustomerPlan[];
    bookings: ClassBooking[];
    transactions: CustomerTransaction[];
} {
    const customers: Customer[] = [];
    const plans: CustomerPlan[] = [];
    const bookings: ClassBooking[] = [];
    const transactions: CustomerTransaction[] = [];
    let seedIdx = 0;
    for (const stage of BULK_STAGES) {
        for (let i = 0; i < BULK_PER_STAGE; i++) {
            const seed = LC_BULK_NAMES[seedIdx++ % LC_BULK_NAMES.length];
            const cid = `cust_lcg_${stage}_${i + 1}`;
            const initials = `${seed.firstName[0]}${seed.lastName[0]}`.toUpperCase();
            // Base customer row — stage-specific patches append below.
            // Client 2026-07-27 — cycle through the 5 existing portraits
            // so bulk rows in the customer table render with real faces,
            // not a wall of "AB" gray tiles.
            const base: Customer = {
                id: cid, firstName: seed.firstName, lastName: seed.lastName, initials,
                email: `${seed.firstName.toLowerCase()}.${seed.lastName.toLowerCase().replace(/[^a-z]/g, "")}${i}@onradmo.test`,
                phone: `+971 50 ${(700 + seedIdx).toString().padStart(3, "0")} ${(1000 + seedIdx).toString().padStart(4, "0")}`,
                imageUrl: LC_PORTRAITS[seedIdx % LC_PORTRAITS.length],
                branchId: LC_BRANCH, planKind: null,
                createdAt: daysAgoISO(20 + seedIdx),
                status: "active",
                gender: seedIdx % 2 === 0 ? "Female" : "Male",
                sourceId: seed.sourceId, marketingSource: seed.sourceLabel,
            };
            switch (stage) {
                case "lead":
                    customers.push(base);
                    break;
                case "trialist": {
                    const purchasedAt = 5 + i;
                    const attendedAt = 3 + i;
                    customers.push({
                        ...base,
                        firstVisitISO: daysAgoISODate(attendedAt),
                        lastVisitISO: daysAgoISODate(attendedAt),
                    });
                    plans.push({
                        id: `cp_lcg_${stage}_${i + 1}`, customerId: cid,
                        kind: "package", name: "Intro 3-pack",
                        planTypeLabel: "Package", creditsLabel: "3 credits",
                        status: "active",
                        purchasedAtISO: daysAgoISODate(purchasedAt),
                        expiryISO: daysAgoISODate(-25 - i),
                        totalCredits: 3, creditsUsed: 1,
                    });
                    bookings.push({
                        id: `bk_lcg_${stage}_${i + 1}_1`, classScheduleId: "sc_lc_showcase",
                        customerId: cid, branchId: LC_BRANCH,
                        status: "booked", attendanceStatus: "present",
                        bookingTime: daysAgoISO(attendedAt), spot: "1",
                        planId: "", planName: "",
                    });
                    break;
                }
                case "new_active": {
                    const purchasedAt = 8 + i * 3; // stays <30 for New Active
                    customers.push({
                        ...base, planKind: "membership",
                        firstVisitISO: daysAgoISODate(purchasedAt),
                        lastVisitISO: daysAgoISODate(2 + i),
                    });
                    plans.push({
                        id: `cp_lcg_${stage}_${i + 1}`, customerId: cid,
                        kind: "membership", name: "Unlimited Monthly",
                        planTypeLabel: "Membership", creditsLabel: "Unlimited",
                        status: "active",
                        purchasedAtISO: daysAgoISODate(purchasedAt),
                        expiryISO: daysAgoISODate(-30 + purchasedAt),
                        priceAed: 1200,
                    });
                    transactions.push({
                        id: `txn_lcg_${stage}_${i + 1}`, customerId: cid, branchId: LC_BRANCH,
                        kind: "membership", productId: `cp_lcg_${stage}_${i + 1}`,
                        name: "Unlimited Monthly", amountAed: 1200,
                        status: "complete", paymentMethod: "card",
                        createdAtISO: daysAgoISO(purchasedAt),
                        transactionType: "sale", isRefundable: true,
                    });
                    bookings.push(
                        { id: `bk_lcg_${stage}_${i + 1}_1`, classScheduleId: "sc_lc_showcase", customerId: cid, branchId: LC_BRANCH, status: "booked", attendanceStatus: "present", bookingTime: daysAgoISO(2 + i), spot: "1", planId: "", planName: "" },
                        { id: `bk_lcg_${stage}_${i + 1}_2`, classScheduleId: "sc_lc_showcase", customerId: cid, branchId: LC_BRANCH, status: "booked", attendanceStatus: "present", bookingTime: daysAgoISO(5 + i), spot: "1", planId: "", planName: "" },
                    );
                    break;
                }
                case "loyal": {
                    const purchasedAt = 60 + i * 15;
                    customers.push({
                        ...base, planKind: "membership",
                        firstVisitISO: daysAgoISODate(purchasedAt - 2),
                        lastVisitISO: daysAgoISODate(1 + i),
                    });
                    plans.push({
                        id: `cp_lcg_${stage}_${i + 1}`, customerId: cid,
                        kind: "membership", name: "Unlimited Monthly",
                        planTypeLabel: "Membership", creditsLabel: "Unlimited",
                        status: "active",
                        purchasedAtISO: daysAgoISODate(purchasedAt),
                        expiryISO: daysAgoISODate(-30),
                        priceAed: 1200,
                    });
                    transactions.push({
                        id: `txn_lcg_${stage}_${i + 1}`, customerId: cid, branchId: LC_BRANCH,
                        kind: "membership", productId: `cp_lcg_${stage}_${i + 1}`,
                        name: "Unlimited Monthly", amountAed: 1200,
                        status: "complete", paymentMethod: "card",
                        createdAtISO: daysAgoISO(purchasedAt),
                        transactionType: "sale", isRefundable: true,
                    });
                    // 6 attended bookings in last 30 days → Loyal Active branch.
                    for (const d of [1, 5, 9, 15, 22, 28]) {
                        bookings.push({
                            id: `bk_lcg_${stage}_${i + 1}_${d}`, classScheduleId: "sc_lc_showcase",
                            customerId: cid, branchId: LC_BRANCH,
                            status: "booked", attendanceStatus: "present",
                            bookingTime: daysAgoISO(d + i), spot: "1",
                            planId: "", planName: "",
                        });
                    }
                    break;
                }
                case "at_risk": {
                    const purchasedAt = 45 + i * 5;
                    const lastVisit = 18 + i;
                    customers.push({
                        ...base, planKind: "membership",
                        firstVisitISO: daysAgoISODate(purchasedAt - 2),
                        lastVisitISO: daysAgoISODate(lastVisit),
                    });
                    plans.push({
                        id: `cp_lcg_${stage}_${i + 1}`, customerId: cid,
                        kind: "membership", name: "Unlimited Monthly",
                        planTypeLabel: "Membership", creditsLabel: "Unlimited",
                        status: "active",
                        purchasedAtISO: daysAgoISODate(purchasedAt),
                        expiryISO: daysAgoISODate(-15),
                        priceAed: 1200,
                    });
                    transactions.push({
                        id: `txn_lcg_${stage}_${i + 1}`, customerId: cid, branchId: LC_BRANCH,
                        kind: "membership", productId: `cp_lcg_${stage}_${i + 1}`,
                        name: "Unlimited Monthly", amountAed: 1200,
                        status: "complete", paymentMethod: "card",
                        createdAtISO: daysAgoISO(purchasedAt),
                        transactionType: "sale", isRefundable: true,
                    });
                    bookings.push({
                        id: `bk_lcg_${stage}_${i + 1}_last`, classScheduleId: "sc_lc_showcase",
                        customerId: cid, branchId: LC_BRANCH,
                        status: "booked", attendanceStatus: "present",
                        bookingTime: daysAgoISO(lastVisit), spot: "1",
                        planId: "", planName: "",
                    });
                    break;
                }
                case "churned": {
                    const purchasedAt = 150 + i * 10;
                    const lastVisit = 70 + i * 5;
                    customers.push({
                        ...base,
                        firstVisitISO: daysAgoISODate(purchasedAt - 3),
                        lastVisitISO: daysAgoISODate(lastVisit),
                    });
                    plans.push({
                        id: `cp_lcg_${stage}_${i + 1}`, customerId: cid,
                        kind: "package", name: "10-class package",
                        planTypeLabel: "Package", creditsLabel: "10 credits",
                        status: "expired",
                        purchasedAtISO: daysAgoISODate(purchasedAt),
                        expiryISO: daysAgoISODate(lastVisit + 20),
                        totalCredits: 10, creditsUsed: 10, priceAed: 800,
                    });
                    transactions.push({
                        id: `txn_lcg_${stage}_${i + 1}`, customerId: cid, branchId: LC_BRANCH,
                        kind: "package", productId: `cp_lcg_${stage}_${i + 1}`,
                        name: "10-class package", amountAed: 800,
                        status: "complete", paymentMethod: "card",
                        createdAtISO: daysAgoISO(purchasedAt),
                        transactionType: "sale", isRefundable: true,
                    });
                    break;
                }
                case "wonback": {
                    const oldPurchase = 180 + i * 10;
                    const newPurchase = 12 + i * 3;
                    customers.push({
                        ...base, planKind: "membership",
                        firstVisitISO: daysAgoISODate(oldPurchase - 2),
                        lastVisitISO: daysAgoISODate(3 + i),
                    });
                    plans.push(
                        {
                            id: `cp_lcg_${stage}_${i + 1}_new`, customerId: cid,
                            kind: "membership", name: "Unlimited Monthly",
                            planTypeLabel: "Membership", creditsLabel: "Unlimited",
                            status: "active",
                            purchasedAtISO: daysAgoISODate(newPurchase),
                            expiryISO: daysAgoISODate(-15),
                            priceAed: 1200,
                        },
                        {
                            id: `cp_lcg_${stage}_${i + 1}_old`, customerId: cid,
                            kind: "membership", name: "Unlimited Monthly",
                            planTypeLabel: "Membership", creditsLabel: "Unlimited",
                            status: "expired",
                            purchasedAtISO: daysAgoISODate(oldPurchase),
                            expiryISO: daysAgoISODate(oldPurchase - 30),
                            priceAed: 1200,
                        },
                    );
                    transactions.push(
                        {
                            id: `txn_lcg_${stage}_${i + 1}_new`, customerId: cid, branchId: LC_BRANCH,
                            kind: "membership", productId: `cp_lcg_${stage}_${i + 1}_new`,
                            name: "Unlimited Monthly", amountAed: 1200,
                            status: "complete", paymentMethod: "card",
                            createdAtISO: daysAgoISO(newPurchase),
                            transactionType: "sale", isRefundable: true,
                        },
                        {
                            id: `txn_lcg_${stage}_${i + 1}_old`, customerId: cid, branchId: LC_BRANCH,
                            kind: "membership", productId: `cp_lcg_${stage}_${i + 1}_old`,
                            name: "Unlimited Monthly", amountAed: 1200,
                            status: "complete", paymentMethod: "card",
                            createdAtISO: daysAgoISO(oldPurchase),
                            transactionType: "sale", isRefundable: true,
                        },
                    );
                    bookings.push(
                        { id: `bk_lcg_${stage}_${i + 1}_1`, classScheduleId: "sc_lc_showcase", customerId: cid, branchId: LC_BRANCH, status: "booked", attendanceStatus: "present", bookingTime: daysAgoISO(3 + i), spot: "1", planId: "", planName: "" },
                        { id: `bk_lcg_${stage}_${i + 1}_2`, classScheduleId: "sc_lc_showcase", customerId: cid, branchId: LC_BRANCH, status: "booked", attendanceStatus: "present", bookingTime: daysAgoISO(9 + i), spot: "1", planId: "", planName: "" },
                    );
                    break;
                }
            }
        }
    }
    return { customers, plans, bookings, transactions };
}
const BULK_SHOWCASE = buildBulkShowcase();

// ─────────────────────────────────────────────────────────────────────────────
// Follow-up task seed backfill (client 2026-08-05)
// ─────────────────────────────────────────────────────────────────────────────
//
// The signal→task engine (generateFollowUpTasks) only fires as a side-effect of
// live writes (addBooking / cancelBooking / addLead / logEnquiry). Nothing runs
// it at boot, so a fresh demo used to open with an EMPTY Follow-ups tab + empty
// "Leads to follow up" dashboard widget — even though seeded leads / lapsed
// trialists genuinely qualify. The client couldn't tell which customer had a
// list without clicking every profile.
//
// This runs the SAME generator across every customer once at seed time, so the
// list is built by the real logic from the real customer state — no
// hand-authored task rows anywhere. Only the 3 state-derivable triggers are
// evaluated; `enquiry_logged` is intentionally excluded (it's a manual staff
// action, and with no `triggers` filter the generator would otherwise mint one
// for every lead). Idempotent — the generator dedupes against open tasks — and
// only ever invoked when the slice is empty, so a tester's own logged / closed
// tasks are never clobbered.
const SEED_FOLLOW_UP_TRIGGERS: FollowUpTaskTrigger[] = [
    "lead_form_submitted",
    "trial_no_rebook_7d",
    "first_booking_cancelled",
];

type FollowUpTaskState = Pick<
    AppState,
    "customers" | "classBookings" | "customerPlans" | "customerTransactions" | "followUpTasks" | "leadSources" | "followUpStages"
>;

export function generateSeedFollowUpTasks(state: FollowUpTaskState): FollowUpTask[] {
    let tasks: FollowUpTask[] = [...state.followUpTasks];
    for (const c of state.customers) {
        const fresh = generateFollowUpTasks(
            c.id,
            { ...state, followUpTasks: tasks },
            { triggers: SEED_FOLLOW_UP_TRIGGERS },
        );
        tasks = applyGeneratedTasks(tasks, fresh);
    }
    return tasks;
}

const PERSIST_KEY = "onra-demo-state";

// ─── Promo usage reconciliation (boot) ───────────────────────────────────────
// The Promo Redemptions report counts sale transactions carrying a
// `discountCode`; each promo's stored `usage_count` (admin list + detail +
// delete guard + usage-limit gate) must agree with that. Seed sale rows carry
// a real authored `discount_code` (see customer_transactions), so we count
// those here and stamp the matching total onto each promo — keeping the admin
// numbers, the guards, and the report in lock-step. Live POS / customer
// redemptions increment both sides together in `applyPurchase`.
const INITIAL_ALL_TRANSACTIONS: CustomerTransaction[] = [
    ...INITIAL_CUSTOMER_TRANSACTIONS, ...INITIAL_GIFT_CARD_SALE_TXNS,
    ...SHOWCASE_TRANSACTIONS, ...BULK_SHOWCASE.transactions,
];
const PROMO_USAGE_FROM_SEED: Record<string, number> = {};
for (const t of INITIAL_ALL_TRANSACTIONS) {
    if ((t.transactionType ?? "sale") === "sale" && t.discountCode) {
        PROMO_USAGE_FROM_SEED[t.discountCode] = (PROMO_USAGE_FROM_SEED[t.discountCode] ?? 0) + 1;
    }
}
const INITIAL_PROMO_CODES: PromoCode[] = SEED_PROMO_CODES.map(p => ({
    // Product-sale promos are counted from real transactions; promos with no
    // product-sale usage (e.g. class-booking codes like WEEKEND / RAMADAN, whose
    // redemptions aren't modelled as transactions) keep their seeded count — so
    // an active promo with documented usage never falls to 0 and become deletable.
    ...p, usage_count: PROMO_USAGE_FROM_SEED[p.code] ?? p.usage_count ?? 0,
}));

export const useAppStore = create<AppState>()(persist(
    (set, get) => ({
    currentRole: "admin",
    currentUser: adminUser,
    brandingSettings: { ...INITIAL_BRANDING_SETTINGS, menuItems: [...INITIAL_BRANDING_SETTINGS.menuItems] },
    businessProfile: {
        name: "Forma Studio",
        logoUrl: "",
        website: "forma.studio.com",
        // Seeded with realistic UAE values per the Figma 7619:39071
        // example. Both are optional in the form, so the admin can clear
        // them — but the centralized seed always has SOMETHING so the
        // Studio Profile detail view never shows a blank row on first
        // load.
        legalBusinessName: "Forma Wellness Studio Pte. Ltd.",
        tradeLicenseNumber: "TL-2026-014582",
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
    cancellationPolicy: {
        ...SEED_CANCELLATION_POLICY,
        // Deep-copy the reasons array so local edits in the panel don't
        // mutate the seed singleton (same pattern used for freezePolicies).
        cancellation_reasons: SEED_CANCELLATION_POLICY.cancellation_reasons.map(r => ({ ...r })),
    },
    freezePolicy: {
        ...SEED_FREEZE_POLICY,
        // Deep-copy so local panel edits don't mutate the seed singleton.
        reasons: SEED_FREEZE_POLICY.reasons.map(r => ({ ...r })),
        membership_ids: [...SEED_FREEZE_POLICY.membership_ids],
    },
    classCategories: SEED_CLASS_CATEGORIES.map(c => ({ ...c })),
    sidebarCollapsed: false,
    classTemplates: INITIAL_TEMPLATES,
    services: INITIAL_SERVICES,
    appointments: INITIAL_APPOINTMENTS,
    appointmentBookings: INITIAL_APPOINTMENT_BOOKINGS,
    appointmentRatings: INITIAL_APPOINTMENT_RATINGS,
    classSchedules: INITIAL_SCHEDULES,
    classBookings: [...INITIAL_BOOKINGS, ...SHOWCASE_BOOKINGS, ...FOLLOWUP_SHOWCASE.bookings, ...BULK_SHOWCASE.bookings],
    classRatings: INITIAL_RATINGS,
    customers: [...SHOWCASE_CUSTOMERS, ...FOLLOWUP_SHOWCASE.customers, ...BULK_SHOWCASE.customers, ...INITIAL_CUSTOMERS],
    customerPlans: [...INITIAL_CUSTOMER_PLANS, ...SHOWCASE_PLANS, ...FOLLOWUP_SHOWCASE.plans, ...BULK_SHOWCASE.plans],
    customerTransactions: [...INITIAL_ALL_TRANSACTIONS],
    customerAgreements: INITIAL_CUSTOMER_AGREEMENTS,
    customerReferrals: INITIAL_CUSTOMER_REFERRALS,
    walletTransactions: INITIAL_WALLET_TRANSACTIONS,
    memberships: [...SEED_MEMBERSHIPS],
    packages: [...SEED_PACKAGES],
    giftCardDesigns: [...SEED_GIFT_CARD_DESIGNS],
    issuedGiftCards: [...SEED_ISSUED_GIFT_CARDS],
    promoCodes: [...INITIAL_PROMO_CODES],
    marketingItems: [...SEED_MARKETING_ITEMS],
    // Reports v33 slices
    leads: [...SEED_LEADS],
    // Customer & Lead Management v83 slices (client 2026-07-24)
    followUpTasks: [],
    leadSources: [...INITIAL_LEAD_SOURCES],
    followUpStages: [...INITIAL_FOLLOW_UP_STAGES],
    marketingCampaignStats: [...SEED_MARKETING_CAMPAIGN_STATS],
    marketingSpend: [...SEED_MARKETING_SPEND],
    staffAttendanceLog: deriveStaffAttendanceLog(INITIAL_SCHEDULES),
    importHistory: [...SEED_IMPORT_HISTORY],
    // Inventory / Retail (Phase A, 2026-07-29) — 5 categories · 15 products ·
    // 45 per-branch stock rows · 30 audit-log rows. Additive slices; nothing
    // else in the app reads them until Phase B.
    retailCategories:       INITIAL_RETAIL_CATEGORIES.map(c => ({ ...c })),
    retailProducts:         INITIAL_RETAIL_PRODUCTS.map(p => ({ ...p })),
    retailStock:            INITIAL_RETAIL_STOCK.map(s => ({ ...s })),
    retailStockAdjustments: INITIAL_RETAIL_STOCK_ADJUSTMENTS.map(a => ({ ...a })),
    payRates: [...INITIAL_PAY_RATES],
    instructors: [...INITIAL_INSTRUCTORS_SYNCED],
    payrollEntries: [...INITIAL_PAYROLL_ENTRIES],
    roles: [...INITIAL_ROLES],
    staff: [...INITIAL_STAFF],
    shifts: [...INITIAL_SHIFTS],
    shiftAssignments: [...INITIAL_SHIFT_ASSIGNMENTS],
    blockedTimes: [...INITIAL_BLOCKED_TIMES],
    notificationSettings: [...INITIAL_NOTIFICATION_SETTINGS],
    notificationDeliverySettings: notificationDeliverySettingsFromSeed(SEED_NOTIFICATION_DELIVERY_SETTINGS),
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
    aiScratchCoverImage: null,
    toast: null,
    bulkSelectionActive: false,

    setBulkSelectionActive: (active) => {
        // Skip the write when the flag is already at the target value —
        // the hook fires this on every render where selection size crosses
        // 0 in either direction, and Zustand still re-notifies subscribers
        // even for identity-equal writes. Guard keeps the AI button's
        // subscription from re-rendering on every unrelated tick.
        if (get().bulkSelectionActive === active) return;
        set({ bulkSelectionActive: active });
    },

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
    updateCancellationPolicy: (patch: Partial<CancellationPolicy>) => {
        set(state => ({
            cancellationPolicy: { ...state.cancellationPolicy, ...patch },
        }));
        get().recordAudit("Updated cancellation policy", "settings", "cancellation_policy", "Cancellation policy");
    },
    updateFreezePolicy: (patch) => {
        set(state => ({
            freezePolicy: { ...state.freezePolicy, ...patch },
        }));
        get().recordAudit("Updated freeze policy", "settings", "freeze_policy", "Freeze policy");
    },
    addClassCategory: (category) => {
        set(state => ({
            classCategories: [category, ...state.classCategories],
        }));
        get().recordAudit("Created class category", "settings", category.id, category.name);
    },
    updateClassCategory: (id, patch) => {
        const target = get().classCategories.find(c => c.id === id);
        const oldName = target?.name;
        const newName = patch.name;
        // Cascade name renames into every denormalised display string that
        // froze the category name at boot — class templates and class
        // schedules both store `category` as a string for fast list render.
        // Without this, a "Pilates → Mat Pilates" rename would leave the
        // schedule grid showing "Pilates" indefinitely. Color hex is
        // cascaded the same way so a category color edit propagates to
        // the schedule tile background.
        const renaming   = newName !== undefined && newName !== oldName;
        const recoloring = patch.color_hex !== undefined && patch.color_hex !== target?.color_hex;
        set(state => ({
            classCategories: state.classCategories.map(c => c.id === id ? { ...c, ...patch } : c),
            classTemplates:  (renaming || recoloring)
                ? state.classTemplates.map(t => t.categoryId === id
                    ? { ...t, ...(renaming ? { category: newName! } : {}), ...(recoloring ? { coverColor: patch.color_hex! } : {}) }
                    : t)
                : state.classTemplates,
            classSchedules:  (renaming || recoloring) && oldName
                ? state.classSchedules.map(s => s.category === oldName
                    ? { ...s, ...(renaming ? { category: newName! } : {}), ...(recoloring ? { coverColor: patch.color_hex! } : {}) }
                    : s)
                : state.classSchedules,
            services:        (renaming || recoloring)
                ? state.services.map(s => s.categoryId === id
                    // Service interface uses `category` (not `serviceCategory`
                    // — that name belongs to Appointment, which carries a
                    // denormalised snapshot of the service's category at
                    // spawn time). Writing the wrong field would silently
                    // add an orphan property and leave the real one stale.
                    ? { ...s, ...(renaming ? { category: newName! } : {}), ...(recoloring ? { coverColor: patch.color_hex! } : {}) }
                    : s)
                : state.services,
            // Appointments carry a serviceId pointer — cascade by joining
            // through the service slice rather than guessing from the
            // category string (so renames of categories with same-named
            // services don't accidentally mass-update unrelated rows).
            appointments:    (renaming || recoloring)
                ? state.appointments.map(a => {
                    const svc = state.services.find(s => s.id === a.serviceId);
                    if (svc?.categoryId !== id) return a;
                    return { ...a, ...(renaming ? { serviceCategory: newName! } : {}), ...(recoloring ? { coverColor: patch.color_hex! } : {}) };
                })
                : state.appointments,
        }));
        if (target) get().recordAudit("Edited class category", "settings", id, target.name);
    },
    deleteClassCategory: (id) => set(state => {
        // Refuse the delete when ANY downstream record still references
        // the category — class templates, services (appointment templates),
        // OR staff specialty arrays. The UI consults `canDeleteClassCategory`
        // first and surfaces a friendly toast; this is the belt-and-
        // suspenders store-side enforcement.
        //
        // Class schedule rows aren't checked here because they spawn
        // from templates — guarding the template is sufficient (you can't
        // have a schedule without the parent template still referencing
        // the category).
        const referenced =
            state.classTemplates.some(t => t.categoryId === id) ||
            state.services.some(s => s.categoryId === id) ||
            state.staff.some(s => s.categoryIds?.includes(id));
        if (referenced) return {};
        return { classCategories: state.classCategories.filter(c => c.id !== id) };
    }),
    canDeleteClassCategory: (id) => {
        // Mirror the in-store guard above so the toast surfaces the same
        // decision the mutator would make.
        return !get().classTemplates.some(t => t.categoryId === id)
            && !get().services.some(s => s.categoryId === id)
            && !get().staff.some(s => s.categoryIds?.includes(id));
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
            // Auto-stamp the password-change timestamp when `password`
            // is part of the patch (Figma 2858:110671 — "Last changed
            // Mar 14, 2026 · 104 days ago" line). Preserves any prior
            // manual stamp when the field is untouched.
            const patchWithStamp: Partial<User> =
                patch.password !== undefined
                    ? { ...patch, password_changed_at: new Date().toISOString() }
                    : patch;
            const nextUser = { ...state.currentUser, ...patchWithStamp };
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
                // instructors[] — drives pay-rate + payroll + class roster.
                // The Instructor display field is `name` (not `fullName`), so
                // an instructor self-rename must patch `name` for it to reach
                // the admin pay-rate / compensation / earnings surfaces.
                instructors: state.instructors.map(i =>
                    i.id === staffId
                        ? {
                            ...i,
                            name: fullName,
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

    // ─── Services (Module 13 — Phase 1) ─────────────────────────────────────
    addService: (service) => {
        const id = `svc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((state) => ({ services: [{ ...service, id }, ...state.services] }));
        get().recordAudit("Created service", "service", id, service.name);
        return id;
    },
    updateService: (id, updates) => {
        const target = get().services.find(s => s.id === id);
        set((state) => {
            const nextServices = state.services.map(s => s.id === id ? { ...s, ...updates } : s);
            // Cascade the denormalized fields appointments inherit at
            // adapter-time — name, category, coverColor, coverImage — so
            // the service detail Appointments tab + the schedule grid
            // cards + the customer-profile appointments list all reflect
            // edits in the same render cycle. Mirrors `updateClassTemplate`.
            const svc = nextServices.find(s => s.id === id);
            if (!svc) return { services: nextServices };
            return {
                services: nextServices,
                appointments: state.appointments.map(a => a.serviceId === id ? {
                    ...a,
                    type:            svc.type,
                    serviceName:     svc.name,
                    serviceCategory: svc.category,
                    coverColor:      svc.coverColor,
                    coverImage:      svc.coverImage,
                    openSession:     svc.openSession,
                } : a),
            };
        });
        if (target) get().recordAudit("Edited service", "service", id, updates.name ?? target.name);
    },
    setServiceStatus: (id, status) => {
        const target = get().services.find(s => s.id === id);
        if (!target || target.status === status) return;
        set((state) => ({
            services: state.services.map(s => s.id === id ? { ...s, status } : s),
        }));
        // Human-readable audit verb per transition target.
        const verb = status === "Active"   ? (target.status === "Inactive" ? "Reactivated" : "Recovered")
                   : status === "Inactive" ? "Deactivated"
                   : /* Archived */           "Archived";
        get().recordAudit(`${verb} service`, "service", id, target.name);
    },
    deleteService: (id) => {
        const target = get().services.find(s => s.id === id);
        set((state) => ({ services: state.services.filter(s => s.id !== id) }));
        if (target) get().recordAudit("Deleted service", "service", id, target.name);
    },

    // ─── Appointments (Module 13 — Phase 4) ─────────────────────────────────
    addCustomerAppointment: (input) => {
        const state = get();
        const service = state.services.find(s => s.id === input.serviceId);
        const branch = state.branches.find(b => b.id === (service?.branchId ?? ""));
        const room = service?.roomId ? state.rooms.find(r => r.id === service.roomId) : undefined;
        const inst = input.instructorId ? state.instructors.find(i => i.id === input.instructorId) : undefined;
        // endTime = start + duration; displayTime uses the same canonical 12-hour
        // range helper as the seed/schedule adapters so every surface matches.
        const [sh, sm] = input.startTime.split(":").map(Number);
        const totalMin = sh * 60 + sm + input.durationMins;
        const endTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
        const displayTime = formatTimeRange12(input.startTime, endTime);
        const nowISO = new Date().toISOString();
        const rand = Math.floor(Math.random() * 1e6).toString(36);
        // Open (recovery) sessions are multi-customer: several bookings for the
        // same service+date+time share ONE appointment (booked++ / roster++),
        // matching the seed's open-session shape. Private (1:1) always mints a
        // fresh appointment. Reuse only a live (non-cancelled) instance.
        if (service?.openSession) {
            const existing = state.appointments.find(a =>
                a.serviceId === input.serviceId &&
                a.dateISO === input.dateISO &&
                a.startTime === input.startTime &&
                a.status !== "Cancelled");
            if (existing) {
                const booking: AppointmentBooking = {
                    id: `apptbk_cust_${Date.now().toString(36)}_${rand}`,
                    appointmentId: existing.id,
                    customerId: input.customer.id,
                    customerName: input.customer.name,
                    customerInitials: input.customer.initials,
                    customerColor: input.customer.color ?? "#e0e0e0",
                    customerImageUrl: input.customer.imageUrl,
                    status: "Booked",
                    bookedAt: nowISO,
                };
                set(s => ({
                    appointments: s.appointments.map(a => a.id === existing.id ? { ...a, booked: a.booked + 1 } : a),
                    appointmentBookings: [booking, ...s.appointmentBookings],
                }));
                get().recordAudit("Booked appointment (customer app)", "appointment", existing.id, `${existing.serviceName} — ${input.customer.name}`);
                return existing.id;
            }
        }
        const apptId = `appt_cust_${Date.now().toString(36)}_${rand}`;
        const appointment: Appointment = {
            id: apptId,
            serviceId: input.serviceId,
            type: service?.type ?? "private",
            serviceName: service?.name ?? "",
            serviceCategory: service?.category ?? "",
            coverColor: service?.coverColor ?? "#f1f2ed",
            coverImage: service?.coverImage,
            branchId: service?.branchId ?? "",
            branchName: branch?.name ?? service?.branchName ?? "",
            roomId: service?.roomId ?? "",
            roomName: room?.name ?? "",
            ...(inst ? {
                instructorId: inst.id,
                instructorName: inst.name,
                instructorInitials: inst.initials,
                instructorColor: inst.color,
                instructorImageUrl: inst.imageUrl,
            } : {}),
            flexible: input.flexible,
            openSession: service?.openSession ?? false,
            dateISO: input.dateISO,
            date: dateLabelFromISO(input.dateISO),
            startTime: input.startTime,
            endTime,
            displayTime,
            capacity: service?.openSession ? (service?.capacity ?? 0) : 1,
            booked: 1,
            status: liveScheduleStatus(input.dateISO, input.startTime, endTime, "Upcoming"),
            rating: 0,
            ratingCount: 0,
            createdAt: nowISO,
        };
        const booking: AppointmentBooking = {
            id: `apptbk_cust_${Date.now().toString(36)}_${rand}`,
            appointmentId: apptId,
            customerId: input.customer.id,
            customerName: input.customer.name,
            customerInitials: input.customer.initials,
            customerColor: input.customer.color ?? "#e0e0e0",
            customerImageUrl: input.customer.imageUrl,
            status: "Booked",
            bookedAt: nowISO,
        };
        set(s => ({
            appointments: [appointment, ...s.appointments],
            appointmentBookings: [booking, ...s.appointmentBookings],
        }));
        get().recordAudit("Booked appointment (customer app)", "appointment", apptId, `${appointment.serviceName} — ${input.customer.name}`);
        return apptId;
    },
    reassignAppointmentInstructor: (appointmentId, instructorId) => {
        const inst = get().instructors.find(i => i.id === instructorId);
        const target = get().appointments.find(a => a.id === appointmentId);
        if (!inst || !target) return;
        set(state => ({
            appointments: state.appointments.map(a => a.id === appointmentId ? {
                ...a,
                instructorId: inst.id,
                instructorName: inst.name,
                instructorInitials: inst.initials,
                instructorColor: inst.color,
                instructorImageUrl: inst.imageUrl,
            } : a),
        }));
        get().recordAudit("Reassigned appointment instructor", "appointment", appointmentId, `${target.serviceName} → ${inst.name}`);
    },
    cancelAppointment: (id, refund, cancelledBy) => {
        const target = get().appointments.find(a => a.id === id);
        if (!target || target.status === "Cancelled") return;
        const actorUser = get().currentUser;
        const actorName = cancelledBy
            ?? (actorUser ? `${actorUser.first_name} ${actorUser.last_name}`.trim() : undefined)
            ?? "Alex Owen";
        const stamp = new Date().toISOString();
        set((state) => ({
            appointments: state.appointments.map(a => a.id === id ? {
                ...a, status: "Cancelled" as AppointmentStatus,
                // Per the brief + class-schedule parity, admin cancellation
                // no longer requires a reason. The string is still emitted
                // for the audit trail so support can trace what happened.
                cancelledReason: refund ? "Cancelled by studio (credits refunded)" : "Cancelled by studio",
                cancelledAt: stamp, cancelledBy: actorName,
                booked: 0,
            } : a),
            // Cascade — every Booked customer slot flips to Cancelled. Already-
            // Attended / NoShow rows on Completed appointments are untouched.
            appointmentBookings: state.appointmentBookings.map(b => b.appointmentId === id && b.status === "Booked" ? {
                ...b, status: "Cancelled" as AppointmentBookingStatus,
                cancelledAt: stamp, cancelledBy: "admin",
            } : b),
        }));
        get().recordAudit(
            refund ? "Cancelled appointment (refunded)" : "Cancelled appointment",
            "appointment", id, target.serviceName,
        );
        // Notify admin + (Private only) the assigned instructor that the
        // appointment was cancelled. Mirrors the class-schedule cancel
        // notification pair. Open session appointments have no instructor
        // so we skip the instructor emit there.
        const wasBookedCount = target.booked;
        const noteSuffix = wasBookedCount > 0
            ? ` ${wasBookedCount} booking${wasBookedCount === 1 ? "" : "s"} ${wasBookedCount === 1 ? "was" : "were"} affected.`
            : "";
        get().emitNotifications({
            admin: {
                tab: "booking",
                event: "appointment_cancelled",
                title: "Appointment cancelled",
                body: `${target.serviceName} on ${target.date} • ${target.displayTime} was cancelled.${noteSuffix}`,
                icon: "calendar-x",
                sourceModule: "class",
                sourceId: id,
                branchId: target.branchId,
            },
            ...(target.instructorId ? {
                instructor: {
                    tab: "booking",
                    event: "appointment_cancelled",
                    title: "Appointment cancelled",
                    body: `Your ${target.serviceName} appointment on ${target.date} • ${target.displayTime} was cancelled.${noteSuffix}`,
                    icon: "calendar-x",
                    sourceModule: "class",
                    sourceId: id,
                    branchId: target.branchId,
                    targetInstructorId: target.instructorId,
                },
            } : {}),
        });
    },

    cancelAppointmentBooking: (bookingId, refund, cancelledBy) => {
        const booking = get().appointmentBookings.find(b => b.id === bookingId);
        if (!booking || booking.status === "Cancelled") return;
        const stamp = new Date().toISOString();
        set((state) => ({
            appointmentBookings: state.appointmentBookings.map(b => b.id === bookingId ? {
                ...b, status: "Cancelled" as AppointmentBookingStatus,
                cancelledAt: stamp, cancelledBy: cancelledBy ?? "admin",
            } : b),
            // Decrement the parent appointment's booked count only when the
            // cancelled booking was actually counted (Booked → not yet
            // Attended / NoShow).
            appointments: booking.status === "Booked"
                ? state.appointments.map(a => a.id === booking.appointmentId
                    ? { ...a, booked: Math.max(0, a.booked - 1) } : a)
                : state.appointments,
        }));
        const appt = get().appointments.find(a => a.id === booking.appointmentId);
        if (appt) {
            get().recordAudit(
                refund ? "Cancelled appointment booking (refunded)" : "Cancelled appointment booking",
                "appointment", booking.appointmentId,
                `${booking.customerName} — ${appt.serviceName}`,
            );
            get().emitNotifications({
                admin: {
                    tab: "booking",
                    event: "appointment_cancelled",
                    title: "Customer cancelled",
                    body: `${booking.customerName}'s booking on ${appt.serviceName} (${appt.date} • ${appt.displayTime}) was cancelled.`,
                    icon: "calendar-x",
                    sourceModule: "class",
                    sourceId: appt.id,
                    customerId: booking.customerId,
                    branchId: appt.branchId,
                },
            });
        }
    },

    removeAppointmentCustomer: (bookingId, refund) => {
        const booking = get().appointmentBookings.find(b => b.id === bookingId);
        if (!booking) return;
        const wasActive = booking.status === "Booked";
        set((state) => ({
            appointmentBookings: state.appointmentBookings.filter(b => b.id !== bookingId),
            appointments: wasActive
                ? state.appointments.map(a => a.id === booking.appointmentId
                    ? { ...a, booked: Math.max(0, a.booked - 1) } : a)
                : state.appointments,
        }));
        const appt = get().appointments.find(a => a.id === booking.appointmentId);
        if (appt) get().recordAudit(
            refund ? "Removed customer from appointment (refunded)" : "Removed customer from appointment",
            "appointment", booking.appointmentId,
            `${booking.customerName} — ${appt.serviceName}`,
        );
    },

    markAppointmentPresent: (bookingId) => {
        const booking = get().appointmentBookings.find(b => b.id === bookingId);
        if (!booking || booking.status === "Cancelled") return;
        const stamp = new Date().toISOString();
        set((state) => ({
            appointmentBookings: state.appointmentBookings.map(b => b.id === bookingId
                ? { ...b, status: "Attended" as AppointmentBookingStatus, attendanceMarkedAt: stamp } : b),
        }));
        const appt = get().appointments.find(a => a.id === booking.appointmentId);
        if (appt) {
            get().recordAudit("Marked customer present", "appointment", booking.appointmentId,
                `${booking.customerName} — ${appt.serviceName}`);
            get().emitNotifications({
                admin: {
                    tab: "booking",
                    event: "customer_marked_present",
                    title: "Customer attendance marked",
                    body: `${booking.customerName} marked present on ${appt.serviceName} (${appt.date} • ${appt.displayTime}).`,
                    icon: "calendar-check",
                    sourceModule: "class",
                    sourceId: appt.id,
                    customerId: booking.customerId,
                    branchId: appt.branchId,
                },
            });
        }
    },

    markAppointmentPresentBulk: (bookingIds) => {
        const ids = new Set(bookingIds);
        const stamp = new Date().toISOString();
        set((state) => ({
            appointmentBookings: state.appointmentBookings.map(b => ids.has(b.id) && b.status !== "Cancelled"
                ? { ...b, status: "Attended" as AppointmentBookingStatus, attendanceMarkedAt: stamp } : b),
        }));
        const sampleBooking = get().appointmentBookings.find(b => ids.has(b.id));
        const appt = sampleBooking ? get().appointments.find(a => a.id === sampleBooking.appointmentId) : undefined;
        if (appt) get().recordAudit("Marked customers present", "appointment", appt.id,
            `${ids.size} ${ids.size === 1 ? "customer" : "customers"} — ${appt.serviceName}`);
    },

    deleteAppointmentRating: (id, deletedBy) => {
        const target = get().appointmentRatings.find(r => r.id === id);
        if (!target || target.deletedAt) return;
        const actor = deletedBy ?? "Alex Owen";
        const stamp = new Date().toISOString();
        set((state) => ({
            appointmentRatings: state.appointmentRatings.map(r => r.id === id
                ? { ...r, deletedAt: stamp, deletedBy: actor } : r),
            // Recompute the parent appointment's denormalized rating count
            // + aggregate so the Rating column + summary panel stay in sync
            // with the visible review list.
            appointments: state.appointments.map(a => {
                if (a.id !== target.appointmentId) return a;
                const visible = state.appointmentRatings.filter(r =>
                    r.appointmentId === a.id && !r.deletedAt && r.id !== id);
                const count = visible.length;
                const avg = count > 0 ? visible.reduce((sum, r) => sum + r.score, 0) / count : 0;
                return { ...a, rating: avg, ratingCount: count };
            }),
        }));
        get().recordAudit("Deleted appointment rating", "appointment", target.appointmentId, target.customerName);
    },

    deleteAppointmentRatings: (ids, deletedBy) => {
        const idSet = new Set(ids);
        const actor = deletedBy ?? "Alex Owen";
        const stamp = new Date().toISOString();
        const affected = new Set<string>();
        get().appointmentRatings.forEach(r => { if (idSet.has(r.id) && !r.deletedAt) affected.add(r.appointmentId); });
        set((state) => ({
            appointmentRatings: state.appointmentRatings.map(r => idSet.has(r.id) && !r.deletedAt
                ? { ...r, deletedAt: stamp, deletedBy: actor } : r),
            appointments: state.appointments.map(a => {
                if (!affected.has(a.id)) return a;
                const visible = state.appointmentRatings.filter(r =>
                    r.appointmentId === a.id && !r.deletedAt && !idSet.has(r.id));
                const count = visible.length;
                const avg = count > 0 ? visible.reduce((sum, r) => sum + r.score, 0) / count : 0;
                return { ...a, rating: avg, ratingCount: count };
            }),
        }));
        if (affected.size > 0) get().recordAudit("Deleted appointment ratings", "appointment",
            Array.from(affected)[0], `${ids.length} rating${ids.length === 1 ? "" : "s"}`);
    },

    submitAppointmentRating: (input) => {
        set((state) => {
            const appt = state.appointments.find(a => a.id === input.appointmentId);
            const customer = state.customers.find(c => c.id === input.customerId);
            // A private appointment's rating carries its instructor; open-session
            // (recovery) appointments rate the experience — no instructor FK.
            const instructorId = appt && !appt.openSession ? appt.instructorId : undefined;
            const rating: AppointmentRating = {
                id: `appt_rat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                appointmentId: input.appointmentId,
                customerId: input.customerId,
                customerName: customer ? `${customer.firstName} ${customer.lastName}`.trim() : "",
                customerInitials: customer?.initials ?? "?",
                customerImageUrl: customer?.imageUrl,
                instructorId,
                instructorName: instructorId ? appt?.instructorName : undefined,
                score: input.score,
                comment: input.comment,
                tags: input.tags,
                submittedAt: new Date().toISOString(),
            };
            const appointmentRatings = [...state.appointmentRatings, rating];
            // Recompute the appointment's aggregate from its non-deleted ratings so
            // the admin Rating column + summary reflect the new review same render.
            const appointments = state.appointments.map((a) => {
                if (a.id !== input.appointmentId) return a;
                const rows = appointmentRatings.filter(r => r.appointmentId === a.id && !r.deletedAt);
                const avg = rows.length
                    ? Math.round((rows.reduce((sum, r) => sum + r.score, 0) / rows.length) * 10) / 10
                    : 0;
                return { ...a, rating: avg, ratingCount: rows.length };
            });
            return { appointmentRatings, appointments };
        });
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
        // When a class is reassigned to a different instructor, its OWN ratings
        // and staff-attendance-log rows must follow it (audit Phase 6,
        // 2026-08-05). Otherwise the old instructor keeps the class's ratings
        // (StaffDetailPage rating count + the delete-guard) and the Staff
        // Attendance report's staff↔class join goes stale. Reattributing keeps
        // schedule.instructorId, ratings.instructorId and log.staff_id in lock-
        // step — the single-source-of-truth invariant the whole audit enforces.
        const newInstructor = updates.instructorId;
        const instructorReassigned =
            newInstructor !== undefined && !!before && newInstructor !== before.instructorId;
        set((state) => ({
            classSchedules: state.classSchedules.map(s => s.id === id ? { ...s, ...updates } : s),
            classRatings: instructorReassigned
                ? state.classRatings.map(r => r.classScheduleId === id ? { ...r, instructorId: newInstructor! } : r)
                : state.classRatings,
            staffAttendanceLog: instructorReassigned
                ? state.staffAttendanceLog.map(l => l.class_schedule_id === id ? { ...l, staff_id: newInstructor! } : l)
                : state.staffAttendanceLog,
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
            // Symmetric credit refund (studio cancellation always refunds).
            // Every BOOKED seat that spent a plan credit (`planKindUsed` set)
            // returns 1 credit to that customer's balance. Waitlisted seats
            // never spent a credit, and unlimited members carry no counter, so
            // both are naturally excluded (the numeric-guard below matches the
            // deduction guard in `addClassBooking`).
            const refundByCustomer = new Map<string, number>();
            if (refundCredits) {
                for (const b of stateBefore.classBookings) {
                    if (b.classScheduleId === id && b.status === "booked" && b.planKindUsed) {
                        refundByCustomer.set(b.customerId, (refundByCustomer.get(b.customerId) ?? 0) + 1);
                    }
                }
            }
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
                    // Return the spent credit to each affected customer's usable
                    // balance so `derivePlanBalances` shows it as available again.
                    customers: refundByCustomer.size === 0
                        ? state.customers
                        : state.customers.map(c =>
                            refundByCustomer.has(c.id) && typeof c.creditsRemaining === "number"
                                ? { ...c, creditsRemaining: c.creditsRemaining + (refundByCustomer.get(c.id) ?? 0) }
                                : c),
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

    addClassBooking: ({ classScheduleId, customerId, status, spot, guestName, guestPhone, guestEmail, guestPayment, chargeBookerCredit }) => {
        const s0 = get();
        const schedule = s0.classSchedules.find(x => x.id === classScheduleId);
        const customer = s0.customers.find(c => c.id === customerId);
        const id = `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        // A guest seat is normally paid by the guest (drop-in / their own package /
        // invite) — no member plan, no member credit. EXCEPT when the booker chose
        // "use my class credits" (chargeBookerCredit), then it's on the booker's plan.
        const usesBookerPlan = !guestName || !!chargeBookerCredit;

        // Audit fix 2026-07-22 — defence-in-depth against frozen-plan bookings.
        // The 4 known callers (admin schedule detail + 3 customer routes) gate
        // on getFrozenActiveMembership BEFORE reaching this action. This is a
        // silent-fail backstop so any NEW caller can't accidentally book a
        // class against a paused membership.
        if (usesBookerPlan && customer) {
            const frozen = getFrozenActiveMembership(customer.id, s0.customerPlans);
            if (frozen) {
                console.warn(
                    `[addClassBooking] Refusing booking for ${customer.id}: plan "${frozen.planName}" is frozen (resumes ${frozen.resumeISO}).`,
                );
                return "";
            }
        }
        const planKindUsed = usesBookerPlan ? (customer?.planKind ?? undefined) : undefined;
        const planId = !usesBookerPlan
            ? ""
            : customer?.planKind === "membership"
              ? customer.membershipId ?? ""
              : customer?.packageIds?.[0] ?? "";
        const waitlistPosition =
            status === "waitlisted"
                ? s0.classBookings.filter(b => b.classScheduleId === classScheduleId && b.status === "waitlisted").length + 1
                : undefined;

        // Spot sync — every BOOKED seat on a spot-selection class must hold a
        // spot so the grid shows it as taken on BOTH admin + customer. When the
        // caller didn't pick one (e.g. the admin "Add customer" quick-add), auto-
        // assign the first free spot from the same configured grid, skipping
        // blocked + already-taken spots. Waitlist joins never hold a spot (the
        // free one isn't known until a cancellation). Client 2026-07-28.
        const assignedSpot =
            status === "booked" && schedule?.spotSelectionEnabled
                ? (spot ?? firstFreeSpot(
                      schedule.spotLayout,
                      s0.classBookings
                          .filter(b => b.classScheduleId === classScheduleId && b.status === "booked" && b.spot)
                          .map(b => b.spot as string),
                  ))
                : spot;

        const booking: ClassBooking = {
            id,
            classScheduleId,
            customerId,
            guestName,
            guestPhone,
            guestEmail,
            guestPayment,
            branchId: schedule?.branchId ?? customer?.branchId ?? "",
            planId,
            planName: usesBookerPlan ? (customer?.planName ?? "") : "",
            planKindUsed,
            spot: assignedSpot,
            bookingTime: new Date().toISOString(),
            status,
            attendanceStatus: "pending",
            bookingSource: "customer_portal",
            waitlistPosition,
        };

        // Auto-revive (client 2026-08-10, D3): a booking made from the
        // customer's OWN surface (portal / embed → bookingSource
        // "customer_portal") un-archives them — archiving never blocks access,
        // and their own action returns them to the list. Admin-made bookings
        // (a different source) never auto-revive.
        const shouldRevive = booking.bookingSource === "customer_portal" && customer?.status === "archived";

        set((state) => ({
            classBookings: [...state.classBookings, booking],
            // Booked seats bump the schedule count; waitlist entries don't.
            classSchedules:
                status === "booked"
                    ? state.classSchedules.map(x => (x.id === classScheduleId ? { ...x, booked: x.booked + 1 } : x))
                    : state.classSchedules,
            customers: state.customers.map(c => {
                if (c.id !== customerId) return c;
                let next = c;
                // Un-archive on the customer's own booking.
                if (shouldRevive) next = { ...next, status: "active", archivedAtISO: undefined, archiveNote: undefined };
                // Spend one class credit on a confirmed booking (package plans
                // only — unlimited memberships carry no creditsRemaining).
                if (status === "booked" && usesBookerPlan && typeof next.creditsRemaining === "number") {
                    next = { ...next, creditsRemaining: Math.max(0, next.creditsRemaining - 1) };
                }
                return next;
            }),
        }));

        if (shouldRevive && customer) {
            get().recordAudit(
                "Recovered customer", "customer", customer.id,
                `${customer.firstName} ${customer.lastName}`.trim(),
                { reason: "customer_portal_booking" },
            );
        }

        // Confirmed bookings notify Front Desk / Branch Admin (booking tab) and
        // the class's instructor — mirrors the cancellation feed contract.
        if (status === "booked" && schedule && customer) {
            const customerName = capitalizeName(`${customer.firstName} ${customer.lastName}`);
            const filled = get().classSchedules.find(x => x.id === classScheduleId)?.booked ?? schedule.booked;
            get().emitNotifications({
                admin: {
                    tab: "booking",
                    event: "booking_confirmation",
                    title: "Booking confirmed",
                    body: `${customerName} booked ${schedule.name} on ${schedule.dayOfWeek} at ${schedule.displayTime}.`,
                    icon: "calendar-check",
                    sourceModule: "booking",
                    sourceId: id,
                    classScheduleId,
                    customerId,
                    branchId: schedule.branchId,
                },
                instructor: {
                    tab: "booking",
                    event: "new_booking",
                    title: "New booking",
                    body: `${customerName} booked in. ${filled}/${schedule.capacity} spots filled.`,
                    icon: "calendar-check",
                    sourceModule: "booking",
                    sourceId: id,
                    classScheduleId,
                    customerId,
                    branchId: schedule.branchId,
                    targetInstructorId: schedule.instructorId,
                },
            });
        }

        // v83 lifecycle recompute — a fresh booking can bump a Lead → Trialist
        // or a Trialist → Loyal Active. Runs on the booker's customer id;
        // guest-seat rows skip (guests have no lifecycle to recompute).
        set(state => recomputePatch(state, customerId));
        // v83 Phase 4 — evaluate the trial_no_rebook_7d trigger on this
        // customer. Cheap: the generator dedupes against existing open
        // tasks, so hot-loops (multiple bookings same session) don't
        // materialise duplicates. Other triggers are irrelevant here.
        set(state => {
            const fresh = generateFollowUpTasks(customerId, state, {
                triggers: ["trial_no_rebook_7d"],
            });
            return { followUpTasks: applyGeneratedTasks(state.followUpTasks, fresh) };
        });

        return id;
    },
    signWaiver: (customerId, guardianConsent = false) => set((state) => {
        const mine = state.customerAgreements.filter((ca) => ca.customerId === customerId);
        // Existing rows (seeded members): flip every not-signed/re-accept-due row
        // to signed; also re-sign an already-signed waiver (age crossed 18),
        // recording whether guardian consent was captured.
        if (mine.length > 0) {
            return {
                customerAgreements: state.customerAgreements.map((ca) =>
                    ca.customerId === customerId
                        ? { ...ca, status: "signed" as const, signedAtISO: new Date().toISOString(), guardianConsent }
                        : ca,
                ),
            };
        }
        // New signups have NO seeded agreement row — insert a signed one so the
        // waiver isn't asked again on the next booking (first-booking-only).
        const customer = state.customers.find((c) => c.id === customerId);
        const branchId = customer?.branchId ?? "";
        const forBranch = (a: Agreement) => a.allLocations || a.locationIds.includes(branchId);
        const ref =
            state.agreements.find((a) => a.status === "active" && forBranch(a)) ??
            state.agreements.find((a) => a.status === "active") ??
            state.agreements[0];
        const row: CustomerAgreement = {
            id: `ca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            customerId,
            guardianConsent,
            agreementId: ref?.id ?? "",
            title: ref?.name ?? "Waiver & Liability Agreement",
            version: ref?.currentVersion ?? 1,
            branchId,
            classTemplateIds: [],
            status: "signed",
            signedAtISO: new Date().toISOString(),
        };
        return { customerAgreements: [...state.customerAgreements, row] };
    }),
    offerFreedWaitlistSpot: (classScheduleId) => {
        const state = get();
        const cs = state.classesSettings;
        const schedule = state.classSchedules.find(s => s.id === classScheduleId);
        if (!schedule || !cs.waitlist_enabled) return;
        // Only offer a spot that genuinely exists.
        if (schedule.booked >= schedule.capacity) return;

        // Past the cutoff the freed spot follows `after_cutoff_mode` instead of
        // the waitlist order — "reopens_first_come" (anyone, incl. walk-ins) and
        // "stays_empty" both mean: do not promote or offer.
        const cutoff = waitlistCutoffHours(cs, state.cancellationPolicy);
        const pastCutoff = hoursUntilClass(schedule.dateISO, schedule.startTime) < cutoff;
        if (pastCutoff && cs.after_cutoff_mode !== "keep_auto_promoting") return;

        const queue = state.classBookings
            .filter(b => b.classScheduleId === classScheduleId && b.status === "waitlisted")
            .sort((a, b) => (a.waitlistPosition ?? Number.MAX_SAFE_INTEGER) - (b.waitlistPosition ?? Number.MAX_SAFE_INTEGER));
        // Someone already holds a live claim on this spot — it is reserved.
        if (queue.some(hasLiveWaitlistClaim)) return;
        // Next in line = never offered and never declined, so nobody is asked twice.
        const next = queue.find(b => !b.waitlistClaimOfferedAt && !b.waitlistClaimDeclinedAt);
        if (!next) return;

        // "Auto add the next person" (or keep-auto-promoting past the cutoff).
        if (cs.when_spot_opens_mode === "auto_add_next" || pastCutoff) {
            get().promoteWaitlistBooking(next.id);
            return;
        }

        // "Notify to accept" — reserve the spot and let them claim it. The claim
        // can never outlive the auto-promotion cutoff.
        const hoursLeftBeforeCutoff = hoursUntilClass(schedule.dateISO, schedule.startTime) - cutoff;
        const ttlMs = Math.max(
            60_000,
            Math.min(WAITLIST_CLAIM_TTL_MINUTES * 60_000, hoursLeftBeforeCutoff * 3_600_000),
        );
        const nowISO = new Date().toISOString();
        set(state2 => ({
            classBookings: state2.classBookings.map(b =>
                b.id === next.id
                    ? { ...b, waitlistClaimOfferedAt: nowISO, waitlistClaimExpiresAt: new Date(Date.now() + ttlMs).toISOString() }
                    : b
            ),
        }));
        customerNotificationSink.emit?.({
            customerId: next.customerId,
            event: "spot_available",
            title: "A spot is available 🎉",
            message: `A spot has opened up in ${schedule.name} on ${schedule.dayOfWeek} at ${schedule.displayTime}. Claim your spot to confirm your booking before it's offered to the next person.`,
            relatedType: "booking",
            relatedId: next.id,
        });
    },

    promoteWaitlistBooking: (bookingId) => {
        const state = get();
        const booking = state.classBookings.find(b => b.id === bookingId);
        if (!booking || booking.status !== "waitlisted") return;
        const schedule = state.classSchedules.find(s => s.id === booking.classScheduleId);
        if (!schedule || schedule.booked >= schedule.capacity) return;
        const customer = state.customers.find(c => c.id === booking.customerId);

        // A waitlist join never picked a spot (the free one isn't known until a
        // cancellation), so assign the first available one now — same grid the
        // admin configured, skipping blocked spots and seats already taken.
        const takenSpots = state.classBookings
            .filter(b => b.classScheduleId === booking.classScheduleId && b.status === "booked" && b.spot)
            .map(b => b.spot as string);
        const assignedSpot =
            booking.spot ??
            (schedule.spotSelectionEnabled
                ? firstFreeSpot(schedule.spotLayout, takenSpots)
                : undefined);

        set(state2 => ({
            classBookings: state2.classBookings.map(b => {
                if (b.id === bookingId) {
                    return {
                        ...b,
                        spot: assignedSpot,
                        status: "booked" as const,
                        waitlistPosition: undefined,
                        waitlistClaimOfferedAt: undefined,
                        waitlistClaimExpiresAt: undefined,
                        waitlistClaimDeclinedAt: undefined,
                        // Durable signal for the "Waitlist conversions" KPI.
                        promotedFromWaitlistAt: new Date().toISOString(),
                    };
                }
                // Close the gap left in the queue.
                if (
                    b.classScheduleId === booking.classScheduleId &&
                    b.status === "waitlisted" &&
                    (b.waitlistPosition ?? 0) > (booking.waitlistPosition ?? 0)
                ) {
                    return { ...b, waitlistPosition: (b.waitlistPosition ?? 1) - 1 };
                }
                return b;
            }),
            classSchedules: state2.classSchedules.map(s =>
                s.id === booking.classScheduleId ? { ...s, booked: s.booked + 1 } : s
            ),
            // A waitlist seat costs nothing until it converts — spend the credit now
            // (mirrors `addClassBooking`, which only charges `booked` seats).
            customers: booking.planKindUsed
                ? state2.customers.map(c =>
                      c.id === booking.customerId && typeof c.creditsRemaining === "number"
                          ? { ...c, creditsRemaining: Math.max(0, c.creditsRemaining - 1) }
                          : c
                  )
                : state2.customers,
        }));

        customerNotificationSink.emit?.({
            customerId: booking.customerId,
            event: "booking_confirmed",
            title: "You're booked! 🎉",
            message: `A spot has opened up and you've been moved from the waitlist to ${schedule.name} on ${schedule.dayOfWeek} at ${schedule.displayTime}.`,
            relatedType: "booking",
            relatedId: booking.id,
        });
        if (customer) {
            const customerName = capitalizeName(`${customer.firstName} ${customer.lastName}`);
            const filled = (get().classSchedules.find(s => s.id === schedule.id)?.booked ?? schedule.booked);
            get().emitNotifications({
                admin: {
                    tab: "booking",
                    event: "waitlist_promoted",
                    title: "Waitlist Promoted",
                    body: `${customerName} moved from the waitlist into ${schedule.name} on ${schedule.dayOfWeek} at ${schedule.displayTime}.`,
                    icon: "calendar-check",
                    sourceModule: "booking",
                    sourceId: booking.id,
                    classScheduleId: schedule.id,
                    customerId: customer.id,
                    branchId: schedule.branchId,
                },
                instructor: {
                    tab: "booking",
                    event: "waitlist_promoted",
                    title: "Waitlist Promoted",
                    body: `${customerName} joined from the waitlist. ${filled}/${schedule.capacity} spots filled.`,
                    icon: "calendar-check",
                    sourceModule: "booking",
                    sourceId: booking.id,
                    classScheduleId: schedule.id,
                    customerId: customer.id,
                    branchId: schedule.branchId,
                    targetInstructorId: schedule.instructorId,
                },
            });
        }
    },

    claimWaitlistSpot: (bookingId) => {
        const booking = get().classBookings.find(b => b.id === bookingId);
        if (!booking || !hasLiveWaitlistClaim(booking)) return false;
        const schedule = get().classSchedules.find(s => s.id === booking.classScheduleId);
        if (!schedule || schedule.booked >= schedule.capacity) return false;
        get().promoteWaitlistBooking(bookingId);
        return get().classBookings.find(b => b.id === bookingId)?.status === "booked";
    },

    declineWaitlistSpot: (bookingId) => {
        const booking = get().classBookings.find(b => b.id === bookingId);
        if (!booking || booking.status !== "waitlisted") return;
        set(state => ({
            classBookings: state.classBookings.map(b =>
                b.id === bookingId
                    ? { ...b, waitlistClaimDeclinedAt: new Date().toISOString(), waitlistClaimExpiresAt: undefined }
                    : b
            ),
        }));
        // Pass it straight down the queue.
        get().offerFreedWaitlistSpot(booking.classScheduleId);
    },

    reconcileBookedCounts: () => {
        const state = get();
        // Count active (status "booked") rows per class in one pass.
        const counts = new Map<string, number>();
        for (const b of state.classBookings) {
            if (b.status === "booked") counts.set(b.classScheduleId, (counts.get(b.classScheduleId) ?? 0) + 1);
        }
        let changed = false;
        const next = state.classSchedules.map(sc => {
            const actual = counts.get(sc.id) ?? 0;
            if (sc.booked === actual) return sc;
            changed = true;
            return { ...sc, booked: actual };
        });
        if (changed) set({ classSchedules: next });
    },

    reconcileBookingSpots: () => {
        const state = get();
        const targets = state.classSchedules.filter(sc => sc.spotSelectionEnabled && sc.spotLayout);
        if (targets.length === 0) return;
        const assignments = new Map<string, string>();
        for (const sc of targets) {
            const rows = state.classBookings.filter(b => b.classScheduleId === sc.id && b.status === "booked");
            const used = new Set(rows.map(b => b.spot).filter(Boolean) as string[]);
            // Oldest booking first, so the order is stable across reloads.
            const needing = rows
                .filter(b => !b.spot)
                .sort((a, b) => a.bookingTime.localeCompare(b.bookingTime));
            for (const b of needing) {
                const next = firstFreeSpot(sc.spotLayout, Array.from(used));
                if (!next) break; // grid full — leave the rest unassigned
                used.add(next);
                assignments.set(b.id, next);
            }
        }
        if (assignments.size === 0) return;
        set(state2 => ({
            classBookings: state2.classBookings.map(b =>
                assignments.has(b.id) ? { ...b, spot: assignments.get(b.id) } : b
            ),
        }));
    },

    reconcileWaitlistOffers: () => {
        const state = get();
        if (!state.classesSettings.waitlist_enabled) return;
        const waiting = new Set(
            state.classBookings.filter(b => b.status === "waitlisted").map(b => b.classScheduleId)
        );
        if (waiting.size === 0) return;
        const targets = state.classSchedules.filter(
            sc => waiting.has(sc.id) && sc.status === "Upcoming" && sc.booked < sc.capacity
        );
        // Each call re-reads state, so promotions inside the loop are seen by the
        // next iteration (a class with 2 free spots offers both in auto mode).
        for (const sc of targets) {
            let guard = sc.capacity - sc.booked;
            while (guard-- > 0) {
                const before = get().classSchedules.find(x => x.id === sc.id)?.booked ?? 0;
                get().offerFreedWaitlistSpot(sc.id);
                const after = get().classSchedules.find(x => x.id === sc.id)?.booked ?? 0;
                // Stop as soon as a pass changes nothing (offer made, or no-op).
                if (after === before) break;
            }
        }
    },

    expireWaitlistClaims: () => {
        const now = Date.now();
        const lapsed = get().classBookings.filter(
            b =>
                b.status === "waitlisted" &&
                !b.waitlistClaimDeclinedAt &&
                !!b.waitlistClaimExpiresAt &&
                Date.parse(b.waitlistClaimExpiresAt) <= now
        );
        if (lapsed.length === 0) return;
        const nowISO = new Date().toISOString();
        set(state => ({
            classBookings: state.classBookings.map(b =>
                lapsed.some(l => l.id === b.id)
                    ? { ...b, waitlistClaimDeclinedAt: nowISO, waitlistClaimExpiresAt: undefined }
                    : b
            ),
        }));
        // Re-offer each affected class to the next person in line.
        Array.from(new Set(lapsed.map(l => l.classScheduleId))).forEach(id => get().offerFreedWaitlistSpot(id));
    },
    addImportedClassBooking: (input) => {
        const id = input.id ?? `bk-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const bookingTime = input.bookingTime ?? new Date().toISOString();
        const booking: ClassBooking = { ...input, id, bookingTime };
        // Verbatim insert — no frozen-plan guard, no credit deduction, no
        // notifications (historical bookings shouldn't fire "class scheduled"
        // events or debit credits already spent in the source platform).
        // Bump the schedule.booked counter for actively-booked seats so the
        // roster reflects the seat, mirroring what a normal booking does.
        set(state => ({
            classBookings: [...state.classBookings, booking],
            classSchedules:
                booking.status === "booked"
                    ? state.classSchedules.map(x =>
                          x.id === booking.classScheduleId ? { ...x, booked: x.booked + 1 } : x,
                      )
                    : state.classSchedules,
        }));
        return id;
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
            const customerName = capitalizeName(`${customer.firstName} ${customer.lastName}`);
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
        // The freed seat cascades to the waitlist per Settings → Booking rules.
        // Only a previously BOOKED seat frees capacity — cancelling a waitlist
        // entry does not, so it must not trigger a promotion.
        if (booking?.status === "booked" && schedule) {
            get().offerFreedWaitlistSpot(schedule.id);
        }
        // v83 lifecycle recompute — cancels feed the At Risk branch (cancel-
        // rate > 50% in 14d) + the first-booking-cancelled task trigger
        // (Phase 4). Only fires when the booking mapped to a real customer.
        if (booking?.customerId) {
            const cid = booking.customerId;
            set(state => recomputePatch(state, cid));
            // v83 Phase 4 — evaluate both cancel-adjacent triggers on the
            // affected customer. `first_booking_cancelled` fires when the
            // customer's very first booking just went to "cancelled";
            // `trial_no_rebook_7d` may also fire if a trialist just
            // cancelled their most recent booking so the 7-day silence
            // window is entered.
            set(state => {
                const fresh = generateFollowUpTasks(cid, state, {
                    triggers: ["first_booking_cancelled", "trial_no_rebook_7d"],
                });
                return { followUpTasks: applyGeneratedTasks(state.followUpTasks, fresh) };
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
                const customerName = capitalizeName(`${customer.firstName} ${customer.lastName}`);
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
        // Each freed seat cascades to its class's waitlist (once per class).
        // `targets` was captured pre-cancel, so `status` is the seat's old value.
        Array.from(new Set(targets.filter(t => t.status === "booked").map(t => t.classScheduleId))).forEach(scheduleId =>
            get().offerFreedWaitlistSpot(scheduleId)
        );
        // v83 lifecycle recompute — bulk cancel touches N distinct customers;
        // recompute each once inside a single set() call so the write is
        // batched. Same signal as single-cancel (feeds At Risk + task-engine
        // triggers).
        const affectedIds = Array.from(new Set(targets.map(t => t.customerId).filter(Boolean)));
        if (affectedIds.length > 0) {
            // v83 audit-2 — bulk-cancel routes each customer through the
            // single-shot recomputePatch (lifecycle + task auto-close),
            // then a second pass generates cancel-adjacent triggers.
            set(state => {
                let customers = state.customers;
                let followUpTasks = state.followUpTasks;
                for (const cid of affectedIds) {
                    const patch = recomputePatch({ ...state, customers, followUpTasks }, cid);
                    customers = patch.customers;
                    followUpTasks = patch.followUpTasks;
                }
                return { customers, followUpTasks };
            });
            set(state => {
                let next = state.followUpTasks;
                for (const cid of affectedIds) {
                    const fresh = generateFollowUpTasks(cid, { ...state, followUpTasks: next }, {
                        triggers: ["first_booking_cancelled", "trial_no_rebook_7d"],
                    });
                    next = applyGeneratedTasks(next, fresh);
                }
                return { followUpTasks: next };
            });
        }
    },
    // ── Customer-portal cancel-with-penalty flow (Jul 2026) ────────────────
    // Kept as a SEPARATE action from `cancelClassBooking` so the existing
    // admin cancel path is unchanged. This delegates the booking-side
    // mutation back to `cancelClassBooking` (source: "customer_portal")
    // then, if the policy dictates, appends a non-refundable penalty
    // transaction. Any surface (the friend's customer UI, a future admin
    // "cancel on behalf of customer" flow, etc.) can call this without
    // duplicating the penalty math.
    computeCancellationPenalty: (customerId, scenario) => {
        const state = get();
        const policy = state.cancellationPolicy;
        // Gate 1: master penalty toggle must be ON.
        if (!policy.membership_penalty_after_cancellations_enabled) {
            return { applies: false, amountAed: 0, scenario };
        }
        // Gate 2: this scenario's fee toggle must be ON.
        const feeOn = scenario === "late_cancel"
            ? policy.membership_late_cancel_fee_enabled
            : policy.membership_no_show_fee_enabled;
        if (!feeOn) {
            return { applies: false, amountAed: 0, scenario };
        }
        // Gate 3: customer's active plan must be an UNLIMITED membership.
        // Same detection pattern used elsewhere (memberships.credits ===
        // "unlimited" is canonical — see `schedule/[classId]/page.tsx:607`).
        const customer = state.customers.find(c => c.id === customerId);
        if (!customer) return { applies: false, amountAed: 0, scenario };
        const isUnlimited = customer.planKind === "membership"
            && state.memberships.find(m => m.name === customer.planName)?.credits === "unlimited";
        if (!isUnlimited) return { applies: false, amountAed: 0, scenario };
        // Audit fix 2026-07-22 — a frozen (or freeze-pending) membership is
        // on pause. Charging a cancellation penalty against a plan the
        // customer paid to suspend contradicts the freeze policy. Skip.
        const activePlan = state.customerPlans.find(
            p => p.customerId === customerId
                && p.planTypeLabel === "Membership"
                && (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested"),
        );
        if (activePlan?.status === "frozen" || activePlan?.status === "freeze_requested") {
            return { applies: false, amountAed: 0, scenario };
        }
        // Gate 4: the customer's LIFETIME late-cancel + no-show count
        // (including the pending cancellation the caller is about to
        // commit) must be STRICTLY GREATER than the threshold. Design
        // reads "Charge penalty AFTER X cancellations" — X freebies,
        // penalty starts on cancel #(X+1). This one counts too.
        const priorCancels = state.classBookings.filter(b =>
            b.customerId === customerId
            && b.status === "cancelled"
            // Same-day no-shows also live under `attendanceStatus: "no_show"`
            // on rows that were never explicitly cancelled — include both
            // to match "late cancellations OR no-shows" in the policy copy.
        ).length;
        const priorNoShows = state.classBookings.filter(b =>
            b.customerId === customerId
            && b.status !== "cancelled"
            && b.attendanceStatus === "no_show"
        ).length;
        const lifetimeCount = priorCancels + priorNoShows + 1;
        if (lifetimeCount <= policy.membership_penalty_after_cancellations_count) {
            return { applies: false, amountAed: 0, scenario };
        }
        const amountAed = scenario === "late_cancel"
            ? policy.membership_late_cancel_fee_aed
            : policy.membership_no_show_fee_aed;
        return { applies: true, amountAed, scenario };
    },
    cancelClassBookingByCustomer: (bookingId, scenario, reason) => {
        const stateBefore = get();
        const booking = stateBefore.classBookings.find(b => b.id === bookingId);
        if (!booking) return { bookingCancelled: false };
        const customer = stateBefore.customers.find(c => c.id === booking.customerId);
        // Compute penalty BEFORE the cancel — the helper counts this
        // booking's cancellation as part of the lifetime tally already,
        // so we can't call it after `cancelClassBooking` mutates state.
        const penalty = get().computeCancellationPenalty(booking.customerId, scenario);
        // Delegate booking mutation to the existing admin action so BOTH
        // paths keep identical booking-side behaviour (status, roster
        // decrement, notifications). Source flag distinguishes them.
        const scenarioLabel = scenario === "late_cancel" ? "Late cancellation" : "No-show";
        const cancelReason = reason ?? scenarioLabel;
        // Never refund credit on an unlimited membership — there's no
        // credit to return. Matches the current admin behaviour when
        // cancelling an unlimited-plan booking.
        get().cancelClassBooking(bookingId, cancelReason, false, "customer_portal");

        if (!penalty.applies || !customer) {
            return { bookingCancelled: true };
        }
        // Emit the non-refundable penalty row. `productId` points to the
        // cancelled booking so Payment history can deep-link back to it.
        const now = new Date().toISOString();
        const txnId = `txn_${customer.id}_penalty_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const displayName = scenario === "late_cancel"
            ? "Late cancellation penalty"
            : "No-show penalty";
        const penaltyTxn: CustomerTransaction = {
            id: txnId,
            customerId: customer.id,
            branchId: booking.branchId,
            kind: "cancellation_penalty",
            productId: bookingId,
            name: displayName,
            amountAed: penalty.amountAed,
            status: "complete",
            // Studio-side operational fee — most demos charge this to
            // the card on file. UI can override via a future param.
            paymentMethod: "card",
            paymentSource: "customer_portal",
            createdAtISO: now,
            // Ledger classification: penalties are their own sub-kind of
            // sale for accounting purposes (money-in). Not a refund/void.
            transactionType: "sale",
            // The core rule: cancellation penalties CAN'T be refunded.
            isRefundable: false,
            cancellationScenario: scenario,
        };
        set(state => ({
            customerTransactions: [...state.customerTransactions, penaltyTxn],
        }));
        // v83 lifecycle recompute — the customer just cancelled + got
        // charged; both actions feed the same At Risk / task-engine
        // branches as an admin-side cancel.
        set(state => recomputePatch(state, customer.id));
        // v83 Phase 4 — cancel-adjacent triggers on the customer-side
        // cancel path, mirroring the admin cancel wiring.
        set(state => {
            const fresh = generateFollowUpTasks(customer.id, state, {
                triggers: ["first_booking_cancelled", "trial_no_rebook_7d"],
            });
            return { followUpTasks: applyGeneratedTasks(state.followUpTasks, fresh) };
        });
        return {
            bookingCancelled: true,
            penaltyTransactionId: txnId,
            penaltyAedCharged: penalty.amountAed,
        };
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
                const customerName = capitalizeName(`${customer.firstName} ${customer.lastName}`);
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
        // v83 lifecycle recompute — attendance is a load-bearing behavioural
        // signal (Loyal Active + At Risk both key off recent attendance).
        // Only fires when the booking resolved to a real customer id.
        if (booking?.customerId) {
            const cid = booking.customerId;
            set(state => recomputePatch(state, cid));
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

    submitClassRating: (input) => {
        set((state) => {
            const rating: ClassRating = {
                id: `rat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                classScheduleId: input.classScheduleId,
                customerId: input.customerId,
                instructorId: input.instructorId,
                score: input.score,
                comment: input.comment,
                tags: input.tags,
                submittedAt: new Date().toISOString(),
            };
            const classRatings = [...state.classRatings, rating];
            // Recompute the schedule's aggregate from its non-deleted ratings so
            // the class/instructor rating reflects the new review same render cycle.
            const classSchedules = state.classSchedules.map((s) => {
                if (s.id !== input.classScheduleId) return s;
                const rows = classRatings.filter((r) => r.classScheduleId === s.id && !r.deletedAt);
                const avg = rows.length
                    ? Math.round((rows.reduce((sum, r) => sum + r.score, 0) / rows.length) * 10) / 10
                    : 0;
                return { ...s, rating: avg, ratingCount: rows.length };
            });
            return { classRatings, classSchedules };
        });
        // v83 lifecycle recompute — the plan feeds ratings into the At Risk
        // branch (avg rating dropped ≥ 1 star). Runs on the rater only.
        // Wired onto the LIVE `submitClassRating` path; the importer
        // `addClassRating` deliberately skips (see plan comment).
        set(state => recomputePatch(state, input.customerId));
    },

    addCustomer: (input) => {
        const id = `cu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const initials = input.initials ?? `${input.firstName.charAt(0)}${input.lastName.charAt(0)}`.toUpperCase();
        const createdAt = new Date().toISOString();
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
            createdAt,
            // Reports v33 — mirror customerFromSeed's derivations so
            // Customer Data + Acquisition Efficiency reports stay
            // populated even for customers created via the admin form
            // during the demo.
            firstVisitISO:   input.firstVisitISO   ?? deriveFirstVisitISO(createdAt, input.lastVisitISO),
            marketingSource: input.marketingSource ?? deriveMarketingSource(id),
            convertedFrom:   input.convertedFrom   ?? deriveConvertedFrom(id, input.planKind),
        };
        set((state) => ({ customers: [customer, ...state.customers] }));
        // v83 audit-3 fix (2026-07-27) — stamp lifecycleTag on brand-new
        // customer records so every stored-tag reader (widget, CSV,
        // task engine) sees the correct default from the start instead
        // of relying on the segment-tab `?? "Lead"` fallback until
        // something else triggers a recompute.
        set(state => recomputePatch(state, id));

        // ── Referral link (client 2026-07-31) ──────────────────────────────
        // A signup that entered someone's referral code now CREATES a
        // pending referral row. Before this, the code was stored on the
        // customer and nothing else happened — there was no record tying
        // friend to referrer, so no reward could ever fire.
        //
        // The row starts with `rewardIssuedAtISO` undefined (= pending).
        // `applyPurchase` → `evaluateReferralRewards` pays it out when the
        // friend's first purchase meets the studio's configured rules.
        //
        // Lives in `addCustomer` rather than the signup page so EVERY
        // creation path benefits — customer portal signup, admin "Add
        // customer", and AI-Agent CSV import all funnel through here.
        if (input.referralCode) {
            const code = input.referralCode.trim().toUpperCase();
            const referrer = get().customers.find(
                c => c.id !== id && c.referralCode?.trim().toUpperCase() === code,
            );
            // Self-referral is rejected outright at link time (not just at
            // payout) so the Referrals tab never shows a bogus row.
            if (referrer) {
                const settings = get().referralSettings;
                const nowISO = new Date().toISOString();
                const expiryDays = settings.earnedRewardExpiryDays;
                get().addCustomerReferral({
                    referrerCustomerId: referrer.id,
                    referredCustomerId: id,
                    referredName: `${input.firstName} ${input.lastName}`.trim(),
                    referredEmail: input.email,
                    // Reward fields are provisional — the payout re-stamps
                    // them from live settings at issue time so a mid-flight
                    // settings change applies to still-pending referrals.
                    benefitType:   settings.referrerEarnType,
                    benefitAmount: settings.referrerEarnAmount,
                    benefitCredits: settings.referrerEarnType === "free_credits"
                        ? settings.referrerEarnAmount
                        : 0,
                    referredAtISO: nowISO,
                    expiresAtISO: expiryDays > 0
                        ? new Date(Date.now() + expiryDays * 86_400_000).toISOString()
                        : undefined,
                    // Branch gate — credits lock to the REFERRER's home branch
                    // when "redeemable across all branches" is off.
                    originBranchId: referrer.branchId,
                    // rewardIssuedAtISO intentionally omitted → pending.
                });
            }
        }
        return id;
    },
    updateCustomer: (id, patch) => {
        const target = get().customers.find(c => c.id === id);
        // v83 audit-1 (2026-07-29) — when `assignedTo` changes, cascade
        // the new owner into every OPEN follow-up task for this customer
        // in the same set() so the dashboard "Leads to follow up" widget
        // routes existing open tasks to the new owner immediately.
        // Closed tasks keep their historical assigneeId (audit trail).
        const assignedToChanged =
            Object.prototype.hasOwnProperty.call(patch, "assignedTo") &&
            !!target &&
            target.assignedTo !== patch.assignedTo;
        set((state) => ({
            customers: state.customers.map(c => c.id === id ? { ...c, ...patch } : c),
            followUpTasks: assignedToChanged
                ? state.followUpTasks.map(t =>
                    t.customerId === id && t.status === "open"
                        ? { ...t, assigneeId: patch.assignedTo }
                        : t,
                  )
                : state.followUpTasks,
        }));
        if (target) {
            // v83 audit-1 (2026-07-29) — describe WHAT changed, not just
            // "Edited customer profile", so the audit trail is usable.
            // Rely on well-known patch keys; unknown keys collapse into
            // a generic "profile fields" descriptor.
            const label = describeCustomerPatch(patch);
            get().recordAudit(label, "customer", id, `${target.firstName} ${target.lastName}`.trim());
        }
    },
    setCustomerStatus: (ids, status, note) => {
        const targets = get().customers.filter(c => ids.includes(c.id));
        const nowISO = new Date().toISOString();
        set((state) => {
            const idSet = new Set(ids);
            return {
                customers: state.customers.map(c => {
                    if (!idSet.has(c.id)) return c;
                    // Archiving stamps the note + timestamp; recovering clears both.
                    return status === "archived"
                        ? { ...c, status, archivedAtISO: nowISO, ...(note !== undefined ? { archiveNote: note } : {}) }
                        : { ...c, status, archivedAtISO: undefined, archiveNote: undefined };
                }),
            };
        });
        const actionLabel = status === "archived" ? "Archived customer" : "Recovered customer";
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

    freezeCustomerPlan: (planId, startISO, endISO, source, reason) => {
        const target = get().customerPlans.find(p => p.id === planId);
        // Phase 5 — billing_behavior branches the freeze math:
        //   • "pause" (Option A) → expiry shifts by frozenDays, next-charge
        //     amount unchanged. Historical behavior.
        //   • "stay_on_schedule" (Option B) → expiry stays, next-charge is
        //     prorated down by the frozen fraction of the billing cycle.
        //     Stashed on `nextChargeAdjustmentAed` for the renewal step to
        //     consume; expiry math untouched.
        //
        // Audit fix (Phase 6+) — the picked reason's per-reason exceptions
        // now actually gate behaviors. `ignoresFreezeLimit` skips the
        // freezeCount++ so a bypassing reason (e.g. Medical) doesn't burn
        // the customer's annual freeze quota. `waivesFee` is enforced in
        // the fee-charging actions below (freezeMembershipByCustomer +
        // approveFreezeRequest), not here — this action is fee-agnostic.
        const policy = get().freezePolicy;
        const bypass = resolveReasonExceptions(policy, reason ?? undefined);
        set(state => ({
            customerPlans: state.customerPlans.map(p => {
                if (p.id !== planId) return p;
                const preview = computeNextCharge(p, policy, startISO, endISO);
                return {
                    ...p,
                    status: "frozen" as const,
                    freezeStartISO: startISO,
                    freezeEndISO: endISO,
                    // Default origin: an admin clicked freeze on a
                    // customer detail page. Callers from the customer
                    // portal or front desk should pass their own.
                    freezeSource: source ?? "admin" as const,
                    // Lifetime freeze tally — the freeze policy's
                    // "max freezes per membership" is checked against this.
                    // Bypassed reasons (ignoresFreezeLimit=true) don't
                    // increment so genuine medical / injury freezes don't
                    // eat into the annual quota (client 2026-07-20 intent).
                    freezeCount: bypass.ignoresFreezeLimit
                        ? (p.freezeCount ?? 0)
                        : (p.freezeCount ?? 0) + 1,
                    // Rolling-12-months history (client 2026-07-22).
                    // Every freeze appends its startISO so the eligibility
                    // check can count freezes in the trailing 365 days.
                    // Bypassed reasons (Medical / Injury etc.) don't
                    // append so genuine health freezes stay off the cap.
                    freezeHistoryISO: bypass.ignoresFreezeLimit
                        ? (p.freezeHistoryISO ?? [])
                        : [...(p.freezeHistoryISO ?? []), startISO.slice(0, 10)],
                    // Reason (customer self-freeze) — surfaced admin-side.
                    freezeReason: reason ?? undefined,
                    // Option A: expiry shifts by frozenDays. Option B:
                    // expiry stays put; the renewal picks up the prorate.
                    // Audit fix — the shared convention is
                    // next-charge = expiry - 1 day (see computeNextCharge L2191),
                    // so the new expiry is nextCharge + 1 day. Assigning it
                    // straight to `newNextChargeISO` shifted expiry by
                    // `frozenDays - 1` (one day short).
                    expiryISO:
                        policy.billing_behavior === "pause"
                            ? new Date(
                                  Date.parse(preview.newNextChargeISO + "T00:00:00Z") + 86_400_000,
                              ).toISOString()
                            : p.expiryISO,
                    // Option B only — stashed for the renewal cycle.
                    nextChargeAdjustmentAed:
                        policy.billing_behavior === "stay_on_schedule"
                            ? preview.savingsAed ?? undefined
                            : undefined,
                    // Clear stale request scratch — approve-flow copies fields
                    // over onto the freeze fields; make sure we don't carry
                    // the request payload after transition.
                    freezeRequestStartISO: undefined,
                    freezeRequestEndISO: undefined,
                    freezeRequestReason: undefined,
                    freezeRequestedAtISO: undefined,
                    freezeRejectionNote: undefined,
                };
            }),
        }));
        if (target) {
            const customer = get().customers.find(c => c.id === target.customerId);
            const customerName = customer ? capitalizeName(`${customer.firstName} ${customer.lastName}`) : "a customer";
            get().recordAudit(`Froze ${customerName}'s plan`, "customer_plan", planId, target.name, { from: startISO, to: endISO });
        }
        // Audit fix — emit the freeze fee here (shared) so every entry point
        // (admin CustomerDetailPage, customer portal, approval flow) charges
        // consistently. The customer-portal + approval wrappers used to
        // duplicate this block; an admin-initiated freeze had NO fee at all.
        // `waivesFee` on the picked reason skips the charge (Medical / Injury
        // etc. — client 2026-07-20 intent).
        const target2 = get().customerPlans.find(p => p.id === planId);
        const customer2 = target2 ? get().customers.find(c => c.id === target2.customerId) : undefined;
        const fee = policy.fee_enabled && !bypass.waivesFee ? Math.max(0, policy.fee_amount_aed) : 0;
        if (customer2 && fee > 0) {
            const nowISO = new Date().toISOString();
            const txnId = `txn_${customer2.id}_freeze_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const feeTxn: CustomerTransaction = {
                id: txnId,
                customerId: customer2.id,
                branchId: customer2.branchId,
                kind: "freeze_fee",
                productId: planId,
                name: policy.fee_type === "recurring" ? "Membership freeze fee (recurring)" : "Membership freeze fee",
                amountAed: fee,
                status: "complete",
                paymentMethod: "card",
                paymentSource: source === "customer_portal" ? "customer_portal" : "admin",
                createdAtISO: nowISO,
                transactionType: "sale",
                isRefundable: false,
            };
            set(state => ({ customerTransactions: [...state.customerTransactions, feeTxn] }));
        }
        // Audit fix 2026-07-22 — admin-path bell fan-out. When admin clicks
        // Freeze on CustomerDetailPage, the customer needs to be told (their
        // plan just paused). The customer-portal + approve wrappers below
        // fire their own custom-titled bells; here we mirror the same shape
        // for admin so no path is silent. Admin bell is skipped because the
        // admin already sees the confirmation toast on their own screen.
        if (source === "admin" && target2 && customer2) {
            const end = freezeDayLabel(endISO);
            customerNotificationSink.emit?.({
                customerId: customer2.id,
                event: "membership_frozen",
                title: "Membership frozen",
                message: `Your ${target2.name} was frozen by staff. Bookings resume ${end}.`,
                relatedType: "customer_plan",
                relatedId: planId,
            });
        }
        // v83 audit-3 fix — freeze affects usable-plan status downstream
        // (approveFreezeRequest + freezeMembershipByCustomer both funnel
        // here). Recompute so the tag stays fresh.
        const targetPlan = get().customerPlans.find(p => p.id === planId);
        if (targetPlan) {
            const cid = targetPlan.customerId;
            set(state => recomputePatch(state, cid));
        }
        return { fee };
    },

    freezeMembershipByCustomer: (planId, startISO, endISO, reason) => {
        const plan = get().customerPlans.find(p => p.id === planId);
        if (!plan) return { fee: 0 };
        const customer = get().customers.find(c => c.id === plan.customerId);
        // Freeze via the shared action — handles status, expiry extension,
        // freezeCount++, the reason, the audit entry (customer_portal), and
        // (audit fix 2026-07-22) the freeze-fee transaction. We just fan out
        // the notifications below and pass the fee back for the receipt UI.
        const { fee } = get().freezeCustomerPlan(planId, startISO, endISO, "customer_portal", reason);
        // Phase 4 — customer bell + admin bell notifications on self-freeze.
        // Customer sees "Membership frozen" in their bookings tab; admin sees
        // a bell row on the notifications page so the studio knows a member
        // paused their plan self-service. Same fan-out pattern the rest of
        // the store uses (customerNotificationSink for the member, emit-
        // Notifications for the admin).
        const start = freezeDayLabel(startISO);
        const end = freezeDayLabel(endISO);
        if (customer) {
            customerNotificationSink.emit?.({
                customerId: customer.id,
                event: "membership_frozen",
                title: "Membership frozen",
                message: `${plan.name} is frozen from ${start} to ${end}. Bookings resume ${end}.`,
                relatedType: "customer_plan",
                relatedId: planId,
            });
            const customerName = capitalizeName(`${customer.firstName} ${customer.lastName}`);
            get().emitNotifications({
                admin: {
                    tab: "booking",
                    event: "membership_frozen",
                    title: "Membership frozen",
                    body: `${customerName} froze their ${plan.name} — resumes ${end}.`,
                    icon: "calendar-minus",
                    sourceModule: "booking",
                    sourceId: planId,
                    customerId: customer.id,
                    branchId: customer.branchId,
                },
            });
        }
        // Fee transaction — now emitted inside freezeCustomerPlan (audit fix
        // 2026-07-22). Pass the amount up so the receipt UI can render it.
        return { fee };
    },

    // ── Freeze policy v2 Phase 5 — approval flow ──────────────────────────
    requestFreezeByCustomer: (planId, startISO, endISO, reason) => {
        const target = get().customerPlans.find(p => p.id === planId);
        if (!target) return;
        const customer = get().customers.find(c => c.id === target.customerId);
        const nowISO = new Date().toISOString();
        set(state => ({
            customerPlans: state.customerPlans.map(p =>
                p.id === planId
                    ? {
                          ...p,
                          status: "freeze_requested" as const,
                          freezeRequestStartISO: startISO,
                          freezeRequestEndISO: endISO,
                          freezeRequestReason: reason ?? undefined,
                          freezeRequestedAtISO: nowISO,
                          // Clear stale rejection note when the customer
                          // resubmits after a rejection.
                          freezeRejectionNote: undefined,
                      }
                    : p,
            ),
        }));
        if (customer) {
            const customerName = capitalizeName(`${customer.firstName} ${customer.lastName}`);
            get().recordAudit(
                `${customerName} requested a freeze`,
                "customer_plan",
                planId,
                target.name,
                { from: startISO, to: endISO },
            );
            // Customer bell — confirm the request landed.
            customerNotificationSink.emit?.({
                customerId: customer.id,
                event: "membership_frozen",
                title: "Freeze requested",
                message: `Your request for ${target.name} (${freezeDayLabel(startISO)} → ${freezeDayLabel(endISO)}) is pending admin approval.`,
                relatedType: "customer_plan",
                relatedId: planId,
            });
            // Admin bell — surface the request in the notifications page so
            // the studio owner sees it without having to open the customer
            // detail.
            get().emitNotifications({
                admin: {
                    tab: "booking",
                    event: "membership_frozen",
                    title: "Freeze requested",
                    body: `${customerName} requested a freeze on ${target.name} (${freezeDayLabel(startISO)} → ${freezeDayLabel(endISO)}).`,
                    icon: "calendar-minus",
                    sourceModule: "booking",
                    sourceId: planId,
                    customerId: customer.id,
                    branchId: customer.branchId,
                },
            });
        }
        // v83 audit-3 fix — freeze_requested transitions the plan
        // status; recompute so downstream reads stay fresh.
        set(state => recomputePatch(state, target.customerId));
    },

    approveFreezeRequest: (planId) => {
        const target = get().customerPlans.find(p => p.id === planId);
        if (!target || target.status !== "freeze_requested") return;
        const startISO = target.freezeRequestStartISO;
        const endISO = target.freezeRequestEndISO;
        if (!startISO || !endISO) return;
        const reason = target.freezeRequestReason;
        // Hand off to the shared freeze action — it applies Option A/B
        // billing math, bumps freezeCount, records the audit, and clears
        // the request scratch fields via its own reset block.
        get().freezeCustomerPlan(planId, startISO, endISO, "customer_portal", reason);
        // Notifications — same shape as the direct-freeze fan-out in
        // freezeMembershipByCustomer, but the initiator is the admin
        // approving the request rather than the customer.
        const customer = get().customers.find(c => c.id === target.customerId);
        if (customer) {
            const end = freezeDayLabel(endISO);
            customerNotificationSink.emit?.({
                customerId: customer.id,
                event: "membership_frozen",
                title: "Freeze approved",
                message: `Your ${target.name} freeze was approved. Bookings resume ${end}.`,
                relatedType: "customer_plan",
                relatedId: planId,
            });
            const customerName = capitalizeName(`${customer.firstName} ${customer.lastName}`);
            get().emitNotifications({
                admin: {
                    tab: "booking",
                    event: "membership_frozen",
                    title: "Freeze approved",
                    body: `Approved freeze for ${customerName}'s ${target.name} — resumes ${end}.`,
                    icon: "calendar-minus",
                    sourceModule: "booking",
                    sourceId: planId,
                    customerId: customer.id,
                    branchId: customer.branchId,
                },
            });
        }
        // Fee transaction — now emitted inside freezeCustomerPlan (audit fix
        // 2026-07-22). The approval fires the shared action above, which
        // charges the fee tied to the freeze STARTING, respecting
        // `waivesFee` on the requested reason.
    },

    rejectFreezeRequest: (planId, note) => {
        const target = get().customerPlans.find(p => p.id === planId);
        if (!target || target.status !== "freeze_requested") return;
        const customer = get().customers.find(c => c.id === target.customerId);
        set(state => ({
            customerPlans: state.customerPlans.map(p =>
                p.id === planId
                    ? {
                          ...p,
                          status: "active" as const,
                          freezeRequestStartISO: undefined,
                          freezeRequestEndISO: undefined,
                          freezeRequestReason: undefined,
                          freezeRequestedAtISO: undefined,
                          freezeRejectionNote: note?.trim() ? note.trim() : undefined,
                      }
                    : p,
            ),
        }));
        if (customer) {
            const customerName = capitalizeName(`${customer.firstName} ${customer.lastName}`);
            get().recordAudit(
                `Rejected ${customerName}'s freeze request`,
                "customer_plan",
                planId,
                target.name,
                note ? { note } : undefined,
            );
            const noteSuffix = note?.trim() ? ` Note from the studio: ${note.trim()}` : "";
            customerNotificationSink.emit?.({
                customerId: customer.id,
                event: "membership_reactivated",
                title: "Freeze request declined",
                message: `Your ${target.name} freeze request was declined.${noteSuffix}`,
                relatedType: "customer_plan",
                relatedId: planId,
            });
            get().emitNotifications({
                admin: {
                    tab: "booking",
                    event: "membership_reactivated",
                    title: "Freeze request declined",
                    body: `Declined ${customerName}'s freeze request on ${target.name}.`,
                    icon: "refresh",
                    sourceModule: "booking",
                    sourceId: planId,
                    customerId: customer.id,
                    branchId: customer.branchId,
                },
            });
        }
        // v83 audit-2 fix — freeze changes usable-plan status, which
        // gates At Risk vs Loyal Active. Recompute so the tag stays
        // fresh across every read surface (list, widget, CSV, profile).
        set(state => recomputePatch(state, target.customerId));
    },

    unfreezeCustomerPlan: (planId) => {
        const target = get().customerPlans.find(p => p.id === planId);
        set(state => ({
            customerPlans: state.customerPlans.map(p =>
                p.id === planId
                    ? {
                          ...p,
                          status: "active" as const,
                          freezeStartISO: undefined,
                          freezeEndISO: undefined,
                          freezeReason: undefined,
                          // Clear the reminder idempotency stamp so a future
                          // freeze can re-arm its 3-day reminder cleanly.
                          freezeReminderSentAtISO: undefined,
                          // Phase 5 — release the Option B prorate credit
                          // if it was set. Manual unfreeze mid-cycle means
                          // the frozen fraction was never actually paused,
                          // so there's no proration to apply anymore.
                          nextChargeAdjustmentAed: undefined,
                      }
                    : p,
            ),
        }));
        if (target) {
            const customer = get().customers.find(c => c.id === target.customerId);
            const customerName = customer ? capitalizeName(`${customer.firstName} ${customer.lastName}`) : "a customer";
            get().recordAudit(`Unfroze ${customerName}'s plan`, "customer_plan", planId, target.name);
        }
        if (target) {
            const cid = target.customerId;
            set(state => recomputePatch(state, cid));
        }
    },

    cancelCustomerPlan: (planId, mode, reason) => {
        const targetPlan = get().customerPlans.find(p => p.id === planId);
        const targetCustomer = targetPlan ? get().customers.find(c => c.id === targetPlan.customerId) : undefined;
        const customerName = targetCustomer ? capitalizeName(`${targetCustomer.firstName} ${targetCustomer.lastName}`) : "a customer";
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
                        // Audit fix — clear any pending freeze-request
                        // scratch fields if the plan gets cancelled from
                        // the freeze_requested state. Prevents dead
                        // request data from persisting on a cancelled row.
                        freezeRequestStartISO: undefined,
                        freezeRequestEndISO: undefined,
                        freezeRequestReason: undefined,
                        freezeRequestedAtISO: undefined,
                    }
                    : p,
            );
            // Clamp the customer's live `creditsRemaining` to the new
            // allotment ceiling so a cancelled plan visibly removes credits
            // from the side-panel widget (and anywhere else reading the
            // balance). Unlimited plans keep credits uncapped.
            //
            // ALSO recompute the flat plan fields (`planKind` / `planName`
            // / `membershipId` / `packageIds` / `planExpiryISO`) from the
            // remaining held plans — cancelling the only active
            // membership must flip `planKind` to null (or to "package"
            // if the customer still holds packages), otherwise the
            // Customer badge + Reports v33 keep reading the cancelled
            // plan's kind (bug the audit surfaced Jul 2026).
            const customers = !target ? state.customers : state.customers.map(c => {
                if (c.id !== target.customerId) return c;
                const stillCounted = customerPlans.filter(p =>
                    p.customerId === c.id
                    && (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested"));
                let cap = 0;
                let hasUnlimited = false;
                for (const p of stillCounted) {
                    if (p.creditsLabel.toLowerCase().includes("unlimited")) {
                        hasUnlimited = true;
                        continue;
                    }
                    const m = p.creditsLabel.match(/\d+/);
                    cap += p.freeCredits ?? (m ? Number(m[0]) : 0);
                }
                const flat = derivedFlatPlanFields(customerPlans, c.id);
                return {
                    ...c,
                    ...flat,
                    // A "period_end" cancellation keeps access until expiry, so the
                    // customer KEEPS their remaining credits (and gets them back on
                    // reactivate). Only an immediate ("today") cancel clamps to the
                    // still-active allotment. Unlimited plans stay uncapped.
                    creditsRemaining: hasUnlimited || mode === "period_end"
                        ? c.creditsRemaining
                        : Math.min(c.creditsRemaining ?? 0, cap),
                };
            });
            return { customerPlans, customers };
        });
        if (targetPlan) {
            get().recordAudit(`Cancelled ${customerName}'s plan`, "customer_plan", planId, targetPlan.name, { mode });
            const cid = targetPlan.customerId;
            set(state => recomputePatch(state, cid));
        }
    },

    reactivateCustomerPlan: (planId) => {
        const target = get().customerPlans.find(p => p.id === planId);
        set(state => {
            const t = state.customerPlans.find(p => p.id === planId);
            if (!t) return {};
            // Reactivating a plan mustn't recreate the mem+pkg violation
            // — if the customer currently holds a plan of the OTHER
            // kind, cascade-cancel it first (mirrors `applyPurchase`'s
            // rule). Complimentary plans stay untouched.
            const nowISO = new Date().toISOString();
            const reactivatingKind = t.kind;
            const displacedKind = reactivatingKind === "membership" ? "package" : "membership";
            const customerPlans = state.customerPlans.map(p => {
                if (p.id === planId) {
                    return { ...p, status: "active" as const, cancelMode: undefined, cancelReason: undefined, cancelledAtISO: undefined };
                }
                if (p.customerId !== t.customerId) return p;
                if (p.kind !== displacedKind) return p;
                if (p.status !== "active" && p.status !== "frozen") return p;
                return {
                    ...p,
                    status: "cancelled" as const,
                    cancelReason: reactivatingKind === "membership"
                        ? "Switched to membership"
                        : "Switched to package",
                    cancelledAtISO: nowISO,
                };
            });
            // Recompute flat fields from the new plan list.
            const customers = state.customers.map(c =>
                c.id === t.customerId
                    ? { ...c, ...derivedFlatPlanFields(customerPlans, c.id) }
                    : c,
            );
            return { customerPlans, customers };
        });
        if (target) {
            const customer = get().customers.find(c => c.id === target.customerId);
            const customerName = customer ? `${customer.firstName} ${customer.lastName}`.trim() : "a customer";
            get().recordAudit(`Reactivated ${customerName}'s plan`, "customer_plan", planId, target.name);
            const cid = target.customerId;
            set(state => recomputePatch(state, cid));
        }
    },

    removeComplimentaryPlan: (planId, reason, removedBy, removedByRole) => {
        const targetPlan = get().customerPlans.find(p => p.id === planId);
        const targetCustomer = targetPlan ? get().customers.find(c => c.id === targetPlan.customerId) : undefined;
        const customerName = targetCustomer ? capitalizeName(`${targetCustomer.firstName} ${targetCustomer.lastName}`) : "a customer";
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
            // v83 audit-3 fix — removing a Trialist's only plan
            // means they should drop to Lead or Churned; recompute.
            const cid = targetPlan.customerId;
            set(state => recomputePatch(state, cid));
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
        const customerName = targetCustomer ? capitalizeName(`${targetCustomer.firstName} ${targetCustomer.lastName}`) : "a customer";
        get().recordAudit(`Added complimentary credit to ${customerName}`, "customer_plan", id, input.name, { credits: input.freeCredits ?? 0 });
        // v83 lifecycle recompute — a complimentary plan flips a Lead to
        // Trialist (only intro plan, no paid plan yet).
        set(state => recomputePatch(state, input.customerId));
        // v83 Phase 4 — the trial has just started. The trigger doesn't
        // fire yet (no attended booking on record), but the generator's
        // dedupe guard makes an early check idempotent — future writes on
        // this customer will pick it up naturally.
        set(state => {
            const fresh = generateFollowUpTasks(input.customerId, state, {
                triggers: ["trial_no_rebook_7d"],
            });
            return { followUpTasks: applyGeneratedTasks(state.followUpTasks, fresh) };
        });
        return id;
    },
    addCustomerPlan: (input) => {
        const id = input.id ?? `cp_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const plan: CustomerPlan = { ...input, id };
        set(state => ({ customerPlans: [plan, ...state.customerPlans] }));
        const target = get().customers.find(c => c.id === input.customerId);
        const customerName = target ? capitalizeName(`${target.firstName} ${target.lastName}`) : "a customer";
        get().recordAudit(`Imported plan for ${customerName}`, "customer_plan", id, input.name);
        // v83 lifecycle recompute — a fresh plan is the main New Active
        // trigger. The importer path fires it too so a bulk seed hydrates
        // customer tags in the same pass (idempotent — no lifecycle change
        // means no write).
        set(state => recomputePatch(state, input.customerId));
        return id;
    },

    // ── Customer transactions ──────────────────────────────────────────────

    addCustomerTransaction: (input) => {
        const id = input.id ?? `txn_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const next: CustomerTransaction = {
            ...input,
            id,
            createdAtISO: input.createdAtISO ?? new Date().toISOString(),
        };
        set(state => ({ customerTransactions: [...state.customerTransactions, next] }));
        const target = get().customers.find(c => c.id === input.customerId);
        const who = target ? capitalizeName(`${target.firstName} ${target.lastName}`) : "a customer";
        get().recordAudit(`Imported transaction for ${who}`, "customer", input.customerId, next.name);
        // v83 lifecycle recompute — feeds the New Active + Won-back
        // branches (both key off "paid within last 30 days").
        set(state => recomputePatch(state, input.customerId));
        return id;
    },
    addWalletTransaction: (input) => {
        const id = input.id ?? `wtxn_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const next: WalletTransaction = {
            ...input,
            id,
            createdAtISO: input.createdAtISO ?? new Date().toISOString(),
        };
        set(state => ({ walletTransactions: [...state.walletTransactions, next] }));
        return id;
    },
    addCustomerReferral: (input) => {
        const id = input.id ?? `ref_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const next: CustomerReferral = { ...input, id };
        set(state => ({ customerReferrals: [...state.customerReferrals, next] }));
        return id;
    },
    addClassRating: (input) => {
        const id = input.id ?? `rating_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const next: ClassRating = {
            ...input,
            id,
            submittedAt: input.submittedAt ?? new Date().toISOString(),
        };
        set(state => ({ classRatings: [...state.classRatings, next] }));
        return id;
    },
    addPayrollEntry: (input) => {
        const id = input.id ?? `payroll_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const next: PayrollEntry = { ...input, id };
        set(state => ({ payrollEntries: [...state.payrollEntries, next] }));
        return id;
    },
    addStaffAttendanceLog: (input) => {
        const id = input.id ?? `att_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const next: StaffAttendanceLog = { ...input, id };
        set(state => ({ staffAttendanceLog: [...state.staffAttendanceLog, next] }));
        return id;
    },
    refundTransaction: (id, method) => {
        const target = get().customerTransactions.find(t => t.id === id);
        // Belt-and-braces guard — even if a future UI surface skips
        // its own `isRefundable` check, the store rejects the refund
        // on non-refundable rows (e.g. cancellation-penalty fees).
        if (target && target.isRefundable === false) return;
        // Gift-card SALE refund (client Aug 2026) — only allowed while the card
        // is FULLY UNUSED. Once any balance is spent the sale can't be reversed
        // (the money's already been redeemed against other products). The UI
        // hides the Refund action in this case too; this is the store-side
        // belt-and-braces guard.
        if (target && target.kind === "gift_card" && target.issuedGiftCardId) {
            const card = get().issuedGiftCards.find(c => c.id === target.issuedGiftCardId);
            if (card && (card.status !== "active" || card.current_balance_aed < card.face_value_aed)) return;
        }
        // v83 audit-1 (2026-07-29) — capture whether the set() below will
        // actually flip the row. The outer if(target) block runs side
        // effects (wallet credit-back, retail stock restore); those must
        // only fire ONCE. Double-clicking Refund on the same transaction
        // otherwise re-credits the wallet and restores stock a second time.
        const willFlip = !!target && target.status === "complete" && target.isRefundable !== false;
        set(state => ({
            customerTransactions: state.customerTransactions.map(t =>
                t.id === id && t.status === "complete" && t.isRefundable !== false
                    ? {
                        ...t,
                        status: "refunded" as const,
                        refundedAtISO: new Date().toISOString(),
                        refundMethod: method,
                        // `transactionType: "refund"` is what
                        // `commissionForPeriod`'s `categoryStats` uses to net
                        // this row out of the seller's commission base
                        // (client Jul 2026 audit fix — was left as "sale" or
                        // undefined, so live UI refunds never clawed back
                        // commission from the crediting staff).
                        transactionType: "refund" as const,
                    }
                    : t,
            ),
        }));
        if (target && willFlip) {
            const targetCustomer = get().customers.find(c => c.id === target.customerId);
            const customerName = targetCustomer ? capitalizeName(`${targetCustomer.firstName} ${targetCustomer.lastName}`) : "a customer";
            get().recordAudit(`Refunded ${customerName}'s payment`, "customer", target.customerId, target.name, { amount: target.amountAed, method });
            // Restore any account credit that was applied to this sale so the
            // customer's balance returns to what it was before the checkout.
            // Skipped on rows that didn't use credit (undefined / 0). Silent
            // credit-back — the refund toast is the user-facing signal.
            if (target.accountCreditAppliedAed && target.accountCreditAppliedAed > 0) {
                get().creditWallet({
                    customerId: target.customerId,
                    amountAed: target.accountCreditAppliedAed,
                    reason: "Refunded from checkout",
                    referenceType: "refund",
                    referenceId: target.id,
                    silent: true,
                });
            }
            // Gift-card restore (client 2026-07-31) — put each debited amount
            // back on the exact card it came from, and flip fully-spent cards
            // back to "active" when they still have runway. Mirrors the
            // account-credit restore directly above.
            if (target.giftCardDebits && target.giftCardDebits.length > 0) {
                get().restoreGiftCards(target.giftCardDebits);
            }
            // Retail refund (Phase D.2, 2026-07-29) — restore units to the
            // branch that sold them, and append a matching "refund" audit-log
            // row keyed to the original transaction so the Stock on Hand
            // report's Sell-through % nets correctly.
            if (target.kind === "retail" && target.retailProductId && target.branchIdAtSale && target.quantity) {
                get().adjustRetailStock({
                    productId: target.retailProductId,
                    branchId: target.branchIdAtSale,
                    size: target.retailSize,
                    delta: target.quantity,
                    kind: "refund",
                    reason: `Refunded sale ${target.id}`,
                    sourceTransactionId: target.id,
                });
            }
            // Gift-card sale refund — void the issued card so it can no longer
            // be redeemed, and zero its balance. `status: "refunded"` also drops
            // it from the seller's gift-card commission base (categoryStats
            // skips refunded cards), clawing the commission back.
            if (target.kind === "gift_card" && target.issuedGiftCardId) {
                const cardId = target.issuedGiftCardId;
                set(state => ({
                    issuedGiftCards: state.issuedGiftCards.map(c =>
                        c.id === cardId ? { ...c, status: "refunded" as const, current_balance_aed: 0 } : c,
                    ),
                }));
            }
            // Session refund (2026-08-04) — cancel the booking this sale created
            // so a refunded session doesn't stay live on the schedule. A 1:1
            // session cancels the whole appointment (frees the instructor's
            // slot); an open/capacity session just removes this customer's spot
            // (others on the roster keep theirs). Skips already-cancelled /
            // completed appointments (a delivered session isn't un-booked).
            if ((target.kind === "private" || target.kind === "recovery") && target.appointmentId) {
                const appt = get().appointments.find(a => a.id === target.appointmentId);
                if (appt && appt.status !== "Cancelled" && appt.status !== "Completed") {
                    if (appt.openSession) {
                        const bk = get().appointmentBookings.find(b =>
                            b.appointmentId === appt.id
                            && b.customerId === target.customerId
                            && b.status === "Booked");
                        if (bk) get().cancelAppointmentBooking(bk.id, false, "Refunded");
                    } else {
                        get().cancelAppointment(appt.id, false, "Refunded");
                    }
                }
            }
        }
        // v83 audit-2 fix — a refund reverses paid history, which
        // determines New Active / Won-back / Churned via
        // `hasEverPaid` + `latestPaidISO`. Recompute so a fully-
        // refunded customer doesn't stay pinned to "New Active".
        if (target?.customerId) {
            const cid = target.customerId;
            set(state => recomputePatch(state, cid));
        }
    },

    approveRefundRequest: (id) => {
        const target = get().customerTransactions.find(t => t.id === id);
        if (!target) return;
        // Reuse the refund path so status → refunded + refundedAtISO recorded.
        // Original payment method drives the refund method (falls back to card).
        get().refundTransaction(id, target.paymentMethod === "cash" ? "cash" : "card");
    },

    denyRefundRequest: (id) => {
        const target = get().customerTransactions.find(t => t.id === id);
        set(state => ({
            customerTransactions: state.customerTransactions.map(t =>
                t.id === id ? { ...t, refundRequestedAtISO: undefined, refundRequestReason: undefined } : t,
            ),
        }));
        if (target) {
            const c = get().customers.find(cx => cx.id === target.customerId);
            const name = c ? capitalizeName(`${c.firstName} ${c.lastName}`) : "a customer";
            get().recordAudit(`Denied ${name}'s refund request`, "customer", target.customerId, target.name, { amount: target.amountAed });
        }
    },

    confirmWaitlistBooking: (bookingId) => {
        const booking = get().classBookings.find(b => b.id === bookingId);
        if (!booking || booking.status !== "waitlisted") return;
        set(state => ({
            // Promote the booking: waitlisted → booked, drop its position.
            classBookings: state.classBookings.map(b =>
                b.id === bookingId
                    ? { ...b, status: "booked" as const, waitlistPosition: undefined }
                    : b,
            ),
            // Bump the schedule's booked count so capacity stays truthful
            // across the schedule list + class detail roster.
            classSchedules: state.classSchedules.map(s =>
                s.id === booking.classScheduleId ? { ...s, booked: s.booked + 1 } : s,
            ),
        }));
        const c = get().customers.find(cx => cx.id === booking.customerId);
        const name = c ? capitalizeName(`${c.firstName} ${c.lastName}`) : "a customer";
        const sched = get().classSchedules.find(s => s.id === booking.classScheduleId);
        get().recordAudit(`Confirmed ${name}'s waitlist spot`, "class_schedule", booking.classScheduleId, sched?.name ?? "class");
    },

    // ── Wallet (account-credit AED) ────────────────────────────────────────

    creditWallet: ({ customerId, amountAed, reason, referenceType, referenceId, createdBy, silent }) => {
        const id = `wtxn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const txn: WalletTransaction = {
            id, customerId, branchId: get().customers.find(c => c.id === customerId)?.branchId ?? DEFAULT_BRANCH_ID,
            type: "credit", amountAed, reason,
            referenceType, referenceId,
            createdAtISO: new Date().toISOString(),
            createdBy: createdBy ?? "System",
        };
        set(state => ({ walletTransactions: [txn, ...state.walletTransactions] }));
        const c = get().customers.find(cx => cx.id === customerId);
        const name = c ? capitalizeName(`${c.firstName} ${c.lastName}`) : "a customer";
        get().recordAudit(`Added AED ${amountAed} account credit to ${name}`, "customer", customerId, name, { amount: amountAed, reason });
        if (!silent) {
            get().showToast("Account credit added", `AED ${amountAed} credited to ${name}'s wallet.`, "success", "check");
        }
        return id;
    },

    debitWallet: ({ customerId, amountAed, reason, referenceType, referenceId, createdBy, silent }) => {
        // Never let the balance go negative — reject if it can't cover it.
        const balance = walletBalanceAed(get().walletTransactions, customerId);
        if (amountAed > balance) return false;
        const id = `wtxn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const txn: WalletTransaction = {
            id, customerId, branchId: get().customers.find(c => c.id === customerId)?.branchId ?? DEFAULT_BRANCH_ID,
            type: "debit", amountAed, reason,
            referenceType, referenceId,
            createdAtISO: new Date().toISOString(),
            createdBy: createdBy ?? "System",
        };
        set(state => ({ walletTransactions: [txn, ...state.walletTransactions] }));
        const c = get().customers.find(cx => cx.id === customerId);
        const name = c ? capitalizeName(`${c.firstName} ${c.lastName}`) : "a customer";
        get().recordAudit(`Debited AED ${amountAed} from ${name}'s wallet`, "customer", customerId, name, { amount: amountAed, reason });
        if (!silent) {
            get().showToast("Wallet debited", `AED ${amountAed} used from ${name}'s account credit.`, "success", "check");
        }
        return true;
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
        // Checks BOTH the denormalized flat field on Customer AND the
        // authoritative `customerPlans[]` array (in case the flat field
        // is stale — belt-and-braces for the invariant audit Jul 2026).
        const state = get();
        const heldByCustomer = state.customers.some(c => c.planKind === "membership" && c.membershipId === id);
        const heldInPlans    = state.customerPlans.some(p =>
            p.productId === id
            && p.kind === "membership"
            );  // ANY plan row (any status) = purchase history → archive, never delete
        if (heldByCustomer || heldInPlans) return false;
        set(s => ({ memberships: s.memberships.filter(m => m.id !== id) }));
        return true;
    },
    deleteMemberships: (ids) => {
        const state = get();
        const deleted: string[] = [];
        const blocked: string[] = [];
        for (const id of ids) {
            const heldByCustomer = state.customers.some(c => c.planKind === "membership" && c.membershipId === id);
            const heldInPlans    = state.customerPlans.some(p =>
                p.productId === id
                && p.kind === "membership"
                );  // ANY plan row (any status) = purchase history → archive, never delete
            if (heldByCustomer || heldInPlans) blocked.push(id);
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
    addLead: (input) => {
        const id = input.id ?? `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const next: Lead = {
            ...input,
            id,
            added_at: input.added_at ?? new Date().toISOString(),
        };
        set(state => ({ leads: [next, ...state.leads] }));
        get().recordAudit("Imported lead", "customer", id, next.contact_name);
        // v83 dual-write (client 2026-07-24) — every lead also lands as a
        // Customer row with `lifecycleTag: "Lead"` so the admin surface can
        // filter by lifecycle tag without a second read path. The legacy
        // `leads` slice is retained for the AI Agent's analyze / migrate /
        // reports flows (unchanged). Dedup by email OR phone so an
        // AI-Agent-driven bulk import doesn't create duplicate mirrors.
        const existing = get().customers.find(c => {
            if (next.contact_email && c.email && c.email.toLowerCase() === next.contact_email.toLowerCase()) return true;
            if (next.phone && c.phone && c.phone === next.phone) return true;
            return false;
        });
        if (!existing) {
            const [firstName, ...restName] = (next.contact_name ?? "").trim().split(/\s+/);
            const lastName = restName.join(" ");
            const initials = `${(firstName || "?").charAt(0)}${(lastName || "").charAt(0)}`.toUpperCase() || "?";
            const mirrorId = `cu_from_${id}`;
            const mirror: Customer = {
                id: mirrorId,
                firstName: firstName || next.contact_name || "Lead",
                lastName: lastName || "",
                initials,
                email: next.contact_email ?? "",
                phone: next.phone,
                branchId: next.branch_id,
                planKind: null,
                createdAt: next.added_at ?? new Date().toISOString(),
                status: "active",
                gender: next.gender,
                lifecycleTag: "Lead",
                followUpStatus: lookupStageLabel(get().followUpStages, "stg_new", "New") as FollowUpStatus,
                assignedTo: next.assigned_to_staff_id,
                // Map lead.source (label) to a lead source id when the label
                // matches a seeded source; else store the raw label in the
                // legacy `marketingSource` field so reports still see it.
                sourceId: get().leadSources.find(s =>
                    s.label.toLowerCase() === (next.source ?? "").toLowerCase(),
                )?.id,
                marketingSource: next.source,
            };
            set(state => ({ customers: [mirror, ...state.customers] }));
        } else {
            // Existing customer — patch the lifecycle fields only. Preserve
            // whatever `lifecycleTag` the recompute already assigned (a paid
            // member returning as a "lead" should NOT be downgraded to Lead).
            const newStageLabel = lookupStageLabel(get().followUpStages, "stg_new", "New") as FollowUpStatus;
            set(state => ({
                customers: state.customers.map(c =>
                    c.id === existing.id
                        ? {
                            ...c,
                            lifecycleTag: c.lifecycleTag ?? "Lead",
                            followUpStatus: c.followUpStatus ?? newStageLabel,
                            assignedTo: c.assignedTo ?? next.assigned_to_staff_id,
                            sourceId:
                                c.sourceId ??
                                get().leadSources.find(s =>
                                    s.label.toLowerCase() === (next.source ?? "").toLowerCase(),
                                )?.id,
                            marketingSource: c.marketingSource ?? next.source,
                        }
                        : c,
                ),
            }));
        }
        // v83 Phase 4 — fire the lead_form_submitted trigger. Runs on the
        // mirror customer's id so both the mirror path (new customer) AND
        // the "existing customer got a fresh lead entry" path are covered.
        const mirrorCid = existing?.id ?? `cu_from_${id}`;
        set(state => {
            const fresh = generateFollowUpTasks(mirrorCid, state, {
                triggers: ["lead_form_submitted"],
            });
            return { followUpTasks: applyGeneratedTasks(state.followUpTasks, fresh) };
        });
        return id;
    },
    // v83 audit-3 (2026-07-27) — read-only eligibility probe. Ladder
    // matches logCustomerEnquiry exactly; keeping them in the same file
    // means a store-side gate change only needs to land in one place
    // (previously the UI duplicated this ladder).
    getEnquiryEligibility: (customerId) => {
        const state = get();
        const customer = state.customers.find(c => c.id === customerId);
        if (!customer) return { canLog: false, reason: "dup" as const };
        const lostLabel = lookupStageLabel(state.followUpStages, "stg_lost", "Lost");
        if (customer.followUpStatus === lostLabel) {
            return { canLog: false, reason: "lost" as const };
        }
        const liveTag = computeLifecycleTag(customerId, state).tag;
        if (liveTag !== "Lead" && liveTag !== "Trialist") {
            return { canLog: false, reason: "post_conversion" as const };
        }
        const dup = state.followUpTasks.some(
            t => t.customerId === customerId && t.triggerKind === "enquiry_logged" && t.status === "open",
        );
        if (dup) return { canLog: false, reason: "dup" as const };
        return { canLog: true };
    },
    // v83 Phase 4 — manual "Log enquiry" from the Phase-5 UI button on the
    // profile Follow-ups tab. Returns the new task's id, or null when the
    // generator skipped (Lost / dup / post-conversion). Wired inline via
    // generateFollowUpTasks so precedence rules apply identically to the
    // automatic paths.
    logCustomerEnquiry: (customerId, note) => {
        // v83 audit fix — return the SKIP REASON so the profile Follow-
        // ups tab can render an accurate toast ("Lead marked Lost" vs
        // "Already a member" vs "Open enquiry exists"). Precedence
        // mirrors the generator's — check Lost first, then post-
        // conversion, then dup.
        const before = get();
        const customer = before.customers.find(c => c.id === customerId);
        if (!customer) {
            return { logged: false, reason: "dup" as const };
        }
        const lostLabel = lookupStageLabel(before.followUpStages, "stg_lost", "Lost");
        if (customer.followUpStatus === lostLabel) {
            return { logged: false, reason: "lost" as const };
        }
        // v83 audit-2 fix — compute live so a stale stored tag can't
        // gate this incorrectly (e.g. post-POS-sale Lead).
        const liveTag = computeLifecycleTag(customerId, before).tag;
        if (liveTag !== "Lead" && liveTag !== "Trialist") {
            return { logged: false, reason: "post_conversion" as const };
        }
        const dup = before.followUpTasks.some(
            t => t.customerId === customerId && t.triggerKind === "enquiry_logged" && t.status === "open",
        );
        if (dup) {
            return { logged: false, reason: "dup" as const };
        }
        let materialisedId: string | null = null;
        set(state => {
            const fresh = generateFollowUpTasks(customerId, state, {
                triggers: ["enquiry_logged"],
                enquiryReason: note && note.trim().length > 0 ? note.trim() : undefined,
            });
            if (fresh.length === 0) return state;
            materialisedId = fresh[0].id;
            return { followUpTasks: applyGeneratedTasks(state.followUpTasks, fresh) };
        });
        if (materialisedId) {
            const who = capitalizeName(`${customer.firstName} ${customer.lastName}`);
            get().recordAudit("Logged enquiry", "customer", customerId, who);
            return { logged: true, id: materialisedId };
        }
        // The generator's own dedup dropped it — treat as dup for the UI.
        return { logged: false, reason: "dup" as const };
    },
    // v83 Phase 4 — close a task with a staff-picked outcome. The
    // outcome→followUpStatus mapping mirrors the plan §Phase 5 table.
    // Behavior override is preserved via applyLifecycleResult (Phase 3),
    // so a "not_interested" that flips the customer to "Lost" is
    // automatically cleared later if they book / pay.
    //
    // v83 audit fix — stage labels ("New" → "Contacted" for `reached`,
    // → "Lost" for `not_interested`) are resolved from the state's
    // followUpStages by id (`stg_new` / `stg_contacted` / `stg_lost`)
    // so a studio rename doesn't disable the mapping.
    closeFollowUpTask: (taskId, outcome) => {
        const target = get().followUpTasks.find(t => t.id === taskId);
        if (!target || target.status !== "open") return false;
        const now = new Date().toISOString();
        set(state => ({
            followUpTasks: state.followUpTasks.map(t =>
                t.id === taskId
                    ? { ...t, status: "closed" as const, outcome, closedAt: now }
                    : t,
            ),
        }));
        // Apply the outcome→status side effect. Look up the CURRENT
        // labels so a rename can't silently break the mapping.
        if (outcome === "reached") {
            const stages = get().followUpStages;
            const newLabel = lookupStageLabel(stages, "stg_new", "New");
            const contactedLabel = lookupStageLabel(stages, "stg_contacted", "Contacted");
            const c = get().customers.find(cx => cx.id === target.customerId);
            // v83 audit-1 fix (2026-07-29) — seeded Leads have
            // `followUpStatus === undefined`; the UI renders "New" via a
            // `?? "New"` fallback so the admin sees "New" and the
            // "Reached out" outcome should advance them to Contacted.
            // The prior guard only matched the LITERAL "New" string and
            // silently no-op'd on undefined. Now treat undefined as "New"
            // so the outcome actually moves the pill and the toast copy
            // matches reality.
            const currentEffective = c?.followUpStatus ?? newLabel;
            if (c && currentEffective === newLabel) {
                set(state => ({
                    customers: state.customers.map(cx =>
                        cx.id === target.customerId
                            ? { ...cx, followUpStatus: contactedLabel as typeof cx.followUpStatus }
                            : cx,
                    ),
                }));
            }
        } else if (outcome === "not_interested") {
            const lostLabel = lookupStageLabel(get().followUpStages, "stg_lost", "Lost");
            set(state => ({
                customers: state.customers.map(cx =>
                    cx.id === target.customerId
                        ? { ...cx, followUpStatus: lostLabel as typeof cx.followUpStatus }
                        : cx,
                ),
            }));
        }
        return true;
    },
    // v83 Phase 6 — studio-editable lead sources (PDF §4.1).
    addLeadSource: (label) => {
        const clean = label.trim();
        if (!clean) return "";
        const existing = get().leadSources.find(
            s => s.label.toLowerCase() === clean.toLowerCase(),
        );
        if (existing) return existing.id;
        const id = `src_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        set(state => ({ leadSources: [...state.leadSources, { id, label: clean }] }));
        get().recordAudit("Added lead source", "settings", id, clean);
        return id;
    },
    renameLeadSource: (id, label) => {
        const clean = label.trim();
        if (!clean) return false;
        const list = get().leadSources;
        const target = list.find(s => s.id === id);
        if (!target) return false;
        // Collision check — reject when another (id ≠ target) row has
        // the same label. Case-insensitive.
        const dup = list.find(
            s => s.id !== id && s.label.toLowerCase() === clean.toLowerCase(),
        );
        if (dup) return false;
        const oldLabel = target.label;
        // v83 audit-1 (2026-07-29) — also rewrite any `customer.marketingSource`
        // free-text copy that matches the OLD label so the display fallback
        // (used when `sourceId` isn't set, see CustomerFollowUpsTab
        // `sourceLabelForPanel`) doesn't show the stale name after rename.
        set(state => ({
            leadSources: state.leadSources.map(s => (s.id === id ? { ...s, label: clean } : s)),
            customers: state.customers.map(c =>
                c.marketingSource === oldLabel ? { ...c, marketingSource: clean } : c,
            ),
        }));
        get().recordAudit(`Renamed lead source "${oldLabel}" → "${clean}"`, "settings", id, clean);
        return true;
    },
    deleteLeadSource: (id) => {
        const target = get().leadSources.find(s => s.id === id);
        if (!target) return { deleted: false, reason: "in_use", usageCount: 0 };
        // v83 client 2026-07-27 — lock removed; the only remaining guard
        // is the in-use check so we don't orphan customer.sourceId refs.
        const usageCount = get().customers.filter(c => c.sourceId === id).length;
        if (usageCount > 0) return { deleted: false, reason: "in_use", usageCount };
        set(state => ({ leadSources: state.leadSources.filter(s => s.id !== id) }));
        get().recordAudit("Deleted lead source", "settings", id, target.label);
        return { deleted: true };
    },
    // v83 Phase 6 — studio-editable follow-up stages (PDF §4.2). Max 8
    // stages so the funnel stays scannable.
    addFollowUpStage: (label) => {
        const clean = label.trim();
        if (!clean) return null;
        const list = get().followUpStages;
        if (list.length >= 8) return null;
        const existing = list.find(s => s.label.toLowerCase() === clean.toLowerCase());
        if (existing) return existing.id;
        const id = `stg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        set(state => ({ followUpStages: [...state.followUpStages, { id, label: clean }] }));
        get().recordAudit("Added follow-up stage", "settings", id, clean);
        return id;
    },
    renameFollowUpStage: (id, label) => {
        const clean = label.trim();
        if (!clean) return false;
        const list = get().followUpStages;
        const target = list.find(s => s.id === id);
        if (!target) return false;
        // v83 client 2026-07-27 — no more terminal-rename block. Defaults
        // stay editable so a studio can rename "Won" → "Converted" or
        // "Lost" → "Not converted". Precedence checks still resolve via
        // stable stg_lost / stg_new / stg_contacted ids, so renames don't
        // break the underlying wiring.
        const dup = list.find(
            s => s.id !== id && s.label.toLowerCase() === clean.toLowerCase(),
        );
        if (dup) return false;
        const oldLabel = target.label;
        // Cascade the label change into every customer's followUpStatus so
        // no stale strings survive. The stage's terminal semantics
        // (isTerminal on Won + Lost) stay wired to the id so precedence
        // rules keep working after a rename.
        set(state => ({
            followUpStages: state.followUpStages.map(s => (s.id === id ? { ...s, label: clean } : s)),
            customers: state.customers.map(c =>
                c.followUpStatus === oldLabel
                    ? { ...c, followUpStatus: clean as typeof c.followUpStatus }
                    : c,
            ),
        }));
        get().recordAudit(`Renamed follow-up stage "${oldLabel}" → "${clean}"`, "settings", id, clean);
        return true;
    },
    deleteFollowUpStage: (id) => {
        const target = get().followUpStages.find(s => s.id === id);
        if (!target) return { deleted: false, reason: "in_use", usageCount: 0 };
        // v83 client 2026-07-27 — lock removed. In-use check still blocks
        // deletion of a stage that customers sit on, to avoid orphaning
        // their followUpStatus values.
        const usageCount = get().customers.filter(c => c.followUpStatus === target.label).length;
        if (usageCount > 0) return { deleted: false, reason: "in_use", usageCount };
        set(state => ({ followUpStages: state.followUpStages.filter(s => s.id !== id) }));
        get().recordAudit("Deleted follow-up stage", "settings", id, target.label);
        return { deleted: true };
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
        // Same defensive check as deleteMembership — Customer.packageIds
        // (denormalized) OR customerPlans[] (authoritative) either
        // holding this package id blocks the delete.
        const state = get();
        const heldByCustomer = state.customers.some(c => c.planKind === "package" && (c.packageIds ?? []).includes(id));
        const heldInPlans    = state.customerPlans.some(p =>
            p.productId === id
            && p.kind === "package"
            );  // ANY plan row (any status) = purchase history → archive, never delete
        if (heldByCustomer || heldInPlans) return false;
        set(s => ({ packages: s.packages.filter(p => p.id !== id) }));
        return true;
    },
    deletePackages: (ids) => {
        const state = get();
        const deleted: string[] = [];
        const blocked: string[] = [];
        for (const id of ids) {
            const heldByCustomer = state.customers.some(c => c.planKind === "package" && (c.packageIds ?? []).includes(id));
            const heldInPlans    = state.customerPlans.some(p =>
                p.productId === id
                && p.kind === "package"
                );  // ANY plan row (any status) = purchase history → archive, never delete
            if (heldByCustomer || heldInPlans) blocked.push(id);
            else deleted.push(id);
        }
        if (deleted.length > 0) {
            const deletedSet = new Set(deleted);
            set(s => ({ packages: s.packages.filter(p => !deletedSet.has(p.id)) }));
        }
        return { deleted, blocked };
    },

    // ── Inventory / Retail (Phase A, 2026-07-29) ────────────────────────────
    // Additive action set; no existing action changed. Every mutation emits
    // a recordAudit entry so the Settings → Operations activity log surfaces
    // retail work alongside other CRUD.

    addRetailCategory: (input) => {
        const label = input.label.trim();
        if (!label) return null;
        const dup = get().retailCategories.some(
            c => c.label.toLowerCase() === label.toLowerCase(),
        );
        if (dup) return null;
        const id = `retail_cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const next: RetailCategory = {
            id,
            label,
            imageUrl: input.imageUrl,
            status: "active",
            createdAt: new Date().toISOString(),
        };
        set(state => ({ retailCategories: [...state.retailCategories, next] }));
        get().recordAudit("Created retail category", "retail_category", id, label);
        return id;
    },
    updateRetailCategory: (id, patch) => {
        const target = get().retailCategories.find(c => c.id === id);
        if (!target) return false;
        if (patch.label !== undefined) {
            const clean = patch.label.trim();
            if (!clean) return false;
            const dup = get().retailCategories.some(
                c => c.id !== id && c.label.toLowerCase() === clean.toLowerCase(),
            );
            if (dup) return false;
            patch = { ...patch, label: clean };
        }
        set(state => ({
            retailCategories: state.retailCategories.map(c =>
                c.id === id ? { ...c, ...patch } : c,
            ),
        }));
        get().recordAudit("Edited retail category", "retail_category", id, patch.label ?? target.label);
        return true;
    },
    canDeleteRetailCategory: (id) => {
        const usageCount = get().retailProducts.filter(
            p => p.categoryId === id && p.status !== "archived",
        ).length;
        if (usageCount > 0) return { deletable: false, reason: "in_use" as const, usageCount };
        return { deletable: true as const };
    },
    deleteRetailCategory: (id) => {
        const target = get().retailCategories.find(c => c.id === id);
        if (!target) return false;
        const gate = get().canDeleteRetailCategory(id);
        if (!gate.deletable) return false;
        set(state => ({ retailCategories: state.retailCategories.filter(c => c.id !== id) }));
        get().recordAudit("Deleted retail category", "retail_category", id, target.label);
        return true;
    },

    addRetailProduct: (input) => {
        const sku = input.sku.trim();
        const name = input.name.trim();
        if (!sku || !name) return null;
        // SKU is unique across active + inactive rows; archived rows are
        // ignored so retiring a product doesn't lock its SKU forever.
        const dup = get().retailProducts.some(
            p => p.status !== "archived" && p.sku.toLowerCase() === sku.toLowerCase(),
        );
        if (dup) return null;
        const id = input.id ?? `retail_prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();
        const next: RetailProduct = {
            ...input,
            id,
            name,
            sku,
            createdAt: now,
            updatedAt: now,
        };
        set(state => ({ retailProducts: [...state.retailProducts, next] }));
        get().recordAudit("Created retail product", "retail_product", id, name);
        return id;
    },
    updateRetailProduct: (id, patch) => {
        const target = get().retailProducts.find(p => p.id === id);
        if (!target) return false;
        if (patch.sku !== undefined) {
            const cleanSku = patch.sku.trim();
            if (!cleanSku) return false;
            const dup = get().retailProducts.some(
                p => p.id !== id && p.status !== "archived" && p.sku.toLowerCase() === cleanSku.toLowerCase(),
            );
            if (dup) return false;
            patch = { ...patch, sku: cleanSku };
        }
        const now = new Date().toISOString();
        set(state => ({
            retailProducts: state.retailProducts.map(p =>
                p.id === id ? { ...p, ...patch, updatedAt: now } : p,
            ),
        }));
        get().recordAudit("Edited retail product", "retail_product", id, target.name);
        return true;
    },
    setRetailProductStatus: (ids, status) => {
        const targets = get().retailProducts.filter(p => ids.includes(p.id));
        if (targets.length === 0) return;
        const now = new Date().toISOString();
        set(state => {
            const idSet = new Set(ids);
            return {
                retailProducts: state.retailProducts.map(p =>
                    idSet.has(p.id) ? { ...p, status, updatedAt: now } : p,
                ),
            };
        });
        const verb = status === "active" ? "Reactivated" : status === "inactive" ? "Deactivated" : "Archived";
        targets.forEach(t =>
            get().recordAudit(`${verb} retail product`, "retail_product", t.id, t.name, { status }),
        );
    },
    canDeleteRetailProduct: (id) => {
        // Hard delete blocked when the product carries ANY historical
        // record — either a past receipt (customerTransactions with the
        // retailProductId) OR any stock adjustment (receive / sale /
        // adjust / loss / refund). Snapshot fields on past receipts and
        // the audit-log rows would otherwise dangle. Archive-only for
        // products with history; Deactivate is offered by the UI when
        // the admin wants to hide-but-keep.
        const state = get();
        const txnCount = state.customerTransactions.filter(
            t => t.retailProductId === id,
        ).length;
        const adjCount = state.retailStockAdjustments.filter(
            a => a.productId === id,
        ).length;
        const total = txnCount + adjCount;
        if (total > 0) return { deletable: false, reason: "has_history" as const, transactionCount: total };
        return { deletable: true as const };
    },
    deleteRetailProducts: (ids) => {
        const state = get();
        const deleted: string[] = [];
        const blocked: string[] = [];
        for (const id of ids) {
            const gate = state.canDeleteRetailProduct(id);
            if (gate.deletable) deleted.push(id);
            else blocked.push(id);
        }
        if (deleted.length > 0) {
            const deletedSet = new Set(deleted);
            const deletedTargets = state.retailProducts.filter(p => deletedSet.has(p.id));
            set(s => ({
                retailProducts: s.retailProducts.filter(p => !deletedSet.has(p.id)),
                // Also drop the per-branch stock rows + adjustment history
                // for a fully-deleted product — they'd be orphans otherwise
                // (the block above already refused deletion when history
                // exists, so no receipt is losing its snapshot data).
                retailStock: s.retailStock.filter(st => !deletedSet.has(st.productId)),
                retailStockAdjustments: s.retailStockAdjustments.filter(
                    a => !deletedSet.has(a.productId),
                ),
            }));
            deletedTargets.forEach(t =>
                get().recordAudit("Deleted retail product", "retail_product", t.id, t.name),
            );
        }
        return { deleted, blocked };
    },

    adjustRetailStock: (input) => {
        const { productId, branchId, size, delta, kind, reason, sourceTransactionId } = input;
        const now = new Date().toISOString();
        const adjId = `retail_adj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const currentUserId = get().currentUser?.staff_id ?? get().currentUser?.id ?? "unknown";
        const state = get();
        // Keyed by (product × branch × size). `size` is undefined for sizeless
        // products, so the equality check matches the single sizeless row.
        const existing = state.retailStock.find(
            s => s.productId === productId && s.branchId === branchId && (s.size ?? undefined) === (size ?? undefined),
        );
        const currentUnits = existing?.unitsOnHand ?? 0;
        // Clamp negative deltas at 0 so demo data can't drift below zero.
        const nextUnits = Math.max(0, currentUnits + delta);
        // Real delta applied — may differ from requested `delta` when the
        // clamp fires. Kept honest in the audit log for future debugging.
        const appliedDelta = nextUnits - currentUnits;
        const adjustment: RetailStockAdjustment = {
            id: adjId,
            productId,
            branchId,
            ...(size ? { size } : {}),
            delta: appliedDelta,
            kind,
            reason,
            sourceTransactionId,
            createdBy: currentUserId,
            createdAt: now,
        };
        set(s => {
            // Update or insert the stock row + append the adjustment in a
            // single set() so the running balance + audit log commit
            // atomically. React sees one consistent state.
            const stockRows = existing
                ? s.retailStock.map(row =>
                    row.id === existing.id
                        ? {
                            ...row,
                            unitsOnHand: nextUnits,
                            lastAdjustedAt: now,
                            lastReceivedAt: kind === "receive" ? now : row.lastReceivedAt,
                        }
                        : row,
                )
                : [
                    ...s.retailStock,
                    {
                        id: `retail_stock_${productId}_${branchId}${size ? `_${size}` : ""}_${Date.now()}`,
                        productId,
                        branchId,
                        ...(size ? { size } : {}),
                        unitsOnHand: nextUnits,
                        lastAdjustedAt: now,
                        lastReceivedAt: kind === "receive" ? now : undefined,
                    },
                ];
            return {
                retailStock: stockRows,
                retailStockAdjustments: [...s.retailStockAdjustments, adjustment],
            };
        });
        return adjId;
    },
    receiveRetailStock: (input) => {
        return get().adjustRetailStock({
            productId: input.productId,
            branchId: input.branchId,
            size: input.size,
            delta: Math.max(0, Math.abs(input.units)),
            kind: "receive",
            reason: input.reason ?? "Received shipment",
        });
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

    giftCardBalanceFor: (customerId) => {
        const todayISO = new Date().toISOString();
        return get().issuedGiftCards
            .filter(c =>
                c.customer_id === customerId &&
                c.status === "active" &&
                c.expires_at > todayISO &&
                c.current_balance_aed > 0)
            .reduce((sum, c) => sum + c.current_balance_aed, 0);
    },

    redeemGiftCards: (customerId, amountAed) => {
        const want = Math.max(0, Math.round(amountAed));
        if (want <= 0) return { applied: 0, debits: [] };
        const nowISO = new Date().toISOString();
        // Oldest expiry FIRST — spend the card closest to lapsing before
        // one with runway, so the customer loses as little value as
        // possible to expiry.
        const spendable = get().issuedGiftCards
            .filter(c =>
                c.customer_id === customerId &&
                c.status === "active" &&
                c.expires_at > nowISO &&
                c.current_balance_aed > 0)
            .sort((a, b) => a.expires_at.localeCompare(b.expires_at));

        const debits: { cardId: string; amountAed: number }[] = [];
        let remaining = want;
        for (const card of spendable) {
            if (remaining <= 0) break;
            const take = Math.min(card.current_balance_aed, remaining);
            debits.push({ cardId: card.id, amountAed: take });
            remaining -= take;
        }
        const applied = want - remaining;
        if (applied <= 0) return { applied: 0, debits: [] };

        const byId = new Map(debits.map(d => [d.cardId, d.amountAed]));
        set(state => ({
            issuedGiftCards: state.issuedGiftCards.map(c => {
                const take = byId.get(c.id);
                if (take === undefined) return c;
                const nextBalance = Math.max(0, c.current_balance_aed - take);
                return {
                    ...c,
                    current_balance_aed: nextBalance,
                    // Fully-spent cards flip to "redeemed" so they drop out
                    // of the spendable pool + read correctly in the Gift
                    // Card report's status column.
                    status: nextBalance === 0 ? "redeemed" as const : c.status,
                    last_redeemed_at: nowISO,
                };
            }),
        }));
        get().recordAudit(
            "Redeemed gift card",
            "customer",
            customerId,
            `AED ${applied} across ${debits.length} card${debits.length === 1 ? "" : "s"}`,
        );
        return { applied, debits };
    },

    restoreGiftCards: (debits) => {
        if (debits.length === 0) return;
        const nowISO = new Date().toISOString();
        const byId = new Map(debits.map(d => [d.cardId, d.amountAed]));
        set(state => ({
            issuedGiftCards: state.issuedGiftCards.map(c => {
                const give = byId.get(c.id);
                if (give === undefined) return c;
                const nextBalance = c.current_balance_aed + give;
                return {
                    ...c,
                    current_balance_aed: nextBalance,
                    // A card that was fully spent becomes redeemable again.
                    // Expired cards stay expired — restoring value doesn't
                    // un-expire a card whose date has passed.
                    status: c.status === "redeemed" && nextBalance > 0
                        ? (c.expires_at > nowISO ? "active" as const : "expired" as const)
                        : c.status,
                };
            }),
        }));
    },

    // ── Promo codes ────────────────────────────────────────────────────────

    addImportHistory: (input) => {
        const id =
            input.id ?? `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const next: ImportHistorySeed = {
            ...input,
            id,
            imported_at: input.imported_at ?? new Date().toISOString(),
        };
        // Newest first — matches how the /admin/settings/migrations-imports
        // table sorts by default (most recent import at the top).
        set(state => ({ importHistory: [next, ...state.importHistory] }));
        // targetType "settings" is the closest fit — the import runs from
        // Settings → Operations → Migration & imports. The audit surface
        // doesn't have a dedicated "import" bucket yet.
        get().recordAudit(
            "Imported data via AI Agent",
            "settings",
            id,
            `${next.data_type} · ${next.imported_rows} rows`,
        );
        return id;
    },

    addPromoCode: (input) => {
        const id = input.id ?? `promo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const next: PromoCode = {
            ...input,
            id,
            created_at: input.created_at ?? new Date().toISOString(),
        };
        set(state => ({ promoCodes: [...state.promoCodes, next] }));
        get().recordAudit("Created promotion", "promo_code", id, next.code);
        return id;
    },
    updatePromoCode: (id, patch) => {
        const target = get().promoCodes.find(p => p.id === id);
        set(state => ({ promoCodes: state.promoCodes.map(p => p.id === id ? { ...p, ...patch } : p) }));
        if (target) get().recordAudit("Edited promotion", "promo_code", id, target.code);
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
        get().recordAudit(
            next.type === "announcement" ? "Published announcement" : "Created marketing campaign",
            "marketing", id, next.title,
        );
        // Publishing an active announcement pushes it to opted-in customers
        // (consent gate applied feed-side).
        if (next.type === "announcement" && next.status === "active") {
            customerAnnouncementSink.emit?.({
                id: next.id,
                title: next.title,
                message: next.short_description,
                branchIds: next.branch_ids ?? [],
            });
        }
        // Sending a campaign pushes it to its audience (consent-gated) AND
        // records the send in `marketingCampaignStats` — the single write-path
        // that makes Campaign Performance + Insights + Dashboard reflect real
        // sends. `sends` = the exact reach the form previewed.
        if (next.type === "campaign" && next.delivery_status === "sent") {
            const st = get();
            const sends = campaignRecipients(
                {
                    kind: next.audience_kind ?? "everyone",
                    membershipIds: next.audience_membership_ids,
                    segments: next.audience_segments,
                    customerIds: next.audience_customer_ids,
                    branchIds: next.branch_ids ?? [],
                },
                next.topic,
                st.customers, st.customerPlans, st.customerTransactions,
            ).length;
            const statRow = {
                id: `cstat_${id}`,
                campaign_id: id,
                campaign_name: next.title,
                channel: "push" as const,
                sent_at: next.sent_at ?? new Date().toISOString(),
                sends,
                // Simulated engagement (deterministic) — a fresh send has no
                // attribution yet, so bookings/revenue start at 0.
                opens_reads: Math.round(sends * 0.45),
                clicks_taps: Math.round(sends * 0.08),
                attributed_bookings: 0,
                attributed_revenue_aed: 0,
                attribution_window: "7 days",
                branch_id: next.branch_ids?.[0] ?? DEFAULT_BRANCH_ID,
            };
            set(state => ({ marketingCampaignStats: [...state.marketingCampaignStats, statRow] }));
            customerCampaignSink.emit?.({
                id, title: next.title, message: next.short_description,
                branchIds: next.branch_ids ?? [], topic: next.topic,
            });
        }
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
            payrollEntries: state.payrollEntries.map(e => {
                if (!ids.includes(e.id)) return e;
                // Snapshot commission at run-confirm ("paid") — past runs
                // stay frozen even if the rate's commission % changes later.
                // Non-Monthly rates + zero-percent rates get an empty snapshot
                // so the field shape is uniform across entries.
                if (status === "paid") {
                    const rate = state.payRates.find(r => r.id === e.payRateId);
                    // Categorised commission (Phase 3) — snapshot the total at
                    // run confirm so past runs stay frozen even if the rate's
                    // rows change later.
                    const c = commissionForPeriod(
                        e.instructorId,
                        rate,
                        {
                            transactions:        state.customerTransactions,
                            classBookings:       state.classBookings,
                            classSchedules:      state.classSchedules,
                            appointmentBookings: state.appointmentBookings,
                            appointments:        state.appointments,
                            issuedGiftCards:     state.issuedGiftCards,
                        },
                        e.periodStart,
                        e.periodEnd,
                    );
                    return {
                        ...e,
                        status,
                        ...(payrollRunId ? { payrollRunId } : {}),
                        commissionAmount:              c.totalCommission,
                        totalEarnings: e.baseEarnings + e.adjustmentAmount + c.totalCommission,
                    };
                }
                return { ...e, status, ...(payrollRunId ? { payrollRunId } : {}) };
            }),
        }));
        if (status === "paid") {
            get().recordAudit("Ran payroll", "payroll", payrollRunId ?? "run", `${ids.length} entries`, { entries: ids.length });
        }
    },
    createPayrollEntries: (specs) => {
        // Deterministic id shape so audits + logs read cleanly. Non-instructor
        // staff entries land here at Run Payroll confirm time so their row can
        // be marked Paid alongside the instructor rows.
        const stamp = Date.now();
        const created: PayrollEntry[] = specs.map((spec, i) => ({
            ...spec,
            id: `pe_run_${stamp}_${i}`,
            status: spec.status ?? "pending",
            createdAt: new Date(stamp).toISOString(),
        }));
        set((state) => ({
            payrollEntries: [...state.payrollEntries, ...created],
        }));
        return created.map((e) => e.id);
    },
    setPayrollEntryAdjustment: (id, amount, reason) => {
        set(state => ({
            payrollEntries: state.payrollEntries.map(e =>
                e.id === id
                    ? { ...e, adjustmentAmount: amount, adjustmentReason: reason, totalEarnings: e.baseEarnings + amount + (e.commissionAmount ?? 0) }
                    : e,
            ),
        }));
        const target = get().payrollEntries.find(e => e.id === id);
        if (target) {
            const instructor = get().instructors.find(i => i.id === target.instructorId);
            get().recordAudit("Adjusted payroll entry", "payroll", id, instructor?.name ?? target.payRateName, { amount, reason: reason ?? "" });
        }
    },

    // ── Customer notification settings (v27) ──────────────────────────────
    /** Toggle a channel on a notification row. Returns `false` (and
     *  DOES NOT mutate) when the caller tried to disable the last
     *  enabled channel on a critical row — the UI reads that return
     *  value to fire the "at least one channel stays on" toast. */
    setNotificationEventChannel: (id, channel, enabled) => {
        const row = get().notificationSettings.find(n => n.id === id);
        if (!row) return false;
        // Payment-critical guard — count enabled channels AFTER the
        // hypothetical flip and refuse if we'd drop to zero.
        if (row.isCritical && !enabled) {
            const nextEmail    = channel === "email"    ? false : row.emailEnabled;
            const nextWhatsapp = channel === "whatsapp" ? false : row.whatsappEnabled;
            const nextSms      = channel === "sms"      ? false : row.smsEnabled;
            const remaining = [nextEmail, nextWhatsapp, nextSms].filter(Boolean).length;
            if (remaining === 0) return false;
        }
        set(state => ({
            notificationSettings: state.notificationSettings.map(n =>
                n.id !== id ? n :
                channel === "email"    ? { ...n, emailEnabled:    enabled } :
                channel === "whatsapp" ? { ...n, whatsappEnabled: enabled } :
                                         { ...n, smsEnabled:      enabled },
            ),
        }));
        return true;
    },
    updateNotificationTemplate: (id, patch) =>
        set(state => ({
            notificationSettings: state.notificationSettings.map(n => {
                if (n.id !== id) return n;
                // Editing the WhatsApp body invalidates any prior
                // approval — Meta re-reviews every content change,
                // so we flip status back to "pending" (mirrors the
                // real Business API behaviour).
                //
                // Both sides get nullish-coerced to "" so a seed row
                // with NO `whatsapp_template` (undefined) compares
                // equal to the modal's default empty buffer. Otherwise
                // opening the WA tab on such a row and saving unedited
                // would silently flip approval to "pending" — approval
                // reset with no user intent + a misleading "saved"
                // toast (see audit fix #4).
                const nextWa = patch.whatsappTemplate;
                const whatsappEdited =
                    nextWa !== undefined
                    && (nextWa ?? "") !== (n.whatsappTemplate ?? "");
                return {
                    ...n,
                    ...patch,
                    ...(whatsappEdited
                        ? { whatsappApprovalStatus: "pending" as const,
                            whatsappRejectionReason: undefined }
                        : {}),
                };
            }),
        })),
    setNotificationEventCritical: (id, isCritical) => {
        const row = get().notificationSettings.find(n => n.id === id);
        if (!row) return false;
        // Turning critical ON must guarantee at least one channel is on —
        // otherwise the "one channel stays on" contract enforced by
        // `setNotificationEventChannel` would be broken immediately. If
        // every channel is off when the admin flips critical, auto-enable
        // Email (the default primary channel — same as payments seed).
        // Client-flagged Jul 2026: the previous behavior refused the toggle
        // silently which read as "critical doesn't work here", when the fix
        // is just to make Email the default delivery when none is picked.
        let autoEnabledEmail = false;
        if (isCritical) {
            const anyChannelOn = row.emailEnabled || row.whatsappEnabled || row.smsEnabled;
            if (!anyChannelOn) autoEnabledEmail = true;
        }
        set(state => ({
            notificationSettings: state.notificationSettings.map(n => {
                if (n.id !== id) return n;
                return {
                    ...n,
                    isCritical,
                    ...(autoEnabledEmail ? { emailEnabled: true } : {}),
                };
            }),
        }));
        return true;
    },
    updateNotificationTiming: (id, patch) =>
        set(state => ({
            notificationSettings: state.notificationSettings.map(n =>
                n.id === id ? { ...n, ...patch } : n,
            ),
        })),
    addMarketingBranchOverride: (parentId, branchId) => {
        const parent = get().notificationSettings.find(n => n.id === parentId);
        // Not-found or category-wrong → return an empty id, no-op mutation.
        if (!parent || parent.category !== "marketing") return "";
        // Idempotent: if this branch already has an override for this
        // parent, return its id and leave state alone.
        const existing = get().notificationSettings.find(
            n => n.notificationType === parent.notificationType && n.branchId === branchId,
        );
        if (existing) return existing.id;
        const id = `ns_${parent.notificationType}_${branchId}`;
        const override: NotificationSetting = {
            // Copy every field from the parent so the override starts as
            // a safe clone. Admin then tweaks channel toggles / templates
            // for that branch.
            ...parent,
            id,
            branchId,
            // Templates + toggles cloned. Rejection reason cleared — a
            // fresh row hasn't been resubmitted to Meta yet, so pending
            // is the honest default when the parent was rejected.
            whatsappApprovalStatus: parent.whatsappApprovalStatus === "rejected"
                ? "pending"
                : parent.whatsappApprovalStatus,
            whatsappRejectionReason: undefined,
            // sendOffsets — copy so edits to the override don't mutate
            // the parent's array by reference.
            sendOffsets: parent.sendOffsets.map(o => ({ ...o })),
        };
        set(state => ({
            notificationSettings: [...state.notificationSettings, override],
        }));
        return id;
    },
    removeMarketingBranchOverride: (id) => {
        // No-op guard: only remove if the row IS a branch override
        // (has branchId) — never nuke a studio-wide default.
        const row = get().notificationSettings.find(n => n.id === id);
        if (!row || !row.branchId) return;
        set(state => ({
            notificationSettings: state.notificationSettings.filter(n => n.id !== id),
        }));
    },
    updateNotificationDeliverySettings: (patch) => {
        set(state => ({
            notificationDeliverySettings: { ...state.notificationDeliverySettings, ...patch },
        }));
        get().recordAudit(
            "Updated delivery hours",
            "settings",
            "notification_delivery",
            "Delivery hours",
        );
    },

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
        get().recordAudit("Updated referral rewards", "settings", "referral_rewards", "Reward rules & limits");
    },
    updateReferralEligibility: (patch) => {
        set(state => ({
            referralSettings: { ...state.referralSettings, ...patch },
        }));
        get().recordAudit("Updated referral eligibility", "settings", "referral_eligibility", "Eligibility & safeguards");
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
    setRoundingMode: (mode) =>
        set(state => ({
            taxSettings: { ...state.taxSettings, roundingMode: mode },
        })),
    setTaxTrn: (value) =>
        set(state => ({
            // Normalise empty string → undefined so callers can distinguish
            // "no TRN issued yet" from "TRN cleared to empty" cleanly. The
            // UI shows a placeholder in both cases.
            taxSettings: {
                ...state.taxSettings,
                trn: value.trim() === "" ? undefined : value.trim(),
            },
        })),
    setTaxTrnCountry: (value) =>
        set(state => ({
            taxSettings: {
                ...state.taxSettings,
                trnCountry: value.trim() === "" ? undefined : value.trim(),
            },
        })),
    setDisplayTrnOnInvoice: (value) =>
        set(state => ({
            taxSettings: { ...state.taxSettings, displayTrnOnInvoice: value },
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
        set(state => {
            // Runtime kind-matching guard — the UI's dropdown filter
            // restricts rate options per category, but a programmatic
            // callsite could otherwise attach a VAT rate to a pay_rate
            // rule (or vice versa). Silently drop the bad taxRateId so
            // POS / customer checkout / payroll never resolve a
            // mismatched rate.
            //
            // Mirrors `kindForCategory` in ApplyTaxRatesView:
            //   pay_rate → income
            //   everything else → vat
            return {
                taxRules: state.taxRules.map(r => {
                    if (r.id !== id) return r;
                    const next = { ...r, ...patch };
                    if (next.taxRateId) {
                        const expectedKind: "vat" | "income" = next.category === "pay_rate" ? "income" : "vat";
                        const referenced = state.taxRates.find(t => t.id === next.taxRateId);
                        if (referenced && referenced.kind !== expectedKind) {
                            next.taxRateId = undefined;
                        }
                    }
                    return next;
                }),
            };
        }),
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
                // When a new version publishes, customers with a prior
                // signed row on this agreement transition to
                // `re_accept_due` on the new-version row (they had a
                // signature, now need to re-accept the update).
                // Customers with no prior signed rows stay
                // `never_signed`. The row we're creating is FOR the
                // new version specifically, so it's always one of the
                // two not-signed states — never `signed` at creation.
                const hadSignedPriorVersion = state.customerAgreements.some(ca =>
                    ca.agreementId === input.agreementId
                    && ca.customerId === customerId
                    && ca.status === "signed",
                );
                newCustomerRows.push({
                    id: `agr_${customerId}_v${input.versionNumber}_${Math.random().toString(36).slice(2, 6)}`,
                    customerId,
                    agreementId: input.agreementId,
                    title: parentName,
                    version: input.versionNumber,
                    branchId,
                    classTemplateIds: parent?.applicableClassTemplateIds ?? [],
                    status: hadSignedPriorVersion ? "re_accept_due" : "never_signed",
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
            // Republishing an existing version forces every SIGNED
            // customer on this version to re-accept — flips them to
            // `re_accept_due` (v24 rename — was `"unsigned"` in v23).
            // Their prior signedAt stays on record so the acceptance
            // table can still show "Signed V4 · prompted at next
            // booking".
            customerAgreements: state.customerAgreements.map(ca =>
                ca.agreementId === agreementId
                && ca.version === versionNumber
                && ca.status === "signed"
                    ? { ...ca, status: "re_accept_due" as const }
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
        set(state => {
            // Locked rows (Owner) ignore patches except status flips coming
            // from setRolesStatus (which uses a separate code path below).
            const before = state.roles.find(r => r.id === id);
            if (!before || before.locked) return {};
            const nextRole = { ...before, ...patch };
            const nextRoles = state.roles.map(r => r.id === id ? nextRole : r);
            // Roles are branch-agnostic — editing a role never touches any
            // staffer's branch (branch lives on the person, set at
            // assignment time).
            return { roles: nextRoles };
        }),
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

    // ── Shift actions (Shift management module) ───────────────────────────
    addShift: (input) => {
        const id = input.id ?? `shift_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const next: Shift = { ...input, id, created_at: new Date().toISOString() };
        set(state => ({ shifts: [...state.shifts, next] }));
        get().recordAudit("Created shift", "shift", id, next.name);
        return id;
    },
    updateShift: (id, patch) => {
        const before = get().shifts.find(s => s.id === id);
        set(state => ({
            shifts: state.shifts.map(s => s.id === id ? { ...s, ...patch } : s),
        }));
        if (before) get().recordAudit("Edited shift", "shift", id, patch.name ?? before.name);
    },
    setShiftsStatus: (ids, status) => {
        const before = get().shifts.filter(s => ids.includes(s.id));
        set(state => ({
            shifts: state.shifts.map(s =>
                ids.includes(s.id) ? { ...s, status } : s,
            ),
        }));
        // Audit verb mirrors the toast — keeps the activity feed legible.
        const verb = status === "archive"  ? "Archived shift"
                   : status === "inactive" ? "Deactivated shift"
                                           : "Reactivated shift";
        for (const s of before) get().recordAudit(verb, "shift", s.id, s.name);
    },
    deleteShifts: (ids) => {
        // Deleting a shift CASCADES (client 2026-08): the shift is removed along
        // with every `shiftAssignments` row pointing at it, AND any staff whose
        // legacy primary `staff.shiftId` referenced it has that cleared — then
        // instructors re-sync from the patched staff so no dangling reference
        // survives. Attendance / schedules key off `instructorId` (never a shift
        // id), so they stay consistent automatically.
        const idSet = new Set(ids);
        const before = get().shifts.filter(s => idSet.has(s.id));
        if (before.length === 0) return { deleted: [], blocked: [] };
        // Staff whose primary shift pointer is about to dangle → clear + resync.
        const affectedStaffIds = get().staff.filter(s => s.shiftId && idSet.has(s.shiftId)).map(s => s.id);
        set(state => {
            const nextStaff = state.staff.map(s =>
                s.shiftId && idSet.has(s.shiftId) ? { ...s, shiftId: undefined } : s,
            );
            return {
                shifts: state.shifts.filter(s => !idSet.has(s.id)),
                shiftAssignments: state.shiftAssignments.filter(a => !idSet.has(a.shift_id)),
                staff: nextStaff,
                instructors: affectedStaffIds.length
                    ? syncInstructorsFromStaff(state.instructors, nextStaff, state.roles, affectedStaffIds)
                    : state.instructors,
            };
        });
        for (const s of before) get().recordAudit("Deleted shift", "shift", s.id, s.name);
        return { deleted: before.map(s => s.id), blocked: [] };
    },

    // ── Shift assignment actions (client 2026-07-22 many-to-many) ─────────
    addShiftAssignment: (input) => {
        const { shift_id, staff_id, days_of_week, week_start } = input;
        // Idempotent per (shift, staff, week) — a week-scoped row and the
        // recurring baseline (no week) are distinct, so the same trio returns
        // the existing row rather than duplicating.
        const existing = get().shiftAssignments.find(
            a => a.shift_id === shift_id && a.staff_id === staff_id && (a.week_start ?? null) === (week_start ?? null),
        );
        if (existing) return existing.id;
        const parent = get().shifts.find(s => s.id === shift_id);
        const defaultDays = parent?.working_days ?? [false, false, false, false, false, false, false];
        // Week-scoped rows carry the week in the id so multiple weeks coexist.
        const id = week_start ? `sa_${shift_id}_${staff_id}_${week_start}` : `sa_${shift_id}_${staff_id}`;
        const next: ShiftAssignment = {
            id,
            shift_id,
            staff_id,
            days_of_week: days_of_week ?? [...defaultDays],
            ...(week_start ? { week_start } : {}),
            created_at: new Date().toISOString(),
        };
        set(state => ({ shiftAssignments: [...state.shiftAssignments, next] }));
        return id;
    },
    removeShiftAssignment: (id) => {
        set(state => {
            const row = state.shiftAssignments.find(a => a.id === id);
            const shiftAssignments = state.shiftAssignments.filter(a => a.id !== id);
            if (!row) return { shiftAssignments };
            // Keep the legacy `shiftId` in sync — if we just removed the row
            // backing a staff member's PRIMARY shift, clear the primary too.
            // Otherwise the availability readers (customer slot picker,
            // instructor gating) fall back to `staff.shiftId` once the staff
            // has zero M2M rows and would keep honouring a shift they no
            // longer hold. Client 2026-07-23.
            const owner = state.staff.find(s => s.id === row.staff_id);
            if (!owner || owner.shiftId !== row.shift_id) return { shiftAssignments };
            const nextStaff = state.staff.map(s =>
                s.id === row.staff_id ? { ...s, shiftId: undefined } : s,
            );
            return {
                shiftAssignments,
                staff: nextStaff,
                instructors: syncInstructorsFromStaff(state.instructors, nextStaff, state.roles, [row.staff_id]),
            };
        });
    },
    updateShiftAssignmentDays: (id, days) => {
        set(state => ({
            shiftAssignments: state.shiftAssignments.map(a =>
                a.id === id ? { ...a, days_of_week: [...days] } : a,
            ),
        }));
    },

    // ── Blocked time actions (Staff & shift module) ──────────────────────
    //
    // Adds also fan out an instructor-bell notification to every staff in
    // the entry so the affected instructors see their schedule change in
    // real time. Removals fire the inverse "removed" notification so the
    // bell can show a "your blocked time was cleared" row.
    addBlockedTime: (input) => {
        const id = input.id ?? `bt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const next: BlockedTime = { ...input, id, created_at: new Date().toISOString() };
        set(state => ({ blockedTimes: [...state.blockedTimes, next] }));
        const targetName = next.title.trim() || "Blocked";
        get().recordAudit("Added blocked time", "blocked_time", id, targetName, {
            date: next.date, staff: next.staff_ids.length,
        });
        // One instructor-bell row per assigned staff so each instructor's
        // feed scopes correctly via targetInstructorId.
        const staffById = new Map(get().staff.map(s => [s.id, s] as const));
        for (const sid of next.staff_ids) {
            const s = staffById.get(sid);
            if (!s) continue;
            get().emitNotifications({
                instructor: {
                    tab: "booking",
                    event: "blocked_time_added",
                    title: "Blocked time added",
                    body: `${targetName} on ${next.date} (${next.start_time}–${next.end_time}).`,
                    icon: "calendar-x",
                    sourceModule: "class",
                    sourceId: id,
                    branchId: next.branch_id,
                    targetInstructorId: sid,
                },
            });
        }

        // ── Auto-cancel + refund ────────────────────────────────────────────
        // Any UPCOMING class or appointment an affected instructor already has
        // during this time-off window is cancelled (studio-side) and the booked
        // customers' credits are refunded. Past / already-cancelled sessions are
        // left untouched. Client 2026-08.
        const winFrom = next.date_from_iso ?? next.date;
        const winTo = next.date_to_iso ?? next.date;
        const todayISO = new Date().toISOString().slice(0, 10);
        const toMin = (t: string) => {
            const [h, m] = (t ?? "").split(":").map(Number);
            return (h || 0) * 60 + (m || 0);
        };
        // Overlap in minutes; an all-day block covers the whole day.
        const overlapsBlock = (aStart: string, aEnd: string) =>
            next.all_day || (toMin(aStart) < toMin(next.end_time) && toMin(aEnd) > toMin(next.start_time));
        const affectedStaff = new Set(next.staff_ids);

        const affectedClasses = get().classSchedules.filter(
            (c) =>
                affectedStaff.has(c.instructorId) &&
                c.dateISO >= winFrom &&
                c.dateISO <= winTo &&
                c.dateISO >= todayISO &&
                c.status !== "Cancelled" &&
                overlapsBlock(c.startTime, c.endTime),
        );
        for (const c of affectedClasses) get().cancelClassSchedule(c.id, true, "Instructor time off");

        const affectedAppts = get().appointments.filter(
            (a) =>
                !!a.instructorId &&
                affectedStaff.has(a.instructorId) &&
                a.dateISO >= winFrom &&
                a.dateISO <= winTo &&
                a.dateISO >= todayISO &&
                a.status !== "Cancelled" &&
                overlapsBlock(a.startTime, a.endTime),
        );
        for (const a of affectedAppts) get().cancelAppointment(a.id, true, "Instructor time off");

        return id;
    },
    updateBlockedTime: (id, patch) => {
        const before = get().blockedTimes.find(b => b.id === id);
        set(state => ({
            blockedTimes: state.blockedTimes.map(b => b.id === id ? { ...b, ...patch } : b),
        }));
        if (!before) return;
        const after = get().blockedTimes.find(b => b.id === id);
        if (!after) return;
        const targetName = after.title.trim() || "Blocked";
        get().recordAudit("Edited blocked time", "blocked_time", id, targetName);

        // Fan out instructor notifications based on the diff between the
        // pre-edit and post-edit row. Three buckets:
        //   • Newly added staff      → blocked_time_added
        //   • Removed staff          → blocked_time_removed
        //   • Still-assigned staff   → blocked_time_added (treated as an
        //                              update — same icon + tab, body
        //                              reflects the current state)
        // Without this fan-out a window or staff-list change wouldn't
        // reach the affected instructors' bell until next refresh.
        const beforeStaff = new Set(before.staff_ids);
        const afterStaff  = new Set(after.staff_ids);
        const addedStaff   = after.staff_ids.filter(sid => !beforeStaff.has(sid));
        const removedStaff = before.staff_ids.filter(sid => !afterStaff.has(sid));
        const stillStaff   = after.staff_ids.filter(sid => beforeStaff.has(sid));

        for (const sid of addedStaff) {
            get().emitNotifications({
                instructor: {
                    tab: "booking",
                    event: "blocked_time_added",
                    title: "Blocked time added",
                    body: `${targetName} on ${after.date} (${after.start_time}–${after.end_time}).`,
                    icon: "calendar-x",
                    sourceModule: "class",
                    sourceId: id,
                    branchId: after.branch_id,
                    targetInstructorId: sid,
                },
            });
        }
        for (const sid of removedStaff) {
            get().emitNotifications({
                instructor: {
                    tab: "booking",
                    event: "blocked_time_removed",
                    title: "Blocked time removed",
                    body: `${targetName} on ${before.date} was removed — you're available again.`,
                    icon: "calendar-check",
                    sourceModule: "class",
                    sourceId: id,
                    branchId: before.branch_id,
                    targetInstructorId: sid,
                },
            });
        }
        // Detect substantive changes (window or date) so we only notify
        // still-assigned staff when something actually moved. Title or
        // note tweaks don't ping the instructor — too noisy.
        const windowMoved = before.date !== after.date
            || before.start_time !== after.start_time
            || before.end_time !== after.end_time;
        if (windowMoved) {
            for (const sid of stillStaff) {
                get().emitNotifications({
                    instructor: {
                        tab: "booking",
                        event: "blocked_time_added",
                        title: "Blocked time updated",
                        body: `${targetName} moved to ${after.date} (${after.start_time}–${after.end_time}).`,
                        icon: "calendar-x",
                        sourceModule: "class",
                        sourceId: id,
                        branchId: after.branch_id,
                        targetInstructorId: sid,
                    },
                });
            }
        }
    },
    deleteBlockedTimes: (ids) => {
        const before = get().blockedTimes.filter(b => ids.includes(b.id));
        set(state => ({
            blockedTimes: state.blockedTimes.filter(b => !ids.includes(b.id)),
        }));
        for (const b of before) {
            const targetName = b.title.trim() || "Blocked";
            get().recordAudit("Deleted blocked time", "blocked_time", b.id, targetName, {
                date: b.date, staff: b.staff_ids.length,
            });
            for (const sid of b.staff_ids) {
                get().emitNotifications({
                    instructor: {
                        tab: "booking",
                        event: "blocked_time_removed",
                        title: "Blocked time removed",
                        body: `${targetName} on ${b.date} was removed — you're available again.`,
                        icon: "calendar-check",
                        sourceModule: "class",
                        sourceId: b.id,
                        branchId: b.branch_id,
                        targetInstructorId: sid,
                    },
                });
            }
        }
    },

    // ── Staff actions ──────────────────────────────────────────────────────
    //
    // Every mutation here also syncs the legacy `instructors` slice through
    // `syncInstructorsFromStaff` so pay-rate / payroll / schedule views
    // reflect Staff & Permissions changes immediately.
    addStaff: (input) => {
        const id = input.id ?? `staff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        // Roles are branch-agnostic — the person's branch is chosen at
        // assignment time (the staff form's Branch picker) and stands on
        // its own. It's stored verbatim from the caller, never derived
        // from the role.
        const next: Staff = {
            ...input,
            id,
            branchId: input.branchId,
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
        // Audit fix 2026-07-22 — mirror the legacy shiftId into the M2M
        // shiftAssignments slice so the new staff shows up in shift
        // rosters / staffing counts / delete-blocked gates. Without this,
        // `deleteShifts` (which prefers M2M count) would let admin delete
        // a shift the new staff was just assigned to, orphaning the ref.
        // Matches the sync updateStaff does when shiftId changes.
        if (next.shiftId) {
            const shiftId = next.shiftId;
            set(state => {
                const parent = state.shifts.find(s => s.id === shiftId);
                if (!parent) return state;
                const alreadyThere = state.shiftAssignments.some(
                    a => a.staff_id === id && a.shift_id === shiftId,
                );
                if (alreadyThere) return state;
                const row: ShiftAssignment = {
                    id: `sa_${shiftId}_${id}`,
                    shift_id: shiftId,
                    staff_id: id,
                    days_of_week: [...parent.working_days],
                    created_at: new Date().toISOString(),
                };
                return { shiftAssignments: [...state.shiftAssignments, row] };
            });
        }
        return id;
    },
    updateStaff: (id, patch) => {
        // Detect a shift CHANGE so we can fire the instructor-bell sync
        // notification ("Shift assigned" / "Shift removed") after the
        // staff slice is updated. Compared against the row's value
        // BEFORE the patch so the same handler covers all three flows:
        //   • Assigned for the first time (before = undefined, patch ≠ undefined)
        //   • Reassigned (before ≠ patch, both ≠ undefined)
        //   • Removed (patch = undefined explicitly)
        // No notification when the patch doesn't touch `shiftId` at all.
        const prevShiftId = get().staff.find(s => s.id === id)?.shiftId;
        const shiftPatchTouched = Object.prototype.hasOwnProperty.call(patch, "shiftId");
        const nextShiftId = shiftPatchTouched ? patch.shiftId : prevShiftId;
        const shiftActuallyChanged = shiftPatchTouched && prevShiftId !== nextShiftId;

        // Phase 4 reverse cascade — admin → instructor.
        // If the edited staff row is the currently-logged-in instructor,
        // mirror identity edits back to `currentUser` so the instructor
        // side (Sidebar chip, Header welcome, Personal info tab) sees
        // changes admin made on `/admin/staff/[id]/edit` immediately.
        // Together with the forward cascade on `updateAccountProfile`,
        // edits flow bi-directionally and the two views never drift.
        set(state => {
            const nextStaff = state.staff.map(s => {
                if (s.id !== id) return s;
                // Roles are branch-agnostic — changing a staff's role never
                // moves their branch. Branch is edited independently via the
                // staff form's Branch picker.
                return { ...s, ...patch };
            });
            const nextInstructors = syncInstructorsFromStaff(state.instructors, nextStaff, state.roles, [id]);

            const currentStaffId = (state.currentUser as typeof state.currentUser & { staff_profile_id?: string }).staff_profile_id;
            const editingCurrent = state.currentUser.role === "instructor" && currentStaffId === id;
            const editedRow = nextStaff.find(s => s.id === id);

            // Keep the schedule cards' denormalized instructor identity fresh when
            // an admin renames / re-avatars an instructor. The admin path
            // previously skipped this cascade (only updateOwnProfile had it), so
            // an admin rename didn't reach the schedule list / grid / detail.
            // Audit Phase 6, 2026-08-05.
            const identityChanged = !!editedRow && (
                patch.firstName !== undefined || patch.lastName !== undefined ||
                patch.fullName  !== undefined || patch.initials !== undefined ||
                patch.color     !== undefined || patch.imageUrl !== undefined
            );
            const nextSchedules = identityChanged && editedRow
                ? state.classSchedules.map(c => c.instructorId === id ? {
                    ...c,
                    instructorName: editedRow.fullName,
                    instructorInitials: editedRow.initials,
                    instructorColor: editedRow.color,
                  } : c)
                : state.classSchedules;

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
                    classSchedules: nextSchedules,
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
                classSchedules: nextSchedules,
            };
        });

        // Mirror the legacy `shiftId` change into the M2M `shiftAssignments`
        // slice so availability gates (schedule form + customer slot picker)
        // see the current shift.
        //
        // Client 2026-07-23 — this reconcile is NON-DESTRUCTIVE to sibling
        // rows. `shiftId` is the staff member's PRIMARY (legacy single) shift;
        // a staff can hold additional shifts via the M2M week-view picker.
        // Editing the primary must NOT wipe those. The previous version dropped
        // EVERY row for the staff and inserted one — which silently collapsed
        // multi-shift assignments whenever the staff form or the "Change shift"
        // modal ran. Now:
        //   • Drop only the row for the shift being moved AWAY from
        //     (prevShiftId) — the swap's old side.
        //   • Upsert a row for the new primary (nextShiftId), if any, without
        //     duplicating an existing row or touching the staff's other shifts.
        //   • If shiftId was cleared (undefined) → drop only the prevShiftId
        //     row; any separately-assigned shifts remain.
        if (shiftActuallyChanged) {
            set(state => {
                let rows = state.shiftAssignments;
                if (prevShiftId) {
                    rows = rows.filter(a => !(a.staff_id === id && a.shift_id === prevShiftId));
                }
                if (!nextShiftId) return { shiftAssignments: rows };
                if (rows.some(a => a.staff_id === id && a.shift_id === nextShiftId)) {
                    return { shiftAssignments: rows };
                }
                const parent = state.shifts.find(s => s.id === nextShiftId);
                if (!parent) return { shiftAssignments: rows };
                const nextRow: ShiftAssignment = {
                    id: `sa_${nextShiftId}_${id}`,
                    shift_id: nextShiftId,
                    staff_id: id,
                    days_of_week: [...parent.working_days],
                    created_at: new Date().toISOString(),
                };
                return { shiftAssignments: [...rows, nextRow] };
            });
        }

        // Fan out the shift-change instructor notification + audit. Runs
        // AFTER the cascading set() above so the staff slice is current
        // when consumers click through the bell.
        if (shiftActuallyChanged) {
            const target = get().staff.find(s => s.id === id);
            if (target) {
                const newShift = nextShiftId ? get().shifts.find(x => x.id === nextShiftId) : undefined;
                const oldShift = prevShiftId ? get().shifts.find(x => x.id === prevShiftId) : undefined;
                if (newShift) {
                    get().recordAudit("Assigned to shift", "shift", newShift.id, newShift.name, {
                        staff: target.fullName,
                    });
                    get().emitNotifications({
                        instructor: {
                            tab: "booking",
                            event: "shift_assigned",
                            title: "Shift assigned",
                            body: `You've been assigned to ${newShift.name} (${newShift.start_time}–${newShift.end_time}).`,
                            icon: "calendar-check",
                            sourceModule: "class",
                            sourceId: newShift.id,
                            branchId: target.branchId ?? undefined,
                            targetInstructorId: id,
                        },
                    });
                } else if (oldShift) {
                    get().recordAudit("Removed from shift", "shift", oldShift.id, oldShift.name, {
                        staff: target.fullName,
                    });
                    get().emitNotifications({
                        instructor: {
                            tab: "booking",
                            event: "shift_removed",
                            title: "Shift removed",
                            body: `You've been removed from ${oldShift.name}.`,
                            icon: "calendar-minus",
                            sourceModule: "class",
                            sourceId: oldShift.id,
                            branchId: target.branchId ?? undefined,
                            targetInstructorId: id,
                        },
                    });
                }
            }
        }
    },
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
                //
                // Audit fix 2026-07-22: also scrub the new Phase 3
                // `shiftAssignments` table + the multi-staff `staff_ids`
                // arrays on Phase 2 `blockedTimes`. Without these, a
                // deleted staff would leave orphan assignments pointing
                // at a missing staff row, and a shared time-off entry
                // would keep counting the deleted person as "away" on
                // the Month view's overlap chip.
                return {
                    staff: nextStaff,
                    instructors: syncInstructorsFromStaff(state.instructors, nextStaff, state.roles, deletable),
                    payrollEntries: state.payrollEntries.filter(p => !deletableSet.has(p.instructorId)),
                    classSchedules: state.classSchedules.filter(s => !deletableSet.has(s.instructorId)),
                    classRatings: state.classRatings.filter(r => !deletableSet.has(r.instructorId)),
                    shiftAssignments: state.shiftAssignments.filter(a => !deletableSet.has(a.staff_id)),
                    blockedTimes: state.blockedTimes
                        // Trim deleted staff out of every entry's multi-
                        // select, then drop any entry that ends up empty
                        // (no staff = no reason to keep the row).
                        .map(bt => ({ ...bt, staff_ids: bt.staff_ids.filter(sid => !deletableSet.has(sid)) }))
                        .filter(bt => bt.staff_ids.length > 0),
                };
            });
        }
        return { deleted: deletable, blocked };
    },

    setPendingPurchase: (purchase) => set({ pendingPurchase: purchase }),
    setAiScratchCoverImage: (url) => set({ aiScratchCoverImage: url }),
    applyPurchase: (customerId, items, paymentSource, sellerStaffId, accountCreditAppliedAed, saleBranchIdOverride, giftCardDebits, promo) => {
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
            const retails = items.filter(it => it.productType === "retail");
            if (membership) return `the ${membership.name}`;
            if (packages.length === 1) return `the ${packages[0].name}`;
            if (packages.length > 1) return `${packages.reduce((sum, p) => sum + p.quantity, 0)} packages`;
            if (giftCards.length > 0) return giftCards.length === 1
                ? `a ${giftCards[0].name} gift card`
                : `${giftCards.length} gift cards`;
            if (retails.length > 0) {
                const totalUnits = retails.reduce((sum, r) => sum + r.quantity, 0);
                if (retails.length === 1) {
                    return totalUnits === 1
                        ? `a ${retails[0].name}`
                        : `${totalUnits} × ${retails[0].name}`;
                }
                return `${totalUnits} retail items`;
            }
            const appointments = items.filter(it => it.productType === "private" || it.productType === "recovery");
            if (appointments.length > 0) {
                return appointments.length === 1
                    ? `the ${appointments[0].name} session`
                    : `${appointments.length} sessions`;
            }
            return "items at checkout";
        })();
        // Pre-compute the first transaction id so the notification record can
        // deep-link the click-through to the exact receipt on the customer
        // profile (Payments tab → highlighted row). Retail-only orders fall
        // back to the first retail line so click-through still resolves.
        const txnStamp = Date.now();
        // First "plan-style" sale line — carries the account-credit / gift-card
        // debit stamp (so a refund can restore them) AND the notification
        // deep-link. Sessions count here too (2026-08-04) so a session-only
        // cart still stamps its payment + deep-links its receipt.
        const firstSaleIdx = items.findIndex(it =>
            it.productType === "membership" || it.productType === "package"
            || it.productType === "private" || it.productType === "recovery");
        const firstRetailIdx = items.findIndex(it => it.productType === "retail");
        const resolvedFirstIdx = firstSaleIdx >= 0 ? firstSaleIdx : firstRetailIdx;
        const firstTxnId = resolvedFirstIdx >= 0 ? `txn_sale_${txnStamp}_${resolvedFirstIdx}` : undefined;
        // ── Session bookings (2026-08-04) ──────────────────────────────────
        // Private / Recovery lines create a REAL appointment at the chosen slot
        // BEFORE the sale posts, reusing `addCustomerAppointment` (which handles
        // open-session sharing, capacity, and the instructor snapshot). The
        // instructor is already resolved on the line — a "Flexible" pick was
        // assigned a concrete free instructor at pick time. Each call runs its
        // own set(); the sale `set` below is a partial merge, so these writes
        // persist alongside the transaction rows.
        // Map each session item's index → the appointment id it booked, so the
        // transaction loop below can stamp `appointmentId` on the sale row (a
        // refund then cancels exactly that booking).
        const apptIdByItemIdx = new Map<number, string>();
        if (buyerSnapshot) {
            const apptCustomer = {
                id: buyerSnapshot.id,
                name: `${buyerSnapshot.firstName} ${buyerSnapshot.lastName}`.trim(),
                initials: buyerSnapshot.initials,
                imageUrl: buyerSnapshot.imageUrl,
            };
            items.forEach((it, idx) => {
                if ((it.productType !== "private" && it.productType !== "recovery") || !it.appointment) return;
                const apptId = get().addCustomerAppointment({
                    serviceId: it.productId,
                    dateISO: it.appointment.dateISO,
                    startTime: it.appointment.startTime,
                    durationMins: it.appointment.durationMin,
                    instructorId: it.appointment.instructorId,
                    flexible: it.appointment.flexible,
                    customer: apptCustomer,
                });
                apptIdByItemIdx.set(idx, apptId);
            });
        }
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
                        ? `${packageItems.reduce((sum, p) => sum + p.quantity, 0)} packages`
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
            // Sales-commission attribution for gift cards (client Aug 2026) —
            // the cashier's "Credited to" pick earns commission at SALE. Portal
            // (self-service) purchases stay unattributed. Commission reads this
            // off the issued card, not a transaction (a gift-card sale isn't a
            // revenue transaction — see payroll-calc.categoryStats).
            const giftCardSeller =
                (paymentSource ?? "pos") === "customer_portal" ? undefined : sellerStaffId;
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
                        ...(giftCardSeller ? { sold_by_staff_id: giftCardSeller } : {}),
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
            // Gift-card SALE transactions — one per issued card (client Aug
            // 2026). Records the sale in Payment History and makes it
            // refundable while the card is unused. EXCLUDED from revenue (see
            // selectTransactionLedger) so redeeming the card later isn't
            // double-counted. Commission for gift cards reads the issued card
            // (sold_by_staff_id), not this row, so there's no double credit.
            newIssued.forEach((card, gi) => {
                newTransactions.push({
                    id: `txn_gc_${stamp}_${gi}`,
                    customerId,
                    branchId: saleBranchId,
                    kind: "gift_card",
                    productId: card.design_id,
                    name: state.giftCardDesigns.find(d => d.id === card.design_id)?.name
                        ?? `AED ${card.face_value_aed} Gift Card`,
                    amountAed: card.face_value_aed,
                    status: "complete",
                    paymentMethod: "card",
                    paymentSource: paymentSource ?? "pos",
                    transactionType: "sale",
                    staffId: giftCardSeller,
                    createdAtISO: nowISO,
                    issuedGiftCardId: card.id,
                    isRefundable: true,
                });
                // Back-link the card to its sale for the Gift Card report.
                card.transaction_id = `txn_gc_${stamp}_${gi}`;
            });
            items.forEach((it, idx) => {
                if (it.productType !== "membership" && it.productType !== "package") return;
                const isMembership = it.productType === "membership";
                const expiry = new Date();
                let creditsLabel: string;
                // Numeric total credits carried onto the plan record so the
                // Plan-tab "Credit left" column never falls back to 0/0 after
                // a persist reload. Unlimited memberships stay at 0 (the
                // planAllotment helper reads `isUnlimited` via creditsLabel).
                let totalCredits = 0;
                if (isMembership) {
                    const m = state.memberships.find(mm => mm.id === it.productId);
                    expiry.setMonth(expiry.getMonth() + (m?.duration_months ?? 1));
                    if (m && m.credits !== "unlimited") {
                        totalCredits = typeof m.credits === "number" ? m.credits : 0;
                        creditsLabel = `${totalCredits} credits`;
                    } else {
                        creditsLabel = "Unlimited";
                    }
                } else {
                    const p = state.packages.find(pp => pp.id === it.productId);
                    expiry.setDate(expiry.getDate() + (p?.validity_days ?? 30));
                    totalCredits = (typeof p?.credits === "number" ? p.credits : 0) * it.quantity;
                    creditsLabel = `${totalCredits} ${totalCredits === 1 ? "credit" : "credits"}`;
                }
                newPlans.push({
                    id: `cp_sale_${stamp}_${idx}`,
                    customerId,
                    kind: isMembership ? "membership" : "package",
                    productId: it.productId,
                    name: it.name,
                    planTypeLabel: isMembership ? "Membership" : "Package",
                    creditsLabel,
                    // Reports v33 + Plan-tab column read these. Unlimited
                    // memberships store 0 → the unlimited-label check on
                    // read swaps to the "Unlimited" render.
                    totalCredits,
                    creditsUsed: 0,
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
                // Sales-commission attribution — EXPLICIT (commission refactor
                // Phase 2, client Jul 2026). The cashier picks "Credited to" at
                // checkout; that staff gets commission. No more auto-attribute
                // to the logged-in cashier. Portal (self-service) sales stay
                // unattributed — no seller, no commission.
                const source = paymentSource ?? "pos";
                const cashierStaffId =
                    source === "customer_portal" ? undefined : sellerStaffId;
                // Attach the account credit stamp to the FIRST membership/
                // package line so a subsequent refund of that line restores
                // the credit to the wallet (see `refundTransaction`). Most
                // sales are single-line so this covers the common path; a
                // partial refund on a rare multi-line sale that only targets
                // a later line is a documented edge case for the prototype.
                const isFirstSaleLine = idx === firstSaleIdx;
                newTransactions.push({
                    id: `txn_sale_${stamp}_${idx}`,
                    customerId,
                    branchId: saleBranchId,
                    kind: isMembership ? "membership" : "package",
                    productId: it.productId,
                    name: it.name,
                    quantity: it.quantity,
                    amountAed: lineGross,
                    ...txnExtra,
                    status: "complete",
                    paymentMethod: "card",
                    // Default origin: a POS checkout. Customer-portal +
                    // admin callers pass their own value via `paymentSource`.
                    paymentSource: source,
                    transactionType: "sale",
                    staffId: cashierStaffId,
                    createdAtISO: nowISO,
                    ...(isFirstSaleLine && accountCreditAppliedAed && accountCreditAppliedAed > 0
                        ? { accountCreditAppliedAed }
                        : {}),
                    // Gift-card debits ride the FIRST sale line only (same
                    // rule as account credit) so a refund restores each
                    // card exactly once, never per-line.
                    ...(isFirstSaleLine && giftCardDebits && giftCardDebits.length > 0
                        ? { giftCardDebits }
                        : {}),
                });
            });

            // ─── Plan-exclusivity cascade (Jul 2026 client feedback) ──────
            // The customer either holds ONE active membership OR one or
            // more active packages — never both. Buying a
            // membership must therefore cancel any previously-held
            // packages, and buying a package must cancel any
            // previously-held membership. `complimentary` plans are
            // exempt (free credits, not a membership/package). Only
            // active + frozen rows count as "held"; historical
            // (cancelled/expired/removed) rows are untouched. Ignored
            // when the current purchase is gift-card-only (planKind ===
            // null) — that path never displaces the current plan.
            const cascadeReason = planKind === "membership"
                ? "Switched to membership"
                : "Switched to package";
            const shouldCascade = planKind !== null && (
                planKind === "membership"
                    ? state.customerPlans.some(p =>
                        p.customerId === customerId
                        && p.kind === "package"
                        && (p.status === "active" || p.status === "frozen"))
                    : state.customerPlans.some(p =>
                        p.customerId === customerId
                        && p.kind === "membership"
                        && (p.status === "active" || p.status === "frozen"))
            );
            const cascadedPlans: CustomerPlan[] = shouldCascade
                ? state.customerPlans.map(p => {
                    if (p.customerId !== customerId) return p;
                    if (p.kind === "complimentary") return p;
                    if (p.status !== "active" && p.status !== "frozen") return p;
                    const displaced = planKind === "membership"
                        ? p.kind === "package"
                        : p.kind === "membership";
                    if (!displaced) return p;
                    return {
                        ...p,
                        status: "cancelled" as const,
                        cancelReason: cascadeReason,
                        cancelledAtISO: nowISO,
                    };
                })
                : state.customerPlans;

            // ─── Retail line items (Phase D.2, 2026-07-29) ────────────────
            // Retail sales generate a "retail"-kind CustomerTransaction with
            // the snapshot fields populated (name / SKU / price / unit cost
            // at sale time), and decrement per-branch stock in the same set()
            // so a matching adjustment log row appears atomically. Snapshot
            // fields ensure past receipts render exactly as sold even after
            // product edits or archival.
            const retailItems = items.filter(it => it.productType === "retail");
            const nextRetailStock = state.retailStock.map(s => ({ ...s }));
            const nextRetailAdjustments: RetailStockAdjustment[] = [];
            const currentUserId = state.currentUser?.staff_id ?? state.currentUser?.id ?? "unknown";
            // v83 audit-1 (2026-07-29) — retail stock must decrement at the
            // PHYSICAL sale branch, not the buyer's home branch. Falls back
            // to the buyer's home branch when the caller doesn't pass an
            // override (customer-portal + other non-POS surfaces).
            const retailBranchId = saleBranchIdOverride || saleBranchId;
            items.forEach((it, idx) => {
                if (it.productType !== "retail") return;
                const product = state.retailProducts.find(p => p.id === it.productId);
                if (!product) return;
                const qty = Math.max(1, Math.floor(it.quantity));
                const lineGross = it.unitPrice * qty;
                const txnId = `txn_sale_${stamp}_${idx}`;
                // Sized products decrement the specific (branch × size) row;
                // sizeless products leave `size` undefined. Customer-side flows
                // don't surface a size picker yet, so when a sized product
                // arrives with no `size` we resolve a concrete variant here —
                // preferring an in-stock size at the sale branch — instead of
                // no-opping against a nonexistent sizeless row (which would let
                // stock drift and let a refund inject a phantom row).
                let saleSize = it.size;
                if (!saleSize && product.sizes && product.sizes.length > 0) {
                    const inStock = product.sizes.find(sz =>
                        (nextRetailStock.find(s => s.productId === product.id && s.branchId === retailBranchId && s.size === sz)?.unitsOnHand ?? 0) > 0,
                    );
                    saleSize = inStock ?? product.sizes[0];
                }
                // Tax handling for retail lands as a follow-up — the TaxRule
                // category union doesn't include "retail" yet. Retail sales
                // currently write with no tax rule (subtotal = total).
                const txnExtra: Partial<CustomerTransaction> = {};
                const source = paymentSource ?? "pos";
                const cashierStaffId = source === "customer_portal" ? undefined : sellerStaffId;
                newTransactions.push({
                    id: txnId,
                    customerId,
                    branchId: retailBranchId,
                    kind: "retail",
                    productId: it.productId,
                    name: it.name,
                    amountAed: lineGross,
                    ...txnExtra,
                    status: "complete",
                    paymentMethod: "card",
                    paymentSource: source,
                    transactionType: "sale",
                    staffId: cashierStaffId,
                    createdAtISO: nowISO,
                    // ── Retail snapshot ──
                    retailProductId: product.id,
                    productSnapshotName: product.name,
                    productSnapshotSku: product.sku,
                    productSnapshotPriceAed: product.priceAed,
                    productSnapshotUnitCostAed: product.unitCostAed,
                    quantity: qty,
                    branchIdAtSale: retailBranchId,
                    ...(saleSize ? { retailSize: saleSize } : {}),
                });
                // Stock decrement — clamped at 0. Even if the cart lets the
                // admin push past on-hand (shouldn't happen — the disabled
                // "Out of stock" gate is on the card), we never write negative.
                // Keyed by (product × branch × size).
                const stockRow = nextRetailStock.find(
                    s => s.productId === product.id && s.branchId === retailBranchId && (s.size ?? undefined) === (saleSize ?? undefined),
                );
                const currentUnits = stockRow?.unitsOnHand ?? 0;
                const nextUnits = Math.max(0, currentUnits - qty);
                const appliedDelta = nextUnits - currentUnits;
                if (stockRow) {
                    stockRow.unitsOnHand = nextUnits;
                    stockRow.lastAdjustedAt = nowISO;
                } else if (appliedDelta !== 0) {
                    nextRetailStock.push({
                        id: `retail_stock_${product.id}_${retailBranchId}${saleSize ? `_${saleSize}` : ""}_${Date.now()}`,
                        productId: product.id,
                        branchId: retailBranchId,
                        ...(saleSize ? { size: saleSize } : {}),
                        unitsOnHand: nextUnits,
                        lastAdjustedAt: nowISO,
                    });
                }
                // v83 audit-1 — skip zero-delta rows. When the clamp fires
                // (stock was already 0 at the sale branch) we don't need a
                // "sold 0 units" audit-log entry; the sale row on the
                // transaction still tells the story.
                if (appliedDelta !== 0) {
                    nextRetailAdjustments.push({
                        id: `retail_adj_sale_${stamp}_${idx}`,
                        productId: product.id,
                        branchId: retailBranchId,
                        ...(saleSize ? { size: saleSize } : {}),
                        delta: appliedDelta,
                        kind: "sale",
                        sourceTransactionId: txnId,
                        createdBy: currentUserId,
                        createdAt: nowISO,
                    });
                }
            });

            // ─── Session (private / recovery) line items (2026-08-04) ─────
            // The booking was already created (addCustomerAppointment, above);
            // here we record the revenue transaction so the sale lands in the
            // Payments tab + reports. Tax follows the session's OWN rule
            // ("private" / "recovery") the same way memberships / packages do
            // (untaxed when no rule exists).
            items.forEach((it, idx) => {
                if (it.productType !== "private" && it.productType !== "recovery") return;
                // The session's own tax category — client 2026-08-04 split
                // "appointment" into "private" + "recovery" so each type can
                // carry its own rule.
                const sessionCategory = it.productType;
                // A session is DELIVERED at the service's branch (that's where
                // the appointment is created), so revenue + the tax rule resolve
                // against THAT branch, not the buyer's home branch — otherwise a
                // customer buying an out-of-branch session misattributes the
                // money + could apply the wrong branch's VAT (audit 2026-08-04).
                const sessionBranchId = state.services.find(s => s.id === it.productId)?.branchId || saleBranchId;
                const lineGross = it.unitPrice * it.quantity;
                const taxRule = state.taxRules.find(r =>
                    r.category === sessionCategory
                    && r.status === "active"
                    && r.taxRateId !== undefined
                    && (r.allLocations || r.locationIds.includes(sessionBranchId)),
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
                    txnExtra = { subtotalAed, taxAed, taxRatePercentage: rPct, taxInclusive: pricesInclude };
                }
                const source = paymentSource ?? "pos";
                const cashierStaffId = source === "customer_portal" ? undefined : sellerStaffId;
                // Account credit + gift-card debits ride the FIRST sale line so a
                // refund of that line restores them. On a session-only cart the
                // first session line IS that line (firstSaleIdx now covers
                // sessions), so the payment is restorable on refund.
                const isFirstSaleLine = idx === firstSaleIdx;
                const bookedApptId = apptIdByItemIdx.get(idx);
                newTransactions.push({
                    id: `txn_sale_${stamp}_${idx}`,
                    customerId,
                    branchId: sessionBranchId,
                    kind: sessionCategory,
                    productId: it.productId,
                    name: it.name,
                    amountAed: lineGross,
                    ...txnExtra,
                    status: "complete",
                    paymentMethod: "card",
                    paymentSource: source,
                    transactionType: "sale",
                    staffId: cashierStaffId,
                    createdAtISO: nowISO,
                    // Link to the booking so a refund can cancel it.
                    ...(bookedApptId ? { appointmentId: bookedApptId } : {}),
                    ...(isFirstSaleLine && accountCreditAppliedAed && accountCreditAppliedAed > 0
                        ? { accountCreditAppliedAed }
                        : {}),
                    ...(isFirstSaleLine && giftCardDebits && giftCardDebits.length > 0
                        ? { giftCardDebits }
                        : {}),
                });
            });

            // ─── Promo redemption ─────────────────────────────────────────
            // Stamp the applied promo on the FIRST real sale line (gift-card
            // rows are excluded from promos) so the Discounts + Promo
            // Redemptions reports and each promo's usage count reflect this
            // real redemption. `usage_count` is bumped in the state patch
            // below so the admin list, delete guard, and usage-limit gate all
            // stay in lock-step with the transaction ledger.
            const promoCode = promo?.code?.trim().toUpperCase();
            const promoStamped = !!promoCode && (() => {
                const firstSale = newTransactions.find(
                    t => (t.transactionType ?? "sale") === "sale" && t.kind !== "gift_card",
                );
                if (!firstSale) return false;
                firstSale.discountCode = promo!.code;
                firstSale.discountValue = promo!.discountAed;
                return true;
            })();

            return {
                customers,
                ...(newIssued.length > 0
                    ? { issuedGiftCards: [...state.issuedGiftCards, ...newIssued] }
                    : {}),
                ...(newPlans.length > 0
                    ? { customerPlans: [...newPlans, ...cascadedPlans] }
                    : shouldCascade
                        ? { customerPlans: cascadedPlans }
                        : {}),
                ...(newTransactions.length > 0
                    ? { customerTransactions: [...newTransactions, ...state.customerTransactions] }
                    : {}),
                ...(promoStamped
                    ? { promoCodes: state.promoCodes.map(p =>
                        p.code.toUpperCase() === promoCode
                            ? { ...p, usage_count: p.usage_count + 1 } : p) }
                    : {}),
                ...(retailItems.length > 0
                    ? {
                        retailStock: nextRetailStock,
                        retailStockAdjustments: [...state.retailStockAdjustments, ...nextRetailAdjustments],
                    }
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

        // Account credit debit — when the customer used their balance at
        // checkout, subtract it from the wallet ledger AFTER the sale posts
        // so `walletBalanceAed` on the same render already sees the reduction.
        // Guarded to never debit past the current balance (belt-and-braces —
        // callers already cap it, but a bad caller can't push the balance
        // negative). Uses the existing `debitWallet` action so history + audit
        // read consistently with every other debit surface.
        if (accountCreditAppliedAed && accountCreditAppliedAed > 0) {
            const balance = walletBalanceAed(get().walletTransactions, customerId);
            const debitAed = Math.min(accountCreditAppliedAed, balance);
            if (debitAed > 0) {
                get().debitWallet({
                    customerId,
                    amountAed: debitAed,
                    reason: "Applied at checkout",
                    referenceType: "pos_sale",
                    referenceId: firstTxnId,
                    silent: true,
                });
            }
        }

        // ── Referral auto-issuance (client 2026-07-31) ─────────────────────
        // Settings → Referral used to be pure decoration: an admin could
        // configure "reward the referrer when their friend's first purchase
        // clears AED X" and NOTHING ever read it. This is the missing
        // evaluator call. `applyPurchase` is the single choke point every
        // checkout funnels through (admin POS, schedule mini-POS, customer
        // portal), so wiring it here covers all three at once.
        //
        // Rules live in the pure `evaluateReferralRewards` helper; this block
        // only APPLIES the decisions it returns. Wrapped defensively so a
        // referral-config edge case can never break a completed sale — the
        // money has already changed hands by this point.
        try {
            const stateNow = get();
            const buyer = stateNow.customers.find(c => c.id === customerId);
            // Referral rewards only pay out while the program is active — an
            // admin toggling it off halts issuance of even already-pending
            // referrals (the toggle isn't cosmetic).
            if (buyer && stateNow.referralSettings.programActive) {
                // "First purchase" = this buyer had no COMPLETED sale rows
                // before the ones we just wrote. Filter to sales (not
                // refunds/voids) and exclude this run's rows — every id
                // written above shares the `txn_sale_<txnStamp>_` prefix.
                const thisRunPrefix = `txn_sale_${txnStamp}_`;
                const priorSales = stateNow.customerTransactions.filter(t =>
                    t.customerId === customerId &&
                    (t.transactionType ?? "sale") === "sale" &&
                    !t.id.startsWith(thisRunPrefix));
                const payouts = evaluateReferralRewards({
                    buyerCustomerId: customerId,
                    buyerEmail: buyer.email ?? "",
                    purchaseTotalAed: purchaseTotal,
                    isFirstPurchase: priorSales.length === 0,
                    referrals: stateNow.customerReferrals,
                    settings: {
                        referrerEarnType:      stateNow.referralSettings.referrerEarnType,
                        referrerEarnAmount:    stateNow.referralSettings.referrerEarnAmount,
                        rewardUnlockTrigger:   stateNow.referralSettings.rewardUnlockTrigger,
                        maxReferralsPerMember: stateNow.referralSettings.maxReferralsPerMember,
                        minFirstSpendAed:      stateNow.referralSettings.minFirstSpendAed,
                        preventSelfReferral:   stateNow.referralSettings.preventSelfReferral,
                    },
                    emailForCustomer: (id: string) =>
                        get().customers.find(c => c.id === id)?.email,
                });
                for (const payout of payouts) {
                    if (payout.rewardType === "wallet_credit") {
                        // AED lands in the referrer's account-credit balance —
                        // spendable at POS + customer checkout on any product
                        // type, same as any other credit.
                        get().creditWallet({
                            customerId: payout.referrerCustomerId,
                            amountAed: payout.amount,
                            reason: payout.reason,
                            referenceType: "referral",
                            referenceId: payout.referralId,
                            silent: true,
                        });
                    }
                    // `free_credits` (class credits) + `discount` need no
                    // ledger write — the referral row itself IS the record,
                    // and the customer-detail Referrals tab + customer portal
                    // both read `benefitType`/`benefitAmount` off it.
                    //
                    // Stamp the row so this referral can never pay out twice,
                    // and freeze the reward terms as they were at issue time
                    // (a later settings change must not retroactively rewrite
                    // what someone already earned).
                    set(s => ({
                        customerReferrals: s.customerReferrals.map(r =>
                            r.id === payout.referralId
                                ? {
                                      ...r,
                                      rewardIssuedAtISO: new Date(txnStamp).toISOString(),
                                      benefitType: payout.rewardType,
                                      benefitAmount: payout.amount,
                                      benefitCredits: payout.rewardType === "free_credits"
                                          ? payout.amount
                                          : r.benefitCredits,
                                  }
                                : r),
                    }));
                    get().recordAudit(
                        "Referral reward issued",
                        "customer",
                        payout.referrerCustomerId,
                        payout.reason,
                        { amount: payout.amount },
                    );
                }
            }
        } catch {
            // Never let referral evaluation break a completed sale.
        }
        // v83 audit-2 fix (2026-07-27) — POS applyPurchase writes plans +
        // transactions inline without routing through addCustomerPlan /
        // addCustomerTransaction, so the recompute hook never fires and
        // the customer's stored lifecycleTag drifts stale (Lead in list
        // but New Active on the profile). Trigger the standard recompute
        // + task-gen block here so POS sales flow through the same
        // pipeline as importer paths.
        set(state => recomputePatch(state, customerId));
        set(state => {
            const fresh = generateFollowUpTasks(customerId, state, {
                triggers: ["trial_no_rebook_7d"],
            });
            return { followUpTasks: applyGeneratedTasks(state.followUpTasks, fresh) };
        });
    },

    showToast: (title, message, type = "success", icon) =>
        set({ toast: { id: Date.now().toString(), title, message, type, icon } }),
    clearToast: () => set({ toast: null }),
}),
    {
        name: PERSIST_KEY,
        // Bumped to flush persisted demo state and re-seed clean from the mock
        // files on the next load (v2: cleared member test bookings; v3: picks up
        // the new spot-selection demo class; v4/v5/v6: Ava started at 0 credits to
        // demo the Purchase → checkout flow; v7: Ava holds an active Advanced
        // membership with 12 credits for the booking / cancellation / refund test
        // flows; v8/v9: Barre category points at its own /class-categories/barre.png
        // cover; v10: re-seed so the real-now-anchored class schedule re-anchors to
        // the current device date — flushes a stale payload seeded on a previous
        // day so admin + customer show identical, current dates; v11: adds the
        // Custom Gift Card design for the Products gift-card flow; v12: Ava back to
        // 0 credits for the Purchase Product flow; v13: customer-experience branch
        // merged in — new customer slices + admin/instructor updates need a clean
        // re-seed to drop any stale persisted state from either branch; v14:
        // Integrations module merge — 4 new app integrations (Outlook,
        // Mailchimp, Instagram, Xero) + 3 new payment providers (Cards,
        // Cash, Bank transfer) added to seeds so persisted v13 payloads
        // would render an incomplete grid until flushed; v15: Cards + Cash +
        // Bank transfer flipped to `connected` by default so POS / customer
        // checkout has working payment options out of the box — persisted
        // v14 payloads would still show them as not_connected);
        // v16: Service module schema reshuffle — Branch gains `kind` (club |
        // spa), Service gains `price` (AED) + `isRecovery` + `branchKind`,
        // drops `applicableMembershipIds` / `applicablePackageIds`. Seed
        // adds a Spa branch and reassigns Massage / Sauna / Breathwork / IV
        // therapy to it. Without the bump persisted v15 services would
        // crash the form which now reads `service.price` and
        // `service.isRecovery`;
        // v17: Renamed Spa branch id "branch_forma_recovery" →
        // "branch_forma_spa" + display name "Forma Recovery (Marina)" →
        // "Forma Spa", and re-pointed Massage/Sauna/Breathwork/IV
        // appointments from SOUTH/EAST to the Spa branch so the schedule
        // grid + appointment detail Location resolves to "Forma Spa" (the
        // service detail page was already correct via the services seed
        // but appointments.ts had a stale hardcoded branch mapping);
        // v18: Renamed Forma East's only room "Studio A" → "Hot Yoga
        // Studio" (every seeded East class is Hot Yoga — the generic
        // name read as confusing in customer-facing booking views);
        // v19: BusinessProfile gains `legalBusinessName` +
        // `tradeLicenseNumber` (Studio Profile form additions per
        // Figma 7619:39071);
        // v20: Forma Spa branch gains business_hours rows (open all week
        // 09–21 weekdays, 10–20 weekends);
        // v21: Branding module rebuild — BrandingSettings gains `logoUrl`
        // + `appIconUrl` + `favIconUrl` + `tertiaryColor` + `typeface`
        // + `notificationBranding`;
        // v22: Tax module redesign per Figma 5006:73920 series — TaxRate
        // gains `kind` (vat | income) + `type` (default | zero_rated |
        // exempt), TaxSettings gains `roundingMode`;
        // v23: Referral module redesign per Figma 4620:151863 series —
        // ReferralSettings wiped + reshaped: dropped legacy
        // newCustomerCredits/newCustomerMessage/existingCustomer* fields,
        // added referrerEarnType/Amount + friendEarnType/Amount +
        // rewardUnlockTrigger ("friend_signup" / "friend_first_purchase" /
        // "friend_first_class") + maxReferralsPerMember +
        // earnedRewardExpiryDays + monthlyProgramBudgetAed +
        // preventSelfReferral + newCustomersOnly + minFirstSpendAed +
        // creditsRedeemableAllBranches + infoTitle. CustomerReferral
        // gains optional `expiresAtISO`;
        // v25: Referral credit branch-gate — CustomerReferral gains
        // optional `originBranchId` (captured at referral-creation
        // from the referrer's customer.branchId). Wired into the new
        // `canRedeemReferralCreditsAt()` helper in referral-helpers.ts.
        // Powers the "Redeemable at [branch]" subtitle on the customer-
        // detail Referrals tab AND (when POS wallet redemption ships)
        // the actual redemption gate. Seed rows all default to
        // `branch_forma_south` since every seeded referrer sits there.
        // Bumped from v24 so the field lands on every persisted row
        // (existing localStorage payloads discard on load).
        // v24: Agreements module redesign per Figma 4232:52279 series —
        // Agreement gains `effectiveDatesMode` ("ongoing" | "expiry"),
        // `requireReAcceptance` (boolean), `requireGuardianConsent`
        // (boolean); `effectiveFrom` / `effectiveUntil` become semantic
        // "empty when ongoing". CustomerAgreement.status expands from
        // `"signed" | "unsigned"` to `"signed" | "re_accept_due" |
        // "never_signed"` — legacy "unsigned" rows map to "never_signed"
        // on the persist bump. `republishAgreementVersion` now flips
        // signed rows to `re_accept_due` (was `unsigned`).
        // `addAgreementVersion` picks `re_accept_due` / `never_signed`
        // per prior-signed history. Without the bump, persisted v23
        // payloads carry the old 2-value enum + missing Agreement
        // fields — the new Acceptance status tab + Step 2 wizard
        // would read undefined. No migrate needed;
        // v26: Booking Rules module redesign per Figma 4580:29847 series.
        // ClassesSettings sheds legacy Step 2 (SMS cutoff), Step 3
        // (overbooking + auto-cancel), and auto_submit_attendance
        // fields — none of these appear in the new landing/panel
        // Figmas. Adds booking_cutoff_enabled (toggle), new waitlist
        // fields (notify_via[], when_spot_opens_mode,
        // match_free_cancellation_window, stop_auto_promoting_*,
        // after_cutoff_mode). CancellationPolicy collapses from a
        // LIST of policies (Add/Edit/Delete) into a SINGLE studio-
        // wide record with credit/package window rules, membership
        // fee toggles, and Applied-to package/class scoping.
        // Persisted v25 payloads would carry incompatible field
        // shapes — the new 3-card landing + 3 side panels would
        // crash on undefined reads. No migrate needed;
        // v27: Customer Notifications redesign per Figma 7745:26872
        // series. NotificationSetting sheds `pushEnabled` in favour
        // of `smsEnabled`; adds `smsTemplate`, `whatsappApprovalStatus`
        // (approved/pending/rejected), `whatsappRejectionReason`,
        // `isCritical`, `sendMode` (immediately/scheduled),
        // `sendOffsets[]`, and `sentDuringCampaigns`. New single-record
        // `NotificationDeliverySettings` (quiet-hours window +
        // critical-bypass toggle) drives the landing pill + Delivery
        // hours side-panel. `setNotificationEventChannel` gains a
        // return-value: `false` when the caller tried to disable the
        // last enabled channel on a critical row (UI fires the "at
        // least one channel stays on" toast). Editing the WhatsApp
        // body flips `whatsappApprovalStatus` back to "pending" to
        // mirror Meta's re-approval workflow. No migrate needed —
        // demo discards the old payload on version mismatch.
        //
        // v28 (Figma 7748:61474) — Customer Marketing preferences
        // expanded from the legacy 3-flag trio (`marketing_emails`,
        // `marketing_sms`, `transactional_emails`) to 8 fields split
        // across two axes: 4 channel opt-ins (email / whatsapp / sms /
        // push) + 4 topic opt-ins (studio_announcements,
        // new_class_launch, special_offers, promo_code_offers). Both
        // axes are read by the (still-pending) customer-side prefs UI
        // and admin's dispatch layer; a marketing message is delivered
        // only when BOTH the topic AND at least one channel are opted
        // in. Transactional emails are removed from marketing prefs —
        // they're covered by the (non-marketing) transactional
        // notification rows in the admin Customer notifications module.
        //
        // v29 (Figma 7769:118654) — Tax module expansion:
        //   • `TaxSettings.trn` — studio's Tax Registration Number,
        //     shown as a card above "Prices include tax" on the VAT tab.
        //   • `TaxRate.validFromISO` / `validUntilISO` — effective-window
        //     bounds on each rate. Feeds a new Effective date column on
        //     the tax-rates list ("DD/MM/YYYY - DD/MM/YYYY") + two date
        //     pickers at the bottom of the Add new / Edit modal (all
        //     tax-rate types). Dispatch-time enforcement (POS/product/
        //     payroll picking the ACTIVE rate for a transaction date)
        //     lands in Phase 4 — for now the fields are stored/displayed.
        //
        // v38: Merge `feature/customer-experience` — customer-side
        // appointments availability + gift-card checkout payment +
        // referral share sheet + product/plan fixes. No AppState shape
        // change (customer branch's own store additions were merged
        // cleanly into the current shape); bumping so testers with a
        // persisted v37 payload rehydrate against the merged seed.
        //
        // v37: At-risk fixture bug fix + Performance-tab metrics.
        //   • customers.ts now applies the at-risk `last_visit_iso`
        //     patch to BOTH hand-authored + synthetic customers (was
        //     only hand-authored so the fixture — keyed by synthetic
        //     ids — never landed). Modal now populates.
        //   • Performance tab gets its own 4-metric strip per Figma
        //     7799:109180 (Today's revenue / Active members / Classes
        //     today / Bookings today) — the Today tab keeps the 5.
        //
        // v36: Dashboard Needs-attention demo fixtures (Jul 2026) —
        //   • DEMO_NOW_RENEWAL_PLANS: 8 memberships expiring in next 30
        //     days (active + expired) on synthetic customers.
        //   • DEMO_NOW_FAILED_TRANSACTIONS: 6 failed/pending txns on
        //     synthetic customers.
        //   • DEMO_NOW_AT_RISK_LAST_VISITS: 12 last_visit_iso overrides
        //     on synthetic customers so the At-risk modal always
        //     renders 12 rows.
        //   • 12 additional Upcoming schedules with < 50% capacity so
        //     the Under-filled modal is guaranteed populated.
        //   Bumped so testers pull fresh seed data.
        //
        // v35: Gift card purchase notification event (Jul 2026 client
        // request). New seed row `ns_gift_card_purchase` under the
        // Payment category with the new
        // `NotificationSetting.recipientSource` field set to
        // `"gift_card_recipient"` so the future dispatch layer targets
        // IssuedGiftCard.recipient_email instead of the buyer.
        // Template introduces `{gift_card_code}`, `{gift_card_amount}`,
        // `{sender_name}`, `{recipient_name}`, `{gift_message}` tokens.
        //
        // v34: Plan-exclusivity invariant (Jul 2026 client audit).
        //   • Seed fix — DEMO_NOW_PLANS no longer piles active/frozen
        //     rows on top of the same 10 hand-authored customers.
        //     Only cancelled/expired history rows survive there.
        //   • `applyPurchase` cascade-cancels any pre-existing plan of
        //     the OTHER kind (mem → cancel active pkgs, and vice versa)
        //     so the customerPlans[] array can never hold both.
        //   • `cancelCustomerPlan` + `reactivateCustomerPlan` re-derive
        //     the flat `Customer.planKind/planName/membershipId/
        //     packageIds/planExpiryISO` fields from the plan list so
        //     Customer badges, Reports v33, and the customer-portal
        //     Plan page can't drift from the authoritative array.
        //   • `deleteMembership/deletePackage` gates now check
        //     customerPlans[] too, not just the flat fields.
        //   • Bumped so testers rehydrate against the corrected seed.
        //
        // v33: Cancellation-penalty flow (Jul 2026 client feedback,
        // Figma 7631:454486 / 7790:27893).
        //   • `CancellationPolicy` gained
        //     `membership_penalty_after_cancellations_enabled` +
        //     `membership_penalty_after_cancellations_count` — the
        //     master gate + threshold for the existing membership
        //     late-cancel + no-show fee toggles.
        //   • `CustomerTransaction` gained kind
        //     `"cancellation_penalty"` + `isRefundable` +
        //     `cancellationScenario` — non-refundable fee row emitted
        //     when a customer's cancel-with-penalty flow triggers.
        //   • New store action `cancelClassBookingByCustomer` +
        //     selector `computeCancellationPenalty` — the customer-
        //     portal cancel path. Admin cancel path unchanged.
        //   • Seed adds Mia's 4 cancels + linked penalty transaction
        //     so the demo boots with a live example.
        //
        // v32: Role-branch alignment fix — added 3 branch-scoped
        // instructor roles (East/West/Spa), corrected 4 East-branch
        // instructors that were mistakenly assigned to South's
        // instructor role, and seeded 2 instructors each for West
        // and Spa branches so every branch ships with staff. No AppState
        // shape change, but bumping so testers with a persisted v31
        // payload rehydrate against the corrected seed.
        //
        // v31: Reports v33 — 4 new AppState slices (leads,
        // marketingCampaignStats, marketingSpend, staffAttendanceLog) +
        // new fields on Customer, CustomerPlan, CustomerTransaction,
        // CustomerReferral. Backfills via deterministic derivation on
        // rehydrate.
        //
        // v39: POS-created customer_plans rows now carry `totalCredits`
        // + `creditsUsed: 0`. Pre-v39 persisted plans stored these as
        // undefined, causing the Plan-tab "Credit left" column to
        // render "0/0" for POS sales after a persist reload. Bumped
        // so testers get fresh seed on next load.
        //
        // v40: DEMO_NOW_RENEWAL_PLANS fixture (at-risk synth customers)
        // stopped hardcoding `credits_label: "Monthly billing"` +
        // `total_credits: 0`. Now pulls the real per-tier cap from
        // MEMBERSHIP_CREDITS (10 / 20 / 12 / unlimited), so the Plan
        // tab renders "0/10" | "0/20" | "0/12" instead of "0/0".
        // Also: Failed-payments bucket restricted to status === "failed"
        // only (was failed OR pending) — so the dashboard count, modal
        // rows, and each customer's Payments tab agree on the same
        // records.
        //
        // v41: `reconcileCreditsRemaining` boot pass initializes
        // `customer.creditsRemaining` from active finite plan allotments
        // when the seed omits the field. Without this, the Plan-tab
        // side-panel widget showed "0 credits left" while the table
        // row showed "12/12" for the same customer (Layla Chahine
        // client-flagged Jul 2026). Also fixed: bookings decrement now
        // has a real counter to work against instead of skipping when
        // undefined. Notification setCritical also auto-enables Email
        // when flipping critical ON with no channels selected.
        //
        // v42: merged feature/customer-experience which brought in
        // customer-side auth + notification-center updates. Data-
        // integrity fixes above (v39-v41) preserved. Bumped one
        // notch so friend's persisted state also refreshes cleanly.
        //
        // v43: dashboard "Needs attention today" reshape — new
        // refund-request fields on CustomerTransaction + NOW-anchored
        // fixtures (refund requests, waitlist confirmations, new
        // sign-ups). Bumped so testers get the fresh fixtures.
        //
        // v44: wallet (account-credit AED) subsystem — new
        // `walletTransactions` slice + seed. Backs the referral
        // Account-Credit reward, the customer Wallet tab, and POS
        // Member Wallet payments. Bumped so testers get the seed.
        //
        // v45: roles are now BRANCH-AGNOSTIC — `Role.branchId` removed, the
        // per-branch role duplicates collapsed to one row per role (canonical
        // ids), and staff re-pointed to them. Branch is chosen at assignment.
        // Bumped so old persisted state (branch-scoped roles) is discarded.
        //
        // v46: Forma West branch now carries full working hours (was closed
        // every day) so no branch renders as a red "no hours" row. Bumped so
        // testers re-seed the updated business_hours.
        //
        // v47: Sales commission wired to recorded sales.
        //   • PayrollEntry gains commissionPackages/Memberships {Sales,Percent}
        //     + commissionAmount snapshot fields (populated at run confirm).
        //   • POS `applyPurchase` stamps `staffId` from the logged-in cashier
        //     so payroll can link commission to actual sales.
        //   • payroll_entries seed carries historical commission for Monthly-
        //     rate staff so the demo lands populated.
        //
        // v48: Full staff coverage for the payroll demo.
        //   • Every staff row now carries a pay_rate_id (23/23) — no more
        //     empty pay rate on Owner / branch admins / operators / front
        //     desk. Non-instructor staff default to the Monthly Rate so
        //     they earn visible sales commission.
        //   • SELLER_STAFF_DIST widened to distribute the seeded POS sales
        //     across every Monthly-rate staffer so the demo shows real
        //     commission on every row (no AED 0 mystery rows).
        //   • POS + schedule checkout gain a "Sold by" picker so testers
        //     can SEE the attribution and change it before completing the
        //     sale. `applyPurchase` gained a `sellerStaffId` override.
        //
        // v49: Payroll ↔ Sales commission split.
        //   • Payroll module is now INSTRUCTOR-ONLY again — compensation
        //     list, Run Payroll, and payroll detail all revert to sourcing
        //     from the `instructors` slice. Sales commission section
        //     removed from payroll surfaces.
        //   • Sales commission moves to the Staff Detail page's Overview
        //     tab for non-instructor staff on a Monthly rate with a
        //     non-zero commission %. Same math, new surface.
        //   • POS "Sold by" picker removed — attribution is fully
        //     automatic from the logged-in cashier's `staff_profile_id`.
        //   • Instructor role can NOT be assigned to a pay rate with a
        //     non-zero sales commission %. Filter enforced in
        //     StaffFormPage. Seed rebalanced: Candice Wu moved off
        //     pr_monthly onto pr_standard.
        //   • Persist bumped so testers re-seed with the new alignment.
        //
        // v50: Removed the "Goodwill credit" wallet-transaction seed row
        //   (Ava Wright · +AED 50). Was a stray demo row with no matching
        //   admin flow — client would flag it as a bug. Wallet now cleanly
        //   surfaces only Referral rewards (credits) and POS spends
        //   (debits). Persist bumped so old localStorage payloads drop the
        //   phantom row.
        //
        // v51: Per-branch timezone (client Jul 2026).
        //   • Branch gains an optional `timezone: string` (IANA) — auto-
        //     derived from country + city via
        //     `resolveBranchTimezone` in src/lib/data/locales.ts. Never
        //     manually edited.
        //   • Studio-wide `businessProfile.timezone` is deprecated as
        //     admin-facing UI (dropdown + landing card tile removed);
        //     the field stays on the model as a fallback for legacy
        //     reads (customer app default, etc.). Every future
        //     branch-scoped time display should prefer branches[i].timezone.
        //   • Seed: existing 4 branches carry Asia/Dubai (matches their
        //     Dubai addresses); creating a new branch triggers
        //     re-derivation.
        //
        // v52: 3-tier country/state/city dropdowns (client Jul 2026).
        //   • Branch schema gains an optional `state: string` (English
        //     display name, e.g. "Dubai", "East Java", "California"). Same
        //     for Customer records via CustomerFormPage.
        //   • locales.ts redesigned: every Country carries a list of
        //     `states`, each with its OWN IANA timezone (Indonesia's WIB /
        //     WITA / WIT, Australia's 5 zones, US's 6, etc.) plus a curated
        //     list of top cities. Adaptive state labels ("Emirate" for UAE,
        //     "Province" for Indonesia, "Governorate" for Egypt, …).
        //   • `resolveBranchTimezone` now reads (country, state, city) —
        //     state wins, city fallback searches every state, country
        //     default last. Backward-compat: legacy records without `state`
        //     resolve via city lookup as before.
        //   • Persist bumped so testers re-seed with the new field on the 4
        //     seed branches.
        // v53 (2026-07-13): brandingSettings seed re-anchored — primaryColor
        //   `#C4EDD6` → `#658774` (customer sage) and tertiaryColor `#F1F2ED`
        //   → `#E9FFF3` (pale sage). The Branding wire-up flows these seeds
        //   through `--brand-*` CSS vars to every customer surface, so a
        //   stale persisted mint value would visually break the customer app
        //   until the admin manually re-picked sage. Bump forces a reseed on
        //   next hydrate. Non-branding slices unaffected.
        // v54 (2026-07-13): tertiaryColor re-anchored `#E9FFF3` → `#C4EDD6` so
        //   the seed matches the actual DS Button "primary" variant background
        //   (`bg-[var(--colors-secondary-200)]`). Before this bump, the admin form showed
        //   `#E9FFF3` but the customer's Book class button rendered `#dcebe4`,
        //   which read as "tertiary not connected" when scrubbed. Bump forces
        //   testers to reseed with the aligned value.
        // v55 (2026-07-13): customers seed re-anchored — 6 date_of_birth values
        //   shifted onto class dates in the demo range (2026-05-08 → 05-22) and
        //   3 created_at values pulled to within 30 days of the demo dates so
        //   the new roster context pills (`ClassCustomerBadges` /
        //   `AppointmentCustomerBadges`) actually fire during a client demo.
        //   Every class detail in the seed range now shows at least one
        //   Birthday or New Member pill. Bump forces a reseed on next hydrate.
        // v56 (2026-07-14): CustomerReferral gains `benefitType` +
        //   `benefitAmount`. Split the customer-detail Referrals tab's
        //   "Total bonus credits" card into a "Rewards earned" card with
        //   two lines (class credits, account credits AED) — matches how
        //   the studio's referral program actually pays out (Settings →
        //   Referral supports `free_credits` OR `wallet_credit` reward
        //   types). 3 seed rows + half of DEMO_NOW_REFERRALS re-typed to
        //   `wallet_credit` so both card lines demo populated. Bump forces
        //   a reseed on next hydrate so testers pick up the new fields.
        // v57 (2026-07-14): session-type dimension Phase 1. Every bookable/
        //   scheduled row gains an explicit `type` ("class" | "private" |
        //   "recovery"): ClassTemplate/ClassSchedule = "class", Service =
        //   "private" | "recovery" (replaces `is_recovery`; store keeps a
        //   derived back-compat `isRecovery`), Appointment inherits from its
        //   service. The fake "Forma Spa" branch (`branch_forma_spa`) is
        //   deleted — recovery services/appointments/staff/hours relocated to
        //   Forma South, with a new "Recovery" room (massage + IV use it,
        //   sauna + breathwork are room-less). Bump forces a reseed so stale
        //   payloads (spa branch, is_recovery-only services) drop cleanly.
        // v58 (2026-07-14): session-type dimension Phase 2. Removed the
        //   Club/Spa concept entirely — `Branch.kind` deleted, `Service.
        //   isRecovery` + `Service.branchKind` deleted (all consumers now
        //   read `type`), and `Service.roomId` added (optional default room,
        //   picked in the service form's new room selector). ServiceForm now
        //   uses a Private/Recovery type selector instead of a recovery
        //   toggle. Bump forces a reseed so stale payloads (branch.kind,
        //   service.isRecovery/branchKind) drop cleanly.
        // v59: Freeze policy — per-branch `freezePolicies` slice + seed
        //   (Settings → Customer → Freeze policy). Phase 1 is additive; the
        //   customer/admin freeze flows are wired in Phase 2. Bump reseeds so
        //   the new slice lands.
        // v60 (2026-07-15): CancellationPolicy gains `cancellation_reasons`
        //   (single source of truth for the cancel-plan reason dropdown in
        //   the admin CustomerDetailPage modal AND the customer-portal cancel
        //   sheet). Bump so old persisted policies pick up the new field
        //   rather than reading undefined.
        // v61 (2026-07-15): FreezePolicy flipped from per-branch array
        //   (`freezePolicies: FreezePolicy[]`) to a single studio-wide record
        //   (`freezePolicy: FreezePolicy`, with `id` replacing `branch_id`).
        //   Matches how cancellationPolicy / classesSettings are stored.
        //   Bump reseeds so old array payloads drop cleanly.
        // v62 (2026-07-15): Commission refactor Phase 1. PayRate gains
        //   categorised `commissions[]` + `bonuses[]` (on any rate type);
        //   the old Monthly-only `sales_commission_*_percent` fields are
        //   deprecated + dropped from the seed. Bump reseeds so pay rates
        //   land with the new categorised shape.
        // v63 (2026-07-15): Phase 3 polish — pr_standard gains a class
        //   commission so the data-rich SOUTH instructors show non-empty
        //   commission. Bump reseeds pay rates.
        // v64 (2026-07-15): Commission REVERTED to Monthly-rate only (client
        //   confirmed — never said "all rate types"). Commissions removed from
        //   pr_senior + pr_standard; form + calc gate to Monthly. Liam Chen
        //   moved to pr_monthly + added to the POS seller rotation so an
        //   instructor shows non-empty commission. Bump reseeds.
        // v65 (2026-07-15): Liam's payroll entry re-based to his Monthly Rate
        //   (was stale pr_standard/AED 441) → month rollup = AED 8,000 salary,
        //   so the payroll staff-detail + compensation list show a real total
        //   instead of AED 0. Bump reseeds payroll entries.
        // v66 (2026-07-15): Candice's payroll entry re-based to her Monthly Rate
        //   (was stale pr_standard/AED 294) to match her assignment — QA fix so
        //   the earnings figure agrees across the compensation list, run
        //   payroll + staff detail (all now go through one shared helper). Bump
        //   reseeds payroll entries.
        // v67 (2026-07-16): Account credit becomes a checkout reduction toggle
        //   (was standalone "Member Wallet" payment method). CustomerTransaction
        //   gains `accountCreditAppliedAed` so refunds can restore the balance.
        //   Bump discards old persisted transactions to avoid a mixed shape.
        // v68 (2026-07-17): Studio's referral is Class Credit only (client rule
        //   — no mixed class + account credit histories per customer).
        //   `wallet_transactions` seed emptied; `customer_referrals`
        //   `wallet_credit` overrides removed. Bump reseeds so existing
        //   testers drop the stale referral wallet balances.
        // v69 (2026-07-17): Follow-up — retired the alternating
        //   `REWARD_TYPES` array on `DEMO_NOW_REFERRALS` (was still
        //   stamping half the demo referrals as `wallet_credit` @ AED 50
        //   × credits, e.g. "Liam Carter — AED 100"). Every DEMO_NOW row
        //   now stamps `free_credits` with the row's benefit_credits
        //   count. Bump reseeds so testers who already refreshed under
        //   v68 pick up the corrected shape.
        // ─── Admin-side bumps (came in via main) ────────────────────────
        // v70 (2026-07-20 admin): Two live "trials ending within 7 days"
        //   plan rows added to DEMO_NOW_PLANS (intro package on cust 4,
        //   3-class trial on cust 7) so the Today Needs Attention
        //   "Trials end" row renders out of the box. Bump reseeds cached
        //   testers.
        // v71 (2026-07-20 admin): New `importHistory` slice (6 seeded
        //   rows) — powers the Settings → Operations → "Migration &
        //   imports" table. Bump so cached testers pick up the new
        //   slice on refresh instead of rendering an empty state.
        // v72 (2026-07-20 admin): Follow-up — all `importHistory` seed
        //   rows normalised to file_type: "csv" (client: "keep to be CSV
        //   for now"). Runtime + icon system still handle xlsx / xls
        //   when real AI-Agent-driven imports land; only the demo data
        //   is CSV-only.
        //
        // ─── Customer-side bumps (came in via feature/customer-experience) ─
        // v70/v71 (2026-07-20 customer): schedule status derived from
        //   the DEVICE clock (`liveScheduleStatus`) so a past class
        //   can never sit in customer Upcoming; ClassBooking gains
        //   waitlist claim-offer fields (`waitlistClaimOfferedAt`,
        //   `ExpiresAt`, `DeclinedAt`) for the "Notify to accept" flow;
        //   spot-layout + occupancy unified — default room grid is the
        //   admin form's own 4x2 with nothing blocked, grid never
        //   truncated to class capacity, and booked seats get a STORED
        //   spot via `reconcileBookingSpots` so the admin roster and
        //   customer picker read the same value.
        //
        // ─── Merge bump ──────────────────────────────────────────────────
        // v73 (2026-07-20): both sets of the above are now live together.
        //   Two parallel branches (admin dashboard/migration work + the
        //   customer waitlist-claim / spot-layout work) each bumped v70
        //   onward with DIFFERENT meanings. Neither's schema conflicts
        //   with the other's — but a tester carrying an old v70/v71/v72
        //   payload can't tell which parallel version wrote it. A single
        //   bump to v73 sits above both lineages and forces a clean
        //   reseed on merge day so everyone lands on the same
        //   schema-plus-seed floor.
        // v74 (2026-07-20 admin): 8 new check-in test rows appended to
        //   SCHEDULE_SPECS covering today + next 3 days across every
        //   SLOT_TIMES bucket (see prototype_demo_data.ts § "Check-in
        //   test rows"). Client couldn't find an Upcoming class after
        //   noon since the seed had only the 11:00 today slot. Bump
        //   reseeds cached snapshots so testers always see fresh
        //   Upcoming classes with real bookings.
        // v75 (2026-07-20 admin): follow-up to v74 — client asked to
        //   start the new check-in rows from TOMORROW, not today.
        //   All 8 specs shifted +1 day (today → tomorrow, tomorrow →
        //   in 2 days, etc). Bump reseeds any v74 payload so the
        //   today rows no longer show up.
        // v76 (2026-07-20 admin): follow-up to v75 — client asked to
        //   include Ava Wright on ALL 8 new check-in classes. Bumped
        //   the `booked` count on the two rows the rotator wasn't
        //   reaching (class #1 6→9, class #5 4→5). Bump reseeds
        //   cached snapshots so testers pick up the widened rosters.
        // v77 (2026-07-20 admin): FreezePolicy v2 — schema expanded
        //   per client feedback into a full membership-freeze workflow:
        //   • billing_behavior (Option A/B — Pauses vs Stays on schedule)
        //   • who_can_freeze (Members&admins / request-approval / admins-only)
        //   • min_duration_value + _unit (default 7 days)
        //   • max_freezes_period (calendar_year — fixed per client Q1)
        //   • rename allow_exceptions → require_reason (semantic clone)
        //   • FreezeReason.exceptions (per-reason bypass of duration /
        //     limit / fee)
        //   The rehydrate handler below migrates old `allow_exceptions`
        //   into `require_reason` on any pre-v77 payload so testers
        //   don't lose their reason-required setting on refresh, and
        //   defaults any missing v2 fields to sensible v1-equivalent
        //   behaviour. Belt + suspenders per plan doc Q8: the version
        //   bump forces stale caches to reseed anyway.
        // v78 (2026-07-21 admin): FreezePolicy v2 Phase 4 — auto-resume
        //   sweep + freeze reminder notification. Adds
        //   `freezeReminderSentAtISO` idempotency stamp on CustomerPlan
        //   (defaults to undefined via migration below) so a fresh
        //   hydrate can queue the 3-day reminder without spamming the
        //   bell on repeat hydrates the same day. Bump reseeds stale
        //   payloads so testers pick up the two new notification events
        //   (`membership_frozen`, `membership_reactivated`) + the new
        //   `ns_membership_freeze_reminder` notification_settings row.
        // v79 (2026-07-21 admin): FreezePolicy v2 Phase 5 — approval flow
        //   + Option A/B billing math. CustomerPlan gains:
        //     • `freeze_requested` status
        //     • freezeRequestStartISO / freezeRequestEndISO / reason /
        //       requestedAtISO / rejectionNote scratch fields
        //     • nextChargeAdjustmentAed (Option B prorate credit)
        //   Persisted rows keep working — the fields are all optional,
        //   defaults are undefined. Bump reseeds stale payloads so
        //   testers pick up the new store actions (requestFreezeByCustomer /
        //   approveFreezeRequest / rejectFreezeRequest) + the new admin
        //   review modal + the pending-approval customer plan card state.
        // v80 (2026-07-22 admin): Referral share widget + customer seed
        //   regeneration — `generateSyntheticCustomers` now anchors every
        //   synthetic's `created_at` to the real NOW (was hard-coded to
        //   2024-*) and stamps `converted_from` per-row with a growing
        //   referral share by month. Bump forces stale localStorage
        //   payloads to reseed so testers pick up the new customer
        //   distribution — otherwise a persisted v79 snapshot keeps the
        //   old 2024 dates and the widget reads as almost empty.
        // v81 (2026-07-22 admin): Staff/Time-off Phase 2 — BlockedTime
        //   extended with `date_from_iso` / `date_to_iso` / `all_day` /
        //   `reason: "sick" | "vacation" | "training" | "other"` per the
        //   client's rename to "Time off". Old entries lack the new
        //   fields; the onRehydrateStorage migration below backfills
        //   them so persisted v80 snapshots stay valid. Fresh seed
        //   ships the mockup entries (Maya vacation Aug 3-9, Sara
        //   Aug 7-12, Liam physio Jul 23, team training Aug 21,
        //   Pilates review Jul 31). Bump forces stale seed to
        //   reseed cleanly.
        // v82 (2026-07-22 admin): Staff/Shifts Phase 3 — Shift gained
        //   `staffing_target: number` + new many-to-many
        //   `shiftAssignments` slice (staff ↔ shift with per-assignment
        //   `days_of_week`). Migration backfills `staffing_target = 1`
        //   for shifts missing it and derives an initial
        //   `shiftAssignments` array from every staff row's `shift_id`
        //   when the persisted slice is missing / empty. Bump forces
        //   pre-v82 snapshots to reseed cleanly.
        // ── Branch: feature/customer-experience (schedule · spots · shifts) ──
        // v83 (2026-07-28): spot selection enabled for most scheduled classes
        //   (all Group classes get a capacity-fit spot grid; consumed
        //   identically by admin + customer). Bump discards pre-v83
        //   snapshots so the fresh seed re-anchors the DEMO_NOW schedules to
        //   the current day AND applies the new spot layout everywhere.
        // v84 (2026-07-28): waitlist demo classes now seed their `booked`
        //   booked rows (were missing → 9/10 with an empty roster), `booked`
        //   is re-derived from booking rows on boot (reconcileBookedCounts),
        //   and default spot grids are balanced (10→5×2). Bump so every
        //   snapshot reseeds with the consistent booking data.
        // v85 (2026-07-28): moved today's Liam "Reformer Pilates" demo class
        //   from 1:00 PM to 2:00–3:00 PM (live testing). Bump so persisted
        //   snapshots reseed with the new time on both admin + customer.
        // v86 (2026-07-28): seeded active shifts for branch_forma_west so West
        //   instructors (e.g. Amelia Park) are assignable — the shift picker
        //   was empty for them. Bump so the new shifts reseed.
        // ── Branch: feature/insights-kpi-ai-agent-polish (customers · leads · AI) ──
        // v83 (2026-07-24): Customer & Lead Management foundation.
        //   Customer extended with 5 optional fields (lifecycleTag,
        //   isVip, followUpStatus, assignedTo, sourceId). Three new
        //   slices seeded: followUpTasks (empty), leadSources (10
        //   defaults), followUpStages (6 defaults). Rehydrate hook
        //   backfills the three slices for pre-v83 snapshots AND
        //   mirrors every retained `leads[]` row into `customers`
        //   with `lifecycleTag: "Lead"` (dedup by email OR phone).
        //   The `leads` slice is INTENTIONALLY retained — the AI
        //   Agent's migrate / analyze / reports flows still read it.
        // v84 (2026-07-27): Lifecycle showcase personas seeded — 7
        //   demo customers (one per lifecycle stage) + supporting
        //   plans / bookings / transactions so the client can walk
        //   through every pill / segment / task-engine surface
        //   without hand-building state. Bumped so pre-v84 caches
        //   reseed and pick up the personas via the rehydrate hook.
        // v85 (2026-07-27): Bulk lifecycle personas — +28 more (~4
        //   per stage) so the segment tabs and Lifecycle filter
        //   have real volume to play with. Also removes `locked`
        //   / `isTerminal` on the seeded sources + stages. Bump
        //   forces a rehydrate so the bulk injection runs.
        // v86 (2026-07-27): Lifecycle personas get portraits so
        //   the customer table + profile header render real
        //   faces instead of gray "SN" initials tiles. Bump so
        //   pre-v86 caches pick up the imageUrl fields.
        // v87 (2026-07-28): AI Agent audit-4 fix. INITIAL_CUSTOMERS
        //   (the 10 hand-authored seed customers — Ava, Bosa,
        //   Rosale, Zahra, Ahmed…) now restore on rehydrate if
        //   they're missing from the persisted state. Symptom:
        //   AI Agent couldn't find Ava Wright because she was
        //   absent from the snapshot. Bump forces the sweep.
        // v88 (2026-07-28): MERGE of the two feature branches above. Both
        //   independently reached v86 / v87 with different schema + seed
        //   changes; bump to 88 so every persisted snapshot reseeds cleanly
        //   with the UNION of both branches' slices, seeds, and migrations.
        // v89 (2026-07-29) [main / Retail]: Inventory / Retail Phase A — four
        //   additive store slices (retailCategories · retailProducts · retailStock ·
        //   retailStockAdjustments) + optional line-item snapshot fields on
        //   CustomerTransaction. onRehydrateStorage injects the seeds when a slice
        //   is missing or empty so every browser lands on the same inventory.
        // v90 (2026-07-29) [insights-kpi-ai-agent-polish]: Retail products gained
        //   real photo assets under /public/images/retail/ (studio-tank, grip-socks,
        //   pre-workout, resistance-bands, stainless-bottle, studio-towel). Pre-v90
        //   snapshots persisted the OLD image-less products; the id-keyed backfill
        //   only ADDS missing rows, so bumping is the cleanest way to reseed the 6
        //   rows that gained an image_url.
        // v91 (2026-07-30) [insights-kpi-ai-agent-polish]: Retail catalog trimmed
        //   15 → 6 products (only those with real photos ship in the demo). Persisted
        //   stock + adjustment rows referencing the 9 dropped products would dangle
        //   otherwise; the id-keyed backfill above never REMOVES rows, so a version
        //   bump is the only way to force a clean reseed. Also adds 20 retail-kind
        //   customer_transactions so the Retail Sales report has real data on day one.
        // v91 (2026-07-30) [customer-experience]: Ava Wright (customer demo persona)
        //   Past reshaped to exactly 5 across ALL booking types — 3 class
        //   (1 attended-rateable, 2 cancelled) + 2 appointment (private + recovery,
        //   both Attended + pre-rated). Empty Upcoming by default. Her generated
        //   class + appointment bookings/ratings are stripped and replaced with the
        //   curated set.
        // v92 (2026-07-30) [main / merge]: BOTH branches independently reached v91
        //   for different reasons (see the two v91 entries above). Bump to 92 forced
        //   every persisted snapshot from either branch to reseed cleanly from the
        //   merged INITIAL_* — guaranteeing BOTH the trimmed retail catalog (+ real
        //   photos + 20 retail customer_transactions) AND Ava Wright's curated
        //   Past = 5 / empty Upcoming / both appointment ratings.
        // v93 (2026-07-31): Merge of origin/main (AI Agent phases + retail) into
        //   customer-experience, PLUS two live-demo classes TODAY at 1 PM + 2 PM for
        //   the attendance-flow walkthrough. Bump ABOVE both branches' v92 so every
        //   persisted snapshot (from either side) reseeds with the union — retail +
        //   curated Ava bookings + the new demo class schedules/bookings.
        // v94 (2026-07-31): App-wide 12-hour time standardization. Class + appointment
        //   `displayTime` is now RE-DERIVED at boot from the raw 24h start/end via the
        //   canonical `formatTimeRange12` (e.g. "5:00 - 6:00 PM"), so persisted
        //   snapshots carrying the old 24h / zero-padded strings must reseed.
        // v95 (2026-07-31): Retail integration sweep — new `retail` tax-rule
        //   category + a seeded `trl_retail_default` rule (so POS retail lines
        //   pick up VAT), promo codes now apply to retail lines, a
        //   `retail_purchase` customer-notification event, and referral rewards
        //   count retail spend. Persisted snapshots predate every one of those
        //   seed rows, so a bump is required to pick them up.
        // v96 (2026-07-31): Gift-card redemption + referral auto-issuance.
        //   CustomerTransaction gains `giftCardDebits[]`; CustomerReferral
        //   gains `rewardIssuedAtISO` + `referredCustomerId`. Seeded referrals
        //   are backfilled as already-issued at boot so the new engine can't
        //   re-pay historical rows — persisted v95 payloads predate the field
        //   and would look "pending", double-paying every seeded referrer.
        // v97 — commission now covers retail + gift-card sales. IssuedGiftCard
        //   gains `sold_by_staff_id` (seller credited at sale); the `pr_monthly`
        //   seed gains a `retail` commission row; a few seeded gift cards get a
        //   seller. Bump so persisted v96 payloads (no seller ids, old rate)
        //   reseed and surface the new commission categories in the demo.
        // v98 — gift-card SALES are now real transactions (kind:"gift_card"):
        //   they appear in Payment History and are refundable while the card is
        //   unused. CustomerTransaction gains `issuedGiftCardId`; IssuedGiftCard
        //   status gains "refunded"; one sale txn is synthesised per seeded
        //   card. Bump so persisted v97 payloads gain the gift-card sale rows.
        // v100 — POS sells Private / Recovery sessions. The single "appointment"
        //   tax category split into "private" + "recovery" (seed tax_rules
        //   changed); PurchaseLineItem / CustomerTransaction gain the two session
        //   kinds. Bump so persisted payloads drop the stale "appointment" tax
        //   rule and pick up the new per-type rules + session-aware seeds.
        // v101 — new "Attendees" predefined role + Robin Vega staff row. The
        //   roles + staff slices are persisted, so bump to re-seed them (and
        //   refresh today's classSchedules) — otherwise the new role never
        //   appears in Staff & Permissions on an existing device.
        // v102 — added a today EVENING demo class so the attendee console's
        //   Upcoming group reliably populates alongside the Ongoing ones.
        //   classSchedules are persisted → bump to re-seed today's classes.
        // v103 (2026-08): custom-amount gift card design added to the seed +
        //   shift assignments gained an optional `week_start` (weekly scoping).
        //   Bump so persisted demos reseed the gift-card catalog + shift scoping.
        // v104 (2026-08-05): staff "Today's schedule" column rebuilt to the
        //   Figma timeline (5 states). Added Liam's today class + today-relative
        //   partial time off so the "shift + time off + schedule" state is
        //   seeded/testable. blockedTimes + classSchedules are persisted → bump.
        // v105 — follow-up showcase: added named leads / lapsed trialists whose
        //   real state trips the follow-up engine, and a boot backfill that
        //   generates the tasks at seed time. customers / customerPlans /
        //   classBookings / followUpTasks are persisted → bump so the Follow-ups
        //   tab + "Leads to follow up" widget show a real list on existing
        //   devices instead of an empty tab.
        // v106 — class-schedule audit Phase 1 (2026-08-05): unified the
        //   instructor source of truth. Reconciled two seed contradictions
        //   (Lana Steiner branch East→South in staff_profiles; Candice Wu rate
        //   pr_monthly→pr_standard in instructors) so the instructors slice is
        //   persisted → bump so existing devices pick up the reconciled data
        //   instead of the stale divergent copies.
        // v107 — class-schedule audit Phase 2 (2026-08-05): every generated
        //   class now binds to a constraint-valid instructor + room (category /
        //   branch / shift / time-off / room fit / no double-book) instead of
        //   the old round-robin, and no class lands on a day its branch is
        //   closed. classSchedules is persisted → bump so existing devices load
        //   the repaired schedule instead of the old invalid assignments.
        // v108 — class-schedule audit Phase 3 (2026-08-05): reconciled Candice
        //   Wu's payroll entry (pr_monthly→pr_standard, base 8000→294) so it
        //   matches her canonical staff.ts rate. payrollEntries is persisted →
        //   bump. (Notification seeds needed no change — all reference hand rows
        //   or Liam's classes, none of which Phase 2 altered.)
        // v109 — class-schedule audit Phase 7 (2026-08-05): verification sweep
        //   fixed one pre-existing seed error — booking bk_mia_cancel_3 was
        //   tagged South but its class is at East. classBookings is persisted →
        //   bump so branch-scoped reports/dashboards filter it correctly.
        // v110 (2026-08-06): merge of the customer-experience line into the
        //   insights/KPI line. Brings the guest-booking flags on classesSettings
        //   (guests_use_plan_enabled / guests_allow_unlimited) for the Bring a
        //   friend flow on top of the v106-110 schedule audits + rebrand. v111
        //   also adds the customer guest-booking fields (guest phone, guest
        //   booking limit). Fresh bump so every persisted demo re-seeds with the
        //   combined data + branding.
        version: 112,
        storage: createJSONStorage(() => localStorage),
        // Persisted rows keep whatever status they had when they were written,
        // so a demo session left open across a date boundary (or restored days
        // later) would show past classes as Upcoming. Re-derive from the device
        // clock on every hydrate — one place, so admin and customer agree.
        onRehydrateStorage: () => (state) => {
            if (!state) return;
            // v83 (2026-07-24) — same-branch shift invariant. A staff member
            // can only hold shifts at their OWN branch. Drop any persisted
            // cross-branch assignment + clear a legacy `shiftId` pointing across
            // branches (Owner/null branch exempt). Keeps the week grid, staff
            // detail, and availability consistent with the branch-scoped assign
            // surfaces — no version bump needed.
            if (Array.isArray(state.shiftAssignments) && Array.isArray(state.shifts) && Array.isArray(state.staff)) {
                const shiftBranch = new Map(state.shifts.map(sh => [sh.id, sh.branch_id] as const));
                const staffBranch = new Map(state.staff.map(s => [s.id, s.branchId] as const));
                state.shiftAssignments = state.shiftAssignments.filter(a => {
                    const sb = staffBranch.get(a.staff_id);
                    const shb = shiftBranch.get(a.shift_id);
                    if (sb == null || shb === undefined) return true; // owner / unknown → keep
                    return sb === shb;
                });
                state.staff = state.staff.map(s => {
                    if (s.shiftId && s.branchId != null) {
                        const shb = shiftBranch.get(s.shiftId);
                        if (shb !== undefined && shb !== s.branchId) return { ...s, shiftId: undefined };
                    }
                    return s;
                });
            }
            state.classSchedules = state.classSchedules.map((c) => ({
                ...c,
                status: liveScheduleStatus(c.dateISO, c.startTime, c.endTime, c.status),
            }));
            state.appointments = state.appointments.map((a) => ({
                ...a,
                status: liveScheduleStatus(a.dateISO, a.startTime, a.endTime, a.status),
            }));
            // v83.1 (2026-07-24) — "Preference: Flexible" backfill. Pre-existing
            // snapshots have no `flexible` flag on their appointment rows, so the
            // Appointment Details Flexible badge + Reassign action would have no
            // live data on any browser with prior demo state. Backfill using the
            // same deterministic rule as the seed (every 2nd private appointment)
            // for rows where the flag is still undefined — idempotent, keeps any
            // admin-set value, and needs no version bump / state wipe.
            state.appointments = state.appointments.map((a, i) => {
                if (a.flexible !== undefined) return a;
                const flexibleByRule = !a.openSession && !!a.instructorId && i % 2 === 0;
                return { ...a, flexible: flexibleByRule };
            });
            // Pay config backfill (client 2026-07-24) — pre-existing snapshots have
            // no `payConfig` on staff rows, so the Pay rate step + Instructor
            // detail Pay rate tab would render empty. Derive it with the same rule
            // as the seed (instructors → 3 tracks, others → Default only) for rows
            // still missing it. Idempotent; no version bump / state wipe.
            if (Array.isArray(state.staff)) {
                let synced = false;
                state.staff = state.staff.map(s => {
                    if (s.payConfig) return s;
                    synced = true;
                    const payConfig = deriveStaffPayConfig(s);
                    return { ...s, payConfig, payRateId: payConfig.default.payRateId ?? s.payRateId };
                });
                // Keep the legacy instructors slice's rate in step with the
                // staff Default track (payroll reads it for name + commission).
                if (synced && Array.isArray(state.instructors)) {
                    const rateById = new Map(state.staff.map(s => [s.id, s.payConfig?.default.payRateId ?? s.payRateId] as const));
                    state.instructors = state.instructors.map(i => {
                        const r = rateById.get(i.id);
                        return r ? { ...i, payRateId: r } : i;
                    });
                }
            }
            // v77 (2026-07-20) — FreezePolicy v2 migration.
            // Any pre-v77 snapshot has `allow_exceptions` but not
            // `require_reason`; missing v2 fields need sensible
            // defaults so the panel doesn't throw undefined-access
            // errors. Belt + suspenders per plan doc Q8: version
            // bump above forces stale caches to reseed anyway, but
            // if Zustand's persist middleware carries the row through
            // (e.g. same-major upgrade), this fixup guarantees the
            // shape is complete + safe.
            const fp = state.freezePolicy as unknown as
                (FreezePolicy & { allow_exceptions?: boolean }) | undefined;
            if (fp) {
                // Rename: allow_exceptions → require_reason.
                if (fp.require_reason === undefined && fp.allow_exceptions !== undefined) {
                    fp.require_reason = fp.allow_exceptions;
                }
                // Defaults for every new v2 field.
                if (fp.billing_behavior === undefined)   fp.billing_behavior = "pause";
                if (fp.who_can_freeze === undefined)     fp.who_can_freeze = "members_and_admins";
                if (fp.min_duration_value === undefined) fp.min_duration_value = 7;
                if (fp.min_duration_unit === undefined)  fp.min_duration_unit = "days";
                // Client 2026-07-22 flipped the default window from
                // "calendar_year" to "rolling_12m". Migration rewrites
                // any pre-existing seed (undefined OR the legacy value)
                // so every studio lands on the new behavior on next
                // rehydrate without a version bump.
                if (fp.max_freezes_period === undefined || (fp.max_freezes_period as string) === "calendar_year") {
                    fp.max_freezes_period = "rolling_12m";
                }
                if (fp.require_reason === undefined)     fp.require_reason = true;
                // Reasons array — every reason gets the exceptions
                // field defaulted to undefined (no bypass), so per-
                // reason overrides opt-in rather than opt-out.
                if (Array.isArray(fp.reasons)) {
                    fp.reasons = fp.reasons.map(r =>
                        r.exceptions !== undefined ? r : { ...r },
                    );
                }
                // Drop the legacy alias — future reads must go through
                // require_reason. Keeping the old key would confuse
                // grep/audit tools + tempt callers to use the stale name.
                delete (fp as { allow_exceptions?: boolean }).allow_exceptions;
                state.freezePolicy = fp;
            }
            // v81 (2026-07-22) — Time off Phase 2 migration.
            //
            // BlockedTime rows written pre-v81 lack `date_from_iso`,
            // `date_to_iso`, `all_day`, and `reason`. Backfill from the
            // legacy `date` column so the list + form render without
            // undefined-access errors: a legacy single-day entry becomes
            // a single-day range (from = to = date), timed by default
            // (all_day=false), and lands under `reason: "other"` with
            // the existing `note` preserved. Fresh v81 seed already
            // carries every field so it's a no-op there.
            if (Array.isArray(state.blockedTimes)) {
                state.blockedTimes = state.blockedTimes.map(bt => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const b = bt as any;
                    return {
                        ...b,
                        date_from_iso: b.date_from_iso ?? b.date,
                        date_to_iso:   b.date_to_iso   ?? b.date,
                        all_day:       b.all_day       ?? false,
                        reason:        b.reason        ?? "other",
                    } as typeof bt;
                });
            }
            // v82 (2026-07-22) — Shifts Phase 3 migration.
            //
            // Backfill `staffing_target` on every persisted Shift row
            // (default 1) so the list's "N / M needed" chip never
            // renders "N / undefined needed". Then derive an initial
            // `shiftAssignments` slice from every staff row's
            // `shift_id` when the persisted store came in without one
            // (pre-v82 snapshots). Same derivation the seed uses at
            // module load so admins land on the same shape.
            if (Array.isArray(state.shifts)) {
                state.shifts = state.shifts.map(s => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const sh = s as any;
                    return {
                        ...sh,
                        staffing_target: typeof sh.staffing_target === "number" ? sh.staffing_target : 1,
                    } as typeof s;
                });
            }
            if (!Array.isArray(state.shiftAssignments) || state.shiftAssignments.length === 0) {
                const derived: ShiftAssignment[] = [];
                for (const st of state.staff ?? []) {
                    if (!st.shiftId) continue;
                    const parent = state.shifts.find(x => x.id === st.shiftId);
                    if (!parent) continue;
                    derived.push({
                        id: `sa_${parent.id}_${st.id}`,
                        shift_id: parent.id,
                        staff_id: st.id,
                        days_of_week: [...parent.working_days],
                        created_at: parent.created_at,
                    });
                }
                state.shiftAssignments = derived;
            }
            // v83 (2026-07-24) — Customer & Lead Management foundation.
            //
            // Two independent sub-migrations, both idempotent so a v83 tab
            // re-hydrating doesn't duplicate work:
            //
            //  1. NEW-SLICE DEFAULTS — Pre-v83 snapshots don't carry the
            //     three new slices at all (Zustand's persist middleware
            //     silently drops fields the persisted payload doesn't have).
            //     Backfill leadSources + followUpStages from the module-
            //     scope seeds so Settings (Phase 6) has editable rows even
            //     for testers who don't wipe localStorage. followUpTasks
            //     stays empty by design — tasks materialise as triggers fire.
            //
            //  2. LEAD → CUSTOMER MIRROR — For each row in the retained
            //     `leads` slice, upsert a Customer with `lifecycleTag: "Lead"`
            //     if none matches by email OR phone. The `leads` slice is
            //     kept AS-IS (still the AI Agent's sales-funnel dataset);
            //     the mirror gives the admin's new lifecycle views a
            //     Customer row to render. Dedup rule matches addLead's
            //     runtime dedup so bulk import + this hydrate sweep can't
            //     race and create two mirrors for the same person.
            if (!Array.isArray(state.leadSources) || state.leadSources.length === 0) {
                state.leadSources = [...INITIAL_LEAD_SOURCES];
            }
            if (!Array.isArray(state.followUpStages) || state.followUpStages.length === 0) {
                state.followUpStages = [...INITIAL_FOLLOW_UP_STAGES];
            }
            if (!Array.isArray(state.followUpTasks)) {
                state.followUpTasks = [];
            }
            // Client 2026-08-05 — seed the follow-up list from real customer
            // state so the Follow-ups tab + "Leads to follow up" widget show a
            // genuine, auto-generated list on boot (the live engine only fires
            // on writes; nothing ran it at seed time). Only when empty, so a
            // tester's own logged / closed tasks are never overwritten. Every
            // row comes from the same generator the live path uses — no
            // hand-authored tasks. See generateSeedFollowUpTasks.
            if (state.followUpTasks.length === 0) {
                state.followUpTasks = generateSeedFollowUpTasks(state);
            }
            // v83 audit fix — resolve the current label of the seeded
            // "New" stage once so a hypothetical pre-existing rename in
            // the persisted state cascades into fresh mirrors too.
            const rehydrateNewStageLabel =
                state.followUpStages.find(s => s.id === "stg_new")?.label ?? "New";
            if (Array.isArray(state.leads) && Array.isArray(state.customers)) {
                const emailToCustomer = new Map<string, Customer>();
                const phoneToCustomer = new Map<string, Customer>();
                for (const c of state.customers) {
                    if (c.email) emailToCustomer.set(c.email.toLowerCase(), c);
                    if (c.phone) phoneToCustomer.set(c.phone, c);
                }
                const newMirrors: Customer[] = [];
                for (const lead of state.leads) {
                    const matchByEmail = lead.contact_email
                        ? emailToCustomer.get(lead.contact_email.toLowerCase())
                        : undefined;
                    const matchByPhone = lead.phone ? phoneToCustomer.get(lead.phone) : undefined;
                    const existing = matchByEmail ?? matchByPhone;
                    if (existing) continue; // dedup — same person already in customers[]
                    const [firstName, ...restName] = (lead.contact_name ?? "").trim().split(/\s+/);
                    const lastName = restName.join(" ");
                    const initials = `${(firstName || "?").charAt(0)}${(lastName || "").charAt(0)}`.toUpperCase() || "?";
                    const mirrorId = `cu_from_${lead.id}`;
                    if (state.customers.some(c => c.id === mirrorId)) continue;
                    newMirrors.push({
                        id: mirrorId,
                        firstName: firstName || lead.contact_name || "Lead",
                        lastName: lastName || "",
                        initials,
                        email: lead.contact_email ?? "",
                        phone: lead.phone,
                        branchId: lead.branch_id,
                        planKind: null,
                        createdAt: lead.added_at ?? new Date().toISOString(),
                        status: "active",
                        gender: lead.gender,
                        lifecycleTag: "Lead",
                        followUpStatus: rehydrateNewStageLabel as FollowUpStatus,
                        assignedTo: lead.assigned_to_staff_id,
                        sourceId: state.leadSources.find(
                            s => s.label.toLowerCase() === (lead.source ?? "").toLowerCase(),
                        )?.id,
                        marketingSource: lead.source,
                    });
                }
                if (newMirrors.length > 0) {
                    state.customers = [...newMirrors, ...state.customers];
                }
            }
            // v83 lifecycle showcase personas (client 2026-07-27) — for
            // testers who already have a persisted v83 state without the
            // 7 showcase personas + their supporting data, backfill on
            // hydrate. Idempotent — only injects a persona (and its
            // plans / bookings / transactions) if the customer id isn't
            // already in the state. Runs before the recompute sweep so
            // the fresh personas get their lifecycle tags on the same
            // pass.
            if (Array.isArray(state.customers)) {
                const knownCustomerIds = new Set(state.customers.map(c => c.id));
                const knownPlanIds = new Set(state.customerPlans.map(p => p.id));
                const knownBookingIds = new Set(state.classBookings.map(b => b.id));
                const knownTxnIds = new Set(state.customerTransactions.map(t => t.id));
                // v83 audit-4 fix (2026-07-28) — INITIAL_CUSTOMERS added
                // to the rehydrate backfill. Symptom: user searched
                // "Ava Wright" in AI Agent and got a hallucinated
                // response because Ava was missing from the persisted
                // snapshot (deleted / persist edge case). The showcase
                // + bulk lists were the only ones ever restored on
                // rehydrate; the 10 hand-authored seed customers
                // (Ava, Bosa, Rosale, Zahra, Ahmed…) had no safety net.
                // Now every seeded customer restores itself if missing.
                const combinedCustomers = [...INITIAL_CUSTOMERS, ...SHOWCASE_CUSTOMERS, ...BULK_SHOWCASE.customers];
                const combinedPlans     = [...INITIAL_CUSTOMER_PLANS, ...SHOWCASE_PLANS, ...BULK_SHOWCASE.plans];
                const combinedBookings  = [...INITIAL_BOOKINGS, ...SHOWCASE_BOOKINGS, ...BULK_SHOWCASE.bookings];
                const combinedTxns      = [...INITIAL_CUSTOMER_TRANSACTIONS, ...SHOWCASE_TRANSACTIONS, ...BULK_SHOWCASE.transactions];
                const freshCustomers = combinedCustomers.filter(c => !knownCustomerIds.has(c.id));
                if (freshCustomers.length > 0) {
                    state.customers = [...freshCustomers, ...state.customers];
                    state.customerPlans = [...state.customerPlans, ...combinedPlans.filter(p => !knownPlanIds.has(p.id))];
                    state.classBookings = [...state.classBookings, ...combinedBookings.filter(b => !knownBookingIds.has(b.id))];
                    state.customerTransactions = [...state.customerTransactions, ...combinedTxns.filter(t => !knownTxnIds.has(t.id))];
                }
            }
            // v89 (2026-07-29) — Inventory / Retail Phase A. Pre-v89 snapshots
            // have no retail slices at all; the version bump forces a
            // reseed on next hydrate, but we ALSO backfill by id so that a
            // future partial-persist edge case (any single slice missing
            // or emptied) restores the seeded rows deterministically.
            // Same idempotent-by-id pattern as the customer backfill above.
            if (!Array.isArray(state.retailCategories)) state.retailCategories = [];
            if (!Array.isArray(state.retailProducts)) state.retailProducts = [];
            if (!Array.isArray(state.retailStock)) state.retailStock = [];
            if (!Array.isArray(state.retailStockAdjustments)) state.retailStockAdjustments = [];
            {
                const knownCatIds  = new Set(state.retailCategories.map(c => c.id));
                const knownProdIds = new Set(state.retailProducts.map(p => p.id));
                const knownStockIds = new Set(state.retailStock.map(s => s.id));
                const knownAdjIds  = new Set(state.retailStockAdjustments.map(a => a.id));
                const freshCats  = INITIAL_RETAIL_CATEGORIES.filter(c => !knownCatIds.has(c.id));
                const freshProds = INITIAL_RETAIL_PRODUCTS.filter(p => !knownProdIds.has(p.id));
                const freshStock = INITIAL_RETAIL_STOCK.filter(s => !knownStockIds.has(s.id));
                const freshAdj   = INITIAL_RETAIL_STOCK_ADJUSTMENTS.filter(a => !knownAdjIds.has(a.id));
                if (freshCats.length > 0)  state.retailCategories = [...state.retailCategories, ...freshCats.map(c => ({ ...c }))];
                if (freshProds.length > 0) state.retailProducts = [...state.retailProducts, ...freshProds.map(p => ({ ...p }))];
                if (freshStock.length > 0) state.retailStock = [...state.retailStock, ...freshStock.map(s => ({ ...s }))];
                if (freshAdj.length > 0)   state.retailStockAdjustments = [...state.retailStockAdjustments, ...freshAdj.map(a => ({ ...a }))];
            }
            // v83 audit fix (2026-07-27) — recompute lifecycleTag for
            // every customer that lacks one. Without this pass, pre-v83
            // seeded customers (Alice with 100 attended classes, etc.)
            // keep `lifecycleTag: undefined`, and the segment tabs on
            // /admin/customers default them to "Lead" (via
            // `r.lifecycleTag ?? "Lead"`), so "Members" renders empty
            // until the customer's next write. This sweep runs ONCE at
            // hydrate — customers whose tag already exists are skipped
            // so a manual override or later recompute isn't clobbered.
            //
            // Kept inline (rather than iterating through the Zustand
            // action) so we don't build up N action history entries at
            // boot. Uses the same compute the actions use to guarantee
            // parity between "just booted" and "just wrote" state.
            if (Array.isArray(state.customers) && Array.isArray(state.classBookings) &&
                Array.isArray(state.customerPlans) && Array.isArray(state.customerTransactions)) {
                const needsCompute = state.customers.filter(c => c.lifecycleTag === undefined);
                if (needsCompute.length > 0) {
                    const computeState = {
                        customers: state.customers,
                        classBookings: state.classBookings,
                        customerPlans: state.customerPlans,
                        customerTransactions: state.customerTransactions,
                    };
                    const patches = new Map<string, { tag: LifecycleTag; isVip: boolean; computedOn: string }>();
                    for (const c of needsCompute) {
                        const r = computeLifecycleTag(c.id, computeState);
                        patches.set(c.id, { tag: r.tag, isVip: r.isVip, computedOn: r.computedOn });
                    }
                    state.customers = state.customers.map(c => {
                        const p = patches.get(c.id);
                        if (!p) return c;
                        return {
                            ...c,
                            lifecycleTag: p.tag,
                            isVip: p.isVip,
                            lifecycleTaggedOn: c.lifecycleTaggedOn ?? p.computedOn,
                        };
                    });
                }
            }
            // v78 (2026-07-21) — Freeze policy v2 Phase 4.
            // Auto-resume + reminder sweep. Runs at hydrate so an
            // in-memory snapshot always reflects the freeze lifecycle
            // WITHOUT needing a background timer.
            //
            // Two independent sub-sweeps:
            //  1. AUTO-RESUME — any plan whose `freezeEndISO ≤ today`
            //     flips back to active. Fires a customer bell row +
            //     an admin bell row so both audiences see the change.
            //  2. REMINDER — any still-frozen plan whose `freezeEndISO`
            //     is within 3 days (Q2) AND hasn't been reminded today
            //     enqueues a customer notification. `freezeReminderSentAtISO`
            //     is stamped to today so a second hydrate the same
            //     session doesn't re-fire. Cleared on unfreeze so a
            //     future freeze can re-arm.
            const todayISO = new Date().toISOString().slice(0, 10);
            const REMINDER_DAYS = 3;
            const resumedPlans: { plan: CustomerPlan; customer: Customer | undefined }[] = [];
            const reminderPlans: { plan: CustomerPlan; customer: Customer | undefined }[] = [];
            state.customerPlans = state.customerPlans.map((p) => {
                if (p.status !== "frozen" || !p.freezeEndISO) return p;
                const endDay = p.freezeEndISO.slice(0, 10);
                // Auto-resume — end date reached.
                if (endDay <= todayISO) {
                    const c = state.customers.find(x => x.id === p.customerId);
                    resumedPlans.push({ plan: p, customer: c });
                    return {
                        ...p,
                        status: "active" as const,
                        freezeStartISO: undefined,
                        freezeEndISO: undefined,
                        freezeReason: undefined,
                        freezeReminderSentAtISO: undefined,
                    };
                }
                // Reminder window — within N days of end date.
                const daysLeft = Math.round(
                    (Date.parse(`${endDay}T00:00:00Z`) - Date.parse(`${todayISO}T00:00:00Z`)) / 86_400_000,
                );
                if (
                    daysLeft > 0 &&
                    daysLeft <= REMINDER_DAYS &&
                    p.freezeReminderSentAtISO !== todayISO
                ) {
                    const c = state.customers.find(x => x.id === p.customerId);
                    reminderPlans.push({ plan: p, customer: c });
                    return { ...p, freezeReminderSentAtISO: todayISO };
                }
                return p;
            });
            // Deferred: the waitlist sweep calls set(), which must not run while
            // the store is still rehydrating. One tick later it applies Booking
            // Rules to any class already sitting with a free spot + a queue —
            // so admin and customer open on the same reconciled state. Freeze
            // notifications fire here too so `emitNotifications` sees a
            // fully rehydrated store.
            setTimeout(() => {
                try {
                    // Counts first (source of truth = booking rows), then spots.
                    useAppStore.getState().reconcileBookedCounts();
                    useAppStore.getState().reconcileBookingSpots();
                    useAppStore.getState().expireWaitlistClaims();
                    useAppStore.getState().reconcileWaitlistOffers();
                    // Freeze policy v2 Phase 4 — notification fan-out for
                    // the two sweeps above. Kept out of the sync path so
                    // the render pass finishes before the bell blinks.
                    for (const { plan, customer } of resumedPlans) {
                        if (!customer) continue;
                        customerNotificationSink.emit?.({
                            customerId: customer.id,
                            event: "membership_reactivated",
                            title: "Membership resumed",
                            message: `Your ${plan.name} is active again. Welcome back!`,
                            relatedType: "customer_plan",
                            relatedId: plan.id,
                        });
                        const customerName = capitalizeName(`${customer.firstName} ${customer.lastName}`);
                        useAppStore.getState().emitNotifications({
                            admin: {
                                tab: "booking",
                                event: "membership_reactivated",
                                title: "Membership resumed",
                                body: `${customerName}'s ${plan.name} auto-resumed.`,
                                icon: "refresh",
                                sourceModule: "booking",
                                sourceId: plan.id,
                                customerId: customer.id,
                                branchId: customer.branchId,
                            },
                        });
                    }
                    for (const { plan, customer } of reminderPlans) {
                        if (!customer || !plan.freezeEndISO) continue;
                        customerNotificationSink.emit?.({
                            customerId: customer.id,
                            event: "freeze_reminder",
                            title: "Freeze ending soon",
                            message: `Your ${plan.name} resumes on ${freezeDayLabel(plan.freezeEndISO)}. Bookings will be available again.`,
                            relatedType: "customer_plan",
                            relatedId: plan.id,
                        });
                    }
                } catch {
                    /* store not ready (SSR / teardown) — the layout guard retries */
                }
            }, 0);
        },
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
                aiScratchCoverImage: _aiScratchCoverImage,
                // bulkSelectionActive is UI-only ephemeral state driven by
                // the currently mounted list page. Persisting it would
                // cause a stale "true" to survive across reloads and
                // hide the AI button forever until the next page mount
                // reset it.
                bulkSelectionActive: _bulkSelectionActive,
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
