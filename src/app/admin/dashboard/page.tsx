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
    change: number;
    positive: boolean;
    comparison: string;
    icon: typeof CurrencyDollar;
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
}: {
    activeWidgets: string[];
    period: DateFilter;
    onRemoveWidget: (id: string) => void;
    /** Swap widgets at `fromIndex` and `toIndex` in the active list.
     *  Called by the native HTML5 drag-and-drop handlers below — no
     *  external dnd library required. */
    onReorderWidgets: (fromIndex: number, toIndex: number) => void;
    onOpenModal: () => void;
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

            {/* Add widget entry point */}
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
    return (
        <div className="bg-white border border-[#e4e7ec] flex flex-1 gap-6 items-start justify-end min-w-0 p-6 relative rounded-2xl">
            <div className="flex flex-1 flex-col gap-2 items-start min-w-0 relative">
                <p className="font-normal text-sm text-[#667085] whitespace-nowrap">
                    {metric.label}
                </p>
                <p className="font-semibold text-2xl text-[#101828]">
                    {metric.value}
                </p>
                <div className="flex gap-1 items-center">
                    {/* Badge */}
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
                            "font-medium text-sm",
                            metric.positive ? "text-[#067647]" : "text-[#b42318]"
                        )}>
                            {metric.change}%
                        </span>
                    </div>
                    <p className="font-normal text-sm text-[#667085] whitespace-nowrap">
                        {metric.comparison}
                    </p>
                </div>
            </div>
            {/* Featured icon */}
            <div className="bg-[#f1f2ed] overflow-hidden relative rounded-full flex-shrink-0 w-10 h-10 flex items-center justify-center">
                <Icon size={20} className="text-[#475467]" />
            </div>
        </div>
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
    const [activeTab, setActiveTab] = useState<"today" | "performance">("today");
    // "" = "All locations" — dashboard opens on the aggregate view so
    // KPIs read like the full studio on first paint.
    const [location, setLocation] = useState<string>("");
    const [period, setPeriod] = useState<DateFilter>({ type: "week", label: "This week" });
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);
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

    // KPI aggregates — client dashboard update Jul 2026 (Figma 7798:80364).
    // Five cards replace the previous four:
    //   Total sales / Total revenue / New customers / Total classes /
    //   Avg occupancy.
    // Every value reads live from the scoped slices so branch pick + all-
    // locations aggregate stay in sync.
    const metrics = useMemo<DashboardMetric[]>(() => {
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

        // Classes scheduled today (any status) — the operational lens the
        // dashboard needs. Cancelled classes still take a slot the front
        // desk saw arriving, so they count too.
        const todaySchedules = scopedSchedules.filter(s => s.dateISO === todayISO);
        const totalClasses = todaySchedules.length;

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

        return [
            {
                label: "Total sales",
                value: totalSalesCount.toLocaleString("en-US"),
                change: 3,
                positive: true,
                comparison: "vs yesterday",
                icon: CurrencyDollar,
            },
            {
                label: "Total revenue",
                value: `AED ${totalRevenueAed.toLocaleString("en-US")}`,
                change: 3,
                positive: true,
                comparison: "vs yesterday",
                icon: CoinsStacked01,
            },
            {
                label: "New customers",
                value: newCustomers.toLocaleString("en-US"),
                change: 2,
                positive: false,
                comparison: "vs yesterday",
                icon: UserPlus01,
            },
            {
                label: "Total classes",
                value: totalClasses.toLocaleString("en-US"),
                change: 1,
                positive: false,
                comparison: "vs yesterday",
                icon: Calendar,
            },
            {
                label: "Avg occupancy",
                value: `${avgOccupancyPct}%`,
                change: 1,
                positive: false,
                comparison: "vs yesterday",
                icon: TrendUp01,
            },
        ];
    }, [scopedTransactions, scopedCustomers, scopedSchedules, todayISO]);

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

        // Failed / pending transactions from today — the front desk
        // needs to chase these before the billing window closes.
        const failedTxns = scopedTransactions.filter(t =>
            (t.status === "failed" || t.status === "pending")
            && t.createdAtISO.startsWith(todayISO),
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

            {/* Tab Navigation */}
            <div className="border-b border-[#e4e7ec]">
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
                        <span className="text-sm">Today at glance</span>
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

            {/* Welcome + Location Picker + Performance actions */}
            <div className="flex gap-2 items-center">
                <p className="flex-1 font-semibold text-base text-[#101828]">
                    Welcome, {studioDisplayName}
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

            {/* KPI Metrics */}
            <div className="flex flex-wrap gap-6 items-start">
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

            {/* Needs attention today — client dashboard update Jul 2026
                (Figma 7798:80427). Sits BELOW the Today's classes +
                Recent activity row so the front desk works top-down:
                metrics → schedule + feed → outstanding actions. Each
                row's "View" button links to the module that owns the
                fix (renewals → customers list, expiring → notification
                composer, failed payment → refunds report, at-risk →
                win-back report, under-filled → schedule). Rows with a
                zero count still render so admins learn the shape of
                the surface even on a quiet day. */}
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
                            onView={() => router.push("/admin/customers?renewing=today")}
                        />
                        <NeedsAttentionRow
                            icon={Bell01}
                            iconBg="bg-[#fff6ed]"
                            iconFg="text-[#c4320a]"
                            title={`${needsAttention.expireTodayCount} ${needsAttention.expireTodayCount === 1 ? "membership expires" : "memberships expire"} today`}
                            subtitle="Send a reminder before membership expire"
                            onView={() => router.push("/admin/settings/notifications")}
                        />
                        <NeedsAttentionRow
                            icon={CreditCard01}
                            iconBg="bg-[#fef3f2]"
                            iconFg="text-[#b42318]"
                            title={`${needsAttention.failedCount} failed ${needsAttention.failedCount === 1 ? "payment" : "payments"}`}
                            subtitle={`Payment failed · AED ${needsAttention.failedTotalAed.toLocaleString("en-US")}`}
                            onView={() => router.push("/reports/refunds")}
                        />
                        <NeedsAttentionRow
                            icon={UserX01}
                            iconBg="bg-[#fefbe8]"
                            iconFg="text-[#a15c07]"
                            title={`${needsAttention.clientsAtRisk} ${needsAttention.clientsAtRisk === 1 ? "client" : "clients"} at risk`}
                            subtitle="No visit in 14-30 days · win them back"
                            onView={() => router.push("/reports/win-back")}
                        />
                        <NeedsAttentionRow
                            icon={CalendarCheck01}
                            iconBg="bg-[#ecfdf3]"
                            iconFg="text-[#079455]"
                            title="Under filled classes"
                            subtitle={`${needsAttention.underFilled} ${needsAttention.underFilled === 1 ? "class" : "classes"} below 50% capacity`}
                            onView={() => router.push("/admin/schedule")}
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

            <Toast />
        </div>
    );
}
