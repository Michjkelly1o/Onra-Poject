// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Card dispatcher (Phase 5)
// ─────────────────────────────────────────────────────────────────────────────
//
// One component that switches on the `card` discriminator returned by the
// engine and renders the matching Tailwind-styled body. Each card body sits
// inside a shared `<CardShell>` (white surface, border, rounded, xs shadow)
// so the visual rhythm stays consistent whether the model returns a metric
// group, a chart, a table, or a ranked list.
//
// Ported from ONRA AI-Agent/components/Cards.tsx. Structure kept identical
// (same switch on `card`, same `DeepLink` sub-component); class strings
// converted from POC's globals.css `.card / .tiles / .item` to Tailwind
// tokens matching Syncfit's DS.

"use client";

import { useRouter } from "next/navigation";
import type { DeepLink as DeepLinkData, InsightCard } from "@/ai-agent/agent/cards";
import { ArrowUpRight } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { BarChart } from "@/ai-agent/components/charts/BarChart";
import { LineChart } from "@/ai-agent/components/charts/LineChart";
import { Donut } from "@/ai-agent/components/charts/Donut";
import { ExportCard } from "@/ai-agent/components/cards/ExportCard";

function CardShell({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "bg-white border border-[#e4e7ec] rounded-xl p-4",
                "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                "flex flex-col gap-3",
                className,
            )}
        >
            {children}
        </div>
    );
}

function CardTitle({ children }: { children: React.ReactNode }) {
    return (
        <h4 className="text-[14px] font-semibold text-[#101828] leading-5">
            {children}
        </h4>
    );
}

function CardNote({ children }: { children?: React.ReactNode }) {
    if (!children) return null;
    return (
        <p className="text-[13px] text-[#667085] leading-5">{children}</p>
    );
}

/** Phase 12 — one row of a ranked_list card. Clickable when `row.href`
 *  is set (find_customer → profile, list_create_shortcuts → new-record
 *  form). Non-clickable rows stay as plain divs to keep the visual
 *  rhythm of the top-N list unchanged.
 *
 *  Kept as a separate component (not inline JSX) so the useRouter hook
 *  is called at the top of the row, respecting the rules of hooks. */
function RankedListRow({
    row: r,
}: {
    row: import("@/ai-agent/agent/cards").RankedRow;
}) {
    const router = useRouter();
    const clickable = !!r.href;
    const body = (
        <>
            <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-[#101828] leading-5 truncate">
                    {r.title}
                </div>
                {r.subtitle && (
                    <div className="text-[13px] text-[#667085] leading-5 truncate">
                        {r.subtitle}
                    </div>
                )}
            </div>
            <div className="text-right shrink-0">
                {r.right1 && (
                    <div className="text-[14px] font-medium text-[#101828] leading-5 tabular-nums">
                        {r.right1}
                    </div>
                )}
                {r.right2 && (
                    <div className="text-[13px] text-[#667085] leading-5 tabular-nums">
                        {r.right2}
                    </div>
                )}
                {clickable && (
                    <ArrowUpRight className="inline-block size-3.5 text-[#4b8c9a]" />
                )}
            </div>
        </>
    );
    if (clickable) {
        return (
            <button
                type="button"
                onClick={() => router.push(r.href!)}
                className={cn(
                    "w-full text-left flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0 -mx-2 px-2 rounded-md",
                    "hover:bg-[#f9fafb] transition-colors",
                )}
            >
                {body}
            </button>
        );
    }
    return (
        <div className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            {body}
        </div>
    );
}

/** Phase 10 — the deep-link chip. If `link.href` is present, clicking
 *  navigates the tester to that route via Next.js's client-side router
 *  (no full page reload). Backwards-compat: still accepts nothing (chip
 *  hidden). */
function DeepLink({ link }: { link?: DeepLinkData }) {
    const router = useRouter();
    if (!link || !link.label) return null;
    return (
        <button
            type="button"
            onClick={() => router.push(link.href)}
            className="self-start inline-flex items-center gap-1 text-[13px] font-medium text-[#4b8c9a] hover:text-[#306b78] hover:underline underline-offset-4"
        >
            <ArrowUpRight className="size-3.5" />
            {link.label}
        </button>
    );
}

export function Card({ data }: { data: InsightCard }) {
    if (!data || typeof data !== "object" || !("card" in data)) return null;

    if (data.card === "line_chart") {
        return (
            <CardShell>
                <CardTitle>{data.title}</CardTitle>
                <LineChart series={data.series} unit={data.unit} valueLabel={data.valueLabel} />
                <CardNote>{data.note}</CardNote>
                <DeepLink link={data.deepLink} />
            </CardShell>
        );
    }

    if (data.card === "bar_chart") {
        return (
            <CardShell>
                <CardTitle>{data.title}</CardTitle>
                <BarChart bars={data.bars} unit={data.unit} maxValue={data.maxValue} />
                <CardNote>{data.note}</CardNote>
                <DeepLink link={data.deepLink} />
            </CardShell>
        );
    }

    if (data.card === "donut") {
        return (
            <CardShell>
                <CardTitle>{data.title}</CardTitle>
                <Donut
                    segments={data.segments}
                    unit={data.unit}
                    centerLabel={data.centerLabel}
                    centerValue={data.centerValue}
                />
                <CardNote>{data.note}</CardNote>
                <DeepLink link={data.deepLink} />
            </CardShell>
        );
    }

    if (data.card === "metric_group") {
        return (
            <CardShell>
                {data.title && <CardTitle>{data.title}</CardTitle>}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {data.tiles.map((t, i) => (
                        <div
                            key={i}
                            className="rounded-lg bg-[#f9fafb] border border-[#eaecf0] p-3 flex flex-col gap-1"
                        >
                            <div className="text-[12px] text-[#667085] leading-4">
                                {t.label}
                            </div>
                            <div className="text-[18px] font-semibold text-[#101828] leading-6 tabular-nums">
                                {t.value}
                            </div>
                        </div>
                    ))}
                </div>
                <CardNote>{data.note}</CardNote>
                <DeepLink link={data.deepLink} />
            </CardShell>
        );
    }

    if (data.card === "ranked_list") {
        return (
            <CardShell>
                <CardTitle>{data.title}</CardTitle>
                <div className="flex flex-col divide-y divide-[#eaecf0]">
                    {data.rows.map((r, i) => (
                        <RankedListRow key={i} row={r} />
                    ))}
                </div>
                <CardNote>{data.note}</CardNote>
                <DeepLink link={data.deepLink} />
            </CardShell>
        );
    }

    if (data.card === "data_table") {
        return (
            <CardShell>
                <div className="overflow-x-auto -mx-4 px-4">
                    <table className="w-full text-[13px] border-collapse">
                        <thead>
                            <tr className="border-b border-[#eaecf0]">
                                {data.columns.map((c, i) => (
                                    <th
                                        key={i}
                                        className="text-left font-medium text-[#667085] py-2 px-3 whitespace-nowrap"
                                    >
                                        {c}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.map((row, i) => (
                                <tr key={i} className="border-b border-[#f2f4f7] last:border-b-0">
                                    {row.map((cell, j) => (
                                        <td
                                            key={j}
                                            className="text-[#344054] py-2 px-3 whitespace-nowrap tabular-nums"
                                        >
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <CardNote>{data.note}</CardNote>
            </CardShell>
        );
    }

    if (data.card === "export") {
        return (
            <ExportCard
                exportId={data.exportId}
                title={data.title}
                rowCount={data.rowCount}
                columns={data.columns}
            />
        );
    }

    if (data.card === "empty") {
        return (
            <CardShell className="text-center text-[13px] text-[#667085] py-6">
                {data.message}
            </CardShell>
        );
    }

    return null;
}
