"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
    CurrencyDollar,
    Users01,
    ShoppingBag01,
    TrendUp01,
    ArrowUp,
    ArrowDown,
    MarkerPin01,
    CalendarCheck01,
    CreditCard02,
    User01,
    UserCheck01,
    RefreshCw04,
    BarChartSquare01,
    Plus,
    DownloadCloud01,
} from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { downloadCsv, todayISO as csvTodayISO } from "@/lib/csv-export";
import { getWidgetCsvSection } from "@/components/dashboard/DashboardWidgetCard";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useAppStore, SCHEDULE_INSTRUCTORS, DEFAULT_BRANCH_ID } from "@/lib/store";
import { ScheduleClassCard } from "@/components/schedule/ScheduleClassCard";
import { SelectInput } from "@/components/ui/select-input"; // used for location + instructor
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { AddWidgetModal } from "@/components/dashboard/AddWidgetModal";
import { DashboardWidgetCard } from "@/components/dashboard/DashboardWidgetCard";
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

interface ActivityItem {
    id: string;
    name: string;
    timeAgo: string;
    description: string;
    icon: typeof CreditCard02;
}

// ── Mock Data for Dashboard ──
const recentActivity: ActivityItem[] = [
    {
        id: "a1",
        name: "Jhon Martin",
        timeAgo: "14 min ago",
        description: "Purchased the Unlimited membership",
        icon: CreditCard02,
    },
    {
        id: "a2",
        name: "Sara Williams",
        timeAgo: "28 min ago",
        description: "Booked Mat Pilates class for tomorrow",
        icon: CalendarCheck01,
    },
    {
        id: "a3",
        name: "Ahmed Al-Farsi",
        timeAgo: "1 hr ago",
        description: "Purchased the 10-Class Pack",
        icon: CreditCard02,
    },
    {
        id: "a4",
        name: "Emma Dawson",
        timeAgo: "2 hr ago",
        description: "Cancelled Reformer Pilates session",
        icon: CalendarCheck01,
    },
    {
        id: "a5",
        name: "Noah Park",
        timeAgo: "3 hr ago",
        description: "Signed up as a new member",
        icon: Users01,
    },
    {
        id: "a6",
        name: "Mia Anderson",
        timeAgo: "5 hr ago",
        description: "Renewed Unlimited Monthly membership",
        icon: CreditCard02,
    },
    {
        id: "a7",
        name: "Lena Torres",
        timeAgo: "6 hr ago",
        description: "Checked in to Barre class",
        icon: UserCheck01,
    },
    {
        id: "a8",
        name: "James Kim",
        timeAgo: "7 hr ago",
        description: "Purchased the 5-Class Pack",
        icon: CreditCard02,
    },
    {
        id: "a9",
        name: "Sofia Reyes",
        timeAgo: "8 hr ago",
        description: "Auto-renewed Unlimited Monthly",
        icon: RefreshCw04,
    },
    {
        id: "a10",
        name: "Omar Hassan",
        timeAgo: "9 hr ago",
        description: "Booked Reformer Pilates for Friday",
        icon: CalendarCheck01,
    },
];

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
    onOpenModal,
}: {
    activeWidgets: string[];
    period: DateFilter;
    onRemoveWidget: (id: string) => void;
    onOpenModal: () => void;
}) {
    return (
        <div className="grid grid-cols-2 gap-6">
            {activeWidgets.map(id => (
                <DashboardWidgetCard
                    key={id}
                    widgetId={id}
                    period={period}
                    action="kebab"
                    onRemove={() => onRemoveWidget(id)}
                />
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

function ActivityRow({ item }: { item: ActivityItem }) {
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

const instructorOptions = [
    { value: "all", label: "All instructors" },
    { value: "sara", label: "Sara Al-Rashid" },
    { value: "maya", label: "Maya Johnson" },
    { value: "liam", label: "Liam Chen" },
];


// ── Main Dashboard ──
export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"today" | "performance">("today");
    const [location, setLocation] = useState<string>(DEFAULT_BRANCH_ID);
    const [instructor, setInstructor] = useState("all");
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

    // KPI aggregates — recompute whenever scope or underlying slices change.
    const metrics = useMemo<DashboardMetric[]>(() => {
        // Today's revenue = sum of completed transactions created today within scope.
        const todayRevenue = scopedTransactions
            .filter(t => t.status === "complete" && t.createdAtISO.startsWith(todayISO))
            .reduce((sum, t) => sum + t.amountAed, 0);

        // Active members = customers in scope with status === "active".
        const activeMembers = scopedCustomers.filter(c => c.status === "active").length;

        // Classes today = schedules in scope whose dateISO matches today.
        const classesToday = scopedSchedules.filter(s => s.dateISO === todayISO).length;

        // Bookings today = bookings whose class_schedule is scheduled today.
        // `class_bookings` already carries `branchId` (mirror of its schedule's
        // branch), so the same scope filter applies. We still need the date —
        // pull it from the schedule via class_schedule_id.
        const todayScheduleIds = new Set(
            scopedSchedules.filter(s => s.dateISO === todayISO).map(s => s.id),
        );
        const bookingsToday = scopedBookings.filter(
            b => b.status === "booked" && todayScheduleIds.has(b.classScheduleId),
        ).length;

        return [
            {
                label: "Today's revenue",
                value: `AED ${todayRevenue.toLocaleString("en-US")}`,
                change: 3,
                positive: true,
                comparison: "vs yesterday",
                icon: CurrencyDollar,
            },
            {
                label: "Active members",
                value: activeMembers.toLocaleString("en-US"),
                change: 3,
                positive: true,
                comparison: "vs yesterday",
                icon: Users01,
            },
            {
                label: "Classes today",
                value: classesToday.toLocaleString("en-US"),
                change: 2,
                positive: true,
                comparison: "vs yesterday",
                icon: CalendarCheck01,
            },
            {
                label: "Bookings today",
                value: bookingsToday.toLocaleString("en-US"),
                change: 1,
                positive: true,
                comparison: "vs yesterday",
                icon: ShoppingBag01,
            },
        ];
    }, [scopedTransactions, scopedCustomers, scopedSchedules, scopedBookings, todayISO]);

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
    const formattedDate = format(today, "EEE, dd MMM yyyy");

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
                        <SelectInput
                            triggerIcon={<User01 className="w-5 h-5" />}
                            placeholder="All instructors"
                            options={instructorOptions}
                            value={instructor}
                            onChange={setInstructor}
                            width="w-[180px]"
                        />

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
                    onOpenModal={() => setWidgetModalOpen(true)}
                />
            )}

            {/* Bottom Section — Classes + Activity (Today tab only) */}
            {activeTab === "today" && <div className="flex items-start gap-6">

                {/* Today's Classes */}
                <div className="bg-white border border-[#e4e7ec] flex flex-1 flex-col gap-4 h-[532px] items-start min-w-0 overflow-hidden pb-4 pt-6 px-6 relative rounded-[20px]">
                    {/* Header */}
                    <div className="flex gap-5 items-center w-full flex-shrink-0">
                        <div className="flex flex-1 flex-col gap-5 items-start min-w-0 relative">
                            <div className="flex gap-4 items-start w-full">
                                <div className="flex flex-1 flex-col gap-1 items-start justify-center min-w-0 relative self-stretch">
                                    <p className="font-semibold text-lg text-[#101828] w-full">
                                        Today&apos;s classes
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* Date badge */}
                        <div className="bg-[#f9fafb] border-1 border-[#e4e7ec] flex gap-1 items-center pl-2.5 pr-3 py-1 relative rounded-full flex-shrink-0">
                            <CalendarCheck01 size={12} className="text-[#344054]" />
                            <p className="font-medium text-sm text-[#344054] text-center whitespace-nowrap">
                                {formattedDate}
                            </p>
                        </div>
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
                                                onClick={() => router.push(`/schedule/${c.id}`)}
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
                    {/* Header */}
                    <div className="flex flex-col gap-5 items-start w-full flex-shrink-0">
                        <div className="flex gap-4 items-start w-full">
                            <div className="flex flex-1 flex-col gap-1 items-start justify-center min-w-0 relative self-stretch">
                                <p className="font-semibold text-lg text-[#101828] w-full">
                                    Recent activity
                                </p>
                            </div>
                        </div>
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
