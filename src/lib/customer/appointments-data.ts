"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Appointments data layer (Search → Appointments tab)
// ─────────────────────────────────────────────────────────────────────────────
//
// Appointments are bookable SERVICES from the admin catalog (`services` store
// slice) — vs Classes = group sessions. Two customer-facing session types, mapped
// from the service's `openSession`:
//   • Private (openSession=false) — a 1-on-1 session; the booking flow chooses an
//     instructor first, then the time slot.
//   • Open session (openSession=true) — no instructor, a set capacity; time slots
//     follow the branch's working hours.
//
// Branch scope follows the branch KIND (the admin rule):
//   • Club branches host ONLY private (non-recovery) services — e.g. Private Reformer.
//   • Spa branches host BOTH private (recovery — e.g. Massage) AND open-session
//     services (e.g. Sauna, Breathwork).
// Services are already branch-scoped in the seed; the kind filter enforces the rule.

import { useMemo } from "react";
import { useAppStore, type Service } from "@/lib/store";
import { ALL_BRANCHES, useCurrentCustomerContext } from "./context";
import type { SearchFilters } from "./search-data";

export type AppointmentType = "private" | "open";

export interface AppointmentVM {
    id: string;
    name: string;
    /** Service description — shown on the booking-detail (reused class layout). */
    description: string;
    /** "private" (1-on-1) or "open" (multi-participant). Drives the card badge + flow. */
    type: AppointmentType;
    durationMins: number;
    /** Fixed AED price paid at appointment checkout. */
    price: number;
    /** Category name — matches the admin class_categories so the filter works. */
    category: string;
    branchId: string;
    branchName: string;
    /** True = Spa recovery service (no instructor in the seed). */
    isRecovery: boolean;
    coverImage?: string;
    coverColor: string;
    /** Open sessions only — max participants (drives the capacity badge). */
    capacity?: number;
}

function toVM(s: Service): AppointmentVM {
    return {
        id: s.id,
        name: s.name,
        description: s.description,
        type: s.openSession ? "open" : "private",
        durationMins: s.durationMin,
        price: s.price,
        category: s.category,
        branchId: s.branchId,
        branchName: s.branchName,
        isRecovery: s.isRecovery,
        coverImage: s.coverImage,
        coverColor: s.coverColor,
        capacity: s.openSession ? s.capacity : undefined,
    };
}

/** A single appointment (service) by id. */
export function useAppointment(id: string): AppointmentVM | null {
    const services = useAppStore((s) => s.services);
    return useMemo(() => {
        const s = services.find((x) => x.id === id);
        return s ? toVM(s) : null;
    }, [id, services]);
}

/** Active-branch appointment services, narrowed by the (categories-only) filter.
 *  Admin rule: Club branches offer only private appointments; Spa branches offer
 *  both private and open-session appointments. */
export function useAppointments(filters: SearchFilters): AppointmentVM[] {
    const { selectedBranchId } = useCurrentCustomerContext();
    const services = useAppStore((s) => s.services);

    return useMemo(() => {
        const isAll = selectedBranchId === ALL_BRANCHES;
        return services
            .filter((s) => s.status === "Active")
            .filter((s) => isAll || s.branchId === selectedBranchId)
            // Club branches (kind !== "spa") never offer open sessions — private only.
            .filter((s) => s.branchKind === "spa" || !s.openSession)
            .filter((s) => filters.categories.length === 0 || filters.categories.includes(s.category))
            .map(toVM);
    }, [selectedBranchId, services, filters.categories]);
}
