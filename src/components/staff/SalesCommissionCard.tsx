"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Shared Sales-commission card
// ─────────────────────────────────────────────────────────────────────────────
//
// Renders the "Sales commission" panel: total AED headline + per-kind
// breakdown (packages / memberships) with "N% × AED X = AED Y" math.
//
// Consumers:
//   • Staff Detail (Overview tab)  — for non-instructor staff on a
//     Monthly rate with commission % set. Feeds live commission from
//     POS attributions.
//
// The math itself is `commissionForPeriod(...)` in @/lib/payroll-calc —
// this component just renders whatever `CommissionBreakdown` is passed
// in. Callers gate the visibility (Monthly rate + non-zero percent).

import { aed, type CommissionBreakdown } from "@/lib/payroll-calc";

export function SalesCommissionCard({ commission }: { commission: CommissionBreakdown }) {
    const hasPackages    = commission.packagesPercent > 0;
    const hasMemberships = commission.membershipsPercent > 0;
    return (
        <div className="border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-4 bg-white">
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <p className="text-[14px] font-semibold text-[#101828]">Sales commission</p>
                    <p className="text-[13px] text-[#667085] leading-[18px]">
                        Earned on POS sales credited to this staff in the selected period.
                    </p>
                </div>
                <p className="text-[20px] font-semibold text-[#101828] leading-[28px]">{aed(commission.totalCommission)}</p>
            </div>
            <div className="h-px w-full bg-[#e4e7ec]" />
            <div className="grid grid-cols-2 gap-4">
                {hasPackages && (
                    <CommissionLine
                        label="Packages"
                        salesAed={commission.packagesSalesAed}
                        percent={commission.packagesPercent}
                        commissionAed={commission.packagesCommission}
                    />
                )}
                {hasMemberships && (
                    <CommissionLine
                        label="Memberships"
                        salesAed={commission.membershipsSalesAed}
                        percent={commission.membershipsPercent}
                        commissionAed={commission.membershipsCommission}
                    />
                )}
            </div>
            {commission.refundTransactionIds.length > 0 && (
                <p className="text-[12px] text-[#667085] leading-[16px]">
                    Refunds &amp; voids in the period reduce the net sales figure before commission is applied.
                </p>
            )}
        </div>
    );
}

function CommissionLine({ label, salesAed, percent, commissionAed }: {
    label: string; salesAed: number; percent: number; commissionAed: number;
}) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[13px] text-[#667085]">{label}</p>
            <p className="text-[15px] font-medium text-[#101828] leading-[22px]">{aed(salesAed)} <span className="text-[13px] text-[#667085]">net sales</span></p>
            <p className="text-[13px] text-[#475467]">{percent}% × {aed(salesAed)} = <span className="font-medium text-[#101828]">{aed(commissionAed)}</span></p>
        </div>
    );
}
