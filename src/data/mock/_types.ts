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
    status: "active" | "inactive" | "archive";
    /** Display flag — the "main" branch shows first in selectors. */
    is_main: boolean;
    address?: string;
    // +later: phone, timezone, opening_hours, logo_url
    /** Optional branch-level contact info — populated by the Branch form. */
    phone?: string;
    email?: string;
    city?: string;
    country?: string;
    image_url?: string;
}

export interface Room {
    /** e.g. "room_forma_south_reformer" */
    id: string;
    branch_id: string;     // → branches.id
    name: string;          // "Reformer Studio"
    capacity: number;
    status: "active" | "inactive" | "archive";
    /** Optional room metadata populated by the Room form. */
    equipment_notes?: string;
    columns?: number;
    rows?: number;
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
    /** Optional "block time" window inside the open/close range — e.g. a
     *  lunch break. When set, the schedule day/week grid renders a
     *  diagonal-striped strip over this window and the schedule form's
     *  time picker excludes slots whose [start, start+duration) interval
     *  would overlap it. Only one block slot per day is supported by
     *  design. Block fields are ignored when `is_closed` is true. */
    block_start?: string;
    block_end?: string;
}

// ─── Booking Rules — Classes settings (PRD 11 §6) ──────────────────────────

/** Global classes-settings record. Single row per studio — the Customize
 *  classes settings 3-step page (Booking window / SMS cutoff window /
 *  Overbooking) reads from + writes to this same row. Landing-page summary
 *  cards (`/admin/settings/booking-rules`, the Classes container) read the
 *  display values directly. Connections per the brief:
 *    • bookings_open / bookings_close → schedule form (advance booking
 *      window enforcement) + member booking flow
 *    • waitlist_* → booking cancel flow (auto-promotion behaviour) +
 *      waitlist tab on class detail
 *    • refund_class_session → booking cancel flow (credit refund timing)
 *    • sms_cutoff_* → notification dispatch (Module 12)
 *    • overbooking_* + auto_cancel_* → schedule capacity enforcement
 *  Phase 4 wires every consumer; Phase 1 only persists the values. */
export interface ClassesSettings {
    id: string;                                   // "classes_settings_default"
    // ── Step 1 — Booking window ────────────────────────────────────────────
    booking_open_value: number;                   // 7
    booking_open_unit: "days" | "hours" | "minutes";        // "days"
    booking_close_value: number;                  // 1
    booking_close_unit: "hours" | "minutes";      // "minutes"
    // ── Step 1 — Auto-submit attendance ────────────────────────────────────
    auto_submit_attendance_value: number;         // 2
    auto_submit_attendance_unit: "hours" | "minutes";       // "hours"
    // ── Step 1 — Waitlist ──────────────────────────────────────────────────
    waitlist_enabled: boolean;                    // true
    waitlist_mode: "inform_everyone" | "auto_book_first";   // "inform_everyone"
    /** Only respected when waitlist_mode === "auto_book_first" — the input
     *  is shown disabled in the other mode (Figma 7228:47890). */
    notify_waitlist_value: number;                // 2
    notify_waitlist_unit: "hours" | "minutes";    // "hours"
    max_waiting_spots: number;                    // 10
    refund_class_session: "immediately" | "after_class_ends" | "next_business_day"; // "immediately"
    // ── Step 2 — SMS cutoff window ─────────────────────────────────────────
    sms_cutoff_enabled: boolean;                  // true
    sms_cutoff_value: number;                     // 2
    sms_cutoff_unit: "hours" | "minutes";         // "hours"
    sms_cutoff_note: string;                      // customer-facing copy
    // ── Step 3 — Overbooking ───────────────────────────────────────────────
    overbooking_enabled: boolean;                 // true
    overbooking_mode: "fixed" | "percentage";     // "fixed"
    overbooking_fixed_value: number;              // 10
    overbooking_percentage_value: number;         // 0
    auto_cancel_enabled: boolean;                 // true
    auto_cancel_value: number;                    // 2
    auto_cancel_unit: "hours" | "minutes";        // "minutes"
    notify_overbooked_enabled: boolean;           // true
}

// ─── Booking Rules — Cancellation & no-show policies (PRD 11 §6.1) ────────

/** Top-level policy bucket — drives which of the two policy-choice radio
 *  groups is shown on the form (Figma 4580:30598 step 1). */
export type PolicyType = "cancellation" | "no_show";

/** Cancellation-policy choice — only set when `type === "cancellation"`.
 *  `fee_if_late` reveals the "Cancel window" hours/minutes input on the
 *  form (Figma 7228:48716). */
export type CancellationChoice = "anytime_no_charge" | "fee_if_late";

/** No-show-policy choice — only set when `type === "no_show"`.
 *  `charge_session` reveals the "Charge class session" currency input on
 *  the form (Figma 7228:48751). */
export type NoShowChoice = "no_charge" | "charge_session";

/** One row per saved policy. The four Figma content variants
 *  (Cancellation × 2 choices, No-show × 2 choices) all map to one row
 *  shape — the extra inputs (`cancel_window_*` / `charge_class_session`)
 *  are only populated for the variant that uses them. Phase 4 wires
 *  these into the booking-cancel flow + booking-no-show flow. */
export interface CancellationPolicy {
    id: string;
    name: string;
    type: PolicyType;
    // Conditional payload — set per variant; left undefined otherwise.
    cancellation_choice?: CancellationChoice;
    cancel_window_value?: number;                       // "fee_if_late"
    cancel_window_unit?: "hours" | "minutes";           // "fee_if_late"
    no_show_choice?: NoShowChoice;
    charge_class_session?: number;                      // "charge_session"
    created_at: string;
}

// ─── Booking Rules — Classes settings (PRD 11 §6) ──────────────────────────

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
    /** Account lifecycle status. `active` = normal, `inactive` = suspended
     *  (login disabled, no new bookings), `archived` = hidden from the default
     *  list. Drives the customer-list status badge, the Status filter, and
     *  which row actions are offered. */
    status: "active" | "inactive" | "archived";
    /** Date of the customer's most recent attended class (ISO `YYYY-MM-DD`).
     *  Omitted when the customer has never visited — surfaces the "Never
     *  visited" filter bucket and a dash in the Last visit column. */
    last_visit_iso?: string;
    /** Expiry date of the customer's current plan (ISO `YYYY-MM-DD`). Omitted
     *  for no-plan customers. Drives the "Plan expiry date range" filter. */
    plan_expiry_iso?: string;
    // ── Profile detail (customer-detail "Details" tab) ───────────────────
    /** ISO `YYYY-MM-DD`. */
    date_of_birth?: string;
    country?: string;
    state?: string;
    city?: string;
    postal_code?: string;
    street_address?: string;
    /** Whether the customer linked a Google account for sign-in. */
    google_connected?: boolean;
    /** Marketing-preference opt-ins shown on the Details tab. */
    marketing_emails?: boolean;
    marketing_sms?: boolean;
    transactional_emails?: boolean;
    /** Emergency contact captured at sign-up. */
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relation?: string;
    /** Personal referral code the customer shares — shown on the Referrals tab. */
    referral_code?: string;
    // +later (Module 07): notes, deleted_at, churn_risk_score,
    //                     customer_memberships[], customer_packages[]
}

/**
 * Customer referral record — one row of the customer-detail "Referrals" tab,
 * which lists every person this customer successfully referred.
 *
 * The referred person isn't necessarily a seeded `customers` row (they signed
 * up through the referral link), so their name + email are stored
 * denormalized here. When the Referral module ships, a `referred_customer_id`
 * FK joins them once they become a customer.
 *
 * FK: `referrer_customer_id` → customers.id.
 */
export interface CustomerReferral {
    /** e.g. "ref_ahmed_1" */
    id: string;
    referrer_customer_id: string;  // → customers.id
    /** Referred person's display name. */
    referred_name: string;
    /** Referred person's email. */
    referred_email: string;
    /** Bonus class credits the referrer earned from this referral. */
    benefit_credits: number;
    /** ISO 8601 — when the referred person signed up via the link. */
    referred_at: string;
}

/**
 * Customer agreement record — one row of the customer-detail "Agreements"
 * tab. Each row is a version of a studio agreement (e.g. a liability waiver)
 * and whether THIS customer has signed it.
 *
 * The dedicated Agreements module doesn't exist yet — this seed stands in so
 * the tab is functional; when that module ships, agreement content + the
 * "View agreement" route hang off `id`.
 *
 * FK: `customer_id` → customers.id; `branch_id` → branches.id;
 *     `class_template_ids` → class_templates.id[].
 */
export interface CustomerAgreement {
    /** e.g. "agr_ahmed_v3" */
    id: string;
    customer_id: string;          // → customers.id
    /** FK → agreements.id (Phase 4 cross-module wiring). The customer
     *  Agreements tab joins on this to display the live agreement name + the
     *  Phase 3 view-content modal. */
    agreement_id: string;
    /** Snapshot of the agreement name at issue time. Useful when the parent
     *  agreement is later renamed — the customer's record keeps the title
     *  they actually saw. Live consumers should prefer the joined agreement
     *  name when available. */
    title: string;
    /** Version number — joins to `agreement_versions.version_number` under
     *  the same `agreement_id`. */
    version: number;
    branch_id: string;            // → branches.id
    /** Class templates the agreement covers. */
    class_template_ids: string[]; // → class_templates.id[]
    status: "signed" | "unsigned";
    /** ISO 8601 — when the customer signed. Omitted while `unsigned`. */
    signed_at?: string;
}

/**
 * Customer plan record — one row of a customer's "Plan" tab. Covers purchased
 * memberships, purchased credit packages, and complimentary grants. A customer
 * accrues a NEW row each time they buy / are granted a plan, so the table is
 * the full plan history (active + expired + frozen + cancelled + removed).
 *
 * FK: `customer_id` → customers.id; `product_id` → memberships.id / packages.id
 *     (omitted for `kind: "complimentary"`).
 */
export interface CustomerPlan {
    id: string;
    customer_id: string;
    kind: "membership" | "package" | "complimentary";
    product_id?: string;
    name: string;
    /** Plan-type column label — "Membership" | "Credit package" | "Free credit". */
    plan_type_label: string;
    /** Transaction-name subtitle — "10 credits" | "1 free credit" | "Unlimited". */
    credits_label: string;
    status: "active" | "expired" | "frozen" | "cancelled" | "removed";
    /** Purchase / grant date (ISO). Shown as "Member since" in the cancel modal. */
    purchased_at: string;
    /** Plan expiry (ISO datetime). Extended when the plan is frozen. */
    expiry_iso: string;
    /** Membership recurring billing amount in AED — drives the cancel modal's
     *  "Next billing" line. Omitted for packages + complimentary. */
    price_aed?: number;
    // ── Freeze ──
    freeze_start_iso?: string;
    freeze_end_iso?: string;
    /** Origin surface that initiated the freeze. Drives the All frozen
     *  packages + Freeze impact "Freeze source" column. */
    freeze_source?: "customer_portal" | "admin" | "front_desk";
    // ── Complimentary grant ──
    /** Number of free credits granted — complimentary plans only. */
    free_credits?: number;
    grant_reason?: string;
    grant_issued_by?: string;
    grant_issued_role?: string;
    // ── Cancellation ──
    cancel_mode?: "today" | "period_end";
    cancel_reason?: string;
    cancelled_at?: string;
    // ── Removal (complimentary) ──
    remove_reason?: string;
    removed_by?: string;
    removed_by_role?: string;
    removed_at?: string;
}

/**
 * Customer transaction record — one row of a customer's "Payments" tab
 * payment-history table, and the source for the tab's Overview metrics
 * (Total spent / Total refunded / Net spend).
 *
 * A transaction is created each time a customer pays for a membership or a
 * credit package. Gift-card sales are NOT modelled here — the customer's
 * gift cards live in `issued_gift_cards`.
 *
 * FK: `customer_id` → customers.id; `branch_id` → branches.id;
 *     `product_id` → memberships.id / packages.id. `name` is a denormalized
 *     copy of the product name (mirrors the `customer_plans` pattern) so the
 *     table + refund modal render without a join.
 */
export interface CustomerTransaction {
    /** e.g. "txn_ahmed_1" */
    id: string;
    customer_id: string;   // → customers.id
    branch_id: string;     // → branches.id
    /** Product type bought — drives the "Plan type" column + filter. */
    kind: "membership" | "package";
    /** FK → memberships.id / packages.id (depending on `kind`). */
    product_id: string;
    /** Denormalized product name shown in the table + refund modal. */
    name: string;
    /** Amount paid in AED — when tax fields below are populated, this is the
     *  GROSS amount (i.e. `subtotal_aed + tax_aed`). Historical seed rows
     *  predating the Tax module fill the breakdown fields lazily. */
    amount_aed: number;
    /** Phase 4 — pre-tax amount. Optional so existing historical seeds keep
     *  rendering as a single AED line without a forced breakdown. */
    subtotal_aed?: number;
    /** Phase 4 — tax portion of `amount_aed`. */
    tax_aed?: number;
    /** Phase 4 — tax rate applied (percentage). Lets the Payments tab
     *  render "Tax (X%)" without re-deriving the rule. */
    tax_rate_percentage?: number;
    /** Phase 4 — true when prices included tax at purchase time (the tax
     *  was already inside `subtotal_aed`-equivalent display prices). */
    tax_inclusive?: boolean;
    /** complete = paid · pending = awaiting clearance · failed = declined ·
     *  refunded = a completed payment that was later refunded. Only
     *  `complete` rows expose the "Refund payment" row action. */
    status: "complete" | "pending" | "failed" | "refunded";
    /** Method the customer paid with at purchase time. */
    payment_method: "card" | "cash";
    /** Origin surface that processed the payment. Drives the Payments
     *  + Total sales "Payment source" column. */
    payment_source?: "pos" | "customer_portal" | "admin";
    /** ISO 8601 — when the transaction was created. */
    created_at: string;
    // ─ Refund (set when status === "refunded") ───────────────────────────
    /** ISO 8601 — when the refund was processed. */
    refunded_at?: string;
    /** Method the refund was issued through (chosen in the Refund modal). */
    refund_method?: "cash" | "card";
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
    /** Optional data-URL or remote URL for the category avatar. Populated by
     *  the Service category modal's "Upload image" flow (Booking Rules
     *  Phase 3). When empty the list row and the modal preview both fall
     *  back to a placeholder image-icon avatar. */
    image_url?: string;
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
    location_type: "Group" | "Private";
    duration_min: number;
    capacity: number;
    cover_image_url?: string; // /images/class-template/*.webp
    status: "Active" | "Inactive" | "Archived";
    /** Memberships that grant access to classes from this template. */
    applicable_membership_ids: string[]; // → memberships.id[]
    /** Packages that grant access to classes from this template. */
    applicable_package_ids: string[];    // → packages.id[]
    /** Branches that offer this template. Used by the Agreements module's
     *  "Applicable services" multi-select to group rows under each branch
     *  (Figma node: agreement detail step 2). Empty/undefined = offered at
     *  every active branch (legacy fallback for older seed rows). */
    branch_ids?: string[]; // → branches.id[]
}

// ─── Services (Appointment services) ──────────────────────────────────────────

/**
 * Service template — the reusable "blueprint" for scheduled appointments.
 * Conceptually mirrors `class_templates`: a service is to an appointment
 * what a class template is to a class schedule. Two distinct shapes:
 *
 *   • Open session  (open_session = true)  — multi-customer, has capacity.
 *                                            Behaves like a small class.
 *   • Private       (open_session = false) — 1 customer + 1 instructor.
 *                                            No capacity field.
 *
 * Both flavours carry `duration_min` + `category_id`. Category drives the
 * cross-module gating dimension (which instructor can teach this, which
 * customers see it on their portal — phase later).
 *
 * `applicable_membership_ids` / `applicable_package_ids` mirror the class
 * template pattern so a single FK shape powers the "Applicable" tabs on
 * the service detail page (phase 3) and the customer-side booking gate.
 *
 * +later: price_aed, instructor_ids (Private services only — pre-pickable
 * instructors for the appointment create flow), appointment-spawn rules.
 */
export interface Service {
    /** e.g. "svc_private_reformer" */
    id: string;
    category_id: string;          // → class_categories.id
    name: string;                 // "Private Reformer"
    description: string;
    /** True = Open session (multi-customer w/ capacity). False = Private. */
    open_session: boolean;
    duration_min: number;
    /** Only meaningful when `open_session = true`. Persisted as 0 for
     *  Private services to keep the column shape stable in the future
     *  Postgres schema. */
    capacity: number;
    /** Branch where this service is offered. Single-branch in Phase 1 to
     *  match the Figma step 3 "select location" single-select; Phase 2+
     *  may widen to a multi-branch array depending on customer-portal
     *  rollout. */
    branch_id: string;            // → branches.id
    cover_image_url?: string;
    status: "Active" | "Inactive" | "Archived";
    /** Memberships that grant access to this service. */
    applicable_membership_ids: string[]; // → memberships.id[]
    /** Packages that grant access to this service. */
    applicable_package_ids: string[];    // → packages.id[]
}

// ─── Appointments (Module 13 — Phase 4) ────────────────────────────────────

/**
 * Appointment — one concrete scheduled occurrence of a Service.
 *
 * Service is to Appointment what ClassTemplate is to ClassSchedule. Status
 * transitions mirror ClassSchedule:
 *   • Upcoming  — start_time > now
 *   • Ongoing   — now ∈ [start_time, end_time]
 *   • Completed — end_time < now (and not cancelled)
 *   • Cancelled — admin cancelled via the appointment detail page
 *
 * `instructor_id` is REQUIRED for Private services (the 1-on-1 contract)
 * and OMITTED for Open session services (no instructor — the brief is
 * explicit: "open session WITHOUT instructor").
 *
 * `booked` is denormalized for fast list rendering — recomputed from
 * `appointment_bookings` rows (status='Booked') at write-time + matched
 * to the live count by the store's mutators.
 */
export interface Appointment {
    /** e.g. "appt_2026_05_15_0900_svc_private_reformer" */
    id: string;
    service_id: string;            // → services.id
    branch_id: string;             // → branches.id (denormalized for fast filter)
    room_id: string;               // → rooms.id
    /** Required for Private services, omitted for Open session. */
    instructor_id?: string;        // → staff_profiles.id
    /** "2026-05-15" — used for sorting and date-range filtering. */
    date_iso: string;
    start_time: string;            // "09:00" — 24h
    end_time: string;              // "10:00" — 24h
    display_time: string;          // "9:00 - 10:00 AM" — human-friendly
    /** Capacity at the time of booking. 1 for Private, N for Open session. */
    capacity: number;
    /** Denormalized count of appointment_bookings where status='Booked'. */
    booked: number;
    status: "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
    /** Set when status='Cancelled' — surfaced on the detail page. */
    cancelled_reason?: string;
    cancelled_at?: string;         // ISO timestamp
    cancelled_by?: string;         // human-readable attribution
    /** Aggregate rating (1–5) for Completed appointments. Denormalized
     *  from `appointment_ratings` rows so list views render without an
     *  extra join. 0 when no ratings exist yet. */
    rating?: number;
    /** Count of visible ratings (excludes soft-deleted). */
    rating_count?: number;
    created_at: string;            // ISO timestamp
}

/**
 * AppointmentRating — one customer's rating of a completed Appointment.
 * Mirrors `ClassRating` 1:1 so the rating tab + filters reuse the same
 * patterns. Only customers whose booking status is `Attended` can rate.
 */
export interface AppointmentRating {
    /** e.g. "appt_rating_..." */
    id: string;
    appointment_id: string;        // → appointments.id
    customer_id: string;           // → customers.id
    /** Optional — Private appointments have an instructor; Open session
     *  ratings rate the experience itself (no instructor FK). */
    instructor_id?: string;        // → staff_profiles.id
    /** 1-5 inclusive. */
    score: number;
    comment: string;
    /** Optional "What stood out" tags. */
    tags?: string[];
    submitted_at: string;          // ISO 8601
    deleted_at?: string;
    deleted_by?: string;
}

/**
 * AppointmentBooking — one customer occupying one slot inside an Appointment.
 *
 * For Open session appointments multiple bookings share an appointment_id.
 * For Private appointments exactly one booking exists per appointment_id.
 *
 * Status:
 *   • Booked    — confirmed, customer hasn't been marked yet
 *   • Attended  — admin marked them present on the ongoing tab
 *   • NoShow    — admin marked them absent on the ongoing tab
 *   • Cancelled — customer or admin cancelled this seat
 *                (also set when the parent appointment is cancelled)
 */
export interface AppointmentBooking {
    /** e.g. "appt_book_2026_05_15_..." */
    id: string;
    appointment_id: string;        // → appointments.id
    customer_id: string;           // → customers.id
    status: "Booked" | "Attended" | "NoShow" | "Cancelled";
    booked_at: string;             // ISO timestamp
    cancelled_at?: string;
    /** Who set the cancellation — "customer" | "admin" | "system". */
    cancelled_by?: string;
    attendance_marked_at?: string;
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
    class_type?: "Group" | "Private";
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
    /** Per-schedule override for applicable memberships. When undefined, falls
     *  back to the parent template's `applicable_membership_ids`. When set
     *  (admin edited or scratch-created), this list is authoritative and
     *  detached from the template. */
    applicable_membership_ids?: string[]; // → memberships.id[]
    /** Per-schedule override for applicable packages. Same cascade as
     *  `applicable_membership_ids`. */
    applicable_package_ids?: string[]; // → packages.id[]
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
    /** Origin surface where the booking was created. Drives the Reports
     *  module "Booking source" column + the future class-detail per-
     *  attendee source badge. */
    booking_source?: "customer_portal" | "admin" | "front_desk" | "pos";
    /** Origin surface that cancelled the booking — set when
     *  `status === "cancelled"` OR `attendance_status === "late_cancel"`.
     *  Drives the All cancellations / All bookings "Cancelled source"
     *  column. */
    cancelled_source?: "customer_portal" | "admin" | "front_desk" | "instructor" | "system";
    /** ISO timestamp recorded the moment a staff member flips
     *  `attendance_status` away from "pending" via `updateAttendance`. Drives
     *  the team-activity feed's attendance events ("River Teach marked
     *  Sara Williams present in Hot Yoga"). */
    attendance_marked_at?: string;
    /** Display name of the staff member who marked attendance. Resolved from
     *  `currentUser` at mutation time so the audit trail survives even when
     *  the user later changes their display name. */
    attendance_marked_by?: string;
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

// ─── Pay rates (PRD 10 §6) ──────────────────────────────────────────────────
//
// `pay_rates` carries the structured rate definition (per-type config) and the
// flags that drive payroll calculation. `usageCount` is a +later denormalized
// count once the payroll table ships — for now the seed carries it directly.
//
// FK: `branch_id` → branches.id (single branch per row to match the v1 UI).

export type PayRateStatusSeed = "active" | "archive";
export type PayRateTypeSeed   = "flat" | "tiered" | "revenue" | "hybrid" | "monthly";

export interface PayRateTierSeed {
    id: string;
    from: number;
    to: number;
    /** AED amount paid when attendee count falls in [from, to]. */
    aed: number;
}

export type PayRateHybridConditionSeed =
    | { kind: "bonus_attendance"; bonus_threshold: number; bonus_per_customer: number }
    | { kind: "revenue"; split_percent: number };

interface PayRateBaseSeed {
    id: string;
    name: string;
    branch_id: string;
    status: PayRateStatusSeed;
    /** Toggle — "Only count checked-in customers" (false = count all booked). */
    only_checked_in?: boolean;
    /** Toggle — "Include late-cancelled customers" (false = exclude). */
    include_late_cancelled?: boolean;
    /** Staff assignments + payroll uses combined. Delete gate is `0`. */
    usage_count: number;
    created_at?: string;
    /** Optional per-rate tax override (PRD 11 §10 / Module 10 §6.3).
     *  Maps to `tax_rates.id`. Unset = "No tax rate" — inherits the
     *  global pay-rate tax rule. */
    tax_rate_id?: string;
    // +later: archived_at, superseded_by_id, version, notes
}

export interface FlatPayRateSeed    extends PayRateBaseSeed { type: "flat";    flat_amount: number }
export interface TieredPayRateSeed  extends PayRateBaseSeed { type: "tiered";  tiers: PayRateTierSeed[] }
export interface RevenuePayRateSeed extends PayRateBaseSeed { type: "revenue"; split_percent: number; pay_per_customer?: number }
export interface HybridPayRateSeed  extends PayRateBaseSeed { type: "hybrid";  base_rate: number; condition: PayRateHybridConditionSeed }
export interface MonthlyPayRateSeed extends PayRateBaseSeed {
    type: "monthly";
    fixed_salary: number;
    bonus_of_salary_percent?: number;
    bonus_cap?: number;
    sales_commission_packages_percent?: number;
    sales_commission_memberships_percent?: number;
}

export type PayRateSeed = FlatPayRateSeed | TieredPayRateSeed | RevenuePayRateSeed | HybridPayRateSeed | MonthlyPayRateSeed;

// ─── Instructors (extends staff_profiles for cross-module use) ──────────────
//
// The pay rate detail page reads `pay_rate_id` to filter; the (eventual) staff
// module will own the fuller view. Keeping this in its own table — separate
// from `staff_profiles` — so future Front Desk / Operator rows have a clean
// home that isn't shaped around the instructor flow.
//
// FK:
//   • branch_id   → branches.id
//   • pay_rate_id → pay_rates.id (nullable when the instructor has no rate)

export type InstructorStatusSeed = "active" | "inactive" | "archive";

export interface InstructorSeed {
    id: string;                  // shared with staff_profiles.id when both exist
    full_name: string;
    initials: string;
    color_hex: string;
    image_url?: string;
    email: string;
    phone: string;
    /** Pre-formatted "Feb 1, 2024" string — display-ready. */
    joined_date: string;
    branch_id: string;
    pay_rate_id?: string;
    status: InstructorStatusSeed;
    // +later: bio, specialties, default_capacity, hire_date
}

// ─── Payroll entries (PRD 10 §7) ────────────────────────────────────────────
//
// One row per (instructor, period). When a payroll run is confirmed, every
// pending entry in that period flips status: pending → paid and gets stamped
// with `payroll_run_id`.
//
// FK:
//   • instructor_id  → instructors.id
//   • branch_id      → branches.id          (snapshot at entry creation)
//   • pay_rate_id    → pay_rates.id         (snapshot at entry creation)
//   • payroll_run_id → payroll_runs.id      (nullable, set when paid)

export type PayrollEntryStatusSeed = "pending" | "paid";

export interface PayrollEntrySeed {
    id: string;
    instructor_id: string;
    branch_id: string;
    pay_rate_id: string;
    /** Display snapshot — the pay rate's name as of entry creation. Survives
     *  later renames / archives so historical rows still read correctly. */
    pay_rate_name: string;
    /** Period covered by this entry — ISO yyyy-mm-dd. */
    period_start: string;
    period_end: string;
    /** Completed classes the instructor taught in the period. */
    classes_count: number;
    /** Sum of attendees across those classes — drives per-attendee math. */
    total_attendees: number;
    /** Total class duration in hours (sum of all completed classes).
     *  Surfaced as the "Total time (hour)" column on the Run Payroll page. */
    total_hours: number;
    /** Revenue the studio earned from those classes (AED). Surfaced as the
     *  "Gross revenue" column on the Run Payroll table. */
    gross_revenue: number;
    /** Earnings before any manual adjustment. */
    base_earnings: number;
    /** + or - AED amount applied during the Run Payroll review step. */
    adjustment_amount: number;
    adjustment_reason?: string;
    /** Final amount: base_earnings + adjustment_amount. */
    total_earnings: number;
    status: PayrollEntryStatusSeed;
    /** Set when a payroll run is confirmed and this entry is marked paid. */
    payroll_run_id?: string;
    created_at?: string;
    // +later: substitute_classes, pay_rate_snapshot (full JSON), paid_at
}

// ─── Roles & permissions (PRD 10 §5 + Brief — Staff & Permissions module) ──
//
// `roles` is the source of truth for permission templates, grant limits, and
// branch scope. Each row is a NAMED INSTANCE of one of 5 predefined role
// types — admins create their own role names ("Forma South Ops", "Senior
// Instructors") but the underlying `type` constrains what permission shape
// they inherit. The Owner row is auto-created at signup and cannot be edited
// by this module (locked = true).
//
// FK: branch_id → branches.id (nullable — Owner has no branch scope).

export type RoleTypeSeed = "owner" | "branch_admin" | "operator" | "front_desk" | "instructor";
export type RoleStatusSeed = "active" | "inactive" | "archive";

/** A single cell in the CRUD permission matrix.
 *  • true  — granted (checked checkbox)
 *  • false — not granted (empty checkbox)
 *  • "na"  — not applicable for this module × action (renders as "-") */
export type PermissionCellSeed = boolean | "na";

/** One row in the matrix: 4 actions per module (Create / Edit / Delete / View),
 *  matching the Figma permission tables (6618-158416 through 158420). */
export interface PermissionRowSeed {
    create: PermissionCellSeed;
    edit:   PermissionCellSeed;
    delete: PermissionCellSeed;
    view:   PermissionCellSeed;
}

/** Section → module-key → CRUD row. Section + module ordering is held in
 *  `PERMISSION_SECTIONS` (see permission_templates.ts) so the matrix renders
 *  in a deterministic order. The map itself just stores cell state per role. */
export type PermissionsMapSeed = Record<string, Record<string, PermissionRowSeed>>;

/** Grant Limits config — drives the customer module's "Add complimentary
 *  credit" feature (PRD 00 §4.4).
 *
 *  Shape mirrors the Figma row-by-row table:
 *    • `enabled` — section-level toggle (hides the whole feature when off)
 *    • `unlimited` — section-level shortcut that marks both numeric limits
 *      as uncapped (renders "Unlimited" badges)
 *    • Per-row `*_enabled` flags — each row can be toggled on/off
 *      independently from the table's Enabled column
 *
 *  When the table-level Enabled checkbox on a numeric row is off, the value
 *  for that row is ignored at enforcement time (the limit doesn't apply). */
export interface GrantLimitsSeed {
    enabled: boolean;
    /** If true, both numeric rows render as "Unlimited" — uncapped. */
    unlimited: boolean;
    /** Max grants this role can issue per calendar month. */
    grants_per_month: number;
    /** Whether the per-month limit is enforced (Enabled column on its row). */
    grants_per_month_enabled?: boolean;
    /** Max AED value of a single grant. */
    max_grant_value_aed: number;
    /** Whether the max-value limit is enforced (Enabled column on its row). */
    max_grant_value_enabled?: boolean;
    /** Whether the role can remove unused grants from customers. */
    allow_remove_unused: boolean;
}

export interface RoleSeed {
    id: string;
    /** Admin-supplied name (e.g. "Branch admin 1"). Distinct from `type`. */
    name: string;
    description: string;
    /** Predefined type — constrains the inherited permission shape. */
    type: RoleTypeSeed;
    /** FK → branches.id. Null for Owner (all branches). */
    branch_id: string | null;
    status: RoleStatusSeed;
    /** Optional Grant Limits override. */
    grant_limits: GrantLimitsSeed;
    /** Full permission matrix — inherits the type default, can be overridden. */
    permissions: PermissionsMapSeed;
    /** Locked rows (Owner) cannot be edited or deactivated via the UI. */
    locked: boolean;
    created_at?: string;
    archived_at?: string;
}

// ─── Staff (PRD 10 §3 + PRD 01 §10 demo users) ─────────────────────────────
//
// One row per person with system access. Each staff has ONE role assignment
// in MVP (multi-role architecture deferred). Status lifecycle:
//   pending  → invite sent, hasn't completed first-login
//   active   → has signed in at least once
//   inactive → deactivated (temporary leave — login disabled, data preserved)
//   archive  → permanently left the studio
//
// Instructor-specific columns (bio, specialties, pay_rate_id) only render
// in the UI when role.type === "instructor".
//
// FK: role_id → roles.id · branch_id → branches.id · pay_rate_id → pay_rates.id

export type StaffStatusSeed = "pending" | "active" | "inactive" | "archive";

/**
 * Shift — the Shift management module's data shape. Drives the Shift
 * management tab (table + bulk actions) + the staff form's Assign shift
 * dropdown + the instructor detail Shift hours line.
 *
 * Status mirrors the standard archive/delete matrix used elsewhere:
 *   • "active"   — visible, enable-toggle on, assignable to staff
 *   • "inactive" — temporarily paused, NOT assignable but staff history kept
 *   • "archive"  — hidden from default list, surfaces only via Archive filter
 */
export type ShiftStatusSeed = "active" | "inactive" | "archive";

export interface Shift {
    /** e.g. "shift_morning" */
    id: string;
    name: string;             // "Morning shift"
    /** FK → branches.id. Shifts are per-branch. */
    branch_id: string;
    start_time: string;       // "07:00" — 24h
    end_time: string;         // "12:00" — 24h
    /** 7-bit array [Sun..Sat] — true means the shift covers that day. */
    working_days: boolean[];
    status: ShiftStatusSeed;
    created_at: string;       // ISO 8601
}

// ─── Blocked time (Staff & shift module) ──────────────────────────────────
//
// One row per blocked-time entry — a single date window when one or more
// staff are unavailable (sick day, training, personal appointment, etc.).
// Drives the Staff & shift module's Blocked time tab (Figma 7413:239407)
// and a future schedule grid overlay.
//
// Rules:
//   • `title` is OPTIONAL (admin can leave it blank — defaults to "Blocked"
//     in the table).
//   • `date` is an ISO date string ("YYYY-MM-DD"). Admins can only pick
//     today or a future date in the form, but past entries are still
//     historically valid and shown in the list.
//   • `staff_ids` is multi-select — one blocked-time entry can cover one
//     or many staff (e.g. branch-wide training session).
//   • Branch is derived at read time from the assigned staff so it stays
//     in sync if a staff member moves branches.

export interface BlockedTime {
    /** e.g. "blocked_2025_03_18" */
    id: string;
    /** Optional label — leave blank for a generic block. */
    title: string;
    date: string;             // "2025-03-18"
    start_time: string;       // "13:00"
    end_time: string;         // "14:00"
    /** Free-text reason / context. Empty string when unused. */
    note: string;
    /** FK array → staff.id. At least one entry. */
    staff_ids: string[];
    /** FK → branches.id. Convenience denorm so the branch filter on the
     *  list view runs without a per-row staff lookup. */
    branch_id: string;
    created_at: string;       // ISO 8601
}

export interface StaffSeed {
    id: string;
    first_name: string;
    last_name: string;
    /** Denormalized "First Last" for fast list rendering. */
    full_name: string;
    email: string;
    phone: string;
    image_url?: string;
    initials: string;
    color_hex: string;
    role_id: string;          // → roles.id
    branch_id: string | null; // null when assigned to All locations (Owner)
    status: StaffStatusSeed;
    /** "Demo1234!" for prototype; never displayed. */
    temp_password?: string;
    invite_sent_at?: string;
    first_login_completed: boolean;
    /** Display-ready "Feb 1, 2024". */
    joined_date: string;
    // ── Instructor-specific (nullable for other roles) ────────────────────
    bio?: string;
    specialties?: string[];
    pay_rate_id?: string;
    /** Short introduction paragraph — surfaces on the instructor detail
     *  page + the customer-facing instructor portal. Multi-line text. */
    short_intro?: string;
    /** Years of working experience — single integer. Surfaces on the
     *  instructor detail + the customer-facing instructor portal. */
    working_experience_years?: number;
    /** Assigned shift id — FK → shifts.id. Optional per the brief
     *  (instructors can be unassigned and assigned later). */
    shift_id?: string;
    /** Class categories this instructor is qualified to teach. Multi-
     *  select. Drives the cross-module instructor gating: an instructor
     *  can only be selected on a class template / schedule / service /
     *  appointment whose category appears in this array. Empty array =
     *  no categories assigned yet → can't be picked anywhere. */
    category_ids?: string[];
    // +later: dob, gender, address, emergency_contact, working_days
}

// ─── Customer notification settings (PRD 11 §12) ──────────────────────────

export type NotificationCategorySeed =
    | "booking"
    | "payment"
    | "package_membership"
    | "marketing"
    | "referral";

// ─── Referral settings (PRD 11 §11) ───────────────────────────────────────

/** "Trigger for successful referral" dropdown — when the rewards unlock. */
export type ReferralTriggerSeed = "sign_up" | "purchase";

export interface ReferralSettingsSeed {
    program_active: boolean;
    // ── New customer benefit (referred) ──
    new_customer_credits: number;
    new_customer_message: string;
    // ── Existing customer benefit (referrer) ──
    existing_customer_trigger: ReferralTriggerSeed;
    existing_customer_min_referred: number;
    existing_customer_credits: number;
    existing_customer_message: string;
    // ── Customer-facing copy ──
    info_description: string;
}

/** One row per customer-facing notification event. Drives the per-channel
 *  toggles + template editor on Settings → Customer notifications. Field set
 *  matches the inputs the UI actually edits (Figma 4467-35019): the three
 *  channel toggles + the three template fields. */
export interface NotificationSettingSeed {
    id: string;
    category: NotificationCategorySeed;
    /** Stable enum key — used by code that fires the notification. */
    notification_type: string;
    /** Display label in the row. */
    label: string;
    // ── Channel switches (the 3 row toggles) ──────────────────────────────
    email_enabled: boolean;
    whatsapp_enabled: boolean;
    push_enabled: boolean;
    // ── Template fields (set in the Edit template modal) ──────────────────
    email_subject?: string;
    email_template?: string;
    whatsapp_template?: string;
}

// ─── Notification records (in-app feed — PRD 12 §6.1) ────────────────────────

/** The exact event the notification represents. Drives icon + title + which
 *  module the click-through navigates to.
 *
 *  Admin events: booking_confirmation / late_cancellation / no_show /
 *  waitlist_promoted / class_cancelled / payment_confirmed / refund_processed.
 *
 *  Instructor-only events: new_booking / class_full / cancellation /
 *  payment_earned / weekly_earnings — these surface ONLY in the instructor
 *  notification feed (filtered by `audience === "instructor"`). */
export type NotificationEventSeed =
    | "booking_confirmation"
    | "late_cancellation"
    | "no_show"
    | "waitlist_promoted"
    | "class_cancelled"
    | "payment_confirmed"
    | "refund_processed"
    // ── Instructor events ──
    | "new_booking"
    | "class_full"
    | "cancellation"
    | "payment_earned"
    | "weekly_earnings"
    // ── Admin → instructor sync events (Phase 4 extension) ──
    //    Fired by admin mutators that change something on the instructor's
    //    side. Each emit pairs an admin row (audit trail) with an
    //    instructor row scoped via `targetInstructorId`.
    | "class_scheduled"     // new class assigned to instructor
    | "class_rescheduled"   // class moved / time / room / instructor change
    | "pay_rate_assigned"   // instructor reassigned to a different pay rate
    | "pay_rate_updated"    // existing pay rate's amount or name changed
    // ── Appointment events (Module 13 — Phase 4E) ──────────────────────
    | "appointment_booked"      // new customer booking on an appointment
    | "appointment_cancelled"   // whole appointment cancelled by admin
    | "customer_marked_present"  // customer attendance marked on ongoing
    // ── Staff & shift events (Phase 4F) ──────────────────────────────
    //    Fired when admin mutates a staff member's availability — the
    //    instructor bell + the admin audit log both pick these up.
    | "shift_assigned"           // staff (re)assigned to a shift
    | "shift_removed"            // staff removed from a shift
    | "blocked_time_added"       // admin blocked time for instructor
    | "blocked_time_removed";    // admin deleted a blocked-time entry

/** Tab grouping on the notifications page.
 *
 *  Admin tabs (`/admin/notifications`): All / Bookings / Payments
 *    → row.tab is "booking" or "payment".
 *
 *  Instructor tabs (`/instructor/notifications`): All / Bookings / Earnings
 *    → row.tab is "booking" or "earnings".
 *
 *  Pure presentation field — kept on the row so a single filter expression
 *  can drive the tab badges. */
export type NotificationTabSeed = "booking" | "payment" | "earnings";

/** Featured-icon glyph rendered in the 48px (page) / 40px (dropdown) tile.
 *  Mapped to a `@untitledui/icons` component at render time.
 *
 *  `bank-note` is used by the instructor earnings notifications (payment
 *  earned, weekly summary). */
export type NotificationIconSeed =
    | "calendar-check"
    | "calendar-minus"
    | "user-x"
    | "credit-card"
    | "refresh"
    | "calendar-x"
    | "bank-note";

/** Which module the click-through should navigate to. Pairs with `source_id`
 *  to build the destination URL (e.g. `/schedule/{source_id}` for class). */
export type NotificationSourceSeed = "booking" | "class" | "transaction";

/** Who the notification is for. Drives audience-scoped feed filtering:
 *  the admin bell + `/admin/notifications` page show "admin" (and legacy
 *  undefined) rows; the instructor bell + `/instructor/notifications`
 *  page show "instructor" rows. Existing rows pre-dating this field stay
 *  undefined and behave like admin notifications. */
export type NotificationAudienceSeed = "admin" | "instructor";

/** One row per in-app notification record. This is the **feed** table —
 *  separate from `notification_settings` which configures customer-facing
 *  channel/template config. */
export interface NotificationSeed {
    id: string;
    /** Audience scope — see `NotificationAudienceSeed`. Optional; treat
     *  undefined as "admin" so legacy seeds keep working unchanged. */
    audience?: NotificationAudienceSeed;
    /** Tab grouping — "booking" for booking/class events, "payment" for sale
     *  & refund events. */
    tab: NotificationTabSeed;
    /** The exact event. */
    event: NotificationEventSeed;
    /** Display title (e.g. "Booking Confirmation"). Set per-row so future
     *  copy tweaks land here instead of in the renderer. */
    title: string;
    /** Body line — fully interpolated at seed time. */
    body: string;
    /** Featured-icon glyph. */
    icon: NotificationIconSeed;
    /** Which module the notification points at — used to build the
     *  click-through route. */
    source_module: NotificationSourceSeed;
    /** Related record id (`class_bookings.id`, `class_schedule.id`, or
     *  `customer_transactions.id`). Nullable when the source row has been
     *  removed but the notification persists. */
    source_id?: string;
    /** Convenience FKs so the tab badge counts and per-branch filters can
     *  group without a join. */
    customer_id?: string;
    branch_id?: string;
    /** Class schedule id — populated on every booking/class event so the
     *  click-through can deep-link to `/schedule/[classScheduleId]` (the
     *  class-detail page with the roster). Always set for `booking`,
     *  `class_cancelled`, `late_cancellation`, `no_show`, and
     *  `waitlist_promoted` events. */
    class_schedule_id?: string;
    /** Specific instructor the notification is attributed to (FK to
     *  `staff_profiles.id`). Populated when `audience === "instructor"`
     *  so the instructor bell + page can filter to a single staff
     *  member — without this, every instructor would see every other
     *  instructor's cancellations. Undefined for admin rows. */
    target_instructor_id?: string;
    /** Customer transaction id — populated for payment events so the
     *  click-through opens the customer profile with the receipt visible. */
    transaction_id?: string;
    /** Unread state. Read records still appear in the list with a muted
     *  green dot collapsed (no dot rendered) — matches the Figma. */
    is_read: boolean;
    /** ISO timestamp — drives "Today/Past" sectioning and "2 min ago". */
    created_at: string;
}

// ─── Instructor integrations (per-instructor calendar sync) ────────────────
//
// Distinct from the studio-level `integrations` table (which holds
// org-wide providers like Stripe / Google Analytics / WhatsApp). Each row
// here pairs ONE instructor with ONE calendar provider — Liam's Google
// Calendar is a different record from Maya's, because the OAuth tokens
// would belong to each instructor's account.
//
// When this app moves to Supabase, this becomes the
// `instructor_integrations` table with a (staff_profile_id, slug) unique
// constraint.

/** Calendar providers the instructor can connect — narrower than the
 *  studio integration `slug` because instructor-side sync is calendar-only. */
export type InstructorIntegrationSlugSeed = "google_calendar" | "apple_calendar";

/** Same `connected | not_connected` shape the studio integrations use, so
 *  the rendered "Connected" badge + button-state branches stay shareable. */
export type InstructorIntegrationStatusSeed = "connected" | "not_connected";

export interface InstructorIntegrationSeed {
    id: string;
    /** FK → `staff_profiles.id`. Drives per-instructor scoping in the
     *  store + on the instructor's Integrations tab. */
    staff_profile_id: string;
    slug: InstructorIntegrationSlugSeed;
    status: InstructorIntegrationStatusSeed;
    /** ISO timestamp when the instructor connected the provider.
     *  Cleared on disconnect. */
    connected_at?: string;
    /** Account identifier the provider returned at connect time —
     *  rendered on the View modal so the instructor can confirm which
     *  account is linked. */
    account_label?: string;
}

// ─── Tax module (PRD 11 §10) ─────────────────────────────────────────────────

/** Lifecycle status — same shape as memberships/packages/gift cards so the
 *  row-action ⋮ menu pattern (Archive / Deactivate ↔ Delete / Reactivate /
 *  Recover) maps 1:1. */
export type TaxRateStatusSeed = "active" | "inactive" | "archived";

/** Per-rate calculation mode — overrides the global `prices_include_tax`
 *  toggle when set. PRD 11 §10.3 ("Inclusive / Exclusive per rate override"). */
export type TaxCalculationModeSeed = "exclusive" | "inclusive";

/** One row per configured tax rate. Lives in /admin/settings/tax → Tax rates
 *  list. Each row gets applied to one or more product categories via
 *  `tax_rules` in Phase 3 — the `usage_count` shown in the row-action
 *  Delete↔Deactivate swap is derived live from that join.
 *
 *  FK: none yet. Phase 4 wires `memberships.tax_rate_id` /
 *      `packages.tax_rate_id` / `gift_card_designs.tax_rate_id` /
 *      `pay_rates.tax_rate_id` → `tax_rates.id`. */
export interface TaxRateSeed {
    id: string;
    name: string;
    rate_percentage: number;
    description?: string;
    /** Per-rate override of the global `prices_include_tax` toggle. */
    calculation_mode: TaxCalculationModeSeed;
    status: TaxRateStatusSeed;
    created_at: string;
}

/** Studio-wide tax settings. Currently a single row — modelled as an
 *  interface so future fields (`apply_to_all_products_by_default`, etc.) can
 *  land here without breaking the store shape. */
export interface TaxSettingsSeed {
    /** Global default — when true, all prices already include tax (PRD §10.1
     *  "Tax inclusive"). When false, tax is added at checkout. */
    prices_include_tax: boolean;
}

// ─── Tax rules (Apply tax rates tab — PRD 11 §10.4 / Phase 3) ────────────────

/** Which product category a tax rule applies to. The Apply tax rates tab
 *  groups all rules under these four predefined categories (Figma 5041-99787). */
export type TaxRuleCategorySeed =
    | "membership"
    | "credit_package"
    | "gift_card"
    | "pay_rate";

/** Rule-level on/off — driven by the per-row toggle in the Figma. Toggling
 *  off keeps the rule's configuration but stops it applying to future sales. */
export type TaxRuleStatusSeed = "active" | "inactive";

/** One row per applied tax rule. Each category can hold many rules — typical
 *  shape is "one rule per branch" but a single rule with `all_locations: true`
 *  is also valid (Figma's Membership demo).
 *
 *  FK behaviour:
 *    • `tax_rate_id` → `tax_rates.id` — when the referenced rate is archived
 *      or deleted, the rule's `tax_rate_id` is cleared to undefined so the
 *      row visibly drops back to the "Select tax rate" placeholder.
 *    • `location_ids[]` → `branches.id` — when a branch is archived /
 *      deleted, it's removed from this array on every rule. */
export interface TaxRuleSeed {
    id: string;
    category: TaxRuleCategorySeed;
    /** Nullable while the rule is being filled out (matches the Figma's
     *  "Select tax rate" placeholder state). */
    tax_rate_id?: string;
    /** When `true`, the rule applies to every active branch — the location
     *  selector shows "All locations selected" and `location_ids` is ignored. */
    all_locations: boolean;
    /** Specific branch FKs (only consulted when `all_locations` is false). */
    location_ids: string[];
    status: TaxRuleStatusSeed;
    created_at: string;
}

// ─── Agreements module (PRD 11 §9 / Brief-for-Agreements-module.md) ─────────

/** Legal type captured in Step 1 "Basic information" (PRD 11 §9.2). The list
 *  view doesn't surface this — it's read by the detail page + filter
 *  (Phase 2/3). The "Type" *column* in the Figma is location scope, not this. */
export type AgreementTypeSeed =
    | "liability_waiver"
    | "consent_form"
    | "terms_and_conditions"
    | "health_declaration"
    | "other";

/** Lifecycle status. Brief explicitly excludes "delete" + "deactivate" for
 *  agreements — legal records can only be Archived (and Recovered back). */
export type AgreementStatusSeed = "active" | "archived";

/** Whether the current version's content was authored in the rich editor or
 *  uploaded as a PDF/DOCX (Step 3 of the create flow). */
export type AgreementContentTypeSeed = "text" | "upload";

/** One row per agreement. The actual content lives on `agreement_versions`
 *  so versions can be republished/inspected independently — the parent row
 *  caches the current version number for fast list rendering.
 *
 *  Cross-module FKs:
 *    • `location_ids[]` → `branches.id` (when `all_locations: false`)
 *    • `customer_agreements.agreement_id` → this row's `id` (Module 07
 *      Customer detail Agreements tab consumes this in Phase 4)
 */
export interface AgreementSeed {
    id: string;
    name: string;
    type: AgreementTypeSeed;
    description?: string;
    /** Required for first booking — PRD 11 §9.2 Step 1 "Required" toggle. */
    required: boolean;
    /** Cached version number — equals MAX(agreement_versions.version_number)
     *  for this id. Bumped by the "Add new version" flow (Phase 3). */
    current_version: number;
    /** Rules step (Phase 2) — when ON, agreement applies studio-wide; when
     *  OFF, only branches in `location_ids` see it. The list view derives
     *  "Multi-branch" vs "Specific branch" from this + the array length. */
    all_locations: boolean;
    location_ids: string[];
    /** Rules step — "Applicable services" multi-select. References
     *  `class_templates.id` (i.e. individual offered services, grouped
     *  by branch in the form UI). Empty/undefined = applies to every
     *  active service. Phase 4 wires this into the booking flow so the
     *  customer only sees agreements covering the class they're booking. */
    applicable_class_template_ids?: string[];
    /** Rules step — Issued date (locked to today at creation, ISO 8601). */
    effective_from: string;
    /** Rules step — Expiry date (must be ≥ today at creation, ISO 8601). */
    effective_until: string;
    status: AgreementStatusSeed;
    /** ISO timestamp — bumps on every save (versioned content edits + status flips). */
    updated_at: string;
    created_at: string;
}

/** One row per published version. The current version is the row with the
 *  highest `version_number` for a given `agreement_id` — `agreements.current_version`
 *  caches that for the list view.
 *
 *  Content lives here (text OR file URL) so republishing creates a new row
 *  rather than mutating the previous one. Members who signed an earlier
 *  version are still bound by the version they signed.
 */
export interface AgreementVersionSeed {
    id: string;
    agreement_id: string;       // → agreements.id
    version_number: number;     // 1, 2, 3 …
    content_type: AgreementContentTypeSeed;
    /** Rich-text HTML (when content_type === "text"). */
    content_text?: string;
    /** Original filename (when content_type === "upload"). */
    file_name?: string;
    /** Mock URL — points at the bundled sample PDF (when content_type === "upload"). */
    file_url?: string;
    /** File size in bytes — drives the "1.2 MB" display next to the filename. */
    file_size_bytes?: number;
    /** Extracted HTML content (when content_type === "upload"). For PDFs the
     *  text is extracted via pdfjs-dist; for DOCX via mammoth. The View
     *  modal renders this directly via `dangerouslySetInnerHTML`, so file
     *  contents appear as styled text rather than a download link. */
    extracted_html?: string;
    /** ISO 8601 — when this version was published. */
    published_at: string;
    /** FK → users.id — who published this version. */
    published_by: string;
}

// ─── Integrations module (PRD 11 §8 / Brief-for-integrations-module.md) ────

/** Stable identifier per integration. Used by the page to route to the
 *  correct per-tool Connect / View modal in Phase 2. */
export type IntegrationSlugSeed =
    | "google_calendar"
    | "whatsapp_business"
    | "apple_calendar"
    | "google_analytics";

/** Lifecycle status. Brief only models two states for now: not_connected
 *  (default — Connect button) and connected (View + Disconnect buttons).
 *  PRD §8.1 also mentions an "Error" state; deferred until Phase 2/3. */
export type IntegrationStatusSeed = "not_connected" | "connected";

/** One row per integration the studio can connect to. The simulated
 *  connect flow flips `status` to "connected" + stamps `connected_at` and
 *  an `account_label` (shown later in the Phase 2 View modal). Disconnect
 *  reverses all three. No real OAuth — see Phase 3 brief. */
export interface IntegrationSeed {
    id: string;
    slug: IntegrationSlugSeed;
    name: string;
    /** One-line copy shown under the name on the card. */
    description: string;
    status: IntegrationStatusSeed;
    /** ISO 8601 — when the studio connected. Cleared on disconnect. */
    connected_at?: string;
    /** Account / workspace label shown later by the View modal — e.g.
     *  "FitLab Studio Schedule" for Google Calendar. Cleared on disconnect. */
    account_label?: string;
}

// ─── Payments module (PRD 11 §7 / Brief-for-payments-module.md) ────────────
//
// NOTE: The existing `payment_methods` table holds CUSTOMER SAVED CARDS
// (the POS Card-on-file selector). This new `payment_providers` table is
// the studio-level settings page — Stripe / Apple Pay / Google Pay
// gateways and wallets the admin connects. Two distinct concepts; the
// names stay separate to keep them legible.

/** Stable identifier per payment provider. */
export type PaymentProviderSlugSeed =
    | "stripe"
    | "apple_pay"
    | "google_pay";

/** "gateway"  — top-level payment processor (Stripe). Connects directly.
 *  "wallet"   — Apple Pay / Google Pay. Always nested under a gateway —
 *               requires the gateway to be connected before it can be
 *               enabled. Disconnecting the gateway cascades and disables
 *               every wallet that depended on it. */
export type PaymentProviderKindSeed = "gateway" | "wallet";

/** Lifecycle status — same shape as integrations. `not_connected` means
 *  the Connect (gateway) / Enable (wallet) button is shown; `connected`
 *  shows View + Disconnect. */
export type PaymentProviderStatusSeed = "not_connected" | "connected";

/** One row per payment provider shown on /admin/settings/payments. The
 *  simulated flow is identical to the Integrations module — flip status,
 *  stamp connected_at + account_label, surface a toast.
 *
 *  Phase 3 cross-module sync: the POS Checkout reads from this table to
 *  decide which payment-method cards to render. Disabling Apple Pay here
 *  removes the Apple Pay card from POS in the same render cycle.
 *
 *  FK: `requires_provider_slug` → another row's `slug`. Wallets that
 *      reference an un-connected gateway can't be enabled. */
export interface PaymentProviderSeed {
    id: string;
    slug: PaymentProviderSlugSeed;
    name: string;
    /** One-line copy shown under the name on the card. */
    description: string;
    kind: PaymentProviderKindSeed;
    /** When set, this provider is gated on another provider (by slug)
     *  being `connected`. Wallets use this; gateways don't. */
    requires_provider_slug?: PaymentProviderSlugSeed;
    status: PaymentProviderStatusSeed;
    /** ISO 8601 — when the provider was connected/enabled. Cleared on
     *  disconnect or when the gateway it depends on disconnects. */
    connected_at?: string;
    /** Account label shown later by the View modal — e.g. "acct_***1234"
     *  for Stripe, the Apple ID email for Apple Pay. Cleared on disconnect. */
    account_label?: string;
}
