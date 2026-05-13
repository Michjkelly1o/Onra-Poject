"use client";

import { useState } from "react";
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
    ChevronDown,
    Calendar,
    User01,
    BarChartSquare01,
    Plus,
    DownloadCloud01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
    BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from "recharts";

// ── Types ──
type ClassType = "Mat Pilates" | "Reformer Pilates" | "Barre" | "Roller Release";

interface ScheduleClass {
    id: string;
    type: ClassType;
    time: string;
    endTime: string;
    instructor: string;
    location: string;
    occupancy: string;
    color: string;
    accentColor: string;
    bgColor: string;
}

interface ActivityItem {
    id: string;
    name: string;
    timeAgo: string;
    description: string;
    icon: typeof CreditCard02;
}

// ── Mock Data for Dashboard ──
const todayClasses: ScheduleClass[] = [
    {
        id: "c1",
        type: "Reformer Pilates",
        time: "10:00",
        endTime: "11:00 AM",
        instructor: "Sara A.",
        location: "Reformer Studio",
        occupancy: "12/16",
        color: "#b892ba",
        accentColor: "#b892ba",
        bgColor: "bg-[#f7f3f7]",
    },
    {
        id: "c2",
        type: "Mat Pilates",
        time: "10:30",
        endTime: "11:30 AM",
        instructor: "Liam C.",
        location: "Reformer Studio",
        occupancy: "12/16",
        color: "#92baa4",
        accentColor: "#92baa4",
        bgColor: "bg-[#e9fff3]",
    },
    {
        id: "c3",
        type: "Barre",
        time: "10:30",
        endTime: "11:30 AM",
        instructor: "Maya J.",
        location: "Reformer Studio",
        occupancy: "12/16",
        color: "#92d1de",
        accentColor: "#92d1de",
        bgColor: "bg-[#f0fdf9]",
    },
    {
        id: "c4",
        type: "Roller Release",
        time: "12:00",
        endTime: "1:00 PM",
        instructor: "Liam C.",
        location: "Reformer Studio",
        occupancy: "8/10",
        color: "#9ea093",
        accentColor: "#9ea093",
        bgColor: "bg-[#f1f2ed]",
    },
];

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

// ── Performance Tab Mock Data ──

const revenueChartData = [
    { date: "Feb 22", revenue: 480, lastWeek: 640 },
    { date: "Feb 23", revenue: 540, lastWeek: 610 },
    { date: "Feb 24", revenue: 600, lastWeek: 630 },
    { date: "Feb 25", revenue: 680, lastWeek: 615 },
    { date: "Feb 26", revenue: 760, lastWeek: 595 },
    { date: "Feb 27", revenue: 830, lastWeek: 605 },
    { date: "Feb 28", revenue: 910, lastWeek: 610 },
];

const attendanceChartData = [
    { date: "Feb 22", visits: 22, cancellations: 8, noShow: 3 },
    { date: "Feb 23", visits: 18, cancellations: 30, noShow: 4 },
    { date: "Feb 24", visits: 12, cancellations: 10, noShow: 2 },
    { date: "Feb 25", visits: 35, cancellations: 6, noShow: 3 },
    { date: "Feb 26", visits: 25, cancellations: 22, noShow: 2 },
    { date: "Feb 27", visits: 28, cancellations: 24, noShow: 3 },
    { date: "Feb 28", visits: 22, cancellations: 20, noShow: 2 },
];

const salesChartData = [
    { date: "Feb 22", membership: 28, package: 8 },
    { date: "Feb 23", membership: 18, package: 12 },
    { date: "Feb 24", membership: 15, package: 5 },
    { date: "Feb 25", membership: 10, package: 8 },
    { date: "Feb 26", membership: 30, package: 10 },
    { date: "Feb 27", membership: 35, package: 42 },
    { date: "Feb 28", membership: 8, package: 5 },
];

const topClasses = [
    { name: "Reformer Pilates", instructor: "Sara Al-Rashid", color: "#b892ba", bookings: 142, occupancy: 89 },
    { name: "Mat Pilates", instructor: "Liam Chen", color: "#92baa4", bookings: 98, occupancy: 78 },
    { name: "Barre", instructor: "Maya Johnson", color: "#92d1de", bookings: 87, occupancy: 72 },
    { name: "Roller Release", instructor: "Liam Chen", color: "#9ea093", bookings: 45, occupancy: 65 },
];


// ── Performance Tab Components ──

const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-[#e4e7ec] rounded-lg shadow-lg px-3 py-2 text-xs min-w-[120px]">
            <p className="font-semibold text-[#101828] mb-1.5">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} className="flex items-center gap-1.5 mb-0.5" style={{ color: p.color }}>
                    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-[#475467]">{p.name}:</span>
                    <span className="font-medium text-[#101828]">{p.value}</span>
                </p>
            ))}
        </div>
    );
};

function PerformanceTab() {
    return (
        <div className="flex flex-col gap-6">

            {/* Row 1 — Revenue overview + Attendance overview */}
            <div className="grid grid-cols-2 gap-6">

                {/* Revenue overview */}
                <div className="bg-white border border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-3">
                    <div>
                        <p className="font-semibold text-base text-[#101828]">Revenue overview</p>
                        <p className="text-xs text-[#667085] mt-0.5">Total revenue overtime</p>
                    </div>
                    <div className="flex items-center gap-4 justify-end">
                        {[{ color: "#92d1de", label: "Net revenue" }, { color: "#aad4bd", label: "Net revenue last week" }].map(l => (
                            <div key={l.label} className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                                <span className="text-xs text-[#667085]">{l.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={revenueChartData}>
                                <CartesianGrid vertical={false} stroke="#f2f4f7" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#667085", dy: 8, fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#667085", fontSize: 11 }} width={36} domain={[0, 1200]} ticks={[0, 200, 400, 600, 800, 1000]} />
                                <Tooltip content={<ChartTooltip />} />
                                <Line type="monotone" dataKey="revenue" name="Net revenue" stroke="#92d1de" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="lastWeek" name="Last week" stroke="#aad4bd" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Attendance overview */}
                <div className="bg-white border border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-3">
                    <div>
                        <p className="font-semibold text-base text-[#101828]">Attendance overview</p>
                        <p className="text-xs text-[#667085] mt-0.5">Track attendance rate, cancellations, and no-shows across all classes.</p>
                    </div>
                    <div className="flex items-center gap-4 justify-end">
                        {[{ color: "#b892ba", label: "Total visits" }, { color: "#c4edd6", label: "Total cancellations" }, { color: "#92d1de", label: "Total no show" }].map(l => (
                            <div key={l.label} className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                                <span className="text-xs text-[#667085]">{l.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="h-[100%]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={attendanceChartData} barGap={2} barCategoryGap="30%">
                                <CartesianGrid vertical={false} stroke="#f2f4f7" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#667085", dy: 8, fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#667085", fontSize: 11 }} width={28} domain={[0, 50]} ticks={[0, 10, 20, 30, 40, 50]} />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                                <Bar dataKey="visits" name="Total visits" fill="#b892ba" radius={[3, 3, 0, 0]} maxBarSize={10} />
                                <Bar dataKey="cancellations" name="Cancellations" fill="#c4edd6" radius={[3, 3, 0, 0]} maxBarSize={10} />
                                <Bar dataKey="noShow" name="No show" fill="#92d1de" radius={[3, 3, 0, 0]} maxBarSize={10} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Row 2 — Sales by product + Class by popularity */}
            <div className="grid grid-cols-2 gap-6">

                {/* Sales by product */}
                <div className="bg-white border border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-3">
                    <div>
                        <p className="font-semibold text-base text-[#101828]">Sales by product</p>
                        <p className="text-xs text-[#667085] mt-0.5">Total sales by product overtime</p>
                    </div>
                    <div className="flex items-center gap-4 justify-end">
                        {[{ color: "#c4edd6", label: "Membership" }, { color: "#92d1de", label: "Class package" }].map(l => (
                            <div key={l.label} className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                                <span className="text-xs text-[#667085]">{l.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="h-[100%]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={salesChartData} barGap={3} barCategoryGap="30%">
                                <CartesianGrid vertical={false} stroke="#f2f4f7" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#667085", dy: 8, fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#667085", fontSize: 11 }} width={28} domain={[0, 50]} ticks={[0, 10, 20, 30, 40, 50]} />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                                <Bar dataKey="membership" name="Membership" fill="#c4edd6" radius={[3, 3, 0, 0]} maxBarSize={10} />
                                <Bar dataKey="package" name="Class package" fill="#92d1de" radius={[3, 3, 0, 0]} maxBarSize={10} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Class by popularity */}
                <div className="bg-white border border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-4">
                    <div>
                        <p className="font-semibold text-base text-[#101828]">Class by popularity</p>
                        <p className="text-xs text-[#667085] mt-0.5">Class popularity overtime</p>
                    </div>
                    <div className="flex flex-col gap-0">
                        {topClasses.map((cls, idx) => (
                            <div key={cls.name} className={cn("flex items-center gap-3 py-3", idx < topClasses.length - 1 && "border-b border-[#f9fafb]")}>
                                {/* Color thumbnail */}
                                <div className="w-12 h-12 rounded-md flex-shrink-0 border border-[#e4e7ec] overflow-hidden" style={{ backgroundColor: cls.color + "40" }}>
                                    <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${cls.color}80, ${cls.color}20)` }} />
                                </div>
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-[#101828] truncate">{cls.name}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: cls.color }} />
                                        <span className="text-xs text-[#667085]">{cls.instructor}</span>
                                    </div>
                                </div>
                                {/* Stats */}
                                <div className="text-right flex-shrink-0">
                                    <p className="text-xs text-[#667085]">{cls.bookings} bookings</p>
                                    <p className="text-xs font-medium text-[#475467] mt-0.5">{cls.occupancy}% occupancy</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Row 3 — Add widget placeholder (left only) */}
            <div className="grid grid-cols-2 gap-6">
                <button className="border-2 border-dashed border-[#d0d5dd] rounded-[20px] p-6 flex flex-col items-center justify-center gap-3 h-[180px] hover:border-[#4b8c9a] hover:bg-[#fafeff] transition-colors group">
                    <div className="w-10 h-10 rounded-xl bg-[#f1f2ed] flex items-center justify-center group-hover:bg-[#e9fbff] transition-colors">
                        <BarChartSquare01 className="w-5 h-5 text-[#667085] group-hover:text-[#4b8c9a]" />
                    </div>
                    <div className="text-center">
                        <p className="font-semibold text-sm text-[#344054]">Add widget</p>
                        <p className="text-xs text-[#667085] mt-0.5">Add widgets to customize your dashboard insights.</p>
                    </div>
                </button>
                <div /> {/* empty right cell */}
            </div>

        </div>
    );
}

// ── Sub-components ──

function ClassScheduleCard({ cls }: { cls: ScheduleClass }) {
    return (
        <div
            className={cn(
                "flex gap-4 items-center pl-5 pr-3 py-3 relative rounded-md w-full hover:opacity-90 transition-opacity cursor-pointer",
                cls.bgColor
            )}
        >
            {/* Left accent bar */}
            <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[6px] h-[90px] rounded-tl-3xl rounded-bl-lg"
                style={{ backgroundColor: cls.accentColor }}
            />

            {/* Content */}
            <div className="flex flex-col gap-1 items-start flex-1 pl-1">
                <p className="font-medium text-sm text-[#101828] whitespace-nowrap">
                    {cls.type}
                </p>
                <p className="font-normal text-sm text-[#667085] whitespace-nowrap">
                    {cls.time} - {cls.endTime}
                </p>
                <div className="flex gap-2 items-center">
                    {/* Instructor */}
                    <div className="flex gap-1 items-center">
                        <div className="w-4 h-4 rounded-full bg-[#e0e0e0] overflow-hidden flex-shrink-0">
                            <div className="w-full h-full bg-gradient-to-br from-brand-300 to-brand-500 rounded-full" />
                        </div>
                        <span className="text-sm text-[#667085]">{cls.instructor}</span>
                    </div>
                    {/* Divider */}
                    <div className="w-px h-3 bg-[#d0d5dd]" />
                    {/* Location */}
                    <div className="flex gap-1 items-center">
                        <MarkerPin01 size={16} className="text-[#667085]" />
                        <span className="text-sm text-[#667085]">{cls.location}</span>
                    </div>
                    {/* Divider */}
                    <div className="w-px h-3 bg-[#d0d5dd]" />
                    {/* Occupancy */}
                    <div className="flex gap-1 items-center">
                        <Users01 size={16} className="text-[#667085]" />
                        <span className="text-sm text-[#667085]">{cls.occupancy}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ metric }: { metric: typeof metrics[0] }) {
    const Icon = metric.icon;
    return (
        <div className="bg-white border border-[#e4e7ec] flex flex-1 gap-6 items-start justify-end min-w-0 p-6 relative rounded-2xl hover-lift">
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

// ── Schedule time slots ──
const timeSlots = [
    { time: "10:00", meridiem: "AM", classes: ["c1"] },
    { time: "10:30", meridiem: "AM", classes: ["c2", "c3"] },
    { time: "12:00", meridiem: "PM", classes: ["c4"] },
];

const instructorList = ["All instructors", "Sara Al-Rashid", "Maya Johnson", "Liam Chen"];
const periodList = ["Today", "This week", "This month", "Last 30 days", "Custom range"];

// ── Main Dashboard ──
export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<"today" | "performance">("today");
    const [instructor, setInstructor] = useState("Select instructor");
    const [period, setPeriod] = useState("This week");
    const [showInstructor, setShowInstructor] = useState(false);
    const [showPeriod, setShowPeriod] = useState(false);
    const today = new Date();
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
                <Button
                    variant="secondary-gray"
                    size="md"
                    leftIcon={<MarkerPin01 className="w-4 h-4 text-[#667085]" />}
                    rightIcon={<ChevronDown className="w-4 h-4 text-[#667085]" />}
                    className="w-[200px] justify-between flex-shrink-0 font-normal"
                >
                    <span className="flex-1 text-left truncate">Forma Studio (South)</span>
                </Button>

                {/* Performance-only controls */}
                {activeTab === "performance" && (
                    <>
                        {/* Instructor dropdown */}
                        <div className="relative flex-shrink-0">
                            <Button
                                variant="secondary-gray"
                                size="md"
                                leftIcon={<User01 className="w-4 h-4 text-[#667085]" />}
                                rightIcon={<ChevronDown className="w-4 h-4 text-[#667085]" />}
                                onClick={() => { setShowInstructor(!showInstructor); setShowPeriod(false); }}
                                className="whitespace-nowrap"
                            >
                                {instructor}
                            </Button>
                            {showInstructor && (
                                <div className="absolute right-0 top-full mt-1 w-[180px] bg-white border border-[#e4e7ec] rounded-lg shadow-lg z-30 overflow-hidden">
                                    {instructorList.map((i) => (
                                        <button key={i} onClick={() => { setInstructor(i); setShowInstructor(false); }}
                                            className={cn("w-full text-left px-3 py-2 text-sm transition-colors", i === instructor ? "bg-[#f1f2ed] text-[#101828] font-medium" : "text-[#344054] hover:bg-[#f9fafb]")}
                                        >{i}</button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Period dropdown */}
                        <div className="relative flex-shrink-0">
                            <Button
                                variant="secondary-gray"
                                size="md"
                                leftIcon={<Calendar className="w-4 h-4 text-[#667085]" />}
                                rightIcon={<ChevronDown className="w-4 h-4 text-[#667085]" />}
                                onClick={() => { setShowPeriod(!showPeriod); setShowInstructor(false); }}
                                className="whitespace-nowrap"
                            >
                                {period}
                            </Button>
                            {showPeriod && (
                                <div className="absolute right-0 top-full mt-1 w-[160px] bg-white border border-[#e4e7ec] rounded-lg shadow-lg z-30 overflow-hidden">
                                    {periodList.map((d) => (
                                        <button key={d} onClick={() => { setPeriod(d); setShowPeriod(false); }}
                                            className={cn("w-full text-left px-3 py-2 text-sm transition-colors", d === period ? "bg-[#f1f2ed] text-[#101828] font-medium" : "text-[#344054] hover:bg-[#f9fafb]")}
                                        >{d}</button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Add widget */}
                        <Button
                            variant="secondary-gray"
                            size="md"
                            leftIcon={<Plus className="w-4 h-4" />}
                            className="flex-shrink-0 whitespace-nowrap"
                        >
                            Add widget
                        </Button>

                        {/* Report download — DS primary (sage green) */}
                        <Button
                            variant="primary"
                            size="md"
                            leftIcon={<DownloadCloud01 className="w-4 h-4" />}
                            className="flex-shrink-0 whitespace-nowrap"
                        >
                            Report
                        </Button>
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
            {activeTab === "performance" && <PerformanceTab />}

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
                        <div className="bg-[#f9fafb] border border-[#e4e7ec] flex gap-1 items-center pl-2.5 pr-3 py-1 relative rounded-full flex-shrink-0">
                            <CalendarCheck01 size={12} className="text-[#344054]" />
                            <p className="font-medium text-sm text-[#344054] text-center whitespace-nowrap">
                                {formattedDate}
                            </p>
                        </div>
                    </div>

                    {/* Schedule Timeline */}
                    <div className="flex flex-1 items-start min-h-0 w-full overflow-y-auto">
                        {/* Time column */}
                        <div className="flex flex-col items-start flex-shrink-0 w-[70px]">
                            {timeSlots.map((slot) => (
                                <div
                                    key={slot.time}
                                    className={cn(
                                        "border-[#e4e7ec] flex gap-0 items-center justify-end px-4 w-full",
                                        slot.classes.length > 1
                                            ? "border-b py-8 h-[224px]"
                                            : "border-b py-10 h-[116px]"
                                    )}
                                >
                                    <div className="flex flex-col items-end flex-shrink-0">
                                        <p className="font-medium text-sm text-[#667085] whitespace-nowrap">
                                            {slot.time}
                                        </p>
                                        <p className="font-medium text-sm text-[#667085] whitespace-nowrap">
                                            {slot.meridiem}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Classes column */}
                        <div className="flex flex-1 flex-col items-start min-w-0 relative">
                            {/* 10:00 AM - Reformer Pilates */}
                            <div className="border-b border-[#e4e7ec] flex gap-0 items-start pl-0 py-3 w-full flex-shrink-0">
                                <ClassScheduleCard cls={todayClasses[0]} />
                            </div>
                            {/* 10:30 AM - Mat Pilates + Barre */}
                            <div className="border-b border-[#e4e7ec] flex flex-col gap-4 items-start pl-0 py-3 w-full flex-shrink-0">
                                <ClassScheduleCard cls={todayClasses[1]} />
                                <ClassScheduleCard cls={todayClasses[2]} />
                            </div>
                            {/* 12:00 PM - Roller Release */}
                            <div className="flex gap-0 items-start pl-0 py-3 w-full flex-shrink-0">
                                <ClassScheduleCard cls={todayClasses[3]} />
                            </div>
                        </div>
                    </div>

                    {/* Fade gradient at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                </div>

                {/* Recent Activity */}
                <div className="bg-white border border-[#e4e7ec] flex flex-1 flex-col gap-4 h-[532px] items-start min-w-0 overflow-hidden pb-4 pt-6 px-6 relative rounded-[20px]">
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
                    <div className="flex flex-1 flex-col gap-4 items-start min-h-0 overflow-hidden w-full">
                        {recentActivity.map((item, idx) => (
                            <div key={item.id} className="w-full flex flex-col gap-4">
                                <ActivityRow item={item} />
                                {idx < recentActivity.length - 1 && (
                                    <div className="w-full h-px bg-[#e4e7ec]" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>}
        </div>
    );
}
