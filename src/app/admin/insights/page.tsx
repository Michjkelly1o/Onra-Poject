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
import { InsightMetricCard, type Metric } from "@/components/insights/InsightMetricCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = "finance" | "memberships" | "classes";

interface TabConfig {
    key: TabKey;
    label: string;
    /** Category used to filter the widget catalog. */
    widgetCategory: WidgetCategory;
    metrics: Metric[];
}

// ─── Tab content ──────────────────────────────────────────────────────────────
//
// Finance + Memberships metric values match the Figma exactly. Classes is a
// sensible default (no Figma supplied yet) — same shape, ready to swap when
// the spec lands. All values are mock for now; widgets render their own
// derived data via the existing dashboard catalog.

const FINANCE_METRICS: Metric[] = [
    { label: "Net revenue",                value: "AED 752",   change: 8 },
    { label: "Revenue from subscriptions", value: "AED 120",   change: 2 },
    { label: "Revenue from packages",      value: "AED 390",   change: 30 },
    { label: "Payment amount dues",        value: "AED 345",   change: 100 },
    { label: "Revenue from classes",       value: "AED 1,620", change: 8 },
    { label: "Revenue from products",      value: "AED 112",   change: -5 },
    { label: "Revenue from gift cards",    value: "AED 104",   change: 2 },
    { label: "Payments collected",         value: "AED 407",   change: 30 },
];

const MEMBERSHIP_METRICS: Metric[] = [
    { label: "Active memberships",               value: "7",   change: 2 },
    { label: "Active subscriptions",             value: "14",  change: 4 },
    { label: "Active packages",                  value: "4",   change: 4 },
    { label: "Active intro offers",              value: "4",   change: -5 },
    { label: "Membership cancellations",         value: "2",   change: 2 },
    { label: "Memberships suspended",            value: "0" },
    { label: "Memberships with billing issue",   value: "4",   change: 2 },
    { label: "Membership cancellations %",       value: "1%",  change: 2 },
    { label: "Memberships suspended %",          value: "0%" },
    { label: "Memberships with billing issue %", value: "2%",  change: 2 },
];

const CLASSES_METRICS: Metric[] = [
    { label: "Total class scheduled",     value: "175",    change: 8 },
    { label: "Total class check-ins",     value: "5",      change: -5 },
    { label: "Revenue per class",         value: "AED 162", change: -30 },
    { label: "Revenue per visit",         value: "AED 62", change: -5 },
    { label: "Unique visitors",           value: "3",      change: 8 },
    { label: "First time class visitors", value: "1",      change: -5 },
    { label: "Class occupancy rate",      value: "1%",     change: -10 },
];

const TABS: TabConfig[] = [
    { key: "finance",     label: "Finance",     widgetCategory: "Finance",     metrics: FINANCE_METRICS },
    { key: "memberships", label: "Memberships", widgetCategory: "Memberships", metrics: MEMBERSHIP_METRICS },
    { key: "classes",     label: "Classes",     widgetCategory: "Classes",     metrics: CLASSES_METRICS },
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

    // Search filters metrics + widgets simultaneously, case-insensitive.
    const q = search.trim().toLowerCase();
    const filteredMetrics = q
        ? activeTab.metrics.filter(m => m.label.toLowerCase().includes(q))
        : activeTab.metrics;
    const filteredWidgets = q
        ? widgetsInCategory.filter(w =>
            w.title.toLowerCase().includes(q) || w.description.toLowerCase().includes(q))
        : widgetsInCategory;

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
                <div className="flex-1" />
                <div className="relative w-[220px]">
                    <SearchMd className="absolute left-[14px] top-1/2 -translate-y-1/2 w-5 h-5 text-[#667085]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search insight..."
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
                <div className="bg-white border-1 border-dashed border-[#e4e7ec] rounded-[16px] p-12 flex flex-col items-center gap-1 text-center">
                    <p className="text-[16px] font-semibold text-[#101828]">No insights found</p>
                    <p className="text-[14px] text-[#475467]">Try a different search term.</p>
                </div>
            )}
        </div>
    );
}
