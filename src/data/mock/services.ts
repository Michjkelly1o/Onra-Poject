// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `services` seed (Appointment services — Module 13)
// ─────────────────────────────────────────────────────────────────────────────
//
// Service is the appointment-side counterpart to `class_templates`. Each
// row defines a bookable service blueprint that spawns appointments.
//
// Three shapes (driven by `is_recovery` + `open_session`):
//
//   • Recovery + Open session — multi-customer, capacity > 0, no
//     instructor. Lives at Spa branches. e.g. Sauna, Breathwork.
//   • Recovery + Private      — 1 customer at a time, no instructor.
//     Lives at Spa branches. e.g. Massage, IV therapy.
//   • Non-recovery (Private)  — 1 customer + 1 instructor, capacity = 0.
//     Lives at Club branches. e.g. Private Reformer, Mat Pilates.
//
// Pricing model: services are CURRENCY-priced via `price` (AED). The
// legacy `applicable_membership_ids` / `applicable_package_ids` fields
// were dropped — customers pay the fixed price on the appointment
// booking checkout.
//
// FKs:
//   category_id → class_categories.id
//   branch_id   → branches.id  (must match `branch.kind` ↔ `is_recovery`)

import type { Service } from "./_types";

export const services: Service[] = [
    // ── Club services (is_recovery=false, always private with instructor) ──
    {
        id: "svc_private_reformer",
        category_id: "cat_pilates",
        name: "Private Reformer",
        description: "1-on-1 Reformer Pilates session tailored to your goals. Ideal for first-timers and post-rehab clients.",
        is_recovery: false,
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
        is_recovery: false,
        open_session: false,
        duration_min: 45,
        capacity: 0,
        price: 180,
        branch_id: "branch_forma_south",
        cover_image_url: "/images/service/private-mat-pilates.webp",
        status: "Active",
    },

    // ── Spa / Recovery services (is_recovery=true, live at Spa branch) ──
    // Massage — private recovery (1 customer at a time, no instructor).
    {
        id: "svc_massage",
        category_id: "cat_pilates",
        name: "Massage",
        description: "1-on-1 deep tissue or sports massage with a licensed therapist. 60 minutes of targeted recovery work.",
        is_recovery: true,
        open_session: false,
        duration_min: 60,
        capacity: 0,
        price: 280,
        branch_id: "branch_forma_recovery",
        cover_image_url: "/images/service/massage.webp",
        status: "Active",
    },
    // Sauna — open session (drop-in, multi-customer).
    {
        id: "svc_sauna",
        category_id: "cat_yoga",
        name: "Sauna",
        description: "Drop-in infrared sauna session — open for the time slot, members rotate in as space allows.",
        is_recovery: true,
        open_session: true,
        duration_min: 30,
        capacity: 6,
        price: 95,
        branch_id: "branch_forma_recovery",
        cover_image_url: "/images/service/sauna.webp",
        status: "Active",
    },
    // Breathwork — open session (group, larger capacity).
    {
        id: "svc_breathwork",
        category_id: "cat_yoga",
        name: "Breathwork",
        description: "Guided breathwork session for nervous system regulation. Drop in anytime during the slot.",
        is_recovery: true,
        open_session: true,
        duration_min: 45,
        capacity: 10,
        price: 120,
        branch_id: "branch_forma_recovery",
        cover_image_url: "/images/service/breathwork.webp",
        status: "Active",
    },
    // IV therapy — private recovery, seasonally paused (Inactive).
    {
        id: "svc_iv_therapy",
        category_id: "cat_pilates",
        name: "IV therapy",
        description: "Private IV vitamin therapy session with a licensed nurse. 30-minute hydration + micronutrient drip.",
        is_recovery: true,
        open_session: false,
        duration_min: 30,
        capacity: 0,
        price: 450,
        branch_id: "branch_forma_recovery",
        cover_image_url: "/images/service/iv-therapy.webp",
        status: "Inactive",
    },
];
