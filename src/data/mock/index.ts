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
export { roles } from "./roles";
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

// Products & Payments (no FK deps for now — payment_methods adds customer_id later)
export { memberships } from "./memberships";
export { packages } from "./packages";
export { gift_card_designs } from "./gift_card_designs";
export { promo_codes } from "./promo_codes";
export { payment_methods } from "./payment_methods";

// Class catalog (FK → class_categories, memberships, packages)
export { class_templates } from "./class_templates";

// Schedule (FK → class_templates, branches, rooms, staff_profiles)
export { class_schedule } from "./class_schedule";

// Bookings & ratings (FK → class_schedule, customers, staff_profiles, memberships/packages)
export { class_bookings } from "./class_bookings";
export { class_ratings } from "./class_ratings";

// Issued gift cards (FK → gift_card_designs, customers)
export { issued_gift_cards } from "./issued_gift_cards";

// Marketing (FK → branches, class_schedule, memberships/packages, promo_codes)
export { marketing_items } from "./marketing_items";
