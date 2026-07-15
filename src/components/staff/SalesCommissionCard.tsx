"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Shared Sales-commission card (categorised — commission refactor Phase 3)
// ─────────────────────────────────────────────────────────────────────────────
//
// Renders the "Sales commission" panel: total AED headline + one row per
// commission category the staff earned in (% or fixed AED), plus any
// threshold bonuses that fired.
//
// Consumer: Payroll detail (`PayrollInstructorDetailPage`) — for any staff on
// a pay rate with commission / bonus rows. The math is `commissionForPeriod`
// in @/lib/payroll-calc; this component just renders the CommissionBreakdown.

import { aed, type CommissionBreakdown, type CommissionLine, type BonusLine } from "@/lib/payroll-calc";
import { COMMISSION_CATEGORY_LABEL } from "@/lib/commission";

export function SalesCommissionCard({ commission }: { commission: CommissionBreakdown }) {
    const lines = commission.lines;
    const firedBonuses = commission.bonusLines.filter(b => b.fired);
    const pendingBonuses = commission.bonusLines.filter(b => !b.fired);

    return (
        <div className="border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-4 bg-white">
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <p className="text-[14px] font-semibold text-[#101828]">Sales commission</p>
                    <p className="text-[13px] text-[#667085] leading-[18px]">
                        Earned on sales &amp; bookings credited to this staff in the selected period.
                    </p>
                </div>
                <p className="text-[20px] font-semibold text-[#101828] leading-[28px]">{aed(commission.totalCommission)}</p>
            </div>

            {(lines.length > 0 || commission.bonusLines.length > 0) && <div className="h-px w-full bg-[#e4e7ec]" />}

            {/* Commission rows */}
            {lines.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                    {lines.map((l, i) => <CommissionRow key={`c${i}`} line={l} />)}
                </div>
            )}

            {/* Bonuses */}
            {commission.bonusLines.length > 0 && (
                <>
                    <p className="text-[13px] font-medium text-[#667085]">Bonuses</p>
                    <div className="flex flex-col gap-2">
                        {firedBonuses.map((b, i) => <BonusRow key={`bf${i}`} bonus={b} />)}
                        {pendingBonuses.map((b, i) => <BonusRow key={`bp${i}`} bonus={b} />)}
                    </div>
                </>
            )}

            {lines.length === 0 && commission.bonusLines.length === 0 && (
                <p className="text-[13px] text-[#667085]">No commission configured on this pay rate.</p>
            )}

            {commission.refundTransactionIds.length > 0 && (
                <p className="text-[12px] text-[#667085] leading-[16px]">
                    Refunds &amp; voids in the period reduce the net sales figure before commission is applied.
                </p>
            )}
        </div>
    );
}

function CommissionRow({ line }: { line: CommissionLine }) {
    const label = COMMISSION_CATEGORY_LABEL[line.category];
    const math = line.valueType === "percent"
        ? `${line.value}% × ${aed(line.baseAed)}`
        : `${aed(line.value)} × ${line.count}`;
    const subLabel = line.valueType === "percent" ? "net sales" : "sales";
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[13px] text-[#667085]">{label}</p>
            <p className="text-[15px] font-medium text-[#101828] leading-[22px]">
                {line.count} {subLabel}
            </p>
            <p className="text-[13px] text-[#475467]">{math} = <span className="font-medium text-[#101828]">{aed(line.commissionAed)}</span></p>
        </div>
    );
}

function BonusRow({ bonus }: { bonus: BonusLine }) {
    const label = COMMISSION_CATEGORY_LABEL[bonus.category];
    const reward = bonus.valueType === "percent" ? `${bonus.value}%` : aed(bonus.value);
    return (
        <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-[#475467]">
                {label} — {reward} after {bonus.threshold} ({bonus.count}/{bonus.threshold})
            </p>
            {bonus.fired
                ? <span className="text-[13px] font-medium text-[#067647]">{aed(bonus.bonusAed)}</span>
                : <span className="text-[12px] font-medium text-[#98a2b3]">Not yet</span>}
        </div>
    );
}
