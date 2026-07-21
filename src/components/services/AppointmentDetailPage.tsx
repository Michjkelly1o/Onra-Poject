"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Appointment Detail (Module 13, Phase 4)
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors the Class Schedule detail chrome (header + 2-column body) — left
// info card, right tabbed roster. Per the brief: "This details is basically
// same like class details, which have status, completed, cancelled,
// upcoming more than 24hrs and under 24hrs, ongoing."
//
// TABS
//   • Booked    — every customer whose booking is still active (Booked /
//                 Attended / NoShow rows). Sortable + bulk select.
//   • Cancelled — every customer whose booking was cancelled, plus the
//                 whole roster when the appointment itself is Cancelled
//                 (cascaded via cancelAppointment).
//
// ROW ACTIONS — status × service-type matrix:
//
//                       OPEN SESSION                        PRIVATE
//   Upcoming            Cancel customer · Remove customer   (none — single customer)
//   Ongoing             Present (inline button in row)      Present (inline button in row)
//   Completed           (none — retrospective badges only)  (none)
//   Cancelled           (none)                              (none)
//
// A no-show is auto-flagged by the system — no explicit button. When the
// system flags one the Status column renders a NoShowBadge in place of
// the inline Present button.
//
// Bulk-action bar appears on the Booked tab for Open session whenever ≥1
// row is selected — actions match the per-row matrix above for the
// current status. Private appointments hide the checkbox column entirely
// since there's only ever one customer.

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, SlashCircle01, Trash01, Trash02, Trash04, Check, CheckCircle,
    SearchMd, Eye, AlignLeft, ChevronLeft, RefreshCcw01, Star01,
    FilterLines,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { branchTzLabel } from "@/lib/branch-time";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { TableAvatar } from "@/components/ui/avatar";
import { PresentBadge, NoShowBadge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/DatePicker";
import { useAppStore, type Appointment, type AppointmentStatus, type AppointmentBooking, type AppointmentRating } from "@/lib/store";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { RowActions } from "@/components/patterns/RowActions";
import { DetailPageShell } from "@/components/patterns/DetailPageShell";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { AppointmentCustomerBadges } from "@/components/customers/CustomerBadges";

// ─── Table constants ─────────────────────────────────────────────────────────

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

function CheckboxCell({ checked, onChange, indeterminate = false, ariaLabel }: {
    checked: boolean; onChange: (next: boolean) => void; indeterminate?: boolean; ariaLabel: string;
}) {
    return (
        <button type="button" role="checkbox" aria-label={ariaLabel} aria-checked={indeterminate ? "mixed" : checked}
            onClick={() => onChange(!checked)}
            className={cn(
                "w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors shrink-0",
                (checked || indeterminate)
                    ? "bg-[#658774] border-[#658774] text-white"
                    : "bg-white border-[#d0d5dd] hover:border-[#7ba08c]",
            )}>
            {indeterminate ? <span className="block w-2 h-[1.5px] bg-white" />
                : checked ? <Check className="w-3 h-3" /> : null}
        </button>
    );
}

// ─── Toggle (DS-standard sage on/off, mirrors class schedule's Toggle) ─────

function Toggle({ on, onChange, disabled = false }: { on: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-disabled={disabled} disabled={disabled}
            onClick={() => !disabled && onChange(!on)}
            className={cn(
                "relative w-9 h-5 rounded-full p-0.5 flex items-center transition-colors shrink-0",
                on ? "bg-[#658774] justify-end" : "bg-[#f2f4f7] justify-start",
                disabled && "opacity-60 cursor-not-allowed",
            )}>
            <span className="w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]" />
        </button>
    );
}

// ─── Cancel appointment modal (refund toggle locked ON, no reason) ──────────
//
// Mirrors `CancelClassModal` 1:1 from the class schedule detail page — same
// header copy + booked-count line + "Refund class credit" locked toggle +
// destructive "Yes, cancel appointment" confirm.

function CancelAppointmentModal({ appointment, onConfirm, onCancel }: {
    appointment: Appointment;
    onConfirm: (refund: boolean) => void;
    onCancel: () => void;
}) {
    const bookedCount = appointment.booked;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onCancel}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#fee4e2] flex items-center justify-center shrink-0">
                        <SlashCircle01 className="w-6 h-6 text-[#d92d20]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Cancel this appointment?</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            <span className="font-medium text-[#344054]">{appointment.serviceName}</span> on {appointment.date} • {appointment.displayTime} will be cancelled.
                            {bookedCount > 0 && <> All <span className="font-medium text-[#344054]">{bookedCount} booked customer{bookedCount === 1 ? "" : "s"}</span> will be notified.</>}
                        </p>
                    </div>
                </div>
                {bookedCount > 0 && (
                    <>
                        <div className="h-5 shrink-0" />
                        <div className="h-px w-full bg-[#e4e7ec]" />
                        <div className="flex items-center justify-between gap-4 px-6 py-5">
                            <div className="flex flex-col gap-1 min-w-0">
                                <p className="text-[16px] font-medium text-[#101828]">Refund class credit</p>
                                <p className="text-[14px] text-[#475467] leading-[20px]">When the studio cancels an appointment, each customer is always refunded.</p>
                            </div>
                            {/* Locked ON — admin cancellation always grants a no-charge refund. */}
                            <Toggle on={true} onChange={() => { /* locked */ }} disabled />
                        </div>
                    </>
                )}
                <div className={cn("flex gap-3 px-6 pb-6", bookedCount > 0 ? "pt-6" : "pt-5")}>
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>Cancel</Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={() => onConfirm(true)}>
                        Yes, cancel appointment
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Cancel booking modal (refund toggle, mirrors CancelBookingModal) ──────

function CancelBookingModal({ open, count, sampleName, onClose, onConfirm }: {
    open: boolean;
    count: number;
    sampleName: string;
    onClose: () => void;
    onConfirm: (refund: boolean) => void;
}) {
    const [refund, setRefund] = useState(true);
    useEffect(() => { if (open) setRefund(true); }, [open]);
    if (!open) return null;
    const isBulk = count > 1;
    const title = isBulk ? `Cancel ${count} customers from the appointment?` : "Cancel this customer from the appointment?";
    const desc = isBulk
        ? "Are you sure you want to cancel these customers from the booked appointment? This action cannot be undone."
        : "Are you sure you want to cancel this customer from the booked appointment? This action cannot be undone.";
    const refundDesc = isBulk
        ? "Each customer's class session will be refunded after cancellation."
        : "The customer's class session will be refunded after cancellation.";
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onClose}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#fee4e2] flex items-center justify-center shrink-0">
                        <SlashCircle01 className="w-6 h-6 text-[#d92d20]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            {!isBulk && sampleName
                                ? <>Are you sure you want to cancel <span className="font-medium text-[#344054]">{sampleName}</span> from the booked appointment? This action cannot be undone.</>
                                : desc}
                        </p>
                    </div>
                </div>
                <div className="h-5 shrink-0" />
                <div className="h-px w-full bg-[#e4e7ec]" />
                <div className="flex items-center justify-between gap-4 px-6 py-5">
                    <div className="flex flex-col gap-1 min-w-0">
                        <p className="text-[16px] font-medium text-[#101828]">Refund class session</p>
                        <p className="text-[14px] text-[#475467] leading-[20px]">{refundDesc}</p>
                    </div>
                    <Toggle on={refund} onChange={setRefund} />
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={() => onConfirm(refund)}>
                        Yes, cancel booking
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Remove booking modal (refund toggle, mirrors RemoveBookingModal) ──────

function RemoveBookingModal({ open, count, sampleName, onClose, onConfirm }: {
    open: boolean;
    count: number;
    sampleName: string;
    onClose: () => void;
    onConfirm: (refund: boolean) => void;
}) {
    const [refund, setRefund] = useState(true);
    useEffect(() => { if (open) setRefund(true); }, [open]);
    if (!open) return null;
    const isBulk = count > 1;
    const title = isBulk ? `Remove ${count} customers from the appointment?` : "Remove this customer from the appointment?";
    const desc = isBulk
        ? "Are you sure you want to remove these customers from the booked appointment? This action cannot be undone."
        : sampleName ? null : "Are you sure you want to remove this customer from the booked appointment? This action cannot be undone.";
    const refundDesc = isBulk
        ? "Each customer's class session will be refunded after removal."
        : "The customer's class session will be refunded after removal.";
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onClose}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#fee4e2] flex items-center justify-center shrink-0">
                        <Trash02 className="w-6 h-6 text-[#d92d20]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            {!isBulk && sampleName
                                ? <>Are you sure you want to remove <span className="font-medium text-[#344054]">{sampleName}</span> from the booked appointment? This action cannot be undone.</>
                                : desc}
                        </p>
                    </div>
                </div>
                <div className="h-5 shrink-0" />
                <div className="h-px w-full bg-[#e4e7ec]" />
                <div className="flex items-center justify-between gap-4 px-6 py-5">
                    <div className="flex flex-col gap-1 min-w-0">
                        <p className="text-[16px] font-medium text-[#101828]">Refund class session</p>
                        <p className="text-[14px] text-[#475467] leading-[20px]">{refundDesc}</p>
                    </div>
                    <Toggle on={refund} onChange={setRefund} />
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={() => onConfirm(refund)}>
                        Yes, remove booking
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Delete review modal (simple confirm — mirrors class schedule) ─────────

function DeleteReviewModal({ open, count, sampleName, onClose, onConfirm }: {
    open: boolean;
    count: number;
    sampleName: string;
    onClose: () => void;
    onConfirm: () => void;
}) {
    if (!open) return null;
    const isBulk = count > 1;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onClose}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#fee4e2] flex items-center justify-center shrink-0">
                        <Trash02 className="w-6 h-6 text-[#d92d20]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">
                            {isBulk ? `Delete ${count} reviews?` : "Delete this review?"}
                        </h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            {isBulk
                                ? "These reviews will be hidden from the appointment page and moved to the deletion log."
                                : <>The review from <span className="font-medium text-[#344054]">{sampleName}</span> will be hidden from the appointment page and moved to the deletion log.</>}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={onConfirm}>
                        Yes, delete
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Roster row actions ─────────────────────────────────────────────────────

type RowActionKind = "cancel" | "remove" | "present";

// ─── Inline Present button — mirrors the class detail
//     ([/schedule/[classId]/page.tsx](src/app/schedule/[classId]/page.tsx)) +
//     instructor variant ([/class/[classId]/page.tsx](src/app/class/[classId]/page.tsx#L344)).
//
// Renders in the Status column for Ongoing roster rows that haven't been
// marked yet. Same DS `secondary-gray` chrome + `#067647` green
// text/icon + `#ecfdf3` hover tint as the bulk "Mark present" button —
// one attendance language across every detail page. Clicking flips the
// cell to a `PresentBadge`. A no-show is auto-flagged by the system —
// no explicit button.

function PresentButton({ onClick }: { onClick: () => void }) {
    return (
        <Button
            variant="secondary-gray"
            size="sm"
            onClick={onClick}
            className="text-[#067647] hover:text-[#067647] hover:bg-[#ecfdf3]"
            leftIcon={<CheckCircle className="w-4 h-4 text-[#067647]" />}
        >
            Present
        </Button>
    );
}

// ─── Bulk action bar (Open session only) ────────────────────────────────────

function BulkActionBar({ count, kind, onClear, onAction }: {
    count: number;
    kind: "upcoming" | "ongoing" | "reviews";
    onClear: () => void;
    onAction: (action: RowActionKind | "delete-review") => void;
}) {
    if (count === 0) return null;
    return (
        <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
            <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-[600px] max-w-full">
                <button type="button" onClick={onClear}
                    className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors whitespace-nowrap shrink-0">
                    {count} selected<XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex items-center gap-3">
                    {kind === "ongoing" && (
                        // Per the brief: Ongoing exposes ONLY Mark present (no
                        // bulk No-show — the class schedule has the same single-
                        // action bulk bar on Ongoing).
                        <Button variant="secondary-gray" size="sm"
                            className="text-[#067647] hover:text-[#067647] hover:bg-[#ecfdf3]"
                            leftIcon={<Check className="w-5 h-5 text-[#067647]" />}
                            onClick={() => onAction("present")}>
                            Mark present
                        </Button>
                    )}
                    {kind === "upcoming" && (
                        <>
                            <Button variant="secondary-gray" size="sm"
                                leftIcon={<SlashCircle01 className="w-5 h-5 text-[#667085]" />}
                                onClick={() => onAction("cancel")}>
                                Cancel
                            </Button>
                            <Button variant="secondary-gray" size="sm"
                                className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />}
                                onClick={() => onAction("remove")}>
                                Remove
                            </Button>
                        </>
                    )}
                    {kind === "reviews" && (
                        <Button variant="secondary-gray" size="sm"
                            className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                            leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />}
                            onClick={() => onAction("delete-review")}>
                            Delete review
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Rating summary (Completed / Cancelled appointments) ────────────────────
//
// Mirrors `RatingSummary` from /schedule/[classId] — replaces the action
// footer when the appointment is past, so the admin can read the
// aggregate at a glance.

function RatingSummary({ rating, count }: { rating: number; count: number }) {
    const filled = Math.round(rating);
    return (
        <div className="px-6 pb-6 shrink-0">
            <div className="h-px w-full bg-[#e4e7ec] mb-5" />
            <p className="text-[14px] text-[#667085] mb-3">Rating summary</p>
            <div className="flex flex-col gap-1">
                <div className="flex gap-1 items-center">
                    {[0, 1, 2, 3, 4].map(i => (
                        <Star01 key={i}
                            className={cn("w-8 h-8", i < filled ? "text-[#fdb022]" : "text-[#e4e7ec]")}
                            fill={i < filled ? "#fdb022" : "none"} />
                    ))}
                </div>
                <div className="flex gap-1 items-center">
                    <p className="font-semibold text-[24px] leading-[32px] text-[#101828]">{rating > 0 ? rating.toFixed(1) : "0"}</p>
                    <p className="text-[14px] text-[#667085]">({count} {count === 1 ? "rating" : "ratings"})</p>
                </div>
            </div>
        </div>
    );
}

// ─── Left panel — info card ─────────────────────────────────────────────────

function LeftPanel({ appointment, onCancelAppointment }: {
    appointment: Appointment;
    onCancelAppointment: () => void;
}) {
    const isUpcoming  = appointment.status === "Upcoming";
    const isOngoing   = appointment.status === "Ongoing";
    const isCompleted = appointment.status === "Completed";
    const isCancelled = appointment.status === "Cancelled";
    // Edit is intentionally NOT exposed — appointments are created by the
    // customer (self-booking) and admins can only cancel, not edit.
    const canCancel   = isUpcoming || isOngoing;
    // Rating summary replaces the action footer once the appointment is
    // past — same swap as the class schedule detail page.
    const showRatingSummary = isCompleted || isCancelled;
    // Parent service lookup — appointments don't denormalize price /
    // duration / isRecovery (Phase 1 kept the appointment shape lean).
    // Reading the live service slice gives the side panel current values
    // even if the admin edits the service in another tab while the
    // appointment is open. Falls back gracefully if the service was
    // deleted (rare — the cascade should prevent it).
    const service = useAppStore(s => s.services).find(s => s.id === appointment.serviceId);
    const durationMin = service?.durationMin ?? 0;
    // Read the appointment's own session type (inherited from its service).
    const isRecovery  = appointment.type === "recovery";
    const price       = service?.price ?? 0;
    // Resolve the appointment's branch so we can tag the wall-clock time
    // with the branch's own TZ. Same pattern as the class detail page.
    const branch = useAppStore(s => s.branches).find(b => b.id === appointment.branchId);
    const branchTzShort = branch ? branchTzLabel(branch) : undefined;

    return (
        <div className="w-[320px] shrink-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden h-full">
            {/* Banner */}
            <div className="relative h-[200px] shrink-0 overflow-hidden" style={{ backgroundColor: appointment.coverColor || "#f1f2ed" }}>
                {appointment.coverImage && (
                    <img src={appointment.coverImage} alt={appointment.serviceName}
                        className={cn("absolute inset-0 w-full h-full object-cover", appointment.status === "Cancelled" && "grayscale")}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                )}
                <div className="absolute top-3 right-3">
                    <StatusBadge type="appointment" status={appointment.status} />
                </div>
            </div>

            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    <div>
                        <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{appointment.serviceName}</h2>
                        <p className="text-[14px] text-[#667085] leading-[20px] mt-1">{appointment.openSession ? "Open session" : "Private session"}</p>
                    </div>

                    {/* Field order per Figma 7617:132516 (open session) +
                        7456:100178 (private session):
                          Date & time → Service category → Duration →
                          Location → Recovery condition → Open sessions
                          (recovery only) → Fixed price → Instructor
                          (private only) → Attendance (existing, kept). */}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Date &amp; time</p>
                            <p className="text-[16px] font-medium text-[#101828]">{appointment.date}</p>
                            <p className="text-[14px] text-[#475467]">{appointment.displayTime}</p>
                            {branchTzShort && (
                                <p className="text-[13px] text-[#667085]">{branchTzShort}</p>
                            )}
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Service category</p>
                            <p className="text-[16px] font-medium text-[#101828]">{appointment.serviceCategory || "—"}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Duration</p>
                            <p className="text-[16px] font-medium text-[#101828]">{durationMin} minutes</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Location</p>
                            <p className="text-[16px] font-medium text-[#101828]">{appointment.branchName || "—"}</p>
                            {appointment.roomName && <p className="text-[14px] text-[#475467]">{appointment.roomName}</p>}
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Session type</p>
                            <p className="text-[16px] font-medium text-[#101828]">
                                {isRecovery ? "Recovery & wellness" : "Private session"}
                            </p>
                        </div>
                        {isRecovery && (
                            <div className="flex flex-col gap-1">
                                <p className="text-[14px] text-[#667085]">Open sessions</p>
                                <p className="text-[16px] font-medium text-[#101828]">{appointment.openSession ? "Yes" : "No"}</p>
                            </div>
                        )}
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Fixed price</p>
                            <p className="text-[16px] font-medium text-[#101828]">AED {price.toLocaleString()}</p>
                        </div>
                        {!appointment.openSession && appointment.instructorName && (
                            <div className="flex flex-col gap-1">
                                <p className="text-[14px] text-[#667085]">Instructor</p>
                                <p className="text-[16px] font-medium text-[#101828]">{appointment.instructorName}</p>
                            </div>
                        )}
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Attendance</p>
                            <p className="text-[16px] font-medium text-[#101828]">{appointment.booked} / {appointment.capacity}</p>
                        </div>
{/* Cancellation reason intentionally NOT shown — appointments come from
    the customer side and admin cancellations don't carry an explicit
    reason field. Matches the class schedule cancel flow. */}
                    </div>
                </div>

                {showRatingSummary ? (
                    <RatingSummary rating={appointment.rating} count={appointment.ratingCount} />
                ) : canCancel && (
                    <div className="px-6 pb-6 shrink-0">
                        <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                        <p className="text-[14px] text-[#667085] mb-4">Appointment actions</p>
                        <div className="flex flex-col gap-4">
                            {/* Cancel only — appointments are created by the
                                customer (self-booking) and can't be edited
                                by the admin. Trash icon + red hover mirrors
                                the class schedule's Cancel pattern. */}
                            <button type="button" onClick={onCancelAppointment}
                                className="flex items-center gap-2 w-full text-[16px] font-semibold leading-[24px] text-[#b42318] hover:text-[#912018] transition-colors">
                                <span className="w-5 h-5 shrink-0"><Trash04 className="w-5 h-5" /></span>
                                Cancel appointment
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Review row dropdown (Reviews & Rating tab) ─────────────────────────────
//
// Same shape as the class schedule's review row kebab — single destructive
// "Delete review" item rendered via the canonical RowActions.

// ─── Star rating row (Reviews tab) ──────────────────────────────────────────

function StarRow({ score, size = 20 }: { score: number; size?: number }) {
    return (
        <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map(i => {
                const filled = i + 0.5 <= score;
                return (
                    <Star01 key={i}
                        style={{ width: size, height: size }}
                        className={cn(filled ? "text-[#fdb022]" : "text-[#e4e7ec]")}
                        fill={filled ? "#fdb022" : "none"} />
                );
            })}
        </div>
    );
}

function StoodOutTag({ label }: { label: string }) {
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full border-1 border-[#e4e7ec] bg-white text-[12px] font-medium text-[#344054] whitespace-nowrap">
            {label}
        </span>
    );
}

// ─── Review filter (mirrors class schedule ReviewFilterPanel verbatim) ─────

const STOOD_OUT_OPTIONS = ["Instructor", "Atmosphere", "Difficulty", "Pacing", "Music", "Equipment"] as const;

type ReviewFilter = {
    startDate: string;
    endDate: string;
    tags: string[];
    ratings: number[];
};
const EMPTY_REVIEW_FILTER: ReviewFilter = { startDate: "", endDate: "", tags: [], ratings: [] };

function ReviewFilterPill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "h-9 px-3 rounded-[8px] border text-[14px] font-medium transition-colors",
                selected
                    ? "bg-[#e9fff3] border-[#7ba08c] text-[#344054]"
                    : "bg-white border-[#d0d5dd] text-[#344054] hover:border-[#aad4bd]",
            )}>
            {label}
        </button>
    );
}

function ReviewFilterPanel({ open, onClose, applied, onApply }: {
    open: boolean;
    onClose: () => void;
    applied: ReviewFilter;
    onApply: (f: ReviewFilter) => void;
}) {
    const [pending, setPending] = useState<ReviewFilter>(EMPTY_REVIEW_FILTER);
    useEffect(() => {
        if (open) setPending({ ...applied, tags: [...applied.tags], ratings: [...applied.ratings] });
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);

    function toggleTag(t: string) {
        setPending(p => ({ ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t] }));
    }
    function toggleRating(n: number) {
        setPending(p => ({ ...p, ratings: p.ratings.includes(n) ? p.ratings.filter(x => x !== n) : [...p.ratings, n] }));
    }
    const hasAny = !!pending.startDate || !!pending.endDate || pending.tags.length > 0 || pending.ratings.length > 0;

    return (
        <SlidePanel open={open} onClose={onClose} width={400}>
<div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-medium text-[18px] leading-[28px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-6">
                    {/* Date range */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Date range</p>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <DatePicker value={pending.startDate}
                                    onChange={v => setPending(p => {
                                        const next = { ...p, startDate: v };
                                        if (p.endDate && v && p.endDate < v) next.endDate = "";
                                        return next;
                                    })}
                                    placeholder="Start date" />
                            </div>
                            <div className="flex-1">
                                <DatePicker value={pending.endDate}
                                    onChange={v => setPending(p => ({ ...p, endDate: v }))}
                                    placeholder="End date"
                                    minDate={pending.startDate || undefined} />
                            </div>
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />

                    {/* What stood out */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">What stood out</p>
                        <div className="flex flex-wrap gap-2">
                            {STOOD_OUT_OPTIONS.map(t => (
                                <ReviewFilterPill key={t} label={t} selected={pending.tags.includes(t)} onClick={() => toggleTag(t)} />
                            ))}
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />

                    {/* Ratings */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Ratings</p>
                        <div className="flex flex-wrap gap-2">
                            {[5, 4, 3, 2, 1].map(n => {
                                const sel = pending.ratings.includes(n);
                                return (
                                    <button key={n} type="button" onClick={() => toggleRating(n)}
                                        className={cn(
                                            "h-9 px-3 rounded-[8px] border text-[14px] font-medium transition-colors inline-flex items-center gap-1.5",
                                            sel
                                                ? "bg-[#e9fff3] border-[#7ba08c] text-[#344054]"
                                                : "bg-white border-[#d0d5dd] text-[#344054] hover:border-[#aad4bd]",
                                        )}>
                                        <Star01 className="w-4 h-4 text-[#fdb022]" fill="#fdb022" />
                                        {n} star
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" disabled={!hasAny}
                        onClick={() => { setPending(EMPTY_REVIEW_FILTER); onApply(EMPTY_REVIEW_FILTER); onClose(); }}>
                        Clear filter
                    </Button>
                    <Button variant="primary" size="md" disabled={!hasAny}
                        onClick={() => { onApply(pending); onClose(); }}>
                        Apply
                    </Button>
                </div>
        </SlidePanel>
    );
}

// ─── Right panel — Booked / Cancelled / Reviews tabs ────────────────────────
//
// Reviews tab only appears when the appointment is Completed (mirrors the
// class schedule's Reviews & Rating tab matrix). Reviews carries two
// SUB-TABS internally — "Rating & reviews" (visible roster) and
// "Deletion log" (soft-deleted entries) — same pattern as
// /schedule/[classId].

type RightTab = "booked" | "cancelled" | "reviews";
type ReviewsSubTab = "ratings" | "deletion-log";

function RightPanel({ appointment, bookings, visibleRatings, deletedRatings, ...actions }: {
    appointment: Appointment;
    bookings: AppointmentBooking[];
    /** Non-deleted ratings — surfaced on the "Rating & reviews" sub-tab. */
    visibleRatings: AppointmentRating[];
    /** Soft-deleted ratings — surfaced on the "Deletion log" sub-tab. */
    deletedRatings: AppointmentRating[];
    onCancelOne: (id: string) => void;
    onRemoveOne: (id: string) => void;
    onMarkOne: (id: string) => void;
    onBulkCancel: (ids: string[]) => void;
    onBulkRemove: (ids: string[]) => void;
    onBulkMark: (ids: string[]) => void;
    onDeleteReviewOne: (id: string) => void;
    onDeleteReviewBulk: (ids: string[]) => void;
}) {
    const [tab, setTab] = useState<RightTab>("booked");
    const [reviewsSubTab, setReviewsSubTab] = useState<ReviewsSubTab>("ratings");
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [reviewFilterOpen, setReviewFilterOpen] = useState(false);
    const [appliedReviewFilter, setAppliedReviewFilter] = useState<ReviewFilter>(EMPTY_REVIEW_FILTER);

    // Apply review search + filter to whichever sub-tab is active.
    function applyReviewFilter(list: AppointmentRating[]): AppointmentRating[] {
        const q = search.trim().toLowerCase();
        return list.filter(r => {
            if (q) {
                const hay = `${r.customerName} ${r.comment} ${(r.tags ?? []).join(" ")}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (appliedReviewFilter.startDate && r.submittedAt.slice(0, 10) < appliedReviewFilter.startDate) return false;
            if (appliedReviewFilter.endDate   && r.submittedAt.slice(0, 10) > appliedReviewFilter.endDate)   return false;
            if (appliedReviewFilter.ratings.length > 0 && !appliedReviewFilter.ratings.includes(Math.floor(r.score))) return false;
            if (appliedReviewFilter.tags.length > 0) {
                if (!appliedReviewFilter.tags.some(t => (r.tags ?? []).includes(t))) return false;
            }
            return true;
        });
    }
    const filteredVisibleReviews = useMemo(() => applyReviewFilter(visibleRatings), [visibleRatings, search, appliedReviewFilter]); // eslint-disable-line react-hooks/exhaustive-deps
    const filteredDeletedReviews = useMemo(() => applyReviewFilter(deletedRatings), [deletedRatings, search, appliedReviewFilter]); // eslint-disable-line react-hooks/exhaustive-deps
    const reviewsCurrentList = reviewsSubTab === "ratings" ? filteredVisibleReviews : filteredDeletedReviews;
    const hasActiveReviewFilter = !!appliedReviewFilter.startDate || !!appliedReviewFilter.endDate
        || appliedReviewFilter.tags.length > 0 || appliedReviewFilter.ratings.length > 0;
    // Reviews tab only available on Completed appointments — matches the
    // class schedule Reviews & Rating tab behaviour.
    const showReviewsTab = appointment.status === "Completed" && (visibleRatings.length > 0 || deletedRatings.length > 0);

    const bookedRoster    = bookings.filter(b => b.status !== "Cancelled");
    const cancelledRoster = bookings.filter(b => b.status === "Cancelled");

    // Status-column visibility — mirrors /schedule/[classId]:
    //   booked tab  → show only when Ongoing/Cancelled/Completed (Upcoming has
    //                 no attendance state to surface yet, so the column hides)
    //   cancelled tab → always show (each row is already in a terminal state)
    const showStatusColumn =
        (tab === "booked"   && (appointment.status === "Ongoing" || appointment.status === "Cancelled" || appointment.status === "Completed"))
     || (tab === "cancelled");

    const visibleRoster = tab === "booked" ? bookedRoster : cancelledRoster;
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return visibleRoster;
        return visibleRoster.filter(r => r.customerName.toLowerCase().includes(q));
    }, [visibleRoster, search]);

    const comparators: Record<string, (a: AppointmentBooking, b: AppointmentBooking) => number> = {
        name:   (a, b) => a.customerName.localeCompare(b.customerName),
        booked: (a, b) => a.bookedAt.localeCompare(b.bookedAt),
        status: (a, b) => a.status.localeCompare(b.status),
    };
    const { sorted, sortKey, sortDir, toggle: toggleSort } = useSort(filtered, comparators);

    // Selection allowed on:
    //   • Open session + Booked tab (Upcoming/Ongoing per-row cancel/remove/present)
    //   • Reviews tab → Rating & reviews sub-tab (bulk delete)
    // Deletion log + Cancelled tab + Private appointments → read-only.
    const reviewsRatingsMode = tab === "reviews" && reviewsSubTab === "ratings";
    const canSelect =
        (appointment.openSession && tab === "booked") ||
        reviewsRatingsMode;
    const allChecked  = canSelect && sorted.length > 0 && sorted.every(r => selectedIds.has(r.id));
    const someChecked = !allChecked && sorted.some(r => selectedIds.has(r.id));

    function toggleOne(id: string) {
        const next = new Set(selectedIds);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelectedIds(next);
    }
    function toggleAll(check: boolean) {
        const next = new Set(selectedIds);
        if (check) sorted.forEach(r => next.add(r.id));
        else       sorted.forEach(r => next.delete(r.id));
        setSelectedIds(next);
    }
    // Review selection helpers — operate on the FILTERED visible-ratings
    // list so "Select all" only checks rows currently visible (mirrors
    // class schedule's behaviour).
    function toggleReview(id: string) {
        const next = new Set(selectedIds);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelectedIds(next);
    }
    function toggleAllReviews(check: boolean) {
        const next = new Set(selectedIds);
        if (check) filteredVisibleReviews.forEach(r => next.add(r.id));
        else       filteredVisibleReviews.forEach(r => next.delete(r.id));
        setSelectedIds(next);
    }
    const reviewsAllChecked  = reviewsRatingsMode && filteredVisibleReviews.length > 0 && filteredVisibleReviews.every(r => selectedIds.has(r.id));
    const reviewsSomeChecked = !reviewsAllChecked && reviewsRatingsMode && filteredVisibleReviews.some(r => selectedIds.has(r.id));

    function clear() { setSelectedIds(new Set()); }

    // Bulk-bar kind derived from the current view — admins only see the
    // actions that match the current state.
    const bulkKind: "upcoming" | "ongoing" | "reviews" | null =
        tab === "reviews" && reviewsSubTab === "ratings" ? "reviews" :
        tab === "booked" && appointment.status === "Upcoming" ? "upcoming" :
        tab === "booked" && appointment.status === "Ongoing"  ? "ongoing"  : null;

    function handleBulk(kind: RowActionKind | "delete-review") {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        if (kind === "cancel")        actions.onBulkCancel(ids);
        if (kind === "remove")        actions.onBulkRemove(ids);
        if (kind === "present")       actions.onBulkMark(ids);
        if (kind === "delete-review") actions.onDeleteReviewBulk(ids);
        clear();
    }

    return (
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-1 border-[#e4e7ec] rounded-[20px] bg-white">
            {/* Tabs — label + pill-style count badge, matches the class
                schedule detail tab strip pattern verbatim. */}
            <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                <div className="flex gap-1">
                    {([
                        { id: "booked" as const,    label: "Booked",    count: appointment.openSession
                            ? `${bookedRoster.length}/${appointment.capacity}`
                            : String(bookedRoster.length) },
                        { id: "cancelled" as const, label: "Cancelled", count: String(cancelledRoster.length) },
                        ...(showReviewsTab
                            ? [{ id: "reviews" as const, label: "Reviews & Rating", count: String(visibleRatings.length) }]
                            : []),
                    ]).map(t => (
                        <button key={t.id} type="button"
                            onClick={() => {
                                setTab(t.id);
                                if (t.id === "reviews") setReviewsSubTab("ratings");
                                setSearch(""); clear();
                            }}
                            className={cn(
                                "h-[48px] px-3 text-[14px] font-semibold transition-colors flex items-center gap-2 whitespace-nowrap",
                                tab === t.id ? "border-b-2 border-[#101828] text-[#101828]" : "text-[#667085] hover:text-[#344054]",
                            )}>
                            {t.label}
                            <span className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium",
                                tab === t.id
                                    ? "bg-[#f2f4f7] text-[#344054]"
                                    : "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#667085]",
                            )}>{t.count}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Reviews sub-tab pill switcher — mirrors the class-schedule
                Reviews tab's two-pill row. Shown only on the Reviews main
                tab; clearing the search + selection keeps state from
                bleeding between sub-tabs. */}
            {tab === "reviews" && (
                <div className="shrink-0 px-6 pt-5">
                    <div className="flex bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[10px] p-1">
                        {([
                            { id: "ratings" as const,      label: "Rating & reviews" },
                            { id: "deletion-log" as const, label: "Deletion log" },
                        ]).map(s => (
                            <button key={s.id} type="button"
                                onClick={() => { setReviewsSubTab(s.id); setSearch(""); clear(); }}
                                className={cn(
                                    "flex-1 h-10 rounded-[8px] text-[14px] font-medium transition-colors",
                                    reviewsSubTab === s.id
                                        ? "bg-white text-[#344054] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                                        : "text-[#667085] hover:text-[#344054]",
                                )}>
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Toolbar — count + search + (reviews) filter button. Reviews
                tab counts the FILTERED list so the total stays accurate
                while the admin narrows results. */}
            <div className="shrink-0 flex items-center gap-3 px-6 py-4">
                <div className="flex-1">
                    <p className="text-[14px] text-[#667085]">Total</p>
                    <p className="text-[14px] font-medium text-[#101828]">
                        {tab === "reviews"
                            ? `${reviewsCurrentList.length} ${reviewsCurrentList.length === 1 ? "rating" : "ratings"}`
                            : `${sorted.length} ${sorted.length === 1 ? "customer" : "customers"}`}
                    </p>
                </div>
                <ToolbarSearch
                    value={search}
                    onChange={setSearch}
                    placeholder={tab === "reviews" ? "Search rating..." : "Search customer..."}
                    size="sm"
                />
                {tab === "reviews" && (
                    <ToolbarFilter onClick={() => setReviewFilterOpen(true)} active={hasActiveReviewFilter} size="sm" />
                )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                {tab === "reviews" ? (
                    reviewsCurrentList.length === 0 ? (
                        <EmptyState
                            title={reviewsSubTab === "ratings" ? "No ratings found" : "Nothing in the deletion log"}
                            subtitle={reviewsSubTab === "ratings"
                                ? (visibleRatings.length === 0 ? "Customer ratings will appear here." : "Try adjusting your filters.")
                                : "Deleted ratings will appear here."}
                        />
                    ) : (
                        <div className="px-6">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        {reviewsSubTab === "ratings" && (
                                            <th className={cn(TH, "w-[44px]")}>
                                                <CheckboxCell
                                                    checked={reviewsAllChecked}
                                                    indeterminate={reviewsSomeChecked}
                                                    onChange={toggleAllReviews}
                                                    ariaLabel="Select all ratings"
                                                />
                                            </th>
                                        )}
                                        <th className={cn(TH, "w-[200px]")}>Customer</th>
                                        <th className={cn(TH, "w-[140px]")}>Ratings</th>
                                        <th className={TH}>Reviews</th>
                                        <th className={cn(TH, "w-[200px]")}>What stood out</th>
                                        {reviewsSubTab === "ratings" && <th className={cn(TH, "w-[52px]")}></th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {reviewsCurrentList.map(r => {
                                        const isSelected = selectedIds.has(r.id);
                                        return (
                                            <tr key={r.id}
                                                className={cn("transition-colors", isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]")}>
                                                {reviewsSubTab === "ratings" && (
                                                    <td className={TD}>
                                                        <CheckboxCell
                                                            checked={isSelected}
                                                            onChange={() => toggleReview(r.id)}
                                                            ariaLabel={`Select review by ${r.customerName}`}
                                                        />
                                                    </td>
                                                )}
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3">
                                                        <TableAvatar initials={r.customerInitials} imageUrl={r.customerImageUrl} size={40} />
                                                        <div>
                                                            <div className="text-[14px] font-medium text-[#101828]">{r.customerName}</div>
                                                            <div className="text-[13px] text-[#667085]">
                                                                {new Date(r.submittedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className={TD}><StarRow score={r.score} /></td>
                                                <td className={cn(TD, "text-[14px] text-[#475467] leading-[20px]")}>
                                                    <p className="max-w-[420px]">{r.comment}</p>
                                                </td>
                                                <td className={TD}>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(r.tags ?? []).map((t: string) => <StoodOutTag key={t} label={t} />)}
                                                    </div>
                                                </td>
                                                {reviewsSubTab === "ratings" && (
                                                    <td className={TD}>
                                                        <RowActions items={[{ label: "Delete review", icon: Trash01, danger: true, onClick: () => actions.onDeleteReviewOne(r.id) }]} minWidth={180} />
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : sorted.length === 0 ? (
                    <EmptyState
                        title={tab === "booked" ? "No bookings yet" : "No cancellations"}
                        subtitle={tab === "booked"
                            ? "Customer bookings for this appointment will appear here."
                            : "Cancelled customer bookings will appear here."}
                    />
                ) : (
                    <div className="px-6">
                        {/* Status-column visibility (see `showStatusColumn` above)
                            mirrors /schedule/[classId] roster: booked tab hides
                            Status for Upcoming, shows it for Ongoing/Completed/
                            Cancelled; cancelled tab always shows it. */}
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    {canSelect && (
                                        <th className={cn(TH, "w-[44px]")}>
                                            <CheckboxCell
                                                checked={allChecked}
                                                indeterminate={someChecked}
                                                onChange={toggleAll}
                                                ariaLabel="Select all customers"
                                            />
                                        </th>
                                    )}
                                    <th className={cn(TH, "w-[280px]")}>
                                        <SortableHeader sortKey="name" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Customer</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[180px]")}>
                                        <SortableHeader sortKey="booked" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Booked at</SortableHeader>
                                    </th>
                                    {showStatusColumn && (
                                        <th className={cn(TH, "w-[120px]")}>
                                            <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                                        </th>
                                    )}
                                    <th className={cn(TH, "w-[52px]")}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map(r => {
                                    const isSelected = selectedIds.has(r.id);
                                    return (
                                        <tr key={r.id} className={cn("transition-colors", isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]")}>
                                            {canSelect && (
                                                <td className={TD}>
                                                    <CheckboxCell
                                                        checked={isSelected}
                                                        onChange={() => toggleOne(r.id)}
                                                        ariaLabel={`Select ${r.customerName}`}
                                                    />
                                                </td>
                                            )}
                                            <td className={TD}>
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <TableAvatar initials={r.customerInitials} imageUrl={r.customerImageUrl} size={36} />
                                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                        <span className="text-[14px] font-medium text-[#101828] truncate">{r.customerName}</span>
                                                        {/* Context pills — "1st appointment", "Birthday", "New member", etc.
                                                            Priority-sorted, capped at 2 by the component. Renders nothing
                                                            when the customer has none. */}
                                                        <AppointmentCustomerBadges customerId={r.customerId} appointmentDateISO={appointment.dateISO} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={cn(TD, "whitespace-nowrap text-[#475467]")}>
                                                {new Date(r.bookedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                                            </td>
                                            {showStatusColumn && (
                                                <td className={TD}>
                                                    {/* Mirrors /schedule/[classId] booked-tab badge logic 1:1:
                                                        - Ongoing → PresentBadge / NoShowBadge when marked,
                                                          else an INLINE Present BUTTON (client feedback Jul
                                                          2026 — same chrome as the instructor variant).
                                                          A no-show is auto-flagged by the system; there's
                                                          no explicit button for it.
                                                        - Completed → keep the badge-only readout (retrospective).
                                                        - Cancelled tab → keep the existing appointment-booking
                                                          status badge (Booked / Cancelled / etc). */}
                                                    {tab === "booked" && (appointment.status === "Ongoing" || appointment.status === "Completed")
                                                        ? (r.status === "Attended"
                                                            ? <PresentBadge />
                                                            : r.status === "NoShow"
                                                                ? <NoShowBadge />
                                                                : appointment.status === "Ongoing"
                                                                    ? <PresentButton onClick={() => actions.onMarkOne(r.id)} />
                                                                    : null)
                                                        : <StatusBadge type="appointment-booking" status={r.status} />}
                                                </td>
                                            )}
                                            <td className={TD}>
                                                {r.status !== "Cancelled" && (() => {
                                                    const isUpcoming      = appointment.status === "Upcoming";
                                                    return (
                                                        <RowActions
                                                            items={[
                                                                {
                                                                    label: "Cancel customer",
                                                                    icon: SlashCircle01,
                                                                    hidden: !(appointment.openSession && isUpcoming),
                                                                    onClick: () => actions.onCancelOne(r.id),
                                                                },
                                                                {
                                                                    label: "Remove customer",
                                                                    icon: Trash01,
                                                                    danger: true,
                                                                    hidden: !(appointment.openSession && isUpcoming),
                                                                    onClick: () => actions.onRemoveOne(r.id),
                                                                },
                                                            ]}
                                                        />
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Bulk-action pill */}
            {canSelect && bulkKind && (
                <BulkActionBar
                    count={selectedIds.size}
                    kind={bulkKind}
                    onClear={clear}
                    onAction={handleBulk}
                />
            )}

            {/* Review filter side panel — gated by the Filter button in the
                toolbar; shared by both Rating & reviews + Deletion log
                sub-tabs since the same fields filter both lists. */}
            <ReviewFilterPanel
                open={reviewFilterOpen}
                onClose={() => setReviewFilterOpen(false)}
                applied={appliedReviewFilter}
                onApply={setAppliedReviewFilter}
            />
        </div>
    );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export interface AppointmentDetailPageProps {
    appointmentId: string;
    returnTo?: string;
}

export function AppointmentDetailPage({ appointmentId, returnTo = "/admin/schedule" }: AppointmentDetailPageProps) {
    const router = useRouter();

    const appointments         = useAppStore(s => s.appointments);
    const allBookings          = useAppStore(s => s.appointmentBookings);
    const allRatings           = useAppStore(s => s.appointmentRatings);
    const cancelAppointment    = useAppStore(s => s.cancelAppointment);
    const cancelBooking        = useAppStore(s => s.cancelAppointmentBooking);
    const removeCustomer       = useAppStore(s => s.removeAppointmentCustomer);
    const markPresent          = useAppStore(s => s.markAppointmentPresent);
    const markPresentBulk      = useAppStore(s => s.markAppointmentPresentBulk);
    const deleteRating         = useAppStore(s => s.deleteAppointmentRating);
    const deleteRatingsBulk    = useAppStore(s => s.deleteAppointmentRatings);
    const showToast            = useAppStore(s => s.showToast);

    const appointment = appointments.find(a => a.id === appointmentId);
    const bookings = useMemo(
        () => allBookings.filter(b => b.appointmentId === appointmentId),
        [allBookings, appointmentId],
    );
    const visibleRatings = useMemo(
        () => allRatings.filter(r => r.appointmentId === appointmentId && !r.deletedAt),
        [allRatings, appointmentId],
    );
    const deletedRatings = useMemo(
        () => allRatings.filter(r => r.appointmentId === appointmentId && r.deletedAt),
        [allRatings, appointmentId],
    );

    // Modal target — refund-toggle modals take the refund value back via
    // their onConfirm callback, so we just need to know which kind is open
    // and (for bookings) the booking id.
    type ModalTarget =
        | { kind: "appointment" }
        | { kind: "cancel-booking"; bookingId: string }
        | { kind: "remove-booking"; bookingId: string }
        | { kind: "bulk-cancel"; ids: string[] }
        | { kind: "bulk-remove"; ids: string[] }
        // Bulk mark-present now goes through a confirmation modal to match
        // the class detail (client feedback Jul 2026 — parity between class
        // and appointment attendance flows).
        | { kind: "bulk-mark"; ids: string[] }
        | { kind: "delete-review"; ratingId: string }
        | { kind: "bulk-delete-review"; ids: string[] };
    const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null);

    if (!appointment) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-[18px] font-semibold text-[#101828]">Appointment not found</p>
                    <button type="button" onClick={() => router.push(returnTo)}
                        className="mt-4 text-[14px] text-[#658774] hover:underline">
                        Go back
                    </button>
                </div>
            </div>
        );
    }

    function findBooking(id: string) { return bookings.find(b => b.id === id); }
    function findRating(id: string)  { return allRatings.find(r => r.id === id); }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">
                        {appointment.type === "private"  ? "Private session details" :
                         appointment.type === "recovery" ? "Recovery & wellness details" :
                         "Appointment details"}
                    </h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            <DetailPageShell
                sidebar={
                    <LeftPanel
                        appointment={appointment}
                        onCancelAppointment={() => setModalTarget({ kind: "appointment" })}
                    />
                }
                main={
                    <RightPanel
                        appointment={appointment}
                        bookings={bookings}
                        visibleRatings={visibleRatings}
                        deletedRatings={deletedRatings}
                        onCancelOne={(id) => setModalTarget({ kind: "cancel-booking", bookingId: id })}
                        onRemoveOne={(id) => setModalTarget({ kind: "remove-booking", bookingId: id })}
                        onMarkOne={(id) => {
                            const b = findBooking(id);
                            markPresent(id);
                            showToast(
                                "Customer marked present",
                                b ? `${b.customerName} has been marked present.` : "Attendance updated.",
                                "success", "check",
                            );
                        }}
                        onBulkCancel={(ids) => setModalTarget({ kind: "bulk-cancel", ids })}
                        onBulkRemove={(ids) => setModalTarget({ kind: "bulk-remove", ids })}
                        onBulkMark={(ids) => setModalTarget({ kind: "bulk-mark", ids })}
                        onDeleteReviewOne={(id) => setModalTarget({ kind: "delete-review", ratingId: id })}
                        onDeleteReviewBulk={(ids) => setModalTarget({ kind: "bulk-delete-review", ids })}
                    />
                }
            />

            {/* ── Modals — refund-toggle pattern mirroring class schedule ── */}
            {modalTarget?.kind === "appointment" && (
                <CancelAppointmentModal
                    appointment={appointment}
                    onCancel={() => setModalTarget(null)}
                    onConfirm={(refund: boolean) => {
                        cancelAppointment(appointment.id, refund);
                        showToast(
                            "Appointment cancelled",
                            `${appointment.serviceName} on ${appointment.date} has been cancelled${refund ? " and credits refunded" : ""}.`,
                            "error", "slash",
                        );
                        setModalTarget(null);
                    }}
                />
            )}

            {/* Bulk mark-present confirmation — parity with the class detail
                bulk flow. Same chrome, same copy shape, same DS primary button
                (pale-mint `var(--brand-tertiary)` — no color override). */}
            {modalTarget?.kind === "bulk-mark" && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center">
                    <div className="absolute inset-0 bg-[#0c111d]/60" onClick={() => setModalTarget(null)} />
                    <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                        <button type="button" onClick={() => setModalTarget(null)}
                            className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                            <XClose className="w-6 h-6 text-[#667085]" />
                        </button>
                        <div className="flex flex-col items-center gap-4 pt-6 px-6">
                            <div className="w-12 h-12 rounded-full bg-[#ecfdf3] flex items-center justify-center shrink-0">
                                <CheckCircle className="w-6 h-6 text-[#067647]" />
                            </div>
                            <div className="flex flex-col gap-1 text-center w-full">
                                <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">
                                    Mark {modalTarget.ids.length} customer{modalTarget.ids.length === 1 ? "" : "s"} as present?
                                </h3>
                                <p className="text-[14px] text-[#475467] leading-[20px]">
                                    The selected customers will be marked as present for this appointment.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 px-6 pt-6 pb-6">
                            <Button variant="secondary-gray" size="lg" className="flex-1" onClick={() => setModalTarget(null)}>
                                Cancel
                            </Button>
                            <Button variant="primary" size="lg" className="flex-1"
                                onClick={() => {
                                    const ids = modalTarget.ids;
                                    markPresentBulk(ids);
                                    showToast(
                                        "Customers marked present",
                                        `${ids.length} customer${ids.length === 1 ? "" : "s"} updated.`,
                                        "success", "check",
                                    );
                                    setModalTarget(null);
                                }}>
                                Yes, mark present
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            <CancelBookingModal
                open={modalTarget?.kind === "cancel-booking" || modalTarget?.kind === "bulk-cancel"}
                count={modalTarget?.kind === "bulk-cancel" ? modalTarget.ids.length : 1}
                sampleName={modalTarget?.kind === "cancel-booking" ? (findBooking(modalTarget.bookingId)?.customerName ?? "") : ""}
                onClose={() => setModalTarget(null)}
                onConfirm={(refund: boolean) => {
                    if (modalTarget?.kind === "cancel-booking") {
                        const b = findBooking(modalTarget.bookingId);
                        cancelBooking(modalTarget.bookingId, refund);
                        showToast(
                            "Customer cancelled",
                            b ? `${b.customerName}'s booking has been cancelled${refund ? " and credit refunded" : ""}.` : "Booking cancelled.",
                            "error", "slash",
                        );
                    } else if (modalTarget?.kind === "bulk-cancel") {
                        modalTarget.ids.forEach(id => cancelBooking(id, refund));
                        showToast(
                            "Customers cancelled",
                            `${modalTarget.ids.length} booking${modalTarget.ids.length === 1 ? "" : "s"} cancelled${refund ? " and credits refunded" : ""}.`,
                            "error", "slash",
                        );
                    }
                    setModalTarget(null);
                }}
            />
            <RemoveBookingModal
                open={modalTarget?.kind === "remove-booking" || modalTarget?.kind === "bulk-remove"}
                count={modalTarget?.kind === "bulk-remove" ? modalTarget.ids.length : 1}
                sampleName={modalTarget?.kind === "remove-booking" ? (findBooking(modalTarget.bookingId)?.customerName ?? "") : ""}
                onClose={() => setModalTarget(null)}
                onConfirm={(refund: boolean) => {
                    if (modalTarget?.kind === "remove-booking") {
                        const b = findBooking(modalTarget.bookingId);
                        removeCustomer(modalTarget.bookingId, refund);
                        showToast(
                            "Customer removed",
                            b ? `${b.customerName} has been removed${refund ? " and credit refunded" : ""}.` : "Customer removed.",
                            "error", "trash",
                        );
                    } else if (modalTarget?.kind === "bulk-remove") {
                        modalTarget.ids.forEach(id => removeCustomer(id, refund));
                        showToast(
                            "Customers removed",
                            `${modalTarget.ids.length} customer${modalTarget.ids.length === 1 ? "" : "s"} removed${refund ? " and credits refunded" : ""}.`,
                            "error", "trash",
                        );
                    }
                    setModalTarget(null);
                }}
            />
            <DeleteReviewModal
                open={modalTarget?.kind === "delete-review" || modalTarget?.kind === "bulk-delete-review"}
                count={modalTarget?.kind === "bulk-delete-review" ? modalTarget.ids.length : 1}
                sampleName={modalTarget?.kind === "delete-review" ? (findRating(modalTarget.ratingId)?.customerName ?? "") : ""}
                onClose={() => setModalTarget(null)}
                onConfirm={() => {
                    if (modalTarget?.kind === "delete-review") {
                        const r = findRating(modalTarget.ratingId);
                        deleteRating(modalTarget.ratingId);
                        showToast(
                            "Review deleted",
                            r ? `${r.customerName}'s review has been moved to the deletion log.` : "Moved to the deletion log.",
                            "success", "trash",
                        );
                    } else if (modalTarget?.kind === "bulk-delete-review") {
                        deleteRatingsBulk(modalTarget.ids);
                        showToast(
                            "Reviews deleted",
                            `${modalTarget.ids.length} review${modalTarget.ids.length === 1 ? "" : "s"} moved to the deletion log.`,
                            "success", "trash",
                        );
                    }
                    setModalTarget(null);
                }}
            />

            <Toast />
        </div>
    );
}
