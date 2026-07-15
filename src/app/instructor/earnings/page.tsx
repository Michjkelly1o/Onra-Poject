"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor Earnings (/instructor/earnings) · Phase 1
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 6616:334226 (main view) + 6616:334795 (filter side panel).
//
// **Per the brief: "MOSTLY THIS MODULE EARNINGS IS THE DUPLICATION OF THE
// MODULE IN ADMIN SIDE" — every primitive here comes from the admin Payroll
// instructor-detail page** ([PayrollInstructorDetailPage.tsx](src/components/staff/PayrollInstructorDetailPage.tsx)):
//   • Same earnings math via the shared `earningsForClass` helper
//   • Same status-badge palette (Completed = mint, Cancelled = red)
//   • Same DateRangeFilter chip + EmptyState pattern
//   • Same filter side-panel architecture as the Customers list
//     (divider sections, Clear/Apply buttons, click-outside dismiss)
//
// ──────────────────────────────────────────────────────────────────
// ROLE-SCOPED VIEW — reads the SAME centralized store the admin
// Payroll detail reads. Per-instructor scoping is a single
// `.filter(c => c.instructorId === currentStaffId)`. When this app
// moves to Supabase the filter becomes an RLS policy on
// `class_schedule.instructor_id`. Do NOT fork the seeds.
// ──────────────────────────────────────────────────────────────────

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    SearchMd, FilterLines, ArrowUp, ArrowDown,
    CheckCircle, Calendar, DotsVertical, Eye,
    Star01, XClose,
} from "@untitledui/icons";
import { useAppStore, type ClassSchedule, type ClassStatus, type PayRate } from "@/lib/store";
import { instructor_profile } from "@/data/mock/instructor_profile";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { dateFilterToRange, isoInRange } from "@/lib/period-filter";
import { earningsForClass, fmtAed, defaultRateLabel, payRateTypeLabel, commissionForPeriod } from "@/lib/payroll-calc";
import { SalesCommissionCard } from "@/components/staff/SalesCommissionCard";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/patterns/StatusBadge";

// ────────────────────────────────────────────────────────────────────────────
// Class-status badge — exact chrome admin uses in TABLE ROWS (compact
// pattern from `src/components/ui/badge.tsx`: PresentBadge, NoShowBadge,
// BookingStatusBadge). Smaller than the page-level class status badge
// because it sits in a table row alongside 14px body text.
// ────────────────────────────────────────────────────────────────────────────
// ─── Admin table chrome — VERBATIM PayrollInstructorDetailPage line 523-524 ─
const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

/** AED money formatter — exact admin `aed()` helper. */
function aed(n: number): string {
    return `AED ${Math.round(n).toLocaleString("en-US")}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Default period + filter state
// ────────────────────────────────────────────────────────────────────────────
const DEFAULT_PERIOD: DateFilter = { type: "week", label: "This week" };

type ClassTypeFilter = "all" | "Group" | "Private";
type StatusFilter    = "all" | "Completed" | "Cancelled";

interface FilterState {
    timeStart: string;  // "HH:MM" 24h
    timeEnd:   string;
    classType: ClassTypeFilter;
    status:    StatusFilter;
    categories: string[];  // empty = no category filter
}

/** Sensible "no time filter" sentinel — the day's full range. We pre-fill
 *  the inputs with these so the filter shows "00:00 - 23:59" instead of
 *  the blank "--:-- - --:--" the browser would render natively. */
const EMPTY_FILTER: FilterState = {
    timeStart: "00:00",
    timeEnd:   "23:59",
    classType: "all",
    status: "all",
    categories: [],
};

// Categories used to be a hardcoded 12-name list. They now come from the
// live `classCategories` slice via the FilterSidePanel's `categories` prop
// so any admin edit on /admin/categories reflects on the instructor side
// in the same render cycle — no orphan options the studio doesn't have.

/** Detect "user has actually constrained something" — the time inputs
 *  default to a full-day window so empty defaults aren't treated as a
 *  filter. Any deviation from the default time window OR a non-"all"
 *  selection counts. */
function hasAnyFilter(f: FilterState): boolean {
    const timeNarrowed = f.timeStart !== "00:00" || f.timeEnd !== "23:59";
    return timeNarrowed
        || f.classType !== "all"
        || f.status !== "all"
        || f.categories.length > 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────
export default function InstructorEarningsPage() {
    const router = useRouter();
    const currentUser    = useAppStore(s => s.currentUser);
    const classSchedules = useAppStore(s => s.classSchedules);
    const instructors    = useAppStore(s => s.instructors);
    const payRates       = useAppStore(s => s.payRates);
    // Commission sources (commission refactor Phase 3 — instructors earn it).
    const customerTransactions = useAppStore(s => s.customerTransactions);
    const classBookings        = useAppStore(s => s.classBookings);
    const appointmentBookings  = useAppStore(s => s.appointmentBookings);
    const appointments         = useAppStore(s => s.appointments);
    // Live category list — drives the Filter panel's Categories pills.
    const classCategories = useAppStore(s => s.classCategories);
    const categoryNames = useMemo(
        () => classCategories.map(c => c.name).sort((a, b) => a.localeCompare(b)),
        [classCategories],
    );
    const showToast      = useAppStore(s => s.showToast);

    // Resolve current instructor + pay rate.
    const staffId = (currentUser as typeof currentUser & { staff_profile_id?: string }).staff_profile_id
        ?? instructor_profile.staff_profile_id;
    const instructor = instructors.find(i => i.id === staffId);
    const payRate: PayRate | undefined = payRates.find(p => p.id === instructor?.payRateId);

    // ── State ─────────────────────────────────────────────────────────────
    const [period, setPeriod]   = useState<DateFilter>(DEFAULT_PERIOD);
    const [search, setSearch]   = useState("");
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER);
    const [filterOpen, setFilterOpen] = useState(false);
    const [page, setPage]       = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // ── Instructor-scoped slice ──
    const myClasses = useMemo(
        () => classSchedules.filter(c => c.instructorId === staffId),
        [classSchedules, staffId],
    );

    // ── Period window + previous-period baseline (for KPI delta) ──
    const currentRange = useMemo(() => dateFilterToRange(period), [period]);

    // Categorised commission for the selected period (Phase 3).
    const commission = useMemo(() => {
        const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return commissionForPeriod(staffId, payRate, {
            transactions: customerTransactions,
            classBookings,
            classSchedules,
            appointmentBookings,
            appointments,
        }, iso(currentRange.from), iso(currentRange.to));
    }, [staffId, payRate, customerTransactions, classBookings, classSchedules, appointmentBookings, appointments, currentRange]);
    const hasCommission = commission.lines.length > 0 || commission.bonusLines.length > 0;
    const prevRange = useMemo(() => {
        const len = currentRange.to.getTime() - currentRange.from.getTime();
        return {
            from: new Date(currentRange.from.getTime() - len - 1),
            to: new Date(currentRange.from.getTime() - 1),
        };
    }, [currentRange]);

    // ── KPI calculations ──────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const currClasses = myClasses.filter(c => isoInRange(c.dateISO, currentRange));
        const prevClasses = myClasses.filter(c => isoInRange(c.dateISO, prevRange));

        const currEarnings = currClasses.reduce((sum, c) => sum + earningsForClass(c, payRate, 1), 0);
        const prevEarnings = prevClasses.reduce((sum, c) => sum + earningsForClass(c, payRate, 1), 0);

        const currCompleted = currClasses.filter(c => c.status === "Completed").length;
        const prevCompleted = prevClasses.filter(c => c.status === "Completed").length;

        function delta(curr: number, prev: number): number {
            if (prev === 0) return curr === 0 ? 0 : 100;
            return Math.round(((curr - prev) / prev) * 100);
        }

        return {
            totalEarnings: currEarnings,
            earningsDelta: delta(currEarnings, prevEarnings),
            classesTaught: currCompleted,
            classesDelta:  delta(currCompleted, prevCompleted),
        };
    }, [myClasses, currentRange, prevRange, payRate]);

    // ── Row pipeline: filter → search → sort → paginate ───────────────────
    const filteredRows = useMemo(() => {
        // Only Completed + Cancelled rows show — earnings module excludes
        // upcoming + ongoing per Figma (status column never shows those).
        const eligible = myClasses.filter(c =>
            c.status === "Completed" || c.status === "Cancelled",
        );

        return eligible.filter(c => {
            if (!isoInRange(c.dateISO, currentRange)) return false;
            if (filters.status !== "all" && c.status !== filters.status) return false;
            if (filters.classType !== "all" && c.classType !== filters.classType) return false;
            if (filters.categories.length > 0 && !filters.categories.includes(c.category)) return false;
            // Time-of-day window. Defaults to 00:00–23:59 (the whole day),
            // so the only rows excluded are ones that fall outside a
            // user-narrowed window.
            if (c.startTime < filters.timeStart) return false;
            if (c.startTime > filters.timeEnd)   return false;

            const q = search.trim().toLowerCase();
            if (q.length > 0) {
                const hay = `${c.name} ${c.dateISO} ${c.displayTime}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        }).sort((a, b) =>
            // Newest first by date + time — matches the admin Payroll detail.
            `${b.dateISO} ${b.startTime}`.localeCompare(`${a.dateISO} ${a.startTime}`),
        );
    }, [myClasses, currentRange, filters, search]);

    // Reset to page 1 every time filters/search/period/pageSize change.
    useEffect(() => { setPage(1); }, [filters, search, period, pageSize]);

    // ── Sortable columns — Class name / Attendance (booked/capacity) /
    //    Rating / Status / Pay rate / Earnings. ──
    const STATUS_ORDER: Record<ClassStatus, number> = { Upcoming: 0, Ongoing: 1, Completed: 2, Cancelled: 3 };
    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort<ClassSchedule>(filteredRows, {
        name:       (a, b) => a.name.localeCompare(b.name),
        attendance: (a, b) => (a.booked ?? 0) - (b.booked ?? 0),
        rating:     (a, b) => (a.rating ?? 0) - (b.rating ?? 0),
        status:     (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
        // `defaultRateLabel(payRate)` is class-independent — every row
        // shares the same label, so sorting by it is a stable no-op (kept
        // here for header consistency).
        payRate:    () => 0,
        earnings:   (a, b) => earningsForClass(a, payRate) - earningsForClass(b, payRate),
    });

    const totalRows = sortedRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * pageSize;
    const pagedRows = sortedRows.slice(pageStart, pageStart + pageSize);

    // ── Handlers ──
    function handleApplyFilters(next: FilterState) {
        setFilters(next);
        setFilterOpen(false);
        if (hasAnyFilter(next)) {
            showToast("Filter applied", "Earnings list updated to match.", "success", "check");
        }
    }
    function handleClearFilters() {
        setFilters(EMPTY_FILTER);
        setFilterOpen(false);
        showToast("Filter cleared", "All filters were removed.", "success", "check");
    }
    function handleViewDetails(classId: string) {
        // Detail page lives at `/earnings/[classId]` (outside instructor
        // layout) so it can render as a full-screen takeover — same pattern
        // admin uses for `/schedule/[classId]`. The detail page handles the
        // persona auto-flip itself.
        router.push(`/earnings/${classId}?returnTo=${encodeURIComponent("/instructor/earnings")}`);
    }

    return (
        <div className="flex flex-col gap-6">
            {/* ── KPI row ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr] gap-4 w-full">
                <PayRateSnapshotCard payRate={payRate} />
                <KpiCard
                    icon={CheckCircle}
                    label="Total earnings"
                    value={fmtAed(kpis.totalEarnings)}
                    deltaPercent={kpis.earningsDelta}
                />
                <KpiCard
                    icon={CheckCircle}
                    label="Class taught"
                    value={String(kpis.classesTaught)}
                    deltaPercent={kpis.classesDelta}
                />
            </div>

            {/* Sales commission — categorised (commission refactor Phase 3;
                instructors now earn commission on the classes/services credited
                to them). */}
            {hasCommission && <SalesCommissionCard commission={commission} />}

            {/* ── Toolbar + table — VERBATIM admin PayrollInstructorDetailPage
                pattern. Real `<table>` + admin's TH/TD constants.
                Kebab uses `FixedDropdown` (position: fixed) so it escapes
                clipping; height fits content like Gift Cards / Memberships
                pages — no artificial min-height needed. */}
            <div className="flex flex-col gap-4">
                {/* Toolbar */}
                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <p className="text-[16px] text-[#667085]">Total</p>
                        <p className="text-[16px] font-medium text-[#101828]">
                            {totalRows} {totalRows === 1 ? "booking" : "bookings"}
                        </p>
                    </div>
                    <div className="relative w-[260px]">
                        <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search bookings..."
                            className="h-10 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                        />
                    </div>
                    <DateRangeFilter value={period} onChange={setPeriod} />
                    <Button
                        variant="secondary-gray"
                        size="md"
                        leftIcon={
                            <div className="relative">
                                <FilterLines className="w-4 h-4" />
                                {hasAnyFilter(filters) && (
                                    <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" />
                                )}
                            </div>
                        }
                        onClick={() => setFilterOpen(true)}
                    >
                        Filter
                    </Button>
                </div>

                {/* Table — verbatim admin's table structure */}
                {totalRows === 0 ? (
                    <div className="relative" style={{ minHeight: 360 }}>
                        <EmptyState
                            title="No bookings found"
                            subtitle={hasAnyFilter(filters) || search.trim().length > 0
                                ? "Try adjusting your search, period, or filters."
                                : "Your completed and cancelled classes will appear here."}
                            icon={CheckCircle}
                        />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={cn(TH, "w-[280px]")}>
                                        <SortableHeader sortKey="name"       currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Class name</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[120px]")}>
                                        <SortableHeader sortKey="attendance" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Attendance</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[160px]")}>
                                        <SortableHeader sortKey="rating"     currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Rating</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[140px]")}>
                                        <SortableHeader sortKey="status"     currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[140px]")}>
                                        <SortableHeader sortKey="payRate"    currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Pay rate</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[140px]")}>
                                        <SortableHeader sortKey="earnings"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Earnings</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[52px]")} />
                                </tr>
                            </thead>
                            <tbody>
                                {pagedRows.map(c => (
                                    <EarningsRow
                                        key={c.id}
                                        schedule={c}
                                        payRate={payRate}
                                        onViewDetails={() => handleViewDetails(c.id)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination — admin's canonical component */}
                {totalRows > 0 && (
                    <Pagination
                        page={safePage}
                        total={totalRows}
                        pageSize={pageSize}
                        onPage={setPage}
                        onPageSize={(s) => { setPageSize(s); setPage(1); }}
                    />
                )}
            </div>

            {/* ── Filter side panel ───────────────────────────────────── */}
            <FilterSidePanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={filters}
                onApply={handleApplyFilters}
                onClear={handleClearFilters}
                categories={categoryNames}
            />
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Pay rate snapshot card — 2-cell layout (Default rate + Type)
// ────────────────────────────────────────────────────────────────────────────
function PayRateSnapshotCard({ payRate }: { payRate: PayRate | undefined }) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] p-5 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 flex flex-col gap-3">
                <p className="text-[14px] font-semibold text-[#101828] leading-5">
                    {payRate?.name ?? "Standard pay rate"}
                </p>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                        <p className="text-[14px] text-[#667085] leading-5">Default rate</p>
                        <p className="text-[16px] font-semibold text-[#101828] leading-6">{defaultRateLabel(payRate)}</p>
                    </div>
                    <div className="flex flex-col gap-1 border-l-1 border-[#e4e7ec] pl-4">
                        <p className="text-[14px] text-[#667085] leading-5">Type</p>
                        <p className="text-[16px] font-semibold text-[#101828] leading-6">{payRateTypeLabel(payRate)}</p>
                    </div>
                </div>
            </div>
            <div className="bg-[#f1f2ed] rounded-full size-10 shrink-0 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#101828]" />
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// KPI card with delta arrow
// ────────────────────────────────────────────────────────────────────────────
interface KpiCardProps {
    icon: React.FC<{ className?: string }>;
    label: string;
    value: string;
    deltaPercent: number;
}
function KpiCard({ icon: Icon, label, value, deltaPercent }: KpiCardProps) {
    const isPositive = deltaPercent >= 0;
    const ArrowIcon = isPositive ? ArrowUp : ArrowDown;
    const deltaColor = isPositive ? "text-[#067647]" : "text-[#b42318]";
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] p-5 flex items-start justify-end gap-6">
            <div className="flex-1 min-w-0 flex flex-col gap-2 items-start">
                <p className="text-[14px] font-normal text-[#667085] leading-5 whitespace-nowrap">{label}</p>
                <p className="text-[24px] font-semibold text-[#101828] leading-8">{value}</p>
                <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 py-0.5 rounded-full shrink-0">
                        <ArrowIcon className={cn("w-3 h-3", deltaColor)} />
                        <p className={cn("text-[14px] font-medium leading-5", deltaColor)}>
                            {Math.abs(deltaPercent)}%
                        </p>
                    </div>
                    <p className="text-[14px] text-[#667085] leading-5 whitespace-nowrap">vs last week</p>
                </div>
            </div>
            <div className="bg-[#f1f2ed] rounded-full size-10 shrink-0 flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#101828]" />
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Earnings row
// ────────────────────────────────────────────────────────────────────────────
interface EarningsRowProps {
    schedule: ClassSchedule;
    payRate: PayRate | undefined;
    onViewDetails: () => void;
}
function EarningsRow({ schedule, payRate, onViewDetails }: EarningsRowProps) {
    const earnings = earningsForClass(schedule, payRate, 1);

    return (
        <tr onClick={onViewDetails}
            className="transition-colors hover:bg-[#f9fafb] cursor-pointer">
            {/* Class name — name on top, date below; admin's exact fonts. */}
            <td className={TD}>
                <div className="flex flex-col">
                    <span className="text-[14px] font-medium text-[#101828]">{schedule.name}</span>
                    <span className="text-[13px] text-[#667085]">
                        {schedule.dateISO}, {schedule.displayTime}
                    </span>
                </div>
            </td>

            {/* Attendance — plain "8/8" text */}
            <td className={TD}>{schedule.booked}/{schedule.capacity}</td>

            {/* Rating — 5 stars + count caption (admin's exact JSX) */}
            <td className={TD}>
                {schedule.ratingCount > 0 ? (
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                            {[0, 1, 2, 3, 4].map(i => (
                                <Star01
                                    key={i}
                                    className={cn(
                                        "w-3.5 h-3.5",
                                        i < Math.round(schedule.rating)
                                            ? "text-[#fdb022] fill-[#fdb022]"
                                            : "text-[#e4e7ec]",
                                    )}
                                />
                            ))}
                        </div>
                        <span className="text-[12px] text-[#667085]">
                            {schedule.rating.toFixed(1)} ({schedule.ratingCount} ratings)
                        </span>
                    </div>
                ) : (
                    <span className="text-[13px] text-[#667085]">No ratings</span>
                )}
            </td>

            <td className={TD}><StatusBadge type="class-payroll" status={schedule.status} /></td>
            <td className={TD}>{payRate?.name ?? "—"}</td>
            <td className={TD}>{earnings > 0 ? aed(earnings) : "—"}</td>
            <td className={TD} onClick={e => e.stopPropagation()}><RowKebab onView={onViewDetails} /></td>
        </tr>
    );
}

/** Kebab menu — uses `FixedDropdown` so the menu is `position: fixed` and
 *  escapes table / scroll-container `overflow` clipping. Same component
 *  admin's gift cards / memberships / schedule tables use. */
function RowKebab({ onView }: { onView: () => void }) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    return (
        <div className="relative">
            <button
                ref={btnRef}
                type="button"
                aria-label="Row actions"
                onClick={() => setOpen(o => !o)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors"
            >
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)}>
                <button
                    type="button"
                    onClick={() => { setOpen(false); onView(); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors"
                >
                    <Eye className="w-4 h-4 text-[#667085]" />
                    View details
                </button>
            </FixedDropdown>
        </div>
    );
}

function RatingStars({ rating }: { rating: number }) {
    const full = Math.round(rating);
    return (
        <div className="flex items-center gap-0.5">
            {[0, 1, 2, 3, 4].map(i => (
                <Star01
                    key={i}
                    className={cn(
                        "w-4 h-4",
                        i < full ? "text-[#f79009] fill-[#f79009]" : "text-[#d0d5dd]",
                    )}
                />
            ))}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Filter side panel — Figma 6616:334795
// ────────────────────────────────────────────────────────────────────────────
interface FilterSidePanelProps {
    open: boolean;
    onClose: () => void;
    applied: FilterState;
    onApply: (next: FilterState) => void;
    onClear: () => void;
    /** Live category-name list from the `classCategories` slice. */
    categories: string[];
}
function FilterSidePanel({ open, onClose, applied, onApply, onClear, categories }: FilterSidePanelProps) {
    const [pending, setPending] = useState<FilterState>(applied);

    // Sync draft with parent state every time the panel re-opens so
    // cancelling = discarding edits.
    useEffect(() => {
        if (open) setPending(applied);
    }, [open, applied]);

    useEffect(() => {
        if (!open) return;
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);

    function toggleCategory(c: string) {
        setPending(p => ({
            ...p,
            categories: p.categories.includes(c)
                ? p.categories.filter(x => x !== c)
                : [...p.categories, c],
        }));
    }

    return (
        <SlidePanel open={open} onClose={onClose} width={420}
            panelClassName="shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08)]"
        >
                {/* Header — verbatim admin chrome
                    ([admin/schedule/page.tsx:556-561](src/app/admin/schedule/page.tsx#L556)). */}
                <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close filter"
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors"
                    >
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col gap-5">
                    {/* Time-of-day window. End must come after Start —
                        when the user pushes Start past End we drag End
                        forward to match (one keystroke, no scolding). */}
                    <Section title="Time">
                        <div className="grid grid-cols-2 gap-3">
                            <TimeInput
                                value={pending.timeStart}
                                onChange={v => setPending(p => ({
                                    ...p,
                                    timeStart: v,
                                    timeEnd: v > p.timeEnd ? v : p.timeEnd,
                                }))}
                                ariaLabel="Start time"
                            />
                            <TimeInput
                                value={pending.timeEnd}
                                onChange={v => setPending(p => ({
                                    ...p,
                                    // Block setting end before start — clamp to start.
                                    timeEnd: v < p.timeStart ? p.timeStart : v,
                                }))}
                                ariaLabel="End time"
                                min={pending.timeStart}
                            />
                        </div>
                        {pending.timeEnd < pending.timeStart && (
                            <p className="text-[14px] text-[#b42318] leading-5">
                                End time must be after start time.
                            </p>
                        )}
                    </Section>

                    <Divider />

                    {/* Class type */}
                    <Section title="Class type">
                        <SegmentedPills
                            options={[
                                { value: "all",     label: "All" },
                                { value: "Group",   label: "Group" },
                                { value: "Private", label: "Private" },
                            ]}
                            value={pending.classType}
                            onChange={v => setPending(p => ({ ...p, classType: v as ClassTypeFilter }))}
                        />
                    </Section>

                    <Divider />

                    {/* Class status */}
                    <Section title="Class status">
                        <SegmentedPills
                            options={[
                                { value: "all",       label: "All" },
                                { value: "Completed", label: "Completed" },
                                { value: "Cancelled", label: "Cancelled" },
                            ]}
                            value={pending.status}
                            onChange={v => setPending(p => ({ ...p, status: v as StatusFilter }))}
                        />
                    </Section>

                    <Divider />

                    {/* Categories — multi-select pills. EXACT classes from
                        admin's `FilterPill` on /admin/customers (the
                        canonical multi-select pill style across admin). */}
                    <Section title="Categories">
                        <div className="flex flex-wrap gap-2">
                            {categories.map(cat => {
                                const on = pending.categories.includes(cat);
                                return (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => toggleCategory(cat)}
                                        className={cn(
                                            "px-3 py-[7px] rounded-[8px] text-[14px] font-medium border transition-all whitespace-nowrap",
                                            on
                                                ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                                                : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]",
                                        )}
                                    >
                                        {cat}
                                    </button>
                                );
                            })}
                        </div>
                    </Section>
                </div>

                {/* Footer — verbatim admin chrome
                    ([admin/schedule/page.tsx:644-654](src/app/admin/schedule/page.tsx#L644)).
                    `justify-between` pushes the two buttons to opposite edges
                    at their natural widths — NOT split full-width. */}
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button
                        variant="secondary-gray"
                        size="md"
                        onClick={onClear}
                        disabled={!hasAnyFilter(pending)}
                    >
                        Clear filter
                    </Button>
                    <Button
                        variant="primary"
                        size="md"
                        onClick={() => onApply(pending)}
                        disabled={!hasAnyFilter(pending)}
                    >
                        Apply
                    </Button>
                </div>
        </SlidePanel>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-2.5 w-full">
            <p className="text-[14px] font-semibold text-[#101828] leading-5">{title}</p>
            {children}
        </div>
    );
}

function Divider() {
    return <div className="h-px w-full bg-[#e4e7ec] shrink-0" />;
}

function TimeInput({ value, onChange, ariaLabel, min }: {
    value: string;
    onChange: (v: string) => void;
    ariaLabel: string;
    min?: string;
}) {
    return (
        <input
            type="time"
            value={value}
            onChange={e => onChange(e.target.value)}
            aria-label={ariaLabel}
            min={min}
            className="w-full h-10 px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white"
        />
    );
}

interface SegmentedPillsProps<T extends string> {
    options: ReadonlyArray<{ value: T; label: string }>;
    value: T;
    onChange: (v: T) => void;
}
/** Bordered segmented control (Figma 6616:334795). The shell is a single
 *  bordered row; each option shares the border with its neighbours. Active
 *  uses the same mint fill admin's `FilterPill` uses (`#e9fff3`) so the
 *  side panel's two pill flavours (segmented single-select + multi-select
 *  category chips) share one active language. */
function SegmentedPills<T extends string>({ options, value, onChange }: SegmentedPillsProps<T>) {
    return (
        <div className="flex items-center bg-white border-1 border-[#d0d5dd] rounded-[8px] overflow-hidden shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            {options.map((o, idx) => {
                const active = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onChange(o.value)}
                        aria-pressed={active}
                        className={cn(
                            "flex-1 h-10 text-[14px] font-medium transition-colors",
                            active
                                ? "bg-[#e9fff3] text-[#101828]"
                                : "bg-white text-[#475467] hover:bg-[#f9fafb]",
                            idx < options.length - 1 && "border-r-1 border-[#d0d5dd]",
                        )}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}
