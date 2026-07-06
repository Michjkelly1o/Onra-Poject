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
//   • Label row: 14px muted text + info tooltip icon (native title attr)
//   • Value:     24px semibold
//   • Change:    signed % chip (green up / red down) + period label
//
// Optional extensions used by the KPI module (Phase 6):
//   • description — hover text on the info icon (KPI catalogue "what it
//                   measures" copy)
//   • drillTo     — route the whole card navigates to on click, with
//                   ?range= query param appended when `rangeParam` is
//                   set. Cards without drillTo render non-interactive.

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, InfoCircle } from "@untitledui/icons";

export interface Metric {
    label: string;
    value: string;
    /** Change %, signed. Undefined → no badge (just "vs last week"). */
    change?: number;
    /** Default "vs last week". */
    period?: string;
    /** Hover text for the info icon (KPI catalogue "what it measures"). */
    description?: string;
    /** Route to navigate to on card click. When set, the whole card is
     *  a click target with hover feedback. */
    drillTo?: string;
    /** Query param appended to `drillTo` — carries the active date range
     *  so the destination Report pre-applies the same filter. */
    rangeParam?: string;
}

export function InsightMetricCard({ metric }: { metric: Metric }) {
    const router = useRouter();
    const hasChange = typeof metric.change === "number";
    const positive = (metric.change ?? 0) >= 0;
    const periodLabel = metric.period ?? "vs last week";
    const clickable = !!metric.drillTo;

    function handleClick() {
        if (!metric.drillTo) return;
        const url = metric.rangeParam
            ? `${metric.drillTo}?range=${encodeURIComponent(metric.rangeParam)}`
            : metric.drillTo;
        router.push(url);
    }

    return (
        <div
            onClick={clickable ? handleClick : undefined}
            className={cn(
                "bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-2 transition-all",
                clickable && "cursor-pointer hover:border-[#7ba08c] hover:shadow-[0px_2px_6px_rgba(122,160,140,0.15)]",
            )}
        >
            {/* Label + info — the info icon opens a visible floating
                tooltip on hover / focus when `description` is set, so
                admins can read the KPI-catalogue definition without
                relying on the browser's native `title` tooltip (which
                is slow to appear and gets swallowed by cursor:pointer
                on drill-through cards). Descriptionless metrics still
                render the icon greyed as a neutral divider. */}
            <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] text-[#667085]">{metric.label}</p>
                {metric.description ? (
                    <div
                        className="relative shrink-0 group/tip"
                        // Stop bubbling so hovering the icon on a
                        // clickable card doesn't trigger navigation.
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            tabIndex={0}
                            aria-label={`About ${metric.label}`}
                            className="flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#aad4bd]"
                        >
                            <InfoCircle className="w-5 h-5 text-[#98a2b3]" />
                        </button>
                        <div
                            role="tooltip"
                            className={cn(
                                "pointer-events-none absolute z-20 right-0 top-full mt-2 w-[260px]",
                                "rounded-[8px] bg-[#101828] px-3 py-2 text-[12px] leading-[18px] text-white",
                                "shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]",
                                "opacity-0 translate-y-[-2px] transition-all duration-150",
                                "group-hover/tip:opacity-100 group-hover/tip:translate-y-0",
                                "group-focus-within/tip:opacity-100 group-focus-within/tip:translate-y-0",
                            )}
                        >
                            {metric.description}
                        </div>
                    </div>
                ) : (
                    <InfoCircle className="w-5 h-5 text-[#98a2b3] shrink-0" />
                )}
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
