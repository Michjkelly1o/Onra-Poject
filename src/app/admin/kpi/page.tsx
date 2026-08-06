"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — KPI page (/admin/kpi)
// ─────────────────────────────────────────────────────────────────────────────
//
// KPI catalogue from new-prd/Onra_KPI_Catalogue.pdf. Six category tabs —
// Financial · Client · Class · Private · Recovery · Marketing — each
// rendered as a KPI-tile-only grid:
//
//   1. Tabs strip
//   2. Toolbar — location · search · period dropdown
//   3. Metric grid (4 per row, gap-6) — the KPI cards
//
// Client 2026-07-31 — the chart-widget grid (`DashboardWidgetCard` from
// WIDGET_CATALOG) that used to sit below the metric grid was removed
// across every tab. The module is now a "tiles-only" overview surface;
// charts live on the Dashboard. The tab configs no longer carry
// widgetIds and the WIDGET_CATALOG import was dropped.
//
// KPI compute functions per tab live in `src/lib/kpi/*` and read from
// the shared Zustand snapshot.
//
// See new-prd/kpi-implementation-plan.md for the full phase timeline.

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SearchMd, MarkerPin01 } from "@untitledui/icons";
import { SelectInput } from "@/components/ui/select-input";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { InsightMetricCard, type Metric } from "@/components/insights/InsightMetricCard";
import { useAppStore } from "@/lib/store";
import { resolveRangePair } from "@/lib/kpi/date-range";
import { computeFinancialKpis } from "@/lib/kpi/financial";
import { computeClientKpis } from "@/lib/kpi/client";
import { computeClassKpis } from "@/lib/kpi/class";
import { computeMarketingKpis } from "@/lib/kpi/marketing";
import { computePrivateKpis } from "@/lib/kpi/private";
import { computeRecoveryKpis } from "@/lib/kpi/recovery";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey =
    | "financial"
    | "client"
    | "class"
    | "private-sessions"
    | "recovery"
    | "marketing";

interface TabConfig {
    key: TabKey;
    label: string;
}

// ─── Tab list ───────────────────────────────────────────────────────────────
//
// Chart widgets (WIDGET_CATALOG) were removed client 2026-07-31 — this
// module is tiles-only now. TABS is just the ordered label list.

const TABS: TabConfig[] = [
    { key: "financial",        label: "Financial" },
    { key: "client",           label: "Customer" },
    { key: "class",            label: "Classes" },
    { key: "private-sessions", label: "Private sessions" },
    { key: "recovery",         label: "Recovery" },
    { key: "marketing",        label: "Marketing" },
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
            icon: <MarkerPin01 className="w-4 h-4 text-[var(--colors-text-quaternary)]" />,
        })),
        [branches],
    );

    // Private + Recovery tabs (client 2026-07-24) need appointments +
    // appointmentBookings + services. Subscribe here so switching tabs
    // never lags on first render.
    const appointments        = useAppStore(s => s.appointments);
    const appointmentBookings = useAppStore(s => s.appointmentBookings);
    const services            = useAppStore(s => s.services);

    // Pack the state slices into a single object for KPI helpers. Every
    // helper reads through the same shape so adding a new tab is a
    // one-import change.
    const kpiState = useMemo(() => ({
        customerTransactions, customerPlans, customers, customerReferrals,
        branches, staff, classSchedules, classBookings,
        appointments, appointmentBookings, services,
    } as unknown as import("@/lib/store").AppState),
    [customerTransactions, customerPlans, customers, customerReferrals, branches, staff, classSchedules, classBookings, appointments, appointmentBookings, services]);

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
    const privateKpis   = useMemo(() => computePrivateKpis(kpiState, range, branchFilter),   [kpiState, range, branchFilter]);
    const recoveryKpis  = useMemo(() => computeRecoveryKpis(kpiState, range, branchFilter),  [kpiState, range, branchFilter]);
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
        // Client 2026-07-24 — Private + Recovery tabs now surface their
        // own KPI cards (Bookings / Utilization / Rebooking rate on
        // Private; Revenue per appointment / Attachment rate / Bookings
        // on Recovery). Computes live in ./private.ts / ./recovery.ts
        // and honour the same period + location filters.
        "private-sessions": withRange(privateKpis),
        recovery:           withRange(recoveryKpis),
        marketing: withRange(marketingKpis),
    };

    const activeTab = TABS.find(t => t.key === tab)!;
    const activeMetrics = metricsByTab[activeTab.key];

    // Search filters the metric grid only (widget grid removed
    // client 2026-07-31 — this module is tiles-only).
    const q = search.trim().toLowerCase();
    const filteredMetrics = q
        ? activeMetrics.filter(m => m.label.toLowerCase().includes(q))
        : activeMetrics;

    // Phase 1 empty state — surfaces when a tab has no metrics yet.
    // Removed once each tab gets its KPI card set.
    const showPhaseEmptyState = !q && filteredMetrics.length === 0;

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Tab strip + toolbar on ONE row (client 2026-07-24) — same
                pattern the Dashboard uses. Left = tabs, right = location /
                search / date filter. Container's outer border-b removed
                per client 2026-07-24 revision — the active tab's own
                border-b-2 accent is enough visual structure without a
                horizontal rule spanning the whole width. Sticky so the
                tabs + filters stay pinned while the widget grid scrolls;
                the negative-y shadow extends the white background up 24px
                to cover main's p-6 top padding as the strip freezes. */}
            <div className="sticky top-0 z-30 w-full bg-white shadow-[0_-24px_0_0_#ffffff]">
                <div className="flex gap-3 items-center justify-between">
                    {/* Left: tabs */}
                    <div className="flex gap-3 items-center flex-shrink-0">
                        {TABS.map(t => (
                            <button key={t.key} type="button" onClick={() => setTab(t.key)}
                                className={cn(
                                    "flex gap-2 h-10 items-center justify-center px-1 relative flex-shrink-0 transition-colors border-b-2",
                                    tab === t.key
                                        ? "border-[var(--colors-text-primary)] text-[var(--colors-text-primary)] font-semibold"
                                        : "border-transparent text-[var(--colors-text-quaternary)] font-semibold hover:text-[var(--colors-text-secondary)]",
                                )}>
                                <span className="text-sm">{t.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Right: toolbar. Height locked to h-10 (40px) matching
                        the tab row so the strip reads as one line. Pushed
                        to the bottom via pb-2 so control borders sit clean
                        against the tab strip's border-b. Order (client
                        2026-07-22 sweep): Locations → Search → Filter. */}
                    <div className="flex gap-2 items-center pb-2">
                        <SelectInput
                            triggerIcon={<MarkerPin01 className="w-5 h-5" />}
                            placeholder="Select location"
                            options={[{ value: "", label: "All locations" }, ...locationOptions]}
                            value={location}
                            onChange={setLocation}
                            width="w-[220px]"
                        />
                        <ToolbarSearch value={search} onChange={setSearch} placeholder="Search KPI..." />
                        <DateRangeFilter value={period} onChange={setPeriod} />
                    </div>
                </div>
            </div>

            {/* Metric grid — tiles only (chart-widget grid removed 2026-07-31). */}
            {filteredMetrics.length > 0 && (
                <div className="grid grid-cols-4 gap-6">
                    {filteredMetrics.map(m => (
                        <InsightMetricCard key={m.label} metric={m} />
                    ))}
                </div>
            )}

            {/* Coming-soon empty state (tabs not yet built). */}
            {showPhaseEmptyState && (
                <div className="bg-white border-1 border-dashed border-[var(--colors-border-secondary)] rounded-[16px] p-12 flex flex-col items-center gap-1 text-center">
                    <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">
                        {activeTab.label} KPIs — coming soon
                    </p>
                    <p className="text-[14px] text-[var(--colors-text-tertiary)]">
                        Metric cards land in the phase for this tab.
                    </p>
                </div>
            )}

            {/* Search empty state — same chrome as Insights. */}
            {q && filteredMetrics.length === 0 && (
                <div className="bg-white border-1 border-dashed border-[var(--colors-border-secondary)] rounded-[16px] p-12 flex flex-col items-center gap-1 text-center">
                    <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">No KPIs found</p>
                    <p className="text-[14px] text-[var(--colors-text-tertiary)]">Try a different search term.</p>
                </div>
            )}
        </div>
    );
}
