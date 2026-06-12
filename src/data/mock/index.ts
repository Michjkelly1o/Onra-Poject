// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Centralized mock data (barrel)
// ─────────────────────────────────────────────────────────────────────────────
//
// Re-exports every table's TypeScript interface and seed array so consumers
// can import from a single path:
//
//   import { Customer, customers, ClassSchedule, classSchedule } from "@/data/mock";
//
// Adding a new table:
//   1. Add the interface to `_types.ts`
//   2. Create the seed file (e.g. `transactions.ts`) and export both the
//      typed array and any helpers it needs
//   3. Re-export both from this file
//
// Until each seed lands, this barrel only re-exports the shared types.

export * from "./_types";

// Foundation seeds (no FK dependencies)
//
// `roles` carries the full PRD 10 role-instance shape (id / name / type /
// branch_id / status / grant_limits / permissions / locked). `DEFAULT_*`
// helpers are re-exported so the role-creation form can copy the type's
// permission template at insert time.
export {
    roles,
    DEFAULT_PERMISSIONS_BY_TYPE,
    DEFAULT_GRANT_LIMITS,
} from "./roles";

// Staff (FK → roles, branches, pay_rates) — supersedes the dedicated
// `instructors` table; the existing one stays in place until phase 4
// folds it in via a derived selector.
export { staff } from "./staff";
export { branches } from "./branches";
export { class_categories } from "./class_categories";

// Locations & people (FK depends on Foundation seeds)
export { rooms } from "./rooms";
export { business_hours } from "./business_hours";
export { staff_profiles } from "./staff_profiles";
export { users } from "./users";
export { user_role_assignments } from "./user_role_assignments";

// Customers (FK → branches)
export { customers } from "./customers";
// Customer plans (FK → customers, memberships/packages)
export { customer_plans } from "./customer_plans";
// Customer transactions (FK → customers, branches, memberships/packages)
export { customer_transactions } from "./customer_transactions";
// Customer agreements (FK → customers, branches, class_templates)
export { customer_agreements } from "./customer_agreements";
// Customer referrals (FK → customers)
export { customer_referrals } from "./customer_referrals";

// Products & Payments (no FK deps for now — payment_methods adds customer_id later)
export { memberships } from "./memberships";
export { packages } from "./packages";
export { gift_card_designs } from "./gift_card_designs";
export { promo_codes } from "./promo_codes";
export { payment_methods } from "./payment_methods";

// Class catalog (FK → class_categories, memberships, packages)
export { class_templates } from "./class_templates";

// Booking rules — global classes settings (no FKs; single-row config)
export { classes_settings } from "./classes_settings";

// Booking rules — cancellation & no-show policies (no FKs)
export { cancellation_policies } from "./cancellation_policies";

// Schedule (FK → class_templates, branches, rooms, staff_profiles)
export { class_schedule } from "./class_schedule";

// Bookings & ratings (FK → class_schedule, customers, staff_profiles, memberships/packages)
export { class_bookings } from "./class_bookings";
export { class_ratings } from "./class_ratings";

// Issued gift cards (FK → gift_card_designs, customers)
export { issued_gift_cards } from "./issued_gift_cards";

// Marketing (FK → branches, class_schedule, memberships/packages, promo_codes)
export { marketing_items } from "./marketing_items";

// Pay rates (FK → branches) — read by payroll, staff, instructor detail
export { pay_rates } from "./pay_rates";

// Instructors (FK → branches, pay_rates) — extends staff_profiles with contact + rate
export { instructors } from "./instructors";

// Payroll entries (FK → instructors, branches, pay_rates) — one per instructor × period
export { payroll_entries, DEMO_PERIOD_START, DEMO_PERIOD_END } from "./payroll_entries";

// Customer notification settings (PRD 11 §12) — per-event channel + template config
export { notification_settings } from "./notification_settings";

// In-app notification records (PRD 12 §6.1) — feed for bell + /admin/notifications
export { notifications } from "./notifications";
// Instructor-scoped notification records (audience: "instructor") — feed for
// the instructor bell + /instructor/notifications page.
export { notifications_instructor } from "./notifications_instructor";
// Per-instructor calendar integrations — Google / Apple — drives the
// Integrations tab on /instructor/account.
export { instructor_integrations } from "./instructor_integrations";

// Referral settings (PRD 11 §11) — global referral program config
export { referral_settings } from "./referral_settings";

// Tax module (PRD 11 §10) — tax rates list + global display mode
export { tax_rates } from "./tax_rates";
export { tax_settings } from "./tax_settings";
// Tax rules (Apply tax rates tab) — FK → tax_rates + branches
export { tax_rules } from "./tax_rules";

// Agreements module (PRD 11 §9) — list + per-version content (FK → branches, users)
export { agreements } from "./agreements";
export { agreement_versions } from "./agreement_versions";

// Integrations module (PRD 11 §8) — third-party connect cards
export { integrations } from "./integrations";

// Payments module (PRD 11 §7) — Stripe / Apple Pay / Google Pay providers
// (distinct from `payment_methods` which holds customer saved cards)
export { payment_providers } from "./payment_providers";

// Account settings (PRD 12 §account) — canonical logged-in user profile.
// Single source of truth read by the Account page, Sidebar avatar chip,
// and any "by-current-user" attribution across the prototype. Distinct
// from `users` which seeds the demo role-switcher personas.
export { account_profile } from "./account_profile";

// Branding module (PRD 11 §5) — studio identity + customer-portal preferences.
// Read by the Branding landing + Customize design / portal sub-pages, and
// (when it ships) by the customer-facing portal itself for theming.
export { branding_settings } from "./branding_settings";
