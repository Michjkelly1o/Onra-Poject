// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Permission templates (Figma 6618-158416 through 158420)
// ─────────────────────────────────────────────────────────────────────────────
//
// Holds two things:
//   1. PERMISSION_SECTIONS — the canonical ordered list of (section × module)
//      rows the matrix UI renders. Authored once here so the Add-role wizard,
//      Edit-permissions page, and role-detail "Permissions" tab all show the
//      same row order with the same labels.
//
//   2. DEFAULT_PERMISSIONS_BY_TYPE — the 5 default CRUD matrices per role
//      type (Owner / Branch admin / Operator / Front desk / Instructor),
//      mirroring the Figma references exactly. These are copied onto a role
//      instance at creation time so future edits don't retroactively change
//      other rows.
//
// NB: The Instructor role uses a DIFFERENT module set (own dashboard / own
// schedule / earnings / notification / profile), so a separate section list
// applies. The matrix UI picks the right section list off `role.type`.

import type {
    PermissionsMapSeed, PermissionRowSeed, RoleTypeSeed,
} from "./_types";

// ─── Cell builders ─────────────────────────────────────────────────────────

const ALL  = (): PermissionRowSeed => ({ create: true,  edit: true,  delete: true,  view: true });
const NONE = (): PermissionRowSeed => ({ create: false, edit: false, delete: false, view: false });
/** View-only row — everything else is N/A (used for Dashboard rows). */
const VIEW_NA = (canEdit: boolean): PermissionRowSeed => ({ create: "na", edit: canEdit, delete: "na", view: true });
/** View-only row — read-only data (Reports, Payroll reports, etc.). */
const VIEW_ONLY = (): PermissionRowSeed => ({ create: false, edit: false, delete: false, view: true });
/** Custom — fully N/A row except specific cells. */
const cell = (c: PermissionRowSeed): PermissionRowSeed => c;

// ─── Section & module ordering (4 staff roles share this list) ─────────────

export interface PermissionModuleSpec {
    key: string;
    label: string;
}
export interface PermissionSectionSpec {
    key: string;
    label: string;
    modules: PermissionModuleSpec[];
}

/** Section + module order for Owner / Branch admin / Operator / Front desk.
 *  Matches Figma 158420 / 158419 / 158418 / 158417 exactly. */
export const STAFF_PERMISSION_SECTIONS: PermissionSectionSpec[] = [
    { key: "dashboard", label: "Dashboard", modules: [
        { key: "dashboard_business", label: "Dashboard (Business)" },
        { key: "dashboard_branch",   label: "Dashboard (Branch)"   },
    ] },
    { key: "classes", label: "Classes", modules: [
        { key: "class_template",        label: "Class template" },
        { key: "schedule",              label: "Schedule" },
        { key: "cancel_class_schedule", label: "Cancel class schedule" },
        { key: "substitute_instructor", label: "Substitute instructor" },
        { key: "rating_reviews",        label: "Rating & reviews" },
    ] },
    { key: "bookings_attendance", label: "Bookings & Attendance", modules: [
        { key: "bookings",                  label: "Bookings" },
        { key: "mark_attendance",           label: "Mark attendance" },
        { key: "waitlist_management",       label: "Waitlist management" },
        { key: "no_show_late_cancel_fees",  label: "No-show & late cancel fees" },
    ] },
    { key: "pos", label: "POS", modules: [
        { key: "sales_transaction",  label: "Sales transaction" },
        { key: "promo_codes",        label: "Promo codes" },
        { key: "custom_discount",    label: "Custom discount" },
        { key: "gift_cards_issue",   label: "Gift cards – issue" },
    ] },
    { key: "service_products", label: "Service & products", modules: [
        { key: "membership_package", label: "Membership & package" },
        { key: "gift_cards",         label: "Gift cards" },
        { key: "promo",              label: "Promo" },
    ] },
    { key: "marketing", label: "Marketing", modules: [
        { key: "marketing", label: "Marketing" },
    ] },
    { key: "customers", label: "Customers", modules: [
        { key: "customer_profiles",       label: "Customer profiles" },
        { key: "payment_history",         label: "Payment history" },
        { key: "refunds",                 label: "Refunds" },
        { key: "freeze_unfreeze_package", label: "Freeze/unfreeze package" },
        { key: "cancel_membership",       label: "Cancel Membership/package" },
    ] },
    { key: "reports", label: "Reports", modules: [
        { key: "financial_reports",            label: "Financial reports" },
        { key: "membership_package_reports",   label: "Membership & package reports" },
        { key: "activity_reports",             label: "Activity reports" },
        { key: "customer_reports",             label: "Customer reports" },
        { key: "frozen_package_reports",       label: "Frozen package reports" },
    ] },
    { key: "staff", label: "Staff", modules: [
        { key: "staff",             label: "Staff" },
        { key: "staff_permissions", label: "Staff permissions" },
        { key: "pay_rates_payroll", label: "Pay rates & payroll" },
        { key: "payroll_reports",   label: "Payroll reports" },
    ] },
    { key: "settings", label: "Settings", modules: [
        { key: "business_settings",    label: "Business settings" },
        { key: "locations_rooms",      label: "Locations & rooms" },
        { key: "branding_settings",    label: "Branding settings" },
        { key: "booking_rules_policy", label: "Booking rules & policy" },
        { key: "payment_methods",      label: "Payment methods" },
        { key: "integrations",         label: "Integrations" },
        { key: "agreements",           label: "Agreements" },
        { key: "tax_settings",         label: "Tax settings" },
        { key: "referral_settings",    label: "Referral settings" },
    ] },
];

/** Instructor uses a completely different module set (Figma 158416). */
export const INSTRUCTOR_PERMISSION_SECTIONS: PermissionSectionSpec[] = [
    { key: "dashboard", label: "Dashboard", modules: [
        { key: "dashboard_instructor", label: "Dashboard (Instructor)" },
    ] },
    { key: "schedule", label: "Schedule", modules: [
        { key: "schedule",            label: "Schedule" },
        { key: "mark_attendance",     label: "Mark attendance" },
        { key: "waitlist_management", label: "Waitlist management" },
        { key: "rating_reviews",      label: "Rating & reviews" },
    ] },
    { key: "earnings", label: "Earnings", modules: [
        { key: "earnings_information", label: "Earnings information" },
    ] },
    { key: "notification", label: "Notification", modules: [
        { key: "notification_information", label: "Notification information" },
    ] },
    { key: "profile", label: "Profile", modules: [
        { key: "profile_information",  label: "Profile information" },
        { key: "password",             label: "Password" },
        { key: "integrations",         label: "Integrations" },
        { key: "notification_settings", label: "Notification settings" },
    ] },
];

/** Pick the right section list given a role type. */
export function permissionSectionsFor(type: RoleTypeSeed): PermissionSectionSpec[] {
    return type === "instructor" ? INSTRUCTOR_PERMISSION_SECTIONS : STAFF_PERMISSION_SECTIONS;
}

// ─── 5 default permission matrices (mirrors Figma 158416-158420) ──────────

/** OWNER — Figma 158420. Everything granted. Dashboard/Reports/Payroll
 *  reports are read-only (no create/edit/delete on derived data). */
const PERM_OWNER: PermissionsMapSeed = {
    dashboard: {
        dashboard_business: VIEW_NA(true),
        dashboard_branch:   VIEW_NA(true),
    },
    classes: {
        class_template:        ALL(),
        schedule:              ALL(),
        cancel_class_schedule: cell({ create: true, edit: "na", delete: "na", view: "na" }),
        substitute_instructor: ALL(),
        rating_reviews:        cell({ create: "na", edit: "na", delete: true, view: true }),
    },
    bookings_attendance: {
        bookings:                 ALL(),
        mark_attendance:          ALL(),
        waitlist_management:      ALL(),
        no_show_late_cancel_fees: ALL(),
    },
    pos: {
        sales_transaction: ALL(),
        promo_codes:       ALL(),
        custom_discount:   ALL(),
        gift_cards_issue:  ALL(),
    },
    service_products: {
        membership_package: ALL(),
        gift_cards:         ALL(),
        promo:              ALL(),
    },
    marketing: {
        marketing: ALL(),
    },
    customers: {
        customer_profiles:       ALL(),
        payment_history:         cell({ create: "na", edit: "na", delete: "na", view: true }),
        refunds:                 cell({ create: true,  edit: true,  delete: "na", view: true }),
        freeze_unfreeze_package: ALL(),
        cancel_membership:       ALL(),
    },
    reports: {
        financial_reports:          VIEW_ONLY(),
        membership_package_reports: VIEW_ONLY(),
        activity_reports:           VIEW_ONLY(),
        customer_reports:           VIEW_ONLY(),
        frozen_package_reports:     VIEW_ONLY(),
    },
    staff: {
        staff:             ALL(),
        staff_permissions: ALL(),
        pay_rates_payroll: ALL(),
        payroll_reports:   VIEW_ONLY(),
    },
    settings: {
        business_settings:    ALL(),
        locations_rooms:      ALL(),
        branding_settings:    ALL(),
        booking_rules_policy: ALL(),
        payment_methods:      ALL(),
        integrations:         ALL(),
        agreements:           ALL(),
        tax_settings:         ALL(),
        referral_settings:    ALL(),
    },
};

/** BRANCH ADMIN — Figma 158419. Loses business-level dashboard,
 *  pay-rates/payroll, and most settings (just Booking rules). */
const PERM_BRANCH_ADMIN: PermissionsMapSeed = {
    dashboard: {
        dashboard_business: VIEW_NA(false), // Edit unchecked
        dashboard_branch:   VIEW_NA(true),
    },
    classes: PERM_OWNER.classes,
    bookings_attendance: PERM_OWNER.bookings_attendance,
    pos: PERM_OWNER.pos,
    service_products: PERM_OWNER.service_products,
    marketing: PERM_OWNER.marketing,
    customers: PERM_OWNER.customers,
    reports: PERM_OWNER.reports,
    staff: {
        staff:             ALL(),
        staff_permissions: NONE(),
        pay_rates_payroll: NONE(),
        payroll_reports:   VIEW_ONLY(),
    },
    settings: {
        business_settings:    NONE(),
        locations_rooms:      NONE(),
        branding_settings:    NONE(),
        booking_rules_policy: ALL(),
        payment_methods:      NONE(),
        integrations:         NONE(),
        agreements:           NONE(),
        tax_settings:         NONE(),
        referral_settings:    NONE(),
    },
};

/** OPERATOR — Figma 158418. Daily ops focus. */
const PERM_OPERATOR: PermissionsMapSeed = {
    dashboard: {
        dashboard_business: VIEW_NA(false),
        dashboard_branch:   VIEW_NA(true),
    },
    classes: {
        class_template:        ALL(),
        schedule:              ALL(),
        cancel_class_schedule: cell({ create: true,  edit: "na", delete: "na", view: "na" }),
        substitute_instructor: ALL(),
        rating_reviews:        cell({ create: "na", edit: "na", delete: false, view: true }),
    },
    bookings_attendance: PERM_OWNER.bookings_attendance,
    pos: PERM_OWNER.pos,
    service_products: PERM_OWNER.service_products,
    marketing: PERM_OWNER.marketing,
    customers: {
        customer_profiles:       ALL(),
        payment_history:         cell({ create: "na", edit: "na", delete: "na", view: true }),
        refunds:                 cell({ create: true,  edit: true,  delete: "na", view: true }),
        freeze_unfreeze_package: NONE(),
        cancel_membership:       NONE(),
    },
    reports: {
        financial_reports:          NONE(),
        membership_package_reports: NONE(),
        activity_reports:           VIEW_ONLY(),
        customer_reports:           NONE(),
        frozen_package_reports:     NONE(),
    },
    staff: {
        staff:             NONE(),
        staff_permissions: NONE(),
        pay_rates_payroll: NONE(),
        payroll_reports:   NONE(),
    },
    settings: {
        business_settings:    NONE(),
        locations_rooms:      NONE(),
        branding_settings:    NONE(),
        booking_rules_policy: NONE(),
        payment_methods:      NONE(),
        integrations:         NONE(),
        agreements:           NONE(),
        tax_settings:         NONE(),
        referral_settings:    NONE(),
    },
};

/** FRONT DESK — Figma 158417. Customer-facing only. */
const PERM_FRONT_DESK: PermissionsMapSeed = {
    dashboard: {
        dashboard_business: cell({ create: "na", edit: false, delete: "na", view: false }),
        dashboard_branch:   VIEW_NA(true),
    },
    classes: {
        class_template:        NONE(),
        schedule:              cell({ create: false, edit: false, delete: false, view: true }),
        cancel_class_schedule: cell({ create: false, edit: "na", delete: "na", view: "na" }),
        substitute_instructor: NONE(),
        rating_reviews:        cell({ create: "na", edit: "na", delete: false, view: true }),
    },
    bookings_attendance: PERM_OWNER.bookings_attendance,
    pos: {
        sales_transaction: ALL(),
        promo_codes:       ALL(),
        custom_discount:   NONE(),
        gift_cards_issue:  ALL(),
    },
    service_products: {
        membership_package: NONE(),
        gift_cards:         NONE(),
        promo:              NONE(),
    },
    marketing: { marketing: NONE() },
    customers: {
        customer_profiles:       ALL(),
        payment_history:         cell({ create: "na", edit: "na", delete: "na", view: true }),
        refunds:                 NONE(),
        freeze_unfreeze_package: NONE(),
        cancel_membership:       NONE(),
    },
    reports: {
        financial_reports:          NONE(),
        membership_package_reports: NONE(),
        activity_reports:           NONE(),
        customer_reports:           NONE(),
        frozen_package_reports:     NONE(),
    },
    staff: {
        staff:             NONE(),
        staff_permissions: NONE(),
        pay_rates_payroll: NONE(),
        payroll_reports:   NONE(),
    },
    settings: {
        business_settings:    NONE(),
        locations_rooms:      NONE(),
        branding_settings:    NONE(),
        booking_rules_policy: NONE(),
        payment_methods:      NONE(),
        integrations:         NONE(),
        agreements:           NONE(),
        tax_settings:         NONE(),
        referral_settings:    NONE(),
    },
};

/** INSTRUCTOR — Figma 158416. DIFFERENT module set entirely. */
const PERM_INSTRUCTOR: PermissionsMapSeed = {
    dashboard: {
        dashboard_instructor: cell({ create: "na", edit: "na", delete: "na", view: true }),
    },
    schedule: {
        schedule:            cell({ create: "na", edit: "na", delete: "na", view: true }),
        mark_attendance:     ALL(),
        waitlist_management: cell({ create: "na", edit: "na", delete: "na", view: true }),
        rating_reviews:      cell({ create: "na", edit: "na", delete: "na", view: true }),
    },
    earnings: {
        earnings_information: cell({ create: "na", edit: "na", delete: "na", view: true }),
    },
    notification: {
        notification_information: cell({ create: "na", edit: "na", delete: "na", view: true }),
    },
    profile: {
        profile_information:    cell({ create: "na", edit: true, delete: "na", view: true }),
        password:               cell({ create: "na", edit: true, delete: "na", view: true }),
        integrations:           cell({ create: "na", edit: true, delete: "na", view: true }),
        notification_settings:  cell({ create: "na", edit: true, delete: "na", view: true }),
    },
};

export const DEFAULT_PERMISSIONS_BY_TYPE: Record<RoleTypeSeed, PermissionsMapSeed> = {
    owner:        PERM_OWNER,
    branch_admin: PERM_BRANCH_ADMIN,
    operator:     PERM_OPERATOR,
    front_desk:   PERM_FRONT_DESK,
    instructor:   PERM_INSTRUCTOR,
};
