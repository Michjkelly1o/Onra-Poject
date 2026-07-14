// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `services` seed (Appointment services — Module 13)
// ─────────────────────────────────────────────────────────────────────────────
//
// Service is the appointment-side counterpart to `class_templates`. Each
// row defines a bookable service blueprint that spawns appointments. Every
// Service is `type: "private"` or `type: "recovery"` (Classes come from
// templates, never a Service).
//
// Three shapes (driven by `type` + `open_session`):
//
//   • Recovery + Open session — `type:"recovery"`, multi-customer,
//     capacity > 0, no instructor. e.g. Sauna, Breathwork.
//   • Recovery + Private      — `type:"recovery"`, 1 customer at a time,
//     no instructor. e.g. Massage, IV therapy.
//   • Private                 — `type:"private"`, 1 customer + 1 instructor,
//     capacity = 0. e.g. Private Reformer, Mat Pilates.
//
// A service can live at ANY active branch and optionally use a room —
// recovery is no longer pinned to a fake "spa" location. For the demo the
// full recovery set is seeded under Forma South (the main branch).
//
// Pricing model: services are CURRENCY-priced via `price` (AED). The
// legacy `applicable_membership_ids` / `applicable_package_ids` fields
// were dropped — customers pay the fixed price on the appointment
// booking checkout.
//
// FKs:
//   category_id → class_categories.id
//   branch_id   → branches.id

import type { Service } from "./_types";

export const services: Service[] = [
    // ── Private services (type="private", always 1:1 with instructor) ──
    {
        id: "svc_private_reformer",
        category_id: "cat_pilates",
        name: "Private Reformer",
        description: "1-on-1 Reformer Pilates session tailored to your goals. Ideal for first-timers and post-rehab clients.",
        type: "private",
        open_session: false,
        duration_min: 60,
        capacity: 0,
        price: 220,
        branch_id: "branch_forma_south",
        cover_image_url: "/images/service/private-reformer.webp",
        status: "Active",
    },
    {
        id: "svc_private_mat_pilates",
        category_id: "cat_pilates",
        name: "Private Mat Pilates",
        description: "1-on-1 mat-based Pilates focused on core control and alignment.",
        type: "private",
        open_session: false,
        duration_min: 45,
        capacity: 0,
        price: 180,
        branch_id: "branch_forma_south",
        cover_image_url: "/images/service/private-mat-pilates.webp",
        status: "Active",
    },

    // ── Recovery & wellness services (type="recovery"). Seeded under Forma
    //    South for the demo; any branch can host recovery. Room is optional
    //    per service (see appointments.ts — massage + IV use the South
    //    Recovery room, sauna + breathwork are room-less). ──
    // Massage — private recovery (1 customer at a time, no instructor).
    {
        id: "svc_massage",
        category_id: "cat_pilates",
        name: "Massage",
        description: "1-on-1 deep tissue or sports massage with a licensed therapist. 60 minutes of targeted recovery work.",
        type: "recovery",
        open_session: false,
        duration_min: 60,
        capacity: 0,
        price: 280,
        branch_id: "branch_forma_south",
        room_id: "room_south_recovery",
        cover_image_url: "/images/service/massage.webp",
        status: "Active",
    },
    // Sauna — open session (drop-in, multi-customer).
    {
        id: "svc_sauna",
        category_id: "cat_yoga",
        name: "Sauna",
        description: "Drop-in infrared sauna session — open for the time slot, members rotate in as space allows.",
        type: "recovery",
        open_session: true,
        duration_min: 30,
        capacity: 6,
        price: 95,
        branch_id: "branch_forma_south",
        cover_image_url: "/images/service/sauna.webp",
        status: "Active",
    },
    // Breathwork — open session (group, larger capacity).
    {
        id: "svc_breathwork",
        category_id: "cat_yoga",
        name: "Breathwork",
        description: "Guided breathwork session for nervous system regulation. Drop in anytime during the slot.",
        type: "recovery",
        open_session: true,
        duration_min: 45,
        capacity: 10,
        price: 120,
        branch_id: "branch_forma_south",
        cover_image_url: "/images/service/breathwork.webp",
        status: "Active",
    },
    // IV therapy — private recovery, seasonally paused (Inactive).
    {
        id: "svc_iv_therapy",
        category_id: "cat_pilates",
        name: "IV therapy",
        description: "Private IV vitamin therapy session with a licensed nurse. 30-minute hydration + micronutrient drip.",
        type: "recovery",
        open_session: false,
        duration_min: 30,
        capacity: 0,
        price: 450,
        branch_id: "branch_forma_south",
        room_id: "room_south_recovery",
        cover_image_url: "/images/service/iv-therapy.webp",
        status: "Inactive",
    },
];
