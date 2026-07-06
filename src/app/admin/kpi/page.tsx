"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — KPI page (/admin/kpi)
// ─────────────────────────────────────────────────────────────────────────────
//
// KPI catalogue from new-prd/Onra_KPI_Catalogue.pdf. Four category tabs —
// Financial · Client · Class · Marketing — each rendered with the SAME
// chrome as /admin/insights:
//
//   1. Tabs strip
//   2. Toolbar — "Total · N X KPIs" + search + period dropdown
//   3. Metric grid (4 per row, gap-6)  — the KPI cards
//   4. Widget grid (2 per row, gap-6)  — Recharts widgets from WIDGET_CATALOG
//
// Layout, components, and styling are IDENTICAL to Insights. Only the
// data (KPI list per tab) and the chart types inside the widget cards
// differ — those land in Phases 2-5.
//
// Phase 1: scaffolding only. Every tab renders with an empty state.
//
// Not covered (out of scope per plan):
//   • Inventory KPIs (13) — no retail module
//   • Forward/live KPIs (4) — Dashboard's territory per PDF
//
// See new-prd/kpi-implementation-plan.md for the full phase timeline.

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SearchMd } from "@untitledui/icons";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { DashboardWidgetCard } from "@/components/dashboard/DashboardWidgetCard";
import { WIDGET_CATALOG, type WidgetCategory } from "@/components/dashboard/widget-catalog";
import { InsightMetricCard, type Metric } from "@/components/insights/InsightMetricCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = "financial" | "client" | "class" | "marketing";

interface TabConfig {
    key: TabKey;
    label: string;
    /** Category used to filter WIDGET_CATALOG for this tab. */
    widgetCategory: WidgetCategory;
    metrics: Metric[];
}

// ─── Tab content (Phase 1: empty; populated per phase) ────────────────────────

const FINANCIAL_METRICS: Metric[] = [];
const CLIENT_METRICS: Metric[]    = [];
const CLASS_METRICS: Metric[]     = [];
const MARKETING_METRICS: Metric[] = [];

const TABS: TabConfig[] = [
    { key: "financial", label: "Financial", widgetCategory: "Financial", metrics: FINANCIAL_METRICS },
    { key: "client",    label: "Client",    widgetCategory: "Client",    metrics: CLIENT_METRICS    },
    { key: "class",     label: "Class",     widgetCategory: "Class",     metrics: CLASS_METRICS     },
    { key: "marketing", label: "Marketing", widgetCategory: "Marketing", metrics: MARKETING_METRICS },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KpiPage() {
    const [tab, setTab] = useState<TabKey>("financial");
    const [search, setSearch] = useState("");
    const [period, setPeriod] = useState<DateFilter>({ type: "week", label: "This week" });

    const activeTab = TABS.find(t => t.key === tab)!;
    const widgetsInCategory = useMemo(
        () => WIDGET_CATALOG.filter(w => w.category === activeTab.widgetCategory),
        [activeTab.widgetCategory],
    );

    // Search filters metrics + widgets simultaneously, case-insensitive.
    const q = search.trim().toLowerCase();
    const filteredMetrics = q
        ? activeTab.metrics.filter(m => m.label.toLowerCase().includes(q))
        : activeTab.metrics;
    const filteredWidgets = q
        ? widgetsInCategory.filter(w =>
            w.title.toLowerCase().includes(q) || w.description.toLowerCase().includes(q))
        : widgetsInCategory;

    const kpiLabel = `${activeTab.label.toLowerCase()} KPIs`;

    // Phase 1 empty state — surfaces when a tab has no metrics AND no
    // widgets yet. Uses the same dashed-border card style Insights uses
    // for its "search matched nothing" state.
    const showPhaseEmptyState = !q
        && filteredMetrics.length === 0
        && filteredWidgets.length === 0;

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Tab strip */}
            <div className="border-b border-[#e4e7ec]">
                <div className="flex gap-3 items-start">
                    {TABS.map(t => (
                        <button key={t.key} type="button" onClick={() => setTab(t.key)}
                            className={cn(
                                "flex gap-2 h-8 items-center justify-center pb-3 px-1 transition-colors",
                                tab === t.key
                                    ? "border-b-2 border-[#101828] text-[#101828] font-semibold"
                                    : "text-[#667085] font-semibold hover:text-[#344054]",
                            )}>
                            <span className="text-sm">{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <div className="flex-1 flex flex-col">
                    <p className="text-[14px] text-[#667085]">Total</p>
                    <p className="text-[14px] font-medium text-[#101828]">
                        {filteredMetrics.length} {kpiLabel}
                    </p>
                </div>
                <div className="relative w-[220px]">
                    <SearchMd className="absolute left-[14px] top-1/2 -translate-y-1/2 w-5 h-5 text-[#667085]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search KPI..."
                        className="h-10 w-full pl-[44px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>
                <DateRangeFilter value={period} onChange={setPeriod} />
            </div>

            {/* Metric grid */}
            {filteredMetrics.length > 0 && (
                <div className="grid grid-cols-4 gap-6">
                    {filteredMetrics.map(m => (
                        <InsightMetricCard key={m.label} metric={m} />
                    ))}
                </div>
            )}

            {/* Widget grid — reuses WIDGET_CATALOG + DashboardWidgetCard. */}
            {filteredWidgets.length > 0 && (
                <div className="grid grid-cols-2 gap-6">
                    {filteredWidgets.map(w => (
                        <DashboardWidgetCard key={w.id} widgetId={w.id} period={period} />
                    ))}
                </div>
            )}

            {/* Phase 1 scaffolding — empty state. Removed once each tab
                gets its metric cards + widgets in Phases 2-5. */}
            {showPhaseEmptyState && (
                <div className="bg-white border-1 border-dashed border-[#e4e7ec] rounded-[16px] p-12 flex flex-col items-center gap-1 text-center">
                    <p className="text-[16px] font-semibold text-[#101828]">
                        {activeTab.label} KPIs — coming soon
                    </p>
                    <p className="text-[14px] text-[#475467]">
                        Metric cards + widget charts land in the phase for this tab.
                    </p>
                </div>
            )}

            {/* Empty state (search matched nothing) — same chrome as Insights. */}
            {q && filteredMetrics.length === 0 && filteredWidgets.length === 0 && (
                <div className="bg-white border-1 border-dashed border-[#e4e7ec] rounded-[16px] p-12 flex flex-col items-center gap-1 text-center">
                    <p className="text-[16px] font-semibold text-[#101828]">No KPIs found</p>
                    <p className="text-[14px] text-[#475467]">Try a different search term.</p>
                </div>
            )}
        </div>
    );
}
