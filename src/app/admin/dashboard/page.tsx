"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
    CurrencyDollar,
    Users01,
    ShoppingBag01,
    ArrowUp,
    ArrowDown,
    MarkerPin01,
    CalendarCheck01,
    BarChartSquare01,
    Plus,
    DownloadCloud01,
    // Metrics + Needs-attention icons (client dashboard update Jul 2026)
    CoinsStacked01,
    UserPlus01,
    Calendar,
    TrendUp01,
    RefreshCw01,
    Bell01,
    CreditCard01,
    UserX01,
    UserCheck01,
} from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { downloadCsv, todayISO as csvTodayISO } from "@/lib/csv-export";
import { getWidgetCsvSection } from "@/components/dashboard/DashboardWidgetCard";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useAppStore, SCHEDULE_INSTRUCTORS } from "@/lib/store";
import { ScheduleClassCard } from "@/components/schedule/ScheduleClassCard";
import { SelectInput } from "@/components/ui/select-input"; // used for location + instructor
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { AddWidgetModal } from "@/components/dashboard/AddWidgetModal";
import {
    RenewalDueModal,
    FailedPaymentsModal,
    AtRiskClientsModal,
    UnderFilledModal,
} from "@/components/dashboard/NeedsAttentionModals";
import { DashboardWidgetCard } from "@/components/dashboard/DashboardWidgetCard";
import { useTeamActivity, type TeamActivityItem } from "@/components/dashboard/team-activity";
import { DEFAULT_ACTIVE_WIDGETS, WIDGET_CATALOG } from "@/components/dashboard/widget-catalog";
import { Toast } from "@/components/ui/Toast";

// ── Types ──
// `ScheduleClass` here is the dashboard-local shape that powers both the
// time-slot grouping (left column shows the 12h hour label) and the LG card
// render. It carries everything ScheduleClassCard needs plus the meridiem
// for the column header.
interface ScheduleClass {
    id: string;
    name: string;
    /** 24h "10:00" — used both for slot grouping and inside the card. */
    startTime: string;
    endTime: string;
    /** Pre-formatted "10:00 - 11:00 AM" for the card. */
    displayTime: string;
    instructorName: string;
    instructorInitials: string;
    instructorColor: string;
    instructorImageUrl?: string;
    room: string;
    booked: number;
    capacity: number;
    color: { bg: string; border: string; text: string };
    /** Lifecycle status — drives the Ongoing pill + progress bar on
     *  the LG variant of ScheduleClassCard (Figma 7798:80399). */
    status: "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
}

interface TimeSlot {
    time: string;
    meridiem: "AM" | "PM";
    classes: ScheduleClass[];
}

// Resolved hex triple per category — kept in sync with the schedule page's
// CATEGORY_COLORS (Pilates / Barre / Yoga).
const CATEGORY_PALETTE: Record<string, { bg: string; border: string; text: string }> = {
    Pilates: { bg: "#e9fff3", border: "#658774", text: "#3b5446" },
    Barre:   { bg: "#e9fbff", border: "#4b8c9a", text: "#1b4c56" },
    Yoga:    { bg: "#fff8e9", border: "#dc6803", text: "#7a2e0e" },
};
const FALLBACK_PALETTE = { bg: "#f7f3f7", border: "#b892ba", text: "#4a1fb8" };

// Recent activity feed — now LIVE-derived inside the component via
// `useTeamActivity()`. The dashboard widget slices the top 10; the
// notifications "Team activity" tab consumes the full feed. Bookings,
// cancellations, sales, refunds, and customer signups across every
// surface (customer portal / POS / admin / front desk) all flow into
// this stream automatically — no static seed maintenance.

interface DashboardMetric {
    label: string;
    value: string;
    /** Percent-change badge. Optional — Coming-up cards without a trend
     *  (renewals due / failed payments / at-risk / underfilled) omit it and
     *  render just the `comparison` line as supporting copy. */
    change?: number;
    positive?: boolean;
    comparison: string;
    icon: typeof CurrencyDollar;
    /** Optional click handler. When set, the whole card becomes a button
     *  (used by the Coming-up tab to open the needs-attention modals). */
    onClick?: () => void;
}

// ─── CSV export — Performance snapshot ──────────────────────────────────────

/** One combined CSV with section headers between each block (Option A from
 *  earlier convo). Sections, in order:
 *    1. SUMMARY — the 4 KPI metrics (already branch + period scoped)
 *    2. One section per CURRENTLY-ACTIVE widget — period scoped via the same
 *       `buildSeries(id, period)` call the chart uses, so exported numbers
 *       mirror what's on screen. Hidden widgets are skipped.
 *  Each section is `[title row, header row, ...body rows, blank row]`. The
 *  trailing blank row is dropped so the file doesn't end on whitespace. */
function exportPerformanceCsv(
    metrics: DashboardMetric[],
    activeWidgets: string[],
    period: DateFilter,
) {
    const sections: { title: string; header: string[]; body: string[][] }[] = [];

    // ── KPI summary ──
    sections.push({
        title: "Summary",
        header: ["Metric", "Value", "Change", "Comparison"],
        body: metrics.map(m => [
            m.label,
            m.value,
            `${m.positive ? "+" : "-"}${m.change}%`,
            m.comparison,
        ]),
    });

    // ── Per-active-widget section ──
    for (const id of activeWidgets) {
        const section = getWidgetCsvSection(id, period);
        if (section) sections.push(section);
    }

    // ── Combine sections with a blank-row separator ──
    const lines: string[][] = [];
    for (const s of sections) {
        lines.push([s.title]);
        lines.push(s.header);
        for (const row of s.body) lines.push(row);
        lines.push([]);
    }
    // Drop the trailing blank if any.
    if (lines.length && lines[lines.length - 1].length === 0) lines.pop();

    const csv = lines
        .map(line => line.length === 0 ? "" : line.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\r\n");

    downloadCsv(
        `dashboard-performance-${period.label.toLowerCase().replace(/\s+/g, "-")}-${csvTodayISO()}.csv`,
        csv,
    );
}



// ── Performance Tab ───────────────────────────────────────────────────────────

function PerformanceTab({
    activeWidgets,
    period,
    onRemoveWidget,
    onReorderWidgets,
    onOpenModal,
    allWidgetsActive,
}: {
    activeWidgets: string[];
    period: DateFilter;
    onRemoveWidget: (id: string) => void;
    /** Swap widgets at `fromIndex` and `toIndex` in the active list.
     *  Called by the native HTML5 drag-and-drop handlers below — no
     *  external dnd library required. */
    onReorderWidgets: (fromIndex: number, toIndex: number) => void;
    onOpenModal: () => void;
    /** When every widget in the catalogue is already on the
     *  dashboard, hide the dashed "Add widget" tile — clicking it
     *  would open an empty picker. Client review Jul 2026. */
    allWidgetsActive: boolean;
}) {
    // Track which widget is being dragged (by its position) so the drop
    // handler knows what to move. Reset on dragend / drop so a fresh
    // drag starts clean.
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    return (
        <div className="grid grid-cols-2 gap-6">
            {activeWidgets.map((id, idx) => (
                <div
                    key={id}
                    // Drop target only — `draggable` lives on the DotsGrid
                    // icon inside the card so dragging is ONLY initiated
                    // from the handle. Clicks anywhere else (title, chart,
                    // kebab) don't start a drag.
                    onDragOver={(e) => {
                        // Allow drop + signal the visual hover target.
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (hoverIndex !== idx) setHoverIndex(idx);
                    }}
                    onDragLeave={(e) => {
                        // Only clear when leaving the actual card boundary,
                        // not when the cursor crosses child elements.
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                        if (hoverIndex === idx) setHoverIndex(null);
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex !== null && dragIndex !== idx) {
                            onReorderWidgets(dragIndex, idx);
                        }
                        setDragIndex(null);
                        setHoverIndex(null);
                    }}
                    onDragEnd={() => {
                        setDragIndex(null);
                        setHoverIndex(null);
                    }}
                    className={cn(
                        "transition-all",
                        dragIndex === idx && "opacity-40",
                        hoverIndex === idx && dragIndex !== null && dragIndex !== idx &&
                            "ring-2 ring-[#4b8c9a] ring-offset-2 rounded-[20px]",
                    )}
                >
                    <DashboardWidgetCard
                        widgetId={id}
                        period={period}
                        action="kebab"
                        dragHandle
                        onDragStart={(e) => {
                            setDragIndex(idx);
                            // Some browsers require dataTransfer to be set
                            // for a drag to actually start.
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", id);
                            // Drag image = the WHOLE card, not just the
                            // icon. The card shell is tagged with
                            // `data-widget-card` so we can walk up the DOM
                            // from the icon to find it. Offset positions
                            // the ghost so the cursor stays roughly where
                            // it grabbed the handle.
                            const handle = e.currentTarget as HTMLElement;
                            const card = handle.closest("[data-widget-card]") as HTMLElement | null;
                            if (card) {
                                const rect = card.getBoundingClientRect();
                                e.dataTransfer.setDragImage(
                                    card,
                                    e.clientX - rect.left,
                                    e.clientY - rect.top,
                                );
                            }
                        }}
                        onRemove={() => onRemoveWidget(id)}
                    />
                </div>
            ))}

            {/* Add widget placeholder entry — unchanged at bottom of grid.
                The MODAL that opens on click is what's centered on screen
                (see AddWidgetModal). Hidden once every catalogue widget is
                already active (would open an empty picker). */}
            {!allWidgetsActive && (
                <button
                    type="button"
                    onClick={onOpenModal}
                    className="border-1 border-dashed border-[#d0d5dd] rounded-[20px] p-6 flex flex-col items-center justify-center gap-3 h-full min-h-[180px] hover:border-[#4b8c9a] hover:bg-[#fafeff] transition-colors group"
                >
                    <div className="w-10 h-10 rounded-xl bg-[#f1f2ed] flex items-center justify-center group-hover:bg-[#e9fbff] transition-colors">
                        <BarChartSquare01 className="w-5 h-5 text-[#667085] group-hover:text-[#4b8c9a]" />
                    </div>
                    <div className="text-center">
                        <p className="font-semibold text-sm text-[#344054]">Add widget</p>
                        <p className="text-xs text-[#667085] mt-0.5">Add widgets to customize your dashboard insights.</p>
                    </div>
                </button>
            )}
        </div>
    );
}

// ── Sub-components ──
// Today's-classes uses the shared ScheduleClassCard (size=lg) — see
// src/components/schedule/ScheduleClassCard.tsx. The dashboard-local card was
// removed when the DS variants landed.

// ─── Needs attention row (Figma 7798:80427) ───────────────────────────────
// One row of the Needs-attention card. Icon square + title + subtitle +
// View button. Uses `border-b` between rows (dropped on the last row via
// `isLast`) so the container's `p-6` breathes correctly.
interface NeedsAttentionRowProps {
    icon: DashboardMetric["icon"];
    /** Tailwind bg-* class for the icon square background tint. */
    iconBg: string;
    /** Tailwind text-* class for the icon foreground colour. */
    iconFg: string;
    title: string;
    subtitle: string;
    onView: () => void;
    isLast?: boolean;
}
function NeedsAttentionRow({
    icon: Icon,
    iconBg,
    iconFg,
    title,
    subtitle,
    onView,
    isLast,
}: NeedsAttentionRowProps) {
    return (
        <div className={cn(
            "flex items-center gap-4 py-4",
            !isLast && "border-b border-[#e4e7ec]",
        )}>
            <div className={cn(
                "shrink-0 w-10 h-10 rounded-[8px] flex items-center justify-center",
                iconBg,
            )}>
                <Icon className={cn("w-5 h-5", iconFg)} />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
                <p className="text-sm font-semibold text-[#101828] leading-5">{title}</p>
                <p className="text-sm text-[#667085] leading-5">{subtitle}</p>
            </div>
            <Button variant="secondary-gray" size="sm" onClick={onView}>
                View
            </Button>
        </div>
    );
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
    const Icon = metric.icon;
    const clickable = typeof metric.onClick === "function";
    // Rendered as a <button> only when `onClick` is set so the card gets
    // native keyboard + focus semantics on the Coming-up tab. Non-clickable
    // cards stay a plain <div> to avoid an unnecessary interactive role.
    const Root = (clickable ? "button" : "div") as "button" | "div";
    return (
        // Padding / value size shrunk Jul 2026 so 5 cards on one row
        // don't force the value+icon combo to wrap. Value drops from
        // text-2xl (24px) → text-xl (20px); label + change/comparison
        // stay text-sm.
        <Root
            type={clickable ? "button" : undefined}
            onClick={metric.onClick}
            className={cn(
                "bg-white border border-[#e4e7ec] flex flex-1 gap-4 items-start justify-end min-w-0 p-4 relative rounded-2xl text-left",
                clickable && "cursor-pointer hover:border-[#d0d5dd] hover:shadow-[0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-all",
            )}
        >
            <div className="flex flex-1 flex-col gap-1.5 items-start min-w-0 relative">
                <p className="font-normal text-sm text-[#667085] whitespace-nowrap">
                    {metric.label}
                </p>
                <p className="font-semibold text-xl text-[#101828] leading-[28px] whitespace-nowrap">
                    {metric.value}
                </p>
                <div className="flex gap-1 items-center whitespace-nowrap">
                    {/* Badge — only when a trend is provided. Coming-up cards
                        without a percent (renewals / failed / at-risk /
                        underfilled) skip this and show just the sub-line. */}
                    {typeof metric.change === "number" && (
                        <div className={cn(
                            "flex gap-1 items-center py-0.5 rounded-full",
                            metric.positive ? "text-[#067647]" : "text-[#b42318]"
                        )}>
                            {metric.positive ? (
                                <ArrowUp size={12} className="text-[#067647]" />
                            ) : (
                                <ArrowDown size={12} className="text-[#b42318]" />
                            )}
                            <span className={cn(
                                "font-medium text-xs",
                                metric.positive ? "text-[#067647]" : "text-[#b42318]"
                            )}>
                                {metric.change}%
                            </span>
                        </div>
                    )}
                    <p className="font-normal text-xs text-[#667085]">
                        {metric.comparison}
                    </p>
                </div>
            </div>
            {/* Featured icon — shrunk to 32px to match the smaller card. */}
            <div className="bg-[#f1f2ed] overflow-hidden relative rounded-full flex-shrink-0 w-8 h-8 flex items-center justify-center">
                <Icon size={16} className="text-[#475467]" />
            </div>
        </Root>
    );
}

function ActivityRow({ item }: { item: TeamActivityItem }) {
    const Icon = item.icon;
    return (
        <div className="flex gap-3 items-center w-full">
            <div className="bg-[#f9fafb] border border-[#e4e7ec] overflow-hidden relative rounded-xl flex-shrink-0 w-12 h-12 flex items-center justify-center shadow-sm">
                <Icon size={24} className="text-[#475467]" />
            </div>
            <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                <div className="flex gap-1.5 items-center whitespace-nowrap">
                    <span className="font-semibold text-sm text-[#344054]">{item.name}</span>
                    <span className="font-normal text-sm text-[#667085]">{item.timeAgo}</span>
                </div>
                <p className="font-normal text-sm text-[#475467]">{item.description}</p>
            </div>
        </div>
    );
}

// ── Report dropdown ──
const REPORT_FORMATS = ["CSV", "PDF", "Excel"] as const;

function ReportDropdown({ onExportCsv }: { onExportCsv: () => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div ref={ref} className="relative flex-shrink-0">
            <Button
                variant="primary"
                size="md"
                leftIcon={<DownloadCloud01 className="w-4 h-4" />}
                className="whitespace-nowrap"
                onClick={() => setOpen(p => !p)}
            >
                Report
            </Button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-2 min-w-[140px]">
                    {REPORT_FORMATS.map(fmt => (
                        <button
                            key={fmt}
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                // Only CSV is wired today; PDF / Excel come later.
                                if (fmt === "CSV") onExportCsv();
                            }}
                            className="w-full text-left px-5 py-3 text-[15px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors"
                        >
                            {fmt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main Dashboard ──
export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"today" | "coming" | "performance">("today");
    // Coming-up tab range — 7 or 30 days (Figma 7823:53746 segmented pill).
    const [comingRange, setComingRange] = useState<7 | 30>(7);
    // "" = "All locations" — dashboard opens on the aggregate view so
    // KPIs read like the full studio on first paint.
    const [location, setLocation] = useState<string>("");
    const [period, setPeriod] = useState<DateFilter>({ type: "week", label: "This week" });
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);
    // Needs-attention drill-down modals (Figma 7785:66057 / 227786 /
    // 245665 / 246710). Renewal + Expire cards share the Renewal-due
    // modal per client Jul 2026.
    type NeedsAttentionModal = "renewal" | "failed" | "atrisk" | "underfilled" | null;
    const [attentionModal, setAttentionModal] = useState<NeedsAttentionModal>(null);
    const [activeWidgets, setActiveWidgets] = useState<string[]>(DEFAULT_ACTIVE_WIDGETS);
    const today = new Date();

    const classSchedules = useAppStore(s => s.classSchedules);
    const classBookings = useAppStore(s => s.classBookings);
    const customers = useAppStore(s => s.customers);
    const customerTransactions = useAppStore(s => s.customerTransactions);
    const branches = useAppStore(s => s.branches);
    const showToast = useAppStore(s => s.showToast);
    // Extra slices used by the Needs-attention section below —
    // customerPlans powers "renew today" + "expire today" + "client at risk"
    // buckets, while `today.classes` come from `classBookings` /
    // `classSchedules` already scoped.
    const customerPlans = useAppStore(s => s.customerPlans);

    // Live "Recent activity" feed — derived from bookings, transactions,
    // and customer signups across every surface (customer portal / POS /
    // admin / front desk). Top 10 fills the dashboard widget; the full
    // feed lives on /admin/notifications?tab=team.
    const recentActivity = useTeamActivity(10);
    // Phase 3 cross-module sync — welcome header reads from the centralized
    // Branding `displayName` so editing it through Settings → Branding flips
    // the dashboard greeting in the same render cycle.
    const studioDisplayName = useAppStore(s => s.brandingSettings.displayName);

    // Sourced from the live `branches` slice so dashboard / schedule / POS
    // branch pickers reflect adds, archives and renames in Business &
    // Locations immediately. Inactive + archived branches are hidden (only
    // active branches are valid as a NEW selection — matches POS catalog
    // behavior). Each option carries a MarkerPin01 glyph so dropdown items
    // align visually with the trigger icon.
    const locationOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({
            value: b.id,
            label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })),
        [branches],
    );

    // Branch-scope sentinel — empty string means "All locations" (no scoping).
    // Any non-empty value is a real `branches[].id`. Every downstream aggregate
    // funnels through this so picking a branch in the header flows into the
    // KPI cards, the schedule list, the revenue trend and the activity feed
    // in the same render cycle.
    const branchScopeId = location || null;
    const todayISO = format(today, "yyyy-MM-dd");

    // Branch-scoped slices. When no branch is picked we keep the global lists
    // so "All locations" continues to show aggregate numbers.
    const scopedSchedules = useMemo(
        () => branchScopeId ? classSchedules.filter(s => s.branchId === branchScopeId) : classSchedules,
        [classSchedules, branchScopeId],
    );
    const scopedBookings = useMemo(
        () => branchScopeId ? classBookings.filter(b => b.branchId === branchScopeId) : classBookings,
        [classBookings, branchScopeId],
    );
    const scopedCustomers = useMemo(
        () => branchScopeId ? customers.filter(c => c.branchId === branchScopeId) : customers,
        [customers, branchScopeId],
    );
    const scopedTransactions = useMemo(
        () => branchScopeId ? customerTransactions.filter(t => t.branchId === branchScopeId) : customerTransactions,
        [customerTransactions, branchScopeId],
    );
    // customer_plans has no branch column — filter via the plan's customer's
    // branch. Same "" = All locations sentinel.
    const scopedCustomerPlans = useMemo(() => {
        if (!branchScopeId) return customerPlans;
        const inScope = new Set(scopedCustomers.map(c => c.id));
        return customerPlans.filter(p => inScope.has(p.customerId));
    }, [customerPlans, scopedCustomers, branchScopeId]);

    // KPI aggregates — client dashboard update Jul 2026 (Figma 7798:80364
    // for Today, 7799:109180 for Performance). Each tab surfaces its own
    // metric strip:
    //   • Today at a glance  (5 cards): Total sales / Total revenue /
    //                        New customers / Bookings today / Avg occupancy
    //   • Performance        (4 cards): Today's revenue / Active members /
    //                        Classes today / Bookings today
    // Every value reads live from the scoped slices so branch pick + all-
    // locations aggregate stay in sync.
    const { todayMetrics, performanceMetrics } = useMemo(() => {
        // Today's completed sale transactions — used by both Total sales
        // (count) and Total revenue (sum of amounts). Filter out refund /
        // void / write-off rows so the two totals stay honest.
        const todaySales = scopedTransactions.filter(t =>
            t.status === "complete"
            && t.createdAtISO.startsWith(todayISO)
            && (t.transactionType === undefined || t.transactionType === "sale")
            && t.kind !== "cancellation_penalty"
        );
        const totalSalesCount = todaySales.length;
        const totalRevenueAed = todaySales.reduce((sum, t) => sum + t.amountAed, 0);

        // New customers today — count of customer.createdAt on today's date.
        const newCustomers = scopedCustomers.filter(c =>
            (c.createdAt ?? "").startsWith(todayISO),
        ).length;

        // Active members — all-time count of customers with status "active"
        // in scope. Performance-tab only.
        const activeMembers = scopedCustomers.filter(c => c.status === "active").length;

        // Classes scheduled today — kept for the Avg occupancy calc
        // below. Cancelled classes still take a slot the front desk saw
        // arriving, so they count for scheduling density.
        const todaySchedules = scopedSchedules.filter(s => s.dateISO === todayISO);
        const classesTodayCount = todaySchedules.length;
        // Bookings today — count of `booked` rows whose schedule is
        // today's. Waitlist + cancelled bookings excluded so the number
        // reads as "committed activity on the floor today".
        const todayScheduleIdSet = new Set(todaySchedules.map(s => s.id));
        const bookingsToday = scopedBookings.filter(b =>
            b.status === "booked" && todayScheduleIdSet.has(b.classScheduleId),
        ).length;

        // Average occupancy across today's classes with a real capacity.
        // Uncapped classes (capacity 0) drop out so a stray seed row can't
        // divide-by-zero the aggregate. Value shown as a percentage.
        const capped = todaySchedules.filter(s => s.capacity > 0);
        const avgOccupancyPct = capped.length === 0
            ? 0
            : Math.round(
                capped.reduce((sum, s) => sum + (s.booked / s.capacity) * 100, 0)
                / capped.length,
            );

        const today: DashboardMetric[] = [
            {
                label: "Total sales",
                value: totalSalesCount.toLocaleString("en-US"),
                change: 3, positive: true, comparison: "vs yesterday",
                icon: CurrencyDollar,
            },
            {
                label: "Total revenue",
                value: `AED ${totalRevenueAed.toLocaleString("en-US")}`,
                change: 3, positive: true, comparison: "vs yesterday",
                icon: CoinsStacked01,
            },
            {
                label: "New customers",
                value: newCustomers.toLocaleString("en-US"),
                change: 2, positive: false, comparison: "vs yesterday",
                icon: UserPlus01,
            },
            {
                label: "Bookings today",
                value: bookingsToday.toLocaleString("en-US"),
                change: 1, positive: false, comparison: "vs yesterday",
                icon: TrendUp01,
            },
            {
                label: "Avg occupancy",
                value: `${avgOccupancyPct}%`,
                change: 1, positive: false, comparison: "vs yesterday",
                icon: Calendar,
            },
        ];

        // Performance-tab metrics — 4 cards per Figma 7799:109180.
        const performance: DashboardMetric[] = [
            {
                label: "Today's revenue",
                value: `AED ${totalRevenueAed.toLocaleString("en-US")}`,
                change: 3, positive: true, comparison: "vs yesterday",
                icon: CurrencyDollar,
            },
            {
                label: "Active members",
                value: activeMembers.toLocaleString("en-US"),
                change: 3, positive: true, comparison: "vs yesterday",
                icon: UserCheck01,
            },
            {
                label: "Classes today",
                value: classesTodayCount.toLocaleString("en-US"),
                change: 2, positive: false, comparison: "vs yesterday",
                icon: CalendarCheck01,
            },
            {
                label: "Bookings today",
                value: bookingsToday.toLocaleString("en-US"),
                change: 1, positive: false, comparison: "vs yesterday",
                icon: TrendUp01,
            },
        ];

        return { todayMetrics: today, performanceMetrics: performance };
    }, [scopedTransactions, scopedCustomers, scopedSchedules, scopedBookings, todayISO]);

    // ── Coming-up metrics — 6 KPI cards per Figma 7823:53746 ──
    //
    // Each card looks N days ahead where N ∈ {7, 30} (segmented pill next to
    // the location dropdown). Numbers are derived from the same slices the
    // Needs-attention section reads today — just widened to a rolling range.
    const comingMetrics: DashboardMetric[] = useMemo(() => {
        const now = Date.now();
        const DAY = 24 * 60 * 60 * 1000;
        const horizonMs = now + comingRange * DAY;
        // Forward window — future events (bookings, renewals, upcoming
        // revenue, under-filled schedules).
        const inRange = (iso: string) => {
            const t = new Date(iso).getTime();
            if (Number.isNaN(t)) return false;
            return t >= now && t <= horizonMs;
        };
        // Backward window — past events that are still open (failed
        // payments). Same window size as the pill so the card still
        // reacts to Next 7 / Next 30, but looks the correct direction.
        const pastStartMs = now - comingRange * DAY;
        const inPastRange = (iso: string) => {
            const t = new Date(iso).getTime();
            if (Number.isNaN(t)) return false;
            return t >= pastStartMs && t <= now;
        };

        const heldMemberships = scopedCustomerPlans.filter(p =>
            p.kind === "membership" && (p.status === "active" || p.status === "frozen"),
        );
        // 1. Upcoming recurring revenue — sum next-billing AED across
        //    auto-renewing memberships whose next cycle lands in range.
        const upcomingBillingPlans = heldMemberships.filter(p => (p.autoRenew ?? false) && inRange(p.expiryISO ?? ""));
        const upcomingRevenueAed = upcomingBillingPlans.reduce(
            (sum, p) => sum + (p.nextBillingAmountAed ?? p.priceAed ?? 0), 0,
        );

        // 2. Bookings ahead — confirmed future bookings for schedules in range.
        const scheduleIdsInRange = new Set(
            scopedSchedules.filter(s => inRange(`${s.dateISO}T00:00:00Z`)).map(s => s.id),
        );
        const bookingsAhead = scopedBookings.filter(b =>
            b.status === "booked" && scheduleIdsInRange.has(b.classScheduleId),
        ).length;

        // 3. Renewals due — held memberships expiring in range (auto-renew
        //    or not), plus their recurring value.
        const renewalsDuePlans = heldMemberships.filter(p => inRange(p.expiryISO ?? ""));
        const renewalsDueCount = renewalsDuePlans.length;
        const renewalsDueAed = renewalsDuePlans.reduce(
            (sum, p) => sum + (p.nextBillingAmountAed ?? p.priceAed ?? 0), 0,
        );

        // 4. Failed payments — truly failed transactions in the past N
        //    days (window flipped from forward → backward Jul 2026 because
        //    failed transactions are historical; the "next 7/30 days"
        //    pill acts as a rolling window over recent failures instead).
        //    Modal receives the same window prop so the count + list agree.
        const failedTxns = scopedTransactions.filter(t =>
            t.status === "failed" && inPastRange(t.createdAtISO),
        );
        const failedAed = failedTxns.reduce((sum, t) => sum + Math.abs(t.amountAed), 0);

        // 5. At-risk clients — same 14-30 day silent-window as Needs-attention.
        //    Range-independent (it's a bucket, not a horizon).
        const clientsAtRisk = scopedCustomers.filter(c => {
            if (c.status !== "active") return false;
            if (!c.lastVisitISO) return false;
            const d = new Date(c.lastVisitISO).getTime();
            if (Number.isNaN(d)) return false;
            const daysAgo = Math.floor((now - d) / DAY);
            return daysAgo >= 14 && daysAgo <= 30;
        }).length;

        // 6. Under-filled classes — schedules in range with < 50% capacity.
        //    Matches the UnderFilledModal filter (status Upcoming|Ongoing +
        //    same date window) so count + list agree at both pill settings.
        const underFilledInRange = scopedSchedules.filter(s =>
            (s.status === "Upcoming" || s.status === "Ongoing")
            && inRange(`${s.dateISO}T00:00:00Z`)
            && s.capacity > 0
            && (s.booked / s.capacity) < 0.5,
        ).length;

        return [
            {
                label: "Upcoming recurring revenue",
                value: `AED ${upcomingRevenueAed.toLocaleString("en-US")}`,
                change: 3, positive: true, comparison: "expected vs last month",
                icon: CurrencyDollar,
            },
            {
                label: "Bookings ahead",
                value: `${bookingsAhead.toLocaleString("en-US")} booked`,
                change: 3, positive: true, comparison: `pace vs prior ${comingRange} days`,
                icon: Calendar,
            },
            {
                label: "Renewals due",
                value: `${renewalsDueCount} ${renewalsDueCount === 1 ? "member" : "members"}`,
                comparison: `AED ${renewalsDueAed.toLocaleString("en-US")} recurring`,
                icon: RefreshCw01,
                onClick: () => setAttentionModal("renewal"),
            },
            {
                label: "Failed payments",
                value: `${failedTxns.length} · AED ${failedAed.toLocaleString("en-US")}`,
                comparison: "Recoverable now",
                icon: CreditCard01,
                onClick: () => setAttentionModal("failed"),
            },
            {
                label: "At-risk clients",
                value: `${clientsAtRisk} ${clientsAtRisk === 1 ? "client" : "clients"}`,
                comparison: "no visit 14-30 days",
                icon: UserX01,
                onClick: () => setAttentionModal("atrisk"),
            },
            {
                label: "Under filled classes",
                value: `${underFilledInRange} ${underFilledInRange === 1 ? "class" : "classes"}`,
                comparison: "below 50% capacity",
                icon: CalendarCheck01,
                onClick: () => setAttentionModal("underfilled"),
            },
        ];
    }, [comingRange, scopedCustomerPlans, scopedSchedules, scopedBookings, scopedTransactions, scopedCustomers]);

    // Pick the strip that matches the active tab. `metrics` stays the
    // stable public name (used by CSV export + a couple of downstream
    // references) so the CSV etc. keep exporting the metrics the admin
    // is currently looking at.
    const metrics = activeTab === "performance" ? performanceMetrics
                  : activeTab === "coming"      ? comingMetrics
                  :                                todayMetrics;

    // Derive today's classes. The seed data centres around end-Feb 2025, so for a
    // realistic prototype we surface the next 6 upcoming/ongoing classes regardless
    // of the wall-clock date — keeping the dashboard visually populated. Branch
    // scoping still applies so picking a location filters the list.
    const todayClasses = useMemo<ScheduleClass[]>(() => {
        return [...scopedSchedules]
            .filter(ci => ci.status === "Upcoming" || ci.status === "Ongoing")
            .sort((a, b) => `${a.dateISO} ${a.startTime}`.localeCompare(`${b.dateISO} ${b.startTime}`))
            .slice(0, 6)
            .map(ci => {
                const palette = CATEGORY_PALETTE[ci.category] ?? FALLBACK_PALETTE;
                return {
                    id: ci.id,
                    name: ci.name,
                    startTime: ci.startTime,
                    endTime: ci.endTime,
                    displayTime: ci.displayTime,
                    instructorName: ci.instructorName,
                    instructorInitials: ci.instructorInitials,
                    instructorColor: ci.instructorColor,
                    instructorImageUrl: SCHEDULE_INSTRUCTORS.find(i => i.id === ci.instructorId)?.imageUrl,
                    room: ci.room,
                    booked: ci.booked,
                    capacity: ci.capacity,
                    color: palette,
                    status: ci.status,
                };
            });
    }, [scopedSchedules]);

    // Group classes by start-time so the timeline matches the original two-column
    // (time | classes) layout, with multiple classes stacked when they share a slot.
    const timeSlots = useMemo<TimeSlot[]>(() => {
        const slotMap = new Map<string, ScheduleClass[]>();
        for (const c of todayClasses) {
            const bucket = slotMap.get(c.startTime);
            if (bucket) bucket.push(c);
            else slotMap.set(c.startTime, [c]);
        }
        return Array.from(slotMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([time, classes]) => ({
                time,
                meridiem: (Number(time.split(":")[0]) >= 12 ? "PM" : "AM") as "AM" | "PM",
                classes,
            }));
    }, [todayClasses]);

    // ── "Needs attention today" — derived operational buckets ───────
    // Client dashboard update Jul 2026 (Figma 7798:80427). One card
    // with 5 rows the front desk / manager should action first thing
    // in the morning. All values compute from live slices so branch
    // scope + all-locations aggregate stay in sync. Each row exposes
    // a `viewHref` route the "View" button navigates to.
    const needsAttention = useMemo(() => {
        // Membership plans whose expiry ISO date === today. `expiryISO`
        // may include a time component (`YYYY-MM-DDT…`) so we compare
        // by date prefix. Held = active OR frozen (unfrozen tomorrow
        // still expires today).
        const heldMemberships = scopedCustomerPlans.filter(p =>
            p.kind === "membership" && (p.status === "active" || p.status === "frozen"),
        );
        const renewToday = heldMemberships.filter(p =>
            (p.expiryISO ?? "").slice(0, 10) === todayISO && (p.autoRenew ?? false),
        );
        const expireToday = heldMemberships.filter(p =>
            (p.expiryISO ?? "").slice(0, 10) === todayISO && !(p.autoRenew ?? false),
        );
        const renewTotalAed = renewToday.reduce((sum, p) => sum + (p.nextBillingAmountAed ?? p.priceAed ?? 0), 0);

        // Truly failed transactions from today — the front desk chases
        // these before the retry window closes. Pending rows are excluded
        // so this count matches the FailedPayments modal + the customer's
        // Payments tab (which shows the true "Pending" / "Failed" status).
        const failedTxns = scopedTransactions.filter(t =>
            t.status === "failed" && t.createdAtISO.startsWith(todayISO),
        );
        const failedTotalAed = failedTxns.reduce((sum, t) => sum + Math.abs(t.amountAed), 0);

        // Clients at risk: last visit was 14-30 days ago (inclusive)
        // — matches the Excel spec's Win-back window. Customers who
        // have NEVER visited (undefined `lastVisitISO`) are dropped
        // since we don't have a signup-vs-visit gap yet.
        const now = Date.now();
        const DAY = 24 * 60 * 60 * 1000;
        const clientsAtRisk = scopedCustomers.filter(c => {
            if (c.status !== "active") return false;
            if (!c.lastVisitISO) return false;
            const d = new Date(c.lastVisitISO).getTime();
            if (Number.isNaN(d)) return false;
            const daysAgo = Math.floor((now - d) / DAY);
            return daysAgo >= 14 && daysAgo <= 30;
        }).length;

        // Under-filled classes: today's schedules < 50% capacity.
        const todaySchedules = scopedSchedules.filter(s => s.dateISO === todayISO);
        const underFilled = todaySchedules.filter(s =>
            s.capacity > 0 && (s.booked / s.capacity) < 0.5,
        ).length;

        return {
            renewTodayCount:  renewToday.length,
            renewTotalAed,
            expireTodayCount: expireToday.length,
            failedCount:      failedTxns.length,
            failedTotalAed,
            clientsAtRisk,
            underFilled,
        };
    }, [scopedCustomerPlans, scopedTransactions, scopedCustomers, scopedSchedules, todayISO]);

    function handleAddWidget(id: string) {
        if (activeWidgets.includes(id)) return;
        setActiveWidgets(prev => prev.includes(id) ? prev : [...prev, id]);
        const title = WIDGET_CATALOG.find(w => w.id === id)?.title ?? "Widget";
        showToast("Widget added", `${title} has been added to your dashboard.`, "success", "check");
    }
    function handleRemoveWidget(id: string) {
        if (!activeWidgets.includes(id)) return;
        setActiveWidgets(prev => prev.filter(w => w !== id));
        const title = WIDGET_CATALOG.find(w => w.id === id)?.title ?? "Widget";
        showToast("Widget removed", `${title} has been removed from your dashboard.`, "success", "trash");
    }

    return (
        <div className="flex flex-col gap-6 animate-fade-in">

            {/* Tab Navigation — sticky when scrolling. The `-mx-6 -mt-6
                px-6 pt-6` combo lets the sticky element bleed into the
                parent <main>'s p-6 padding so bg-white covers scrolled
                content 100% (no bleed-through around the tabs). The
                compensating `-m / p` pairs cancel out visually, so the
                tab BUTTONS render at exactly the same y-position they
                did before — only the invisible background extends. */}
            <div className="sticky top-0 z-20 -mx-6 -mt-6 px-6 pt-6 bg-white border-b border-[#e4e7ec]">
                <div className="flex gap-3 items-start">
                    <button
                        onClick={() => setActiveTab("today")}
                        className={cn(
                            "flex gap-2 h-8 items-center justify-center pb-3 px-1 relative flex-shrink-0 transition-colors",
                            activeTab === "today"
                                ? "border-b-2 border-[#101828] text-[#101828] font-semibold"
                                : "text-[#667085] font-semibold hover:text-[#344054]"
                        )}
                    >
                        <span className="text-sm">Today</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("coming")}
                        className={cn(
                            "flex gap-2 h-8 items-center justify-center pb-3 px-1 relative flex-shrink-0 transition-colors",
                            activeTab === "coming"
                                ? "border-b-2 border-[#101828] text-[#101828] font-semibold"
                                : "text-[#667085] font-semibold hover:text-[#344054]"
                        )}
                    >
                        <span className="text-sm">Coming Up</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("performance")}
                        className={cn(
                            "flex gap-2 h-8 items-center justify-center pb-3 px-1 relative flex-shrink-0 transition-colors",
                            activeTab === "performance"
                                ? "border-b-2 border-[#101828] text-[#101828] font-semibold"
                                : "text-[#667085] font-semibold hover:text-[#344054]"
                        )}
                    >
                        <span className="text-sm">Performance</span>
                    </button>
                </div>
            </div>

            {/* Welcome + Location Picker + tab-specific actions */}
            <div className="flex gap-2 items-center">
                <p className="flex-1 font-semibold text-base text-[#101828]">
                    {activeTab === "coming" ? "What's ahead" : `Welcome, ${studioDisplayName}`}
                </p>

                {/* Location picker — always visible */}
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-5 h-5" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...locationOptions]}
                    value={location}
                    onChange={setLocation}
                    width="w-[220px]"
                />

                {/* Coming-up range pill — Next 7 days | Next 30 days (Figma
                    7823:53746). Height locked to h-10 (40px) to match the
                    Location dropdown so the header row reads as one strip. */}
                {activeTab === "coming" && (
                    <div className="flex items-center gap-1 h-10 p-1 bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[10px]">
                        {([7, 30] as const).map(n => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setComingRange(n)}
                                className={cn(
                                    "h-8 px-3 rounded-[6px] text-[13px] font-medium transition-colors",
                                    comingRange === n
                                        ? "bg-white text-[#344054] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.06)]"
                                        : "text-[#667085] hover:text-[#344054]",
                                )}
                            >
                                Next {n} days
                            </button>
                        ))}
                    </div>
                )}

                {/* Performance-only controls */}
                {activeTab === "performance" && (
                    <>
                        <DateRangeFilter
                            value={period}
                            onChange={setPeriod}
                        />

                        {/* Add widget */}
                        <Button
                            variant="secondary-gray"
                            size="md"
                            leftIcon={<Plus className="w-4 h-4" />}
                            className="flex-shrink-0 whitespace-nowrap"
                            onClick={() => setWidgetModalOpen(true)}
                        >
                            Add widget
                        </Button>

                        {/* Report download — with format picker */}
                        <ReportDropdown
                            onExportCsv={() => {
                                exportPerformanceCsv(metrics, activeWidgets, period);
                                showToast(
                                    "Performance report exported",
                                    `${metrics.length} metric${metrics.length === 1 ? "" : "s"} + ${activeWidgets.length} widget${activeWidgets.length === 1 ? "" : "s"} exported to CSV.`,
                                    "success", "check",
                                );
                            }}
                        />
                    </>
                )}
            </div>

            {/* KPI Metrics — Coming-up uses a fixed 3-col grid to match the
                Figma 6-card layout; Today/Performance keep the wrap-flex
                behavior so 4-5 cards fill one row without gaps. */}
            <div className={cn(
                activeTab === "coming"
                    ? "grid grid-cols-3 gap-6 items-start"
                    : "flex flex-wrap gap-6 items-start",
            )}>
                {metrics.map((metric) => (
                    <MetricCard key={metric.label} metric={metric} />
                ))}
            </div>

            {/* Performance tab */}
            {activeTab === "performance" && (
                <PerformanceTab
                    activeWidgets={activeWidgets}
                    period={period}
                    onRemoveWidget={handleRemoveWidget}
                    onReorderWidgets={(fromIndex, toIndex) => {
                        // Reorder via splice + setState — same semantics as
                        // a drag-and-drop reorder library would use, no
                        // extra dependency required.
                        setActiveWidgets(prev => {
                            const next = [...prev];
                            const [moved] = next.splice(fromIndex, 1);
                            next.splice(toIndex, 0, moved);
                            return next;
                        });
                        showToast(
                            "Widget reordered",
                            "Your dashboard layout has been updated.",
                            "success", "check",
                        );
                    }}
                    onOpenModal={() => setWidgetModalOpen(true)}
                    allWidgetsActive={
                        // Only compare against categories the dashboard's
                        // AddWidgetModal actually surfaces (Finance +
                        // Memberships + Classes). KPI-only widgets
                        // (Financial / Client / Class / Marketing) are
                        // reachable ONLY from /admin/kpi and don't count
                        // toward the dashboard's "all widgets added" state.
                        (() => {
                            const eligible = WIDGET_CATALOG.filter(w =>
                                w.category === "Finance"
                                || w.category === "Memberships"
                                || w.category === "Classes"
                            ).map(w => w.id);
                            return eligible.every(id => activeWidgets.includes(id));
                        })()
                    }
                />
            )}

            {/* Bottom Section — Classes + Activity (Today tab only) */}
            {activeTab === "today" && <div className="flex items-start gap-6">

                {/* Today's Classes */}
                <div className="bg-white border border-[#e4e7ec] flex flex-1 flex-col gap-4 h-[532px] items-start min-w-0 overflow-hidden pb-4 pt-6 px-6 relative rounded-[20px]">
                    {/* Header — Today's classes title + See all button.
                        Click navigates to the schedule list per the brief. */}
                    <div className="flex gap-3 items-center w-full flex-shrink-0">
                        <p className="font-semibold text-lg text-[#101828] flex-1 truncate">
                            Today&apos;s classes
                        </p>
                        <Button
                            variant="secondary-gray"
                            size="sm"
                            onClick={() => router.push("/admin/schedule")}
                        >
                            See all
                        </Button>
                    </div>

                    {/* Schedule Timeline — one flex row per slot keeps the divider continuous across time + cards. */}
                    <div className="flex flex-1 flex-col min-h-0 w-full overflow-y-auto scrollbar-hide">
                        {timeSlots.map((slot, idx) => {
                            const isLast = idx === timeSlots.length - 1;
                            const multi = slot.classes.length > 1;
                            return (
                                <div
                                    key={slot.time}
                                    className={cn(
                                        "flex items-stretch w-full flex-shrink-0",
                                        !isLast && "border-b border-[#e4e7ec]"
                                    )}
                                >
                                    {/* Time cell */}
                                    <div className="w-[70px] flex items-center justify-end px-4 py-3 flex-shrink-0">
                                        <div className="flex flex-col items-end">
                                            <p className="font-medium text-sm text-[#667085] whitespace-nowrap">
                                                {slot.time}
                                            </p>
                                            <p className="font-medium text-sm text-[#667085] whitespace-nowrap">
                                                {slot.meridiem}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Class cards cell */}
                                    <div className={cn(
                                        "flex flex-1 min-w-0 py-3",
                                        multi ? "flex-col gap-4" : "items-center"
                                    )}>
                                        {slot.classes.map(c => (
                                            <ScheduleClassCard key={c.id}
                                                size="lg"
                                                onClick={() => router.push(`/schedule/${c.id}?returnTo=${encodeURIComponent("/admin/dashboard")}`)}
                                                cls={{
                                                    name: c.name,
                                                    color: c.color,
                                                    startTime: c.startTime,
                                                    endTime: c.endTime,
                                                    displayTime: c.displayTime,
                                                    instructorName: c.instructorName,
                                                    instructorInitials: c.instructorInitials,
                                                    instructorColor: c.instructorColor,
                                                    instructorImageUrl: c.instructorImageUrl,
                                                    room: c.room,
                                                    booked: c.booked,
                                                    capacity: c.capacity,
                                                    status: c.status,
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Fade gradient at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                </div>

                {/* Recent Activity */}
                <div className="bg-white border-1 border-[#e4e7ec] flex flex-1 flex-col gap-4 h-[532px] items-start min-w-0 overflow-hidden pb-4 pt-6 px-6 relative rounded-[20px]">
                    {/* Header — Recent activity title + See all button.
                        "See all" routes to the notifications module's
                        Team activity tab, which surfaces the full feed
                        (same data source). */}
                    <div className="flex gap-3 items-center w-full flex-shrink-0">
                        <p className="font-semibold text-lg text-[#101828] flex-1 truncate">
                            Recent activity
                        </p>
                        <Button
                            variant="secondary-gray"
                            size="sm"
                            onClick={() => router.push("/admin/notifications?tab=team")}
                        >
                            See all
                        </Button>
                    </div>

                    {/* Activity list */}
                    <div className="flex flex-1 flex-col gap-4 items-start min-h-0 overflow-y-auto scrollbar-hide w-full">
                        {recentActivity.map((item, idx) => (
                            <div key={item.id} className="w-full flex flex-col gap-4">
                                <ActivityRow item={item} />
                                {idx < recentActivity.length - 1 && (
                                    <div className="w-full h-px bg-[#e4e7ec]" />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Fade gradient */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none rounded-b-[20px]" />
                </div>
            </div>}

            {/* Needs attention today — re-added Jul 2026 (client) below
                the Today's-classes + Recent-activity row. Row buttons open
                the same four drill-down modals the Coming-up tab uses. */}
            {activeTab === "today" && (
                <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-3">
                    <p className="font-semibold text-lg text-[#101828]">Needs attention today</p>
                    <div className="flex flex-col">
                        <NeedsAttentionRow
                            icon={RefreshCw01}
                            iconBg="bg-[#eff8ff]"
                            iconFg="text-[#175cd3]"
                            title={`${needsAttention.renewTodayCount} ${needsAttention.renewTodayCount === 1 ? "membership renews" : "memberships renew"} today`}
                            subtitle={`AED ${needsAttention.renewTotalAed.toLocaleString("en-US")} recurring`}
                            onView={() => setAttentionModal("renewal")}
                        />
                        <NeedsAttentionRow
                            icon={Bell01}
                            iconBg="bg-[#fff6ed]"
                            iconFg="text-[#c4320a]"
                            title={`${needsAttention.expireTodayCount} ${needsAttention.expireTodayCount === 1 ? "membership expires" : "memberships expire"} today`}
                            subtitle="Send a reminder before membership expire"
                            onView={() => setAttentionModal("renewal")}
                        />
                        <NeedsAttentionRow
                            icon={CreditCard01}
                            iconBg="bg-[#fef3f2]"
                            iconFg="text-[#b42318]"
                            title={`${needsAttention.failedCount} failed ${needsAttention.failedCount === 1 ? "payment" : "payments"}`}
                            subtitle={`Payment failed · AED ${needsAttention.failedTotalAed.toLocaleString("en-US")}`}
                            onView={() => setAttentionModal("failed")}
                        />
                        <NeedsAttentionRow
                            icon={UserX01}
                            iconBg="bg-[#fefbe8]"
                            iconFg="text-[#a15c07]"
                            title={`${needsAttention.clientsAtRisk} ${needsAttention.clientsAtRisk === 1 ? "client" : "clients"} at risk`}
                            subtitle="No visit in 14-30 days · win them back"
                            onView={() => setAttentionModal("atrisk")}
                        />
                        <NeedsAttentionRow
                            icon={CalendarCheck01}
                            iconBg="bg-[#ecfdf3]"
                            iconFg="text-[#079455]"
                            title="Under filled classes"
                            subtitle={`${needsAttention.underFilled} ${needsAttention.underFilled === 1 ? "class" : "classes"} below 50% capacity`}
                            onView={() => setAttentionModal("underfilled")}
                            isLast
                        />
                    </div>
                </div>
            )}

            <AddWidgetModal
                open={widgetModalOpen}
                onClose={() => setWidgetModalOpen(false)}
                activeWidgetIds={activeWidgets}
                onAdd={handleAddWidget}
                onRemove={handleRemoveWidget}
            />

            {/* Needs-attention drill-down modals — all four share the same
                branch-scope filter (empty string = all locations, matches
                the rest of the dashboard). */}
            <RenewalDueModal
                open={attentionModal === "renewal"}
                onClose={() => setAttentionModal(null)}
                branchId={branchScopeId}
                /* Forward-N-day window — matches the Coming-up "Renewals
                   due" metric so count + list agree at both pill settings. */
                forwardRangeDays={comingRange}
            />
            <FailedPaymentsModal
                open={attentionModal === "failed"}
                onClose={() => setAttentionModal(null)}
                branchId={branchScopeId}
                /* Past-N-day window — matches the Coming-up "Failed payments"
                   metric so count + list agree at both pill settings. */
                pastRangeDays={comingRange}
            />
            <AtRiskClientsModal
                open={attentionModal === "atrisk"}
                onClose={() => setAttentionModal(null)}
                branchId={branchScopeId}
            />
            <UnderFilledModal
                open={attentionModal === "underfilled"}
                onClose={() => setAttentionModal(null)}
                branchId={branchScopeId}
                /* Forward-N-day window — matches the Coming-up "Under
                   filled classes" metric so count + list agree at both
                   pill settings. */
                forwardRangeDays={comingRange}
            />

            <Toast />
        </div>
    );
}
