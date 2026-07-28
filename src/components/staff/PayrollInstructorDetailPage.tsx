"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor earnings detail (/compensation/[instructorId])
// ─────────────────────────────────────────────────────────────────────────────
//
// PRD 10 §7.4 — individual instructor earnings. Figma:
//   • 2841-33871 — main page
//   • 7093-347694 — Change pay rate modal
//
// Layout (root-level, no admin layout):
//   • Header                                  (h-72 px chrome × close)
//   • Body 2-column inside h-[832px]:
//       LEFT  w-320 sidebar  — avatar/name + earnings summary card +
//                              contact rows + "Pay rate actions" (Change
//                              pay rate · Export payout report)
//       RIGHT flex-1 card    — single "Earnings" tab → 3 metric cards →
//                              toolbar (search · period · status filter) →
//                              classes table → pagination
//
// Data sources (all live, store-subscribed):
//   • instructors        — the subject row
//   • payRates           — drives pay-rate name + "Change pay rate" dropdown
//   • classSchedules     — the bookings table (filtered by instructorId)
//   • payrollEntries     — drives the sidebar "Total earnings this month"
//
// Cross-module sync:
//   • Change pay rate    → assignInstructorPayRate (also reflects on
//                          /admin/staff/pay-rate detail Assigned Instructor)
//   • View details row   → /schedule/[classId] (existing detail page)

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, Edit02, Download01, Eye,
    SearchMd, Calendar, CheckCircle, Users01, Star01, Lightbulb02, Check, ChevronDown,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { EmptyState } from "@/components/ui/EmptyState";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { dateFilterToRange, isoInRange, spanInRange, type DateRange } from "@/lib/period-filter";
import { earningsForClass, aed, commissionForPeriod, baseEarningsFor, totalEarningsForStaff, buildPayConfigTracks } from "@/lib/payroll-calc";
import { SalesCommissionCard } from "@/components/staff/SalesCommissionCard";
import { RoleBadge } from "@/components/staff/RoleBadge";
import { Toast } from "@/components/ui/Toast";
import {
    useAppStore, computePayRateDisplay,
    type Instructor, type ClassSchedule, type PayRate, type StaffPayConfig,
} from "@/lib/store";
import { TaxSuffix } from "@/components/ui/TaxSuffix";
import { payrollTaxAppliesForCountry } from "@/lib/payroll-tax";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { IconTooltip } from "@/components/patterns/IconTooltip";
import { NeutralAvatar } from "@/components/patterns/NeutralAvatar";
import { DetailPageShell } from "@/components/patterns/DetailPageShell";
import { RowActions } from "@/components/patterns/RowActions";
import { Sliders } from "@/components/icons/Sliders";

// ─── Display helpers ───────────────────────────────────────────────────────
//
// `aed()` + `earningsForClass()` are now imported from `@/lib/payroll-calc`
// — the single source of truth shared with the instructor Earnings page
// (Phase 3 centralization). When the math changes (different attendee
// proxy, real attendance, new pay-rate type), edit the helper once and
// both surfaces pick it up.

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthYearLabel(d: Date): string {
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// Default period — "This month" so the bookings table lands populated on
// open. The user can switch to Today / This week / Last month / custom
// from the date chip; presets that fall outside the current schedule seed
// will correctly show their empty state.
const DEFAULT_PERIOD: DateFilter = { type: "month", label: "This month" };

// ─── Avatar (image OR initials) ────────────────────────────────────────────

// Thin wrapper around the canonical `<NeutralAvatar>` — kept so the
// existing call sites that pass `instructor` keep working.
function InstructorAvatar({ instructor, size = 40 }: { instructor: Instructor; size?: number }) {
    return <NeutralAvatar initials={instructor.initials} imageUrl={instructor.imageUrl} size={size} />;
}

// ─── Sidebar action button (same chrome as pay-rate detail) ───────────────

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className="flex items-center gap-2 w-full text-[16px] font-semibold leading-[24px] text-[#475467] hover:text-[#344054] transition-colors text-left">
            <span className="w-5 h-5 shrink-0">{icon}</span>
            {label}
        </button>
    );
}

// ─── Status badge (pay rate detail's instructor status palette) ────────────

function InstructorStatusBadge({ status }: { status: Instructor["status"] }) {
    const styles: Record<Instructor["status"], string> = {
        active:   "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        inactive: "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
        archive:  "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    };
    const labels = { active: "Active", inactive: "Inactive", archive: "Archive" };
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", styles[status])}>
            {labels[status]}
        </span>
    );
}

// ─── Class status badge (Completed / Cancelled / Upcoming / Ongoing) ───────

type ClassStatus = ClassSchedule["status"];

const CLASS_STATUS_STYLES: Record<ClassStatus, string> = {
    Completed: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    Cancelled: "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
    Upcoming:  "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    Ongoing:   "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
};

function ClassStatusBadge({ status }: { status: ClassStatus }) {
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", CLASS_STATUS_STYLES[status])}>
            {status}
        </span>
    );
}

// ─── Mini status filter dropdown (same chrome as pay-rate list) ────────────

type ClassStatusFilter = ClassStatus | null;

function ClassStatusFilterDropdown({ value, onChange }: {
    value: ClassStatusFilter; onChange: (next: ClassStatusFilter) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const OPTIONS: ClassStatus[] = ["Completed", "Ongoing", "Upcoming", "Cancelled"];

    return (
        <div ref={ref} className="relative">
            <IconTooltip label="Filter" disabled={open}>
                <Button variant="secondary-gray" size="icon" aria-label="Filter"
                    onClick={() => setOpen(p => !p)}>
                    <span className="relative inline-flex">
                        <Sliders className="w-5 h-5" />
                        {value !== null && (
                            <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" aria-hidden />
                        )}
                    </span>
                </Button>
            </IconTooltip>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-2 min-w-[180px]">
                    {OPTIONS.map(opt => (
                        <button key={opt} type="button"
                            onClick={() => { onChange(value === opt ? null : opt); setOpen(false); }}
                            className={cn(
                                "w-full flex items-center justify-between text-left px-5 py-3 text-[15px] font-medium transition-colors",
                                value === opt ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                            )}>
                            {opt}
                            {value === opt && <Check className="w-4 h-4 text-[#658774]" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Pay rate snapshot metric card (Figma — Default rate / Type) ──────────

function PayRateSnapshotCard({ payRate }: { payRate: PayRate | undefined }) {
    if (!payRate) {
        return (
            <div className="flex-1 min-w-0 bg-white border-1 border-[#e4e7ec] rounded-[12px] p-5 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="flex items-start justify-between gap-3">
                    <p className="text-[14px] font-medium text-[#101828] leading-[20px]">No pay rate assigned</p>
                    <div className="w-10 h-10 rounded-full bg-[#f1f2ed] flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-[#475467]" />
                    </div>
                </div>
                <p className="text-[14px] text-[#667085] leading-[20px]">
                    Use "Change pay rate" in the sidebar to assign one.
                </p>
            </div>
        );
    }
    const display = computePayRateDisplay(payRate);
    const typeLabel = (() => {
        switch (payRate.type) {
            case "flat":    return "Flat";
            case "tiered":  return "Tiered";
            case "revenue": return "% of revenue";
            case "hybrid":  return "Hybrid";
            case "monthly": return "Monthly";
        }
    })();
    return (
        <div className="flex-[1.5] min-w-0 bg-white border-1 border-[#e4e7ec] rounded-[12px] p-5 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] font-medium text-[#101828] leading-[20px]">{payRate.name} pay rate</p>
                <div className="w-10 h-10 rounded-full bg-[#f1f2ed] flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-[#475467]" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                    <p className="text-[14px] text-[#667085]">Default rate</p>
                    <p className="text-[16px] font-medium text-[#101828]">{display.main}/{display.subtitle.replace(/^per /, "")}</p>
                </div>
                <div className="flex flex-col gap-1">
                    <p className="text-[14px] text-[#667085]">Type</p>
                    <p className="text-[16px] font-medium text-[#101828]">{typeLabel}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Simple metric card (same chrome as compensation list) ─────────────────

function MetricCard({ label, value, hint, Icon }: {
    label: string; value: string; hint?: string; Icon: React.ElementType;
}) {
    return (
        <div className="flex-1 min-w-0 bg-white border-1 border-[#e4e7ec] rounded-[12px] p-5 flex flex-col gap-2 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] text-[#667085] leading-[20px] flex-1 min-w-0">{label}</p>
                <div className="w-10 h-10 rounded-full bg-[#f1f2ed] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#475467]" />
                </div>
            </div>
            <p className="font-semibold text-[24px] leading-[32px] text-[#101828]">{value}</p>
            {hint && <p className="text-[14px] text-[#067647] leading-[20px]">{hint}</p>}
        </div>
    );
}

// ─── Change pay rate modal (Figma 7093-347694) ─────────────────────────────
// Full multi-track editor — mirrors the instructor create/edit form so the
// Change pay rate flow reflects the SAME Default / Pay per class / Pay per
// Private configuration. At least one track must stay enabled (client
// 2026-07-28).

/** Small on/off switch (mirrors StaffFormPage's PayToggle). */
function PayToggle({ value, onChange, disabled }: { value: boolean; onChange: (n: boolean) => void; disabled?: boolean }) {
    return (
        <button type="button" role="switch" aria-checked={value} disabled={disabled}
            onClick={() => !disabled && onChange(!value)}
            title={disabled ? "At least one pay rate must stay enabled" : undefined}
            className={cn(
                "w-9 h-5 rounded-full p-[2px] flex items-center transition-colors shrink-0",
                value ? "bg-[#658774] justify-end" : "bg-[#f2f4f7] justify-start",
                disabled && "opacity-60 cursor-not-allowed",
            )}>
            <span className="block w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]" />
        </button>
    );
}

function PayTrackCard({ title, subtitle, enabled, onToggle, toggleDisabled, rateValue, rateOptions, onRateChange }: {
    title: string; subtitle: string; enabled: boolean; onToggle: (n: boolean) => void; toggleDisabled?: boolean;
    rateValue: string; rateOptions: { value: string; label: string }[]; onRateChange: (v: string) => void;
}) {
    return (
        <div className={cn("w-full bg-white rounded-[12px] p-4 flex flex-col gap-4", enabled ? "border-2 border-[#7ba08c]" : "border-1 border-[#e4e7ec]")}>
            <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-[20px]">{title}</p>
                    <p className="text-[14px] text-[#667085] leading-[20px]">{subtitle}</p>
                </div>
                <PayToggle value={enabled} onChange={onToggle} disabled={toggleDisabled} />
            </div>
            {enabled && (
                <div className="flex flex-col gap-[6px]">
                    <p className="text-[14px] font-medium text-[#344054]">Pay rate</p>
                    <SelectInput placeholder="Select pay rate" options={rateOptions} value={rateValue} onChange={onRateChange} width="w-full" />
                </div>
            )}
        </div>
    );
}

function ChangePayRateModal({ instructor, initialConfig, allRates, onCancel, onConfirm }: {
    instructor: Instructor;
    initialConfig: StaffPayConfig;
    allRates: PayRate[];
    onCancel: () => void;
    onConfirm: (config: StaffPayConfig) => void;
}) {
    // Active rates only — archived ones don't appear in selectors (PRD 10 §6.6).
    const options = allRates
        .filter(p => p.status === "active")
        .map(p => ({ value: p.id, label: p.name }));
    const [cfg, setCfg] = useState<StaffPayConfig>(initialConfig);

    const enabledCount = [cfg.default.enabled, cfg.perClass.enabled, cfg.perAppointment.enabled].filter(Boolean).length;
    function setTrack<K extends keyof StaffPayConfig>(key: K, patch: Partial<StaffPayConfig[K]>) {
        setCfg(c => ({ ...c, [key]: { ...c[key], ...patch } }));
    }
    // At least one track must stay enabled — block turning off the last one.
    function toggleTrack(key: keyof StaffPayConfig, next: boolean) {
        if (!next && enabledCount <= 1) return;
        setTrack(key, { enabled: next } as never);
    }
    const canSave = enabledCount >= 1
        && (!cfg.default.enabled || !!cfg.default.payRateId)
        && (!cfg.perClass.enabled || !!cfg.perClass.payRateId)
        && (!cfg.perAppointment.enabled || !!cfg.perAppointment.payRateId);

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] w-[560px] max-h-[88vh] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onCancel}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1 pt-6 px-6 shrink-0">
                    <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">
                        Change pay rate for &quot;{instructor.name}&quot;
                    </h3>
                    <p className="text-[14px] text-[#475467] leading-[20px]">
                        Update the pay configuration. At least one pay rate must stay enabled.
                    </p>
                </div>

                <div className="px-6 pt-6 pb-2 flex flex-col gap-4 overflow-y-auto scrollbar-hide">
                    <PayTrackCard title="Default pay rate" subtitle="Provide a base salary for this staff."
                        enabled={cfg.default.enabled} onToggle={n => toggleTrack("default", n)} toggleDisabled={cfg.default.enabled && enabledCount <= 1}
                        rateValue={cfg.default.payRateId ?? ""} rateOptions={options} onRateChange={v => setTrack("default", { payRateId: v })} />
                    <PayTrackCard title="Pay per class" subtitle="Add compensation for every class taught."
                        enabled={cfg.perClass.enabled} onToggle={n => toggleTrack("perClass", n)} toggleDisabled={cfg.perClass.enabled && enabledCount <= 1}
                        rateValue={cfg.perClass.payRateId ?? ""} rateOptions={options} onRateChange={v => setTrack("perClass", { payRateId: v })} />
                    <PayTrackCard title="Pay per Private" subtitle="Add compensation for every private session completed."
                        enabled={cfg.perAppointment.enabled} onToggle={n => toggleTrack("perAppointment", n)} toggleDisabled={cfg.perAppointment.enabled && enabledCount <= 1}
                        rateValue={cfg.perAppointment.payRateId ?? ""} rateOptions={options} onRateChange={v => setTrack("perAppointment", { payRateId: v })} />

                    {/* Info banner — bg #f1f2ed warm-cream per Figma 7093-347698 */}
                    <div className="flex gap-3 items-start bg-[#f1f2ed] border-1 border-[#e4e7ec] rounded-[12px] px-4 py-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0 mt-[2px]" />
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            The updated pay configuration applies to all future classes and bookings.
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 px-6 pt-4 pb-6 border-t border-[#e4e7ec] shrink-0">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>Cancel</Button>
                    <Button variant="primary" size="lg" className="flex-1" disabled={!canSave} onClick={() => onConfirm(cfg)}>
                        Update pay rate
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Period helpers ────────────────────────────────────────────────────────

// Period filter math lives in @/lib/period-filter — shared across every
// payroll page so all DateFilter presets behave identically.

function scheduleInRange(s: ClassSchedule, r: DateRange): boolean {
    return isoInRange(s.dateISO, r);
}

// ─── Earnings per class — derived live from pay rate × attendance ─────────
//
// Mirrors PRD 10 §8 examples:
//   • Flat            → flatAmount per completed class
//   • Tiered          → tier amount based on attendees
//   • Revenue         → splitPercent of class revenue + payPerCustomer × n
//   • Hybrid          → baseRate + (bonus_attendance | revenue split)
//   • Monthly         → fixedSalary / classes_in_month (approx for prototype)
//
// Cancelled classes earn 0 (PRD 10 §8 — substitute logic deferred).
//
// Math lives in `@/lib/payroll-calc` (Phase 3 centralization). Both this
// page and the instructor Earnings page import the same `earningsForClass`,
// so the per-class number is guaranteed identical whichever surface you
// open the data on.

// ─── Row view-model ────────────────────────────────────────────────────────

interface ClassRow {
    schedule: ClassSchedule;
    attendees: number;     // booked count (proxy for attendance until real)
    capacity: number;
    rating: number;
    ratingCount: number;
    payRateName: string;
    earnings: number;
}

// ─── CSV export ────────────────────────────────────────────────────────────

function exportPayoutReport(rows: ClassRow[], instructor: Instructor, periodLabel: string) {
    const header = ["Date", "Class", "Attendance", "Rating", "Status", "Pay rate", "Earnings (AED)"];
    const escape = (v: string | number) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map(r => [
        r.schedule.dateISO + " " + r.schedule.displayTime,
        r.schedule.name,
        `${r.attendees}/${r.capacity}`,
        r.ratingCount > 0 ? `${r.rating.toFixed(1)} (${r.ratingCount})` : "—",
        r.schedule.status,
        r.payRateName,
        Math.round(r.earnings),
    ].map(escape).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    const slug = instructor.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    a.download = `payout-${slug}-${periodLabel.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

// ─── Collapsible section (accordion) ──────────────────────────────────────
// A clickable header (title + subtitle + right-aligned total + chevron) that
// reveals its body. Default collapsed to keep the payroll detail compact —
// used by the Total earnings breakdown + Sales commission sections (client
// 2026-07-28, Figma 8015-219885).

function PayrollAccordion({ title, subtitle, value, defaultOpen = false, children }: {
    title: string;
    subtitle?: string;
    value?: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                className="w-full flex items-start justify-between gap-4 p-6 text-left transition-colors hover:bg-[#f9fafb]"
            >
                <div className="flex flex-col gap-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#101828]">{title}</p>
                    {subtitle && <p className="text-[13px] text-[#667085] leading-[18px]">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {value && <span className="text-[20px] font-semibold text-[#101828] leading-[28px]">{value}</span>}
                    <ChevronDown className={cn("w-5 h-5 text-[#667085] transition-transform", open && "rotate-180")} />
                </div>
            </button>
            {open && <div className="px-6 pb-6 -mt-1">{children}</div>}
        </div>
    );
}

// ─── Sidebar earnings summary (Figma — Total earnings this month card) ────

function SidebarEarningsCard({ totalThisMonth, classesCount, classCap, payRateAmount, branchId, showTax }: {
    totalThisMonth: number;
    /** Classes taught this month + the progress-bar cap. Only passed for real
     *  instructors — non-instructor staff teach nothing, so the whole
     *  Classes stat + progress bar is omitted for them. */
    classesCount?: number;
    classCap?: number;
    /** Branch context for the pay_rate tax-suffix lookup. */
    branchId: string;
    payRateAmount: string;
    /** Country-gated: hide the TaxSuffix line for GCC studios (see
     *  `payrollTaxAppliesForCountry`). Passed from the page-level flag
     *  so a country change in Settings propagates here live. */
    showTax: boolean;
}) {
    // Instructors keep the classes stat + progress bar; non-instructor staff
    // get the compact card (total + default pay rate only).
    const showClasses = classesCount !== undefined && classCap !== undefined;
    const pct = showClasses && classCap! > 0
        ? Math.min(100, Math.round((classesCount! / classCap!) * 100))
        : 0;
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <p className="text-[13px] text-[#667085] leading-[18px]">Total earnings this month</p>
                <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">{aed(totalThisMonth)}</p>
                {showTax && <TaxSuffix category="pay_rate" branchId={branchId} />}
            </div>
            {showClasses ? (
                <>
                    <div className="w-full h-1.5 rounded-full bg-[#e4e7ec] overflow-hidden">
                        <div className="h-full bg-[#658774]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                            <p className="text-[12px] text-[#667085]">Classes</p>
                            <p className="text-[13px] font-medium text-[#344054]">{classesCount}/{classCap} classes</p>
                        </div>
                        <div className="flex flex-col gap-1 text-right">
                            <p className="text-[12px] text-[#667085]">Default pay rate</p>
                            <p className="text-[13px] font-medium text-[#344054]">{payRateAmount}</p>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="h-px w-full bg-[#e4e7ec]" />
                    <div className="flex flex-col gap-1">
                        <p className="text-[12px] text-[#667085]">Default pay rate</p>
                        <p className="text-[13px] font-medium text-[#344054]">{payRateAmount}</p>
                    </div>
                </>
            )}
        </div>
    );
}


function SidebarRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[13px] text-[#667085] leading-[18px]">{label}</p>
            <p className="text-[15px] font-medium text-[#101828] leading-[22px]">{value}</p>
        </div>
    );
}

// Local RowActions removed — uses canonical `@/components/patterns/RowActions`.

// ─── Table chrome ──────────────────────────────────────────────────────────

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

// ─── Page ──────────────────────────────────────────────────────────────────

export interface PayrollInstructorDetailPageProps {
    instructorId: string;
    returnTo?: string;
}

export default function PayrollInstructorDetailPage({
    instructorId, returnTo = "/admin/compensation",
}: PayrollInstructorDetailPageProps) {
    const router = useRouter();
    const instructors            = useAppStore(s => s.instructors);
    const payRates               = useAppStore(s => s.payRates);
    const classSchedules         = useAppStore(s => s.classSchedules);
    const payrollEntries         = useAppStore(s => s.payrollEntries);
    const branches               = useAppStore(s => s.branches);
    // Sources for the categorised commission calc (commission refactor Phase 3).
    const customerTransactions   = useAppStore(s => s.customerTransactions);
    const classBookings          = useAppStore(s => s.classBookings);
    const appointmentBookings    = useAppStore(s => s.appointmentBookings);
    const appointments           = useAppStore(s => s.appointments);
    // Payroll reopened to all staff (Phase 3B) — non-instructor rows resolve
    // to a synthetic Instructor built from their staff record.
    const staff                  = useAppStore(s => s.staff);
    const roles                  = useAppStore(s => s.roles);
    const updateStaff             = useAppStore(s => s.updateStaff);
    const showToast              = useAppStore(s => s.showToast);
    // Country-gated payroll tax UI (see `payrollTaxAppliesForCountry`).
    // False for GCC studios (UAE default) — hides the TaxSuffix line
    // on the earnings card. Read from businessProfile live so a country
    // change in Settings propagates without a refresh.
    const businessCountry        = useAppStore(s => s.businessProfile.country);
    const showPayrollTax         = payrollTaxAppliesForCountry(businessCountry);

    const instructor = useMemo<Instructor | undefined>(() => {
        const real = instructors.find(i => i.id === instructorId);
        if (real) return real;
        // Non-instructor staff (Phase 3B): synthesise an Instructor-shaped
        // record so this page renders their profile + commission. They teach
        // no classes, so the bookings table below is naturally empty.
        const st = staff.find(s => s.id === instructorId);
        if (!st) return undefined;
        return {
            id: st.id,
            name: st.fullName,
            initials: st.initials,
            color: st.color,
            imageUrl: st.imageUrl,
            email: st.email,
            phone: st.phone,
            joinedDate: st.joinedDate,
            branchId: st.branchId ?? "",
            payRateId: st.payRateId,
            status: st.status === "active" ? "active" : "inactive",
        };
    }, [instructors, staff, instructorId]);
    const payRate = useMemo(
        () => instructor?.payRateId ? payRates.find(p => p.id === instructor.payRateId) : undefined,
        [instructor, payRates],
    );

    const [search, setSearch] = useState("");
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [statusFilter, setStatusFilter] = useState<ClassStatusFilter>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [changeRateOpen, setChangeRateOpen] = useState(false);

    useEffect(() => { setPage(1); }, [search, period, statusFilter, instructorId]);

    // Missing instructor → bounce back.
    useEffect(() => {
        if (instructors.length > 0 && !instructor) {
            showToast("Instructor not found", "Returned to the compensation list.", "error");
            router.push(returnTo);
        }
    }, [instructor, instructors, router, returnTo, showToast]);

    if (!instructor) return null;
    // Alias to a definitely-non-null const so closures below narrow cleanly
    // (TS doesn't narrow through closures of `const | undefined` values).
    const ins: Instructor = instructor;

    const branch = branches.find(b => b.id === ins.branchId);
    const range = useMemo(() => dateFilterToRange(period), [period]);

    // Non-instructor staff (Phase 3B synthetic rows) teach no classes — hide
    // the bookings toolbar + table + the "Class taught" metric for them.
    const isRealInstructor = instructors.some(i => i.id === instructorId);

    // Payroll-entry base for the SELECTED period — the class-teaching / salary
    // rollup. Instructors carry entries; non-instructor staff don't.
    const periodEntryEarnings = useMemo(
        () => payrollEntries
            .filter(e => e.instructorId === instructorId && spanInRange(e.periodStart, e.periodEnd, range))
            .reduce((s, e) => s + e.totalEarnings, 0),
        [payrollEntries, instructorId, range],
    );

    // Canonical earnings for the selected period — the SAME helper the
    // compensation list + run payroll use (base pay + sales commission), so the
    // "Total earnings" headline agrees wherever the staff is opened. Renders the
    // commission card only when the pay rate carries commission / bonus rows.
    const periodTotals = useMemo(() => {
        const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const fromISO = iso(range.from), toISO = iso(range.to);
        const staffRow = staff.find(s => s.id === instructorId);
        const tracks = buildPayConfigTracks(staffRow ?? { id: instructorId }, payRates, classSchedules, appointments, fromISO, toISO);
        return totalEarningsForStaff(
            instructorId, payRate, isRealInstructor ? periodEntryEarnings : undefined,
            { transactions: customerTransactions, classBookings, classSchedules, appointmentBookings, appointments },
            fromISO, toISO, tracks,
        );
    }, [instructorId, payRate, payRates, staff, isRealInstructor, periodEntryEarnings, customerTransactions, classBookings, classSchedules, appointmentBookings, appointments, range]);
    const commission = periodTotals.commission;
    const hasCommission = commission.lines.length > 0 || commission.bonusLines.length > 0;

    // ─── Class rows: filter schedules by instructor + period + status ─────
    const instructorSchedules = useMemo(
        () => classSchedules.filter(s => s.instructorId === instructorId),
        [classSchedules, instructorId],
    );

    // Classes-in-month — used by monthly pay rate calculation.
    const completedThisMonth = useMemo(() => {
        const now = new Date();
        const mFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        const mTo   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return instructorSchedules.filter(s =>
            s.status === "Completed" && scheduleInRange(s, { from: mFrom, to: mTo }),
        ).length;
    }, [instructorSchedules]);

    const allRows = useMemo<ClassRow[]>(() => {
        return instructorSchedules
            .filter(s => scheduleInRange(s, range))
            .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
            .map(schedule => ({
                schedule,
                attendees: schedule.booked,
                capacity: schedule.capacity,
                rating: schedule.rating,
                ratingCount: schedule.ratingCount,
                payRateName: payRate?.name ?? "—",
                earnings: earningsForClass(schedule, payRate, completedThisMonth || 1),
            }));
    }, [instructorSchedules, range, payRate, completedThisMonth]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allRows.filter(r => {
            if (statusFilter && r.schedule.status !== statusFilter) return false;
            if (q && !r.schedule.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [allRows, search, statusFilter]);

    // ─── Metric: classes taught in the selected period ────────────────────
    // ("Total earnings" comes from `periodTotals` — the shared base+commission
    // helper — so it matches the compensation list + run payroll exactly.)
    const classesTaught = useMemo(
        () => filteredRows.filter(r => r.schedule.status === "Completed").length,
        [filteredRows],
    );

    // Sidebar "Total earnings this month" + classes-this-month — both pull
    // from `payrollEntries` (the canonical month rollup) so they always
    // reflect the real per-instructor month-to-date data. We can't lean on
    // `completedThisMonth` for the classes count because the `class_schedule`
    // seed dates are static (May 2026) — they'd resolve to 0 every month
    // after May. `payroll_entries.period_start` is computed at load time =
    // current month, so it stays accurate as the demo runs.
    const sidebarThisMonth = useMemo(() => {
        const now = new Date();
        const mFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        const mTo   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const inMonth = payrollEntries
            .filter(e => e.instructorId === instructorId)
            .filter(e => {
                const t = new Date(e.periodStart + "T00:00:00").getTime();
                return t >= mFrom.getTime() && t <= mTo.getTime();
            });
        return {
            earnings: inMonth.reduce((s, e) => s + e.totalEarnings, 0),
            classes:  inMonth.reduce((s, e) => s + e.classesCount,  0),
        };
    }, [payrollEntries, instructorId]);
    const sidebarEntryEarnings = sidebarThisMonth.earnings;
    const sidebarClassesCount  = sidebarThisMonth.classes;

    // Current-month commission for the sidebar's "this month" total. The
    // sidebar is always the calendar month, independent of the period filter
    // that drives the table below. Monthly-rate staff earn commission; every
    // other rate type returns 0.
    const sidebarMonthCommission = useMemo(() => {
        const now = new Date();
        const mFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        const mTo   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return commissionForPeriod(instructorId, payRate, {
            transactions: customerTransactions, classBookings, classSchedules,
            appointmentBookings, appointments,
        }, iso(mFrom), iso(mTo)).totalCommission;
    }, [instructorId, payRate, customerTransactions, classBookings, classSchedules, appointmentBookings, appointments]);

    // "Total earnings this month" — base pay (monthly salary or the entry's
    // class rollup, via the shared helper) plus this month's commission.
    const sidebarMonthly = baseEarningsFor(payRate, sidebarEntryEarnings) + sidebarMonthCommission;

    // ─── Pagination ───────────────────────────────────────────────────────
    // ── Bookings sort — Class name / Attendance / Rating / Status /
    //    Pay rate (no-op since every row shares this pay rate, kept
    //    for header consistency) / Earnings. ──
    const CLASS_STATUS_ORDER: Record<ClassStatus, number> = { Upcoming: 0, Ongoing: 1, Completed: 2, Cancelled: 3 };
    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort(filteredRows, {
        name:       (a, b) => a.schedule.name.localeCompare(b.schedule.name),
        attendance: (a, b) => a.attendees - b.attendees,
        rating:     (a, b) => (a.rating ?? 0) - (b.rating ?? 0),
        status:     (a, b) => CLASS_STATUS_ORDER[a.schedule.status] - CLASS_STATUS_ORDER[b.schedule.status],
        payRate:    () => 0,
        earnings:   (a, b) => a.earnings - b.earnings,
    });

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clamped = Math.min(Math.max(1, page), totalPages);
    const pageRows = sortedRows.slice((clamped - 1) * pageSize, clamped * pageSize);

    // ─── Sidebar pay rate amount (e.g. "AED 147/Class") ───────────────────
    const payRateAmount = (() => {
        if (!payRate) return "—";
        const d = computePayRateDisplay(payRate);
        return `${d.main}/${d.subtitle.replace(/^per /, "")}`;
    })();


    // ─── Actions ──────────────────────────────────────────────────────────
    function handleChangePayRate(config: StaffPayConfig) {
        // Persist the full multi-track config, and keep the canonical
        // `payRateId` in sync with the enabled Default track (falling back to
        // the first enabled track) so the sidebar, payroll list + calc all
        // read the same default rate.
        const newDefaultRateId = config.default.enabled
            ? config.default.payRateId
            : config.perClass.enabled
                ? config.perClass.payRateId
                : config.perAppointment.payRateId;
        updateStaff(instructorId, { payConfig: config, payRateId: newDefaultRateId ?? undefined });
        setChangeRateOpen(false);
        showToast("Pay rate updated", `${ins.name}'s pay configuration was updated.`, "success", "check");
    }

    function handleExportPayout() {
        if (filteredRows.length === 0) {
            showToast("Nothing to export", "No bookings in the current view.", "error");
            return;
        }
        exportPayoutReport(filteredRows, ins, period.label);
        showToast(
            "Compensation data exported successfully",
            "The data has been exported successfully.",
            "success", "check",
        );
    }

    function handleViewClass(scheduleId: string) {
        router.push(`/schedule/${scheduleId}?returnTo=/compensation/${instructorId}`);
    }

    // Deep-links from the Payroll list 3-dots — open the change-pay-rate modal
    // (?changeRate=1) or run the export (?export=1) once on load, so the list
    // offers the same actions as this detail's side panel.
    const deepLinkRan = useRef(false);
    useEffect(() => {
        if (deepLinkRan.current || typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        if (params.get("changeRate") === "1") { deepLinkRan.current = true; setChangeRateOpen(true); }
        else if (params.get("export") === "1") { deepLinkRan.current = true; handleExportPayout(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Staff details</h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* Body — canonical DetailPageShell wraps the 832px frame. */}
            <DetailPageShell
                sidebar={
                    /* LEFT — sidebar */
                    <aside className="w-[320px] shrink-0 h-full bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
                        <div className="px-6 pt-6 pb-4 flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                                <InstructorAvatar instructor={instructor} size={64} />
                                <InstructorStatusBadge status={instructor.status} />
                            </div>
                            <div className="flex flex-col gap-1.5 items-start">
                                <p className="font-semibold text-[20px] leading-[30px] text-[#101828]">{instructor.name}</p>
                                <p className="text-[14px] text-[#667085]">{instructor.email}</p>
                                {/* Staff role — so the role is visible without inferring it
                                    (client 2026-07-28). Reuses the shared RoleBadge. */}
                                {(() => {
                                    const roleRow = roles.find(r => r.id === staff.find(s => s.id === instructor.id)?.roleId);
                                    return roleRow ? <RoleBadge label={roleRow.name} type={roleRow.type} className="mt-0.5" /> : null;
                                })()}
                            </div>
                        </div>

                        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                            <div className="px-6 pb-6 flex flex-col gap-5">
                                <SidebarEarningsCard
                                    totalThisMonth={sidebarMonthly}
                                    // Classes stat is instructor-only; non-
                                    // instructor staff teach nothing, so it's
                                    // omitted for them.
                                    classesCount={isRealInstructor ? sidebarClassesCount : undefined}
                                    classCap={isRealInstructor ? Math.max(10, sidebarClassesCount) : undefined}
                                    payRateAmount={payRateAmount}
                                    branchId={ins.branchId}
                                    showTax={showPayrollTax}
                                />

                                <div className="flex flex-col gap-4">
                                    <SidebarRow label="Joined" value={instructor.joinedDate} />
                                    <SidebarRow label="Email" value={instructor.email} />
                                    <SidebarRow label="Phone" value={instructor.phone} />
                                    <SidebarRow label="Branch location" value={branch?.name ?? "—"} />
                                    <SidebarRow label="Default pay rate" value={payRate?.name ?? "—"} />
                                </div>
                            </div>

                            <div className="px-6 pb-6 shrink-0 mt-auto">
                                <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                                <p className="text-[14px] text-[#667085] mb-4">Pay rate actions</p>
                                <div className="flex flex-col gap-4">
                                    <ActionBtn icon={<Edit02 className="w-5 h-5" />}    label="Change pay rate"      onClick={() => setChangeRateOpen(true)} />
                                    <ActionBtn icon={<Download01 className="w-5 h-5" />} label="Export payout report" onClick={handleExportPayout} />
                                </div>
                            </div>
                        </div>
                    </aside>
                }
                main={
                    /* RIGHT — earnings card */
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-1 border-[#e4e7ec] rounded-[20px]">
                        {/* Tabs — single "Earnings" tab (future tabs land here) */}
                        <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                            <div className="flex gap-1">
                                <span className="h-[48px] px-3 text-[14px] font-semibold border-b-2 border-[#101828] text-[#101828]">
                                    Earnings
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
                            {/* Metric cards */}
                            <div className="px-6 pt-6 flex items-stretch gap-4">
                                <PayRateSnapshotCard payRate={payRate} />
                                <MetricCard
                                    label="Total earnings"
                                    value={aed(periodTotals.total)}
                                    hint="↑ 30% vs last week"
                                    Icon={CheckCircle}
                                />
                                {isRealInstructor && (
                                    <MetricCard
                                        label="Class taught"
                                        value={classesTaught.toString()}
                                        hint="↑ 30% vs last week"
                                        Icon={Users01}
                                    />
                                )}
                            </div>

                            {/* Total earnings breakdown — collapsible (default collapsed).
                                Splits the payout across every earning source: Default
                                salary + Pay per class + Pay per private + Sales commission
                                → Total earnings. Reads the SAME `periodTotals` that drives
                                the headline figure, so the parts always sum to the total.
                                Client 2026-07-28. */}
                            {(periodTotals.trackBreakdown.perClass > 0 || periodTotals.trackBreakdown.perAppointment > 0 || commission.totalCommission > 0) && (
                                <div className="px-6 pt-6">
                                    <PayrollAccordion
                                        title="Total earnings breakdown"
                                        subtitle="All earnings earned so far this month."
                                        value={aed(periodTotals.total)}
                                    >
                                        <div className="flex flex-col gap-2 pt-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[13px] text-[#667085]">Default pay rate</span>
                                                <span className="text-[13px] font-medium text-[#344054]">{aed(periodTotals.trackBreakdown.defaultBase)}</span>
                                            </div>
                                            {periodTotals.trackBreakdown.perClass > 0 && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[13px] text-[#667085]">Pay per class</span>
                                                    <span className="text-[13px] font-medium text-[#344054]">{aed(periodTotals.trackBreakdown.perClass)}</span>
                                                </div>
                                            )}
                                            {periodTotals.trackBreakdown.perAppointment > 0 && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[13px] text-[#667085]">Pay per private</span>
                                                    <span className="text-[13px] font-medium text-[#344054]">{aed(periodTotals.trackBreakdown.perAppointment)}</span>
                                                </div>
                                            )}
                                            {commission.totalCommission > 0 && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[13px] text-[#667085]">Sales commission</span>
                                                    <span className="text-[13px] font-medium text-[#344054]">{aed(commission.totalCommission)}</span>
                                                </div>
                                            )}
                                            <div className="h-px w-full bg-[#e4e7ec]" />
                                            <div className="flex items-center justify-between">
                                                <span className="text-[13px] font-semibold text-[#101828]">Total earnings</span>
                                                <span className="text-[13px] font-semibold text-[#101828]">{aed(periodTotals.total)}</span>
                                            </div>
                                        </div>
                                    </PayrollAccordion>
                                </div>
                            )}

                            {/* Sales commission — same accordion interaction, default
                                collapsed; body reuses the existing commission breakdown
                                layout (embedded, headerless). */}
                            {hasCommission && (
                                <div className="px-6 pt-6">
                                    <PayrollAccordion
                                        title="Sales commission"
                                        subtitle="Earned on sales & bookings credited to this staff in the selected period."
                                        value={aed(commission.totalCommission)}
                                    >
                                        <div className="pt-2">
                                            <SalesCommissionCard commission={commission} embedded />
                                        </div>
                                    </PayrollAccordion>
                                </div>
                            )}

                            {/* Toolbar — instructor-only. Non-instructor staff
                                teach nothing, so the whole bookings toolbar
                                (incl. the period filter) is hidden; their
                                commission card scopes to the current month. */}
                            {isRealInstructor && (
                                <div className="px-6 pt-6 flex items-center gap-3">
                                    <ToolbarTotal count={filteredRows.length} entitySingular="booking" />
                                    <ToolbarSearch
                                        value={search}
                                        onChange={setSearch}
                                        placeholder="Search bookings..."
                                        widthClass="w-[260px]"
                                    />
                                    <DateRangeFilter value={period} onChange={setPeriod} />
                                    <ClassStatusFilterDropdown value={statusFilter} onChange={setStatusFilter} />
                                </div>
                            )}

                            {/* Bookings table — instructor-only (non-instructor
                                staff teach nothing). */}
                            {isRealInstructor && (
                            <div className="px-6 pt-4 flex flex-col">
                                {pageRows.length === 0 ? (
                                    <div className="relative" style={{ minHeight: 360 }}>
                                        <EmptyState
                                            title="No bookings found"
                                            subtitle={instructorSchedules.length === 0
                                                ? "This instructor has no classes assigned yet."
                                                : "Try adjusting your search, period, or status filter."}
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
                                                {pageRows.map(r => (
                                                    <tr key={r.schedule.id}
                                                        onClick={() => handleViewClass(r.schedule.id)}
                                                        className="transition-colors hover:bg-[#f9fafb] cursor-pointer">
                                                        <td className={TD}>
                                                            <div className="flex flex-col">
                                                                <span className="text-[14px] font-medium text-[#101828]">{r.schedule.name}</span>
                                                                <span className="text-[13px] text-[#667085]">
                                                                    {r.schedule.dateISO}, {r.schedule.displayTime}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className={TD}>{r.attendees}/{r.capacity}</td>
                                                        <td className={TD}>
                                                            {r.ratingCount > 0 ? (
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-1">
                                                                        {[0, 1, 2, 3, 4].map(i => (
                                                                            <Star01 key={i}
                                                                                className={cn("w-3.5 h-3.5", i < Math.round(r.rating) ? "text-[#fdb022] fill-[#fdb022]" : "text-[#e4e7ec]")} />
                                                                        ))}
                                                                    </div>
                                                                    <span className="text-[12px] text-[#667085]">
                                                                        {r.rating.toFixed(1)} ({r.ratingCount} ratings)
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[13px] text-[#667085]">No ratings</span>
                                                            )}
                                                        </td>
                                                        <td className={TD}><ClassStatusBadge status={r.schedule.status} /></td>
                                                        <td className={TD}>{r.payRateName}</td>
                                                        <td className={TD}>{r.earnings > 0 ? aed(r.earnings) : "—"}</td>
                                                        <td onClick={e => e.stopPropagation()} className={TD}>
                                                            <RowActions
                                                                minWidth={180}
                                                                items={[{
                                                                    label: "View details",
                                                                    icon: Eye,
                                                                    onClick: () => handleViewClass(r.schedule.id),
                                                                }]}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {pageRows.length > 0 && (
                                    <Pagination
                                        page={clamped} total={sortedRows.length} pageSize={pageSize}
                                        onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                                    />
                                )}
                            </div>
                            )}
                        </div>
                    </div>
                }
            />

            {changeRateOpen && (
                <ChangePayRateModal
                    instructor={instructor}
                    initialConfig={staff.find(s => s.id === instructorId)?.payConfig ?? {
                        default: { enabled: true, payRateId: instructor.payRateId },
                        perClass: { enabled: false },
                        perAppointment: { enabled: false },
                    }}
                    allRates={payRates}
                    onCancel={() => setChangeRateOpen(false)}
                    onConfirm={handleChangePayRate}
                />
            )}

            <Toast />
        </div>
    );
}
