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
    ClockFastForward,
} from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { downloadCsv, todayISO as csvTodayISO } from "@/lib/csv-export";
import { getWidgetCsvSection } from "@/components/dashboard/DashboardWidgetCard";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useAppStore, SCHEDULE_INSTRUCTORS, appointmentToClassInstance, isAppointmentId, type SessionType } from "@/lib/store";
import { ScheduleClassCard } from "@/components/schedule/ScheduleClassCard";
import { SESSION_TYPE_ORDER, SESSION_TYPE_TAG_COLORS, SESSION_TYPE_TAG_LABEL } from "@/lib/session-type";
import { SelectInput } from "@/components/ui/select-input"; // used for location + instructor
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { dateFilterToRange } from "@/lib/period-filter";
import { AddWidgetModal } from "@/components/dashboard/AddWidgetModal";
import { TypeLocationFilter } from "@/components/dashboard/TypeLocationFilter";
import {
    RenewalDueModal,
    FailedPaymentsModal,
    AtRiskClientsModal,
    UnderFilledModal,
    RefundRequestsModal,
    WaitlistConfirmModal,
    NewSignupsModal,
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
    /** Session type — drives the coloured type tag on the card. */
    type: SessionType;
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
    Barre: { bg: "#e9fbff", border: "#4b8c9a", text: "#1b4c56" },
    Yoga: { bg: "#fff8e9", border: "#dc6803", text: "#7a2e0e" },
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
    branchIds,
    onRemoveWidget,
    onReorderWidgets,
    onOpenModal,
    onOpenFailedPayments,
    allWidgetsActive,
}: {
    activeWidgets: string[];
    period: DateFilter;
    /** Branch scope — threaded through so widgets like Payments collected can
     *  filter their failed-payments chip to the active branches. `null` /
     *  empty / all-selected all mean "All locations" (aggregate across every
     *  branch). Multi-branch selection is real. */
    branchIds: string[] | null;
    onRemoveWidget: (id: string) => void;
    /** Swap widgets at `fromIndex` and `toIndex` in the active list.
     *  Called by the native HTML5 drag-and-drop handlers below — no
     *  external dnd library required. */
    onReorderWidgets: (fromIndex: number, toIndex: number) => void;
    onOpenModal: () => void;
    /** Click handler for the payments-collected widget's failed chip —
     *  opens the shared FailedPaymentsModal so the chip and modal always
     *  read the same numbers. */
    onOpenFailedPayments: () => void;
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

    // Dynamic Add-widget placement (client Jul 2026):
    //   • Odd widget count → placeholder BESIDE the lone widget on the last
    //     row (inside the widget grid). `self-start` keeps it at fit height
    //     while its 1fr row cell absorbs the leftover space — invisibly, since
    //     the neighbouring widget already occupies the full row height.
    //   • Even widget count (incl. zero) → placeholder on its OWN row BELOW
    //     the widget grid, in a separate `grid-cols-2` container that has
    //     NO `1fr` row rule. Zero visible gap beneath the tile.
    const placeholderInGrid   = !allWidgetsActive && activeWidgets.length % 2 === 1;
    const placeholderStandalone = !allWidgetsActive && activeWidgets.length % 2 === 0;
    return (
        <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-6 [grid-auto-rows:1fr]">
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
                        // `h-full` propagates the row's stretched height so
                        // the card underneath fills the tallest sibling's
                        // height (no bottom gap).
                        "transition-all h-full",
                        dragIndex === idx && "opacity-40",
                        hoverIndex === idx && dragIndex !== null && dragIndex !== idx &&
                        "ring-2 ring-[#4b8c9a] ring-offset-2 rounded-[20px]",
                    )}
                >
                    <DashboardWidgetCard
                        widgetId={id}
                        period={period}
                        branchIds={branchIds ?? undefined}
                        action="kebab"
                        dragHandle
                        className="h-full"
                        onOpenFailedPayments={onOpenFailedPayments}
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

            {/* Placeholder INSIDE the widget grid — only rendered on odd
                widget counts, so it fills the empty slot beside the last
                widget on the last row. `self-start` keeps it at fit-content
                height; its 1fr cell absorbs the leftover row height invisibly
                (the neighbouring widget already dictates the row height, so
                no visible gap below the tile). */}
            {placeholderInGrid && (
                <button
                    type="button"
                    onClick={onOpenModal}
                    className="self-start border-1 border-dashed border-[#d0d5dd] rounded-[20px] p-6 flex flex-col items-center justify-center gap-3 min-h-[180px] hover:border-[#4b8c9a] hover:bg-[#fafeff] transition-colors group"
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

        {/* Placeholder in its OWN grid — only rendered on even widget counts
            (incl. zero), so it starts a fresh row below the widget grid
            without inheriting that grid's `[grid-auto-rows:1fr]` row-stretch.
            The wrapper is a `grid grid-cols-2` so the tile keeps its 1-column
            width (same slot size as a widget card), and the row is auto
            height so nothing pads out below the button. */}
        {placeholderStandalone && (
            <div className="grid grid-cols-2 gap-6">
                <button
                    type="button"
                    onClick={onOpenModal}
                    className="border-1 border-dashed border-[#d0d5dd] rounded-[20px] p-6 flex flex-col items-center justify-center gap-3 min-h-[180px] hover:border-[#4b8c9a] hover:bg-[#fafeff] transition-colors group"
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

// ─── Occupancy card — the one metric that can't collapse into a single number ─
//
// Class fill, private-slot utilisation and recovery capacity have different
// denominators, so averaging them would mislead. On "All" the tile shows a
// three-way split (mini bars per type); a selected type shows that type's
// single %. Matches the MetricCard chrome so it sits cleanly in the strip.
function OccupancyCard({ byType, selected, typeFilter }: {
    byType: Record<SessionType, { pct: number; count: number }>;
    selected: number;
    typeFilter: SessionType | "";
}) {
    return (
        <div className="bg-white border border-[#e4e7ec] flex flex-1 flex-col justify-center gap-1.5 min-w-0 p-4 rounded-2xl min-w-[220px]">
            <p className="font-normal text-sm text-[#667085] whitespace-nowrap">
                {typeFilter ? `Occupancy · ${SESSION_TYPE_TAG_LABEL[typeFilter]}` : "Occupancy"}
            </p>
            {typeFilter ? (
                <>
                    <p className="font-semibold text-xl text-[#101828] leading-[28px]">{selected}%</p>
                    <p className="font-normal text-xs text-[#667085]">avg fill</p>
                </>
            ) : (
                <div className="flex flex-col gap-1 w-full">
                    {SESSION_TYPE_ORDER.map(t => {
                        const { pct } = byType[t];
                        const c = SESSION_TYPE_TAG_COLORS[t];
                        return (
                            <div key={t} className="flex items-center gap-2">
                                <span className="text-[11px] text-[#667085] w-[56px] shrink-0">{SESSION_TYPE_TAG_LABEL[t]}</span>
                                <div className="flex-1 h-1.5 bg-[#f2f4f7] rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: c.bar }} />
                                </div>
                                <span className="text-[11px] font-medium text-[#344054] w-[32px] text-right shrink-0">{pct}%</span>
                            </div>
                        );
                    })}
                </div>
            )}
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

/** Delta caption for the Performance-tab metric cards — flips "vs …" to
 *  match the active period picker so a "This month" card reads "vs last
 *  month", not "vs yesterday". Mirrors the instructor dashboard helper
 *  (kept module-local so `page.tsx` stays self-contained). */
function dashDeltaSuffix(filter: DateFilter): string {
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

// ── Main Dashboard ──
export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"today" | "coming" | "performance">("today");
    // Coming-up tab range — 7 or 30 days (Figma 7823:53746 segmented pill).
    const [comingRange, setComingRange] = useState<7 | 30>(7);
    // Coming-up tab session-type filter (client Jul 2026). "" = All. Gates
    // which metric cards render (each type has its own card set per the
    // client brief — see `comingMetrics` below).
    const [comingType, setComingType] = useState<SessionType | "">("");
    // "" = "All locations" — dashboard opens on the aggregate view so
    // KPIs read like the full studio on first paint.
    const [locations, setLocations] = useState<string[]>([]);
    // Session-type filter (Today tab) — "" = All. Re-scopes the session-based
    // tiles (occupancy, bookings, sessions count) + the Today's-sessions list.
    const [typeFilter, setTypeFilter] = useState<SessionType | "">("");
    const [period, setPeriod] = useState<DateFilter>({ type: "week", label: "This week" });
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);
    // Needs-attention drill-down modals (Figma 7785:66057 / 227786 /
    // 245665 / 246710). Renewal + Expire cards share the Renewal-due
    // modal per client Jul 2026.
    // `failedComing` retired Jul 2026 — the Coming-up "Failed payments" card
    // was dropped from the per-type card matrix. The widget-triggered
    // FailedPaymentsModal (`failedWidget`) still lives on the Performance
    // tab's Payments-collected chip.
    type NeedsAttentionModal = "renewal" | "failed" | "failedWidget" | "atrisk" | "underfilled" | "refund" | "waitlist" | "signups" | null;
    const [attentionModal, setAttentionModal] = useState<NeedsAttentionModal>(null);
    const [activeWidgets, setActiveWidgets] = useState<string[]>(DEFAULT_ACTIVE_WIDGETS);
    const today = new Date();

    const classSchedules = useAppStore(s => s.classSchedules);
    const appointments = useAppStore(s => s.appointments);
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
    // Extra slices used by the Coming-up per-type card set (client Jul 2026):
    //   • appointmentBookings — occupancy count for private + recovery
    //   • packages — is_intro_offer flag for the Trials-ending card
    const appointmentBookings = useAppStore(s => s.appointmentBookings);
    const packages            = useAppStore(s => s.packages);

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
    // Real multi-branch scope: pass the picked location array straight to
    // every downstream widget/modal. Convention: null (or an empty array)
    // means "no filter — every branch"; a non-empty array narrows to only
    // those branches. All 7 needs-attention modals + DashboardWidgetCard
    // now consume this shape (2026-07-20 refactor).
    const branchScopeIds = locations.length === 0 ? null : locations;
    const todayISO = format(today, "yyyy-MM-dd");

    // Branch-scoped slices. `branchScopeIds` is either null (no filter — every
    // branch) or a non-empty array of branch ids to include. The Set here is
    // built once per memo so per-row `.includes` is O(1) instead of O(N)
    // even when many branches are picked.
    const scopedSchedules = useMemo(() => {
        if (!branchScopeIds) return classSchedules;
        const allowed = new Set(branchScopeIds);
        return classSchedules.filter(s => allowed.has(s.branchId));
    }, [classSchedules, branchScopeIds]);
    // Merged session feed — class schedules + appointments (private + recovery)
    // projected into the same ClassInstance shape so the Today tab's session
    // metrics + list see all three types. Appointments join the grid once they
    // have a booking (or were cancelled), mirroring /admin/schedule. Branch-
    // scoped like classSchedules. Every projected instance carries `.type`.
    const scopedSessions = useMemo(() => {
        const apptInstances = appointments
            .filter(a => a.booked > 0 || a.status === "Cancelled")
            .map(appointmentToClassInstance);
        const merged = [...classSchedules, ...apptInstances];
        if (!branchScopeIds) return merged;
        const allowed = new Set(branchScopeIds);
        return merged.filter(s => allowed.has(s.branchId));
    }, [classSchedules, appointments, branchScopeIds]);
    const scopedBookings = useMemo(() => {
        if (!branchScopeIds) return classBookings;
        const allowed = new Set(branchScopeIds);
        return classBookings.filter(b => allowed.has(b.branchId));
    }, [classBookings, branchScopeIds]);
    const scopedCustomers = useMemo(() => {
        if (!branchScopeIds) return customers;
        const allowed = new Set(branchScopeIds);
        return customers.filter(c => allowed.has(c.branchId));
    }, [customers, branchScopeIds]);
    const scopedTransactions = useMemo(() => {
        if (!branchScopeIds) return customerTransactions;
        const allowed = new Set(branchScopeIds);
        return customerTransactions.filter(t => allowed.has(t.branchId));
    }, [customerTransactions, branchScopeIds]);
    // customer_plans has no branch column — filter via the plan's customer's
    // branch. `scopedCustomers` is already restricted so the id-set derived
    // from it naturally reflects the multi-branch pick.
    const scopedCustomerPlans = useMemo(() => {
        if (!branchScopeIds) return customerPlans;
        const inScope = new Set(scopedCustomers.map(c => c.id));
        return customerPlans.filter(p => inScope.has(p.customerId));
    }, [customerPlans, scopedCustomers, branchScopeIds]);
    // Coming-up occupancy cards (private + recovery) read from these.
    const scopedAppointments = useMemo(() => {
        if (!branchScopeIds) return appointments;
        const allowed = new Set(branchScopeIds);
        return appointments.filter(a => allowed.has(a.branchId));
    }, [appointments, branchScopeIds]);

    // KPI aggregates — client dashboard update Jul 2026 (Figma 7798:80364
    // for Today, 7799:109180 for Performance). Each tab surfaces its own
    // metric strip:
    //   • Today at a glance  (5 cards): Total sales / Total revenue /
    //                        New customers / Bookings today / Avg occupancy
    //   • Performance        (4 cards): Today's revenue / Active members /
    //                        Classes today / Bookings today
    // Every value reads live from the scoped slices so branch pick + all-
    // locations aggregate stay in sync.
    // Session-based Today-tab metrics — computed off the MERGED session feed
    // (classes + appointments) so occupancy + bookings + count cover all three
    // types. Occupancy can't be averaged across types (different denominators),
    // so we keep a per-type breakdown: "All" renders a 3-way split, a selected
    // type renders that type's single %.
    const sessionMetrics = useMemo(() => {
        const sessionsToday = scopedSessions.filter(s => s.dateISO === todayISO);
        const occFor = (list: typeof sessionsToday) => {
            const capped = list.filter(s => s.capacity > 0);
            return capped.length === 0 ? 0
                : Math.round(capped.reduce((sum, s) => sum + (s.booked / s.capacity) * 100, 0) / capped.length);
        };
        const occupancyByType: Record<SessionType, { pct: number; count: number }> = {
            class:    { pct: occFor(sessionsToday.filter(s => s.type === "class")),    count: sessionsToday.filter(s => s.type === "class").length },
            private:  { pct: occFor(sessionsToday.filter(s => s.type === "private")),  count: sessionsToday.filter(s => s.type === "private").length },
            recovery: { pct: occFor(sessionsToday.filter(s => s.type === "recovery")), count: sessionsToday.filter(s => s.type === "recovery").length },
        };
        // Type-scoped subset for the additive session tiles + the single-type
        // occupancy value.
        const scoped = typeFilter ? sessionsToday.filter(s => s.type === typeFilter) : sessionsToday;
        return {
            occupancyByType,
            occupancySelected: occFor(scoped),
            bookingsToday: scoped.reduce((sum, s) => sum + s.booked, 0),
            sessionsCount: scoped.length,
        };
    }, [scopedSessions, typeFilter, todayISO]);

    const { todayMetrics } = useMemo(() => {
        // Today's completed sale transactions — used by both Total sales
        // (count) and Total revenue (sum of amounts). Filter out refund /
        // void / write-off rows so the two totals stay honest.
        const todaySales = scopedTransactions.filter(t =>
            t.status === "complete"
            && t.createdAtISO.startsWith(todayISO)
            && (t.transactionType === undefined || t.transactionType === "sale")
            && t.kind !== "cancellation_penalty"
            && t.kind !== "freeze_fee"
        );
        const totalSalesCount = todaySales.length;
        const totalRevenueAed = todaySales.reduce((sum, t) => sum + t.amountAed, 0);

        // New customers today — count of customer.createdAt on today's date.
        const newCustomers = scopedCustomers.filter(c =>
            (c.createdAt ?? "").startsWith(todayISO),
        ).length;

        // `activeMembers`, `classesTodayCount`, `bookingsToday` used to be
        // computed here for the Performance strip; that strip moved to its
        // own period-scoped useMemo below (client Jul 2026), so those
        // vars — along with the intermediate `todaySchedules` /
        // `todayScheduleIdSet` — are gone.

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
            // Bookings — type-aware (from the merged session feed), so
            // picking a type filter recomputes it. Occupancy is rendered as a
            // dedicated OccupancyCard (3-way split on All) below the strip.
            // Label drops the "today" prefix (client Jul 2026 audit —
            // metric titles don't carry the tab's time scope, which the tab
            // context already provides).
            {
                label: "Bookings",
                value: sessionMetrics.bookingsToday.toLocaleString("en-US"),
                change: 1, positive: false, comparison: "vs yesterday",
                icon: TrendUp01,
            },
        ];

        return { todayMetrics: today };
    }, [scopedTransactions, scopedCustomers, scopedSchedules, scopedBookings, todayISO, sessionMetrics]);

    // ── Performance-tab metrics — 4 cards, PERIOD-scoped ──
    //
    // Client Jul 2026 — the tab is picker-scoped (This week / This month /
    // etc.) but the old cards hardcoded "today" values + "vs yesterday" delta
    // captions. Now values compute against the selected DateRangeFilter
    // period and the delta captions read "vs last week" / "vs last month"
    // via `dashDeltaSuffix`. Prior-period actuals drive the delta chip.
    const performanceMetrics: DashboardMetric[] = useMemo(() => {
        const { from, to } = dateFilterToRange(period);
        const fromMs = from.getTime();
        const toMs   = to.getTime();
        const spanMs = toMs - fromMs;
        // Previous same-length window ends the instant before `from`.
        const prevToMs   = fromMs - 1;
        const prevFromMs = fromMs - (spanMs + 1);

        const isoDay = (d: Date): string => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
        };
        const fromISO = isoDay(from);
        const toISO   = isoDay(to);
        const prevFromISO = isoDay(new Date(prevFromMs));
        const prevToISO   = isoDay(new Date(prevToMs));
        const inRangeDay = (iso: string): boolean => {
            const d = iso.slice(0, 10);
            return d >= fromISO && d <= toISO;
        };
        const inPrevRangeDay = (iso: string): boolean => {
            const d = iso.slice(0, 10);
            return d >= prevFromISO && d <= prevToISO;
        };
        const inRangeMs = (iso: string): boolean => {
            const t = new Date(iso).getTime();
            return !Number.isNaN(t) && t >= fromMs && t <= toMs;
        };
        const inPrevRangeMs = (iso: string): boolean => {
            const t = new Date(iso).getTime();
            return !Number.isNaN(t) && t >= prevFromMs && t <= prevToMs;
        };

        // Revenue (period AED) — complete `sale` transactions, exclude
        // penalty / freeze-fee rows so the total matches the Payments tab.
        const isBillableSale = (t: typeof scopedTransactions[number]): boolean =>
            t.status === "complete"
            && (t.transactionType === undefined || t.transactionType === "sale")
            && t.kind !== "cancellation_penalty"
            && t.kind !== "freeze_fee";
        const revenuePeriod = scopedTransactions
            .filter(t => isBillableSale(t) && inRangeMs(t.createdAtISO))
            .reduce((sum, t) => sum + t.amountAed, 0);
        const revenuePrior = scopedTransactions
            .filter(t => isBillableSale(t) && inPrevRangeMs(t.createdAtISO))
            .reduce((sum, t) => sum + t.amountAed, 0);

        // Members — active members that JOINED in the period (a period-
        // scoped acquisition metric, comparable across weeks/months). Prior
        // window = joined in the previous same-length window.
        const membersPeriod = scopedCustomers.filter(c =>
            c.status === "active" && inRangeMs(c.createdAt ?? ""),
        ).length;
        const membersPrior = scopedCustomers.filter(c =>
            c.status === "active" && inPrevRangeMs(c.createdAt ?? ""),
        ).length;

        // Classes — schedules whose date falls in the period (date-only
        // fields, so use the day-string helper for TZ safety).
        const classesPeriod = scopedSchedules.filter(s => inRangeDay(s.dateISO)).length;
        const classesPrior  = scopedSchedules.filter(s => inRangeDay(s.dateISO) === false && inPrevRangeDay(s.dateISO)).length;

        // Bookings — booked rows on schedules whose date lands in the period.
        const scheduleIdsInRange = new Set(
            scopedSchedules.filter(s => inRangeDay(s.dateISO)).map(s => s.id),
        );
        const scheduleIdsInPrev = new Set(
            scopedSchedules.filter(s => inPrevRangeDay(s.dateISO)).map(s => s.id),
        );
        const bookingsPeriod = scopedBookings.filter(b =>
            b.status === "booked" && scheduleIdsInRange.has(b.classScheduleId),
        ).length;
        const bookingsPrior = scopedBookings.filter(b =>
            b.status === "booked" && scheduleIdsInPrev.has(b.classScheduleId),
        ).length;

        // Delta helper — real % change vs the prior same-length window.
        const pct = (current: number, prior: number): { change: number; positive: boolean } => {
            if (prior === 0) return { change: current === 0 ? 0 : 100, positive: current >= 0 };
            const d = ((current - prior) / prior) * 100;
            return { change: Math.abs(Math.round(d)), positive: d >= 0 };
        };
        const suffix = dashDeltaSuffix(period);

        const revD = pct(revenuePeriod, revenuePrior);
        const memD = pct(membersPeriod, membersPrior);
        const clsD = pct(classesPeriod, classesPrior);
        const bkgD = pct(bookingsPeriod, bookingsPrior);

        return [
            {
                label: "Revenue",
                value: `AED ${revenuePeriod.toLocaleString("en-US")}`,
                change: revD.change, positive: revD.positive, comparison: suffix,
                icon: CurrencyDollar,
            },
            {
                label: "Customers",
                value: membersPeriod.toLocaleString("en-US"),
                change: memD.change, positive: memD.positive, comparison: suffix,
                icon: UserCheck01,
            },
            {
                label: "Classes",
                value: classesPeriod.toLocaleString("en-US"),
                change: clsD.change, positive: clsD.positive, comparison: suffix,
                icon: CalendarCheck01,
            },
            {
                label: "Bookings",
                value: bookingsPeriod.toLocaleString("en-US"),
                change: bkgD.change, positive: bkgD.positive, comparison: suffix,
                icon: TrendUp01,
            },
        ];
    }, [period, scopedTransactions, scopedCustomers, scopedSchedules, scopedBookings]);

    // ── Coming-up metrics — 6 KPI cards per Figma 7823:53746 ──
    //
    // Each card looks N days ahead where N ∈ {7, 30} (segmented pill next to
    // the location dropdown). Numbers are derived from the same slices the
    // Needs-attention section reads today — just widened to a rolling range.
    const comingMetrics: DashboardMetric[] = useMemo(() => {
        const now = Date.now();
        const DAY = 24 * 60 * 60 * 1000;
        // Timezone-safe range check (client Jul 2026 audit fix). Before this,
        // `inRange` did `new Date(iso).getTime() >= Date.now()`, which parses
        // date-only strings ("YYYY-MM-DD") as UTC midnight — so any row dated
        // today would fall below `now` once the local wall clock ticked past
        // 00:00 UTC (i.e. all day long, everywhere outside UTC), silently
        // dropping today's rows from EVERY Coming-up card. Meanwhile
        // `UnderFilledModal` used string-prefix comparison and correctly
        // included today, so the card count could disagree with the modal.
        // Fix: compare on the yyyy-mm-dd date prefix (both for date-only
        // fields like `expiryISO` / `dateISO` and for timestamp fields like
        // `createdAtISO` — first 10 chars is the date either way).
        const isoDate = (d: Date): string => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
        };
        const todayLocalISO   = isoDate(new Date(now));
        const horizonLocalISO = isoDate(new Date(now + comingRange * DAY));
        const pastStartLocalISO = isoDate(new Date(now - comingRange * DAY));
        // Forward window — future events (bookings, renewals, expiring
        // credits/memberships/trials, occupancy). Includes today.
        const inRange = (iso: string): boolean => {
            if (!iso) return false;
            const day = iso.slice(0, 10);
            return day >= todayLocalISO && day <= horizonLocalISO;
        };
        // Backward window — projection base for Revenue. Same window size as
        // the pill so the Revenue estimate scales with Next 7 / 30.
        const inPastRange = (iso: string): boolean => {
            if (!iso) return false;
            const day = iso.slice(0, 10);
            return day >= pastStartLocalISO && day < todayLocalISO;
        };

        // ── Products ────────────────────────────────────────────────────────
        const introPackageIds = new Set(
            packages.filter(p => p.is_intro_offer === true).map(p => p.id),
        );

        // ── Memberships (kind=membership) ───────────────────────────────────
        const heldMemberships = scopedCustomerPlans.filter(p =>
            p.kind === "membership" && (p.status === "active" || p.status === "frozen"),
        );
        // Recurring revenue — auto-renewals landing in range.
        const upcomingBillingPlans = heldMemberships.filter(p => (p.autoRenew ?? false) && inRange(p.expiryISO ?? ""));
        const recurringRevenueAed = upcomingBillingPlans.reduce(
            (sum, p) => sum + (p.nextBillingAmountAed ?? p.priceAed ?? 0), 0,
        );
        // Expiring memberships — held memberships whose expiry lands in range
        // (whether auto-renew or not). Includes their next-billing AED so the
        // subtitle carries a sense of the recurring value at stake.
        const expiringMembershipPlans = heldMemberships.filter(p => inRange(p.expiryISO ?? ""));
        const expiringMembershipsCount = expiringMembershipPlans.length;
        const expiringMembershipsAed = expiringMembershipPlans.reduce(
            (sum, p) => sum + (p.nextBillingAmountAed ?? p.priceAed ?? 0), 0,
        );

        // ── Credit packages (kind=package) ──────────────────────────────────
        const heldPackages = scopedCustomerPlans.filter(p =>
            p.kind === "package" && (p.status === "active" || p.status === "frozen"),
        );
        // Expiring credits — package plans whose expiry lands in range.
        const expiringCreditsCount = heldPackages.filter(p => inRange(p.expiryISO ?? "")).length;
        // Trials ending — package plans on an intro-flagged package (as defined
        // by the products module's `is_intro_offer` toggle) whose expiry lands
        // in range. Reads from the LIVE packages slice so a studio toggling
        // the intro flag on another SKU changes this card the same render.
        const trialsEndingCount = heldPackages.filter(p =>
            p.productId && introPackageIds.has(p.productId) && inRange(p.expiryISO ?? ""),
        ).length;

        // ── Revenue projection (client Jul 2026 spec) ───────────────────────
        // Total expected revenue = recurring auto-renewals + past-window
        // non-recurring sales (as a proxy for the next window's one-off
        // revenue). The past-window transactions are all `sale`-status
        // customer_transactions, minus any refund reversal, and NOT the
        // auto-renewal renewals themselves (would double-count).
        const pastNonRecurringSalesAed = scopedTransactions.reduce((sum, t) => {
            if (t.status !== "complete") return sum;
            if (t.paymentType === "recurring") return sum;
            if (!inPastRange(t.createdAtISO)) return sum;
            const isSale = (t.transactionType ?? "sale") === "sale";
            return isSale ? sum + Math.abs(t.subtotalAed ?? t.amountAed) : sum;
        }, 0);
        const revenueAed = recurringRevenueAed + pastNonRecurringSalesAed;

        // ── Prior-period actuals (drive the real % change deltas) ───────────
        // For each of the 3 "change chip" cards (Revenue, Recurring, Bookings)
        // we compare the CURRENT metric against the last N days' ACTUAL
        // value so the green +N% / red -N% chip carries real meaning.
        // Client Jul 2026 — was hardcoded to +3% before.
        const pastAllRevenueAed = scopedTransactions.reduce((sum, t) => {
            if (t.status !== "complete") return sum;
            if (!inPastRange(t.createdAtISO)) return sum;
            const isSale = (t.transactionType ?? "sale") === "sale";
            return isSale ? sum + Math.abs(t.subtotalAed ?? t.amountAed) : sum;
        }, 0);
        const pastRecurringRevenueAed = scopedTransactions.reduce((sum, t) => {
            if (t.status !== "complete") return sum;
            if (t.paymentType !== "recurring") return sum;
            if (!inPastRange(t.createdAtISO)) return sum;
            const isSale = (t.transactionType ?? "sale") === "sale";
            return isSale ? sum + Math.abs(t.subtotalAed ?? t.amountAed) : sum;
        }, 0);

        // ── Bookings ────────────────────────────────────────────────────────
        // Class bookings — confirmed future bookings for schedules in range.
        const scheduleIdsInRange = new Set(
            scopedSchedules.filter(s => inRange(`${s.dateISO}T00:00:00Z`)).map(s => s.id),
        );
        const classBookingsCount = scopedBookings.filter(b =>
            b.status === "booked" && scheduleIdsInRange.has(b.classScheduleId),
        ).length;
        // Appointment bookings — split by type for private / recovery slots.
        // Match by `appointmentId` → appointment.type so we only count bookings
        // whose parent appointment lands in the coming window.
        const appointmentsInRange = scopedAppointments.filter(a => inRange(`${a.dateISO}T00:00:00Z`));
        const apptIdsInRange = new Set(appointmentsInRange.map(a => a.id));
        const apptById = new Map(scopedAppointments.map(a => [a.id, a] as const));
        const activeApptBookings = appointmentBookings.filter(b =>
            b.status === "Booked" && apptIdsInRange.has(b.appointmentId),
        );
        const bookingsCountByType = (t: "private" | "recovery"): number =>
            activeApptBookings.filter(b => (apptById.get(b.appointmentId)?.type ?? "") === t).length;
        // Total bookings for the "All" card = classes + private + recovery
        // appointment bookings in the coming window.
        const bookingsAllCount = classBookingsCount
            + bookingsCountByType("private")
            + bookingsCountByType("recovery");

        // PAST-window bookings — same shape but scoped to the previous N days.
        // For classes we still include status="booked" (row's status doesn't
        // flip after the class runs — attendance is on `attendanceStatus`); for
        // appointment bookings we accept Booked | Attended | NoShow (i.e. any
        // non-cancelled row) so held-past bookings still count.
        const pastScheduleIds = new Set(
            scopedSchedules.filter(s => inPastRange(`${s.dateISO}T00:00:00Z`)).map(s => s.id),
        );
        const pastClassBookings = scopedBookings.filter(b =>
            b.status === "booked" && pastScheduleIds.has(b.classScheduleId),
        ).length;
        const pastAppointments = scopedAppointments.filter(a => inPastRange(`${a.dateISO}T00:00:00Z`));
        const pastApptIds = new Set(pastAppointments.map(a => a.id));
        const pastApptById = new Map(pastAppointments.map(a => [a.id, a] as const));
        const pastActiveApptBookings = appointmentBookings.filter(b =>
            b.status !== "Cancelled" && pastApptIds.has(b.appointmentId),
        );
        const pastBookingsCountByType = (t: "private" | "recovery"): number =>
            pastActiveApptBookings.filter(b => (pastApptById.get(b.appointmentId)?.type ?? "") === t).length;
        const pastBookingsAllCount = pastClassBookings
            + pastBookingsCountByType("private")
            + pastBookingsCountByType("recovery");

        // Delta helper — real % change from prior to current.
        //   prior 0 + current 0 → 0% (nothing to compare, flat).
        //   prior 0 + current > 0 → +100% (new activity).
        //   otherwise → rounded % of change; sign drives the arrow colour.
        const pctChange = (current: number, prior: number): { change: number; positive: boolean } => {
            if (prior === 0) return { change: current === 0 ? 0 : 100, positive: current >= 0 };
            const delta = ((current - prior) / prior) * 100;
            return { change: Math.abs(Math.round(delta)), positive: delta >= 0 };
        };

        // ── At-risk clients (14-30 day silent window) ───────────────────────
        // Range-independent — always the same silent-window bucket.
        const clientsAtRisk = scopedCustomers.filter(c => {
            if (c.status !== "active") return false;
            if (!c.lastVisitISO) return false;
            const d = new Date(c.lastVisitISO).getTime();
            if (Number.isNaN(d)) return false;
            const daysAgo = Math.floor((now - d) / DAY);
            return daysAgo >= 14 && daysAgo <= 30;
        }).length;

        // ── Under-filled classes ────────────────────────────────────────────
        // Same filter as UnderFilledModal so the count + list agree.
        const underFilledInRange = scopedSchedules.filter(s =>
            (s.status === "Upcoming" || s.status === "Ongoing")
            && inRange(`${s.dateISO}T00:00:00Z`)
            && s.capacity > 0
            && (s.booked / s.capacity) < 0.5,
        ).length;

        // ── Occupancy per type ─────────────────────────────────────────────
        // Sum booked / capacity across the sessions of that type in range.
        const classSchedulesInRange = scopedSchedules.filter(s =>
            inRange(`${s.dateISO}T00:00:00Z`),
        );
        const classOccupancy = {
            booked:   classSchedulesInRange.reduce((s, x) => s + (x.booked ?? 0), 0),
            capacity: classSchedulesInRange.reduce((s, x) => s + (x.capacity ?? 0), 0),
        };
        const privateApptsInRange = appointmentsInRange.filter(a => a.type === "private");
        const privateOccupancy = {
            booked:   privateApptsInRange.reduce((s, x) => s + (x.booked ?? 0), 0),
            capacity: privateApptsInRange.reduce((s, x) => s + (x.capacity ?? 0), 0),
        };
        const recoveryApptsInRange = appointmentsInRange.filter(a => a.type === "recovery");
        const recoveryOccupancy = {
            booked:   recoveryApptsInRange.reduce((s, x) => s + (x.booked ?? 0), 0),
            capacity: recoveryApptsInRange.reduce((s, x) => s + (x.capacity ?? 0), 0),
        };
        const occupancyPct = (o: { booked: number; capacity: number }): number =>
            o.capacity > 0 ? Math.round((o.booked / o.capacity) * 100) : 0;

        // ── Build cards per type ────────────────────────────────────────────
        // Real % change vs the prior N-day window (client Jul 2026 — was
        // hardcoded +3% before). Sign drives the arrow colour + magnitude.
        const revenueDelta   = pctChange(revenueAed, pastAllRevenueAed);
        const recurringDelta = pctChange(recurringRevenueAed, pastRecurringRevenueAed);
        const revenueCard: DashboardMetric = {
            label: "Revenue",
            value: `AED ${revenueAed.toLocaleString("en-US")}`,
            change: revenueDelta.change,
            positive: revenueDelta.positive,
            comparison: `vs prior ${comingRange} days`,
            icon: CurrencyDollar,
        };
        const recurringRevenueCard: DashboardMetric = {
            label: "Recurring revenue",
            value: `AED ${recurringRevenueAed.toLocaleString("en-US")}`,
            change: recurringDelta.change,
            positive: recurringDelta.positive,
            comparison: `vs prior ${comingRange} days`,
            icon: CurrencyDollar,
        };
        // Bookings uses different prior values per type — helper closes over
        // the per-type past count so All / Classes / Private / Recovery all
        // compare like-for-like.
        const bookingsCard = (n: number, prior: number): DashboardMetric => {
            const d = pctChange(n, prior);
            return {
                label: "Bookings",
                value: `${n.toLocaleString("en-US")} booked`,
                change: d.change,
                positive: d.positive,
                comparison: `pace vs prior ${comingRange} days`,
                icon: Calendar,
            };
        };
        const expiringMembershipsCard: DashboardMetric = {
            label: "Expiring memberships",
            value: `${expiringMembershipsCount} ${expiringMembershipsCount === 1 ? "customer" : "customers"}`,
            comparison: `AED ${expiringMembershipsAed.toLocaleString("en-US")} recurring`,
            icon: RefreshCw01,
            onClick: () => setAttentionModal("renewal"),
        };
        // At-risk clients + Trials-ending cards were removed from Coming-up
        // (client 2026-07-20) and rehomed on the Today tab's Needs Attention
        // list. The at-risk + trials data still compute inside the Today
        // `needsAttention` useMemo. `underFilledCard` stays here.
        const underFilledCard: DashboardMetric = {
            label: "Under filled classes",
            value: `${underFilledInRange} ${underFilledInRange === 1 ? "class" : "classes"}`,
            comparison: "below 50% capacity",
            icon: CalendarCheck01,
            onClick: () => setAttentionModal("underfilled"),
        };
        const expiringCreditsCard: DashboardMetric = {
            label: "Expiring credits",
            value: `${expiringCreditsCount} ${expiringCreditsCount === 1 ? "package" : "packages"}`,
            comparison: `within next ${comingRange} days`,
            icon: CreditCard01,
        };
        // Coming-up occupancy card — renamed "Occupancy" → "Capacity used"
        // per client 2026-07-20. Same numbers, clearer label.
        const occupancyCard = (
            occ: { booked: number; capacity: number },
            unit: "spot" | "slot",
        ): DashboardMetric => ({
            label: "Capacity used",
            value: `${occ.booked}/${occ.capacity} ${occ.capacity === 1 ? unit : `${unit}s`}`,
            comparison: `${occupancyPct(occ)}% filled`,
            icon: CalendarCheck01,
        });

        switch (comingType) {
            case "class":
                return [
                    revenueCard, recurringRevenueCard,
                    bookingsCard(classBookingsCount, pastClassBookings),
                    expiringMembershipsCard, underFilledCard,
                    expiringCreditsCard,
                    occupancyCard(classOccupancy, "spot"),
                ];
            case "private":
                return [
                    revenueCard,
                    bookingsCard(bookingsCountByType("private"), pastBookingsCountByType("private")),
                    expiringMembershipsCard,
                    expiringCreditsCard,
                    occupancyCard(privateOccupancy, "slot"),
                ];
            case "recovery":
                return [
                    revenueCard,
                    bookingsCard(bookingsCountByType("recovery"), pastBookingsCountByType("recovery")),
                    expiringCreditsCard,
                    occupancyCard(recoveryOccupancy, "slot"),
                ];
            case "":
            default:
                return [
                    revenueCard,
                    bookingsCard(bookingsAllCount, pastBookingsAllCount),
                    expiringCreditsCard,
                ];
        }
    }, [comingRange, comingType, scopedCustomerPlans, scopedSchedules, scopedBookings, scopedTransactions, scopedCustomers, scopedAppointments, appointmentBookings, packages]);

    // Pick the strip that matches the active tab. `metrics` stays the
    // stable public name (used by CSV export + a couple of downstream
    // references) so the CSV etc. keep exporting the metrics the admin
    // is currently looking at.
    const metrics = activeTab === "performance" ? performanceMetrics
        : activeTab === "coming" ? comingMetrics
            : todayMetrics;

    // Derive today's classes. The seed data centres around end-Feb 2025, so for a
    // realistic prototype we surface the next 6 upcoming/ongoing classes regardless
    // of the wall-clock date — keeping the dashboard visually populated. Branch
    // scoping still applies so picking a location filters the list.
    const todayClasses = useMemo<ScheduleClass[]>(() => {
        return [...scopedSessions]
            .filter(ci => ci.status === "Upcoming" || ci.status === "Ongoing")
            // Type filter — "" = all types.
            .filter(ci => !typeFilter || ci.type === typeFilter)
            .sort((a, b) => `${a.dateISO} ${a.startTime}`.localeCompare(`${b.dateISO} ${b.startTime}`))
            .slice(0, 6)
            .map(ci => {
                const palette = CATEGORY_PALETTE[ci.category] ?? FALLBACK_PALETTE;
                return {
                    id: ci.id,
                    name: ci.name,
                    type: ci.type,
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
    }, [scopedSessions, typeFilter]);

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

        // Failed transactions recoverable now — status "failed" in the last
        // 24h (retry today while the card is likely still valid). Rolling
        // 24h so the count exactly matches the FailedPayments modal opened
        // with `pastRangeDays={1}` — same predicate, no count-vs-list drift.
        const nowMs = Date.now();
        const DAY_MS = 24 * 60 * 60 * 1000;
        const failedTxns = scopedTransactions.filter(t => {
            if (t.status !== "failed") return false;
            const ts = new Date(t.createdAtISO).getTime();
            return !Number.isNaN(ts) && ts >= nowMs - DAY_MS && ts <= nowMs;
        });
        const failedTotalAed = failedTxns.reduce((sum, t) => sum + Math.abs(t.amountAed), 0);

        // Refund requests awaiting a decision — still-`complete` transactions
        // carrying a `refundRequestedAtISO` marker. A member is waiting on
        // the owner to approve or deny. (Matches the RefundRequestsModal.)
        const refundReqTxns = scopedTransactions.filter(t =>
            t.status === "complete" && !!t.refundRequestedAtISO,
        );
        const refundReqTotalAed = refundReqTxns.reduce((sum, t) => sum + Math.abs(t.amountAed), 0);

        // Waitlist spots opened on today's classes — today-dated schedules
        // with a free spot (booked < capacity) that carry ≥1 waitlisted
        // member awaiting confirmation. Count = those waitlisted members.
        const openTodaySchedIds = new Set(
            scopedSchedules
                .filter(s => s.dateISO === todayISO && s.capacity > 0 && s.booked < s.capacity)
                .map(s => s.id),
        );
        const waitlistConfirmCount = scopedBookings.filter(b =>
            b.status === "waitlisted" && openTodaySchedIds.has(b.classScheduleId),
        ).length;

        // New sign-ups today with no first booking — active customers whose
        // createdAt is today and who have zero bookings. Nudge while intent
        // is warm. (Matches the NewSignupsModal.)
        const bookedCustomerIds = new Set(scopedBookings.map(b => b.customerId));
        const newSignupsNoBooking = scopedCustomers.filter(c =>
            c.status === "active"
            && (c.createdAt ?? "").slice(0, 10) === todayISO
            && !bookedCustomerIds.has(c.id),
        ).length;

        // At-risk clients — customers whose last visit lands in the 14-30 day
        // silent window (client 2026-07-20 — moved OUT of the Coming-up card
        // set into the Today Needs Attention list because "at-risk" is a
        // needs-action-now signal, not a forward-looking metric). Definition
        // identical to the AtRiskClientsModal + the retired Coming-up card so
        // the count and the drill-down list agree.
        const nowAtRiskMs = Date.now();
        const DAY_MS_AR = 24 * 60 * 60 * 1000;
        const atRiskCount = scopedCustomers.filter(c => {
            if (c.status !== "active") return false;
            if (!c.lastVisitISO) return false;
            const d = new Date(c.lastVisitISO).getTime();
            if (Number.isNaN(d)) return false;
            const daysAgo = Math.floor((nowAtRiskMs - d) / DAY_MS_AR);
            return daysAgo >= 14 && daysAgo <= 30;
        }).length;

        // Trials ending — held package plans on an intro-flagged package
        // whose expiry lands in the next 7 days (client 2026-07-20 — moved
        // to Today Needs Attention with a short static window; 7 days keeps
        // the row "action now" without leaning on the Coming-up range pill).
        const introPackageIdSet = new Set(
            packages.filter(p => p.is_intro_offer === true).map(p => p.id),
        );
        const nowMsTrials = Date.now();
        const horizonMsTrials = nowMsTrials + 7 * DAY_MS_AR;
        const trialsEndingCount = scopedCustomerPlans.filter(p => {
            if (p.kind !== "package") return false;
            if (p.status !== "active" && p.status !== "frozen") return false;
            if (!p.productId || !introPackageIdSet.has(p.productId)) return false;
            if (!p.expiryISO) return false;
            const t = new Date(p.expiryISO).getTime();
            return !Number.isNaN(t) && t >= nowMsTrials && t <= horizonMsTrials;
        }).length;

        return {
            renewTodayCount: renewToday.length,
            renewTotalAed,
            expireTodayCount: expireToday.length,
            failedCount: failedTxns.length,
            failedTotalAed,
            refundReqCount: refundReqTxns.length,
            refundReqTotalAed,
            waitlistConfirmCount,
            newSignupsNoBooking,
            atRiskCount,
            trialsEndingCount,
        };
    }, [scopedCustomerPlans, scopedTransactions, scopedCustomers, scopedSchedules, scopedBookings, todayISO, packages]);

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

            {/* Tab Navigation — sticky when scrolling. The `bg-white`
                covers directly behind the tabs; the white box-shadow
                extends that white 24px UPWARD to fill main's p-6 top
                padding gap (where content used to bleed through above
                the tabs). box-shadow is purely visual — it does NOT
                affect layout, so the tab strip does NOT move a pixel. */}
            <div className="sticky top-0 z-30 w-full bg-white border-b border-[#e4e7ec] shadow-[0_-24px_0_0_#ffffff]">
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
                    {activeTab === "today" ? `Welcome, ${studioDisplayName}` : ""}
                </p>

                {/* Merged Type + Locations filter — Today tab (client 2026-07-20).
                    Replaces the separate pills row + shared location dropdown
                    with a single popover that matches DateRangeFilter's trigger
                    chrome. Type is single-select (radio-style rows); Locations
                    is single-select-under-checkbox-skin (radio semantics with
                    checkbox visuals) so downstream widgets keep their existing
                    `branchId: string | null` prop shape. */}
                {activeTab === "today" && (
                    <TypeLocationFilter
                        type={typeFilter}
                        onTypeChange={setTypeFilter}
                        locations={locations}
                        onLocationsChange={setLocations}
                        options={branches
                            .filter(b => b.status === "active")
                            .map(b => ({ id: b.id, name: b.name }))}
                    />
                )}

                {/* Merged Type + Locations filter — Coming Up tab (client
                    2026-07-20). Same component as Today; wires to `comingType`
                    so the per-type card matrix on Coming Up still switches on
                    it (the Today `typeFilter` is intentionally separate — each
                    tab keeps its own type memory so the user's pick on Today
                    doesn't silently re-scope Coming Up's cards). */}
                {activeTab === "coming" && (
                    <TypeLocationFilter
                        type={comingType}
                        onTypeChange={setComingType}
                        locations={locations}
                        onLocationsChange={setLocations}
                        options={branches
                            .filter(b => b.status === "active")
                            .map(b => ({ id: b.id, name: b.name }))}
                    />
                )}

                {/* Location picker — Performance tab only. The merged filter
                    (used on Today + Coming Up) is Type-aware, but Performance
                    has no Type dimension; keeping the existing SelectInput here
                    is the least-invasive path and preserves the tab's original
                    chrome (Location · DateRange · Add widget). */}
                {activeTab === "performance" && (
                    <SelectInput
                        triggerIcon={<MarkerPin01 className="w-5 h-5" />}
                        placeholder="Select location"
                        options={[{ value: "", label: "All locations" }, ...locationOptions]}
                        value={locations.length === 1 ? locations[0] : ""}
                        onChange={(v) => setLocations(v ? [v] : [])}
                        width="w-[220px]"
                    />
                )}

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
                    // Today/Performance: stretch so every card (incl. the
                    // Occupancy split card) shares one row height.
                    : "flex flex-wrap gap-6 items-stretch",
            )}>
                {metrics.map((metric) => (
                    <MetricCard key={metric.label} metric={metric} />
                ))}
                {/* Occupancy (Today) was removed 2026-07-20 per client feedback
                    — the occupancy signal now lives on the Coming-up tab as
                    "Capacity used" per session type. */}
            </div>

            {/* Performance tab */}
            {activeTab === "performance" && (
                <PerformanceTab
                    activeWidgets={activeWidgets}
                    period={period}
                    branchIds={branchScopeIds}
                    onOpenFailedPayments={() => setAttentionModal("failedWidget")}
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
                            Today&apos;s sessions
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
                                                onClick={() => router.push(`${isAppointmentId(c.id) ? "/appointments" : "/schedule"}/${c.id}?returnTo=${encodeURIComponent("/admin/dashboard")}`)}
                                                cls={{
                                                    name: c.name,
                                                    type: c.type,
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

            {/* Needs attention today — strictly TODAY-scoped rows (client
                Jul 2026). Each row renders ONLY when its count > 0, so a
                quiet day shows just the relevant items (no "0 renewals"
                noise). At-risk clients moved OUT — it's a 14-30 day window,
                not "today," so it lives on the Coming-up tab only. Failed
                payments lives here exclusively (removed from Coming-up). */}
            {activeTab === "today" && (() => {
                // Build the candidate rows, then filter to count > 0. The
                // last surviving row gets `isLast` so the trailing divider
                // stops there.
                const rows = [
                    {
                        key: "failed",
                        show: needsAttention.failedCount > 0,
                        icon: CreditCard01, iconBg: "bg-[#fef3f2]", iconFg: "text-[#b42318]",
                        title: `${needsAttention.failedCount} failed ${needsAttention.failedCount === 1 ? "payment" : "payments"} recoverable now`,
                        subtitle: `Retry today while the card is likely still valid · AED ${needsAttention.failedTotalAed.toLocaleString("en-US")}`,
                        onView: () => setAttentionModal("failed"),
                    },
                    {
                        key: "refund",
                        show: needsAttention.refundReqCount > 0,
                        icon: CoinsStacked01, iconBg: "bg-[#fff6ed]", iconFg: "text-[#c4320a]",
                        title: `${needsAttention.refundReqCount} refund ${needsAttention.refundReqCount === 1 ? "request" : "requests"} awaiting your decision`,
                        subtitle: `A customer is waiting on you · AED ${needsAttention.refundReqTotalAed.toLocaleString("en-US")} at stake`,
                        onView: () => setAttentionModal("refund"),
                    },
                    {
                        key: "waitlist",
                        show: needsAttention.waitlistConfirmCount > 0,
                        icon: CalendarCheck01, iconBg: "bg-[#ecfdf3]", iconFg: "text-[#079455]",
                        title: `${needsAttention.waitlistConfirmCount} waitlist ${needsAttention.waitlistConfirmCount === 1 ? "spot" : "spots"} need confirmation`,
                        subtitle: "Spots opened on today's classes — confirm the next in line",
                        onView: () => setAttentionModal("waitlist"),
                    },
                    {
                        key: "renew",
                        show: needsAttention.renewTodayCount > 0,
                        icon: RefreshCw01, iconBg: "bg-[#eff8ff]", iconFg: "text-[#175cd3]",
                        title: `${needsAttention.renewTodayCount} ${needsAttention.renewTodayCount === 1 ? "membership renews" : "memberships renew"} today`,
                        subtitle: `AED ${needsAttention.renewTotalAed.toLocaleString("en-US")} recurring`,
                        onView: () => setAttentionModal("renewal"),
                    },
                    {
                        key: "expire",
                        show: needsAttention.expireTodayCount > 0,
                        icon: Bell01, iconBg: "bg-[#fff6ed]", iconFg: "text-[#c4320a]",
                        title: `${needsAttention.expireTodayCount} ${needsAttention.expireTodayCount === 1 ? "membership expires" : "memberships expire"} today`,
                        subtitle: "Send a reminder before the membership lapses",
                        onView: () => setAttentionModal("renewal"),
                    },
                    {
                        key: "signups",
                        show: needsAttention.newSignupsNoBooking > 0,
                        icon: UserPlus01, iconBg: "bg-[#eefaf6]", iconFg: "text-[#0e9384]",
                        title: `${needsAttention.newSignupsNoBooking} new ${needsAttention.newSignupsNoBooking === 1 ? "sign-up" : "sign-ups"} with no first booking`,
                        subtitle: "Nudge them while intent is warm",
                        onView: () => setAttentionModal("signups"),
                    },
                    // At-risk clients — moved from Coming-up to Today
                    // Needs Attention (client 2026-07-20). 14-30 day silent
                    // window = "reach out now before we lose them" signal.
                    {
                        key: "atrisk",
                        show: needsAttention.atRiskCount > 0,
                        icon: UserX01, iconBg: "bg-[#fef3f2]", iconFg: "text-[#b42318]",
                        title: `${needsAttention.atRiskCount} at-risk ${needsAttention.atRiskCount === 1 ? "customer" : "customers"}`,
                        subtitle: "No visit in the last 14-30 days — reach out today",
                        onView: () => setAttentionModal("atrisk"),
                    },
                    // Trials ending — moved from Coming-up to Today Needs
                    // Attention (client 2026-07-20). Intro-package plans
                    // expiring within the next 7 days = "convert now" window.
                    {
                        key: "trials",
                        show: needsAttention.trialsEndingCount > 0,
                        icon: ClockFastForward, iconBg: "bg-[#fff6ed]", iconFg: "text-[#c4320a]",
                        title: `${needsAttention.trialsEndingCount} ${needsAttention.trialsEndingCount === 1 ? "trial ends" : "trials end"} within 7 days`,
                        subtitle: "Follow up before the intro window closes",
                        // No dedicated modal yet — reuse the coming-up
                        // "Expiring credits" narrative via a generic wallet
                        // deep link. Wire to a Trials modal in a follow-up.
                        onView: () => setAttentionModal(null),
                    },
                ].filter(r => r.show);

                // Nothing relevant today → hide the whole card.
                if (rows.length === 0) return null;

                return (
                    <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-3">
                        <p className="font-semibold text-lg text-[#101828]">Needs Attention</p>
                        <div className="flex flex-col">
                            {rows.map((r, i) => (
                                <NeedsAttentionRow
                                    key={r.key}
                                    icon={r.icon}
                                    iconBg={r.iconBg}
                                    iconFg={r.iconFg}
                                    title={r.title}
                                    subtitle={r.subtitle}
                                    onView={r.onView}
                                    isLast={i === rows.length - 1}
                                />
                            ))}
                        </div>
                    </div>
                );
            })()}

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
                branchIds={branchScopeIds}
                /* Forward-N-day window — matches the Coming-up "Renewals
                   due" metric so count + list agree at both pill settings. */
                forwardRangeDays={comingRange}
            />
            <FailedPaymentsModal
                open={attentionModal === "failed"}
                onClose={() => setAttentionModal(null)}
                branchIds={branchScopeIds}
                /* Last-24h window — matches the Needs-attention "Failed
                   payments recoverable now" row's rolling 24h count. */
                pastRangeDays={1}
            />
            {/* `failedComing` FailedPaymentsModal removed Jul 2026 — the
                Coming-up "Failed payments" card was dropped from the per-type
                card matrix, and no other surface routes to it. */}
            <FailedPaymentsModal
                open={attentionModal === "failedWidget"}
                onClose={() => setAttentionModal(null)}
                branchIds={branchScopeIds}
                /* Payments-collected widget window — scope the modal to the
                   same period bounds the widget's chip aggregates over so the
                   list count and the chip's number always agree. Widget
                   period is week/month/etc; we approximate by using its span
                   in whole days (min 1). */
                pastRangeDays={Math.max(1, Math.round((dateFilterToRange(period).to.getTime() - dateFilterToRange(period).from.getTime()) / 86400000))}
            />
            <AtRiskClientsModal
                open={attentionModal === "atrisk"}
                onClose={() => setAttentionModal(null)}
                branchIds={branchScopeIds}
            />
            <UnderFilledModal
                open={attentionModal === "underfilled"}
                onClose={() => setAttentionModal(null)}
                branchIds={branchScopeIds}
                /* Forward-N-day window — matches the Coming-up "Under
                   filled classes" metric so count + list agree at both
                   pill settings. */
                forwardRangeDays={comingRange}
            />

            {/* New today-scoped Needs-attention drill-downs (Jul 2026). */}
            <RefundRequestsModal
                open={attentionModal === "refund"}
                onClose={() => setAttentionModal(null)}
                branchIds={branchScopeIds}
            />
            <WaitlistConfirmModal
                open={attentionModal === "waitlist"}
                onClose={() => setAttentionModal(null)}
                branchIds={branchScopeIds}
            />
            <NewSignupsModal
                open={attentionModal === "signups"}
                onClose={() => setAttentionModal(null)}
                branchIds={branchScopeIds}
            />

            <Toast />
        </div>
    );
}
