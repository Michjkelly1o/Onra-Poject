"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Products catalog data (Memberships · Credit Packages · Gift Cards)
// ─────────────────────────────────────────────────────────────────────────────
//
// Branch-scoped, active-only catalog for the Products tab. Memberships + packages
// reuse the PlanRow shape from purchase.ts; gift-card designs map to the same shape
// with `giftCard` metadata (fixed vs custom amount). The member's active plan
// (one membership OR packages) drives the Active Plan card + hides its "+" in the
// list (you can't re-buy what you already hold).

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { ALL_BRANCHES, useCurrentCustomerContext } from "@/lib/customer/context";
import type { PlanRow } from "@/lib/customer/purchase";

function fmtLongDate(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtMonthDay(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtValidity(days: number): string {
    if (days > 0 && days % 30 === 0) {
        const m = days / 30;
        return `${m} month${m === 1 ? "" : "s"}`;
    }
    return `${days} day${days === 1 ? "" : "s"}`;
}

export interface CatalogProducts {
    /** Memberships first, then credit packages (the "Packages" tab + the top of "All"). */
    plans: PlanRow[];
    /** Gift-card designs (the "Gift card" tab + the bottom section of "All"). */
    giftCards: PlanRow[];
}

export function useCatalogProducts(): CatalogProducts {
    const { selectedBranchId } = useCurrentCustomerContext();
    const memberships = useAppStore((s) => s.memberships);
    const packages = useAppStore((s) => s.packages);
    const giftCardDesigns = useAppStore((s) => s.giftCardDesigns);

    return useMemo(() => {
        const isAll = selectedBranchId === ALL_BRANCHES;
        const inBranch = (branchIds?: string[]) => isAll || (branchIds ?? []).includes(selectedBranchId);

        const membershipRows: PlanRow[] = memberships
            .filter((m) => m.status === "active" && inBranch(m.branch_ids))
            .map((m) => ({
                id: m.id,
                kind: "membership" as const,
                name: m.name,
                sub: `${m.credits === "unlimited" ? "Unlimited" : `${m.credits} credit${m.credits === 1 ? "" : "s"}`} • ${m.duration_months} month${m.duration_months === 1 ? "" : "s"}`,
                price: m.price_aed,
            }));

        const packageRows: PlanRow[] = packages
            .filter((p) => p.status === "active" && inBranch(p.branch_ids))
            .map((p) => ({
                id: p.id,
                kind: "package" as const,
                name: p.name,
                sub: `${p.credits} credit${p.credits === 1 ? "" : "s"} • ${fmtValidity(p.validity_days)}`,
                price: p.price_aed,
            }));

        const giftCards: PlanRow[] = giftCardDesigns
            .filter((g) => g.status === "active")
            .map((g) => {
                const validLabel = g.no_expiry ? "No expiry" : `Valid until ${fmtLongDate(g.valid_until_date)}`;
                const isCustom = g.value_type === "custom";
                const base = (isCustom ? g.min_value_aed : g.fixed_value_aed) ?? g.price_aed ?? 0;
                return {
                    id: g.id,
                    kind: "gift_card" as const,
                    name: g.name,
                    sub: validLabel,
                    price: base,
                    priceLabel: isCustom ? `Start from AED ${g.min_value_aed ?? 0}` : `AED ${base}`,
                    giftCard: {
                        valueType: g.value_type,
                        fixedValue: g.fixed_value_aed,
                        minValue: g.min_value_aed,
                        maxValue: g.max_value_aed,
                        validLabel,
                    },
                };
            });

        return { plans: [...membershipRows, ...packageRows], giftCards };
    }, [selectedBranchId, memberships, packages, giftCardDesigns]);
}

export interface ActivePlanVM {
    name: string;
    /** "12 credits remaining • expires Jun 30". */
    sub: string;
}

/** The member's current plan (one membership OR packages), or null. */
export function useActivePlan(): ActivePlanVM | null {
    const { member } = useCurrentCustomerContext();
    return useMemo(() => {
        if (!member || !member.planKind || !member.planName) return null;
        const credits = typeof member.creditsRemaining === "number" ? member.creditsRemaining : null;
        const creditsLabel = credits === null ? "Active" : `${credits} credit${credits === 1 ? "" : "s"} remaining`;
        const expiry = member.planExpiryISO ? ` • expires ${fmtMonthDay(member.planExpiryISO)}` : "";
        return { name: member.planName, sub: `${creditsLabel}${expiry}` };
    }, [member]);
}

/** Product ids the member already holds — their "+" is hidden in the list. */
export function useOwnedProductIds(): Set<string> {
    const { member } = useCurrentCustomerContext();
    return useMemo(() => {
        const ids = new Set<string>();
        if (member?.membershipId) ids.add(member.membershipId);
        for (const id of member?.packageIds ?? []) ids.add(id);
        return ids;
    }, [member]);
}
