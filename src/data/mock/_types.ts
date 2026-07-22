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
    // +later: opening_hours, logo_url
    /** Optional branch-level contact info — populated by the Branch form. */
    phone?: string;
    email?: string;
    /** First-level subdivision — "Dubai" (Emirate), "East Java" (Province),
     *  "California" (State). What the country calls this varies (see
     *  `Country.stateLabel`); we always store the English display name.
     *  Drives timezone resolution — a state's TZ is authoritative for its
     *  cities. Undefined for legacy records; the resolver falls back to the
     *  city-in-state lookup, then the country default. */
    state?: string;
    city?: string;
    country?: string;
    /** IANA timezone (e.g. "Asia/Dubai") — auto-derived from country + city
     *  by `resolveBranchTimezone` in `src/lib/data/locales.ts`. Never edited
     *  directly; the Branch form re-derives on every country/city change,
     *  keeping this field in lock-step with the address. Every time display
     *  scoped to a branch (schedule, class detail, dashboard) reads this
     *  instead of the studio-wide default. */
    timezone?: string;
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
/** v26 — reshaped for the new Booking Rules module (Figma 4580:29847).
 *  Legacy Step 2 (SMS cutoff), Step 3 (overbooking), and the
 *  auto-submit-attendance field are dropped — none of those appear in
 *  the new landing/panel Figmas. Remaining fields split cleanly into
 *  BOOKING WINDOW (with the new cutoff toggle) and WAITLIST (with the
 *  new auto-promotion cut-off subsection). */
export interface ClassesSettings {
    id: string;                                   // "classes_settings_default"

    // ── Booking window (Figma 7631:393661 / 7644:81487) ────────────────
    /** How far in advance customers can start booking a class. */
    booking_open_value: number;                   // 7
    booking_open_unit: "days" | "hours" | "minutes";        // "days"
    /** When ON, members can book right up until the class starts —
     *  landing's "Last minutes booking" row reads "Yes" and the
     *  Bookings-close picker is hidden in the side panel. When OFF,
     *  the cutoff is enforced (booking_close_value/unit apply). */
    booking_cutoff_enabled: boolean;              // false = enforce cutoff
    booking_close_value: number;                  // 1
    booking_close_unit: "minutes" | "hours" | "days";       // "minutes"

    // ── Waitlist (Figma 7631:394473 / 7714:17067) ──────────────────────
    /** Master switch — when OFF the landing card collapses to header +
     *  toggle only, the whole panel greys out, and booking flow skips
     *  the waitlist offer entirely. */
    waitlist_enabled: boolean;                    // true
    max_waiting_spots: number;                    // 10
    /** Channels members can pick from — WhatsApp / Email / SMS / Push. */
    notify_via: Array<"whatsapp" | "email" | "sms" | "push">;
    /** When a booked spot opens up — auto-add the next person, or
     *  send a notification and let them claim it. */
    when_spot_opens_mode: "auto_add_next" | "notify_to_accept";
    /** When ON, `stop_auto_promoting_value/unit` is IGNORED and the
     *  auto-promote window mirrors the cancellation policy's free
     *  cancellation window (creditWindowBeforeClassHours). Toggle
     *  OFF to type a custom value. */
    match_free_cancellation_window: boolean;
    /** Custom auto-promote cutoff (only respected when
     *  `match_free_cancellation_window === false`). */
    stop_auto_promoting_value: number;            // 12
    stop_auto_promoting_unit: "hours" | "minutes";          // "hours"
    /** What happens to the freed spot after the auto-promotion cutoff
     *  passes — reopen to walk-ins / keep the waitlist order / leave
     *  the spot unfilled. */
    after_cutoff_mode: "reopens_first_come" | "keep_auto_promoting" | "stays_empty";
}

// ─── Booking Rules — Cancellation & no-show policies (PRD 11 §6.1) ────────

/** Outcome dropdown option for the credit/package cancel-window rows
 *  in the Cancellation policy side panel (Figma 7631:404757). */
export type CancellationOutcome = "credit_returned" | "credit_forfeited";

/** v26 — Single studio-wide cancellation policy record. Replaces the
 *  legacy per-row list (Add/Edit/Delete) with one config editable via
 *  a side panel that mirrors the Referral module chrome.
 *
 *  Structure per Figma 7631:404757 / 7714:17240:
 *    • Credit & package members — 2 cancel-window rows (before vs
 *      within-or-no-show), each pairs a window value with a
 *      CancellationOutcome.
 *    • Membership members — 2 independent toggle cards (late-cancel
 *      fee AED + no-show fee AED), each active when the toggle is on.
 *    • Applies to — two multi-selects (packages + classes). The
 *      policy only fires when the booking's product is in the
 *      selected list; other bookings use the studio default (no
 *      penalty). Empty arrays = "applies to nothing" (feature paused). */
export interface CancellationPolicy {
    id: string;                                   // "cancellation_policy_default"

    // ── Credit & package members ──────────────────────────────────────
    /** Cancel window BEFORE class start — customers get the outcome
     *  below when they cancel within this many hours/minutes of the
     *  class start. Figma default: 12 hours → Credit returned. */
    credit_before_window_value: number;
    credit_before_window_unit: "hours" | "minutes";
    credit_before_outcome: CancellationOutcome;
    /** Cancel window WITHIN the free-cancel period OR no-show —
     *  outcome when the customer cancels too late or doesn't show
     *  up. Figma default: 12 hours → Credit forfeited. */
    credit_within_window_value: number;
    credit_within_window_unit: "hours" | "minutes";
    credit_within_outcome: CancellationOutcome;

    // ── Membership members (no credit to forfeit) ────────────────────
    /** Gate for the two membership-fee toggles below. When OFF, the
     *  late-cancel + no-show fee toggles are locked OFF (disabled in
     *  the UI, ignored at dispatch time) — unlimited members can
     *  cancel freely without a fee. When ON, the studio charges a
     *  penalty only AFTER the customer's LIFETIME late-cancel +
     *  no-show count crosses the threshold below. Client feedback
     *  Jul 2026 — see Figma 7631:454486 (off) + 7790:27893 (on). */
    membership_penalty_after_cancellations_enabled: boolean;
    /** Lifetime late-cancel + no-show count that must be crossed
     *  before the penalty starts charging. Figma default: 3. */
    membership_penalty_after_cancellations_count: number;
    /** Charge a late-cancel fee for unlimited-plan members? Gated by
     *  `membership_penalty_after_cancellations_enabled` — the toggle
     *  can only be flipped ON while the penalty gate is ON. */
    membership_late_cancel_fee_enabled: boolean;
    membership_late_cancel_fee_aed: number;         // 50
    /** Charge a no-show fee for unlimited-plan members? Same gate
     *  as the late-cancel fee above. Can differ in AED. */
    membership_no_show_fee_enabled: boolean;
    membership_no_show_fee_aed: number;             // 70

    // ── Applies to (Figma 7631:455367) ───────────────────────────────
    /** Package products the policy applies to (memberships +
     *  class-packages). FK → memberships.id ∪ packages.id. */
    applied_to_package_ids: string[];
    /** Class template ids the policy applies to. FK → class_templates.id. */
    applied_to_class_template_ids: string[];

    /** Cancellation reasons — single source of truth for the reason dropdown
     *  in BOTH the admin cancel-plan modal AND the customer-portal cancel
     *  sheet. Edit here in Booking rules → Cancellation policy panel; changes
     *  flow to both surfaces on the same render. When the list is empty (all
     *  deleted or all unchecked), the dropdown is hidden and the plan can be
     *  cancelled without picking a reason (mirrors freeze policy behaviour).
     *  Shape reused from FreezeReason — same { id, label, enabled }. */
    cancellation_reasons: FreezeReason[];
}

// ─── Freeze Policy (customer settings) ─────────────────────────────────────

/** A single freeze reason a member can pick when pausing a membership.
 *  `enabled` false → hidden from the customer's reason list. */
export interface FreezeReason {
    id: string;
    label: string;
    enabled: boolean;
    /** v2 — Per-reason overrides that bypass one or more of the base
     *  policy limits when a member picks THIS reason (client 2026-07-20,
     *  Figma "3 exceptions ▾" expander).
     *
     *  All three flags default undefined = follow the base policy.
     *  Consumers apply these at freeze-eligibility check time. */
    exceptions?: {
        /** When true, this reason bypasses the policy's maximum freeze
         *  duration — the customer's date-range picker allows any
         *  duration (up to a hard system max of 12 months). Figma:
         *  "ignores the 30-day cap". */
        ignoresMaxDuration?: boolean;
        /** When true, this freeze doesn't count against the
         *  `max_freezes` limit for the calendar year. Figma: "ignores
         *  2 / 12 months". */
        ignoresFreezeLimit?: boolean;
        /** When true, no freeze fee is charged for this reason, even
         *  if `fee_enabled` is on. Figma: "if a fee is enabled". */
        waivesFee?: boolean;
    };
}

/**
 * Studio-wide freeze policy — governs how members self-serve MEMBERSHIP
 * freezes on the customer side. Single record per studio (client flipped from
 * per-branch to studio-level Jul 2026 — matches how `cancellation_policy` and
 * `classes_settings` are stored). Admin freeze/unfreeze is a full override
 * and ignores this. See new-prd/freeze-policy-implementation-plan.md.
 */
export interface FreezePolicy {
    /** Singleton identifier — "freeze_policy_default". Matches the pattern
     *  used by `cancellation_policy` + `classes_settings` (single record). */
    id: string;
    /** Master toggle — when OFF the customer Freeze action is hidden. */
    enabled: boolean;

    // ── v2 — Billing during a freeze (client 2026-07-20) ────────────
    /** How the billing schedule reacts when a plan is frozen.
     *
     *  `pause` (Recommended — Option A in the Figma):
     *    Payment date + renewal date shift by the freeze length.
     *    Members pay full price and skip nothing.
     *
     *  `stay_on_schedule` (Option B):
     *    Members keep their usual payment date. The next charge is
     *    reduced by the frozen days (prorated).
     *
     *  Consumed by `computeNextCharge` in Phase 5. UI on the customer
     *  Freeze sheet discloses which one is active before confirming. */
    billing_behavior: "pause" | "stay_on_schedule";

    // ── v2 — Who can freeze (client 2026-07-20) ─────────────────────
    /** Who is allowed to initiate a freeze:
     *   `members_and_admins`: members freeze from their account; staff
     *     can always freeze from the customer profile.
     *   `members_request_admins_approve`: member submits a request;
     *     the plan enters `freeze_requested` state until an admin
     *     approves or rejects.
     *   `admins_only`: members don't see the Freeze CTA on the
     *     customer app; only staff can freeze from the profile. */
    who_can_freeze:
        | "members_and_admins"
        | "members_request_admins_approve"
        | "admins_only";

    // ── v2 — Limits (client 2026-07-20) ─────────────────────────────
    /** Minimum freeze length (ALWAYS enforced — no on/off toggle).
     *  Prevents 1-day pauses that would be gamed for a small bill
     *  adjustment. Default 7 days per Figma. */
    min_duration_value: number;
    min_duration_unit: "days" | "weeks" | "months";
    /** Cap the freeze length. When OFF, no maximum is enforced. */
    max_duration_enabled: boolean;
    max_duration_value: number;
    max_duration_unit: "days" | "weeks" | "months";
    /** Cap how many times ONE membership can be frozen inside a given
     *  window. When OFF, unlimited freezes. Client 2026-07-22 flipped
     *  the default window from "calendar year" (resets Jan 1) to
     *  "rolling 12 months" (counts every freeze in the trailing
     *  365 days) — matches the Figma rendering + is the industry
     *  standard for membership freezes. The migration in store.ts
     *  rewrites any pre-existing `calendar_year` seed to `rolling_12m`
     *  on rehydrate. */
    limit_freezes_enabled: boolean;
    max_freezes: number;
    /** Window `max_freezes` counts against. `rolling_12m` looks at
     *  `CustomerPlan.freezeHistoryISO` entries in the trailing 365
     *  days; `calendar_year` is a legacy value the migration replaces
     *  but the type keeps for backwards compatibility. */
    max_freezes_period: "rolling_12m" | "calendar_year";

    /** Charge a fee to freeze. `recurring` = per billing cycle while frozen;
     *  `one_time` = charged once at freeze time. Amount in AED. */
    fee_enabled: boolean;
    fee_type: "one_time" | "recurring";
    fee_amount_aed: number;

    // ── v2 — Freeze reasons (client 2026-07-20) ─────────────────────
    /** When ON, members must pick from the enabled reasons below; when
     *  OFF a freeze needs no reason.
     *
     *  Renamed from `allow_exceptions` in v2 — same semantics, clearer
     *  label. Persist migration in store.ts's onRehydrateStorage
     *  carries the old field through so existing seeded snapshots
     *  don't lose their configuration on the version bump. */
    require_reason: boolean;
    reasons: FreezeReason[];

    /** Which memberships the policy covers. "specific" → only membership_ids
     *  can be frozen; the rest are treated as freeze-disabled. */
    apply_to: "all" | "specific";
    /** FK → memberships.id — used when apply_to === "specific". */
    membership_ids: string[];
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
    // ── Marketing preferences (customer-detail "Details" tab) ────────────
    //
    // Two orthogonal axes captured in Figma 7748:61474:
    //
    //   1. CHANNELS — which delivery channels the customer opts into for
    //      marketing content. Mirrors the admin Customer notifications
    //      module's channel matrix (Email · WhatsApp · SMS · Push).
    //   2. TOPICS   — which marketing content types they want to hear
    //      about. Mirrors the admin "Marketing & promotions" notification
    //      category rows one-for-one (studio_announcements,
    //      new_class_launch, special_offers, promo_code_offers).
    //
    // A marketing message is delivered only when BOTH the topic is opted
    // in AND at least one channel is opted in — the customer-side portal
    // and admin's dispatch layer will read this pair when the two-way
    // wiring lands. For now these fields are display-only on the admin
    // Details tab; the customer-facing prefs UI + dispatch join land in
    // a later phase.
    marketing_channel_email?: boolean;
    marketing_channel_whatsapp?: boolean;
    marketing_channel_sms?: boolean;
    marketing_channel_push?: boolean;
    marketing_topic_studio_announcements?: boolean;
    marketing_topic_new_class_launch?: boolean;
    marketing_topic_special_offers?: boolean;
    marketing_topic_promo_code_offers?: boolean;
    /** Emergency contact captured at sign-up. */
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relation?: string;
    /** Personal referral code the customer shares — shown on the Referrals tab. */
    referral_code?: string;
    // ── Reports v33 fields (Customer Data report) ────────────────────────
    //
    // Populated on the seed so the Customer Data report renders complete
    // per Excel spec. Optional so legacy rows without them keep working —
    // the report renders "—" via the shared formatCell() when missing.
    /** Date of the customer's FIRST-ever visit. Distinct from `last_visit_iso`.
     *  Drives the Customer Data report's "First visit date" column. */
    first_visit_iso?: string;
    /** How the customer was originally acquired (e.g. "Instagram", "Referral",
     *  "Walk-in", "Website"). Drives Customer Data "Marketing source" +
     *  Acquisition Efficiency attribution. */
    marketing_source?: string;
    /** What entry path converted them into a paying member: "first-visit",
     *  "intro-offer", "trial-class". Drives Customer Data "Converted from". */
    converted_from?: "first-visit" | "intro-offer" | "trial-class" | "referral";
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
    /** LEGACY — Bonus class credits the referrer earned from this referral.
     *  Preserved for back-compat; new rows should set `benefit_type` +
     *  `benefit_amount` instead. When `benefit_type` is set, the runtime
     *  adapter ignores this field. */
    benefit_credits: number;
    /** Reward kind stamped at referral-creation from the live
     *  `referral_settings.referrer_earn_type`. Determines how each row
     *  is aggregated in the Referrals tab's "Rewards earned" card and
     *  how the row's Benefit cell reads:
     *    • `free_credits`  → "N credits"
     *    • `wallet_credit` → "AED N"
     *    • `discount`      → deferred — not surfaced in the prototype yet.
     *  Optional so legacy rows without a type still load; the runtime
     *  adapter treats undefined as `free_credits` (preserves the pre-v56
     *  behaviour where every row was implicitly class credits). */
    benefit_type?: ReferralRewardTypeSeed;
    /** Numeric amount matching `benefit_type` — count of class credits
     *  when `free_credits`, AED amount when `wallet_credit`. Optional so
     *  legacy rows still load; the adapter falls back to
     *  `benefit_credits` when unset. */
    benefit_amount?: number;
    /** ISO 8601 — when the referred person signed up via the link. */
    referred_at: string;
    /** ISO 8601 — when the earned reward expires. Computed at create
     *  time as `referred_at + referral_settings.earned_reward_expiry_days`.
     *  Optional so legacy seeds without an explicit expiry still load. */
    expires_at?: string;
    /** v25 — Branch the credits are locked to (per the "Credits
     *  redeemable across all branches" toggle in Settings → Referral).
     *  Captured at referral-creation time from the REFERRER's
     *  `customers.branch_id`. When
     *  `referral_settings.credits_redeemable_all_branches === false`,
     *  the credits can only be redeemed at THIS branch. When the
     *  toggle is on, this field is informational — kept on record so
     *  a future toggle flip retroactively restricts existing rows.
     *  Optional so legacy seeds without a captured branch still
     *  load; the gate helper treats undefined as "no restriction". */
    origin_branch_id?: string;
    // ── Reports v33 fields (Referral Report + Win-back) ──────────────────
    /** Win-back campaign that targeted the referrer / lapsed member. Used
     *  for both the Referral Report's revenue-attribution column and the
     *  Win-back report's "Campaign" column. */
    campaign?: string;
    /** Y/N — whether the lapsed customer came back. When Y, the row also
     *  populates reactivation_date + new_plan_id + revenue_recovered.
     *  Used ONLY by the Win-back report. */
    reactivated?: boolean;
    /** ISO 8601 — when the lapsed member reactivated (Win-back report). */
    reactivation_date?: string;
    /** Plan id the reactivation purchase was for (Win-back). */
    new_plan_id?: string;
    /** Revenue booked at reactivation (Win-back's "Revenue recovered" col). */
    revenue_recovered_aed?: number;
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
    /** v24: split into 3 terminal states. Legacy `"unsigned"` in v23
     *  seeds maps to `"never_signed"` on the persist bump. */
    status: "signed" | "re_accept_due" | "never_signed";
    /** ISO 8601 — when the customer signed. Omitted while
     *  `never_signed`. Present for `signed` and `re_accept_due` (in
     *  the latter case, it points to the LAST-signed older version's
     *  timestamp). */
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
    // ── Reports v33 fields (Memberships & Packages + Intro Offers + Revenue Recognition) ──
    /** Total credits included in the plan (packages + intro offers).
     *  Memberships with unlimited access → 0. Excel spec's "Total credits"
     *  column. */
    total_credits?: number;
    /** Credits consumed to date. `total_credits - credits_used` produces
     *  the Memberships & Packages "Credits remaining" column + Intro
     *  Offers "Sessions used" column + Revenue Recognition "Used this
     *  period" for packages. */
    credits_used?: number;
    /** Whether the plan auto-renews at term end. Memberships default Y,
     *  packages default N. Feeds Memberships & Packages "Auto-renew". */
    auto_renew?: boolean;
    /** Amount due at next renewal. For memberships this equals `price_aed`;
     *  for expired/cancelled it's 0. Feeds "Next billing amount". */
    next_billing_amount_aed?: number;
    /** Display "Allowance" string — "Unlimited", "10 credits", "5 sessions".
     *  Feeds the Memberships & Packages "Allowance" column. */
    allowance?: string;
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
    /** Product type bought — drives the "Plan type" column + filter.
     *  `cancellation_penalty` was added Jul 2026 for the unlimited-
     *  membership cancellation-penalty flow (Figma 7790:27893). It
     *  represents a fee CHARGED (not a purchase); such rows are
     *  always flagged `is_refundable: false` per client spec.
     *  `freeze_fee` (Jul 2026) is the membership-freeze fee charged when
     *  a customer freezes under a policy that sets a fee — also a fee
     *  CHARGED, non-refundable. */
    kind: "membership" | "package" | "cancellation_penalty" | "freeze_fee";
    /** FK → memberships.id / packages.id (depending on `kind`). For
     *  `cancellation_penalty` rows this instead references the
     *  cancelled `class_bookings.id` so Payment history rows can
     *  deep-link back to the booking that triggered the fee. */
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
    // ── Reports v30 ledger fields (2026-07-04 rewrite — all optional so
    //     historical seeds keep loading; existing readers unaffected) ──
    //
    // The reports module treats `customer_transactions` as an honest
    // ledger. Every row's LEDGER KIND is described by `transaction_type`
    // (default = "sale" when omitted, preserving legacy read semantics).
    // Refunds + voids + write-offs live as SEPARATE rows linked back to
    // the original sale via `original_transaction_id`. The refund model
    // is documented in `new-prd/reports-implementation-plan.md` §2.7.
    //
    // Void vs Refund rule:
    //   • Cancel on the SAME date as the sale AND settlement not yet
    //     reached → transaction_type = "void". The reports helper
    //     `resolveLedger` erases BOTH rows from every report — the
    //     original sale is treated as if it never happened.
    //   • Later cancel → transaction_type = "refund". The original sale
    //     stays in its own period; the refund lands as a negative row in
    //     the refund's own date's period. Past months never restate.
    //
    /** Ledger kind — sale / refund / void / write-off. Default (omitted)
     *  is "sale" to preserve legacy row semantics. */
    transaction_type?: "sale" | "refund" | "void" | "write_off";
    /** For refund / void / write_off rows: the id of the sale being
     *  reversed. Blank on regular sales. */
    original_transaction_id?: string;
    /** ISO 8601 — when the payment cleared with the processor. Drives
     *  the void-vs-refund rule (unset OR equal to sale date + same day =
     *  eligible for void). */
    settlement_iso?: string;
    /** Free-text reason recorded on refund (e.g. "membership relocation",
     *  "duplicate charge"). */
    refund_reason?: string;
    /** VAT treatment for tax export report. Default (omitted) = "standard". */
    tax_treatment?: "standard" | "zero_rated" | "exempt" | "out_of_scope";
    /** Staff member who processed the transaction. Blank on self-service
     *  online purchases. */
    staff_id?: string;
    /** Card scheme — Visa / Mastercard / Amex. Only set on card payments. */
    card_type?: "visa" | "mastercard" | "amex";
    /** One-off charge vs recurring subscription charge. Default = "one_off". */
    payment_type?: "one_off" | "recurring";
    /** Why a charge failed (Payments report). */
    failure_reason?: string;
    /** Retry attempt # on a failed recurring charge. */
    retry_attempt?: number;
    /** Whether a failed charge was later recovered on retry. */
    recovered?: boolean;
    /** ISO — when a failed charge recovered. */
    recovered_iso?: string;
    /** Processor payout batch this payment settled in. */
    payout_id?: string;
    /** Processor fee deducted from the payment. */
    processor_fee?: number;
    // ── Reports v33 fields (Discounts + Promo Redemptions) ────────────────
    /** Promo code applied at POS. Feeds Discounts + Promo Redemptions
     *  reports. Blank on transactions without a code. */
    discount_code?: string;
    /** Discount amount in AED (positive number). `amount_aed` is the NET
     *  after discount. Excel spec column "Discount value". */
    discount_value?: number;
    // ── Cancellation-penalty flow (Jul 2026) ──────────────────────────────
    /** Refundability guard on the Payment history table's "Refund
     *  payment" row action. Undefined (legacy default) = refundable.
     *  Explicit `false` = the Refund action is hidden and the store's
     *  `refundTransaction` guard rejects the call. Set to `false` on
     *  every `kind: "cancellation_penalty"` row per client spec:
     *  cancellation penalties are non-refundable. */
    is_refundable?: boolean;
    /** For `kind: "cancellation_penalty"` rows only — which scenario
     *  triggered the fee. Drives the row's display copy on Payment
     *  history ("Late cancellation penalty" vs "No-show penalty"). */
    cancellation_scenario?: "late_cancel" | "no_show";
    /** +later: refund-request approval queue (dashboard Needs-attention).
     *  Set on a still-`complete` row when a member requested a refund that's
     *  awaiting an admin decision. */
    refund_requested_at?: string;
    refund_request_reason?: string;
}

// ─── Wallet transactions (PRD 07 §Wallet — account credit ledger) ───────────
//
// One row per credit / debit against a customer's account-credit (AED)
// balance. The balance is DERIVED (sum of credits − debits) — never stored —
// so it can't drift. Credits come from referral rewards (Account Credit type)
// + manual grants; debits come from POS "Member Wallet" payments + refunds
// to original method. FK: `customer_id` → customers.id.
export interface WalletTransactionSeed {
    /** e.g. "wtxn_ahmed_1" */
    id: string;
    customer_id: string;  // → customers.id
    branch_id: string;    // → branches.id (where the credit/debit originated)
    /** `credit` adds to the balance, `debit` subtracts. */
    type: "credit" | "debit";
    /** Always a positive AED amount; `type` carries the sign. */
    amount_aed: number;
    /** Human-readable reason ("Referral reward", "POS purchase", …). */
    reason: string;
    /** What the entry references, for deep-linking + reconciliation. */
    reference_type?: "referral" | "pos_sale" | "refund" | "manual";
    /** Id of the referenced record (referral id / transaction id / …). */
    reference_id?: string;
    /** ISO 8601 timestamp. */
    created_at: string;
    /** Display name of who created it (staff member / "System"). */
    created_by?: string;
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
    // ── Reports v33 fields (Gift Card report) ────────────────────────────
    /** FK → customer_transactions.id — the sale that purchased this card.
     *  Feeds Gift Card report's "Transaction #" column. */
    transaction_id?: string;
    /** ISO — most recent redemption date. Feeds "Last redeemed date". */
    last_redeemed_at?: string;
    // +later: branch_id
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
    /** book_event → the specific class the CTA books (a `class_schedule.id`).
     *  For `new_class` campaigns the picker is limited to classes in the next
     *  7 days; for `event` campaigns it lists all upcoming classes. Single id. */
    cta_class_id?: string;
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

// ─── Session type dimension (Phase 1 — session-type refactor) ─────────────────

/**
 * The `type` dimension — every bookable/scheduled thing in Onra is exactly
 * one of these three. This is the explicit field that replaces the old
 * scattered signals (`ClassTemplate.location_type`, `ClassSchedule.class_type`,
 * `Service.is_recovery`). See
 * `new-prd/session-type-dimension-implementation-plan.md`.
 *
 *   • "class"    — group session. Comes from a ClassTemplate → ClassSchedule.
 *   • "private"  — 1:1 session.   Comes from a Service      → Appointment.
 *   • "recovery" — spa/wellness.  Comes from a Service      → Appointment.
 *
 * Canonical UI labels: "Classes" · "Private sessions" · "Recovery & wellness".
 */
export type SessionType = "class" | "private" | "recovery";

/** A Service is only ever Private or Recovery — Classes come from templates,
 *  never from a Service. */
export type ServiceType = Extract<SessionType, "private" | "recovery">;

// ─── Services (Appointment services) ──────────────────────────────────────────

/**
 * Service template — the reusable "blueprint" for scheduled appointments.
 * Every Service is `type: "private"` or `type: "recovery"` (Classes come
 * from ClassTemplate, never a Service). Shapes:
 *
 *   • Recovery + Open session — `type="recovery"` + `open_session=true`.
 *     Multi-customer, has capacity. No instructor required. Sauna,
 *     Breathwork, etc.
 *   • Recovery + Private      — `type="recovery"` + `open_session=false`.
 *     1 customer at a time, no instructor. Massage, IV therapy.
 *   • Private                 — `type="private"`. 1 customer + 1
 *     instructor. Private Reformer, Mat Pilates. `open_session` forced false.
 *
 * A service can live at ANY active branch (recovery is no longer pinned to a
 * fake "spa" location); `branch_id` is a plain FK and rooms are optional.
 *
 * Pricing model: services are currency-priced (`price` AED), NOT
 * membership/package-gated. The legacy `applicable_membership_ids` and
 * `applicable_package_ids` fields were dropped — customers pay the fixed
 * price at checkout via the appointment booking flow.
 *
 * +later: instructor_ids (Private services only — pre-pickable
 * instructors for the appointment create flow), appointment-spawn rules.
 */
export interface Service {
    /** e.g. "svc_private_reformer" */
    id: string;
    category_id: string;          // → class_categories.id
    name: string;                 // "Private Reformer"
    description: string;
    /** The session type — "private" (1:1 training) or "recovery"
     *  (spa/wellness). Replaces the old `is_recovery` boolean as part of
     *  the session-type dimension refactor: `is_recovery:true` → "recovery",
     *  `false` → "private". The store still derives a back-compat
     *  `isRecovery` (`type === "recovery"`) so existing consumers keep
     *  working until Phase 2 rewrites them. */
    type: ServiceType;
    /** True = Open session (multi-customer w/ capacity). False = Private
     *  (1 customer). Only meaningful for `type: "recovery"` — a "private"
     *  service always forces this false. */
    open_session: boolean;
    duration_min: number;
    /** Only meaningful when `open_session = true`. Persisted as 0 for
     *  Private services to keep the column shape stable in the future
     *  Postgres schema. */
    capacity: number;
    /** Fixed price in AED. Customer pays this on the appointment booking
     *  checkout (Phase: customer-side checkout still uses subtotal=0 per
     *  current product direction). */
    price: number;
    /** Branch where this service is offered — any active branch. Single-
     *  branch to match the Figma step 3 "select location" single-select;
     *  may widen to a multi-branch array later. */
    branch_id: string;            // → branches.id
    /** Optional default room for this service's appointments — a session may
     *  or may not use a room. Empty / omitted = no room. → rooms.id */
    room_id?: string;
    cover_image_url?: string;
    status: "Active" | "Inactive" | "Archived";
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
    /** Optional — a room is optional for any appointment (private + recovery
     *  sessions may or may not use one). Omitted when the session isn't
     *  room-scoped. The Appointment detail side panel gates the Room subline
     *  on roomName so empty values render cleanly. */
    room_id?: string;              // → rooms.id
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

// ─── Sales commission (categorised) ─────────────────────────────────────────
//
// Client Jul 2026: sales commission moves from the 2 fixed Monthly-rate %
// fields to a categorised model available on ANY pay rate (so instructors
// on flat/hybrid rates can earn class/service commission too).
//   • commission = per-sale % or fixed AED in the category
//   • bonus      = extra AED/% paid once the staff's monthly count in the
//                  category crosses `threshold`
// See new-prd/commission-refactor-implementation-plan.md.

export type CommissionCategory =
    | "membership"
    | "credit_package"
    | "gift_card"
    | "retail"           // stubbed — no retail POS flow yet
    | "class_booking"
    | "service_private"
    | "service_recovery";

export type CommissionValueType = "percent" | "fixed";

export interface PayRateCommissionRowSeed {
    id: string;
    category: CommissionCategory;
    value_type: CommissionValueType;
    /** Percentage when value_type === "percent"; AED when "fixed". */
    value: number;
}

export interface PayRateBonusRowSeed extends PayRateCommissionRowSeed {
    /** Monthly count in the category that must be crossed for the bonus to
     *  fire (e.g. 20 memberships sold in a month). */
    threshold: number;
}

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
    /** Categorised sales commission — available on any rate type. Each row
     *  pays % or fixed AED per sale in its category. */
    commissions?: PayRateCommissionRowSeed[];
    /** Categorised threshold bonuses — extra paid once the monthly count in
     *  the category crosses the row's `threshold`. */
    bonuses?: PayRateBonusRowSeed[];
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
    /** @deprecated Jul 2026 — replaced by `commissions[]` on the base. Kept
     *  optional for backward-compat; new data uses categorised rows. */
    sales_commission_packages_percent?: number;
    /** @deprecated Jul 2026 — replaced by `commissions[]` on the base. */
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
    /** Revenue the studio earned from those classes (AED). Surfaced as
     *  the "Class revenue base" column on the Run Payroll table + CSV
     *  export (reference figure for Split-Rate / revenue-share
     *  calculations, NOT the instructor's take-home). */
    gross_revenue: number;
    /** Earnings before any manual adjustment. */
    base_earnings: number;
    /** + or - AED amount applied during the Run Payroll review step. */
    adjustment_amount: number;
    adjustment_reason?: string;
    /** Final amount: base_earnings + adjustment_amount + commission_amount. */
    total_earnings: number;
    // ── Sales commission (Monthly rate) ─────────────────────────────────────
    // Populated for Monthly-rate staff who sold POS memberships/packages in
    // the period. Snapshotted at payroll-run confirm so historical rows
    // stay stable even if the pay rate's commission % changes later.
    // Optional so pre-commission seeds + non-Monthly rows still load.
    /** AED of package sales attributed to this staff in the period,
     *  net of refunds/voids. */
    commission_packages_sales_aed?: number;
    /** AED of membership sales attributed to this staff in the period,
     *  net of refunds/voids. */
    commission_memberships_sales_aed?: number;
    /** Package commission % applied at run time (snapshot of the rate's
     *  `sales_commission_packages_percent`). */
    commission_packages_percent?: number;
    /** Membership commission % applied at run time (snapshot of the rate's
     *  `sales_commission_memberships_percent`). */
    commission_memberships_percent?: number;
    /** AED commission portion of `total_earnings`. Derived from the four
     *  fields above; kept as a first-class field so the payroll UI can
     *  read it without re-deriving. */
    commission_amount?: number;
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
    /** Number of staff the studio needs on this shift. Compared against
     *  the count of `ShiftAssignment` rows to flag understaffed shifts.
     *  Client 2026-07-22 spec ("assigned / N needed"). Defaults to 1
     *  when the migration backfills a pre-v82 row. */
    staffing_target: number;
    status: ShiftStatusSeed;
    created_at: string;       // ISO 8601
}

// ─── Shift assignment (many-to-many staff ↔ shift) ────────────────────────
//
// Client 2026-07-22 requirement: one staff can hold MULTIPLE shifts, and
// each assignment carries its own subset of the shift's working days
// (so Liam can be on Morning shift Mon-Sat AND Afternoon shift Tue+Thu).
// The seed derives this table from every `Staff.shift_id` at boot
// (default `days_of_week = shift.working_days`); the migration in
// `onRehydrateStorage` does the same for any pre-v82 persisted store.

export interface ShiftAssignment {
    /** e.g. "sa_shift_morning_maya" — derived deterministically from the
     *  shift + staff ids at boot so the same pair always resolves to the
     *  same assignment row on re-hydrate. */
    id: string;
    /** FK → shifts.id */
    shift_id: string;
    /** FK → staff.id */
    staff_id: string;
    /** 7-bit array [Sun..Sat] — SUBSET of the parent shift's
     *  `working_days`. Defaults to the shift's full working_days when
     *  the row is created; admins narrow from the shift's expanded
     *  row on the list. */
    days_of_week: boolean[];
    created_at: string;       // ISO 8601
}

// ─── Time off (Staff & shift module — was "Blocked time") ─────────────────
//
// Renamed from `blocked_time` to `time off` per client 2026-07-22 —
// "it's people being away, not calendar admin". The type name
// `BlockedTime` is preserved for back-compat with import paths + store
// action signatures, but the fields + semantics moved to the "time off"
// model:
//
//   • Every entry spans a DATE RANGE (was single-day). `date_from_iso`
//     and `date_to_iso` bracket the range; a single-day off still writes
//     the SAME ISO to both.
//   • `all_day` flag — when true, `start_time`/`end_time` are ignored
//     (a vacation isn't 09:00–17:00; it's the whole day, potentially
//     spanning multiple days).
//   • `reason` is a fixed category (Sick / Vacation / Training / Other) —
//     drives payroll classification + widget grouping. `note` is now
//     free-text on the "Other" branch only, and optional context for
//     the fixed categories.
//   • Legacy `date` column KEPT for back-compat during migration + as a
//     denorm of `date_from_iso` (store rehydrate mirrors them). Existing
//     consumers reading `.date` continue to work.
//   • Rules unchanged: `staff_ids` is multi-select; `branch_id` is a
//     denormed convenience for the branch filter.

export type TimeOffReason = "sick" | "vacation" | "training" | "other";

export interface BlockedTime {
    /** e.g. "blocked_2025_03_18". Legacy id scheme kept so existing
     *  seeded ids stay valid. New entries use "time_off_*". */
    id: string;
    /** Optional label — leave blank for a generic block. */
    title: string;
    /** Legacy single-day column — mirrors `date_from_iso` for callers
     *  that haven't migrated yet. */
    date: string;             // "2025-03-18"
    /** Range start (inclusive). "YYYY-MM-DD". Client 2026-07-22. */
    date_from_iso: string;
    /** Range end (inclusive). Equal to `date_from_iso` for single-day
     *  entries. Client 2026-07-22. */
    date_to_iso: string;
    /** When true, the entry runs from 00:00 → 23:59 across the whole
     *  range (`start_time`/`end_time` ignored). Client 2026-07-22. */
    all_day: boolean;
    start_time: string;       // "13:00"
    end_time: string;         // "14:00"
    /** Reason category — Sick / Vacation / Training / Other. Drives
     *  payroll reporting + the reason chip on the list. Client
     *  2026-07-22. */
    reason: TimeOffReason;
    /** Free-text reason / context. Required only when `reason === "other"`;
     *  optional context otherwise. Empty string when unused. */
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

// ─── Customer notification settings (PRD 11 §12 — v27 redesign) ───────────

export type NotificationCategorySeed =
    | "booking"
    | "payment"
    | "package_membership"
    | "marketing"
    | "referral";

/** WhatsApp Business template approval status per Meta's workflow.
 *  Templates must be approved by Meta before they can be dispatched.
 *  Editing the message body resubmits to Pending; rejection returns a
 *  short reason the admin surfaces in the red banner. Seeded per
 *  template row so the demo shows realistic Approved / Pending /
 *  Rejected states out of the box. */
export type WhatsappApprovalStatusSeed = "approved" | "pending" | "rejected";

/** When a customer notification fires. `immediately` = dispatch on
 *  event trigger; `scheduled` = one or more offsets ahead of the
 *  trigger (e.g. class-reminder 24h + 2h before class start). Empty
 *  `send_offsets` array is treated as "immediately" for safety. */
export type NotificationSendModeSeed = "immediately" | "scheduled";

/** Repeatable send-offset row. Unit is "minutes" | "hours" | "days"
 *  per the Figma unit dropdown; matching landing summary format
 *  compacts to "30m" / "24h, 2h". */
export interface NotificationSendOffsetSeed {
    value: number;
    unit: "minutes" | "hours" | "days";
}

/** Single-record delivery window that all customer notifications
 *  respect (unless the template is marked critical + the "critical
 *  bypass" toggle is on). Drives the "Quiet hours 21:00-08:00" pill
 *  + "Delivery hours" side-panel on the notifications landing. */
export interface NotificationDeliverySettingsSeed {
    id: string;                              // "notification_delivery_default"
    /** Master switch. When OFF the quiet-hours pickers gray out and no
     *  window is enforced. When ON, notifications outside the quiet
     *  hours pause + queue until the window reopens. */
    only_send_during_set_hours: boolean;
    /** 24h-style clock time "HH:MM" (start of the quiet window). */
    quiet_hours_start: string;
    /** 24h-style clock time "HH:MM" (end of the quiet window). May be
     *  before start (wrapping midnight — e.g. 21:00 → 07:00). */
    quiet_hours_end: string;
    /** When ON (Figma default), payment failures / confirmations /
     *  refunds dispatch immediately regardless of quiet hours. */
    critical_bypasses_quiet_hours: boolean;
}

// ─── Referral settings (PRD 11 §11 — redesigned per Figma 4620:151863) ─────

/** Legacy trigger enum kept for backward-compat imports — superseded by
 *  `ReferralUnlockTriggerSeed` below. New code should reference the new
 *  enum directly. */
export type ReferralTriggerSeed = "sign_up" | "purchase";

/** Rewards unlock trigger per Figma 7661:54592 — see the camelCase mirror
 *  `ReferralUnlockTrigger` in store.ts for prose-level descriptions. */
export type ReferralUnlockTriggerSeed =
    | "friend_signup"
    | "friend_first_purchase"
    | "friend_first_class";

/** What the referrer / friend earn — Figma's dropdown defaults to
 *  Free credits but ships union-typed so future rewards (wallet credit
 *  / discount / etc.) plug in without reshape. */
export type ReferralRewardTypeSeed = "free_credits" | "wallet_credit" | "discount";

export interface ReferralSettingsSeed {
    program_active: boolean;
    // ── Reward rules & limits ──
    referrer_earn_type:        ReferralRewardTypeSeed;
    referrer_earn_amount:      number;
    friend_earn_type:          ReferralRewardTypeSeed;
    friend_earn_amount:        number;
    reward_unlock_trigger:     ReferralUnlockTriggerSeed;
    max_referrals_per_member:  number;
    earned_reward_expiry_days: number;
    monthly_program_budget_aed: number;
    // ── Eligibility & fraud controls ──
    prevent_self_referral:           boolean;
    new_customers_only:              boolean;
    min_first_spend_aed:             number;
    credits_redeemable_all_branches: boolean;
    // ── Customize information ──
    info_title:       string;
    info_description: string;
}

/** One row per customer-facing notification event. Drives the per-channel
 *  toggles + template editor on Settings → Customer notifications (v27
 *  redesign per Figma 7745:26872). Every field the UI reads or writes
 *  is captured on this row — the store hydrates directly, no adapter. */
export interface NotificationSettingSeed {
    id: string;
    category: NotificationCategorySeed;
    /** Stable enum key — used by code that fires the notification. */
    notification_type: string;
    /** Display label in the row. */
    label: string;

    // ── Channel switches (Email / WhatsApp / SMS — the 3 row toggles) ─
    email_enabled:    boolean;
    whatsapp_enabled: boolean;
    /** v27 — SMS channel. Replaces the legacy `push_enabled` toggle
     *  (Figma dropped Push from the customer notifications matrix in
     *  favour of SMS, which real gyms in the UAE use as a fallback
     *  when WhatsApp / email are patchy). */
    sms_enabled:      boolean;

    // ── Template fields (set in the Edit template modal tabs) ─────────
    email_subject?:    string;
    email_template?:   string;
    whatsapp_template?: string;
    /** v27 — SMS message body. Plain text, 160-char SMS unit counter
     *  in the SMS tab. Variables in `{curly_braces}` resolve at
     *  send time. */
    sms_template?:     string;

    // ── WhatsApp Business template approval workflow ──────────────────
    /** Meta approval state. Editing the message body resubmits to
     *  Pending; approved-but-then-edited templates flip back to
     *  Pending (real WA behaviour). Rejected templates fall back to
     *  another enabled channel until fixed + resubmitted. */
    whatsapp_approval_status:    WhatsappApprovalStatusSeed;
    /** Short reason surfaced in the red banner when
     *  whatsapp_approval_status === "rejected". Kept optional so the
     *  vast majority (approved) rows don't need to define it. */
    whatsapp_rejection_reason?:  string;

    // ── Payment critical flag ─────────────────────────────────────────
    /** When true the row shows a "Critical" pill + tooltip, and the
     *  toggle-off refuses to flip the LAST enabled channel — at least
     *  one delivery method must stay live so payment issues always
     *  reach the customer. Seeded true for every payment row. */
    is_critical: boolean;

    // ── Send timing (Figma 7738:102822 / 7739:167412 / 7739:168559) ───
    /** "Immediately" or "scheduled". When scheduled the send_offsets
     *  list controls the schedule (fires once per offset before the
     *  event, e.g. Class reminder 24h + 2h ahead). */
    send_mode: NotificationSendModeSeed;
    /** Offsets BEFORE the event trigger (Class reminder = 24h, 2h).
     *  Empty array + send_mode === "scheduled" treated as
     *  "immediately" so the UI doesn't break mid-edit. */
    send_offsets: NotificationSendOffsetSeed[];

    // ── Marketing-only display flag ──────────────────────────────────
    /** When true the landing shows a "Sent during campaigns" pill in
     *  the Send time column instead of the timing summary. Seeded
     *  true for every row in the `marketing` category — those don't
     *  fire on a per-customer trigger, they piggy-back the campaign
     *  send. Read-only for the demo (admin can't toggle it). */
    sent_during_campaigns?: boolean;

    // ── Recipient targeting (Jul 2026 — gift-card purchase) ───────────
    /** Who receives the notification when this event fires.
     *  `"customer"` (default when omitted) = the customer tied to
     *  the source event, e.g. the buyer on a payment confirmation.
     *  `"gift_card_recipient"` = the RECIPIENT stored on the
     *  IssuedGiftCard row (`recipient_name` + `recipient_email`),
     *  used only by the "Gift card purchase" event so the person
     *  receiving the gift card gets the redemption code, not the
     *  buyer. Consumers (future dispatch layer) branch on this
     *  field to resolve `to_email` / `to_phone`. */
    recipient_source?: "customer" | "gift_card_recipient";

    // ── Per-branch marketing overrides (client 2026-07-20) ────────────
    /** Optional branch scope. When omitted (the common case), this row
     *  is the studio-wide DEFAULT for its notification_type. When set,
     *  the row is an OVERRIDE for the named branch of the SAME
     *  notification_type — the branch inherits the parent's identity
     *  (label, category) but overrides its channel toggles + templates
     *  + timing.
     *
     *  Look-up rule at dispatch time: for a given (notification_type,
     *  branch_id), pick the row whose branch_id === request.branch_id
     *  if one exists, else fall back to the row with no branch_id
     *  (the studio-wide default).
     *
     *  Only meaningful on rows in the `marketing` category — that's
     *  the surface the "+ Branch overrides" expander is exposed for.
     *  Every other category stays studio-wide by convention. */
    branch_id?: string;
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
    | "blocked_time_removed"     // admin deleted a blocked-time entry
    // ── Freeze policy v2 (client 2026-07-20) ─────────────────────────
    //    Fired when a customer freezes their own membership or when a
    //    freeze auto-resumes at end-date. Admin bell rows surface to
    //    the studio so they know a member paused / unpaused their plan.
    | "membership_frozen"        // customer self-freeze started
    | "membership_reactivated";  // auto-resume swept a freeze back to active

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

/** Top-level tax tab the rate belongs to:
 *    • "vat"    — sales tax / VAT charged on products + services. Default.
 *    • "income" — withholding / payroll tax applied to staff pay rates.
 *  Drives the VAT vs Income tax top-level tabs on /admin/settings/tax. */
export type TaxRateKindSeed = "vat" | "income";

/** Tax-rate behaviour per Figma 5006:106235 (Add new tax rate modal):
 *    • "default"     — Standard rate, applies a configurable % to the line.
 *    • "zero_rated"  — 0% applied but the transaction is still taxable
 *                       (the customer sees "0% tax" on the receipt). Useful
 *                       for exported services that must remain on the
 *                       tax record but carry no charge.
 *    • "exempt"      — NOT subject to tax. No rate, no line on the receipt.
 *  Drives the Tax rate column on the list (Standard %, 0%, "—") and the
 *  conditional Tax rate input on the create modal. */
export type TaxRateTypeSeed = "default" | "zero_rated" | "exempt";

/** One row per configured tax rate. Lives in /admin/settings/tax → Tax rates
 *  list. Each row gets applied to one or more product categories via
 *  `tax_rules` in Phase 3 — the `usage_count` shown in the row-action
 *  Delete↔Deactivate swap is derived live from that join.
 *
 *  FK: `memberships.tax_rate_id` / `packages.tax_rate_id` /
 *      `gift_card_designs.tax_rate_id` / `pay_rates.tax_rate_id` →
 *      `tax_rates.id`. */
export interface TaxRateSeed {
    id: string;
    name: string;
    /** Required for `type="default"` (admin enters a %). 0 for
     *  `type="zero_rated"`. Omitted/0 for `type="exempt"` — the rate
     *  has no charge so callers must use the `type` flag, not the
     *  numeric value, when deciding whether to apply tax. */
    rate_percentage: number;
    /** VAT vs Income tax bucket. Drives the top-level tabs on the Tax
     *  settings page + filters Apply tax rate eligibility (income-tax
     *  rates can only attach to `pay_rate` rules, VAT rates to
     *  membership/credit_package/appointment/gift_card rules). */
    kind: TaxRateKindSeed;
    /** Standard / Zero-rated / Exempt — see TaxRateTypeSeed. */
    type: TaxRateTypeSeed;
    description?: string;
    /** Per-rate override of the global `prices_include_tax` toggle. */
    calculation_mode: TaxCalculationModeSeed;
    status: TaxRateStatusSeed;
    created_at: string;
    // ── Effective window (client-feedback fix — Figma 7769:118654) ──────
    // A rate's charge only applies between `valid_from` (inclusive) and
    // `valid_until` (inclusive). Both are ISO `YYYY-MM-DD` strings.
    //
    //   • Both set   → definite window, list shows "DD/MM/YYYY - DD/MM/YYYY"
    //   • Only from  → open-ended future, list shows "DD/MM/YYYY - Ongoing"
    //   • Only until → applied retroactively up to date (rare)
    //   • Neither    → rate has no time constraint, list shows "—"
    //
    // Enforcement (Phase 4): POS / product / payroll tax lookups must
    // pick the ACTIVE rate at the transaction date — a rate whose window
    // doesn't cover the sale date must not apply. For now the fields are
    // captured + displayed only.
    valid_from?: string;
    valid_until?: string;
}

/** Per-invoice rounding strategy for the tax line on a multi-line cart:
 *    • "per_line"    — round each line's tax independently then sum (default;
 *                       larger carts may show 1-2 fil rounding drift but
 *                       every line on the receipt reads cleanly).
 *    • "per_invoice" — sum the subtotal first, then compute + round tax
 *                       once. Per-line receipt entries show un-rounded
 *                       intermediate values; the invoice total is the
 *                       only rounded number.
 *  Drives the Tax calculation & rounding radio on Figma 5006:73920. */
export type TaxRoundingModeSeed = "per_line" | "per_invoice";

/** Studio-wide tax settings. Currently a single row — modelled as an
 *  interface so future fields (`apply_to_all_products_by_default`, etc.) can
 *  land here without breaking the store shape. */
export interface TaxSettingsSeed {
    /** Global default — when true, all prices already include tax (PRD §10.1
     *  "Tax inclusive"). When false, tax is added at checkout. */
    prices_include_tax: boolean;
    /** Per-line vs per-invoice rounding — see TaxRoundingModeSeed. */
    rounding_mode: TaxRoundingModeSeed;
    /** Tax Registration Number (TRN) — the studio's VAT registration id
     *  with the local tax authority (UAE FTA / equivalent). Surfaced on
     *  every tax invoice when `display_trn_on_invoice` is on. Optional
     *  (a brand-new studio might not have one issued yet). Free-text
     *  15-digit UAE format by convention but not enforced in the
     *  prototype. */
    trn?: string;
    /** Country whose tax authority issued this TRN. Stored as the
     *  full country name (matches `Country.name` in
     *  `src/lib/data/locales.ts`) so the UI can look up the flag +
     *  code without a translation table. Defaults to the studio's own
     *  country when a TRN is first added. */
    trn_country?: string;
    /** Toggle for the "Display tax registration in invoice" row
     *  (Figma 7769:106370). When true, the TRN prints on every
     *  customer invoice + receipt. When false, invoices omit it (used
     *  by studios below the VAT registration threshold). */
    display_trn_on_invoice?: boolean;
}

// ─── Tax rules (Apply tax rates tab — PRD 11 §10.4 / Phase 3) ────────────────

/** Which product category a tax rule applies to. The Apply tax rates tab
 *  groups these under TWO parent buckets in the UI:
 *
 *    Services (VAT tab):
 *      • "membership"     — Membership product sales
 *      • "credit_package" — Credit/class package sales
 *      • "appointment"    — Appointment service bookings (post-Module-13
 *                            currency-priced services). New for Figma
 *                            5006:73920 / 5041:99307.
 *    Gift card (VAT tab):
 *      • "gift_card"      — Renders as "Tax at redemption" — gift card
 *                            sales are stored-value transfers (no tax at
 *                            purchase); tax applies when the card is
 *                            redeemed on a taxable category above.
 *    Pay rate (Income tax tab):
 *      • "pay_rate"       — Withholding on staff pay. Moves to the
 *                            Income tax tab in the new design — VAT and
 *                            Income tax are kept separate so admins can
 *                            mix the two without cross-pollination. */
export type TaxRuleCategorySeed =
    | "membership"
    | "credit_package"
    | "appointment"
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
    /** v24 — Effective dates mode from Step 2 (Figma 7703:13587 /
     *  7703:13751). "ongoing" ignores the date fields; "expiry"
     *  requires both `effective_from` and `effective_until`.
     *  Optional on this type so legacy v23 seeds still typecheck —
     *  the store adapter derives a fallback when omitted. */
    effective_dates_mode?: "ongoing" | "expiry";
    /** Rules step — Issued date (locked to today at creation, ISO 8601).
     *  Empty string when `effective_dates_mode` is "ongoing". */
    effective_from: string;
    /** Rules step — Expiry date (must be ≥ today at creation, ISO 8601).
     *  Empty string when `effective_dates_mode` is "ongoing". */
    effective_until: string;
    /** v24 — When true, customers with a signed row on a previous
     *  version are prompted to re-accept the latest version before
     *  their next booking. Wired via `republishAgreementVersion` +
     *  `addAgreementVersion` in the store. Optional so legacy seeds
     *  default to `false`. */
    require_re_acceptance?: boolean;
    /** v24 — When true, customers under 18 are routed to a
     *  guardian-signature flow before booking. Optional so legacy
     *  seeds default to `false`. */
    require_guardian_consent?: boolean;
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
 *  correct per-tool Connect / View modal in Phase 2.
 *
 *  Category is derived from the slug (see `integrationCategoryFor` in the
 *  Integrations module) — keeps the data shape stable and avoids a
 *  separate column that could drift out of sync. */
export type IntegrationSlugSeed =
    // Calendar
    | "google_calendar"
    | "apple_calendar"
    | "outlook_microsoft365"
    // Marketing & communication
    | "whatsapp_business"
    | "mailchimp"
    | "instagram_meta"
    // Analytics & accounting
    | "google_analytics"
    | "xero";

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
    | "cards"
    | "apple_pay"
    | "google_pay"
    | "cash"
    | "bank_transfer";

/** "gateway"  — top-level payment processor (Stripe). Connects directly.
 *  "wallet"   — Apple Pay / Google Pay / Cards. Always nested under a
 *               gateway — requires the gateway to be connected before it
 *               can be enabled. Disconnecting the gateway cascades and
 *               disables every wallet that depended on it.
 *  "manual"   — Cash / Bank transfer. Standalone toggle, no gateway
 *               dependency. Per Figma 7564:188282, these live in a
 *               separate "Other methods" group below the gateway block. */
export type PaymentProviderKindSeed = "gateway" | "wallet" | "manual";

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

// ─── Reports v33 — new tables for demo data completeness ────────────────────
//
// Four new slices seeded so every report renders complete for the client
// demo. Each is a plain seed array; the Reports selectors read them
// directly. No admin CRUD lands with these — that's a separate marketing
// module. Every field is snake_case for Supabase parity, mirroring the
// convention documented in CLAUDE.md §"Mock Data Convention".

/**
 * Lead — a prospect captured in the funnel BEFORE they become a paying
 * customer. Feeds Lead Data + Lead Conversion + Acquisition Efficiency.
 *
 * FK: `assigned_to_staff_id` → staff_profiles.id.
 *     `first_purchase_transaction_id` → customer_transactions.id (set
 *     once the lead converts).
 */
export interface Lead {
    /** e.g. "lead_ahmed_1" */
    id: string;
    /** ISO — when the lead was captured. */
    added_at: string;
    contact_name: string;
    contact_email: string;
    phone?: string;
    gender?: "Male" | "Female";
    /** Acquisition channel — Instagram · Referral · Walk-in · Website · Google. */
    source: "Instagram" | "Referral" | "Walk-in" | "Website" | "Google" | "WhatsApp";
    /** Funnel stage. */
    stage: "new" | "contacted" | "trial-booked" | "trial-attended" | "paid" | "lost";
    /** Staff member who owns the lead. */
    assigned_to_staff_id?: string;
    engagement_status: "cold" | "warm" | "hot" | "converted" | "lost";
    /** Trial / intro plan they booked, if any. */
    first_purchase_name?: string;
    /** ISO — first purchase date once converted. */
    first_purchase_at?: string;
    /** AED value of the first purchase. */
    first_purchase_amount_aed?: number;
    /** ISO — first staff-touch (for Avg time to first contact). */
    first_contact_at?: string;
    /** Home branch the lead is scoped to. */
    branch_id: string;
}

/**
 * Marketing campaign engagement rollup — one row per campaign send.
 * Feeds Campaign Performance. Marketing campaigns themselves live on
 * the existing `marketing_items` slice; this rollup is the engagement
 * ledger the tracking pixel + email sends would populate.
 *
 * FK: `campaign_id` → marketing_items.id.
 */
export interface MarketingCampaignStat {
    id: string;
    campaign_id: string;
    /** Denorm — kept on the row so the report doesn't need a join. */
    campaign_name: string;
    /** Channel used for THIS send (a campaign may fan out across channels). */
    channel: "email" | "whatsapp" | "sms" | "push";
    /** ISO — when the campaign was sent. */
    sent_at: string;
    sends: number;
    opens_reads: number;
    clicks_taps: number;
    attributed_bookings: number;
    attributed_revenue_aed: number;
    /** Text describing the attribution window ("7 days", "14 days", "30 days"). */
    attribution_window: string;
    branch_id: string;
}

/**
 * Marketing spend — one row per (channel × month × branch). Feeds
 * Acquisition Efficiency's CPL / CAC / ROAS / CAC:LTV columns.
 * Manually entered by the admin in a later module; seeded here for the demo.
 */
export interface MarketingSpend {
    id: string;
    /** YYYY-MM — the calendar month the spend applies to. */
    month: string;
    channel: "Instagram" | "Referral" | "Walk-in" | "Website" | "Google" | "WhatsApp";
    spend_aed: number;
    branch_id: string;
}

/**
 * Staff attendance log — one row per (staff × scheduled class) recording
 * whether they taught, substituted, or no-showed + their clock-in/out
 * times. Feeds Staff Attendance report's "Actual hours" / "Late start" /
 * "Hours variance" columns.
 *
 * FK: `staff_id` → staff_profiles.id; `class_schedule_id` → class_schedule.id.
 */
export interface StaffAttendanceLog {
    id: string;
    staff_id: string;
    class_schedule_id: string;
    /** Attendance outcome. */
    attendance_status: "taught" | "substituted" | "no-show";
    /** When substituted, the staff id who covered. */
    covered_by_staff_id?: string;
    /** Minutes late to class (0 = on time). */
    late_start_minutes: number;
    /** Scheduled hours for the shift (from class duration). */
    scheduled_hours: number;
    /** Actual hours worked (clock-in to clock-out). */
    actual_hours: number;
}

/**
 * Import / migration history — one row per completed data-import run
 * driven by the ONRA AI Agent. Feeds the Settings → Operations →
 * "Migration & imports" module (Figma 196:99889 / empty 196:99868).
 *
 * The AI Agent runs the actual mapping + preview + commit flow (see
 * `ONRA AI-Agent/lib/migration/MigrationStore.ts` in the sibling POC
 * project). Each successful commit writes ONE row here so studio admins
 * have an audit log of every migration attempt: what was imported,
 * how many rows succeeded, how many failed, and a link back to the
 * invalid-rows report the agent surfaced.
 *
 * Status semantics:
 *   • "imported" — every non-skipped row landed (invalid_rows can still
 *                   be > 0; those rows failed validation and were
 *                   surfaced in the report file).
 *   • "partial"  — some rows imported, some failed to write. Rare.
 *   • "failed"   — nothing landed (bad file, blocked branch, etc).
 *   • "pending"  — AI Agent staged records but the admin hasn't
 *                   confirmed the commit yet.
 *
 * FK: `branch_id` → branches.id (scopes rows to the location the agent
 * was operating on when the admin ran the import).
 */
export interface ImportHistorySeed {
    id: string;
    /** Target entity the AI Agent mapped rows into. Snake-case for
     *  parity with Onra table names (customers, staff_profiles, etc).
     *  Rendered in the UI as a Title-Case label ("Customer" / "Staff"
     *  / "Membership") via a display helper. */
    data_type:
        | "customers"
        | "staff"
        | "memberships"
        | "packages"
        | "customer_plans"
        | "class_templates"
        | "class_schedule"
        | "leads";
    /** Original filename the admin uploaded — surfaced in the "Imported
     *  file" column with a matching CSV/XLSX chip. */
    file_name: string;
    file_type: "csv" | "xlsx" | "xls";
    /** Total row count in the uploaded source file. */
    total_rows: number;
    /** Rows that passed validation AND landed in the destination table. */
    imported_rows: number;
    /** Rows that failed validation and were surfaced in the report file
     *  below. `0` renders as an em-dash "-" in the UI. */
    invalid_rows: number;
    /** Filename of the auto-generated invalid-rows XLSX report the AI
     *  Agent produces at commit time. Optional — only present when
     *  invalid_rows > 0; otherwise the "Invalid rows data" column
     *  renders an em-dash. */
    invalid_rows_file_name?: string;
    status: "imported" | "partial" | "failed" | "pending";
    /** ISO date-time when the AI Agent committed the import. Feeds the
     *  "Imported {date}" subtitle on the Data type cell and the
     *  Date-range filter. */
    imported_at: string;
    /** Branch the agent was operating on when the import ran. Feeds
     *  the location dropdown filter in the toolbar. */
    branch_id: string;
}

