"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared payroll earnings breakdown + commission accordions
// ─────────────────────────────────────────────────────────────────────────────
//
// The SINGLE source for the "Total earnings breakdown" and "Sales commission"
// collapsible sections. Reused verbatim by BOTH:
//   • Admin  → Staff Payroll Details  (PayrollInstructorDetailPage)
//   • Instructor → My Earnings         (/instructor/earnings)
//
// Same accordion component, spacing, typography, alignment and expand/collapse
// behaviour on every surface — change it here once and both pick it up (client
// 2026-07-29). The figures are always supplied by the shared payroll calculator
// (`totalEarningsForStaff`), so the two pages stay numerically identical too.
//
// Figma: 8015-219885 (Total earnings breakdown accordion).

import { useState } from "react";
import { ChevronDown } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { fmtAed as aed, type PayConfigBaseBreakdown, type CommissionBreakdown } from "@/lib/payroll-calc";
import { SalesCommissionCard } from "@/components/staff/SalesCommissionCard";

// ─── Collapsible section (accordion) ──────────────────────────────────────
// A clickable header (title + subtitle on the left, value + chevron vertically
// centered on the right) that reveals its body. Default collapsed. Matches
// Figma 8015-219885 exactly — p-4 / rounded-12, 16px semibold value, 14px rows,
// a divider under the header when open, no hover state.
export function PayrollAccordion({ title, subtitle, value, defaultOpen = false, children }: {
    title: string;
    subtitle?: string;
    value?: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] p-4 flex flex-col gap-3">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                className="w-full flex items-center justify-between gap-4 text-left"
            >
                <div className="flex-1 min-w-0 flex flex-col">
                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-[20px]">{title}</p>
                    {subtitle && <p className="text-[14px] font-normal text-[var(--colors-text-quaternary)] leading-[20px]">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {value && <span className="text-[16px] font-semibold text-[var(--colors-text-primary)] leading-[24px] whitespace-nowrap">{value}</span>}
                    <ChevronDown className={cn("w-4 h-4 text-[var(--colors-text-quaternary)] transition-transform", open && "rotate-180")} />
                </div>
            </button>
            {open && (
                <>
                    <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />
                    {children}
                </>
            )}
        </div>
    );
}

/** One label ↔ value row inside the Total earnings breakdown (Figma
 *  8015-219885 — 14px, quaternary label, primary medium value). */
export function BreakdownRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between w-full">
            <span className="text-[14px] font-normal text-[var(--colors-text-quaternary)] leading-[20px]">{label}</span>
            <span className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-[20px]">{value}</span>
        </div>
    );
}

// ─── Total earnings breakdown ──────────────────────────────────────────────
//
// Splits the payout across every earning source. For an instructor it always
// lists Default pay rate · Pay per class · Pay per private (a disabled / empty
// track reads AED 0) so the breakdown reflects the pay-rate configuration;
// other staff only ever have the Default rate. Sales commission is listed when
// any. The parts always sum to `total` because they all come from the same
// `totalEarningsForStaff` result.
export function TotalEarningsBreakdown({ trackBreakdown, commissionAed, total, isInstructor, subtitle = "All earnings earned so far this month." }: {
    trackBreakdown: PayConfigBaseBreakdown;
    commissionAed: number;
    total: number;
    isInstructor: boolean;
    subtitle?: string;
}) {
    return (
        <PayrollAccordion title="Total earnings breakdown" subtitle={subtitle} value={aed(total)}>
            <div className="flex flex-col gap-2 w-full">
                <div className="flex flex-col gap-1 w-full">
                    {isInstructor ? (
                        <>
                            <BreakdownRow label="Default pay rate" value={aed(trackBreakdown.defaultBase)} />
                            <BreakdownRow label="Pay per class" value={aed(trackBreakdown.perClass)} />
                            <BreakdownRow label="Pay per private" value={aed(trackBreakdown.perAppointment)} />
                        </>
                    ) : (
                        trackBreakdown.defaultBase > 0 && (
                            <BreakdownRow label="Default pay rate" value={aed(trackBreakdown.defaultBase)} />
                        )
                    )}
                    {commissionAed > 0 && (
                        <BreakdownRow label="Sales commission" value={aed(commissionAed)} />
                    )}
                </div>
                <div className="flex items-center justify-between w-full">
                    <span className="text-[14px] font-semibold text-[var(--colors-text-primary)] leading-[20px]">Total earnings</span>
                    <span className="text-[16px] font-semibold text-[var(--colors-text-primary)] leading-[24px]">{aed(total)}</span>
                </div>
            </div>
        </PayrollAccordion>
    );
}

// ─── Sales commission ──────────────────────────────────────────────────────
//
// Same accordion interaction; body reuses the existing commission breakdown
// (embedded, headerless).
export function SalesCommissionAccordion({ commission, subtitle = "Earned on sales & bookings credited to this staff in the selected period." }: {
    commission: CommissionBreakdown;
    subtitle?: string;
}) {
    return (
        <PayrollAccordion title="Sales commission" subtitle={subtitle} value={aed(commission.totalCommission)}>
            <SalesCommissionCard commission={commission} embedded />
        </PayrollAccordion>
    );
}
