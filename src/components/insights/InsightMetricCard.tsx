"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared insight metric card
// ─────────────────────────────────────────────────────────────────────────────
//
// The single-value KPI tile used by BOTH the Insights module
// (/admin/insights) and the KPI module (/admin/kpi). Extracted verbatim
// from Insights so both surfaces render identical cards.
//
// Card structure:
//   • Label row: 14px muted text + info tooltip icon
//   • Value:     24px semibold
//   • Change:    signed % chip (green up / red down) + period label
//
// The `change` field is optional — when absent, only the period label
// renders (no chip). The `period` label defaults to "vs last week" to
// match the Insights source, but any comparison label works.

import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, InfoCircle } from "@untitledui/icons";

export interface Metric {
    label: string;
    value: string;
    /** Change %, signed. Undefined → no badge (just "vs last week"). */
    change?: number;
    /** Default "vs last week". */
    period?: string;
}

export function InsightMetricCard({ metric }: { metric: Metric }) {
    const hasChange = typeof metric.change === "number";
    const positive = (metric.change ?? 0) >= 0;
    const periodLabel = metric.period ?? "vs last week";
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-2">
            {/* Label + info */}
            <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] text-[#667085]">{metric.label}</p>
                <InfoCircle className="w-5 h-5 text-[#98a2b3] shrink-0" />
            </div>
            {/* Value */}
            <p className="text-[24px] font-semibold text-[#101828] leading-[32px]">{metric.value}</p>
            {/* Change row */}
            <div className="flex items-center gap-1">
                {hasChange && (
                    <span className={cn(
                        "inline-flex items-center gap-0.5 pl-1.5 pr-2 py-0.5 rounded-full text-[12px] font-medium border-1",
                        positive
                            ? "bg-[#ecfdf3] border-[#abefc6] text-[#067647]"
                            : "bg-[#fef3f2] border-[#fecdca] text-[#b42318]",
                    )}>
                        {positive
                            ? <ArrowUp className="w-3 h-3" />
                            : <ArrowDown className="w-3 h-3" />}
                        {Math.abs(metric.change!)}%
                    </span>
                )}
                <p className="text-[14px] text-[#667085]">{periodLabel}</p>
            </div>
        </div>
    );
}
