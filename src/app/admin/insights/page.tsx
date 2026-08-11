"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Insights page (/admin/insights)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 3636:11138 (Finance) + 3610:90785 (Memberships).
//
// Three category tabs — Finance / Memberships / Classes — each with a metric
// grid on top and the dashboard's existing widget cards below. The same
// `<DashboardWidgetCard>` and `WIDGET_CATALOG` powering the dashboard's
// Performance tab are reused 1:1 (no duplication).
//
// Layout per tab:
//   1. Tabs strip
//   2. Toolbar — "Total · N {category} KPIs" + search + period dropdown
//   3. Metric grid (4 per row, gap-6)
//   4. Widget grid (2 per row, gap-6) using <DashboardWidgetCard widgetId=... />
//
// Search filters BOTH the metric grid and the widget grid by label/title
// (case-insensitive). The period dropdown is a UI placeholder for now —
// widgets render their own mock period internally; live filtering arrives
// when the data layer is wired.

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { SearchMd } from "@untitledui/icons";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { DashboardWidgetCard } from "@/components/dashboard/DashboardWidgetCard";
import { WIDGET_CATALOG, type WidgetCategory } from "@/components/dashboard/widget-catalog";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { InsightMetricCard } from "@/components/insights/InsightMetricCard";
import { useInsightsMetrics } from "@/lib/insights/use-insights-metrics";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = "finance" | "memberships" | "classes";

interface TabConfig {
    key: TabKey;
    label: string;
    /** Category used to filter the widget catalog. */
    widgetCategory: WidgetCategory;
}

// The metric tiles are now derived LIVE from the store + the shared recognized-
// revenue engine, scoped to the selected period with a prior-period delta — see
// `useInsightsMetrics`. The widget grid below already renders real derived data
// via the dashboard's WIDGET_CATALOG.

const TABS: TabConfig[] = [
    { key: "finance",     label: "Finance",     widgetCategory: "Finance" },
    { key: "memberships", label: "Memberships", widgetCategory: "Memberships" },
    { key: "classes",     label: "Classes",     widgetCategory: "Classes" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
//
// Wrapped in <Suspense> because InsightsInner reads useSearchParams (for
// the ?tab= AI-Agent deep-link pre-filter). Without the boundary, Next
// opts every /admin/insights render out of static prerendering.

export default function InsightsPage() {
    return (
        <Suspense fallback={null}>
            <InsightsInner />
        </Suspense>
    );
}

/** Valid TabKey (or fallback to finance) parsed from the `?tab=` URL
 *  param. The AI Agent's "Go to insight" chip navigates here with the
 *  tab pre-selected — see engine.ts `insightsDeepLink()`. */
function readTabFromUrl(raw: string | null): TabKey {
    if (raw === "finance" || raw === "memberships" || raw === "classes") {
        return raw;
    }
    return "finance";
}

function InsightsInner() {
    const searchParams = useSearchParams();
    const [tab, setTab] = useState<TabKey>(() =>
        readTabFromUrl(searchParams.get("tab")),
    );
    const [search, setSearch] = useState("");
    const [period, setPeriod] = useState<DateFilter>({ type: "week", label: "This week" });

    const activeTab = TABS.find(t => t.key === tab)!;
    const widgetsInCategory = useMemo(
        () => WIDGET_CATALOG.filter(w => w.category === activeTab.widgetCategory),
        [activeTab.widgetCategory],
    );

    // Live metric tiles for the selected period (prior-period delta baked in).
    const metricsByTab = useInsightsMetrics(period);
    const activeMetrics = metricsByTab[tab];

    // Search filters metrics + widgets simultaneously, case-insensitive.
    const q = search.trim().toLowerCase();
    const filteredMetrics = q
        ? activeMetrics.filter(m => m.label.toLowerCase().includes(q))
        : activeMetrics;
    const filteredWidgets = q
        ? widgetsInCategory.filter(w =>
            w.title.toLowerCase().includes(q) || w.description.toLowerCase().includes(q))
        : widgetsInCategory;

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Tab strip */}
            <div className="border-b border-[var(--colors-border-secondary)]">
                <div className="flex gap-3 items-start">
                    {TABS.map(t => (
                        <button key={t.key} type="button" onClick={() => setTab(t.key)}
                            className={cn(
                                "flex gap-2 h-8 items-center justify-center pb-3 px-1 transition-colors",
                                tab === t.key
                                    ? "border-b-2 border-[var(--colors-text-primary)] text-[var(--colors-text-primary)] font-semibold"
                                    : "text-[var(--colors-text-quaternary)] font-semibold hover:text-[var(--colors-text-secondary)]",
                            )}>
                            <span className="text-sm">{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <div className="flex-1" />
                <ToolbarSearch value={search} onChange={setSearch} placeholder="Search insight..." />
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

            {/* Widget grid — reuses the dashboard's WIDGET_CATALOG + DashboardWidgetCard. */}
            {filteredWidgets.length > 0 && (
                <div className="grid grid-cols-2 gap-6">
                    {filteredWidgets.map(w => (
                        <DashboardWidgetCard key={w.id} widgetId={w.id} period={period} />
                    ))}
                </div>
            )}

            {/* Empty state (search matched nothing) */}
            {q && filteredMetrics.length === 0 && filteredWidgets.length === 0 && (
                <div className="bg-white border-1 border-dashed border-[var(--colors-border-secondary)] rounded-[16px] p-12 flex flex-col items-center gap-1 text-center">
                    <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">No insights found</p>
                    <p className="text-[14px] text-[var(--colors-text-tertiary)]">Try a different search term.</p>
                </div>
            )}
        </div>
    );
}
