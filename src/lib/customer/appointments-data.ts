"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Appointments data layer (Search → Appointments tab)
// ─────────────────────────────────────────────────────────────────────────────
//
// Appointments are bookable SERVICES (vs Classes = group sessions). Two session
// types, structured the same way so the UI is reusable:
//   • Private (default) — always 1:1, requires an instructor (booked against
//     instructor availability).
//   • Open session — no instructor, multiple participants (a capacity badge),
//     booked against branch hours.
//
// UI-ONLY for now: admin appointment data is not ready, so the list below is a
// MOCK placeholder behind a typed hook — swap `MOCK_APPOINTMENTS` for the real
// store slice when it ships. No business logic (availability/booking) here.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { ALL_BRANCHES, useCurrentCustomerContext } from "./context";
import type { SearchFilters } from "./search-data";

export type AppointmentType = "private" | "open";

export interface AppointmentService {
    id: string;
    name: string;
    type: AppointmentType;
    durationMins: number;
    /** AED price (UI placeholder until appointment pricing is wired). */
    price: number;
    /** Category name — matches the admin `class_categories` so the filter works. */
    category: string;
    branchId: string;
    coverImage?: string;
    coverColor: string;
    /** Open sessions only — max participants (drives the capacity badge). */
    capacity?: number;
}

export interface AppointmentVM extends AppointmentService {
    branchName: string;
}

const SOUTH = "branch_forma_south";
const EAST = "branch_forma_east";
// Spa branch — recovery services live here per the Module 13 update.
// IV therapy + Breathwork are recovery services, so they belong on Spa,
// not SOUTH. Club-only mock services (Spin / HIIT / Private Barre) stay
// on SOUTH since they're non-recovery.
const SPA = "branch_forma_spa";

// MOCK — placeholder until the admin appointment service catalog ships.
const MOCK_APPOINTMENTS: AppointmentService[] = [
    { id: "appt_private_reformer", name: "Private Reformer", type: "private", durationMins: 30, price: 147, category: "Pilates", branchId: SOUTH, coverImage: "/images/class-template/reformer-pilates.webp", coverColor: "#fee4e2" },
    { id: "appt_private_mat", name: "Private Mat Pilates", type: "private", durationMins: 30, price: 147, category: "Pilates", branchId: SOUTH, coverImage: "/images/class-template/private-reformer.webp", coverColor: "#fee4e2" },
    { id: "appt_iv_therapy", name: "IV Therapy", type: "private", durationMins: 30, price: 147, category: "Strength", branchId: SPA, coverImage: "/images/class-template/roller-release.webp", coverColor: "#eef1f6" },
    { id: "appt_breathwork", name: "Breathwork", type: "private", durationMins: 30, price: 147, category: "Yoga", branchId: SPA, coverImage: "/images/class-template/hot-yoga.webp", coverColor: "#fff8e9" },
    { id: "appt_private_barre", name: "Private Barre", type: "private", durationMins: 45, price: 147, category: "Barre", branchId: SOUTH, coverImage: "/images/class-template/berre.webp", coverColor: "#e9fbff" },
    { id: "appt_spin_session", name: "Open Spin Session", type: "open", durationMins: 45, price: 147, category: "Cycling", branchId: SOUTH, coverImage: "/images/class-categories/cycling.png", coverColor: "#eefcf3", capacity: 8 },
    { id: "appt_hiit_bootcamp", name: "HIIT Bootcamp", type: "open", durationMins: 45, price: 147, category: "HIIT", branchId: SOUTH, coverImage: "/images/class-categories/hiit.png", coverColor: "#fff0ef", capacity: 12 },
    { id: "appt_reformer_east", name: "Private Reformer", type: "private", durationMins: 30, price: 147, category: "Pilates", branchId: EAST, coverImage: "/images/class-template/reformer-pilates.webp", coverColor: "#fee4e2" },
    { id: "appt_strength_east", name: "Strength Coaching", type: "private", durationMins: 60, price: 147, category: "Strength", branchId: EAST, coverImage: "/images/class-categories/strength.png", coverColor: "#eef1f6" },
];

/** A single appointment service by id (with its branch name resolved). */
export function useAppointment(id: string): AppointmentVM | null {
    const branches = useAppStore((s) => s.branches);
    return useMemo(() => {
        const a = MOCK_APPOINTMENTS.find((x) => x.id === id);
        if (!a) return null;
        return { ...a, branchName: branches.find((b) => b.id === a.branchId)?.name ?? "" };
    }, [id, branches]);
}

/** Active-branch appointment services, narrowed by the (categories-only) filter. */
export function useAppointments(filters: SearchFilters): AppointmentVM[] {
    const { selectedBranchId } = useCurrentCustomerContext();
    const branches = useAppStore((s) => s.branches);

    return useMemo(() => {
        const isAll = selectedBranchId === ALL_BRANCHES;
        return MOCK_APPOINTMENTS.filter((a) => isAll || a.branchId === selectedBranchId)
            .filter((a) => filters.categories.length === 0 || filters.categories.includes(a.category))
            .map((a) => ({ ...a, branchName: branches.find((b) => b.id === a.branchId)?.name ?? "" }));
    }, [selectedBranchId, branches, filters.categories]);
}
