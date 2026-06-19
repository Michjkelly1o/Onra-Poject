"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor dashboard (/instructor/dashboard)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 7280:42465. Composes the existing admin DS — same `<Header>`,
// `<Sidebar>` (via the layout), border-1 + radius-16 card shell, badge
// component, Recharts setup. Nothing new is invented; only the contents +
// layout are instructor-specific.
//
// ──────────────────────────────────────────────────────────────────
// ROLE-SCOPED VIEW — reads the SAME centralized store as admin/owner
// pages. Instructor scoping is a `.filter(c => c.instructorId === me)`
// on `classSchedule` + `classBookings`, nothing else. When this app
// moves to Supabase, the same filter becomes an RLS policy on the
// `instructor_id` column. Do NOT fork the seeds or create
// instructor-specific mock files — sync to admin/customer views
// happens automatically through the shared store.
// ──────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
} from "recharts";
import {
    CalendarCheck01,
    CheckCircle,
    Users01,
    SlashCircle01,
    Calendar,
} from "@untitledui/icons";

import { useAppStore, type ClassSchedule, type ClassBooking } from "@/lib/store";
import { ScheduleClassCard } from "@/components/schedule/ScheduleClassCard";
import { instructor_profile } from "@/data/mock/instructor_profile";
import { InstructorMetricCard } from "@/components/instructor/InstructorMetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { dateFilterToRange, isoInRange } from "@/lib/period-filter";
import { cn } from "@/lib/utils";
import { CancellationsModal } from "./CancellationsModal";

// ────────────────────────────────────────────────────────────────────────────
// Period helpers — same `DateFilter` shape the admin dashboard uses
// (so the chip looks/behaves identical and presets line up). The default
// "Last 7 days" matches the Figma "Weekly" mock.
// ────────────────────────────────────────────────────────────────────────────
const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 7 days" };

function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function safePercent(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100);
}
function deltaPercent(curr: number, prev: number): number {
    if (prev === 0) return curr === 0 ? 0 : 100;
    return Math.round(((curr - prev) / prev) * 100);
}
function fmtShortDate(d: Date): string {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
/** Number of whole days in a range (inclusive endpoints). Used to size
 *  the previous-period window + the per-day chart series. */
function rangeDays(from: Date, to: Date): number {
    const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
    return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}
/** Shift the entire range back by its own length — used to compute the
 *  "previous period" baseline for the KPI delta arrows. */
function previousRange(from: Date, to: Date): { from: Date; to: Date } {
    const len = to.getTime() - from.getTime();
    return { from: new Date(from.getTime() - len - 1), to: new Date(from.getTime() - 1) };
}
/** Friendly suffix for the KPI delta line — "vs last 7 days",
 *  "vs last week", "vs last month", etc. Falls back to the generic
 *  "vs previous period" if we can't infer from the filter label. */
function deltaSuffixFor(filter: DateFilter): string {
    const l = filter.label.toLowerCase();
    if (l.includes("last 7"))    return "vs last 7 days";
    if (l.includes("last 30"))   return "vs last 30 days";
    if (l.includes("last 90"))   return "vs last 90 days";
    if (l.includes("this week")) return "vs last week";
    if (l.includes("this month") || l.includes("month to date")) return "vs last month";
    if (l.includes("this year")  || l.includes("year to date"))  return "vs last year";
    if (l === "today")     return "vs yesterday";
    if (l === "yesterday") return "vs 2 days ago";
    return "vs previous period";
}

// ────────────────────────────────────────────────────────────────────────────
// Reusable card shell — matches the Figma "Insights"/"Content" cards
// (white bg, 1px #e4e7ec border, 16px radius, 24px padding).
// ────────────────────────────────────────────────────────────────────────────
function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6", className)}>
            {children}
        </div>
    );
}
function SectionHeader({
    title,
    description,
    right,
}: {
    title: string;
    description?: string;
    right?: React.ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4 mb-5">
            <div className="min-w-0">
                <h2 className="text-lg font-semibold text-[#101828] leading-7">{title}</h2>
                {description && (
                    <p className="text-sm font-normal text-[#475467] leading-5 mt-1">{description}</p>
                )}
            </div>
            {right}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Custom tooltip — used by all three Recharts panels. Matches the
// Figma tooltip style (dark surface, 12px radius, 12px padding,
// single label + entry rows).
// ────────────────────────────────────────────────────────────────────────────
interface TooltipEntry { name: string; value: string; color: string }
/** Recharts tooltip payload, narrowed to the fields we read. The actual
 *  Recharts type uses generic `NameType` (string | number) which makes a
 *  tighter type incompatible — we read defensively and convert with String(). */
type ChartTooltipPayload = {
    name?: string | number;
    value?: string | number;
    color?: string;
    payload?: Record<string, unknown>;
};
function ChartTooltip(props: {
    active?: boolean;
    payload?: readonly ChartTooltipPayload[];
    label?: string | number;
    formatter?: (entry: ChartTooltipPayload) => TooltipEntry;
}) {
    const { active, payload, label, formatter } = props;
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[10px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] px-3 py-2 min-w-[140px]">
            <p className="text-xs font-medium text-[#101828] leading-4 mb-1.5">{String(label ?? "")}</p>
            <div className="flex flex-col gap-1">
                {payload.map((p, idx) => {
                    const entry = formatter
                        ? formatter(p)
                        : { name: String(p.name ?? ""), value: String(p.value ?? ""), color: p.color ?? "#7ba08c" };
                    return (
                        <div key={idx} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                <span className="text-xs font-normal text-[#475467] leading-4">{entry.name}</span>
                            </div>
                            <span className="text-xs font-medium text-[#101828] leading-4">{entry.value}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Category palette — verbatim copy of the schedule module's mapping so the
// upcoming-classes cards in the dashboard pick up the same green/blue/
// amber/violet tint per category that the schedule day/week view uses.
// ────────────────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    Pilates: { bg: "#e9fff3", border: "#658774", text: "#3b5446" },
    Barre:   { bg: "#e9fbff", border: "#4b8c9a", text: "#1b4c56" },
    Yoga:    { bg: "#fff8e9", border: "#dc6803", text: "#7a2e0e" },
    default: { bg: "#f0ecff", border: "#7c5cbf", text: "#4a1fb8" },
};
function getCategoryColor(category: string) {
    return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;
}

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────
export default function InstructorDashboardPage() {
    const router        = useRouter();
    const currentUser   = useAppStore(s => s.currentUser);
    const classSchedules = useAppStore(s => s.classSchedules);
    const classBookings  = useAppStore(s => s.classBookings);

    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [cancelOpen, setCancelOpen] = useState(false);

    // Resolve the staff_profile_id behind the currently-logged-in instructor.
    // `instructor_profile` carries it; for any future demo persona we fall
    // back to the seeded Liam Chen id so the page never renders empty.
    const instructorStaffId = (currentUser as typeof currentUser & { staff_profile_id?: string }).staff_profile_id
        ?? instructor_profile.staff_profile_id;

    // ── Period windows ─────────────────────────────────────────────────────
    // `dateFilterToRange` converts the chip's preset/custom range into a
    // {from, to} pair — identical math the admin dashboard runs, so the
    // two surfaces stay numerically consistent.
    const today        = startOfDay(new Date());
    const currentRange = useMemo(() => dateFilterToRange(period), [period]);
    const prevRange    = useMemo(() => previousRange(currentRange.from, currentRange.to), [currentRange]);
    const periodDays   = rangeDays(currentRange.from, currentRange.to);
    const deltaSuffix  = deltaSuffixFor(period);

    // ── Instructor-scoped slices ───────────────────────────────────────────
    const myClasses = useMemo(
        () => classSchedules.filter((c: ClassSchedule) => c.instructorId === instructorStaffId),
        [classSchedules, instructorStaffId],
    );
    const myClassIds = useMemo(() => new Set(myClasses.map(c => c.id)), [myClasses]);
    const myBookings = useMemo(
        () => classBookings.filter((b: ClassBooking) => myClassIds.has(b.classScheduleId)),
        [classBookings, myClassIds],
    );

    // ── KPI calculations ───────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const currClasses = myClasses.filter((c: ClassSchedule) => isoInRange(c.dateISO, currentRange));
        const prevClasses = myClasses.filter((c: ClassSchedule) => isoInRange(c.dateISO, prevRange));

        const currClassIdSet = new Set(currClasses.map((c: ClassSchedule) => c.id));
        const prevClassIdSet = new Set(prevClasses.map((c: ClassSchedule) => c.id));

        const currBookings = myBookings.filter((b: ClassBooking) => currClassIdSet.has(b.classScheduleId));
        const prevBookings = myBookings.filter((b: ClassBooking) => prevClassIdSet.has(b.classScheduleId));

        const currPresent  = currBookings.filter((b: ClassBooking) => b.attendanceStatus === "present").length;
        const prevPresent  = prevBookings.filter((b: ClassBooking) => b.attendanceStatus === "present").length;
        const currHonored  = currBookings.filter((b: ClassBooking) => b.attendanceStatus === "present" || b.attendanceStatus === "no_show").length;
        const prevHonored  = prevBookings.filter((b: ClassBooking) => b.attendanceStatus === "present" || b.attendanceStatus === "no_show").length;

        const currAttendanceRate = safePercent(currPresent, currHonored);
        const prevAttendanceRate = safePercent(prevPresent, prevHonored);

        const currClients = new Set(currBookings.map((b: ClassBooking) => b.customerId)).size;
        const prevClients = new Set(prevBookings.map((b: ClassBooking) => b.customerId)).size;

        const currCancellations = currBookings.filter((b: ClassBooking) => b.status === "cancelled").length;
        const prevCancellations = prevBookings.filter((b: ClassBooking) => b.status === "cancelled").length;

        return {
            classes:        { value: currClasses.length, delta: deltaPercent(currClasses.length, prevClasses.length) },
            attendanceRate: { value: currAttendanceRate, delta: deltaPercent(currAttendanceRate, prevAttendanceRate) },
            clients:        { value: currClients,        delta: deltaPercent(currClients, prevClients) },
            cancellations:  { value: currCancellations,  delta: deltaPercent(currCancellations, prevCancellations) },
            currCancelledBookings: currBookings.filter((b: ClassBooking) => b.status === "cancelled"),
        };
    }, [myClasses, myBookings, currentRange, prevRange]);

    // ── Chart series — walk each day in the period and roll up the
    //    instructor's classes + bookings into the three chart shapes.
    //    `periodDays` is capped at 90 so very long ranges stay
    //    legible; longer ranges would visually overlap on the x-axis.
    const dailySeries = useMemo(() => {
        const bucketCount = Math.min(periodDays, 90);
        const totalMs     = currentRange.to.getTime() - currentRange.from.getTime();
        const stepMs      = totalMs / bucketCount;
        const retention: { label: string; value: number }[] = [];
        const bookings:  { label: string; value: number }[] = [];
        const attendance: { label: string; visits: number; cancellations: number; noShow: number }[] = [];

        for (let i = 0; i < bucketCount; i++) {
            const bucketStart = new Date(currentRange.from.getTime() + i * stepMs);
            const bucketEnd   = new Date(currentRange.from.getTime() + (i + 1) * stepMs - 1);
            const bucketRange = { from: bucketStart, to: bucketEnd };
            const label       = fmtShortDate(bucketStart);

            const classIdsForBucket = new Set(
                myClasses
                    .filter((c: ClassSchedule) => isoInRange(c.dateISO, bucketRange))
                    .map((c: ClassSchedule) => c.id),
            );
            const bucketBookings = myBookings.filter((b: ClassBooking) => classIdsForBucket.has(b.classScheduleId));
            const present  = bucketBookings.filter((b: ClassBooking) => b.attendanceStatus === "present").length;
            const noShow   = bucketBookings.filter((b: ClassBooking) => b.attendanceStatus === "no_show").length;
            const cancels  = bucketBookings.filter((b: ClassBooking) => b.status === "cancelled").length;
            const honored  = present + noShow;
            const booked   = bucketBookings.filter((b: ClassBooking) => b.status === "booked").length;

            retention.push({ label, value: safePercent(present, honored) });
            bookings.push({ label, value: booked });
            attendance.push({ label, visits: present, cancellations: cancels, noShow });
        }
        return { retention, bookings, attendance };
    }, [periodDays, currentRange, myClasses, myBookings]);

    const retentionSeries  = dailySeries.retention;
    const bookingsSeries   = dailySeries.bookings;
    const attendanceSeries = dailySeries.attendance;

    // ── Shared chart axis styling — mirrors the admin
    //    DashboardWidgetCard's `axisProps`/`interval` pattern so the
    //    instructor surface stays visually consistent with admin. The
    //    `tickMargin` gives the date labels breathing room from the
    //    plot baseline (matches `dy: 6` admin uses on the tick fill).
    const axisProps = {
        axisLine: false as const,
        tickLine: false as const,
        stroke:    "#98a2b3" as const,
        tick:      { fill: "#667085", fontSize: 11 } as const,
        tickMargin: 8,
    };
    /** Recharts `interval` for the x-axis. With a long series (e.g.
     *  30 days) Recharts otherwise tries to render every label and
     *  they squish into each other. We target ~7-8 labels regardless
     *  of bucket count: skip `ceil(n / 7) - 1` labels between shown
     *  ones. Returns 0 for short series so all labels render. */
    function xAxisInterval(n: number): number {
        return Math.max(0, Math.ceil(n / 7) - 1);
    }
    const xInterval = xAxisInterval(retentionSeries.length);

    // ── Upcoming classes for "today" ───────────────────────────────────────
    //
    // Compact time-grouped layout per Figma 7368-36130: real classes only
    // (no empty hour rows, no lunch break placeholder), grouped by their
    // own start hour. Each group renders the hour label on the left + a
    // stack of `ScheduleClassCard md` cards on the right — same component
    // the schedule module uses, so the visual style stays consistent.
    const upcomingByHour = useMemo(() => {
        const todayStr = today.toLocaleDateString("en-CA"); // YYYY-MM-DD
        const todayClasses = myClasses
            .filter(c => c.dateISO.startsWith(todayStr))
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
        const buckets = new Map<number, ClassSchedule[]>();
        for (const c of todayClasses) {
            const h = parseInt(c.startTime.split(":")[0] ?? "0", 10);
            const list = buckets.get(h) ?? [];
            list.push(c);
            buckets.set(h, list);
        }
        return Array.from(buckets.entries())
            .sort(([a], [b]) => a - b)
            .map(([hour, classes]) => ({ hour, timeLabel: hourLabel(hour), classes }));
    }, [myClasses, today]);

    const upcomingDateLabel = today.toLocaleDateString("en-US", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
    });

    const hasAnyClassesToday = upcomingByHour.length > 0;

    return (
        <div className="flex flex-col gap-6">
            {/* ── Welcome header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4">
                <h1 className="text-[24px] font-semibold text-[#101828] leading-8 truncate">
                    Welcome back, {currentUser.first_name}!
                </h1>
                <DateRangeFilter value={period} onChange={setPeriod} />
            </div>

            {/* ── Overall performance ───────────────────────────────────── */}
            <SectionCard>
                <SectionHeader title="Overall performance" />

                {/* 4 KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    <InstructorMetricCard
                        icon={CalendarCheck01}
                        label="Classes"
                        value={kpis.classes.value}
                        deltaPercent={kpis.classes.delta}
                        deltaSuffix={deltaSuffix}
                    />
                    <InstructorMetricCard
                        icon={CheckCircle}
                        label="Attendance rate"
                        value={`${kpis.attendanceRate.value}%`}
                        deltaPercent={kpis.attendanceRate.delta}
                        deltaSuffix={deltaSuffix}
                    />
                    <InstructorMetricCard
                        icon={Users01}
                        label="Clients taught"
                        value={kpis.clients.value}
                        deltaPercent={kpis.clients.delta}
                        deltaSuffix={deltaSuffix}
                    />
                    <InstructorMetricCard
                        icon={SlashCircle01}
                        label="Cancellations"
                        value={kpis.cancellations.value}
                        deltaPercent={kpis.cancellations.delta}
                        deltaSuffix={deltaSuffix}
                        onClick={() => setCancelOpen(true)}
                    />
                </div>

                {/* Retention rate line chart */}
                <div className="mt-6 h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={retentionSeries} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="label" {...axisProps} interval={xInterval} />
                            <YAxis
                                {...axisProps}
                                width={48}
                                tickFormatter={(v: number) => `${v}%`}
                                domain={[0, 100]}
                                ticks={[0, 25, 50, 75, 100]}
                            />
                            <RechartsTooltip
                                content={(props) => (
                                    <ChartTooltip
                                        active={props.active}
                                        payload={props.payload as readonly ChartTooltipPayload[] | undefined}
                                        label={props.label as string | number | undefined}
                                        formatter={(p) => ({
                                            name: "Retention rate",
                                            value: `${p.value ?? 0}%`,
                                            color: "#7ba08c",
                                        })}
                                    />
                                )}
                            />
                            <Line
                                type="monotone"
                                dataKey="value"
                                name="Retention rate"
                                stroke="#7ba08c"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </SectionCard>

            {/* ── Upcoming classes — Figma 7368-36130. Fixed-height card
                (matches the admin dashboard's Today's classes pattern), inner
                content scrolls when there are more classes than fit, and a
                bottom gradient overlay cues the user that more rows live
                below the fold. Lunch-break placeholder removed; every row
                is now a real class card. ─────────────────────────────── */}
            <SectionCard className="relative overflow-hidden flex flex-col gap-4">
                <SectionHeader
                    title="Upcoming classes"
                    right={
                        <span className="inline-flex items-center gap-2 h-9 px-3 bg-[#fbfffd] border-1 border-[#e4e7ec] rounded-[8px] text-sm font-medium text-[#344054]">
                            <Calendar className="w-4 h-4 text-[#667085]" />
                            {upcomingDateLabel}
                        </span>
                    }
                />

                {hasAnyClassesToday ? (
                    <>
                        {/* `max-h-[420px]` caps the scroll area so a packed
                            day (~10+ classes) becomes scrollable, while a
                            light day (3 classes) lets the card hug its
                            content — no more half-empty white box. */}
                        <div className="max-h-[420px] w-full overflow-y-auto scrollbar-hide">
                            <div className="flex flex-col">
                                {upcomingByHour.map((slot, idx) => {
                                    const isLast = idx === upcomingByHour.length - 1;
                                    const multi  = slot.classes.length > 1;
                                    return (
                                        <div
                                            key={slot.hour}
                                            className={cn(
                                                "flex items-stretch w-full flex-shrink-0",
                                                !isLast && "border-b border-[#e4e7ec]",
                                            )}
                                        >
                                            {/* Time column — right-aligned hour
                                                label matches the admin pattern */}
                                            <div className="w-[70px] flex items-center justify-end px-4 py-3 flex-shrink-0">
                                                <p className="font-medium text-sm text-[#667085] whitespace-nowrap">
                                                    {slot.timeLabel}
                                                </p>
                                            </div>
                                            {/* Class cards — uses the shared
                                                ScheduleClassCard so chrome,
                                                tints, and avatar match the
                                                schedule module exactly. */}
                                            <div className={cn(
                                                "flex flex-1 min-w-0 py-3",
                                                multi ? "flex-col gap-3" : "items-center",
                                            )}>
                                                {slot.classes.map(c => (
                                                    <ScheduleClassCard key={c.id}
                                                        size="md"
                                                        onClick={() => router.push(`/schedule/${c.id}`)}
                                                        cls={{
                                                            name: c.name,
                                                            color: getCategoryColor(c.category),
                                                            startTime: c.startTime,
                                                            endTime: c.endTime,
                                                            displayTime: c.displayTime,
                                                            instructorName: c.instructorName,
                                                            instructorInitials: c.instructorInitials,
                                                            instructorColor: c.instructorColor,
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
                        </div>

                        {/* Fade gradient at the bottom of the scrollable
                            area — soft visual hint that there's more
                            content below the fold. Pointer-events-none so
                            it doesn't intercept clicks on the bottom card. */}
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none rounded-b-[20px]" />
                    </>
                ) : (
                    <div className="relative h-[280px]">
                        <EmptyState
                            title="No classes scheduled for today"
                            subtitle="When the admin adds a class with you assigned as the instructor, it will appear here."
                            icon={CalendarCheck01}
                        />
                    </div>
                )}
            </SectionCard>

            {/* ── Bottom row: Class bookings + Attendance overview ─────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard>
                    <SectionHeader
                        title="Class bookings"
                        description="Total bookings over time"
                    />
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={bookingsSeries} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                                <CartesianGrid vertical={false} stroke="#f2f4f7" />
                                <XAxis dataKey="label" {...axisProps} interval={xInterval} />
                                <YAxis {...axisProps} width={40} allowDecimals={false} />
                                <RechartsTooltip
                                    content={(props) => (
                                        <ChartTooltip
                                            active={props.active}
                                            payload={props.payload as readonly ChartTooltipPayload[] | undefined}
                                            label={props.label as string | number | undefined}
                                            formatter={(p) => ({
                                                name: "Total booking",
                                                value: String(p.value ?? 0),
                                                color: "#7ba08c",
                                            })}
                                        />
                                    )}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    name="Bookings"
                                    stroke="#7ba08c"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </SectionCard>

                <SectionCard>
                    <SectionHeader
                        title="Attendance overview"
                        description="Track attendance rate, cancellations, and no-shows across all classes."
                    />
                    {/* Legend */}
                    <div className="flex items-center gap-4 mb-2 text-xs font-normal text-[#475467]">
                        <LegendDot color="#7ba08c" label="Total visits" />
                        <LegendDot color="#f97066" label="Total cancellations" />
                        <LegendDot color="#aad4bd" label="Total no show" />
                    </div>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={attendanceSeries} barCategoryGap="30%" margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                                <CartesianGrid vertical={false} stroke="#f2f4f7" />
                                <XAxis dataKey="label" {...axisProps} interval={xInterval} />
                                <YAxis {...axisProps} width={40} allowDecimals={false} />
                                <RechartsTooltip
                                    cursor={{ fill: "#f9fafb" }}
                                    content={(props) => (
                                        <ChartTooltip
                                            active={props.active}
                                            payload={props.payload as readonly ChartTooltipPayload[] | undefined}
                                            label={props.label as string | number | undefined}
                                            formatter={(p) => ({
                                                name: String(p.name ?? ""),
                                                value: String(p.value ?? 0),
                                                color: p.color ?? "#7ba08c",
                                            })}
                                        />
                                    )}
                                />
                                <Bar dataKey="visits"        name="Visits"        fill="#7ba08c" radius={[3, 3, 0, 0]} maxBarSize={10} />
                                <Bar dataKey="cancellations" name="Cancellations" fill="#f97066" radius={[3, 3, 0, 0]} maxBarSize={10} />
                                <Bar dataKey="noShow"        name="No show"       fill="#aad4bd" radius={[3, 3, 0, 0]} maxBarSize={10} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </SectionCard>
            </div>

            {/* ── Cancellations modal ───────────────────────────────────── */}
            <CancellationsModal
                open={cancelOpen}
                onClose={() => setCancelOpen(false)}
                cancelledBookings={kpis.currCancelledBookings}
            />
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Small helpers used only by this page
// ────────────────────────────────────────────────────────────────────────────
function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            {label}
        </span>
    );
}

function hourLabel(h: number): string {
    if (h === 0) return "12 AM";
    if (h < 12) return `${h} AM`;
    if (h === 12) return "12 PM";
    return `${h - 12} PM`;
}

// Silence the unused-import warning when only some `ClassBooking` usages
// trigger the type — referenced through `kpis.currCancelledBookings`.
export type { ClassBooking };
