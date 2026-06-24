// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `services` seed (Appointment services — Module 13)
// ─────────────────────────────────────────────────────────────────────────────
//
// Service is the appointment-side counterpart to `class_templates`. Each
// row defines a bookable service blueprint that spawns appointments. Two
// shapes exist:
//
//   • Open session  — multi-customer, `capacity` is meaningful
//   • Private       — 1 customer + 1 instructor, `capacity` persisted as 0
//
// 6 demo services — one per image asset under /public/images/service/. Mix
// of Open session vs Private + Active vs Inactive statuses so the list
// page + filter side panel exercise every state on first load.
//
// FKs:
//   category_id              → class_categories.id
//   branch_id                → branches.id
//   applicable_membership_ids → memberships.id[]
//   applicable_package_ids    → packages.id[]

import type { Service } from "./_types";

/** Most services accept all memberships + packages — trim the arrays here
 *  when access rules need to differ per service. */
const ALL_MEMBERSHIPS = ["mem_beginner_monthly", "mem_advanced_monthly", "mem_unlimited_monthly"];
const ALL_PACKAGES    = ["pkg_1_class_intro", "pkg_5_class", "pkg_10_class", "pkg_20_class"];

export const services: Service[] = [
    // Private — Reformer Pilates (1-on-1)
    {
        id: "svc_private_reformer",
        category_id: "cat_pilates",
        name: "Private Reformer",
        description: "1-on-1 Reformer Pilates session tailored to your goals. Ideal for first-timers and post-rehab clients.",
        open_session: false,
        duration_min: 60,
        capacity: 0,
        branch_id: "branch_forma_south",
        cover_image_url: "/images/service/private-reformer.webp",
        status: "Active",
        applicable_membership_ids: ALL_MEMBERSHIPS,
        applicable_package_ids: ALL_PACKAGES,
    },
    // Private — Mat Pilates
    {
        id: "svc_private_mat_pilates",
        category_id: "cat_pilates",
        name: "Private Mat Pilates",
        description: "1-on-1 mat-based Pilates focused on core control and alignment.",
        open_session: false,
        duration_min: 45,
        capacity: 0,
        branch_id: "branch_forma_south",
        cover_image_url: "/images/service/private-mat-pilates.webp",
        status: "Active",
        applicable_membership_ids: ALL_MEMBERSHIPS,
        applicable_package_ids: ALL_PACKAGES,
    },
    // Private — Massage (recovery treatment)
    {
        id: "svc_massage",
        category_id: "cat_pilates",
        name: "Massage",
        description: "1-on-1 deep tissue or sports massage with a licensed therapist. 60 minutes of targeted recovery work.",
        open_session: false,
        duration_min: 60,
        capacity: 0,
        branch_id: "branch_forma_south",
        cover_image_url: "/images/service/massage.webp",
        status: "Active",
        applicable_membership_ids: ALL_MEMBERSHIPS,
        applicable_package_ids: ALL_PACKAGES,
    },
    // Open session — Sauna (drop-in, no instructor, capacity-limited)
    {
        id: "svc_sauna",
        category_id: "cat_yoga",
        name: "Sauna",
        description: "Drop-in infrared sauna session — open for the time slot, members rotate in as space allows.",
        open_session: true,
        duration_min: 30,
        capacity: 6,
        branch_id: "branch_forma_south",
        cover_image_url: "/images/service/sauna.webp",
        status: "Active",
        applicable_membership_ids: ALL_MEMBERSHIPS,
        applicable_package_ids: ALL_PACKAGES,
    },
    // Open session — Breathwork (group, larger capacity)
    {
        id: "svc_breathwork",
        category_id: "cat_yoga",
        name: "Breathwork",
        description: "Guided breathwork session for nervous system regulation. Drop in anytime during the slot.",
        open_session: true,
        duration_min: 45,
        capacity: 10,
        branch_id: "branch_forma_south",
        cover_image_url: "/images/service/breathwork.webp",
        status: "Active",
        applicable_membership_ids: ALL_MEMBERSHIPS,
        applicable_package_ids: ALL_PACKAGES,
    },
    // Private — IV therapy (Inactive, seasonal pause)
    {
        id: "svc_iv_therapy",
        category_id: "cat_pilates",
        name: "IV therapy",
        description: "Private IV vitamin therapy session with a licensed nurse. 30-minute hydration + micronutrient drip.",
        open_session: false,
        duration_min: 30,
        capacity: 0,
        branch_id: "branch_forma_east",
        cover_image_url: "/images/service/iv-therapy.webp",
        status: "Inactive",
        applicable_membership_ids: ALL_MEMBERSHIPS,
        applicable_package_ids: ALL_PACKAGES,
    },
];
