// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Mock data interfaces (per future Supabase table)
// ─────────────────────────────────────────────────────────────────────────────
//
// One interface per table. Field names are snake_case to match the planned
// Supabase columns, so each seed file converts to an INSERT statement 1-to-1.
//
// Interfaces stay LEAN — they cover only what currently-built screens read.
// Columns marked `+later: …` are placeholders for when the relevant full
// module ships (e.g. Module 07 Customer Management, Module 05 POS proper).
//
// Source of truth — never duplicate these elsewhere. New tables for new
// modules get added here when the module is built.
//
// See MOCK_DATA_PLAN.md for the full spec.

// ─── Auth & Roles ────────────────────────────────────────────────────────────

/** Demo user role definitions (mapped 1-1 to CLAUDE.md "Roles & Demo Users"). */
export interface Role {
    /** e.g. "role_owner" */
    id: string;
    name: "Owner" | "Branch Admin" | "Operator" | "Front Desk" | "Instructor";
    description?: string;
}

/** Demo auth user — one per role for the demo switcher. */
export interface User {
    /** e.g. "user_alex_owen" */
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
    // +later: phone, hire_date, last_login_at, is_active
}

/** User ↔ role ↔ branch link. Owner gets branch_id=null (multi-branch scope). */
export interface UserRoleAssignment {
    id: string;
    user_id: string;       // → users.id
    role_id: string;       // → roles.id
    branch_id?: string;    // → branches.id (null for Owner)
}

// ─── Locations (core) ────────────────────────────────────────────────────────

export interface Branch {
    /** e.g. "branch_forma_south" */
    id: string;
    name: string;          // "Forma Studio South"
    status: "active" | "inactive";
    /** Display flag — the "main" branch shows first in selectors. */
    is_main: boolean;
    address?: string;
    // +later: phone, timezone, opening_hours, logo_url
}

export interface Room {
    /** e.g. "room_forma_south_reformer" */
    id: string;
    branch_id: string;     // → branches.id
    name: string;          // "Reformer Studio"
    capacity: number;
    status: "active" | "inactive";
}

// ─── Staff ──────────────────────────────────────────────────────────────────

/** Instructor / staff profile. For now we only seed instructors. */
export interface StaffProfile {
    /** e.g. "staff_maya_johnson" */
    id: string;
    /** Optional link to a demo `users.id` (e.g. River Teach has both). */
    user_id?: string;
    branch_id: string;     // → branches.id (primary branch)
    full_name: string;
    initials: string;      // "MJ" — used for avatar fallback
    color_hex: string;     // avatar fallback color when no image
    image_url?: string;    // /images/instructors/*.webp
    role: "instructor";    // staff sub-type — extends when Front Desk staff are seeded
    status: "active" | "inactive";
    // +later: hire_date, pay_rate_ids, certifications
}

// ─── Customers ──────────────────────────────────────────────────────────────

/**
 * Customer record — lean schema for the current prototype. Will grow when
 * Module 07 (Customer Management) ships with DOB, address, emergency contact,
 * notes, churn risk, etc.
 *
 * `plan_kind` + `plan_name` are denormalized copies of the customer's CURRENT
 * plan for fast UI rendering. The authoritative source becomes the joins
 * `customer_memberships` + `customer_packages` when Module 07 lands.
 */
export interface Customer {
    /** e.g. "cust_ahmed_zayn" */
    id: string;
    first_name: string;
    last_name: string;
    initials: string;      // "AZ"
    email: string;
    phone?: string;
    branch_id: string;     // → branches.id (home branch)
    image_url?: string;    // /images/customers/*.webp
    /** Current plan kind — `null` means no active plan. */
    plan_kind: "membership" | "package" | null;
    /** Membership plan id (when plan_kind="membership"). FK → memberships.id. */
    membership_id?: string;
    /** Package plan ids (when plan_kind="package"). FK → packages.id[]. A
     *  customer may hold MULTIPLE credit packages at once (each contributes
     *  its remaining credits to the same pool). */
    package_ids?: string[];
    /** Legacy denormalized name — used by older renderers + the
     *  class-types "Applicable plans" tab to count active members. */
    plan_name?: string;
    created_at: string;    // ISO 8601
    // +later (Module 07): date_of_birth, gender, address, emergency_contact,
    //                     emergency_contact_phone, notes, status, deleted_at,
    //                     churn_risk_score, customer_memberships[],
    //                     customer_packages[] with per-row credit balances
}

// ─── Products: Memberships & Packages ───────────────────────────────────────

/** Membership product offered for sale in POS. */
export interface Membership {
    /** e.g. "mem_beginner_monthly" */
    id: string;
    name: string;          // "Beginner Monthly Membership"
    description?: string;
    /** Number of class credits per billing cycle, or "unlimited". */
    credits: number | "unlimited";
    duration_months: number;
    price_aed: number;
    status: "active" | "inactive" | "archived";
    // +later: branch_id, category_id (which categories it covers),
    //         auto_renew_default, deleted_at
}

/** Credit-package product offered for sale in POS. */
export interface Package {
    /** e.g. "pkg_10_class" */
    id: string;
    name: string;          // "10-Class Package for One Month"
    description?: string;
    credits: number;       // 1 | 5 | 10 | 20
    validity_days: number; // 7 | 30
    price_aed: number;
    status: "active" | "inactive" | "archived";
    // +later: branch_id, category_id, deleted_at
}

// ─── Payments ───────────────────────────────────────────────────────────────

/**
 * Saved payment method (Card-on-file). For the prototype these are
 * demo-global — when Module 05 (POS) ships properly, this table gains a
 * `customer_id` FK and per-customer card storage.
 */
export interface PaymentMethod {
    /** e.g. "pm_master_1234" */
    id: string;
    brand: "Master Card" | "Visa" | "Amex";
    last4: string;         // "1234"
    exp_month: number;     // 1-12
    exp_year: number;      // e.g. 2027
    // +later: customer_id, holder_name, is_default
}

// ─── Class taxonomy ─────────────────────────────────────────────────────────

/**
 * Class category — drives the per-category color used on schedule tiles
 * (day/week/month view), badges, and filter chips. Color is resolved from
 * `tokens.json` and stored here as a hex so renderers don't need the token
 * system at render time.
 */
export interface ClassCategory {
    /** e.g. "cat_pilates" */
    id: string;
    name: string;          // "Pilates"
    /** Resolved hex from tokens.json (Brand primary/secondary/tertiary or Teal). */
    color_hex: string;
    status: "active" | "inactive";
    // +later: branch_id (if categories become per-branch)
}

/**
 * Class template — the reusable "blueprint" for scheduled classes. Each
 * template is FK'd to exactly one category. The list of applicable
 * memberships/packages drives the "Applicable" tabs on the template detail.
 */
export interface ClassTemplate {
    /** e.g. "tpl_reformer_pilates" */
    id: string;
    category_id: string;   // → class_categories.id
    name: string;          // "Reformer Pilates"
    description: string;
    location_type: "Group" | "Private" | "Semi-private";
    duration_min: number;
    capacity: number;
    cover_image_url?: string; // /images/class-template/*.webp
    status: "Active" | "Inactive" | "Archived";
    /** Memberships that grant access to classes from this template. */
    applicable_membership_ids: string[]; // → memberships.id[]
    /** Packages that grant access to classes from this template. */
    applicable_package_ids: string[];    // → packages.id[]
}

// ─── Schedule (renamed from `class_instances`) ──────────────────────────────

/**
 * Class schedule row — one concrete scheduled occurrence of a template.
 * Renamed from `class_instances` for clarity (matches the "Class Schedule"
 * module name).
 *
 * `booked`, `rating`, `rating_count` are denormalized aggregates kept on the
 * row for fast list-view rendering. They're authoritative-derivable from
 * `class_bookings` + `class_ratings`, but recomputing every render is wasteful.
 */
export interface ClassSchedule {
    /** e.g. "class_sched_2026_05_15_0930" */
    id: string;
    template_id: string;   // → class_templates.id
    branch_id: string;     // → branches.id
    room_id: string;       // → rooms.id
    instructor_id: string; // → staff_profiles.id
    /** "2026-05-15" — used for sorting and date filtering. */
    date_iso: string;
    /** "09:30" — 24h. */
    start_time: string;
    /** "10:30" — 24h. */
    end_time: string;
    /** "09:30 - 10:30 AM" — human-friendly for UI. */
    display_time: string;
    /** Capacity at the time of scheduling (may override template default). */
    capacity: number;
    /** Cached count of class_bookings where status="booked". */
    booked: number;
    /** Average rating across non-deleted ratings. */
    rating: number;
    /** Count of non-deleted ratings. */
    rating_count: number;
    status: "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
    cancelled_at?: string;
    cancelled_by?: string;
    // +later: recurrence_group_id, substitute_instructor_id, cancelled_reason,
    //         equipment, spot_selection_enabled, waitlist_enabled
}

// ─── Bookings & ratings (ID-only refs — no name copies) ─────────────────────

/**
 * Booking record. Customer / class details are looked up at render time via
 * the customer store — NO name/initials/color copies live on this row.
 */
export interface ClassBooking {
    id: string;
    class_schedule_id: string; // → class_schedule.id
    customer_id: string;       // → customers.id
    branch_id: string;         // → branches.id (denormalized for fast branch filtering)
    status: "booked" | "waitlisted" | "cancelled";
    attendance_status: "pending" | "present" | "no_show" | "late_cancel";
    booked_at: string;         // ISO 8601
    /** 1-based queue position, only set when status="waitlisted". */
    waitlist_position?: number;
    cancelled_at?: string;
    cancellation_reason?: string;
    refund_credit_issued?: boolean;
    /** Which plan kind paid for this booking (for credit-balance accounting). */
    plan_kind_used?: "membership" | "package";
    /** FK to memberships.id or packages.id depending on `plan_kind_used`. */
    plan_id_used?: string;
}

/** Class rating (one per booked customer per class). */
export interface ClassRating {
    id: string;
    class_schedule_id: string; // → class_schedule.id
    customer_id: string;       // → customers.id
    instructor_id: string;     // → staff_profiles.id
    /** 1-5 inclusive. */
    score: number;
    comment: string;
    /** Optional "What stood out" tags ("Instructor", "Pacing", "Atmosphere", "Difficulty"). */
    tags?: string[];
    submitted_at: string;      // ISO 8601
    /** Soft-delete fields — set when an admin moderates the review. */
    deleted_at?: string;
    deleted_by?: string;
}
