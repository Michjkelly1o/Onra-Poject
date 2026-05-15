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
    Building01,
    UserCheck01,
    RefreshCw04,
    BarChartSquare01,
    Plus,
    DownloadCloud01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useAppStore, SCHEDULE_INSTRUCTORS } from "@/lib/store";
import { ScheduleClassCard } from "@/components/schedule/ScheduleClassCard";
import { SelectInput } from "@/components/ui/select-input"; // used for location + instructor
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { AddWidgetModal } from "@/components/dashboard/AddWidgetModal";
import { DashboardWidgetCard } from "@/components/dashboard/DashboardWidgetCard";
import { DEFAULT_ACTIVE_WIDGETS } from "@/components/dashboard/widget-catalog";

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
// CATEGORY_COLORS (Pilates/Barre/Yoga/Roller Release).
const CATEGORY_PALETTE: Record<string, { bg: string; border: string; text: string }> = {
    Pilates:          { bg: "#e9fff3", border: "#658774", text: "#3b5446" },
    Barre:            { bg: "#e9fbff", border: "#4b8c9a", text: "#1b4c56" },
    Yoga:             { bg: "#fff8e9", border: "#dc6803", text: "#7a2e0e" },
    "Roller Release": { bg: "#f0fcf9", border: "#0e9384", text: "#125d56" },
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

const metrics = [
    {
        label: "Today Revenue",
        value: "2,000",
        change: 3,
        positive: true,
        comparison: "vs yesterday",
        icon: CurrencyDollar,
    },
    {
        label: "Active Members",
        value: "84",
        change: 3,
        positive: true,
        comparison: "vs yesterday",
        icon: Users01,
    },
    {
        label: "Low Stock Items",
        value: "3",
        change: 2,
        positive: false,
        comparison: "vs yesterday",
        icon: ShoppingBag01,
    },
    {
        label: "Avg Occupancy",
        value: "78%",
        change: 1,
        positive: false,
        comparison: "vs yesterday",
        icon: TrendUp01,
    },
];



// ── Performance Tab ───────────────────────────────────────────────────────────

function PerformanceTab({
    activeWidgets,
    onRemoveWidget,
    onOpenModal,
}: {
    activeWidgets: string[];
    onRemoveWidget: (id: string) => void;
    onOpenModal: () => void;
}) {
    return (
        <div className="grid grid-cols-2 gap-6">
            {activeWidgets.map(id => (
                <DashboardWidgetCard
                    key={id}
                    widgetId={id}
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

function MetricCard({ metric }: { metric: typeof metrics[0] }) {
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

function ReportDropdown() {
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
                            onClick={() => setOpen(false)}
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

const locationOptions = [
    { value: "south", label: "Forma Studio (South)", icon: <Building01 className="w-4 h-4" /> },
    { value: "east", label: "Forma Studio (East)", icon: <Building01 className="w-4 h-4" /> },
    { value: "north", label: "Forma Studio (North)", icon: <Building01 className="w-4 h-4" /> },
];

const instructorOptions = [
    { value: "all", label: "All instructors" },
    { value: "sara", label: "Sara Al-Rashid" },
    { value: "maya", label: "Maya Johnson" },
    { value: "liam", label: "Liam Chen" },
];


// ── Main Dashboard ──
export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<"today" | "performance">("today");
    const [location, setLocation] = useState<string>("");
    const [instructor, setInstructor] = useState("all");
    const [period, setPeriod] = useState<DateFilter>({ type: "week", label: "This week" });
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);
    const [activeWidgets, setActiveWidgets] = useState<string[]>(DEFAULT_ACTIVE_WIDGETS);
    const today = new Date();

    const classSchedules = useAppStore(s => s.classSchedules);

    // Derive today's classes. The seed data centres around end-Feb 2025, so for a
    // realistic prototype we surface the next 6 upcoming/ongoing classes regardless
    // of the wall-clock date — keeping the dashboard visually populated.
    const todayClasses = useMemo<ScheduleClass[]>(() => {
        return [...classSchedules]
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
    }, [classSchedules]);

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
        setActiveWidgets(prev => prev.includes(id) ? prev : [...prev, id]);
    }
    function handleRemoveWidget(id: string) {
        setActiveWidgets(prev => prev.filter(w => w !== id));
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
                    Welcome, Forma Studio
                </p>

                {/* Location picker — always visible */}
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-5 h-5" />}
                    placeholder="Select location"
                    options={locationOptions}
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
                        <ReportDropdown />
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
        </div>
    );
}
