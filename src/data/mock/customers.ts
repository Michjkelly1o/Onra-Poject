// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `customers` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 10 customers. The first 5 use the portrait files from
// /public/images/customers/ so the schedule detail's roster shows mixed
// avatars (portraits + initials-only). The remaining 5 fall back to neutral
// initials avatars.
//
// `plan_kind` mix is intentional: 5 memberships + 4 packages + 1 no-plan
// — so the Payment confirmation modal has data for every variant
// (existing-plan + "Buy packages" / no-plan).
//
// `status` mix is intentional too: 7 active + 2 inactive + 1 archived — so the
// Customer module list, the Status filter, and the row/bulk lifecycle actions
// (deactivate / reactivate / archive / recover) all have data to act on.
//
// Multi-package: Bosa Ahmed holds 2 different credit packages at once —
// surfaces the "select which package to use" radio picker in the Payment
// confirmation modal. Per CLAUDE.md a customer may hold 1 membership OR
// multiple packages — never both.
//
// Every customer carries a full profile-detail block (DOB, address, sign-in,
// marketing prefs, emergency contact) so the customer-detail "Details" tab
// renders real data for everyone.
//
// v28 Marketing preferences (Figma 7748:61474): the legacy 3-flag trio
// (marketing_emails / marketing_sms / transactional_emails) is expanded
// into 8 flags split across two axes:
//   • 4 CHANNELS — email / whatsapp / sms / push (delivery methods)
//   • 4 TOPICS   — studio_announcements / new_class_launch /
//                  special_offers / promo_code_offers
// A message is delivered only when BOTH the topic AND at least one
// channel are opted in. Ava Wright is the Figma reference customer —
// her block matches the design's mostly-Subscribed / promo-Unsubscribed
// example.
//
// FK: `branch_id` → branches.id, `membership_id` → memberships.id,
//     `package_ids` → packages.id[]
//
// All current customers are seeded under Forma Studio South (the main
// active branch) to keep schedule joins simple. East/West can pick up
// customers when those branches are exercised by a screen.

import type { Customer } from "./_types";
import { DEMO_NOW_AT_RISK_LAST_VISITS, DEMO_NOW_NEW_SIGNUP_CREATED_AT } from "./prototype_demo_data";

// ─── Hand-authored customers ─────────────────────────────────────────────
//
// These 10 are the "story" customers — they drive every focused demo path
// (roster on the schedule detail, active plans on the Customer profile,
// referral chain, POS multi-package select, etc). Their names appear in
// screenshots and PRDs, so their fields are hand-tuned. Never regenerate
// or reorder them.
//
// The bulk `syntheticCustomers` block appended below scales the total to
// ~1,530 rows so aggregate KPIs (dashboard, marketing opt-in counts) read
// like real studio data instead of a 10-row prototype.
const handAuthoredCustomers: Customer[] = [
    // ── 5 with portraits ────────────────────────────────────────────────────
    {
        id: "cust_ahmed_zayn",
        first_name: "Ahmed",
        last_name: "Zayn",
        initials: "AZ",
        email: "ahmed.zayn@email.com",
        phone: "+971 50 123 4567",
        branch_id: "branch_forma_south",
        image_url: "/images/customers/ahmed-zayn.webp",
        plan_kind: "membership",
        membership_id: "mem_unlimited_monthly",
        plan_name: "Unlimited Monthly Membership",
        created_at: "2026-01-08T09:00:00Z",
        gender: "Male",
        status: "archived",
        last_visit_iso: "2026-01-20",
        plan_expiry_iso: "2026-06-15",
        date_of_birth: "1992-05-15",
        country: "United Arab Emirates",
        state: "Dubai",
        city: "Dubai",
        postal_code: "118765",
        street_address: "12 Marina Walk, Dubai Marina",
        google_connected: true,
        // Ahmed is archived — kept moderate marketing prefs from before
        // the freeze so re-activation restores meaningful opt-ins.
        marketing_channel_email:              true,
        marketing_channel_whatsapp:           true,
        marketing_channel_sms:                true,
        marketing_channel_push:               false,
        marketing_topic_studio_announcements: true,
        marketing_topic_new_class_launch:     false,
        marketing_topic_special_offers:       true,
        marketing_topic_promo_code_offers:    true,
        emergency_contact_name: "Noor Zayn",
        emergency_contact_phone: "+971 50 987 6543",
        emergency_contact_relation: "Spouse",
        referral_code: "AHMEZA",
    },
    {
        id: "cust_ava_wright",
        first_name: "Ava",
        last_name: "Wright",
        initials: "AW",
        email: "ava.wright@email.com",
        phone: "+971 50 234 5678",
        branch_id: "branch_forma_south",
        image_url: "/images/customers/ava-wright.webp",
        plan_kind: "membership",
        membership_id: "mem_advanced_monthly",
        plan_name: "Advanced Monthly Membership",
        created_at: "2026-04-25T09:00:00Z",
        gender: "Female",
        credits_remaining: 12,
        status: "active",
        last_visit_iso: "2026-05-20",
        plan_expiry_iso: "2026-06-30",
        date_of_birth: "1995-07-22",
        country: "United Arab Emirates",
        state: "Dubai",
        city: "Dubai",
        postal_code: "233901",
        street_address: "Sheikh Zayed Rd, Trade Centre 2",
        google_connected: true,
        // Ava is the Figma reference customer (node 7748:61474) — all 8
        // fields Subscribed except Promo code offers = Unsubscribed.
        marketing_channel_email:              true,
        marketing_channel_whatsapp:           true,
        marketing_channel_sms:                true,
        marketing_channel_push:               true,
        marketing_topic_studio_announcements: true,
        marketing_topic_new_class_launch:     true,
        marketing_topic_special_offers:       true,
        marketing_topic_promo_code_offers:    false,
        emergency_contact_name: "Daniel Wright",
        emergency_contact_phone: "+971 50 311 4400",
        emergency_contact_relation: "Sibling",
        referral_code: "AVAWRI",
    },
    {
        // Multi-package customer — holds 10-Class + 5-Class. Demos the
        // PaymentConfirmation radio picker.
        id: "cust_bosa_ahmed",
        first_name: "Bosa",
        last_name: "Ahmed",
        initials: "BA",
        email: "bosa.ahmed@email.com",
        phone: "+971 50 345 6789",
        branch_id: "branch_forma_south",
        image_url: "/images/customers/bosa-ahmed.webp",
        plan_kind: "package",
        package_ids: ["pkg_10_class", "pkg_5_class"],
        plan_name: "10-Class Package for One Month",
        created_at: "2026-01-10T09:00:00Z",
        gender: "Male",
        credits_remaining: 8,
        status: "active",
        last_visit_iso: "2026-05-18",
        plan_expiry_iso: "2026-06-10",
        date_of_birth: "1989-05-16",
        country: "United Arab Emirates",
        state: "Abu Dhabi",
        city: "Abu Dhabi",
        postal_code: "445120",
        street_address: "Al Reem Island, Shams Tower 2",
        google_connected: false,
        // Bosa opts in everywhere except Push (never installed the app).
        marketing_channel_email:              true,
        marketing_channel_whatsapp:           true,
        marketing_channel_sms:                true,
        marketing_channel_push:               false,
        marketing_topic_studio_announcements: true,
        marketing_topic_new_class_launch:     true,
        marketing_topic_special_offers:       true,
        marketing_topic_promo_code_offers:    true,
        emergency_contact_name: "Salma Ahmed",
        emergency_contact_phone: "+971 50 776 1209",
        emergency_contact_relation: "Spouse",
        referral_code: "BOSAAH",
    },
    {
        id: "cust_rosale_martin",
        first_name: "Rosale",
        last_name: "Martin",
        initials: "RM",
        email: "rosale.martin@email.com",
        phone: "+971 50 456 7890",
        branch_id: "branch_forma_south",
        image_url: "/images/customers/rosale-martin.webp",
        plan_kind: "package",
        package_ids: ["pkg_10_class"],
        plan_name: "10-Class Package for One Month",
        created_at: "2026-01-11T09:00:00Z",
        gender: "Female",
        credits_remaining: 6,
        status: "active",
        last_visit_iso: "2026-05-02",
        plan_expiry_iso: "2026-05-28",
        date_of_birth: "1998-05-08",
        country: "United Arab Emirates",
        state: "Dubai",
        city: "Dubai",
        postal_code: "509873",
        street_address: "Jumeirah Beach Rd, Umm Suqeim 1",
        google_connected: true,
        // Rosale is a quiet subscriber — only wants studio announcements
        // by email, all other channels + topics off.
        marketing_channel_email:              true,
        marketing_channel_whatsapp:           false,
        marketing_channel_sms:                false,
        marketing_channel_push:               false,
        marketing_topic_studio_announcements: true,
        marketing_topic_new_class_launch:     false,
        marketing_topic_special_offers:       false,
        marketing_topic_promo_code_offers:    false,
        emergency_contact_name: "Olivia Martin",
        emergency_contact_phone: "+971 50 220 8841",
        emergency_contact_relation: "Parent",
        referral_code: "ROSAMA",
    },
    {
        id: "cust_zahra_mahen",
        first_name: "Zahra",
        last_name: "Mahen",
        initials: "ZM",
        email: "zahra.mahen@email.com",
        phone: "+971 50 567 8901",
        branch_id: "branch_forma_south",
        image_url: "/images/customers/zahra-mahen.webp",
        plan_kind: "membership",
        membership_id: "mem_unlimited_monthly",
        plan_name: "Unlimited Monthly Membership",
        created_at: "2026-05-08T09:00:00Z",
        gender: "Female",
        status: "inactive",
        last_visit_iso: "2026-03-10",
        plan_expiry_iso: "2026-06-20",
        date_of_birth: "1990-09-08",
        country: "United Arab Emirates",
        state: "Sharjah",
        city: "Sharjah",
        postal_code: "672014",
        street_address: "Al Majaz Waterfront, Buhairah Corniche",
        google_connected: false,
        // Zahra (inactive) reads emails + WhatsApp, prefers programme
        // updates over promo content.
        marketing_channel_email:              true,
        marketing_channel_whatsapp:           true,
        marketing_channel_sms:                false,
        marketing_channel_push:               false,
        marketing_topic_studio_announcements: true,
        marketing_topic_new_class_launch:     true,
        marketing_topic_special_offers:       false,
        marketing_topic_promo_code_offers:    false,
        emergency_contact_name: "Idris Mahen",
        emergency_contact_phone: "+971 50 904 5532",
        emergency_contact_relation: "Spouse",
        referral_code: "ZAHRMA",
    },

    // ── 5 with initials only ─────────────────────────────────────────────────
    {
        id: "cust_sophia_lee",
        first_name: "Sophia",
        last_name: "Lee",
        initials: "SL",
        email: "sophia.lee@email.com",
        phone: "+971 50 678 9012",
        branch_id: "branch_forma_south",
        plan_kind: "membership",
        membership_id: "mem_beginner_monthly",
        plan_name: "Beginner Monthly Membership",
        created_at: "2026-05-01T09:00:00Z",
        gender: "Female",
        credits_remaining: 0,
        status: "active",
        last_visit_iso: "2026-04-15",
        plan_expiry_iso: "2026-07-05",
        date_of_birth: "2000-11-20",
        country: "United Arab Emirates",
        state: "Dubai",
        city: "Dubai",
        postal_code: "010101",
        street_address: "Sheikh Zayed Rd, Trade Centre 2",
        google_connected: true,
        // Sophia is the maximally-engaged member — every channel on,
        // every topic on. Useful for demoing the "everything Subscribed"
        // profile view.
        marketing_channel_email:              true,
        marketing_channel_whatsapp:           true,
        marketing_channel_sms:                true,
        marketing_channel_push:               true,
        marketing_topic_studio_announcements: true,
        marketing_topic_new_class_launch:     true,
        marketing_topic_special_offers:       true,
        marketing_topic_promo_code_offers:    true,
        emergency_contact_name: "Grace Lee",
        emergency_contact_phone: "+971 50 200 2001",
        emergency_contact_relation: "Sibling",
        referral_code: "SOPHLE",
    },
    {
        id: "cust_james_taylor",
        first_name: "James",
        last_name: "Taylor",
        initials: "JT",
        email: "james.taylor@email.com",
        phone: "+971 50 789 0123",
        branch_id: "branch_forma_south",
        plan_kind: "package",
        package_ids: ["pkg_5_class"],
        plan_name: "5-Class Package for One Month",
        created_at: "2026-01-14T09:00:00Z",
        gender: "Male",
        credits_remaining: 3,
        status: "active",
        last_visit_iso: "2026-04-28",
        plan_expiry_iso: "2026-06-05",
        date_of_birth: "1987-05-17",
        country: "United Arab Emirates",
        state: "Dubai",
        city: "Dubai",
        postal_code: "781233",
        street_address: "Downtown Dubai, Burj Views Tower C",
        google_connected: false,
        // James unsubscribed from most marketing — kept email +
        // studio_announcements only. Demos the minimally-engaged
        // profile.
        marketing_channel_email:              true,
        marketing_channel_whatsapp:           false,
        marketing_channel_sms:                false,
        marketing_channel_push:               false,
        marketing_topic_studio_announcements: true,
        marketing_topic_new_class_launch:     false,
        marketing_topic_special_offers:       false,
        marketing_topic_promo_code_offers:    false,
        emergency_contact_name: "Emma Taylor",
        emergency_contact_phone: "+971 50 661 7788",
        emergency_contact_relation: "Spouse",
        referral_code: "JAMETA",
    },
    {
        id: "cust_fatima_al_sayed",
        first_name: "Fatima",
        last_name: "Al-Sayed",
        initials: "FA",
        email: "fatima.al-sayed@email.com",
        phone: "+971 50 890 1234",
        branch_id: "branch_forma_south",
        // Switched membership → package today (see `cp_fatima_notif` /
        // `txn_fatima_notif`). Per the 1-membership-OR-multiple-packages
        // rule (CLAUDE.md), her old Unlimited Membership is now `cancelled`
        // in customer_plans.ts and this record reflects the new package state.
        plan_kind: "package",
        package_ids: ["pkg_10_class"],
        plan_name: "10-Class Package for One Month",
        credits_remaining: 10,
        created_at: "2026-01-15T09:00:00Z",
        gender: "Female",
        status: "active",
        last_visit_iso: "2026-05-19",
        plan_expiry_iso: "2026-06-14",
        date_of_birth: "1994-05-13",
        country: "United Arab Emirates",
        state: "Dubai",
        city: "Dubai",
        postal_code: "330457",
        street_address: "Al Wasl Rd, Jumeirah 1",
        google_connected: true,
        // Fatima opts into everything except Push + promo codes.
        marketing_channel_email:              true,
        marketing_channel_whatsapp:           true,
        marketing_channel_sms:                true,
        marketing_channel_push:               false,
        marketing_topic_studio_announcements: true,
        marketing_topic_new_class_launch:     true,
        marketing_topic_special_offers:       true,
        marketing_topic_promo_code_offers:    false,
        emergency_contact_name: "Layla Al-Sayed",
        emergency_contact_phone: "+971 50 448 9920",
        emergency_contact_relation: "Sibling",
        referral_code: "FATIAL",
    },
    {
        id: "cust_lucas_brown",
        first_name: "Lucas",
        last_name: "Brown",
        initials: "LB",
        email: "lucas.brown@email.com",
        phone: "+971 50 901 2345",
        branch_id: "branch_forma_south",
        plan_kind: "package",
        package_ids: ["pkg_10_class"],
        plan_name: "10-Class Package for One Month",
        created_at: "2026-01-16T09:00:00Z",
        gender: "Male",
        credits_remaining: 10,
        status: "inactive",
        last_visit_iso: "2026-02-10",
        plan_expiry_iso: "2026-05-30",
        date_of_birth: "1991-05-19",
        country: "United Arab Emirates",
        state: "Dubai",
        city: "Dubai",
        postal_code: "904112",
        street_address: "Business Bay, Executive Towers J",
        google_connected: true,
        // Lucas (inactive) — email + WhatsApp for programme updates
        // only, opted out of offers/promos.
        marketing_channel_email:              true,
        marketing_channel_whatsapp:           true,
        marketing_channel_sms:                false,
        marketing_channel_push:               false,
        marketing_topic_studio_announcements: true,
        marketing_topic_new_class_launch:     true,
        marketing_topic_special_offers:       false,
        marketing_topic_promo_code_offers:    false,
        emergency_contact_name: "Hannah Brown",
        emergency_contact_phone: "+971 50 552 3310",
        emergency_contact_relation: "Parent",
        referral_code: "LUCABR",
    },
    {
        // Just purchased the Unlimited Monthly Membership (see
        // `cp_mia_notif` / `txn_mia_notif`). Matches the Payment Confirmed
        // notification at the top of the bell feed. Never visited yet —
        // still surfaces the "Never visited" Last visit filter bucket.
        id: "cust_mia_anderson",
        first_name: "Mia",
        last_name: "Anderson",
        initials: "MA",
        email: "mia.anderson@email.com",
        phone: "+971 50 012 3456",
        branch_id: "branch_forma_south",
        plan_kind: "membership",
        membership_id: "mem_unlimited_monthly",
        plan_name: "Unlimited Monthly Membership",
        created_at: "2026-01-17T09:00:00Z",
        gender: "Female",
        status: "active",
        plan_expiry_iso: "2026-06-15",
        date_of_birth: "2001-05-22",
        country: "United Arab Emirates",
        state: "Dubai",
        city: "Dubai",
        postal_code: "120945",
        street_address: "Al Sufouh Rd, Knowledge Village",
        google_connected: false,
        // Mia is brand new — wants studio + new_class content by email,
        // hasn't opted into offers/promos yet. Never visited.
        marketing_channel_email:              true,
        marketing_channel_whatsapp:           false,
        marketing_channel_sms:                false,
        marketing_channel_push:               false,
        marketing_topic_studio_announcements: true,
        marketing_topic_new_class_launch:     true,
        marketing_topic_special_offers:       false,
        marketing_topic_promo_code_offers:    false,
        emergency_contact_name: "Chris Anderson",
        emergency_contact_phone: "+971 50 778 6655",
        emergency_contact_relation: "Parent",
        referral_code: "MIAAND",
    },
];

// ─── Synthetic filler customers ──────────────────────────────────────────
//
// Deterministically generated so demo KPIs (dashboard active-member
// count, Customer notifications "X of Y opted in" banner, etc) read
// like real studio data (~1,530 customers) instead of a 10-row toy.
//
// Design constraints:
//   • Every field is index-derived, so the count and opt-in ratios are
//     identical on every render / new tab (no `Math.random()`).
//   • All synthetic customers are `plan_kind: null` — they don't hold
//     memberships/packages, so they can't break any product / plan
//     join. They still show up in list, filters, and count aggregates.
//   • Home branch cycles across the 3 active branches so branch-scoped
//     KPIs get meaningful non-zero numbers everywhere.
//   • Marketing prefs follow 10 fixed patterns picked so that ~70% of
//     synthetic customers count as "opted in" (has ≥1 topic AND ≥1
//     channel enabled). Combined with the hand-authored 10 (mostly
//     opted in), the banner reads roughly "1,080 of 1,530".
//   • Names come from a fixed pool joined by index → the same synthetic
//     "Amina Rahman #0742" appears every boot with the same profile.
//
// If a future demo needs to add more variety (statuses / plans /
// branches / addresses), extend the pools below — do NOT hand-author
// new rows in the story block; those stay pristine.

const SYNTH_FIRST_NAMES = [
    "Amina",   "Omar",    "Layla",   "Yusuf",   "Sara",    "Karim",   "Nadia",   "Hassan",
    "Zainab",  "Rami",    "Dina",    "Tariq",   "Rania",   "Adam",    "Hana",    "Malik",
    "Salma",   "Nasser",  "Farah",   "Idris",   "Reem",    "Bilal",   "Yasmin",  "Sami",
    "Nora",    "Firas",   "Lina",    "Basil",   "Maya",    "Kareem",  "Iman",    "Zaid",
    "Rasha",   "Talal",   "Huda",    "Anwar",   "Latifa",  "Fadi",    "Manal",   "Wael",
    "Ella",    "Noah",    "Zara",    "Leo",     "Mila",    "Aria",    "Kai",     "Nina",
    "Ivan",    "Zoe",     "Elias",   "Mira",    "Dylan",   "Rae",     "Aiden",   "Sana",
];

const SYNTH_LAST_NAMES = [
    "Rahman",   "Farouk",   "Karam",    "Nabil",    "Saleh",    "Haddad",   "Nassar",
    "Awad",     "Khoury",   "Aziz",     "Malouf",   "Habib",    "Sawaya",   "Chahine",
    "Baroudi",  "Doumani",  "Faroun",   "Ghanem",   "Hourani",  "Ibrahim",  "Jabbour",
    "Khalil",   "Latif",    "Mansour",  "Nader",    "Osman",    "Qassim",   "Rihani",
    "Sabbagh",  "Tabet",    "Ubayd",    "Wahba",    "Yassine",  "Zayed",    "Aoun",
    "Batra",    "Cortes",   "Dahan",    "Egan",     "Feld",     "Gaber",    "Hafez",
    "Ivic",     "Joubert",  "Kelaya",   "Lamas",    "Meraz",    "Norte",    "Otero",
];

const SYNTH_BRANCHES = ["branch_forma_south", "branch_forma_north", "branch_forma_west"];

/** 10 fixed marketing-preference patterns [channels+topics] — 7 of 10
 *  qualify as "opted in" (≥1 channel AND ≥1 topic true), giving a
 *  synthetic-tier opt-in rate of 70%. */
const SYNTH_MARKETING_PATTERNS: Array<{
    email: boolean; wa: boolean; sms: boolean; push: boolean;
    sa: boolean;    ncl: boolean; so: boolean;  pco: boolean;
}> = [
    { email: true,  wa: true,  sms: true,  push: true,  sa: true,  ncl: true,  so: true,  pco: true  }, // all in
    { email: true,  wa: true,  sms: false, push: true,  sa: true,  ncl: true,  so: true,  pco: false }, // heavy
    { email: true,  wa: false, sms: false, push: false, sa: true,  ncl: true,  so: false, pco: false }, // moderate
    { email: true,  wa: true,  sms: true,  push: false, sa: true,  ncl: true,  so: true,  pco: true  }, // most
    { email: true,  wa: false, sms: false, push: true,  sa: true,  ncl: false, so: true,  pco: false }, // partial
    { email: false, wa: true,  sms: false, push: false, sa: false, ncl: true,  so: false, pco: false }, // minimal
    { email: true,  wa: true,  sms: false, push: true,  sa: true,  ncl: true,  so: true,  pco: true  }, // heavy
    { email: false, wa: false, sms: false, push: false, sa: false, ncl: false, so: false, pco: false }, // opted out
    { email: true,  wa: false, sms: false, push: false, sa: false, ncl: false, so: false, pco: false }, // channels only
    { email: false, wa: false, sms: false, push: false, sa: true,  ncl: true,  so: false, pco: false }, // topics only
];

const SYNTH_STATUSES: Array<"active" | "inactive" | "archived"> = [
    "active", "active", "active", "active", "active", "active", "active",
    "active", "inactive", "archived",
];

const SYNTH_GENDERS: Array<"Male" | "Female"> = ["Female", "Male"];

/** Produce N synthetic customers. Rows are deterministic — the same
 *  index always produces the same row so counts + KPIs are stable. */
// Anchor synthetic customer created_at to the real "today" so date-range
// filters always land inside the seeded window. Client 2026-07-22 flag: the
// prior "2024-*" hard-coding meant Last-12-months on the dashboard never
// hit any synthetic — the entire seed sat outside the rolling window.
//
// Distribution across the last 15 months (12-month rolling window + 3
// extra months of tail so a filter like "Last 30 days" that reaches back
// past today still has data). Per-month count grows toward NOW so the
// customer-acquisition trend reads as "the studio is scaling", matching
// the client's referral-share mockup (Aug small → Jul big).
//
// Referral share also grows month-over-month (5% at 12mo-ago → 24% at
// now) so the "Referral share of new customers" widget renders the
// mockup shape. `convertedFrom` is stamped directly on the synthetic row
// so `deriveConvertedFrom` (which defaults every planKind=null customer
// to "trial-class") doesn't wash out the referral signal.
const SYNTH_NOW = new Date();
const SYNTH_MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Non-null converted_from options for a synthetic customer's month. Cycled
 *  by the intra-month index so per-month distribution is deterministic and
 *  the same shape appears whenever the seed is re-generated. */
const SYNTH_CONVERTED_FROM: readonly Customer["converted_from"][] = [
    "first-visit", "intro-offer", "trial-class",
] as const;

function generateSyntheticCustomers(count: number): Customer[] {
    const out: Customer[] = [];

    // Growth curve — index 0 = 15 months ago, index 14 = current month.
    // Weights approximate `1 + monthIdx / 15 * 2.5` (grows ~1x → 3.5x).
    // Normalised so the sum equals `count` after rounding.
    const MONTH_COUNT = 15;
    const rawWeights: number[] = [];
    for (let m = 0; m < MONTH_COUNT; m++) {
        rawWeights.push(1 + (m / (MONTH_COUNT - 1)) * 2.5);
    }
    const weightSum = rawWeights.reduce((a, b) => a + b, 0);
    const perMonth: number[] = rawWeights.map(w => Math.round((w / weightSum) * count));
    // Fix rounding drift so per-month sum equals `count` exactly.
    let drift = count - perMonth.reduce((a, b) => a + b, 0);
    for (let m = MONTH_COUNT - 1; drift !== 0; m = (m - 1 + MONTH_COUNT) % MONTH_COUNT) {
        perMonth[m] += drift > 0 ? 1 : -1;
        drift += drift > 0 ? -1 : 1;
        if (m === 0 && drift !== 0) break; // safety
    }
    // Referral-share curve — index 0 = 15mo-ago (~4%), index 14 = current
    // month (~26%). Every 3rd customer in-month is a referral at the top
    // of the curve, only ~1 in 25 at the tail. Reads visibly on the widget.
    const referralPctByMonth: number[] = [];
    for (let m = 0; m < MONTH_COUNT; m++) {
        referralPctByMonth.push(4 + (m / (MONTH_COUNT - 1)) * 22);
    }

    // Iterate month-by-month so intra-month indices `m_i` reset per bucket.
    let idx = 0;
    for (let m = 0; m < MONTH_COUNT; m++) {
        const monthTotal = perMonth[m];
        // Month anchor — 1st of the target month, `MONTH_COUNT-1-m` months
        // before NOW's month. Uses setMonth so year rollover is automatic.
        const monthDate = new Date(SYNTH_NOW.getFullYear(), SYNTH_NOW.getMonth() - (MONTH_COUNT - 1 - m), 1);
        const referralPct = referralPctByMonth[m];
        // Stride within the month — each customer gets a stable day
        // computed from its intra-month index so re-hydrates place the
        // same customer on the same day. Days spread across ~28 to stay
        // valid for every month (Feb-safe).
        for (let mi = 0; mi < monthTotal; mi++, idx++) {
            const i = idx; // preserve the caller-visible index for id + name
            const first = SYNTH_FIRST_NAMES[i % SYNTH_FIRST_NAMES.length];
            const last  = SYNTH_LAST_NAMES [(i * 3 + 7) % SYNTH_LAST_NAMES.length];
            const suffix = String(i).padStart(4, "0");
            const pattern = SYNTH_MARKETING_PATTERNS[i % SYNTH_MARKETING_PATTERNS.length];
            const branch = SYNTH_BRANCHES[i % SYNTH_BRANCHES.length];
            const status = SYNTH_STATUSES[i % SYNTH_STATUSES.length];
            const gender = SYNTH_GENDERS [(i >>> 1) % SYNTH_GENDERS.length];

            const dayOfMonth = ((mi * 3 + 1) % 27) + 1;
            const created = new Date(monthDate);
            created.setDate(dayOfMonth);
            const createdISO = created.toISOString();

            // Referral vs non-referral pick — deterministic threshold
            // over the intra-month index. First N of the month are
            // referrals where N = ceil(monthTotal × pct/100). Guarantees
            // the widget shows exactly the intended share per bucket.
            const referralCutoff = Math.ceil(monthTotal * (referralPct / 100));
            const convertedFrom: Customer["converted_from"] = mi < referralCutoff
                ? "referral"
                : SYNTH_CONVERTED_FROM[mi % SYNTH_CONVERTED_FROM.length];

            // Ensure the customer is CURRENTLY dated (JS Date's toISOString
            // returns UTC; created may fall on a day in the past or future
            // depending on local TZ but stays inside the same month for our
            // bucketing needs).
            void SYNTH_MS_PER_DAY;

            out.push({
                id:         `cust_synth_${suffix}`,
                first_name: first,
                last_name:  last,
                initials:   `${first[0]}${last[0]}`,
                email:      `${first.toLowerCase()}.${last.toLowerCase()}${suffix}@email.com`,
                phone:      `+971 5${(i % 5)} ${String(100 + (i % 900)).padStart(3, "0")} ${String(1000 + ((i * 617) % 9000)).padStart(4, "0")}`,
                branch_id:  branch,
                plan_kind:  null,
                created_at: createdISO,
                converted_from: convertedFrom,
                gender,
                status,
                marketing_channel_email:              pattern.email,
                marketing_channel_whatsapp:           pattern.wa,
                marketing_channel_sms:                pattern.sms,
                marketing_channel_push:               pattern.push,
                marketing_topic_studio_announcements: pattern.sa,
                marketing_topic_new_class_launch:     pattern.ncl,
                marketing_topic_special_offers:       pattern.so,
                marketing_topic_promo_code_offers:    pattern.pco,
            });
        }
    }
    return out;
}

/** Final export: 10 hand-authored "story" customers + 1,520 synthetic
 *  filler = 1,530 total. Order preserved so `customers[0]` stays Ahmed
 *  (used by hardcoded demo links / screenshots). */
// Dashboard At-risk clients modal fixture — the fixture in
// `prototype_demo_data.ts` keys `last_visit_iso` overrides by
// SYNTHETIC customer id (cust_synth_XXXX). Patch is therefore
// applied to BOTH the hand-authored list AND the generated
// synthetic list so whichever ids the fixture uses, the modal
// picks them up. Applied at export time (not at each row site)
// so the base seed stays readable + a single edit in
// `prototype_demo_data.ts` updates every consumer.
function applyAtRiskPatch(row: Customer): Customer {
    const override = DEMO_NOW_AT_RISK_LAST_VISITS[row.id];
    return override ? { ...row, last_visit_iso: override } : row;
}

// Dashboard "New sign-ups today with no first booking" fixture — overrides
// `created_at` to today for a handful of synthetic customers (which carry
// `plan_kind: null` + no bookings), so the modal always has fresh drop-ins
// to nudge. Same patch-at-export pattern as the at-risk override above.
function applyNewSignupPatch(row: Customer): Customer {
    const override = DEMO_NOW_NEW_SIGNUP_CREATED_AT[row.id];
    return override ? { ...row, created_at: override } : row;
}

export const customers: Customer[] = [
    ...handAuthoredCustomers.map(applyAtRiskPatch).map(applyNewSignupPatch),
    ...generateSyntheticCustomers(1520).map(applyAtRiskPatch).map(applyNewSignupPatch),
];
