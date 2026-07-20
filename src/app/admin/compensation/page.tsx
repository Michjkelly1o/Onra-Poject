"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Compensation management (/admin/compensation)
// ─────────────────────────────────────────────────────────────────────────────
//
// PRD 10 §7 — payroll module landing page. Figma 2837-17872.
//
// Layout:
//   • 4 metric cards (Gross revenue / Total payouts / Classes completed /
//     Avg per Instructor) — period-filtered
//   • Toolbar (Total · branch · search · period filter · Export · Run payroll)
//   • Table (avatar+name+email · branch · default pay rate · completed
//     classes · earnings · ⋮ actions)
//   • Pagination (10 / 20 / 30 per page)
//
// State source of truth: useAppStore(s => s.payrollEntries) joined with
// useAppStore(s => s.instructors). Anything that mutates either slice (Run
// Payroll confirm, instructor archive, pay rate rename) refreshes this view
// in the same render cycle.
//
// Phase 1 scope:
//   • Listing + filtering + search + export CSV  ✓
//   • "Run payroll" → /compensation/run            (placeholder until phase 2)
//   • Row "View details" → /compensation/[id]      (placeholder until phase 3)

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    SearchMd, Download01, Eye,
    MarkerPin01, CoinsHand, CoinsStacked01, CheckCircle, Users01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { EmptyState } from "@/components/ui/EmptyState";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { dateFilterToRange, spanInRange } from "@/lib/period-filter";
import { totalEarningsForStaff } from "@/lib/payroll-calc";
import { NeutralAvatar } from "@/components/patterns/NeutralAvatar";
import { RowActions } from "@/components/patterns/RowActions";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import {
    useAppStore, type Branch,
    type Instructor, type PayrollEntry,
} from "@/lib/store";

// ─── Display helpers ────────────────────────────────────────────────────────

function aed(n: number): string {
    return `AED ${Math.round(n).toLocaleString("en-US")}`;
}

// Default period — "This month". When the period has no entries the table
// still shows every active instructor with 0 classes / AED 0, so the admin
// can read a truthful "nothing earned yet this month" state.
const DEFAULT_PERIOD: DateFilter = { type: "month", label: "This month" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ─── Export dropdown (same chrome as customers/products list) ───────────────

const EXPORT_FORMATS = ["CSV", "PDF", "Excel"] as const;

function ExportDropdown({ disabled, onExportCsv }: { disabled: boolean; onExportCsv: () => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    return (
        <div ref={ref} className="relative">
            <Button variant="secondary-gray" size="md"
                leftIcon={<Download01 className="w-4 h-4" />}
                disabled={disabled}
                onClick={() => setOpen(p => !p)}>
                Export
            </Button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[160px]">
                    {EXPORT_FORMATS.map(fmt => (
                        <button key={fmt} type="button"
                            onClick={() => {
                                setOpen(false);
                                if (fmt === "CSV") onExportCsv();
                            }}
                            className="w-full text-left px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                            {fmt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Metric card ───────────────────────────────────────────────────────────

function MetricCard({ label, value, period, Icon }: {
    label: string; value: string; period: string; Icon: React.ElementType;
}) {
    return (
        <div className="flex-1 min-w-0 bg-white border-1 border-[#e4e7ec] rounded-[12px] p-5 flex flex-col gap-2 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] text-[#667085] leading-[20px] flex-1 min-w-0">{label}</p>
                {/* Featured icon — same chrome as the dashboard metric cards
                    (40px circle, warm cream bg, gray icon). */}
                <div className="w-10 h-10 rounded-full bg-[#f1f2ed] flex items-center justify-center shrink-0 overflow-hidden">
                    <Icon className="w-5 h-5 text-[#475467]" />
                </div>
            </div>
            <p className="font-semibold text-[24px] leading-[32px] text-[#101828]">{value}</p>
            <p className="text-[14px] text-[#667085] leading-[20px]">{period}</p>
        </div>
    );
}

// ─── Avatar ────────────────────────────────────────────────────────────────

// Local InstructorAvatar removed — uses canonical `<NeutralAvatar>` from
// `@/components/patterns/NeutralAvatar`.

// Local RowActions removed — uses canonical `@/components/patterns/RowActions`.

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Row VM + period helpers ───────────────────────────────────────────────

/** Identity fields the compensation table needs. The payroll module is
 *  instructor-only, so this shape mirrors an `Instructor` row. */
interface CompRowIdentity {
    id: string;
    name: string;
    email: string;
    imageUrl?: string;
    initials: string;
    color?: string;
    branchId: string;
    payRateId?: string;
}

interface CompRow {
    entryId: string;
    instructor: CompRowIdentity;
    branchId: string;
    payRateName: string;
    classesCount: number;
    /** Real studio-side revenue for the row's period, from the payroll entry
     *  (0 for non-instructor staff — they don't teach classes). Powers the
     *  "Class revenue base" metric card so it stops using the placeholder
     *  `totalPayouts × 6` multiplier. */
    grossRevenue: number;
    earnings: number;
    status: PayrollEntry["status"];
    periodStart: string;
    periodEnd: string;
}

/** Convert a `DateFilter` chip into an inclusive [from, to] range. Custom
 *  ranges pass through directly; presets resolve relative to `now`. */
// Period filter math lives in @/lib/period-filter — shared across every page
// that uses DateRangeFilter so the presets behave identically everywhere.

// ─── CSV export helper ─────────────────────────────────────────────────────

function exportCompensationCsv(rows: CompRow[], branches: Branch[]) {
    const header = [
        "Staff", "Email", "Branch", "Default pay rate",
        "Completed classes", "Earnings (AED)", "Status", "Period",
    ];
    const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? "—";
    const escape = (v: string | number) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map(r => [
        r.instructor.name,
        r.instructor.email,
        branchName(r.branchId),
        r.payRateName,
        r.classesCount,
        Math.round(r.earnings),
        r.status === "paid" ? "Paid" : "Pending",
        `${r.periodStart} → ${r.periodEnd}`,
    ].map(escape).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `compensation-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

// ─── Table header/cell constants ───────────────────────────────────────────

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

// ─── Page ──────────────────────────────────────────────────────────────────

export default function CompensationPage() {
    const router = useRouter();
    const payrollEntries = useAppStore(s => s.payrollEntries);
    const instructors    = useAppStore(s => s.instructors);
    const branches       = useAppStore(s => s.branches);
    const showToast      = useAppStore(s => s.showToast);
    // Commission refactor Phase 3B — payroll reopens to ALL staff. Non-
    // instructor staff appear with their categorised commission (+ monthly
    // salary). Commission sources + role join.
    const staff                = useAppStore(s => s.staff);
    const roles                = useAppStore(s => s.roles);
    const customerTransactions = useAppStore(s => s.customerTransactions);
    const classBookings        = useAppStore(s => s.classBookings);
    const classSchedules       = useAppStore(s => s.classSchedules);
    const appointmentBookings  = useAppStore(s => s.appointmentBookings);
    const appointments         = useAppStore(s => s.appointments);

    const [branchId, setBranchId] = useState<string>("");
    const [search, setSearch]     = useState("");
    const [period, setPeriod]     = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage]         = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => { setPage(1); }, [branchId, search, period]);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    // ─── Build rows: instructor-first (not entry-first) ────────────────────
    //
    // The table lists every active instructor scoped to the branch — even if
    // they have NO payroll entry for the selected period. In that case the
    // row shows "0 completed classes / AED 0", which is the truthful state
    // (rather than an empty state that would suggest something's broken).
    //
    // The empty state is reserved for "no active instructors at all" in the
    // current branch — i.e. there's literally nobody to pay.

    const payRates = useAppStore(s => s.payRates);

    const allRows = useMemo<CompRow[]>(() => {
        // Shared inputs for the canonical earnings formula (base + commission).
        const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const sources = { transactions: customerTransactions, classBookings, classSchedules, appointmentBookings, appointments };
        const fromISO = iso(range.from);
        const toISO   = iso(range.to);

        const entriesByInstructor = new Map<string, PayrollEntry>();
        for (const e of payrollEntries) {
            if (!spanInRange(e.periodStart, e.periodEnd, range)) continue;
            // If an instructor has multiple entries in the range (e.g. spans
            // more than one month) we collapse them into one row by summing
            // — that's the right behaviour for the list summary.
            const existing = entriesByInstructor.get(e.instructorId);
            if (!existing) {
                entriesByInstructor.set(e.instructorId, e);
            } else {
                entriesByInstructor.set(e.instructorId, {
                    ...existing,
                    classesCount: existing.classesCount + e.classesCount,
                    totalAttendees: existing.totalAttendees + e.totalAttendees,
                    totalHours: existing.totalHours + e.totalHours,
                    grossRevenue: existing.grossRevenue + e.grossRevenue,
                    baseEarnings: existing.baseEarnings + e.baseEarnings,
                    adjustmentAmount: existing.adjustmentAmount + e.adjustmentAmount,
                    totalEarnings: existing.totalEarnings + e.totalEarnings,
                    // Status precedence: if any entry is still pending the
                    // aggregate row is pending (admin still has work to do).
                    status: existing.status === "pending" || e.status === "pending" ? "pending" : "paid",
                });
            }
        }

        // Instructor rows — base pay (class teaching / monthly salary) plus any
        // sales commission credited to them, via the shared earnings helper so
        // the figure matches the detail + run-payroll pages exactly.
        const instructorRows: CompRow[] = instructors
            .filter(i => i.status === "active")
            .map(instructor => {
                const entry = entriesByInstructor.get(instructor.id);
                const livePayRate = instructor.payRateId
                    ? payRates.find(p => p.id === instructor.payRateId)
                    : undefined;
                // "Default pay rate" is the instructor's CURRENT rate — prefer
                // the live name over the entry's historical snapshot.
                const payRateName = livePayRate?.name ?? entry?.payRateName ?? "—";

                const { total } = totalEarningsForStaff(
                    instructor.id, livePayRate, entry?.totalEarnings, sources, fromISO, toISO,
                );

                const identity: CompRowIdentity = {
                    id: instructor.id,
                    name: instructor.name,
                    email: instructor.email,
                    imageUrl: instructor.imageUrl,
                    initials: instructor.initials,
                    color: instructor.color,
                    branchId: instructor.branchId,
                    payRateId: instructor.payRateId,
                };

                return {
                    entryId: entry?.id ?? `noentry_${instructor.id}`,
                    instructor: identity,
                    branchId: instructor.branchId,
                    payRateName,
                    classesCount: entry?.classesCount ?? 0,
                    grossRevenue: entry?.grossRevenue ?? 0,
                    earnings: total,
                    status: entry?.status ?? "pending",
                    periodStart: entry?.periodStart ?? "",
                    periodEnd: entry?.periodEnd ?? "",
                } satisfies CompRow;
            });

        // Non-instructor staff rows (Phase 3B) — no class teaching, so base pay
        // = monthly salary (if any); commission adds on top. Same helper as the
        // instructor rows so the earnings column is computed one way only.
        const staffRows: CompRow[] = staff
            .filter(st => st.status === "active")
            .filter(st => roles.find(r => r.id === st.roleId)?.type !== "instructor")
            .map(st => {
                const payRate = st.payRateId ? payRates.find(p => p.id === st.payRateId) : undefined;
                const { total } = totalEarningsForStaff(st.id, payRate, undefined, sources, fromISO, toISO);
                // Look up the materialised payroll entry for this staff member
                // (created at Run Payroll confirm time) so the row's Status +
                // period columns reflect the actual paid/pending state
                // (client Jul 2026 audit fix — was hardcoded "pending" and the
                // CSV Status column stayed "Pending" after payment, disagreeing
                // with the Run Payroll table).
                const entry = entriesByInstructor.get(st.id);
                const identity: CompRowIdentity = {
                    id: st.id,
                    name: st.fullName,
                    email: st.email,
                    imageUrl: st.imageUrl,
                    initials: st.initials,
                    color: st.color,
                    branchId: st.branchId ?? "",
                    payRateId: st.payRateId,
                };
                return {
                    entryId: entry?.id ?? `staff_${st.id}`,
                    instructor: identity,
                    branchId: st.branchId ?? "",
                    payRateName: payRate?.name ?? "—",
                    classesCount: 0,
                    grossRevenue: 0,
                    earnings: total,
                    status: entry?.status ?? "pending",
                    periodStart: entry?.periodStart ?? "",
                    periodEnd: entry?.periodEnd ?? "",
                } satisfies CompRow;
            });

        return [...instructorRows, ...staffRows];
    }, [payrollEntries, instructors, staff, roles, payRates, range,
        customerTransactions, classBookings, classSchedules, appointmentBookings, appointments]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allRows.filter(r => {
            if (branchId && r.branchId !== branchId) return false;
            if (q && !r.instructor.name.toLowerCase().includes(q)
                  && !r.instructor.email.toLowerCase().includes(q)
                  && !r.payRateName.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [allRows, branchId, search]);

    // Metric cards ignore the search field — they always reflect the visible
    // period × branch slice so the user sees the headline number even while
    // typing in the search input.
    const metricRows = useMemo(() => {
        return allRows.filter(r => !branchId || r.branchId === branchId);
    }, [allRows, branchId]);

    const totalPayouts = metricRows.reduce((s, r) => s + r.earnings, 0);
    const totalClasses = metricRows.reduce((s, r) => s + r.classesCount, 0);
    // Payroll covers all staff, so the average is over the whole pool.
    const avgPerStaff  = metricRows.length > 0 ? totalPayouts / metricRows.length : 0;
    // Real studio revenue for the period — sum of grossRevenue from payroll
    // entries. Non-instructor staff have no entries (grossRevenue = 0) and
    // don't skew the total. Replaces the earlier `totalPayouts × 6` demo
    // placeholder, so the "Class revenue base" card matches Run payroll.
    const grossRevenue = metricRows.reduce((s, r) => s + r.grossRevenue, 0);

    // Period chip label for the metric cards ("Apr 2026", "This week", etc.)
    const metricPeriodLabel = (() => {
        if (period.type === "month") {
            const m = range.from;
            return `${MONTHS[m.getMonth()]} ${m.getFullYear()}`;
        }
        return period.label;
    })();

    // ── Sortable columns — Name / Branch / Default pay rate / Completed
    //    classes (numeric) / Earnings (numeric). ──
    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort<CompRow>(filteredRows, {
        name:    (a, b) => a.instructor.name.localeCompare(b.instructor.name),
        branch:  (a, b) => {
            const an = branches.find(x => x.id === a.branchId)?.name ?? "";
            const bn = branches.find(x => x.id === b.branchId)?.name ?? "";
            return an.localeCompare(bn);
        },
        payRate: (a, b) => a.payRateName.localeCompare(b.payRateName),
        classes: (a, b) => a.classesCount - b.classesCount,
        earnings:(a, b) => a.earnings - b.earnings,
    });

    // ─── Pagination slice ──────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clamped = Math.min(Math.max(1, page), totalPages);
    const pageRows = sortedRows.slice((clamped - 1) * pageSize, clamped * pageSize);

    // ─── Branch options (live `branches` slice — single source of truth) ────
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({
            value: b.id, label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })),
        [branches],
    );

    function handleRunPayroll() {
        router.push("/compensation/run?returnTo=/admin/compensation");
    }
    function handleViewDetails(row: CompRow) {
        router.push(`/compensation/${row.instructor.id}?returnTo=/admin/compensation`);
    }

    // Truly empty = there are no active instructors at all (or none in the
    // selected branch). This is the only state that warrants the empty-state
    // card — date-period filtering never empties the table; instructors
    // simply show 0 classes / AED 0 for periods with no entries.
    const isTrulyEmpty = allRows.length === 0
        || (branchId !== "" && allRows.every(r => r.branchId !== branchId));

    return (
        <div className="flex flex-col gap-6">
            {/* Metric cards */}
            <div className="flex items-stretch gap-4">
                <MetricCard label="Class revenue base" value={aed(grossRevenue)}     period={metricPeriodLabel} Icon={CoinsStacked01} />
                <MetricCard label="Total payouts"     value={aed(totalPayouts)}     period={metricPeriodLabel} Icon={CoinsHand} />
                <MetricCard label="Classes completed" value={totalClasses.toLocaleString("en-US")} period={metricPeriodLabel} Icon={CheckCircle} />
                <MetricCard label="Avg per staff" value={aed(avgPerStaff)} period={metricPeriodLabel} Icon={Users01} />
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <p className="text-[16px] text-[#667085]">Total</p>
                    <p className="text-[16px] font-medium text-[#101828]">
                        {filteredRows.length} {filteredRows.length === 1 ? "staff member" : "staff"}
                    </p>
                </div>
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...branchOptions]}
                    value={branchId}
                    onChange={setBranchId}
                    width="w-[220px]"
                />
                <div className="relative w-[240px]">
                    <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search..."
                        className="h-10 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>
                <DateRangeFilter value={period} onChange={setPeriod} />
                <ExportDropdown
                    disabled={filteredRows.length === 0}
                    onExportCsv={() => {
                        exportCompensationCsv(filteredRows, branches);
                        showToast(
                            "Compensation exported",
                            `${filteredRows.length} ${filteredRows.length === 1 ? "staff member" : "staff"} exported to CSV.`,
                            "success", "check",
                        );
                    }}
                />
                <Button variant="primary" size="md" onClick={handleRunPayroll}>
                    Run payroll
                </Button>
            </div>

            {/* Table */}
            <div className="h-[760px] flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                    {pageRows.length === 0 ? (
                        <EmptyState
                            title={isTrulyEmpty ? "No active staff" : "No staff found"}
                            subtitle={isTrulyEmpty
                                ? "Add an instructor to start calculating compensation."
                                : "Try adjusting your search or branch filter."}
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={cn(TH, "w-[320px]")}>
                                            <SortableHeader sortKey="name"     currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Name</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[220px]")}>
                                            <SortableHeader sortKey="branch"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Branch location</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[200px]")}>
                                            <SortableHeader sortKey="payRate"  currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Default pay rate</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[160px]")}>
                                            <SortableHeader sortKey="classes"  currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Completed classes</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[160px]")}>
                                            <SortableHeader sortKey="earnings" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Earnings</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[52px]")} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map(r => {
                                        const branch = branches.find(b => b.id === r.branchId);
                                        return (
                                            <tr key={r.entryId}
                                                onClick={() => handleViewDetails(r)}
                                                className="transition-colors hover:bg-[#f9fafb] cursor-pointer">
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3">
                                                        <NeutralAvatar initials={r.instructor.initials} imageUrl={r.instructor.imageUrl} />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[14px] font-medium text-[#101828]">{r.instructor.name}</span>
                                                            <span className="text-[13px] text-[#667085]">{r.instructor.email}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className={cn(TD, "text-[#475467]")}>{branch?.name ?? "—"}</td>
                                                <td className={TD}>{r.payRateName}</td>
                                                <td className={TD}>{r.classesCount}</td>
                                                <td className={TD}>{aed(r.earnings)}</td>
                                                <td className={TD} onClick={e => e.stopPropagation()}>
                                                    <RowActions
                                                        minWidth={180}
                                                        items={[{
                                                            label: "View details",
                                                            icon: Eye,
                                                            onClick: () => handleViewDetails(r),
                                                        }]}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="shrink-0">
                    <Pagination
                        page={clamped} total={sortedRows.length} pageSize={pageSize}
                        onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                    />
                </div>
            </div>
        </div>
    );
}
