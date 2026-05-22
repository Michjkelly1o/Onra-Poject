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

/**
 * Open hours for a single (branch × day-of-week). Drives:
 *   • Schedule form Start/End time dropdowns (only times within the branch's
 *     hours for the chosen date are selectable).
 *   • Day & week schedule grids (the time axis spans the union of open hours
 *     for the visible branch).
 *
 * `day_of_week` uses JS Date.getUTCDay() conventions: 0=Sun..6=Sat.
 *
 * When the Settings module ships Module 11 will write here; for now the
 * seed sets a realistic daily range per branch.
 */
export interface BusinessHours {
    /** e.g. "bh_forma_south_mon" */
    id: string;
    branch_id: string;     // → branches.id
    /** 0=Sun, 1=Mon, … 6=Sat */
    day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    /** "07:00" — 24h. Ignored when is_closed=true. */
    open_time: string;
    /** "22:00" — 24h. Ignored when is_closed=true. */
    close_time: string;
    /** Branch is fully closed that weekday — open/close are placeholders. */
    is_closed: boolean;
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
    /** Customer gender — drives gender-restricted class booking eligibility. */
    gender?: "Male" | "Female";
    /** Class credits left on the customer's current plan. Omitted for
     *  unlimited memberships (no credit cap) and no-plan customers. `0` means
     *  the plan is exhausted — a new plan purchase is required to book. */
    credits_remaining?: number;
    // +later (Module 07): date_of_birth, address, emergency_contact,
    //                     emergency_contact_phone, notes, status, deleted_at,
    //                     churn_risk_score, customer_memberships[],
    //                     customer_packages[] with per-row credit balances
}

// ─── Products: Memberships & Packages ───────────────────────────────────────

/** Time unit used by the duration step + several purchase-rule fields. */
export type DurationUnit = "day" | "month" | "year";

/** Three-letter weekday labels, matching the Day-of-week pills in the create
 *  flow's purchase-rules step. */
export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

/**
 * Persisted shape of the purchase-rule configuration captured in Step 5 of
 * the create / edit flow. Identical to the form-state shape so the create
 * flow can write it as-is and the edit flow can seed initial state from it
 * without translation.
 *
 * Each subsection carries its own `on` master toggle. Within a section,
 * each rule carries its own `on` flag that gates whether the inner fields
 * apply. `purchaseLimit` is credit-package-only — memberships ignore it.
 */
export interface PurchaseRulesData {
    timeBound: {
        on: boolean;
        purchaseWindow:  { on: boolean; from: string; to: string };
        dayOfWeek:       { on: boolean; days: Weekday[] };
        activationDelay: { on: boolean; days: string };
    };
    eligibility: {
        on: boolean;
        newCustomers: {
            on: boolean;
            neverPurchased: boolean;
            recentSignup: boolean;
            daysAgo: string;
            daysUnit: DurationUnit;
        };
        existingCustomers: { on: boolean; minPackages: string };
        /** Credit-package-only — gate purchase on holding a specific
         *  membership tier. `membershipId` references `memberships.id`. */
        specificMembershipTier: { on: boolean; membershipId: string };
        locationRegion:    { on: boolean; region: string };
    };
    usageCap: {
        on: boolean;
        totalRedemptions: { on: boolean; max: string };
        perLocation:      { on: boolean; max: string };
        perDay:           { on: boolean; max: string };
    };
    /** Credit-package-only. Memberships persist it but always render off.
     *
     *  Single-select group: `selectedRule` picks ONE of two sub-rules
     *  ("lifetime" or "rolling") or stays null when the section is
     *  configured but no specific rule is chosen. `rolling.every / unit`
     *  carry the input values for the rolling option. */
    purchaseLimit: {
        on: boolean;
        selectedRule: "lifetime" | "rolling" | null;
        rolling: { every: string; unit: DurationUnit };
    };
}

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
    /** Branches where this product is sellable (POS catalog filter). Empty
     *  array = available at every active branch (legacy fallback). */
    branch_ids: string[];  // → branches.id[]
    status: "active" | "inactive" | "archived";
    // ─ Module 06 extended columns ────────────────────────────────────────
    /** Message included in the customer's confirmation email at purchase. */
    welcome_message?: string;
    /** When true, the membership period only starts the first time the
     *  customer uses it (vs. starts immediately on purchase). */
    active_on_first_use?: boolean;
    /** When true, the membership auto-renews + charges the customer at
     *  the end of its duration. */
    auto_renew?: boolean;
    /** Persisted snapshot of the Step-5 purchase-rule configuration. Read
     *  by the detail page; edited from the edit flow. */
    purchase_rules?: PurchaseRulesData;
    /** Owner-recorded creation date — ISO 8601. Used by the detail page's
     *  "Date created" stat. */
    created_at?: string;
    // +later: category_id, billing_cycle, deleted_at
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
    /** Branches where this product is sellable. Empty = every active branch. */
    branch_ids: string[];  // → branches.id[]
    status: "active" | "inactive" | "archived";
    // ─ Module 06 extended columns ────────────────────────────────────────
    welcome_message?: string;
    /** Flag from the Step-3 intro-offer toggle — a one-time pack only new
     *  customers may purchase. */
    is_intro_offer?: boolean;
    purchase_rules?: PurchaseRulesData;
    created_at?: string;
    // +later: category_id, specific_membership_tier_id, deleted_at
}

/**
 * Gift-card design — the sellable template a buyer picks in POS. When sold
 * it creates an `issued_gift_cards` row carrying the actual code + balance +
 * recipient.
 *
 * Two value modes:
 *   • fixed  → `fixed_value_aed` is the only purchasable amount
 *   • custom → buyer chooses any amount in [min_value_aed, max_value_aed]
 */
export interface GiftCardDesign {
    /** e.g. "gc_design_aed_250" */
    id: string;
    name: string;                                  // "AED 250 Gift Card"
    value_type: "fixed" | "custom";
    /** Required when value_type = "fixed". */
    fixed_value_aed?: number;
    /** Required when value_type = "custom" — purchase range. */
    min_value_aed?: number;
    max_value_aed?: number;
    /** Days from purchase the issued card stays redeemable. Kept for POS
     *  catalog back-compat — the gift-card detail page derives display
     *  copy from `no_expiry` + `valid_until_date` below. */
    validity_days: number;
    status: "active" | "inactive" | "archived";
    // ─ Module 06 extended columns ────────────────────────────────────────
    description?: string;
    /** Purchase price the buyer pays at POS (Step-1 "Gift card price").
     *  Distinct from the loaded value — `fixed_value_aed` / min-max — even
     *  though they're usually equal for a standard card. */
    price_aed?: number;
    /** Free-text confirmation copy emailed to the buyer at purchase. */
    welcome_message?: string;
    /** Unique alphanumeric admin-entered identifier the buyer reads off
     *  the card at POS (e.g. "GC-2025-AB3K9"). Distinct from `id`. */
    gift_card_number?: string;
    /** When true, the gift card never expires — overrides issue/expiry. */
    no_expiry?: boolean;
    /** Absolute ISO issue date when `no_expiry` is false (Step-3 "Issue Date"). */
    issue_date?: string;
    /** Absolute ISO expiration date when `no_expiry` is false (Step-3 "Expiry Date"). */
    valid_until_date?: string;
    /** Owner-recorded creation date — ISO 8601. Drives the detail page's
     *  "Date created" stat. */
    created_at?: string;
    // +later: branch_id, design_image_url, deleted_at
}

/**
 * Issued gift card — a real card sold to a customer (one instance of a
 * `gift_card_designs` template). Created at POS checkout; carries the
 * redeemable balance, unique code, expiry, and recipient details.
 *
 * The gift-card detail "Active customers" tab is built from these rows —
 * `customer_id` joins to `customers` for name / email / phone / avatar, while
 * `current_balance_aed` + `expires_at` populate the "Amount left & expired"
 * column. The list view's "Active customers" count and the delete-vs-
 * deactivate gate also derive from these rows.
 *
 * Financial record — never deleted (per CLAUDE.md archive/delete rules).
 */
export interface IssuedGiftCard {
    /** e.g. "issued_gc_0001" */
    id: string;
    /** FK → gift_card_designs.id — the template this card was sold from. */
    design_id: string;
    /** FK → customers.id — the customer who holds / can redeem this card. */
    customer_id: string;
    /** Unique alphanumeric code the holder reads off the card at POS. */
    code: string;
    /** Original loaded value in AED at the time of sale. */
    face_value_aed: number;
    /** Remaining redeemable balance in AED. Drops as the card is spent;
     *  `0` once fully redeemed. */
    current_balance_aed: number;
    /** ISO 8601 — when the card was sold / issued at POS. */
    issued_at: string;
    /** ISO 8601 — when the card expires and can no longer be redeemed. */
    expires_at: string;
    /** active = redeemable · redeemed = balance spent · expired = past expiry. */
    status: "active" | "redeemed" | "expired";
    // ─ POS gift-card recipient form fields ───────────────────────────────
    /** Recipient name captured in the POS gift-card modal. */
    recipient_name?: string;
    /** Recipient email captured in the POS gift-card modal. */
    recipient_email?: string;
    /** Buyer / sender display name captured at POS. */
    sender_name?: string;
    /** Personal gift message printed on the card. */
    message?: string;
    // +later: branch_id, transaction_id
}

/**
 * Promo code — a sellable discount the buyer types into the POS cart's
 * "Promo code" field. Validation rules cover expiry, usage limit, applicable
 * product types, and minimum purchase. Only one promo per transaction.
 */
export interface PromoCode {
    /** e.g. "promo_welcome20" */
    id: string;
    /** Case-insensitive lookup key the buyer types — stored uppercase. */
    code: string;
    /** Display label for receipts / cart summary ("WELCOME20"). */
    discount_type: "percentage" | "fixed";
    /** Percentage 0–100 or fixed AED amount depending on `discount_type`. */
    discount_value: number;
    /** Optional ceiling on % discounts — caps the AED amount that can come off. */
    max_discount_aed?: number;
    /** Minimum cart subtotal (AED) required for the code to apply. */
    min_purchase_aed?: number;
    /** Which product types the promo applies to. Empty = applies to all. */
    applies_to: ("membership" | "package" | "gift_card")[];
    /** null = unlimited uses; otherwise total uses across all customers. */
    usage_limit?: number;
    /** Cached count of times the code has been redeemed. */
    usage_count: number;
    /** ISO date this code becomes invalid; missing = no expiry. The promo
     *  list view derives an "Expired" badge from this when it's in the past. */
    valid_until?: string;
    status: "active" | "inactive" | "archived";
    // ─ Promo module (PRD 06 §6) display fields ───────────────────────────
    /** Marketing name shown on the promo card + detail + banner ("Weekend Workout Pass"). */
    name?: string;
    /** Admin-facing description shown on the card + detail. */
    description?: string;
    /** What the promo is redeemed against. */
    action?: "book_class" | "buy_package";
    /** Offer flavour shown on the card — broader than the POS `discount_type`. */
    offer_type?: "free_class" | "free_trial" | "percentage" | "fixed_amount";
    /** Branches the promo is available at. Empty = all branches. */
    branch_ids?: string[];
    /** ISO 8601 — when the promo was created. */
    created_at?: string;
    // ─ Promo creation-form fields (PRD 06 §6.3) ──────────────────────────
    /** ISO 8601 start of the promo's validity window. */
    valid_from?: string;
    /** Whether the promo card shows a limited-time countdown. */
    countdown?: boolean;
    /** Restrict the promo to customers who never purchased before. */
    first_time_only?: boolean;
    /** Max redemptions per individual customer. */
    per_customer_limit?: number;
    /** Specific membership/package ids the promo applies to (empty = all). */
    applies_to_product_ids?: string[];
    /** Specific class-template ids the promo applies to (empty = all). */
    applies_to_class_ids?: string[];
    /** Who can redeem — everyone vs. brand-new customers. */
    customer_targeting?: "all" | "new_users";
    /** Uploaded banner image (object URL in the prototype). */
    banner_image_url?: string;
    /** Whether the promo is usable across multiple branches (vs. a single one). */
    multi_location?: boolean;
    // +later: target_segment
}

// ─── Marketing ──────────────────────────────────────────────────────────────

/**
 * Marketing item — admin-authored content published to the customer-facing
 * feed (PRD 08). Structurally a sibling of `PromoCode`: a banner card with a
 * type, a configurable CTA, branch + audience targeting and a validity window.
 *
 * Status model follows the Promo module — stored `active | inactive |
 * archived`; an "expired" state is DERIVED at render time from `expiry_date`.
 */
export interface MarketingItem {
    /** e.g. "mkt_aerial_yoga" */
    id: string;
    /** Member-facing headline / display name ("New: Aerial Yoga"). */
    title: string;
    /** Visual template — also gates which CTA options the form offers. */
    type: "new_class" | "announcement" | "event";
    /** 1-3 sentence card copy. */
    short_description: string;
    /** Card hero image. Missing → gradient banner fallback. */
    cover_image_url?: string;
    /** The CTA a member can take from the card. Options depend on `type`:
     *  new_class → book_event · announcement → external_link / no_action ·
     *  event → book_event / buy_ticket / external_link. */
    action_type: "book_event" | "buy_ticket" | "external_link" | "no_action";
    /** buy_ticket → ticket price in AED. */
    ticket_price?: number;
    /** external_link → destination URL. */
    external_url?: string;
    /** ISO 8601 — when the item goes live (publish date + time). */
    publish_date: string;
    /** ISO 8601 — when the item stops showing (expiry date + time). Missing →
     *  no expiry. The list view derives an "Expired" badge from this. */
    expiry_date?: string;
    /** Whether the card shows a limited-time countdown timer. */
    countdown?: boolean;
    /** Branches the item is shown at. Empty = all branches. */
    branch_ids: string[];
    /** Whether the item targets multiple branches (promo-style toggle). */
    multi_location?: boolean;
    /** "Applies to" — membership / package ids the item is shown to holders of. */
    target_package_ids?: string[];
    /** "Applies to" — class-template ids the item is shown to enrollees of. */
    target_class_ids?: string[];
    /** Who sees the item — everyone vs. brand-new members. */
    customer_targeting?: "all" | "new_users";
    status: "active" | "inactive" | "archived";
    /** Seeded analytics — unique member views. */
    view_count: number;
    /** Seeded analytics — CTA taps. */
    click_count: number;
    /** Seeded analytics — bookings / purchases completed via the CTA. */
    conversion_count: number;
    /** ISO 8601 — when the item was created. */
    created_at: string;
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
    /** Gender restriction on who may book — defaults to "all" when unset. */
    gender_access?: "all" | "female" | "male";
    /** Class delivery format — defaults to "Group" when unset. */
    class_type?: "Group" | "Private" | "Semi-private";
    /** Equipment note captured on the schedule form. */
    equipment?: string;
    /** Whether per-spot selection is enabled for this class. */
    spot_selection_enabled?: boolean;
    /** Spot-grid layout — only set when `spot_selection_enabled` is true. */
    spot_layout?: { cols: number; rows: number; blocked_spots: string[] };
    /** Whether the waitlist is open once the class fills — defaults true. */
    waitlist_enabled?: boolean;
    /** Shared id linking every instance generated from one recurring config. */
    recurrence_group_id?: string;
    // +later: substitute_instructor_id, cancelled_reason
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
