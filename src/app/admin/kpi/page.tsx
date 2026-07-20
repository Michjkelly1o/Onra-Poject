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
// data (KPI list per tab) and the chart selection differ.
//
// Phase 2 (this file): Financial tab fully wired. 10 KPI cards computed
// from real store data via `computeFinancialKpis`. 4 chart widgets
// reused from the existing "Finance" widget catalog (revenue-overview,
// sales-by-product, payments-collected, payments-by-source). The retired
// `payments-status` widget was folded into `payments-collected` (Jul 2026).
//
// Not covered per plan:
//   • Inventory KPIs (13) — no retail module
//   • Forward/live KPIs (4) — Dashboard's territory per PDF
//
// See new-prd/kpi-implementation-plan.md for the full phase timeline.

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SearchMd, MarkerPin01 } from "@untitledui/icons";
import { SelectInput } from "@/components/ui/select-input";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { DashboardWidgetCard } from "@/components/dashboard/DashboardWidgetCard";
import { WIDGET_CATALOG } from "@/components/dashboard/widget-catalog";
import { InsightMetricCard, type Metric } from "@/components/insights/InsightMetricCard";
import { useAppStore } from "@/lib/store";
import { resolveRangePair } from "@/lib/kpi/date-range";
import { computeFinancialKpis } from "@/lib/kpi/financial";
import { computeClientKpis } from "@/lib/kpi/client";
import { computeClassKpis } from "@/lib/kpi/class";
import { computeMarketingKpis } from "@/lib/kpi/marketing";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = "financial" | "client" | "class" | "marketing";

interface TabConfig {
    key: TabKey;
    label: string;
    /** Widget IDs to render on this tab (in order). Empty = no widget grid
     *  yet. Phase 2-5 fills each tab's list. */
    widgetIds: string[];
}

// ─── Tab widget selection ───────────────────────────────────────────────────
//
// Widgets reused from the existing WIDGET_CATALOG (Finance category
// today; other categories light up in later phases). The KPI page never
// duplicates widget definitions — it just picks which ones to render.

const TABS: TabConfig[] = [
    {
        key: "financial",
        label: "Financial",
        // Phase 2 hero charts — reuse existing Finance widgets that map
        // cleanly to the PDF's Financial charts:
        //   revenue-overview     → Net revenue vs last period (line)
        //   sales-by-product     → Sales by stream (bar)
        //   payments-collected   → Payments collected + failed overlay
        //                          (client Jul 2026 — the retired
        //                           `payments-status` merged in here).
        //   payments-by-source   → Payments by sales channel
        widgetIds: ["revenue-overview", "sales-by-product", "payments-collected", "payments-by-source"],
    },
    {
        key: "client",
        label: "Client",
        // Phase 3 hero charts — reuse existing Memberships widgets that
        // map cleanly to the PDF's Client charts:
        //   active-memberships   → Active members trend
        //   active-subscriptions → Active recurring subscriptions trend
        //   memberships-sold     → New sign-ups over time (proxy)
        //   top-memberships      → Top spenders / most-purchased plans (ranked)
        widgetIds: ["active-memberships", "active-subscriptions", "memberships-sold", "top-memberships"],
    },
    {
        key: "class",
        label: "Class",
        // Phase 4 hero charts — reuse existing Classes widgets:
        //   class-bookings       → Bookings over time
        //   bookings-by-source   → Where bookings come from (grouped bar)
        //   attendance-overview  → Attendance vs cancellations vs no-shows
        //   class-by-popularity  → Class popularity ranked
        widgetIds: ["class-bookings", "bookings-by-source", "attendance-overview", "class-by-popularity"],
    },
    {
        key: "marketing",
        label: "Marketing",
        // Phase 5 hero charts — new Marketing widgets added to the
        // catalog for the KPI module:
        //   kpi-leads-by-source      → Acquisition source split
        //   kpi-lead-funnel          → New → Trial → Paid funnel
        //   kpi-campaign-perf        → Campaign performance
        //   kpi-marketing-efficiency → CPL / CAC / ROAS trend
        widgetIds: ["kpi-leads-by-source", "kpi-lead-funnel", "kpi-campaign-perf", "kpi-marketing-efficiency"],
    },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KpiPage() {
    const [tab, setTab] = useState<TabKey>("financial");
    const [search, setSearch] = useState("");
    const [period, setPeriod] = useState<DateFilter>({ type: "week", label: "This week" });
    // Empty string = "All locations" (aggregate across every branch); any
    // non-empty value scopes every KPI + widget through `branchFilter` below.
    const [location, setLocation] = useState<string>("");

    // Store slices the KPI compute functions need. Zustand's per-slice
    // subscription means POS / booking / plan writes trigger recompute
    // in the same render tick.
    const customerTransactions = useAppStore(s => s.customerTransactions);
    const customerPlans        = useAppStore(s => s.customerPlans);
    const customers            = useAppStore(s => s.customers);
    const customerReferrals    = useAppStore(s => s.customerReferrals);
    const branches             = useAppStore(s => s.branches);
    const staff                = useAppStore(s => s.staff);
    const classSchedules       = useAppStore(s => s.classSchedules);
    const classBookings        = useAppStore(s => s.classBookings);

    // Date range → concrete current + prior windows.
    const range = useMemo(() => resolveRangePair(period), [period]);

    // Location filter — wired to the toolbar Location dropdown. When the
    // user picks a specific branch, every KPI + widget on the page recomputes
    // scoped to that branch's transactions/plans/schedules in the same render
    // tick. Empty string = "All locations" → null so helpers keep aggregate.
    const branchFilter: Set<string> | null = useMemo(
        () => location ? new Set([location]) : null,
        [location],
    );

    // Location dropdown options — only active branches can be a valid scope
    // (inactive/archived are hidden). Mirrors the dashboard picker so users
    // see one consistent Location control across modules.
    const locationOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({
            value: b.id,
            label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })),
        [branches],
    );

    // Pack the state slices into a single object for KPI helpers. Every
    // helper reads through the same shape so adding a new tab is a
    // one-import change.
    const kpiState = useMemo(() => ({
        customerTransactions, customerPlans, customers, customerReferrals,
        branches, staff, classSchedules, classBookings,
    } as unknown as import("@/lib/store").AppState),
    [customerTransactions, customerPlans, customers, customerReferrals, branches, staff, classSchedules, classBookings]);

    // Marketing tab needs additional slices — subscribe once here so
    // switching to that tab doesn't lag on first render.
    const leads                  = useAppStore(s => s.leads);
    const marketingCampaignStats = useAppStore(s => s.marketingCampaignStats);
    const marketingSpend         = useAppStore(s => s.marketingSpend);

    const marketingState = useMemo(() => ({
        ...kpiState,
        leads, marketingCampaignStats, marketingSpend,
    } as unknown as import("@/lib/store").AppState),
    [kpiState, leads, marketingCampaignStats, marketingSpend]);

    // KPI compute — memoised per tab, recomputed when slices or range change.
    const financialKpis = useMemo(() => computeFinancialKpis(kpiState, range, branchFilter), [kpiState, range, branchFilter]);
    const clientKpis    = useMemo(() => computeClientKpis(kpiState, range, branchFilter),    [kpiState, range, branchFilter]);
    const classKpis     = useMemo(() => computeClassKpis(kpiState, range, branchFilter),     [kpiState, range, branchFilter]);
    const marketingKpis = useMemo(() => computeMarketingKpis(marketingState, range, branchFilter), [marketingState, range, branchFilter]);

    // KPI metrics are NOT clickable per client Jul 2026 — this module
    // is a read-only overview. We strip `drillTo` (and its companion
    // `rangeParam`) so InsightMetricCard renders each tile non-
    // interactive; the info-icon tooltip is what admins hover for
    // context. Insights module still gets drill-through — the strip
    // is local to `/admin/kpi`.
    function withRange(list: Metric[]): Metric[] {
        return list.map(m => {
            const { drillTo: _drillTo, rangeParam: _rangeParam, ...rest } = m;
            return rest;
        });
    }
    const metricsByTab: Record<TabKey, Metric[]> = {
        financial: withRange(financialKpis),
        client:    withRange(clientKpis),
        class:     withRange(classKpis),
        marketing: withRange(marketingKpis),
    };

    const activeTab = TABS.find(t => t.key === tab)!;
    const activeMetrics = metricsByTab[activeTab.key];
    const widgetsForTab = useMemo(
        () => activeTab.widgetIds
            .map(id => WIDGET_CATALOG.find(w => w.id === id))
            .filter((w): w is NonNullable<typeof w> => !!w),
        [activeTab.widgetIds],
    );

    // Search filters metrics + widgets simultaneously, case-insensitive.
    const q = search.trim().toLowerCase();
    const filteredMetrics = q
        ? activeMetrics.filter(m => m.label.toLowerCase().includes(q))
        : activeMetrics;
    const filteredWidgets = q
        ? widgetsForTab.filter(w =>
            w.title.toLowerCase().includes(q) || w.description.toLowerCase().includes(q))
        : widgetsForTab;

    // Phase 1 empty state — surfaces when a tab has no metrics AND no
    // widgets yet. Removed once each tab gets its cards + widgets.
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
                <div className="flex-1" />
                <div className="relative w-[220px]">
                    <SearchMd className="absolute left-[14px] top-1/2 -translate-y-1/2 w-5 h-5 text-[#667085]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search KPI..."
                        className="h-10 w-full pl-[44px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>
                {/* Location picker — reused from the dashboard header
                    (same MarkerPin01 glyph + "All locations" sentinel). */}
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-5 h-5" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...locationOptions]}
                    value={location}
                    onChange={setLocation}
                    width="w-[220px]"
                />
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
                        <DashboardWidgetCard key={w.id} widgetId={w.id} period={period} branchId={location || undefined} />
                    ))}
                </div>
            )}

            {/* Coming-soon empty state (tabs not yet built). */}
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

            {/* Search empty state — same chrome as Insights. */}
            {q && filteredMetrics.length === 0 && filteredWidgets.length === 0 && (
                <div className="bg-white border-1 border-dashed border-[#e4e7ec] rounded-[16px] p-12 flex flex-col items-center gap-1 text-center">
                    <p className="text-[16px] font-semibold text-[#101828]">No KPIs found</p>
                    <p className="text-[14px] text-[#475467]">Try a different search term.</p>
                </div>
            )}
        </div>
    );
}
