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
    SearchMd, Calendar, CheckCircle, Users01, Star01, Lightbulb02, Check,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { EmptyState } from "@/components/ui/EmptyState";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { dateFilterToRange, isoInRange, spanInRange, type DateRange } from "@/lib/period-filter";
import { earningsForClass, earningsForAppointment, aed, totalEarningsForStaff, buildPayConfigTracks } from "@/lib/payroll-calc";
import { TotalEarningsBreakdown, SalesCommissionAccordion } from "@/components/staff/PayrollEarningsBreakdown";
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
        active:   "bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
        inactive: "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
        archived:  "bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] text-[#344054]",
    };
    const labels = { active: "Active", inactive: "Inactive", archived: "Archive" };
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", styles[status])}>
            {labels[status]}
        </span>
    );
}

// ─── Class status badge (Completed / Cancelled / Upcoming / Ongoing) ───────

type ClassStatus = ClassSchedule["status"];

const CLASS_STATUS_STYLES: Record<ClassStatus, string> = {
    Completed: "bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
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
                            <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#164e52] border-1 border-white" aria-hidden />
                        )}
                    </span>
                </Button>
            </IconTooltip>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-2 min-w-[180px]">
                    {OPTIONS.map(opt => (
                        <button key={opt} type="button"
                            onClick={() => { onChange(value === opt ? null : opt); setOpen(false); }}
                            className={cn(
                                "w-full flex items-center justify-between text-left px-5 py-3 text-[15px] font-medium transition-colors",
                                value === opt ? "bg-[var(--colors-bg-secondary)] text-[#101828]" : "text-[#344054] hover:bg-[var(--colors-bg-secondary)]",
                            )}>
                            {opt}
                            {value === opt && <Check className="w-4 h-4 text-[#164e52]" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Pay rate snapshot metric card (Figma — Default rate / Type) ──────────

// "Pay rate" card — Figma 8035-34947. Header row: "Pay rate" title (left) +
// featured calendar icon (right). Below, two full-width cells split by a vertical
// divider — "Default rate" = the rate NAME, "Rate" = the configured amount. Both
// fall back to "-" when no default pay rate is assigned.
function PayRateSnapshotCard({ payRate }: { payRate: PayRate | undefined }) {
    const display = payRate ? computePayRateDisplay(payRate) : null;
    const rateAmount = display ? `${display.main}/${display.subtitle.replace(/^per /, "")}` : "-";
    const rateName = payRate?.name ?? "-";
    return (
        <div className="flex-[1.5] min-w-0 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] p-5 flex flex-col justify-between gap-5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            {/* Header — title + featured icon */}
            <div className="flex items-start gap-4 w-full">
                <p className="flex-1 min-w-0 text-[16px] font-medium text-[#667085] leading-6">Pay rate</p>
                <div className="w-10 h-10 rounded-full bg-[#f1f2ed] flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-[#475467]" />
                </div>
            </div>
            {/* Default rate | Rate */}
            <div className="flex items-center gap-[18px] w-full">
                <div className="flex-1 min-w-0 flex flex-col">
                    <p className="text-[14px] font-normal text-[#667085] leading-5">Default rate</p>
                    <p className="text-[16px] font-medium text-[#101828] leading-6 truncate">{rateName}</p>
                </div>
                <div className="self-stretch w-px bg-[#e4e7ec] shrink-0" aria-hidden />
                <div className="flex-1 min-w-0 flex flex-col">
                    <p className="text-[14px] font-normal text-[#667085] leading-5">Rate</p>
                    <p className="text-[16px] font-medium text-[#101828] leading-6 truncate">{rateAmount}</p>
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
        <div className="flex-1 min-w-0 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] p-5 flex flex-col gap-2 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] text-[#667085] leading-[20px] flex-1 min-w-0">{label}</p>
                <div className="w-10 h-10 rounded-full bg-[#f1f2ed] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#475467]" />
                </div>
            </div>
            <p className="font-semibold text-[24px] leading-[32px] text-[#101828]">{value}</p>
            {hint && <p className="text-[14px] text-[#164e52] leading-[20px]">{hint}</p>}
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
                value ? "bg-[#164e52] justify-end" : "bg-[var(--colors-bg-tertiary)] justify-start",
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
        <div className={cn("w-full bg-white rounded-[12px] p-4 flex flex-col gap-4", enabled ? "border-2 border-[#457175]" : "border-1 border-[var(--colors-border-secondary)]")}>
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

/** A pay configuration is valid when the Default track is on, OR BOTH
 *  per-booking tracks are on. This single predicate captures every rule:
 *  at-least-one-enabled, no "Pay per class only", no "Pay per private only",
 *  and "disable Default ⇒ both per-booking tracks required" (client 2026-07-29).
 *  Valid: Default · Default+Class · Default+Private · Default+Class+Private ·
 *  Class+Private. Invalid: Class only · Private only · none. */
function isValidPayConfig(c: StaffPayConfig): boolean {
    return c.default.enabled || (c.perClass.enabled && c.perAppointment.enabled);
}

function ChangePayRateModal({ instructor, isInstructor, initialConfig, allRates, onCancel, onConfirm }: {
    instructor: Instructor;
    /** Instructors carry all three tracks; other roles only the Default rate. */
    isInstructor: boolean;
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

    function setTrack<K extends keyof StaffPayConfig>(key: K, patch: Partial<StaffPayConfig[K]>) {
        setCfg(c => ({ ...c, [key]: { ...c[key], ...patch } }));
    }
    // Toggle a track, enforcing the valid-config rules. Disabling Default
    // AUTO-ENABLES both per-booking tracks (an instructor can't be paid on a
    // single booking type); any transition that would still be invalid is
    // rejected (the config stays put).
    function toggleTrack(key: keyof StaffPayConfig, next: boolean) {
        setCfg(c => {
            let updated: StaffPayConfig = { ...c, [key]: { ...c[key], enabled: next } };
            if (key === "default" && !next) {
                updated = {
                    ...updated,
                    perClass:       { ...updated.perClass, enabled: true },
                    perAppointment: { ...updated.perAppointment, enabled: true },
                };
            }
            return isValidPayConfig(updated) ? updated : c;
        });
    }
    // A track's toggle is locked OFF when turning it off would break a rule:
    //  • Default (non-instructor): the only track, must stay on.
    //  • Pay per class / private: while the Default track is off, BOTH must
    //    remain on (else the config collapses to a single booking type).
    const defaultToggleDisabled = !isInstructor;
    const perClassToggleDisabled = cfg.perClass.enabled && !cfg.default.enabled;
    const perApptToggleDisabled  = cfg.perAppointment.enabled && !cfg.default.enabled;

    const canSave = isValidPayConfig(cfg)
        && (!cfg.default.enabled || !!cfg.default.payRateId)
        && (!cfg.perClass.enabled || !!cfg.perClass.payRateId)
        && (!cfg.perAppointment.enabled || !!cfg.perAppointment.payRateId);

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] w-[560px] max-h-[88vh] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onCancel}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1 pt-6 px-6 shrink-0">
                    <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">
                        Change pay rate for &quot;{instructor.name}&quot;
                    </h3>
                    <p className="text-[14px] text-[#475467] leading-[20px]">
                        {isInstructor
                            ? "Update the pay configuration. At least one pay rate must stay enabled — and disabling the Default rate keeps both Pay per class and Pay per private on."
                            : "Update the pay configuration. At least one pay rate must stay enabled."}
                    </p>
                </div>

                <div className="px-6 pt-6 pb-2 flex flex-col gap-4 overflow-y-auto scrollbar-hide">
                    <PayTrackCard title="Default pay rate" subtitle="Provide a base salary for this staff."
                        enabled={cfg.default.enabled} onToggle={n => toggleTrack("default", n)} toggleDisabled={defaultToggleDisabled}
                        rateValue={cfg.default.payRateId ?? ""} rateOptions={options} onRateChange={v => setTrack("default", { payRateId: v })} />
                    {isInstructor && (
                        <>
                            <PayTrackCard title="Pay per class" subtitle="Add compensation for every class taught."
                                enabled={cfg.perClass.enabled} onToggle={n => toggleTrack("perClass", n)} toggleDisabled={perClassToggleDisabled}
                                rateValue={cfg.perClass.payRateId ?? ""} rateOptions={options} onRateChange={v => setTrack("perClass", { payRateId: v })} />
                            <PayTrackCard title="Pay per Private" subtitle="Add compensation for every private session completed."
                                enabled={cfg.perAppointment.enabled} onToggle={n => toggleTrack("perAppointment", n)} toggleDisabled={perApptToggleDisabled}
                                rateValue={cfg.perAppointment.payRateId ?? ""} rateOptions={options} onRateChange={v => setTrack("perAppointment", { payRateId: v })} />
                        </>
                    )}

                    {/* Info banner — bg #f1f2ed warm-cream per Figma 7093-347698 */}
                    <div className="flex gap-3 items-start bg-[#f1f2ed] border-1 border-[var(--colors-border-secondary)] rounded-[12px] px-4 py-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0 mt-[2px]" />
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            The updated pay configuration applies to all future classes and bookings.
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 px-6 pt-4 pb-6 border-t border-[var(--colors-border-secondary)] shrink-0">
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

// Unified booking-history row — a class OR a private appointment. Both feed
// the Total bookings table so the instructor's Class + Private history render
// side by side, each priced on its own configured pay rate (client 2026-07-28).
interface BookingRow {
    kind: "class" | "private";
    id: string;
    name: string;
    dateISO: string;
    displayTime: string;
    status: ClassStatus;
    attendees: number;     // booked count (proxy for attendance until real)
    capacity: number;
    rating: number;
    ratingCount: number;
    payRateName: string;
    earnings: number;
}

// ─── Payroll document export ─────────────────────────────────────────────────
//
// The exported document mirrors Staff Details → Payroll EXACTLY (client
// 2026-07-29): staff identity (name / role / email / branch / default rate) like
// the Run Payroll summary, then the FULL Total earnings breakdown (every enabled
// source — Default pay rate + Pay per class + Pay per private + Sales commission
// → Total earnings), then the per-booking table. The document's Total earnings
// equals the on-screen Total earnings because both read the same `periodTotals`.

interface PayoutExportPayload {
    instructor: Instructor;
    /** Instructors list all three track lines (incl. AED 0); other roles only
     *  the Default pay rate. */
    isInstructor: boolean;
    roleName: string;
    branchName: string;
    defaultRateName: string;
    periodLabel: string;
    /** Total earnings breakdown — same figures the on-screen accordion shows. */
    breakdown: { defaultBase: number; perClass: number; perAppointment: number };
    commissionAed: number;
    totalAed: number;
    rows: BookingRow[];
}

function exportPayoutReport(p: PayoutExportPayload) {
    const escape = (v: string | number) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const row = (cells: (string | number)[]) => cells.map(escape).join(",");
    const round = (n: number) => Math.round(n);

    const lines: string[] = [];

    // ── Section 1 · Staff information (mirrors Run Payroll) ──────────────────
    lines.push(row(["Staff payroll report"]));
    lines.push(row(["Name", p.instructor.name]));
    lines.push(row(["Role", p.roleName]));
    lines.push(row(["Email", p.instructor.email]));
    lines.push(row(["Phone", p.instructor.phone]));
    lines.push(row(["Branch", p.branchName]));
    lines.push(row(["Default pay rate", p.defaultRateName]));
    lines.push(row(["Period", p.periodLabel]));
    lines.push("");

    // ── Section 2 · Total earnings breakdown (every enabled source) ─────────
    lines.push(row(["Total earnings breakdown"]));
    lines.push(row(["Earning source", "Amount (AED)"]));
    if (p.isInstructor) {
        // Every track line — a disabled / empty track reads AED 0, so the
        // document reflects the exact pay-rate configuration.
        lines.push(row(["Default pay rate", round(p.breakdown.defaultBase)]));
        lines.push(row(["Pay per class", round(p.breakdown.perClass)]));
        lines.push(row(["Pay per private", round(p.breakdown.perAppointment)]));
    } else if (p.breakdown.defaultBase > 0) {
        lines.push(row(["Default pay rate", round(p.breakdown.defaultBase)]));
    }
    if (p.commissionAed > 0) lines.push(row(["Sales commission", round(p.commissionAed)]));
    lines.push(row(["Total earnings", round(p.totalAed)]));
    lines.push("");

    // ── Section 3 · Bookings ────────────────────────────────────────────────
    lines.push(row(["Bookings"]));
    lines.push(row(["Date", "Booking", "Type", "Attendance", "Rating", "Status", "Pay rate", "Earnings (AED)"]));
    for (const r of p.rows) {
        lines.push(row([
            r.dateISO + " " + r.displayTime,
            r.name,
            r.kind === "class" ? "Class" : "Private",
            `${r.attendees}/${r.capacity}`,
            r.ratingCount > 0 ? `${r.rating.toFixed(1)} (${r.ratingCount})` : "—",
            r.status,
            r.payRateName,
            r.status === "Cancelled" ? 0 : round(r.earnings),
        ]));
    }

    const csv = lines.join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    const slug = p.instructor.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    a.download = `payout-${slug}-${p.periodLabel.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

// The "Total earnings breakdown" + "Sales commission" accordions now live in
// the shared `PayrollEarningsBreakdown` module so the Admin Staff Payroll
// Details page and the Instructor "My Earnings" page render the exact same
// component (client 2026-07-29).

// ─── Sidebar earnings summary (Figma — Total earnings this month card) ────

function SidebarEarningsCard({ totalThisMonth, classesCount, classCap, defaultRateName, branchId, showTax }: {
    totalThisMonth: number;
    /** Classes taught this month + the progress-bar cap. Only passed for real
     *  instructors — non-instructor staff teach nothing, so the whole
     *  Classes stat + progress bar is omitted for them. */
    classesCount?: number;
    classCap?: number;
    /** Branch context for the pay_rate tax-suffix lookup. */
    branchId: string;
    /** Default pay rate NAME (e.g. "Monthly Rate") — the side menu shows the
     *  rate name, NOT the amount (client 2026-07-29). "-" when none. */
    defaultRateName: string;
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
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <p className="text-[13px] text-[#667085] leading-[18px]">Total earnings this month</p>
                <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">{aed(totalThisMonth)}</p>
                {showTax && <TaxSuffix category="pay_rate" branchId={branchId} />}
            </div>
            {showClasses ? (
                <>
                    <div className="w-full h-1.5 rounded-full bg-[#e4e7ec] overflow-hidden">
                        <div className="h-full bg-[#164e52]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                            <p className="text-[12px] text-[#667085]">Classes</p>
                            <p className="text-[13px] font-medium text-[#344054]">{classesCount}/{classCap} classes</p>
                        </div>
                        <div className="flex flex-col gap-1 text-right">
                            <p className="text-[12px] text-[#667085]">Default pay rate</p>
                            <p className="text-[13px] font-medium text-[#344054]">{defaultRateName}</p>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="h-px w-full bg-[#e4e7ec]" />
                    <div className="flex flex-col gap-1">
                        <p className="text-[12px] text-[#667085]">Default pay rate</p>
                        <p className="text-[13px] font-medium text-[#344054]">{defaultRateName}</p>
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

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#475467] sticky top-0 z-[5] bg-white shadow-[inset_0_-1px_0_0_var(--colors-border-secondary)]";
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
    const issuedGiftCards        = useAppStore(s => s.issuedGiftCards);
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
    // Staff role — resolved once, reused for the "Role" sidebar row (client
    // 2026-07-28). Reuses the shared RoleBadge; no bespoke pill.
    const roleRow = roles.find(r => r.id === staff.find(s => s.id === ins.id)?.roleId);
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
            { transactions: customerTransactions, classBookings, classSchedules, appointmentBookings, appointments, issuedGiftCards },
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

    // Effective per-track pay rates from the staff's pay config.
    const { classRate, privateRate } = useMemo(() => {
        const cfg = staff.find(s => s.id === instructorId)?.payConfig;
        const rateById = (id?: string) => (id ? payRates.find(p => p.id === id) : undefined);
        // The Total Bookings table shows ONLY per-booking earnings. The Default
        // pay rate is a fixed salary (not earned per booking) — it never prices
        // a booking. So a class booking gets a rate + earnings ONLY when Pay per
        // class is enabled; a private booking ONLY when Pay per private is
        // enabled. When a booking type's track is off, its rate is "—" and its
        // earnings AED 0 (the salary shows only under Total earnings breakdown).
        // Client 2026-07-29.
        return {
            classRate:   cfg?.perClass.enabled       ? rateById(cfg.perClass.payRateId)       : undefined,
            privateRate: cfg?.perAppointment.enabled  ? rateById(cfg.perAppointment.payRateId) : undefined,
        };
    }, [staff, instructorId, payRates]);

    // This instructor's PRIVATE appointments — Pay-per-private counts private
    // sessions only (recovery / open sessions are a different track — see
    // buildPayConfigTracks).
    const instructorAppointments = useMemo(
        () => appointments.filter(a => a.instructorId === instructorId && a.type === "private"),
        [appointments, instructorId],
    );

    // Booking history = Completed / Ongoing / Cancelled class + private bookings.
    // Upcoming bookings are excluded from Staff Earnings (client 2026-07-28).
    const allRows = useMemo<BookingRow[]>(() => {
        const classRows: BookingRow[] = instructorSchedules
            .filter(s => scheduleInRange(s, range) && s.status !== "Upcoming")
            .map(s => ({
                kind: "class",
                id: s.id,
                name: s.name,
                dateISO: s.dateISO,
                displayTime: s.displayTime,
                status: s.status,
                attendees: s.booked,
                capacity: s.capacity,
                rating: s.rating,
                ratingCount: s.ratingCount,
                payRateName: classRate?.name ?? "—",
                earnings: s.status === "Cancelled" ? 0 : earningsForClass(s, classRate, completedThisMonth || 1),
            }));
        const privateRows: BookingRow[] = instructorAppointments
            .filter(a => isoInRange(a.dateISO, range) && a.status !== "Upcoming")
            .map(a => ({
                kind: "private",
                id: a.id,
                name: a.serviceName,
                dateISO: a.dateISO,
                displayTime: a.displayTime,
                status: a.status,
                attendees: a.booked,
                capacity: a.capacity,
                rating: a.rating,
                ratingCount: a.ratingCount,
                payRateName: privateRate?.name ?? "—",
                earnings: a.status === "Cancelled" ? 0 : earningsForAppointment(a, privateRate),
            }));
        return [...classRows, ...privateRows].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    }, [instructorSchedules, instructorAppointments, range, classRate, privateRate, completedThisMonth]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allRows.filter(r => {
            if (statusFilter && r.status !== statusFilter) return false;
            if (q && !r.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [allRows, search, statusFilter]);

    // ─── Metric: classes taught in the selected period ────────────────────
    // ("Total earnings" comes from `periodTotals` — the shared base+commission
    // helper — so it matches the compensation list + run payroll exactly.)
    const classesTaught = useMemo(
        () => filteredRows.filter(r => r.kind === "class" && r.status === "Completed").length,
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
            entryEarnings: inMonth.reduce((s, e) => s + e.totalEarnings, 0),
            classes:       inMonth.reduce((s, e) => s + e.classesCount,  0),
        };
    }, [payrollEntries, instructorId]);
    const sidebarClassesCount = sidebarThisMonth.classes;

    // "Total earnings this month" — the SAME base(all tracks)+commission calc
    // as the metric card + Total earnings breakdown, scoped to the current
    // calendar month. Previously the sidebar summed only the Default base +
    // commission and dropped the Pay-per-class + Pay-per-private tracks, so it
    // disagreed with the "Total earnings" shown everywhere else. Routing it
    // through `totalEarningsForStaff` (with the month's pay-config tracks) makes
    // the figure consistent (client 2026-07-28).
    const sidebarMonthly = useMemo(() => {
        const now = new Date();
        const mFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        const mTo   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const fromISO = iso(mFrom), toISO = iso(mTo);
        const staffRow = staff.find(s => s.id === instructorId);
        const tracks = buildPayConfigTracks(staffRow ?? { id: instructorId }, payRates, classSchedules, appointments, fromISO, toISO);
        return totalEarningsForStaff(
            instructorId, payRate, isRealInstructor ? sidebarThisMonth.entryEarnings : undefined,
            { transactions: customerTransactions, classBookings, classSchedules, appointmentBookings, appointments, issuedGiftCards },
            fromISO, toISO, tracks,
        ).total;
    }, [instructorId, payRate, payRates, staff, isRealInstructor, sidebarThisMonth.entryEarnings, customerTransactions, classBookings, classSchedules, appointmentBookings, appointments]);

    // ─── Pagination ───────────────────────────────────────────────────────
    // ── Bookings sort — Class name / Attendance / Rating / Status /
    //    Pay rate (no-op since every row shares this pay rate, kept
    //    for header consistency) / Earnings. ──
    const CLASS_STATUS_ORDER: Record<ClassStatus, number> = { Upcoming: 0, Ongoing: 1, Completed: 2, Cancelled: 3 };
    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort(filteredRows, {
        name:       (a, b) => a.name.localeCompare(b.name),
        attendance: (a, b) => a.attendees - b.attendees,
        rating:     (a, b) => (a.rating ?? 0) - (b.rating ?? 0),
        status:     (a, b) => CLASS_STATUS_ORDER[a.status] - CLASS_STATUS_ORDER[b.status],
        payRate:    (a, b) => a.payRateName.localeCompare(b.payRateName),
        earnings:   (a, b) => a.earnings - b.earnings,
    });

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clamped = Math.min(Math.max(1, page), totalPages);
    const pageRows = sortedRows.slice((clamped - 1) * pageSize, clamped * pageSize);

    // Default pay rate NAME for the side menu (e.g. "Monthly Rate") — the side
    // menu shows the rate name, not the amount. "-" when no default rate.
    const defaultRateName = payRate?.name ?? "-";

    // ─── Actions ──────────────────────────────────────────────────────────
    function handleChangePayRate(config: StaffPayConfig) {
        // Persist the full multi-track config, and keep the canonical
        // `payRateId` in sync with the enabled Default track (falling back to
        // the first enabled track) so the sidebar, payroll list + calc all
        // read the same default rate.
        // Keep the canonical `payRateId` on the Default track's configured rate
        // (even if the Default track is toggled off) so the "Default pay rate"
        // label + sales-commission source stay stable; fall back to an enabled
        // per-booking rate only if the Default track has no rate assigned.
        const newDefaultRateId = config.default.payRateId
            ?? (config.perClass.enabled ? config.perClass.payRateId : config.perAppointment.payRateId);
        updateStaff(instructorId, { payConfig: config, payRateId: newDefaultRateId ?? undefined });
        setChangeRateOpen(false);
        showToast("Pay rate updated", `${ins.name}'s pay configuration was updated.`, "success", "check");
    }

    function handleExportPayout() {
        if (filteredRows.length === 0) {
            showToast("Nothing to export", "No bookings in the current view.", "error");
            return;
        }
        // Default pay rate name = the Default TRACK's configured rate (what the
        // breakdown treats as "Default pay rate"), so the document's identity
        // block matches Run Payroll even if the Default base is toggled off.
        const cfg = staff.find(s => s.id === instructorId)?.payConfig;
        const defaultRateName =
            (cfg ? payRates.find(p => p.id === cfg.default.payRateId)?.name : payRate?.name) ?? "—";
        exportPayoutReport({
            instructor: ins,
            isInstructor: isRealInstructor,
            roleName: roleRow?.name ?? "—",
            branchName: branch?.name ?? "—",
            defaultRateName,
            periodLabel: period.label,
            breakdown: {
                defaultBase:    periodTotals.trackBreakdown.defaultBase,
                perClass:       periodTotals.trackBreakdown.perClass,
                perAppointment: periodTotals.trackBreakdown.perAppointment,
            },
            commissionAed: commission.totalCommission,
            totalAed: periodTotals.total,
            rows: filteredRows,
        });
        showToast(
            "Compensation data exported successfully",
            "The data has been exported successfully.",
            "success", "check",
        );
    }

    function handleViewBooking(row: BookingRow) {
        const rt = `?returnTo=/compensation/${instructorId}`;
        router.push(row.kind === "class" ? `/schedule/${row.id}${rt}` : `/appointments/${row.id}${rt}`);
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
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors shrink-0">
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
                    <aside className="w-[320px] shrink-0 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col overflow-hidden">
                        <div className="px-6 pt-6 pb-4 flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                                <InstructorAvatar instructor={instructor} size={64} />
                                <InstructorStatusBadge status={instructor.status} />
                            </div>
                            <div className="flex flex-col gap-1.5 items-start">
                                <p className="font-semibold text-[20px] leading-[30px] text-[#101828]">{instructor.name}</p>
                                <p className="text-[14px] text-[#667085]">{instructor.email}</p>
                            </div>
                        </div>

                        <div className="flex flex-col flex-1">
                            <div className="px-6 pb-6 flex flex-col gap-5">
                                <SidebarEarningsCard
                                    totalThisMonth={sidebarMonthly}
                                    // Classes stat is instructor-only; non-
                                    // instructor staff teach nothing, so it's
                                    // omitted for them.
                                    classesCount={isRealInstructor ? sidebarClassesCount : undefined}
                                    classCap={isRealInstructor ? Math.max(10, sidebarClassesCount) : undefined}
                                    defaultRateName={defaultRateName}
                                    branchId={ins.branchId}
                                    showTax={showPayrollTax}
                                />

                                <div className="flex flex-col gap-4">
                                    <SidebarRow label="Joined" value={instructor.joinedDate} />
                                    <SidebarRow label="Phone" value={instructor.phone} />
                                    {/* Role — the badge lives here now (moved out of the
                                        header). Reuses the shared RoleBadge. */}
                                    {roleRow && (
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[13px] text-[#667085] leading-[18px]">Role</p>
                                            <div className="flex"><RoleBadge label={roleRow.name} type={roleRow.type} /></div>
                                        </div>
                                    )}
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
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-1 border-[var(--colors-border-secondary)] rounded-[20px]">
                        {/* Tabs — single "Earnings" tab (future tabs land here) */}
                        <div className="shrink-0 border-b border-[var(--colors-border-secondary)] px-6 pt-6">
                            <div className="flex gap-1">
                                <span className="h-[48px] px-3 text-[14px] font-semibold border-b-2 border-[#101828] text-[#101828]">
                                    Earnings
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
                            {/* Metric cards */}
                            <div className="px-6 pt-4 flex items-stretch gap-4">
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
                                Splits the payout across every ENABLED earning source:
                                Default salary + Pay per class + Pay per private + Sales
                                commission → Total earnings. Each line shows only when its
                                track contributes (> 0), so disabling a track in the pay
                                config immediately drops its line and the total reflows.
                                Reads the SAME `periodTotals` that drives the headline
                                figure, so the parts always sum to the total. Shown whenever
                                there are any earnings (client 2026-07-29). */}
                            {periodTotals.total > 0 && (
                                <div className="px-6 pt-4">
                                    <TotalEarningsBreakdown
                                        trackBreakdown={periodTotals.trackBreakdown}
                                        commissionAed={commission.totalCommission}
                                        total={periodTotals.total}
                                        isInstructor={isRealInstructor}
                                    />
                                </div>
                            )}

                            {/* Sales commission — shared accordion, default collapsed. */}
                            {hasCommission && (
                                <div className="px-6 pt-4">
                                    <SalesCommissionAccordion commission={commission} />
                                </div>
                            )}

                            {/* Toolbar — instructor-only. Non-instructor staff
                                teach nothing, so the whole bookings toolbar
                                (incl. the period filter) is hidden; their
                                commission card scopes to the current month. */}
                            {isRealInstructor && (
                                <div className="px-6 pt-4 flex items-center gap-3">
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
                                            subtitle={instructorSchedules.length === 0 && instructorAppointments.length === 0
                                                ? "This instructor has no bookings assigned yet."
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
                                                    <tr key={`${r.kind}-${r.id}`}
                                                        onClick={() => handleViewBooking(r)}
                                                        className="transition-colors hover:bg-[var(--colors-bg-secondary)] cursor-pointer">
                                                        <td className={TD}>
                                                            <div className="flex flex-col">
                                                                <span className="text-[14px] font-medium text-[#101828]">{r.name}</span>
                                                                <span className="text-[13px] text-[#667085]">
                                                                    {r.dateISO}, {r.displayTime}
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
                                                        <td className={TD}><ClassStatusBadge status={r.status} /></td>
                                                        <td className={TD}>{r.payRateName}</td>
                                                        <td className={TD}>
                                                            {/* No per-booking rate (that track is off) OR cancelled
                                                                → AED 0. Otherwise the calculated per-booking earning;
                                                                a not-yet-completed booking shows "—" (pending). */}
                                                            {r.payRateName === "—" || r.status === "Cancelled"
                                                                ? aed(0)
                                                                : r.earnings > 0 ? aed(r.earnings) : "—"}
                                                        </td>
                                                        <td onClick={e => e.stopPropagation()} className={TD}>
                                                            <RowActions
                                                                minWidth={180}
                                                                items={[{
                                                                    label: "View details",
                                                                    icon: Eye,
                                                                    onClick: () => handleViewBooking(r),
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
                    isInstructor={isRealInstructor}
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
