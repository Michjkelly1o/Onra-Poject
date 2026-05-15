// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `class_templates` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 4 templates — exactly one per `class_categories` entry — so every category
// is realised in the UI (no orphan categories on filters / dashboards).
//
// Each template lists which memberships + packages grant access. For the
// prototype all four templates accept all 3 memberships and all 4 packages;
// when access rules need to differ per category, just trim the arrays here.
//
// Cover images live under /public/images/class-template/.
//
// FKs:
//   category_id              → class_categories.id
//   applicable_membership_ids → memberships.id[]
//   applicable_package_ids    → packages.id[]

import type { ClassTemplate } from "./_types";

/** All memberships + all packages accept every template by default. */
const ALL_MEMBERSHIPS = ["mem_beginner_monthly", "mem_advanced_monthly", "mem_unlimited_monthly"];
const ALL_PACKAGES    = ["pkg_1_class_intro", "pkg_5_class", "pkg_10_class", "pkg_20_class"];

export const class_templates: ClassTemplate[] = [
    {
        id: "tpl_reformer_pilates",
        category_id: "cat_pilates",
        name: "Reformer Pilates",
        description: "Full-body workout on the Pilates reformer. Builds core strength, improves posture and flexibility.",
        location_type: "Group",
        duration_min: 60,
        capacity: 12,
        cover_image_url: "/images/class-template/reformer-pilates.webp",
        status: "Active",
        applicable_membership_ids: ALL_MEMBERSHIPS,
        applicable_package_ids: ALL_PACKAGES,
    },
    {
        id: "tpl_barre",
        category_id: "cat_barre",
        name: "Barre",
        description: "Ballet-inspired low-impact workout that sculpts and tones using small isometric movements.",
        location_type: "Group",
        duration_min: 60,
        capacity: 15,
        cover_image_url: "/images/class-template/berre.webp",
        status: "Active",
        applicable_membership_ids: ALL_MEMBERSHIPS,
        applicable_package_ids: ALL_PACKAGES,
    },
    {
        id: "tpl_hot_yoga",
        category_id: "cat_yoga",
        name: "Hot Yoga",
        description: "Traditional Hatha yoga sequence practised in a heated room to increase flexibility and detoxify.",
        location_type: "Group",
        duration_min: 75,
        capacity: 16,
        cover_image_url: "/images/class-template/hot-yoga.webp",
        status: "Active",
        applicable_membership_ids: ALL_MEMBERSHIPS,
        applicable_package_ids: ALL_PACKAGES,
    },
    {
        id: "tpl_roller_release",
        category_id: "cat_roller_release",
        name: "Roller Release",
        description: "A foam roller–based recovery class to release muscle tension, improve mobility, and boost circulation.",
        location_type: "Group",
        duration_min: 45,
        capacity: 8,
        cover_image_url: "/images/class-template/roller-release.webp",
        status: "Active",
        applicable_membership_ids: ALL_MEMBERSHIPS,
        applicable_package_ids: ALL_PACKAGES,
    },
];
