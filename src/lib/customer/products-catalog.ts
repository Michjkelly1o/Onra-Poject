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

import { useEffect, useMemo } from "react";
import { useAppStore, type CustomerPlan } from "@/lib/store";
import { ALL_BRANCHES, useCurrentCustomerContext } from "@/lib/customer/context";
import type { PlanRow } from "@/lib/customer/purchase";

function fmtLongDate(iso?: string): string {
    if (!iso) return "—";
    // Accept both date-only ("2026-07-01") and full ISO timestamps (purchased plans).
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
    return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtMonthDay(iso?: string): string {
    if (!iso) return "—";
    // Accept both date-only ("2026-07-01") and full ISO timestamps (purchased plans).
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
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
                creditBadge: { big: m.credits === "unlimited" ? "∞" : String(m.credits), small: "credits" },
            }));

        const packageRows: PlanRow[] = packages
            .filter((p) => p.status === "active" && inBranch(p.branch_ids))
            .map((p) => ({
                id: p.id,
                kind: "package" as const,
                name: p.name,
                sub: `${p.credits} credit${p.credits === 1 ? "" : "s"} • ${fmtValidity(p.validity_days)}`,
                price: p.price_aed,
                creditBadge: { big: String(p.credits), small: p.credits === 1 ? "credit" : "credits" },
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
                    creditBadge: { big: String(base), small: "AED" },
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
    const customerPlans = useAppStore((s) => s.customerPlans);
    return useMemo(() => {
        if (!member || !member.planKind || !member.planName) return null;
        // Only surface the Active Plan card while the customer HOLDS a plan (active
        // or frozen) — read straight from customerPlans, independent of
        // member.membershipId, so a cancelled / expired plan reliably hides it.
        const held = customerPlans.some(
            (p) => p.customerId === member.id && (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested"),
        );
        if (!held) return null;
        const credits = typeof member.creditsRemaining === "number" ? member.creditsRemaining : null;
        const creditsLabel = credits === null ? "Active" : `${credits} credit${credits === 1 ? "" : "s"} remaining`;
        const expiry = member.planExpiryISO ? ` • expires ${fmtMonthDay(member.planExpiryISO)}` : "";
        return { name: member.planName, sub: `${creditsLabel}${expiry}` };
    }, [member, customerPlans]);
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

export interface CreditBalanceVM {
    kind: "membership" | "package";
    /** "Membership" or "Credit package" — the active plan type. */
    typeLabel: string;
    /** Unlimited membership → show "Unlimited credits" + a full progress bar. */
    unlimited: boolean;
    /** Credits left across the active plan(s) — the canonical member balance. */
    remaining: number;
    /** Total credits the active plan(s) grant (summed across packages). */
    total: number;
    /** Active plan expiry (latest across packages) — drives "Expires on". */
    expiryISO?: string;
}

/** Credit-balance summary for the profile card: type + credits-left + total +
 *  expiry, derived from the member's ACTIVE plan(s). A customer holds one
 *  membership OR one-or-more packages, so `total` sums the held packages. */
export function useCreditBalance(): CreditBalanceVM | null {
    const { member } = useCurrentCustomerContext();
    const customerPlans = useAppStore((s) => s.customerPlans);
    return useMemo(() => {
        if (!member || !member.planKind) return null;
        const kind = member.planKind; // "membership" | "package"
        const held = customerPlans.filter(
            (p) =>
                p.customerId === member.id &&
                p.kind === kind &&
                (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested"),
        );
        if (held.length === 0) return null;
        // Unlimited memberships carry no numeric credit balance.
        const unlimited = kind === "membership" && member.creditsRemaining === undefined;
        const remaining = member.creditsRemaining ?? 0;
        // A finite plan with 0 credits left is spent → surface it as "No active
        // plan" so the profile card prompts the customer to browse a new plan.
        if (!unlimited && remaining <= 0) return null;
        const total = held.reduce((n, p) => n + (p.totalCredits ?? 0), 0);
        // Expiry = the latest expiry across the held plan(s), read straight from the
        // plan rows (the flat member.planExpiryISO can be stale / unset in the seed).
        const expiryISO = held
            .map((p) => p.expiryISO)
            .filter((iso): iso is string => !!iso)
            .sort()
            .at(-1);
        return {
            kind,
            typeLabel: kind === "membership" ? "Membership" : "Credit package",
            unlimited,
            remaining,
            // Never let the summed total read below the live remaining (keeps the
            // progress bar within 0–100%).
            total: Math.max(total, remaining),
            expiryISO,
        };
    }, [member, customerPlans]);
}

/** True when the active/frozen plan set breaks the "one membership OR many
 *  packages" rule — i.e. two+ active memberships, or a membership alongside a
 *  package. (Multiple active packages are fine.) */
export function isPlanSetInvalid(activePlans: { kind: CustomerPlan["kind"] }[]): boolean {
    const memberships = activePlans.filter((p) => p.kind === "membership").length;
    const packages = activePlans.filter((p) => p.kind === "package").length;
    return memberships >= 2 || (memberships >= 1 && packages >= 1);
}

/** Given the active/frozen plans, decide which stay active. The most recently
 *  purchased active plan's KIND wins: a membership winner keeps ONLY itself (one
 *  active membership ever); a package winner keeps every active package and drops
 *  all memberships. Returns the ids to cancel. */
export function planIdsToCancel(activePlans: CustomerPlan[]): string[] {
    if (!isPlanSetInvalid(activePlans)) return [];
    const winner = [...activePlans].sort((a, b) =>
        (b.purchasedAtISO ?? "").localeCompare(a.purchasedAtISO ?? ""),
    )[0];
    return activePlans
        .filter((p) => (winner.kind === "membership" ? p.id !== winner.id : p.kind !== "package"))
        .map((p) => p.id);
}

/**
 * Invariant self-heal: a customer holds ONE active membership OR one-or-more
 * active credit packages — never two memberships and never a membership + a
 * package. If legacy / corrupt persisted state violates this, cancel the extras
 * (keeping the most recently purchased plan / kind) so every customer surface —
 * My plan, the credit-balance card, the Products gating — reads a valid state.
 * Fires only on a violation (a no-op for clean data) and converges in one pass.
 * Uses the same `cancelCustomerPlan` action the manual flows use (no store changes).
 */
export function useReconcileMemberPlans(): void {
    const { member } = useCurrentCustomerContext();
    const customerPlans = useAppStore((s) => s.customerPlans);
    const cancelCustomerPlan = useAppStore((s) => s.cancelCustomerPlan);
    useEffect(() => {
        if (!member) return;
        const active = customerPlans.filter(
            (p) =>
                p.customerId === member.id &&
                p.kind !== "complimentary" &&
                (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested"),
        );
        for (const id of planIdsToCancel(active)) {
            cancelCustomerPlan(id, "period_end", "Switched plan — only one plan type can be active");
        }
    }, [member, customerPlans, cancelCustomerPlan]);
}

/** Subtitle for the Products "Active plan" card + anywhere the credit balance is
 *  summarised: "6/10 credits left • expires Apr 20" (membership / packages), or
 *  "Unlimited credits • expires …" for an unlimited membership. Expiry is the
 *  newest across held packages (already resolved in the VM). */
export function formatCreditBalanceSub(bal: CreditBalanceVM): string {
    const credits = bal.unlimited ? "Unlimited credits" : `${bal.remaining}/${bal.total} credits left`;
    const expiry = bal.expiryISO ? ` • expires ${fmtMonthDay(bal.expiryISO)}` : "";
    return `${credits}${expiry}`;
}
