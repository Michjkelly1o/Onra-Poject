"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Payroll details page (/compensation/run)
// ─────────────────────────────────────────────────────────────────────────────
//
// PRD 10 §7.3 — payroll calculation wizard. Figma:
//   • 3883-149504 — main page
//   • 4067-90235  — Process payroll? confirm modal
//   • 4085-35082  — Payroll submitted success modal
//
// Layout: same chrome as the pay rate detail page (root-level full screen,
// h-72 header). The action row in the toolbar mirrors /admin/compensation
// (branch + date period + Export + filter + primary Process button).
//
// Period defaults to the **active month** (1st → last day) formatted as
// "1st May - 31st May, 2026". User can override via DateRangeFilter.
//
// Process payroll lifecycle:
//   1. Click "Process payroll" → confirm modal (sage icon, totals snapshot)
//   2. Confirm        → flips every Pending entry in the filtered slice to
//                       Paid via setPayrollEntriesStatus(ids, "paid").
//   3. Submitted modal → Close (back to comp list) or Export (CSV).
//
// Per-row "Mark as paid" is available only on Pending rows that have an
// entry (zero-class rows are read-only — nothing to pay).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, Download01, ChevronLeft, MarkerPin01,
    SearchMd, FilterLines, CoinsHand, CoinsStacked01, CheckCircle, Users01,
    Check,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { EmptyState } from "@/components/ui/EmptyState";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { dateFilterToRange, spanInRange } from "@/lib/period-filter";
import { Toast } from "@/components/ui/Toast";
import {
    useAppStore,
    type Instructor, type PayrollEntry, type PayrollEntryStatus, type Branch,
} from "@/lib/store";
import { TaxSuffix } from "@/components/ui/TaxSuffix";
import { findActiveTaxRuleFor } from "@/lib/tax-calc";
import { payrollTaxAppliesForCountry } from "@/lib/payroll-tax";
import { payrollBreakdownFor } from "@/lib/payroll-calc";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { NeutralAvatar } from "@/components/patterns/NeutralAvatar";
import { RowActions } from "@/components/patterns/RowActions";

// ─── Display helpers ───────────────────────────────────────────────────────

function aed(n: number): string {
    return `AED ${Math.round(n).toLocaleString("en-US")}`;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Ordinal suffix — 1st, 2nd, 3rd, 4th… for the date chip label. */
function ordinal(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Build "1st May - 31st May, 2026" label from a custom range. */
function formatRangeLabel(from: Date, to: Date): string {
    const fromMonth = MONTHS_SHORT[from.getMonth()];
    const toMonth   = MONTHS_SHORT[to.getMonth()];
    const year      = to.getFullYear();
    if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
        return `${ordinal(from.getDate())} ${fromMonth} - ${ordinal(to.getDate())} ${toMonth}, ${year}`;
    }
    return `${ordinal(from.getDate())} ${fromMonth} - ${ordinal(to.getDate())} ${toMonth}, ${year}`;
}

/** Build the auto-set period for the active month (1st → last day). */
function activeMonthRange(now: Date = new Date()): DateFilter {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { type: "custom", from, to, label: formatRangeLabel(from, to) };
}

/** "Feb 2025" style label for the modal subtitle / metric card subtext. */
function monthYearLabel(d: Date): string {
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Export dropdown (reused across compensation pages) ────────────────────

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
                            onClick={() => { setOpen(false); if (fmt === "CSV") onExportCsv(); }}
                            className="w-full text-left px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                            {fmt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Status filter dropdown (same chrome as pay-rate list) ─────────────────

type StatusFilter = PayrollEntryStatus | null;

function StatusFilterDropdown({ value, onChange }: {
    value: StatusFilter; onChange: (next: StatusFilter) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const OPTIONS: { value: PayrollEntryStatus; label: string }[] = [
        { value: "pending", label: "Pending" },
        { value: "paid",    label: "Paid"    },
    ];

    return (
        <div ref={ref} className="relative">
            <Button variant="secondary-gray" size="md"
                leftIcon={
                    <div className="relative">
                        <FilterLines className="w-4 h-4" />
                        {value !== null && (
                            <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" />
                        )}
                    </div>
                }
                onClick={() => setOpen(p => !p)}>
                Filter
            </Button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-2 min-w-[160px]">
                    {OPTIONS.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => {
                                // Toggle off when the same option is clicked again.
                                onChange(value === opt.value ? null : opt.value);
                                setOpen(false);
                            }}
                            className={cn(
                                "w-full flex items-center justify-between text-left px-5 py-3 text-[15px] font-medium transition-colors",
                                value === opt.value ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                            )}>
                            {opt.label}
                            {value === opt.value && <Check className="w-4 h-4 text-[#658774]" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Avatar / status badge ─────────────────────────────────────────────────

// Local InstructorAvatar removed — uses canonical `<NeutralAvatar>` from
// `@/components/patterns/NeutralAvatar`.

// Local StatusBadge removed — uses canonical `<StatusBadge type="payroll">`
// from `@/components/patterns/StatusBadge`.

// ─── Metric card (matches the dashboard metric chrome) ─────────────────────

function MetricCard({ label, value, period, Icon }: {
    label: string; value: string; period: string; Icon: React.ElementType;
}) {
    return (
        <div className="flex-1 min-w-0 bg-white border-1 border-[#e4e7ec] rounded-[12px] p-5 flex flex-col gap-2 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] text-[#667085] leading-[20px] flex-1 min-w-0">{label}</p>
                <div className="w-10 h-10 rounded-full bg-[#f1f2ed] flex items-center justify-center shrink-0 overflow-hidden">
                    <Icon className="w-5 h-5 text-[#475467]" />
                </div>
            </div>
            <p className="font-semibold text-[24px] leading-[32px] text-[#101828]">{value}</p>
            <p className="text-[14px] text-[#667085] leading-[20px]">{period}</p>
        </div>
    );
}

// Local RowActions removed — uses canonical `@/components/patterns/RowActions`.
// Paid rows pass `triggerDisabled` to keep the visual rhythm with the
// disabled-style kebab (opacity-30 + cursor-not-allowed) the canonical
// already supports.

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Process payroll confirm modal (Figma 4067-90235) ──────────────────────

function ProcessPayrollModal({ open, instructorCount, grossWages, taxRate, showTax, onCancel, onConfirm }: {
    open: boolean;
    instructorCount: number;
    /** Sum of instructor payouts (what each instructor has EARNED
     *  before withholding). Renamed from "grossRevenue" per client
     *  feedback — Revenue is a studio-side metric and doesn't belong
     *  on a payroll summary. */
    grossWages: number;
    /** Tax rate percentage applied — read live from the Tax module's
     *  "pay_rate" category rule (see `findActiveTaxRuleFor`). Falls
     *  back to 0 when no active rule is configured. Ignored when
     *  `showTax` is false. */
    taxRate: number;
    /** True when the studio's country has personal income tax on
     *  payroll — render the withholding line + subtract from total.
     *  False for GCC studios (see `payrollTaxAppliesForCountry`):
     *  the withholding row hides and Net = Gross. */
    showTax: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    if (!open) return null;
    // Honest math: withholding = wages × rate; Total = wages − withholding.
    // Rounded independently so the two lines sum to the same integer the
    // Total row shows (no off-by-one when the client tallies by hand).
    // When `showTax` is false we skip both — Net = Gross verbatim.
    const withholding = showTax ? Math.round(grossWages * (taxRate / 100)) : 0;
    const netTotal    = Math.round(grossWages) - withholding;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onCancel}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#e9fff3] flex items-center justify-center">
                        <CoinsHand className="w-6 h-6 text-[#658774]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Process payroll?</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            You&apos;re about to process payroll for {instructorCount} {instructorCount === 1 ? "instructor" : "instructors"}. This action cannot be undone.
                        </p>
                    </div>
                </div>

                {/* Detail box */}
                <div className="mx-6 mt-6 rounded-[12px] border-1 border-[#e4e7ec] bg-[#f9fafb] p-4 flex flex-col gap-3">
                    <p className="text-[14px] font-semibold text-[#344054] leading-[20px]">Detail payroll</p>
                    <div className="flex items-center justify-between text-[14px]">
                        <span className="text-[#667085]">Gross wages</span>
                        <span className="font-medium text-[#101828]">{aed(grossWages)}</span>
                    </div>
                    {showTax && (
                        <div className="flex items-center justify-between text-[14px]">
                            <span className="text-[#667085]">Tax withholding (<span className="text-[#658774]">{taxRate}%</span>)</span>
                            <span className="font-medium text-[#101828]">− {aed(withholding)}</span>
                        </div>
                    )}
                    <div className="h-px w-full bg-[#e4e7ec]" />
                    <div className="flex items-center justify-between text-[14px]">
                        <span className="font-semibold text-[#344054]">Net payout</span>
                        <span className="font-semibold text-[#101828]">{aed(netTotal)}</span>
                    </div>
                </div>

                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>Back</Button>
                    <Button variant="primary" size="lg" className="flex-1" onClick={onConfirm}>Process payroll</Button>
                </div>
            </div>
        </div>
    );
}

// ─── Payroll submitted modal (Figma 4085-35082) ────────────────────────────

function PayrollSubmittedModal({ open, total, instructorCount, periodLabel, onClose, onExport }: {
    open: boolean;
    total: number;
    instructorCount: number;
    periodLabel: string;
    onClose: () => void;
    onExport: () => void;
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onClose}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#e9fff3] flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-[#658774]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Payroll submitted</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            {aed(total)} processed for {instructorCount} {instructorCount === 1 ? "instructor" : "instructors"} · {periodLabel}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Close</Button>
                    <Button variant="primary" size="lg" className="flex-1" leftIcon={<Download01 className="w-5 h-5" />} onClick={onExport}>
                        Export
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Row view-model + period helpers ───────────────────────────────────────

interface RunRow {
    entryId: string;        // synthetic when no entry exists
    actualEntryId?: string; // real id when an entry is present
    instructor: Instructor;
    branchId: string;
    payRateName: string;
    /** Full pay-rate record — carried through so the CSV exporter can
     *  render the client-requested per-row explanation (Class rate /
     *  Notes / Percentage columns). Undefined when the instructor has
     *  no pay-rate assigned. */
    payRate?: import("@/lib/store").PayRate;
    classesCount: number;
    totalHours: number;
    grossRevenue: number;
    /** Real sum of attendees across the period's completed classes
     *  (`payroll_entries.total_attendees`). Carried here so the CSV
     *  exporter can hand the actual figure to `payrollBreakdownFor`
     *  instead of reconstructing it from `grossRevenue / 150`, which
     *  silently divides by an approximate per-customer price and
     *  breaks reconciliation on Split-Rate + hybrid revenue rows. */
    totalAttendees: number;
    payout: number;
    status: PayrollEntryStatus;
}

// Period filter math lives in @/lib/period-filter — shared across every
// payroll page so all DateFilter presets behave identically.

// ─── CSV export ────────────────────────────────────────────────────────────

function exportRunCsv(rows: RunRow[], periodLabel: string, branches: Branch[]) {
    // v28 client-feedback fix — the previous CSV shoehorned every pay
    // model's math into a single free-text "Notes / Explanation" column
    // that broke when Excel wrapped long strings. Client asked for the
    // structured breakdown shown in the run-payroll reference table:
    //
    //   Pay model · Component · Basis · Rate · Amount
    //
    // Each instructor now expands to 1..N rows (one per pay-model
    // component + an optional Subtotal row for multi-component
    // models). Non-component context (Instructor / Email / Branch /
    // Status / Period / Total payout) is emitted on the FIRST row of
    // each instructor's block; blank on continuation rows so the
    // grouping reads naturally in Excel. See `payrollBreakdownFor` for
    // the per-model component shape.
    const header = [
        "Instructor", "Email", "Branch",
        "Pay model", "Component", "Basis", "Rate", "Amount (AED)",
        "Total payout (AED)", "Status", "Period",
    ];
    const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? "—";
    const escape = (v: string | number) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines: string[] = [];
    for (const r of rows) {
        // Pipe REAL totals through — `totalAttendees` and `grossRevenue`
        // both come from the payroll entry, so the breakdown row math
        // (basis × rate = amount) reconciles to the entry's
        // `total_earnings` on every pay model. The old code
        // reconstructed attendees as `grossRevenue / 150`, which
        // silently divided by an approximate per-customer price and
        // desynced Split-Rate + hybrid-revenue rows from their subtotal.
        const breakdown = payrollBreakdownFor(r.payRate, {
            totalEarningsAed: r.payout,
            completedClasses: r.classesCount,
            totalAttendees:   r.totalAttendees,
            revenueBaseAed:   r.grossRevenue,
        });
        const statusLabel = r.status === "paid" ? "Paid" : "Pending";
        const totalPayout = Math.round(r.payout);

        breakdown.components.forEach((comp, idx) => {
            const isFirst = idx === 0;
            lines.push([
                isFirst ? r.instructor.name  : "",
                isFirst ? r.instructor.email : "",
                isFirst ? branchName(r.branchId) : "",
                isFirst ? breakdown.payModel : "",
                comp.component,
                comp.basis,
                comp.rate,
                comp.amount,
                isFirst ? totalPayout : "",
                isFirst ? statusLabel : "",
                isFirst ? periodLabel : "",
            ].map(escape).join(","));
        });

        // Multi-component models get an explicit Subtotal row so the
        // client can see the sum without re-adding in Excel — matches
        // the reference table shipped in the client's screenshot.
        if (breakdown.components.length > 1) {
            lines.push([
                "", "", "", "", "Subtotal", "", "", breakdown.total,
                "", "", "",
            ].map(escape).join(","));
        }
    }

    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-run-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

// ─── Table chrome ──────────────────────────────────────────────────────────

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

// ─── Page ──────────────────────────────────────────────────────────────────

export interface PayrollRunPageProps { returnTo?: string }

export default function PayrollRunPage({ returnTo = "/admin/compensation" }: PayrollRunPageProps) {
    const router = useRouter();
    const payrollEntries        = useAppStore(s => s.payrollEntries);
    const instructors           = useAppStore(s => s.instructors);
    const payRates              = useAppStore(s => s.payRates);
    const branches              = useAppStore(s => s.branches);
    // v27 client-feedback fix — Process Payroll modal reads the
    // withholding rate LIVE from the Tax module's "pay_rate" category
    // rule so an owner editing tax in Settings sees the payroll modal
    // update in the same render cycle. Falls back to 0 % when no
    // active rule / rate is configured, mirroring `TaxSuffix`.
    const taxRules              = useAppStore(s => s.taxRules);
    const taxRates              = useAppStore(s => s.taxRates);
    // Country-gated payroll tax — GCC studios (UAE by default) don't
    // show a withholding line. See `payrollTaxAppliesForCountry` for
    // the country list + rationale. Reading `businessProfile` live
    // means editing Settings → Studio Profile → Country propagates
    // here without a refresh.
    const businessCountry       = useAppStore(s => s.businessProfile.country);
    const showPayrollTax        = payrollTaxAppliesForCountry(businessCountry);
    const setPayrollEntriesStatus = useAppStore(s => s.setPayrollEntriesStatus);
    const showToast             = useAppStore(s => s.showToast);

    // Period defaults to the **active month** (1st → last day of current).
    const [period, setPeriod]   = useState<DateFilter>(() => activeMonthRange());
    const [branchId, setBranchId] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Modal lifecycle.
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [submittedOpen, setSubmittedOpen] = useState(false);
    /** Snapshot captured at confirm-time so the success modal can show the
     *  totals even after the entries have been mutated. */
    const [submittedSnapshot, setSubmittedSnapshot] = useState<{ total: number; instructorCount: number; periodLabel: string } | null>(null);

    useEffect(() => { setPage(1); }, [branchId, period, statusFilter]);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    // ─── Build rows: instructor-first (payroll module is instructor-only) ─
    const allRows = useMemo<RunRow[]>(() => {
        const byInstructor = new Map<string, PayrollEntry>();
        for (const e of payrollEntries) {
            if (!spanInRange(e.periodStart, e.periodEnd, range)) continue;
            const existing = byInstructor.get(e.instructorId);
            if (!existing) { byInstructor.set(e.instructorId, e); continue; }
            byInstructor.set(e.instructorId, {
                ...existing,
                classesCount:   existing.classesCount   + e.classesCount,
                totalAttendees: existing.totalAttendees + e.totalAttendees,
                totalHours:     existing.totalHours     + e.totalHours,
                grossRevenue:   existing.grossRevenue   + e.grossRevenue,
                baseEarnings:   existing.baseEarnings   + e.baseEarnings,
                adjustmentAmount: existing.adjustmentAmount + e.adjustmentAmount,
                totalEarnings:  existing.totalEarnings  + e.totalEarnings,
                status: existing.status === "pending" || e.status === "pending" ? "pending" : "paid",
            });
        }

        return instructors
            .filter(i => i.status === "active")
            .map(instructor => {
                const entry = byInstructor.get(instructor.id);
                const livePayRate = instructor.payRateId
                    ? payRates.find(p => p.id === instructor.payRateId)
                    : undefined;
                return {
                    entryId: entry?.id ?? `noentry_${instructor.id}`,
                    actualEntryId: entry?.id,
                    instructor,
                    branchId: instructor.branchId,
                    payRateName: entry?.payRateName ?? livePayRate?.name ?? "—",
                    payRate:     livePayRate,
                    classesCount:   entry?.classesCount   ?? 0,
                    totalHours:     entry?.totalHours     ?? 0,
                    grossRevenue:   entry?.grossRevenue   ?? 0,
                    totalAttendees: entry?.totalAttendees ?? 0,
                    payout:         entry?.totalEarnings  ?? 0,
                    status:         entry?.status         ?? "pending",
                } satisfies RunRow;
            });
    }, [payrollEntries, instructors, payRates, range]);

    // ─── Filter chain (branch + status + nothing-to-search-by here) ───────
    const filteredRows = useMemo(() => {
        return allRows.filter(r => {
            if (branchId && r.branchId !== branchId) return false;
            if (statusFilter && r.status !== statusFilter) return false;
            return true;
        });
    }, [allRows, branchId, statusFilter]);

    // ─── Metrics (period × branch, search ignored as on the comp list) ────
    const metricRows = useMemo(
        () => allRows.filter(r => !branchId || r.branchId === branchId),
        [allRows, branchId],
    );
    const totalPayouts     = metricRows.reduce((s, r) => s + r.payout, 0);
    const totalClasses     = metricRows.reduce((s, r) => s + r.classesCount, 0);
    const grossRevenue     = metricRows.reduce((s, r) => s + r.grossRevenue, 0);
    const avgPerInstructor = metricRows.length > 0 ? totalPayouts / metricRows.length : 0;

    // Payroll withholding rate — live-joined from the Tax module. Owner
    // edits Settings → Tax → Pay rate rule → this recomputes without a
    // page refresh. Zero when no active rule (matches TaxSuffix logic).
    const payrollTaxMatch = useMemo(
        () => findActiveTaxRuleFor({ taxRules, taxRates }, "pay_rate", undefined),
        [taxRules, taxRates],
    );
    const payrollTaxRate = payrollTaxMatch?.rate.ratePercentage ?? 0;

    // ─── Pagination slice ─────────────────────────────────────────────────
    // ── Run payroll sort — Name / Branch / Pay rate / Classes / Hours /
    //    Gross revenue / Payout / Status. ──
    const RUN_STATUS_ORDER: Record<PayrollEntryStatus, number> = {
        pending: 0, paid: 1,
    } as Record<PayrollEntryStatus, number>;
    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort<RunRow>(filteredRows, {
        name:    (a, b) => a.instructor.name.localeCompare(b.instructor.name),
        branch:  (a, b) => {
            const an = branches.find(x => x.id === a.branchId)?.name ?? "";
            const bn = branches.find(x => x.id === b.branchId)?.name ?? "";
            return an.localeCompare(bn);
        },
        payRate: (a, b) => a.payRateName.localeCompare(b.payRateName),
        classes: (a, b) => a.classesCount - b.classesCount,
        hours:   (a, b) => a.totalHours - b.totalHours,
        gross:   (a, b) => a.grossRevenue - b.grossRevenue,
        payout:  (a, b) => a.payout - b.payout,
        status:  (a, b) => (RUN_STATUS_ORDER[a.status] ?? 99) - (RUN_STATUS_ORDER[b.status] ?? 99),
    });

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clamped = Math.min(Math.max(1, page), totalPages);
    const pageRows = sortedRows.slice((clamped - 1) * pageSize, clamped * pageSize);

    // ─── Branch options (live `branches` slice) ───────────────────────────
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({
            value: b.id, label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })),
        [branches],
    );

    // ─── Pending entries snapshot (for the Process Payroll button gating) ─
    const pendingEntryIds = useMemo(
        () => filteredRows.filter(r => r.status === "pending" && r.actualEntryId).map(r => r.actualEntryId!) ,
        [filteredRows],
    );
    const allPaid = pendingEntryIds.length === 0;

    // Subtitle: "7 instructors · Feb 2025" — derived from filteredRows + period.
    const subtitle = `${filteredRows.length} ${filteredRows.length === 1 ? "instructor" : "instructors"} · ${monthYearLabel(range.from)}`;

    // ─── Actions ──────────────────────────────────────────────────────────
    function handleMarkPaid(row: RunRow) {
        if (!row.actualEntryId) return;
        setPayrollEntriesStatus([row.actualEntryId], "paid");
        showToast("Payment recorded", `${row.instructor.name} marked as paid.`, "success", "check");
    }

    function openConfirm() {
        if (allPaid) return;
        setConfirmOpen(true);
    }

    function confirmProcessPayroll() {
        // Snapshot for the success modal — must capture BEFORE we mutate.
        // `totalForRun` is the NET payout (gross wages − tax withholding)
        // so the "AED X processed" line in the submitted modal matches
        // what actually leaves the studio's account. Same math the
        // Process modal displays.
        const grossForRun = filteredRows
            .filter(r => r.status === "pending" && r.actualEntryId)
            .reduce((s, r) => s + r.payout, 0);
        // Gate withholding on the SAME country flag the Process modal
        // uses (`showPayrollTax`). GCC studios (UAE default) show no
        // withholding, so the success toast + submitted modal must
        // report Net = Gross — matching exactly what the confirm modal
        // just displayed. Without this gate the receipt silently under-
        // reported by the seeded 5% pay-rate tax even though the modal
        // showed the full gross.
        const withholdingForRun = showPayrollTax
            ? Math.round(grossForRun * (payrollTaxRate / 100))
            : 0;
        const totalForRun = Math.round(grossForRun) - withholdingForRun;
        const countForRun = pendingEntryIds.length;
        const periodLabel = monthYearLabel(range.from);

        // Phase 2: skip persisting a PayrollRun row for now — phase 3 / future
        // payroll-history view can add the run record. Just flip every pending
        // entry in scope to paid.
        setPayrollEntriesStatus(pendingEntryIds, "paid");

        setSubmittedSnapshot({ total: totalForRun, instructorCount: countForRun, periodLabel });
        setConfirmOpen(false);
        // Confirmation toast — fires alongside the success modal so the user
        // sees both the persistent receipt (toast) and the inline export CTA.
        showToast(
            "Payroll processed successfully",
            `${aed(totalForRun)} paid to ${countForRun} ${countForRun === 1 ? "instructor" : "instructors"} for ${periodLabel}.`,
            "success", "check",
        );
        setSubmittedOpen(true);
    }

    function handleExportFromSubmitted() {
        exportRunCsv(filteredRows, period.label, branches);
        showToast(
            "Compensation data exported successfully",
            "The data has been exported successfully.",
            "success", "check",
        );
        setSubmittedOpen(false);
        router.push(returnTo);
    }

    function handleExportFromToolbar() {
        exportRunCsv(filteredRows, period.label, branches);
        showToast(
            "Compensation data exported successfully",
            "The data has been exported successfully.",
            "success", "check",
        );
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Payroll details</h1>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                {/* Metric cards */}
                <div className="flex items-stretch gap-4">
                    <MetricCard label="Class revenue base" value={aed(grossRevenue)}     period={monthYearLabel(range.from)} Icon={CoinsStacked01} />
                    <MetricCard label="Total payouts"      value={aed(totalPayouts)}     period={monthYearLabel(range.from)} Icon={CoinsHand} />
                    <MetricCard label="Classes completed"  value={totalClasses.toLocaleString("en-US")} period={monthYearLabel(range.from)} Icon={CheckCircle} />
                    <MetricCard label="Avg per Instructor" value={aed(avgPerInstructor)} period={monthYearLabel(range.from)} Icon={Users01} />
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-3 mt-6">
                    <div className="flex-1">
                        <p className="text-[16px] text-[#667085]">Total</p>
                        <p className="text-[16px] font-medium text-[#101828]">{subtitle}</p>
                    </div>
                    <SelectInput
                        triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                        placeholder="Select location"
                        options={[{ value: "", label: "All locations" }, ...branchOptions]}
                        value={branchId}
                        onChange={setBranchId}
                        width="w-[220px]"
                    />
                    <DateRangeFilter value={period} onChange={setPeriod} />
                    <ExportDropdown
                        disabled={filteredRows.length === 0}
                        onExportCsv={handleExportFromToolbar}
                    />
                    <StatusFilterDropdown value={statusFilter} onChange={setStatusFilter} />
                    <Button variant="primary" size="md" disabled={allPaid} onClick={openConfirm}>
                        Process payroll
                    </Button>
                </div>

                {/* Table */}
                <div className="mt-4 flex flex-col">
                    {pageRows.length === 0 ? (
                        <div className="relative" style={{ minHeight: 400 }}>
                            <EmptyState
                                title="No instructors"
                                subtitle="Try adjusting the branch or status filter."
                            />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={cn(TH, "w-[280px]")}>
                                            <SortableHeader sortKey="name"    currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Name</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[200px]")}>
                                            <SortableHeader sortKey="branch"  currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Branch location</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[180px]")}>
                                            <SortableHeader sortKey="payRate" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Default pay rate</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[140px]")}>
                                            <SortableHeader sortKey="classes" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Completed classes</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[120px]")}>
                                            <SortableHeader sortKey="hours"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Total time (hour)</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[140px]")}>
                                            <SortableHeader sortKey="gross"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Class revenue base</SortableHeader>
                                        </th>
                                        {/* Tax annotation sits in the column
                                            header rather than on every row —
                                            matches the Memberships & Packages
                                            list pattern so the table doesn't
                                            repeat "Inc. X% tax" per instructor. */}
                                        <th className={cn(TH, "w-[140px]")}>
                                            <SortableHeader sortKey="payout" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>
                                                <div className="flex flex-col gap-0.5">
                                                    <span>Instructor payout</span>
                                                    {showPayrollTax && (
                                                        <TaxSuffix
                                                            category="pay_rate"
                                                            className="text-[11px] font-normal text-[#667085] normal-case whitespace-nowrap"
                                                        />
                                                    )}
                                                </div>
                                            </SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[120px]")}>
                                            <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[52px]")} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map(r => {
                                        const branch = branches.find(b => b.id === r.branchId);
                                        return (
                                            <tr key={r.entryId} className="transition-colors hover:bg-[#f9fafb]">
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3">
                                                        <NeutralAvatar initials={r.instructor.initials} imageUrl={r.instructor.imageUrl} />
                                                        <div className="flex flex-col">
                                                            <span className="text-[14px] font-medium text-[#101828]">{r.instructor.name}</span>
                                                            <span className="text-[13px] text-[#667085]">{r.instructor.email}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className={cn(TD, "text-[#475467]")}>{branch?.name ?? "—"}</td>
                                                <td className={TD}>{r.payRateName}</td>
                                                <td className={TD}>{r.classesCount}</td>
                                                <td className={TD}>{r.totalHours}h</td>
                                                <td className={TD}>{aed(r.grossRevenue)}</td>
                                                <td className={TD}>{aed(r.payout)}</td>
                                                <td className={TD}><StatusBadge type="payroll" status={r.status} /></td>
                                                <td className={TD}>
                                                    <RowActions
                                                        minWidth={180}
                                                        triggerDisabled={!(r.status === "pending" && !!r.actualEntryId)}
                                                        items={[{
                                                            label: "Mark as paid",
                                                            icon: Check,
                                                            success: true,
                                                            onClick: () => handleMarkPaid(r),
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

                    <Pagination
                        page={clamped} total={sortedRows.length} pageSize={pageSize}
                        onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                    />
                </div>
            </div>

            {/* Modals */}
            <ProcessPayrollModal
                open={confirmOpen}
                instructorCount={pendingEntryIds.length}
                // Gross wages = sum of instructor PAYOUTS across the
                // pending rows about to be processed. Was previously
                // labelled "Gross revenue" and summed studio-side
                // revenue, which never subtracted cleanly to the Total
                // line and confused the client. Payout is the sum of
                // `earningsForClass` — the same number each instructor
                // will actually receive before withholding.
                grossWages={filteredRows
                    .filter(r => r.status === "pending" && r.actualEntryId)
                    .reduce((s, r) => s + r.payout, 0)}
                taxRate={payrollTaxRate}
                showTax={showPayrollTax}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={confirmProcessPayroll}
            />
            <PayrollSubmittedModal
                open={submittedOpen && submittedSnapshot !== null}
                total={submittedSnapshot?.total ?? 0}
                instructorCount={submittedSnapshot?.instructorCount ?? 0}
                periodLabel={submittedSnapshot?.periodLabel ?? ""}
                onClose={() => { setSubmittedOpen(false); router.push(returnTo); }}
                onExport={handleExportFromSubmitted}
            />

            <Toast />
        </div>
    );
}
