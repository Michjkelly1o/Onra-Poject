"use client";

// Customer — plan card (membership + credit package) for My plan.
// Active = coloured tile + green status/price + green progress.
// Frozen / Cancelled = disabled grey tile + quaternary (#667085) status, muted price.

import { AlertCircle } from "@untitledui/icons";
import type { CustomerPlan } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ProductCreditTile } from "@/components/customer/products/ProductCreditTile";
import { aed, dayMonthYear, shortDate } from "@/lib/customer/profile-format";

function totalCredits(label: string): number | null {
    if (/unlimited/i.test(label)) return null;
    const m = label.match(/\d+/);
    return m ? Number(m[0]) : null;
}
function validityLabel(plan: CustomerPlan): string {
    const days = Math.max(
        1,
        Math.round((new Date(plan.expiryISO).getTime() - new Date(plan.purchasedAtISO).getTime()) / 86_400_000),
    );
    const months = Math.round(days / 30);
    return months >= 1 ? `${months} month${months > 1 ? "s" : ""}` : `${days} days`;
}

export function PlanCard({
    plan,
    creditsRemaining,
    onFreeze,
    onUnfreeze,
    onCancel,
    onReactivate,
    canReactivate = false,
}: {
    plan: CustomerPlan;
    creditsRemaining?: number;
    onFreeze: () => void;
    onUnfreeze: () => void;
    onCancel: () => void;
    onReactivate: () => void;
    /** Reactivate is offered only for a cancelled MEMBERSHIP while the customer
     *  holds no other active plan (packages never reactivate). */
    canReactivate?: boolean;
}) {
    const isMembership = plan.kind === "membership";
    // Only an ACTIVE plan is "live" — frozen / cancelled / expired / removed all
    // render as a disabled (grey) card with a muted status.
    const isLive = plan.status === "active" || plan.status === "frozen";
    const disabled = plan.status !== "active";

    const total = totalCredits(plan.creditsLabel);
    const bigCredits = total === null ? "∞" : String(total);
    const remaining = isMembership ? (creditsRemaining ?? total ?? 0) : (total ?? 0);
    const creditLine = total === null ? "Unlimited credits" : `${remaining} credits left`;
    const pct = total === null ? 100 : total > 0 ? Math.min(100, Math.max(0, (remaining / total) * 100)) : 0;
    const nextBilling = shortDate(new Date(new Date(plan.expiryISO).getTime() - 86_400_000).toISOString());

    const statusLine =
        plan.status === "frozen"
            ? `Frozen until: ${plan.freezeEndISO ? dayMonthYear(plan.freezeEndISO) : "—"}`
            : plan.status === "cancelled"
              ? "Cancelled"
              : plan.status === "expired"
                ? "Expired"
                : plan.status === "removed"
                  ? "Removed"
                  : "Active";

    return (
        <div className="flex flex-col gap-4 rounded-2xl border border-[#eaecf0] bg-white p-4">
            <div className="flex items-center gap-3">
                <ProductCreditTile
                    kind={isMembership ? "membership" : "package"}
                    big={bigCredits}
                    small="credits"
                    size={48}
                    disabled={disabled}
                />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">{plan.name}</p>
                    <p className={`text-sm font-normal leading-5 ${disabled ? "text-[#667085]" : "text-[var(--brand-primary)]"}`}>
                        {statusLine}
                    </p>
                </div>
                <div className="shrink-0 text-right">
                    <p className={`text-sm font-semibold leading-5 ${disabled ? "text-[#667085]" : "text-[var(--brand-primary)]"}`}>
                        {aed(plan.priceAed ?? 0)}
                    </p>
                    <p className="text-sm font-normal leading-5 text-[#667085]">
                        {isMembership ? "per month" : validityLabel(plan)}
                    </p>
                </div>
            </div>

            {!isLive ? (
                <div className="flex items-start gap-2 rounded-xl border border-[#fee4e2] bg-[#fffbfa] p-3">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#d92d20]" aria-hidden />
                    <p className="text-sm leading-5 text-[#667085]">
                        {plan.status === "cancelled"
                            ? `Your subscription ends on ${shortDate(plan.expiryISO)}. You will keep access until then.`
                            : plan.status === "expired"
                              ? `This plan expired on ${shortDate(plan.expiryISO)}.`
                              : "This plan is no longer available."}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-2 rounded-[10px] bg-[#f2f4f7] px-3 pb-4 pt-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-normal leading-5 text-[#667085]">{creditLine}</span>
                        {!isMembership && (
                            <span className="text-sm font-normal leading-5 text-[#667085]">End {shortDate(plan.expiryISO)}</span>
                        )}
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-[#e4e7ec]">
                        <div
                            className={`h-full rounded-full ${plan.status === "frozen" ? "bg-[#98a2b3]" : "bg-[var(--brand-primary)]"}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            )}

            {isMembership && isLive && (
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-normal leading-5 text-[#667085]">Next billing date</span>
                        <span className="text-sm font-medium leading-5 text-[var(--brand-text)]">{nextBilling}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-normal leading-5 text-[#667085]">Expiry date</span>
                        <span className="text-sm font-medium leading-5 text-[var(--brand-text)]">{shortDate(plan.expiryISO)}</span>
                    </div>
                </div>
            )}

            {plan.status === "cancelled" ? (
                canReactivate ? (
                    <Button variant="primary" size="md" className="w-full rounded-full" onClick={onReactivate}>
                        Reactivate plan
                    </Button>
                ) : null
            ) : isLive ? (
                <div className="flex gap-3">
                    <Button
                        variant="secondary-gray"
                        size="md"
                        className="flex-1 rounded-full font-semibold text-[#b42318]"
                        onClick={onCancel}
                    >
                        Cancel
                    </Button>
                    {plan.status === "frozen" ? (
                        <Button variant="secondary-gray" size="md" className="flex-1 rounded-full" onClick={onUnfreeze}>
                            Unfreeze
                        </Button>
                    ) : (
                        <Button variant="secondary-gray" size="md" className="flex-1 rounded-full" onClick={onFreeze}>
                            Freeze
                        </Button>
                    )}
                </div>
            ) : null}
        </div>
    );
}
