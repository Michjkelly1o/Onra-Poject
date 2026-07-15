"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Appointments data layer (Search → Appointments tab)
// ─────────────────────────────────────────────────────────────────────────────
//
// Appointments are bookable SERVICES from the admin catalog (`services` store
// slice) — vs Classes = group sessions. Two customer-facing booking shapes,
// mapped from the service's `openSession`:
//   • Private (openSession=false) — a 1-on-1 session; the booking flow chooses an
//     instructor first, then the time slot.
//   • Open session (openSession=true) — no instructor, a set capacity; time slots
//     follow the branch's working hours.
//
// Session type (the `service.type` dimension): a service is "private" or
// "recovery" — any branch can host either, and open sessions only exist for
// recovery. The filter below keeps only sessions the customer can actually
// book: a private service is always 1-on-1, so it's never open.

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
    /** True = recovery/wellness service (derived from `service.type`). */
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
        isRecovery: s.type === "recovery",
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
 *  Only recovery services can be open-session; private services are always 1:1. */
export function useAppointments(filters: SearchFilters): AppointmentVM[] {
    const { selectedBranchId } = useCurrentCustomerContext();
    const services = useAppStore((s) => s.services);

    return useMemo(() => {
        const isAll = selectedBranchId === ALL_BRANCHES;
        return services
            .filter((s) => s.status === "Active")
            .filter((s) => isAll || s.branchId === selectedBranchId)
            // Open sessions only exist for recovery services; a private
            // service is always 1:1 (never open).
            .filter((s) => s.type === "recovery" || !s.openSession)
            .filter((s) => !filters.sessionType || s.type === filters.sessionType.toLowerCase())
            .filter((s) => filters.categories.length === 0 || filters.categories.includes(s.category))
            .map(toVM);
    }, [selectedBranchId, services, filters.sessionType, filters.categories]);
}
