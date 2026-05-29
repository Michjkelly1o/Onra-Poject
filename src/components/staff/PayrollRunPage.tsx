"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Run payroll page (/compensation/run)
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
    XClose, Download01, DotsVertical, ChevronLeft, MarkerPin01,
    SearchMd, FilterLines, CoinsHand, CoinsStacked01, CheckCircle, Users01,
    Check,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { dateFilterToRange, spanInRange } from "@/lib/period-filter";
import { Toast } from "@/components/ui/Toast";
import {
    useAppStore, BRANCHES,
    type Instructor, type PayrollEntry, type PayrollEntryStatus,
} from "@/lib/store";

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

function InstructorAvatar({ instructor }: { instructor: Instructor }) {
    if (instructor.imageUrl) {
        return (
            <img src={instructor.imageUrl} alt={instructor.name}
                className="w-10 h-10 rounded-full object-cover shrink-0"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
        );
    }
    return (
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-medium text-white shrink-0"
            style={{ backgroundColor: instructor.color }}>
            {instructor.initials}
        </div>
    );
}

function StatusBadge({ status }: { status: PayrollEntryStatus }) {
    const styles = status === "paid"
        ? "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]"
        : "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]";
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", styles)}>
            {status === "paid" ? "Paid" : "Pending"}
        </span>
    );
}

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

// ─── Row actions (⋮) — Pending rows get "Mark as paid" ─────────────────────

function RowActions({ canMarkPaid, onMarkPaid }: {
    canMarkPaid: boolean; onMarkPaid: () => void;
}) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    // Paid rows have no actionable items; render the button disabled-style so
    // the visual rhythm of the table stays consistent.
    return (
        <div className="relative">
            <button ref={btnRef} type="button"
                disabled={!canMarkPaid}
                onClick={() => setOpen(p => !p)}
                className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-[8px] transition-colors",
                    canMarkPaid ? "hover:bg-[#f2f4f7]" : "opacity-30 cursor-not-allowed",
                )}>
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            {canMarkPaid && (
                <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={180}>
                    <button type="button" onClick={() => { setOpen(false); onMarkPaid(); }}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Check className="w-4 h-4 text-[#067647]" />Mark as paid
                    </button>
                </FixedDropdown>
            )}
        </div>
    );
}

// ─── Pagination ────────────────────────────────────────────────────────────

function Pagination({ page, total, pageSize, onPage, onPageSize }: {
    page: number; total: number; pageSize: number; onPage: (p: number) => void; onPageSize: (s: number) => void;
}) {
    const [sizeOpen, setSizeOpen] = useState(false);
    const sizeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) setSizeOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return (
        <div className="shrink-0 flex items-center gap-3 py-4 border-t border-[#e4e7ec]">
            <div ref={sizeRef} className="relative flex items-center gap-2 flex-1">
                <button type="button" onClick={() => setSizeOpen(p => !p)}
                    className="flex items-center gap-1 px-3 py-[7px] border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] text-[14px] font-semibold text-[#344054]">
                    {pageSize}<ChevronLeft className="w-4 h-4 text-[#667085] rotate-90" />
                </button>
                {sizeOpen && (
                    <div className="absolute bottom-[calc(100%+4px)] left-0 z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 min-w-[80px]">
                        {[10, 20, 30].map(s => (
                            <button key={s} type="button" onClick={() => { onPageSize(s); setSizeOpen(false); }}
                                className={cn("flex items-center w-full px-4 py-[9px] text-[14px] font-medium hover:bg-[#f9fafb] transition-colors", s === pageSize ? "text-[#101828] font-semibold" : "text-[#344054]")}>{s}</button>
                        ))}
                    </div>
                )}
                <span className="text-[14px] font-medium text-[#344054]">per page</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-[14px] font-medium text-[#344054] whitespace-nowrap">Page {page} of {totalPages}</span>
                <button type="button" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}
                    className={cn("px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page <= 1 ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Previous</button>
                <button type="button" disabled={page >= totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))}
                    className={cn("px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page >= totalPages ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Next</button>
            </div>
        </div>
    );
}

// ─── Process payroll confirm modal (Figma 4067-90235) ──────────────────────

function ProcessPayrollModal({ open, instructorCount, grossRevenue, taxRate, total, onCancel, onConfirm }: {
    open: boolean;
    instructorCount: number;
    grossRevenue: number;
    /** Tax rate percentage applied — phase 2 hardcodes to 0 per the brief
     *  (tax module isn't built yet). The line still renders for parity. */
    taxRate: number;
    total: number;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    if (!open) return null;
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
                        <span className="text-[#667085]">Gross revenue</span>
                        <span className="font-medium text-[#101828]">{aed(grossRevenue)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[14px]">
                        <span className="text-[#667085]">Tax rate (<span className="text-[#658774]">{taxRate}%</span>)</span>
                        <span className="font-medium text-[#101828]">{aed(grossRevenue * (taxRate / 100))}</span>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />
                    <div className="flex items-center justify-between text-[14px]">
                        <span className="font-semibold text-[#344054]">Total</span>
                        <span className="font-semibold text-[#101828]">{aed(total)}</span>
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
    classesCount: number;
    totalHours: number;
    grossRevenue: number;
    payout: number;
    status: PayrollEntryStatus;
}

// Period filter math lives in @/lib/period-filter — shared across every
// payroll page so all DateFilter presets behave identically.

// ─── CSV export ────────────────────────────────────────────────────────────

function exportRunCsv(rows: RunRow[], periodLabel: string) {
    const header = ["Instructor", "Email", "Branch", "Default pay rate", "Completed classes", "Total time (hrs)", "Gross revenue (AED)", "Instructor payout (AED)", "Status", "Period"];
    const branchName = (id: string) => BRANCHES.find(b => b.id === id)?.name ?? "—";
    const escape = (v: string | number) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map(r => [
        r.instructor.name, r.instructor.email, branchName(r.branchId), r.payRateName,
        r.classesCount, r.totalHours, Math.round(r.grossRevenue), Math.round(r.payout),
        r.status === "paid" ? "Paid" : "Pending", periodLabel,
    ].map(escape).join(","));
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

    // ─── Build rows: instructor-first (same logic as the comp list page) ───
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
                const liveRateName = instructor.payRateId
                    ? payRates.find(p => p.id === instructor.payRateId)?.name
                    : undefined;
                return {
                    entryId: entry?.id ?? `noentry_${instructor.id}`,
                    actualEntryId: entry?.id,
                    instructor,
                    branchId: instructor.branchId,
                    payRateName: entry?.payRateName ?? liveRateName ?? "—",
                    classesCount: entry?.classesCount ?? 0,
                    totalHours:   entry?.totalHours   ?? 0,
                    grossRevenue: entry?.grossRevenue ?? 0,
                    payout:       entry?.totalEarnings ?? 0,
                    status:       entry?.status ?? "pending",
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

    // ─── Pagination slice ─────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const clamped = Math.min(Math.max(1, page), totalPages);
    const pageRows = filteredRows.slice((clamped - 1) * pageSize, clamped * pageSize);

    // ─── Branch options ───────────────────────────────────────────────────
    const branchOptions = useMemo(
        () => BRANCHES.filter(b => b.status === "active").map(b => ({
            value: b.id, label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })),
        [],
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
        const totalForRun = filteredRows
            .filter(r => r.status === "pending" && r.actualEntryId)
            .reduce((s, r) => s + r.payout, 0);
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
        exportRunCsv(filteredRows, period.label);
        showToast(
            "Compensation data exported successfully",
            "The data has been exported successfully.",
            "success", "check",
        );
        setSubmittedOpen(false);
        router.push(returnTo);
    }

    function handleExportFromToolbar() {
        exportRunCsv(filteredRows, period.label);
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
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Run payroll</h1>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                {/* Metric cards */}
                <div className="flex items-stretch gap-4">
                    <MetricCard label="Gross revenue"      value={aed(grossRevenue)}     period={monthYearLabel(range.from)} Icon={CoinsStacked01} />
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
                                        <th className={cn(TH, "w-[280px]")}>Name</th>
                                        <th className={cn(TH, "w-[200px]")}>Branch location</th>
                                        <th className={cn(TH, "w-[180px]")}>Default pay rate</th>
                                        <th className={cn(TH, "w-[140px]")}>Completed classes</th>
                                        <th className={cn(TH, "w-[120px]")}>Total time (hour)</th>
                                        <th className={cn(TH, "w-[140px]")}>Gross revenue</th>
                                        <th className={cn(TH, "w-[140px]")}>Instructor payout</th>
                                        <th className={cn(TH, "w-[120px]")}>Status</th>
                                        <th className={cn(TH, "w-[52px]")} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map(r => {
                                        const branch = BRANCHES.find(b => b.id === r.branchId);
                                        return (
                                            <tr key={r.entryId} className="transition-colors hover:bg-[#f9fafb]">
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3">
                                                        <InstructorAvatar instructor={r.instructor} />
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
                                                <td className={TD}><StatusBadge status={r.status} /></td>
                                                <td className={TD}>
                                                    <RowActions
                                                        canMarkPaid={r.status === "pending" && !!r.actualEntryId}
                                                        onMarkPaid={() => handleMarkPaid(r)}
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
                        page={clamped} total={filteredRows.length} pageSize={pageSize}
                        onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                    />
                </div>
            </div>

            {/* Modals */}
            <ProcessPayrollModal
                open={confirmOpen}
                instructorCount={pendingEntryIds.length}
                grossRevenue={grossRevenue}
                taxRate={0}
                total={filteredRows
                    .filter(r => r.status === "pending" && r.actualEntryId)
                    .reduce((s, r) => s + r.payout, 0)}
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
