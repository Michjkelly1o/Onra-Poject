"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
    XClose, ChevronLeft, SearchMd, FilterLines, DotsVertical, AlignLeft,
    UserPlus01, Edit02, Trash04, Trash01, Trash02, SlashCircle01, Check, CheckCircle, Star01, Plus,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { useAppStore, type ClassInstance, type ClassBooking, type Customer } from "@/lib/store";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { DatePicker } from "@/components/ui/DatePicker";
import { PlanBadge, BookingStatusBadge, PresentBadge, NoShowBadge, NoPlanBadge, planKindFromName, cancellationBadgeKind } from "@/components/ui/badge";
import { TableAvatar } from "@/components/ui/avatar";
import type { ClassRating } from "@/lib/store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type DetailTab = "booked" | "waitlisted" | "cancelled" | "reviews";
type ReviewsSubTab = "ratings" | "deletion-log";

function fmtBookingTime(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = d.getHours();
    const min = String(d.getMinutes()).padStart(2, "0");
    const ap = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${y}-${m}-${day}, ${String(h12).padStart(2, "0")}:${min} ${ap}`;
}

/** Spot label derived from a fixed 4-column grid (A1..D8). Used when spotSelectionEnabled. */
function spotForIndex(i: number): string {
    const row = String.fromCharCode(65 + Math.floor(i / 4));
    const col = (i % 4) + 1;
    return `${row}${col}`;
}

function diffMinutes(start: string, end: string): number {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
}

// ─── Class status badge (matches class-template TemplateBadge styles) ─────────

function ClassStatusBadge({ status }: { status: ClassInstance["status"] }) {
    const styles: Record<ClassInstance["status"], string> = {
        Upcoming:  "bg-[#f2f4f7] border-1 border-[#e4e7ec] text-[#344054]",
        Ongoing:   "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
        Completed: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        Cancelled: "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
    };
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium", styles[status])}>
            {status}
        </span>
    );
}

// ─── Filter pill (used in the right-slide panel) ──────────────────────────────

function FilterPill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={cn("h-9 px-3 rounded-[8px] border text-[14px] font-medium transition-colors",
                selected
                    ? "bg-[#e9fff3] border-[#7ba08c] text-[#344054]"
                    : "bg-white border-[#d0d5dd] text-[#344054] hover:border-[#aad4bd]")}>
            {label}
        </button>
    );
}

// ─── Booking filter (plan + booking date range) — right-slide panel ───────────

type BookingFilter = {
    plans: ("membership" | "package")[];
    startDate: string;
    endDate: string;
};

const EMPTY_FILTER: BookingFilter = { plans: [], startDate: "", endDate: "" };

function BookingFilterPanel({ open, onClose, applied, onApply }: {
    open: boolean; onClose: () => void;
    applied: BookingFilter; onApply: (f: BookingFilter) => void;
}) {
    const [pending, setPending] = useState<BookingFilter>(EMPTY_FILTER);

    useEffect(() => { if (open) setPending({ ...applied, plans: [...applied.plans] }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);

    if (!open) return null;

    function togglePlan(p: "membership" | "package") {
        setPending(prev => ({
            ...prev,
            plans: prev.plans.includes(p) ? prev.plans.filter(x => x !== p) : [...prev.plans, p],
        }));
    }

    const hasAny = pending.plans.length > 0 || !!pending.startDate || !!pending.endDate;

    return (
        <div className="fixed inset-0 z-[200] flex justify-end">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onClose} />
            <div className="relative w-[400px] h-full bg-white border-l border-[#e4e7ec] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col">
                {/* Header */}
                <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-medium text-[18px] leading-[28px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Plan</p>
                        <div className="flex flex-wrap gap-2">
                            <FilterPill label="Membership" selected={pending.plans.includes("membership")}
                                onClick={() => togglePlan("membership")} />
                            <FilterPill label="Credit package" selected={pending.plans.includes("package")}
                                onClick={() => togglePlan("package")} />
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Booking date range</p>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <DatePicker value={pending.startDate} onChange={v => setPending(p => ({ ...p, startDate: v }))} />
                            </div>
                            <div className="flex-1">
                                <DatePicker value={pending.endDate} onChange={v => setPending(p => ({ ...p, endDate: v }))} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" disabled={!hasAny}
                        onClick={() => { setPending(EMPTY_FILTER); onApply(EMPTY_FILTER); onClose(); }}>
                        Clear filter
                    </Button>
                    <Button variant="primary" size="md" disabled={!hasAny}
                        onClick={() => { onApply(pending); onClose(); }}>
                        Apply
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Reviews & Rating filter — right-slide panel ──────────────────────────────

const STOOD_OUT_OPTIONS = ["Instructor", "Atmosphere", "Difficulty", "Pacing", "Music", "Equipment"] as const;

type ReviewFilter = {
    startDate: string;
    endDate: string;
    tags: string[];
    ratings: number[];
};

const EMPTY_REVIEW_FILTER: ReviewFilter = { startDate: "", endDate: "", tags: [], ratings: [] };

function ReviewFilterPanel({ open, onClose, applied, onApply }: {
    open: boolean; onClose: () => void;
    applied: ReviewFilter; onApply: (f: ReviewFilter) => void;
}) {
    const [pending, setPending] = useState<ReviewFilter>(EMPTY_REVIEW_FILTER);
    useEffect(() => { if (open) setPending({ ...applied, tags: [...applied.tags], ratings: [...applied.ratings] }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);

    if (!open) return null;

    function toggleTag(t: string) {
        setPending(p => ({ ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t] }));
    }
    function toggleRating(n: number) {
        setPending(p => ({ ...p, ratings: p.ratings.includes(n) ? p.ratings.filter(x => x !== n) : [...p.ratings, n] }));
    }

    const hasAny = !!pending.startDate || !!pending.endDate || pending.tags.length > 0 || pending.ratings.length > 0;

    return (
        <div className="fixed inset-0 z-[200] flex justify-end">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onClose} />
            <div className="relative w-[400px] h-full bg-white border-l border-[#e4e7ec] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col">
                {/* Header */}
                <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-medium text-[18px] leading-[28px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Date range</p>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <DatePicker value={pending.startDate} onChange={v => setPending(p => ({ ...p, startDate: v }))} placeholder="Start date" />
                            </div>
                            <div className="flex-1">
                                <DatePicker value={pending.endDate} onChange={v => setPending(p => ({ ...p, endDate: v }))} placeholder="End date" />
                            </div>
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />

                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">What stood out</p>
                        <div className="flex flex-wrap gap-2">
                            {STOOD_OUT_OPTIONS.map(t => (
                                <FilterPill key={t} label={t} selected={pending.tags.includes(t)} onClick={() => toggleTag(t)} />
                            ))}
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />

                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Ratings</p>
                        <div className="flex flex-wrap gap-2">
                            {[5, 4, 3, 2, 1].map(n => {
                                const sel = pending.ratings.includes(n);
                                return (
                                    <button key={n} type="button" onClick={() => toggleRating(n)}
                                        className={cn("h-9 px-3 rounded-[8px] border text-[14px] font-medium transition-colors inline-flex items-center gap-1.5",
                                            sel
                                                ? "bg-[#e9fff3] border-[#7ba08c] text-[#344054]"
                                                : "bg-white border-[#d0d5dd] text-[#344054] hover:border-[#aad4bd]")}>
                                        <Star01 className="w-4 h-4 text-[#fdb022]" fill="#fdb022" />
                                        {n} star
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
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
            </div>
        </div>
    );
}

// ─── Cancel booking modal (per-row "Cancel / remove customer") ────────────────

/** DS toggle switch (matches Figma 36×20px pill, brand-solid track when on). */
function Toggle({ on, onChange, disabled = false }: { on: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-disabled={disabled} disabled={disabled}
            onClick={() => !disabled && onChange(!on)}
            className={cn(
                "relative w-9 h-5 rounded-full p-0.5 flex items-center transition-colors shrink-0",
                on ? "bg-[#658774] justify-end" : "bg-[#f2f4f7] justify-start",
                disabled && "opacity-60 cursor-not-allowed"
            )}>
            <span className="w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]" />
        </button>
    );
}

/** Cancel customer booking — matches Figma node 4009:31883. */
function CancelBookingModal({ open, count, sampleName, defaultRefund = true, onClose, onConfirm }: {
    open: boolean;
    count: number;
    sampleName: string;
    /** Initial state of the refund toggle when the modal opens. */
    defaultRefund?: boolean;
    onClose: () => void;
    onConfirm: (refund: boolean) => void;
}) {
    const [refund, setRefund] = useState(defaultRefund);
    useEffect(() => { if (open) setRefund(defaultRefund); }, [open, defaultRefund]);
    if (!open) return null;
    const isBulk = count > 1;
    const title = isBulk ? `Cancel ${count} customers from the class?` : "Cancel this customer from the class?";
    const desc = isBulk
        ? "Are you sure you want to cancel these customers from the booked session? This action cannot be undone."
        : "Are you sure you want to cancel this customer from the booked session? This action cannot be undone.";
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
                {/* Header */}
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#fee4e2] flex items-center justify-center shrink-0">
                        <SlashCircle01 className="w-6 h-6 text-[#d92d20]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">{!isBulk && sampleName ? <>Are you sure you want to cancel <span className="font-medium text-[#344054]">{sampleName}</span> from the booked session? This action cannot be undone.</> : desc}</p>
                    </div>
                </div>
                <div className="h-5 shrink-0" />
                <div className="h-px w-full bg-[#e4e7ec]" />
                {/* Refund toggle row */}
                <div className="flex items-center justify-between gap-4 px-6 py-5">
                    <div className="flex flex-col gap-1 min-w-0">
                        <p className="text-[16px] font-medium text-[#101828]">Refund class session</p>
                        <p className="text-[14px] text-[#475467] leading-[20px]">{refundDesc}</p>
                    </div>
                    <Toggle on={refund} onChange={setRefund} />
                </div>
                {/* Actions */}
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <button type="button" onClick={onClose}
                        className="flex-1 py-[10px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] font-semibold text-[#344054] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors">
                        Cancel
                    </button>
                    <button type="button" onClick={() => onConfirm(refund)}
                        className="flex-1 py-[10px] rounded-[8px] text-[16px] font-semibold text-white bg-[#d92d20] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#b42318] transition-colors">
                        Yes, cancel booking
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Cancel class modal ───────────────────────────────────────────────────────

function CancelClassModal({ open, classInstance, bookedCount, onClose, onConfirm }: {
    open: boolean;
    classInstance: ClassInstance | null;
    bookedCount: number;
    onClose: () => void;
    onConfirm: (refund: boolean) => void;
}) {
    if (!open || !classInstance) return null;
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
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Cancel this class?</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            <span className="font-medium text-[#344054]">{classInstance.name}</span> on {classInstance.date} • {classInstance.displayTime} will be cancelled.
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
                                <p className="text-[14px] text-[#475467] leading-[20px]">When the studio cancels a class, each customer is always refunded.</p>
                            </div>
                            {/* Locked ON — class cancellation by admin always grants a no-charge refund. */}
                            <Toggle on={true} onChange={() => { /* locked */ }} disabled />
                        </div>
                    </>
                )}
                <div className={cn("flex gap-3 px-6 pb-6", bookedCount > 0 ? "pt-6" : "pt-5")}>
                    <button type="button" onClick={onClose}
                        className="flex-1 py-[10px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] font-semibold text-[#344054] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors">
                        Cancel
                    </button>
                    <button type="button" onClick={() => onConfirm(true)}
                        className="flex-1 py-[10px] rounded-[8px] text-[16px] font-semibold text-white bg-[#d92d20] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#b42318] transition-colors">
                        Yes, cancel class
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Add customer modal — picks an existing customer from the store ───────────

function AddCustomerModal({ open, existingCustomerIds, onClose, onAdd }: {
    open: boolean;
    existingCustomerIds: Set<string>;
    onClose: () => void;
    onAdd: (customer: Customer) => void;
}) {
    const router = useRouter();
    const customers = useAppStore(s => s.customers);
    const [search, setSearch] = useState("");
    useEffect(() => { if (open) setSearch(""); }, [open]);
    if (!open) return null;
    const available = customers.filter(c =>
        !existingCustomerIds.has(c.id) && (
            !search ||
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
            c.email.toLowerCase().includes(search.toLowerCase())
        )
    );
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-full max-w-[720px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between px-6 pt-6 pb-5 border-b border-[#e4e7ec]">
                    <div className="flex flex-col gap-1 min-w-0">
                        <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">Add customer</p>
                        <p className="text-[14px] text-[#475467] leading-[20px]">Select a customer to add to this class.</p>
                    </div>
                    <button type="button" onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                        <XClose className="w-6 h-6 text-[#667085]" />
                    </button>
                </div>
                {/* Search + add new */}
                <div className="px-6 pt-5 pb-4 flex items-center gap-3">
                    <div className="relative flex-1">
                        <SearchMd className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#667085] pointer-events-none" />
                        <input
                            type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search customer"
                            className="w-full h-10 pl-10 pr-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                        />
                    </div>
                    <button type="button"
                        onClick={() => router.push(`/customers/new?returnTo=${encodeURIComponent(window.location.pathname + "?openAddCustomer=1")}`)}
                        className="w-10 h-10 flex items-center justify-center border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors"
                        title="Create new customer">
                        <Plus className="w-5 h-5 text-[#344054]" />
                    </button>
                </div>
                {/* Customer list */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    {available.length === 0 ? (
                        <p className="text-[14px] text-[#667085] text-center py-8">No matching customers.</p>
                    ) : (
                        <div className="flex flex-col">
                            {available.map((c, i) => (
                                <div key={c.id} className={cn("grid grid-cols-[1fr_140px_140px] items-center gap-4 py-3", i > 0 && "border-t border-[#e4e7ec]")}>
                                    {/* Customer */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <TableAvatar initials={c.initials} imageUrl={c.imageUrl} size={40} />
                                        <div className="min-w-0">
                                            <p className="text-[14px] font-medium text-[#101828] truncate">{c.firstName} {c.lastName}</p>
                                            <p className="text-[14px] text-[#667085] truncate">{c.email}</p>
                                        </div>
                                    </div>
                                    {/* Plan badge — wrapped in flex so the inline-flex pill sits left-aligned at content width */}
                                    <div className="flex">
                                        {c.planKind === null ? <NoPlanBadge /> : <PlanBadge kind={c.planKind} />}
                                    </div>
                                    {/* Add button */}
                                    <button type="button" onClick={() => onAdd(c)}
                                        className="h-10 px-3 inline-flex items-center justify-center gap-1.5 border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] text-[14px] font-semibold text-[#344054] hover:bg-[#f9fafb] transition-colors">
                                        <Plus className="w-4 h-4" />
                                        Add to class
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, pageSize, onPageChange, onPageSizeChange }: {
    page: number; totalPages: number; pageSize: number;
    onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void;
}) {
    const [sizeOpen, setSizeOpen] = useState(false);
    return (
        <div className="shrink-0 flex items-center gap-3 py-4 border-t border-[#e4e7ec]">
            <div className="relative flex items-center gap-2 flex-1">
                <button type="button" onClick={() => setSizeOpen(p => !p)}
                    className="flex items-center gap-1 px-3 py-[7px] border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] text-[14px] font-semibold text-[#344054]">
                    {pageSize}<ChevronLeft className="w-4 h-4 text-[#667085] rotate-90" />
                </button>
                {sizeOpen && (
                    <>
                        <div className="fixed inset-0 z-30" onClick={() => setSizeOpen(false)} />
                        <div className="absolute bottom-[calc(100%+4px)] left-0 z-40 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 min-w-[80px]">
                            {[10, 20, 30].map(s => (
                                <button key={s} type="button" onClick={() => { onPageSizeChange(s); setSizeOpen(false); }}
                                    className={cn("flex items-center w-full px-4 py-[9px] text-[14px] font-medium hover:bg-[#f9fafb] transition-colors",
                                        s === pageSize ? "text-[#101828] font-semibold" : "text-[#344054]")}>{s}</button>
                            ))}
                        </div>
                    </>
                )}
                <span className="text-[14px] font-medium text-[#344054]">per page</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-[14px] font-medium text-[#344054] whitespace-nowrap">Page {page} of {totalPages}</span>
                <button type="button" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}
                    className={cn("px-3 py-[7px] border rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page <= 1 ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Previous</button>
                <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                    className={cn("px-3 py-[7px] border rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page >= totalPages ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Next</button>
            </div>
        </div>
    );
}

// ─── Empty table illustration (matches class-template page) ───────────────────

function EmptyTableIllustration() {
    return (
        <div className="bg-[#f9fafb] rounded-[16px] p-[10px] w-[360px] flex gap-[10px] items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)] shrink-0">
            <div className="bg-white rounded-[10px] w-[51px] h-[51px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02),-3px_4.4px_10.2px_rgba(0,0,0,0.02)]">
                <div className="bg-[#f9fafb] rounded-[7px] w-[31px] h-[31px] flex items-center justify-center shadow-[0px_1.5px_1.5px_rgba(0,0,0,0.04)]">
                    <AlignLeft className="w-[18px] h-[18px] text-[#98a2b3]" />
                </div>
            </div>
            <div className="flex flex-col gap-[8px] flex-1 min-w-0">
                <div className="h-2 bg-[#e4e7ec] rounded-full w-3/4" />
                <div className="h-2 bg-[#e4e7ec] rounded-full w-1/2" />
            </div>
        </div>
    );
}

// ─── Row action for booked tab ────────────────────────────────────────────────

function BookedRowActions({ variant, onCancel, onRemove, onPresent, presentDisabled }: {
    variant: "upcoming" | "ongoing";
    onCancel?: () => void;
    onRemove?: () => void;
    onPresent?: () => void;
    presentDisabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button type="button" onClick={() => setOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors">
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-[calc(100%+4px)] z-40 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 min-w-[200px]">
                        {variant === "upcoming" ? (
                            <>
                                <button type="button" onClick={() => { setOpen(false); onCancel?.(); }}
                                    className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                                    <SlashCircle01 className="w-4 h-4 text-[#667085]" />
                                    Cancel customer
                                </button>
                                <button type="button" onClick={() => { setOpen(false); onRemove?.(); }}
                                    className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                                    <Trash01 className="w-4 h-4 text-[#b42318]" />
                                    Remove customer
                                </button>
                            </>
                        ) : (
                            <button type="button" disabled={presentDisabled} onClick={() => { setOpen(false); onPresent?.(); }}
                                className={cn(
                                    "flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium transition-colors",
                                    presentDisabled
                                        ? "text-[#98a2b3] cursor-not-allowed"
                                        : "text-[#344054] hover:bg-[#f9fafb]"
                                )}>
                                <CheckCircle className={cn("w-4 h-4", presentDisabled ? "text-[#d0d5dd]" : "text-[#067647]")} />
                                <span className={presentDisabled ? "" : "text-[#067647]"}>{presentDisabled ? "Already present" : "Present"}</span>
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Checkbox cell ────────────────────────────────────────────────────────────

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
                    : "bg-white border-[#d0d5dd] hover:border-[#7ba08c]"
            )}>
            {indeterminate ? (
                <span className="block w-2 h-[1.5px] bg-white" />
            ) : checked ? (
                <Check className="w-3 h-3" />
            ) : null}
        </button>
    );
}

// ─── Remove confirmation modal (hard delete, no refund) ───────────────────────

/** Remove customer booking — matches Figma node 4009:33877. */
function RemoveBookingModal({ open, count, sampleName, defaultRefund = true, onClose, onConfirm }: {
    open: boolean; count: number; sampleName: string;
    /** Initial state of the refund toggle when the modal opens. */
    defaultRefund?: boolean;
    onClose: () => void;
    onConfirm: (refund: boolean) => void;
}) {
    const [refund, setRefund] = useState(defaultRefund);
    useEffect(() => { if (open) setRefund(defaultRefund); }, [open, defaultRefund]);
    if (!open) return null;
    const isBulk = count > 1;
    const title = isBulk ? `Remove ${count} customers from the class?` : "Remove this customer from the class?";
    const desc = isBulk
        ? "Are you sure you want to remove these customers from the booked session? This action cannot be undone."
        : sampleName
            ? null
            : "Are you sure you want to remove this customer from the booked session? This action cannot be undone.";
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
                {/* Header */}
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#fee4e2] flex items-center justify-center shrink-0">
                        <Trash02 className="w-6 h-6 text-[#d92d20]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            {!isBulk && sampleName
                                ? <>Are you sure you want to remove <span className="font-medium text-[#344054]">{sampleName}</span> from the booked session? This action cannot be undone.</>
                                : desc}
                        </p>
                    </div>
                </div>
                <div className="h-5 shrink-0" />
                <div className="h-px w-full bg-[#e4e7ec]" />
                {/* Refund toggle row */}
                <div className="flex items-center justify-between gap-4 px-6 py-5">
                    <div className="flex flex-col gap-1 min-w-0">
                        <p className="text-[16px] font-medium text-[#101828]">Refund class session</p>
                        <p className="text-[14px] text-[#475467] leading-[20px]">{refundDesc}</p>
                    </div>
                    <Toggle on={refund} onChange={setRefund} />
                </div>
                {/* Actions */}
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <button type="button" onClick={onClose}
                        className="flex-1 py-[10px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] font-semibold text-[#344054] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors">
                        Cancel
                    </button>
                    <button type="button" onClick={() => onConfirm(refund)}
                        className="flex-1 py-[10px] rounded-[8px] text-[16px] font-semibold text-white bg-[#d92d20] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#b42318] transition-colors">
                        Yes, remove booking
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Floating bulk action bar — matches Figma node 6754:152640 ────────────────

type BulkVariant = "upcoming" | "ongoing" | "reviews";

function BulkActionBar({ variant, count, onClear, onCancel, onRemove, onPresent, onDelete }: {
    variant: BulkVariant;
    count: number;
    onClear: () => void;
    onCancel?: () => void;
    onRemove?: () => void;
    onPresent?: () => void;
    onDelete?: () => void;
}) {
    if (count === 0) return null;
    return (
        <div className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none pb-[96px] pt-6 px-6 z-30">
            <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-[600px] max-w-full">
                {/* Selection counter pill */}
                <button type="button" onClick={onClear}
                    className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors">
                    {count} selected
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                {/* Actions */}
                <div className="flex items-center gap-3">
                    {variant === "upcoming" && (
                        <>
                            <button type="button" onClick={onCancel}
                                className="flex items-center gap-1 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#344054] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors">
                                <SlashCircle01 className="w-5 h-5 text-[#667085]" />
                                <span className="px-0.5">Cancel</span>
                            </button>
                            <button type="button" onClick={onRemove}
                                className="flex items-center gap-1 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#b42318] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#fef3f2] transition-colors">
                                <Trash02 className="w-5 h-5 text-[#b42318]" />
                                <span className="px-0.5">Remove</span>
                            </button>
                        </>
                    )}
                    {variant === "ongoing" && (
                        <button type="button" onClick={onPresent}
                            className="flex items-center gap-1 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#067647] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#ecfdf3] transition-colors">
                            <CheckCircle className="w-5 h-5 text-[#067647]" />
                            <span className="px-0.5">Mark present</span>
                        </button>
                    )}
                    {variant === "reviews" && (
                        <button type="button" onClick={onDelete}
                            className="flex items-center gap-1 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#b42318] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#fef3f2] transition-colors">
                            <Trash02 className="w-5 h-5 text-[#b42318]" />
                            <span className="px-0.5">Delete review</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Delete review modal ──────────────────────────────────────────────────────

function DeleteReviewModal({ open, count, sampleName, onClose, onConfirm }: {
    open: boolean; count: number; sampleName: string;
    onClose: () => void; onConfirm: () => void;
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
                                ? "These reviews will be hidden from the class page and moved to the deletion log."
                                : <>The review from <span className="font-medium text-[#344054]">{sampleName}</span> will be hidden from the class page and moved to the deletion log.</>}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <button type="button" onClick={onClose}
                        className="flex-1 py-[10px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] font-semibold text-[#344054] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors">
                        Cancel
                    </button>
                    <button type="button" onClick={onConfirm}
                        className="flex-1 py-[10px] rounded-[8px] text-[16px] font-semibold text-white bg-[#d92d20] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#b42318] transition-colors">
                        {isBulk ? "Yes, delete reviews" : "Yes, delete review"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Review row dropdown (Reviews & Rating tab) ───────────────────────────────

function ReviewRowActions({ onDelete }: { onDelete: () => void }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button type="button" onClick={() => setOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors">
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-[calc(100%+4px)] z-40 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 min-w-[180px]">
                        <button type="button" onClick={() => { setOpen(false); onDelete(); }}
                            className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                            <Trash01 className="w-4 h-4 text-[#b42318]" />
                            Delete review
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Star rating row ──────────────────────────────────────────────────────────

function StarRow({ score, size = 20 }: { score: number; size?: number }) {
    return (
        <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map(i => {
                const filled = i + 0.5 <= score;
                const half = !filled && i + 0.5 < score + 0.5 && score - i > 0 && score - i < 1;
                return (
                    <Star01 key={i}
                        style={{ width: size, height: size }}
                        className={cn(filled || half ? "text-[#fdb022]" : "text-[#e4e7ec]")}
                        fill={filled ? "#fdb022" : half ? "url(#half-star)" : "none"} />
                );
            })}
        </div>
    );
}

// ─── "What stood out" tag ─────────────────────────────────────────────────────

function StoodOutTag({ label }: { label: string }) {
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full border-1 border-[#e4e7ec] bg-white text-[12px] font-medium text-[#344054] whitespace-nowrap">
            {label}
        </span>
    );
}

// ─── Table cell styles ────────────────────────────────────────────────────────

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

// ─── Left panel — banner + info + actions (matches class-template LeftPanel) ──

/** Rating-summary card — shown in the left panel for Cancelled and Completed classes. */
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

function LeftPanel({ ci, isUpcoming, isOngoing, isCancelled, isCompleted, canCancelClass, onAddCustomer, onEdit, onCancelClass }: {
    ci: ClassInstance;
    isUpcoming: boolean; isOngoing: boolean; isCancelled: boolean; isCompleted: boolean; canCancelClass: boolean;
    onAddCustomer: () => void; onEdit: () => void; onCancelClass: () => void;
}) {
    const canAddCustomer = isUpcoming || isOngoing;
    const canEdit = isUpcoming || isOngoing;
    const showRatingSummary = isCancelled || isCompleted;
    const noActions = !canAddCustomer && !canEdit && !canCancelClass;
    return (
        <div className="w-[320px] shrink-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden h-full">
            {/* Banner */}
            <div className="relative h-[155px] shrink-0 overflow-hidden" style={{ backgroundColor: ci.coverColor }}>
                {ci.coverImage ? (
                    <img src={ci.coverImage} alt={ci.name} className="absolute inset-0 w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[36px] font-bold" style={{ color: "#3b5446" }}>
                            {ci.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                        </span>
                    </div>
                )}
                <div className="absolute top-3 right-3">
                    <ClassStatusBadge status={ci.status} />
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    {/* Name + description */}
                    <div>
                        <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{ci.name}</h2>
                        <p className="text-[14px] text-[#667085] leading-[20px] mt-1 line-clamp-2">{ci.description}</p>
                    </div>

                    {/* Info fields */}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Date &amp; time</p>
                            <p className="text-[16px] font-medium text-[#101828]">{ci.date} • {ci.displayTime}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <p className="text-[14px] text-[#667085]">Class type</p>
                                <p className="text-[16px] font-medium text-[#101828]">Group class</p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <p className="text-[14px] text-[#667085]">Gender access</p>
                                <p className="text-[16px] font-medium text-[#101828]">All genders</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Duration</p>
                            <p className="text-[16px] font-medium text-[#101828]">{diffMinutes(ci.startTime, ci.endTime)} minutes</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Class capacity</p>
                            <p className="text-[16px] font-medium text-[#101828]">{ci.capacity} participants</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Location</p>
                            <p className="text-[16px] font-medium text-[#101828]">{ci.room}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Instructor</p>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                                    style={{ backgroundColor: ci.instructorColor }}>
                                    {ci.instructorInitials}
                                </div>
                                <p className="text-[16px] font-medium text-[#101828]">
                                    {(() => {
                                        const parts = ci.instructorName.split(" ");
                                        if (parts.length === 1) return parts[0];
                                        return `${parts[0]} ${parts.slice(1).map(p => p[0]).join(".")}.`;
                                    })()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions / Rating summary */}
                {showRatingSummary ? (
                    <RatingSummary rating={ci.rating} count={ci.ratingCount} />
                ) : (
                    <div className="px-6 pb-6 shrink-0">
                        <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                        <p className="text-[14px] text-[#667085] mb-4">Class actions</p>
                        <div className="flex flex-col gap-4">
                            {canAddCustomer && (
                                <button type="button" onClick={onAddCustomer}
                                    className="flex items-center gap-2 text-[16px] font-semibold text-[#475467] hover:text-[#101828] transition-colors">
                                    <UserPlus01 className="w-5 h-5" />
                                    Add customer
                                </button>
                            )}
                            {canEdit && (
                                <button type="button" onClick={onEdit}
                                    className="flex items-center gap-2 text-[16px] font-semibold text-[#475467] hover:text-[#101828] transition-colors">
                                    <Edit02 className="w-5 h-5" />
                                    Edit class
                                </button>
                            )}
                            {canCancelClass && (
                                <button type="button" onClick={onCancelClass}
                                    className="flex items-center gap-2 text-[16px] font-semibold text-[#b42318] hover:text-[#912018] transition-colors">
                                    <Trash04 className="w-5 h-5" />
                                    Cancel class
                                </button>
                            )}
                            {noActions && (
                                <p className="text-[14px] text-[#98a2b3] italic">No actions available for {ci.status.toLowerCase()} classes.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const BASE_TABS: { id: DetailTab; label: string }[] = [
    { id: "booked",     label: "Booked" },
    { id: "waitlisted", label: "Waitlisted" },
    { id: "cancelled",  label: "Cancelled" },
];
const COMPLETED_TABS: { id: DetailTab; label: string }[] = [
    ...BASE_TABS,
    { id: "reviews", label: "Reviews & Rating" },
];

export default function ClassDetailPage() {
    const router = useRouter();
    const params = useParams();
    const classId = String(params.classId);
    const {
        classInstances, classBookings, classRatings,
        customers: allCustomers,
        cancelClassInstance, cancelClassBooking, cancelClassBookings,
        removeClassBooking, removeClassBookings,
        updateAttendance, deleteClassRating,
        showToast,
    } = useAppStore();
    const customerById = useMemo(() => new Map(allCustomers.map(c => [c.id, c])), [allCustomers]);

    const classInstance = classInstances.find(c => c.id === classId);
    const allBookings = classBookings.filter(b => b.classInstanceId === classId);
    const classIsCancelled = classInstance?.status === "Cancelled";

    // When the class itself is cancelled, the Booked tab shows the bookings that
    // existed at the moment of class-cancellation (i.e. cancellationReason === "Class cancelled").
    // The Cancelled tab still shows customer-initiated cancellations only.
    const bookedBookings = useMemo(
        () => classIsCancelled
            ? allBookings.filter(b => b.status === "cancelled" && b.cancellationReason === "Class cancelled")
            : allBookings.filter(b => b.status === "booked"),
        [allBookings, classIsCancelled]
    );
    const waitlistBookings = useMemo(() => allBookings.filter(b => b.status === "waitlisted").sort((a, b) => (a.waitlistPosition ?? 99) - (b.waitlistPosition ?? 99)), [allBookings]);
    const cancelledBookings = useMemo(
        () => classIsCancelled
            ? allBookings.filter(b => b.status === "cancelled" && b.cancellationReason !== "Class cancelled")
            : allBookings.filter(b => b.status === "cancelled"),
        [allBookings, classIsCancelled]
    );

    const [tab, setTab] = useState<DetailTab>("booked");
    const [search, setSearch] = useState("");
    const [appliedFilter, setAppliedFilter] = useState<BookingFilter>(EMPTY_FILTER);
    const [filterOpen, setFilterOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [cancelClassOpen, setCancelClassOpen] = useState(false);
    const [cancelBookingTarget, setCancelBookingTarget] = useState<ClassBooking | null>(null);
    const [removeBookingTarget, setRemoveBookingTarget] = useState<ClassBooking | null>(null);

    // Bulk-select state — Booked tab (Upcoming/Ongoing) and Reviews tab.
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
    const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
    const [bulkPresentOpen, setBulkPresentOpen] = useState(false);
    const [bulkDeleteReviewsOpen, setBulkDeleteReviewsOpen] = useState(false);
    const [addCustomerOpen, setAddCustomerOpen] = useState(false);
    // Re-open the Add Customer modal automatically when returning from /customers/new
    // (the new-customer page appends ?openAddCustomer=1 to the returnTo path).
    const searchParams = useSearchParams();
    useEffect(() => {
        if (searchParams.get("openAddCustomer") === "1") {
            setAddCustomerOpen(true);
            // strip the param so refreshes don't keep re-opening it
            const url = new URL(window.location.href);
            url.searchParams.delete("openAddCustomer");
            window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
        }
    }, [searchParams]);

    // Reviews & Rating tab state
    const [reviewsSubTab, setReviewsSubTab] = useState<ReviewsSubTab>("ratings");
    const [deleteReviewTarget, setDeleteReviewTarget] = useState<ClassRating | null>(null);
    const [appliedReviewFilter, setAppliedReviewFilter] = useState<ReviewFilter>(EMPTY_REVIEW_FILTER);
    const [reviewFilterOpen, setReviewFilterOpen] = useState(false);

    // Filter helper — applies search + applied filter to a list of bookings
    const filterBookings = (list: ClassBooking[]): ClassBooking[] => {
        const q = search.toLowerCase();
        return list.filter(b => {
            if (q && !b.customerName.toLowerCase().includes(q)) return false;
            if (appliedFilter.plans.length > 0 && !appliedFilter.plans.includes(planKindFromName(b.planName))) return false;
            if (appliedFilter.startDate && b.bookingTime.slice(0, 10) < appliedFilter.startDate) return false;
            if (appliedFilter.endDate && b.bookingTime.slice(0, 10) > appliedFilter.endDate) return false;
            return true;
        });
    };

    const filteredBooked = filterBookings(bookedBookings);
    const filteredWaitlist = filterBookings(waitlistBookings);
    const filteredCancelled = filterBookings(cancelledBookings);

    // Sort comparators
    const bookingComparators: Record<string, (a: ClassBooking, b: ClassBooking) => number> = {
        name: (a, b) => a.customerName.localeCompare(b.customerName),
        booking: (a, b) => a.bookingTime.localeCompare(b.bookingTime),
        plan: (a, b) => a.planName.localeCompare(b.planName),
        spot: (a, b) => {
            const ia = bookedBookings.indexOf(a);
            const ib = bookedBookings.indexOf(b);
            return ia - ib;
        },
        position: (a, b) => (a.waitlistPosition ?? 99) - (b.waitlistPosition ?? 99),
        status: (a, b) => Number(b.refundCreditIssued ?? false) - Number(a.refundCreditIssued ?? false),
    };
    const { sorted: sortedBooked,    sortKey: bookedSortKey,    sortDir: bookedSortDir,    toggle: toggleBookedSort    } = useSort(filteredBooked,    bookingComparators);
    const { sorted: sortedWaitlist,  sortKey: waitlistSortKey,  sortDir: waitlistSortDir,  toggle: toggleWaitlistSort  } = useSort(filteredWaitlist,  bookingComparators);
    const { sorted: sortedCancelled, sortKey: cancelledSortKey, sortDir: cancelledSortDir, toggle: toggleCancelledSort } = useSort(filteredCancelled, bookingComparators);

    if (!classInstance) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-[18px] font-semibold text-[#101828]">Class not found</p>
                    <button type="button" onClick={() => router.push("/admin/schedule")}
                        className="mt-4 text-[14px] text-[#658774] hover:underline">
                        Back to schedule
                    </button>
                </div>
            </div>
        );
    }
    const ci: ClassInstance = classInstance;

    const isUpcoming = ci.status === "Upcoming";
    const isOngoing = ci.status === "Ongoing";
    const isCancelled = ci.status === "Cancelled";
    const isCompleted = ci.status === "Completed";
    const canCancelClass = isUpcoming || isOngoing;

    // Cancellation timing — used to default the refund toggle in the per-row
    // Cancel/Remove customer modals. Over-24h cancellations are "early" and refund
    // by default; under-24h are "late" and follow the standard forfeit policy.
    const classStartMs = new Date(`${ci.dateISO}T${ci.startTime}:00`).getTime();
    const hoursAhead = (classStartMs - Date.now()) / (1000 * 60 * 60);
    const cancelDefaultRefund = hoursAhead >= 24;
    const TABS = isCompleted ? COMPLETED_TABS : BASE_TABS;

    const activeRows = tab === "booked" ? sortedBooked : tab === "waitlisted" ? sortedWaitlist : sortedCancelled;
    const totalPages = Math.max(1, Math.ceil(activeRows.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const sliceStart = (clampedPage - 1) * pageSize;
    const paginatedRows = activeRows.slice(sliceStart, sliceStart + pageSize);

    function handleTabChange(t: DetailTab) {
        setTab(t);
        setSearch("");
        setAppliedFilter(EMPTY_FILTER);
        setAppliedReviewFilter(EMPTY_REVIEW_FILTER);
        setPage(1);
        setSelectedIds(new Set());
    }

    function handleCancelClass(refund: boolean) {
        cancelClassInstance(ci.id, refund);
        setCancelClassOpen(false);
        showToast(
            "Class cancelled successfully",
            `${ci.name} on ${ci.date} has been cancelled${refund ? " and customers' credits have been returned to their balance" : ""}.`,
            "error", "slash"
        );
    }

    function handleCancelBooking(refund: boolean) {
        if (!cancelBookingTarget) return;
        cancelClassBooking(cancelBookingTarget.id, "Cancelled by admin", refund);
        setCancelBookingTarget(null);
        setSelectedIds(prev => { const next = new Set(prev); next.delete(cancelBookingTarget!.id); return next; });
        showToast(
            "Customer cancelled successfully",
            refund
                ? "The customer's class session has been returned to their balance."
                : "The customer has been cancelled from the class.",
            "error", "slash"
        );
    }

    function handleRemoveBooking(refund: boolean) {
        if (!removeBookingTarget) return;
        removeClassBooking(removeBookingTarget.id);
        setRemoveBookingTarget(null);
        setSelectedIds(prev => { const next = new Set(prev); next.delete(removeBookingTarget!.id); return next; });
        showToast(
            "Customer removed successfully",
            refund
                ? "The customer's class session has been returned to their balance."
                : "The customer has been removed from the class.",
            "error", "trash"
        );
    }

    function handleBulkCancel(refund: boolean) {
        const ids = Array.from(selectedIds);
        if (!ids.length) return;
        cancelClassBookings(ids, "Cancelled by admin", refund);
        setBulkCancelOpen(false);
        setSelectedIds(new Set());
        showToast(
            `${ids.length} customer${ids.length === 1 ? "" : "s"} cancelled successfully`,
            refund ? "Class sessions have been returned to their balances." : "Customers have been cancelled from the class.",
            "error", "slash"
        );
    }

    function handleBulkRemove(refund: boolean) {
        const ids = Array.from(selectedIds);
        if (!ids.length) return;
        removeClassBookings(ids);
        setBulkRemoveOpen(false);
        setSelectedIds(new Set());
        showToast(
            `${ids.length} customer${ids.length === 1 ? "" : "s"} removed successfully`,
            refund ? "Class sessions have been returned to their balances." : "Customers have been removed from the class.",
            "error", "trash"
        );
    }

    function handleMarkPresent(b: ClassBooking) {
        updateAttendance(b.id, "present");
        showToast(
            "Attendance marked as present",
            "The customer has been marked as present for this class.",
            "success", "check"
        );
    }

    function handleBulkPresent() {
        const ids = Array.from(selectedIds);
        if (!ids.length) return;
        ids.forEach(id => updateAttendance(id, "present"));
        setBulkPresentOpen(false);
        setSelectedIds(new Set());
        showToast(
            "Attendance marked as present",
            `${ids.length} customer${ids.length === 1 ? "" : "s"} marked present for this class.`,
            "success", "check"
        );
    }

    function handleDeleteReview() {
        if (!deleteReviewTarget) return;
        deleteClassRating(deleteReviewTarget.id, "Alex Owen");
        const name = deleteReviewTarget.customerName;
        setDeleteReviewTarget(null);
        setSelectedIds(prev => { const n = new Set(prev); n.delete(deleteReviewTarget!.id); return n; });
        showToast(
            "Review deleted successfully",
            `${name}'s review has been moved to the deletion log.`,
            "error", "trash"
        );
    }

    function handleBulkDeleteReviews() {
        const ids = Array.from(selectedIds);
        if (!ids.length) return;
        ids.forEach(id => deleteClassRating(id, "Alex Owen"));
        setBulkDeleteReviewsOpen(false);
        setSelectedIds(new Set());
        showToast(
            `${ids.length} review${ids.length === 1 ? "" : "s"} deleted successfully`,
            `Moved to the deletion log.`,
            "error", "trash"
        );
    }

    function handleAddCustomer(c: Customer) {
        useAppStore.setState(state => {
            const isFull = ci.booked >= ci.capacity;
            const planId = c.planKind === "membership" ? "m1" : c.planKind === "package" ? "p1" : "";
            const newBooking: ClassBooking = {
                id: `b-${Date.now()}`,
                classInstanceId: ci.id,
                customerId: c.id,
                customerName: `${c.firstName} ${c.lastName}`,
                customerInitials: c.initials,
                customerColor: "#e0e0e0",
                planId,
                planName: c.planName ?? "No plan",
                bookingTime: new Date().toISOString(),
                status: isFull ? "waitlisted" : "booked",
                attendanceStatus: "pending",
                ...(isFull ? { waitlistPosition: waitlistBookings.length + 1 } : {}),
            };
            return {
                classBookings: [...state.classBookings, newBooking],
                classInstances: isFull
                    ? state.classInstances
                    : state.classInstances.map(inst => inst.id === ci.id ? { ...inst, booked: inst.booked + 1 } : inst),
            };
        });
        setAddCustomerOpen(false);
        showToast("Customer added", `${c.firstName} ${c.lastName} has been added to ${ci.name}.`, "success", "check");
    }

    const bookedCount = bookedBookings.length;
    const waitlistCount = waitlistBookings.length;
    const cancelledCount = cancelledBookings.length;
    const existingCustomerIds = new Set(allBookings.filter(b => b.status !== "cancelled").map(b => b.customerId));
    const bookedIndexById = new Map(bookedBookings.map((b, i) => [b.id, i]));

    // Reviews & Rating data
    const allRatings = classRatings.filter(r => r.classInstanceId === ci.id);
    const visibleRatings = allRatings.filter(r => !r.deletedAt);
    const deletedRatings = allRatings.filter(r => !!r.deletedAt);
    const reviewsListRaw = reviewsSubTab === "ratings" ? visibleRatings : deletedRatings;
    const reviewsList = reviewsListRaw.filter(r => {
        if (search) {
            const q = search.toLowerCase();
            if (!r.customerName.toLowerCase().includes(q) && !r.comment.toLowerCase().includes(q)) return false;
        }
        if (appliedReviewFilter.startDate && r.submittedAt.slice(0, 10) < appliedReviewFilter.startDate) return false;
        if (appliedReviewFilter.endDate && r.submittedAt.slice(0, 10) > appliedReviewFilter.endDate) return false;
        if (appliedReviewFilter.ratings.length > 0 && !appliedReviewFilter.ratings.includes(Math.floor(r.score))) return false;
        if (appliedReviewFilter.tags.length > 0) {
            const tags = r.tags ?? [];
            if (!appliedReviewFilter.tags.some(t => tags.includes(t))) return false;
        }
        return true;
    });
    const reviewsTotalPages = Math.max(1, Math.ceil(reviewsList.length / pageSize));
    const reviewsClampedPage = Math.min(Math.max(1, page), reviewsTotalPages);
    const paginatedReviews = reviewsList.slice((reviewsClampedPage - 1) * pageSize, reviewsClampedPage * pageSize);

    const hasActiveBookingFilter = appliedFilter.plans.length > 0 || !!appliedFilter.startDate || !!appliedFilter.endDate;
    const hasActiveReviewFilter = appliedReviewFilter.tags.length > 0 || appliedReviewFilter.ratings.length > 0 || !!appliedReviewFilter.startDate || !!appliedReviewFilter.endDate;
    const hasActiveFilter = tab === "reviews" ? hasActiveReviewFilter : hasActiveBookingFilter;
    const tabTotal = tab === "booked" ? bookedCount
        : tab === "waitlisted" ? waitlistCount
        : tab === "cancelled" ? cancelledCount
        : visibleRatings.length;

    const currentSortKey = tab === "booked" ? bookedSortKey : tab === "waitlisted" ? waitlistSortKey : tab === "cancelled" ? cancelledSortKey : null;
    const currentSortDir: SortDir = tab === "booked" ? bookedSortDir : tab === "waitlisted" ? waitlistSortDir : tab === "cancelled" ? cancelledSortDir : "desc";
    const currentToggleSort = tab === "booked" ? toggleBookedSort : tab === "waitlisted" ? toggleWaitlistSort : tab === "cancelled" ? toggleCancelledSort : () => {};

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push("/admin/schedule")}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Class details</h1>
            </div>

            {/* Two-column content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="flex gap-6 h-[832px]">
                    <LeftPanel
                        ci={ci}
                        isUpcoming={isUpcoming} isOngoing={isOngoing} isCancelled={isCancelled} isCompleted={isCompleted} canCancelClass={canCancelClass}
                        onAddCustomer={() => setAddCustomerOpen(true)}
                        onEdit={() => router.push(`/schedule/${ci.id}/edit`)}
                        onCancelClass={() => setCancelClassOpen(true)}
                    />

                    {/* Right panel */}
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-1 border-[#e4e7ec] rounded-[20px] relative">
                        {/* Tabs */}
                        <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                            <div className="flex gap-1">
                                {TABS.map(t => {
                                    const badge = t.id === "booked"
                                        ? `${bookedCount}/${ci.capacity}`
                                        : t.id === "waitlisted" ? String(waitlistCount)
                                        : t.id === "cancelled" ? String(cancelledCount)
                                        : String(visibleRatings.length);
                                    return (
                                        <button key={t.id} type="button" onClick={() => handleTabChange(t.id)}
                                            className={cn(
                                                "h-[48px] px-3 text-[14px] font-semibold transition-colors flex items-center gap-2 whitespace-nowrap",
                                                tab === t.id ? "border-b-2 border-[#101828] text-[#101828]" : "text-[#667085] hover:text-[#344054]",
                                            )}>
                                            {t.label}
                                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium",
                                                tab === t.id ? "bg-[#f2f4f7] text-[#344054]" : "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#667085]"
                                            )}>{badge}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Reviews tab — sub-tab pill switcher */}
                        {tab === "reviews" && (
                            <div className="shrink-0 px-6 pt-5">
                                <div className="flex bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[10px] p-1">
                                    {([
                                        { id: "ratings" as const,      label: "Rating & reviews" },
                                        { id: "deletion-log" as const, label: "Deletion log" },
                                    ]).map(s => (
                                        <button key={s.id} type="button"
                                            onClick={() => { setReviewsSubTab(s.id); setSearch(""); setPage(1); setSelectedIds(new Set()); }}
                                            className={cn(
                                                "flex-1 h-10 rounded-[8px] text-[14px] font-medium transition-colors",
                                                reviewsSubTab === s.id ? "bg-white text-[#344054] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" : "text-[#667085] hover:text-[#344054]"
                                            )}>
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Toolbar */}
                        <div className="shrink-0 flex items-center gap-3 px-6 py-4">
                            <div className="flex-1">
                                <p className="text-[14px] text-[#667085]">Total</p>
                                <p className="text-[14px] font-medium text-[#101828]">
                                    {tab === "reviews" ? `${reviewsList.length} ratings` : `${tabTotal} customers`}
                                </p>
                            </div>
                            <div className="relative w-[200px]">
                                <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                                <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                                    placeholder={tab === "reviews" ? "Search rating..." : "Search customer..."}
                                    className="h-9 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                                />
                            </div>
                            <Button variant="secondary-gray" size="md"
                                leftIcon={
                                    <div className="relative">
                                        <FilterLines className="w-4 h-4" />
                                        {hasActiveFilter && <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" />}
                                    </div>
                                }
                                onClick={() => tab === "reviews" ? setReviewFilterOpen(true) : setFilterOpen(true)}>
                                Filter
                            </Button>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                            {tab === "reviews" ? (
                                paginatedReviews.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="flex flex-col items-center gap-6 pointer-events-auto">
                                            <EmptyTableIllustration />
                                            <div className="flex flex-col items-center gap-1 text-center max-w-[320px]">
                                                <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">{
                                                    reviewsSubTab === "ratings" ? "No reviews yet" : "No deleted reviews"
                                                }</p>
                                                <p className="text-[14px] text-[#475467] leading-[20px]">{
                                                    reviewsSubTab === "ratings"
                                                        ? "Customer ratings and reviews for this class will appear here."
                                                        : "Reviews you remove will be listed here for audit."
                                                }</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="px-6">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr>
                                                    {reviewsSubTab === "ratings" && (
                                                        <th className={cn(TH, "w-[44px]")}>
                                                            {(() => {
                                                                const visibleIds = paginatedReviews.map(r => r.id);
                                                                const selectedVisible = visibleIds.filter(id => selectedIds.has(id));
                                                                const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
                                                                const someSelected = selectedVisible.length > 0 && !allSelected;
                                                                return (
                                                                    <CheckboxCell ariaLabel="Select all visible"
                                                                        checked={allSelected} indeterminate={someSelected}
                                                                        onChange={next => setSelectedIds(prev => {
                                                                            const n = new Set(prev);
                                                                            if (next) visibleIds.forEach(id => n.add(id));
                                                                            else visibleIds.forEach(id => n.delete(id));
                                                                            return n;
                                                                        })} />
                                                                );
                                                            })()}
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
                                                {paginatedReviews.map(r => (
                                                    <tr key={r.id} className="hover:bg-[#f9fafb] transition-colors">
                                                        {reviewsSubTab === "ratings" && (
                                                            <td className={TD}>
                                                                <CheckboxCell ariaLabel={`Select review by ${r.customerName}`}
                                                                    checked={selectedIds.has(r.id)}
                                                                    onChange={next => setSelectedIds(prev => {
                                                                        const n = new Set(prev);
                                                                        if (next) n.add(r.id); else n.delete(r.id);
                                                                        return n;
                                                                    })} />
                                                            </td>
                                                        )}
                                                        <td className={TD}>
                                                            <div className="flex items-center gap-3">
                                                                <TableAvatar initials={r.customerInitials} imageUrl={customerById.get(r.customerId)?.imageUrl} size={40} />
                                                                <div>
                                                                    <div className="text-[14px] font-medium text-[#101828]">{r.customerName}</div>
                                                                    <div className="text-[13px] text-[#667085]">{fmtBookingTime(r.submittedAt)}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className={TD}><StarRow score={r.score} /></td>
                                                        <td className={cn(TD, "text-[14px] text-[#475467] leading-[20px]")}>
                                                            <p className="max-w-[420px]">{r.comment}</p>
                                                        </td>
                                                        <td className={TD}>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {(r.tags ?? []).map(t => <StoodOutTag key={t} label={t} />)}
                                                            </div>
                                                        </td>
                                                        {reviewsSubTab === "ratings" && (
                                                            <td className={TD}>
                                                                <ReviewRowActions onDelete={() => setDeleteReviewTarget(r)} />
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            ) : paginatedRows.length === 0 ? (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="flex flex-col items-center gap-6 pointer-events-auto">
                                        <EmptyTableIllustration />
                                        <div className="flex flex-col items-center gap-1 text-center max-w-[320px]">
                                            <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">{
                                                tab === "booked" ? "No customers booked"
                                                : tab === "waitlisted" ? "No one on the waitlist"
                                                : "No cancellations"
                                            }</p>
                                            <p className="text-[14px] text-[#475467] leading-[20px]">{
                                                tab === "booked" ? "Customers who book this class will appear here."
                                                : tab === "waitlisted" ? "When the class fills up, new bookings join the waitlist."
                                                : "Cancelled bookings for this class will appear here."
                                            }</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="px-6">
                                    {(() => {
                                        // Per-tab column flags. Booked tab columns depend on the class state:
                                        //  - Upcoming  → Checkbox + Spot + Actions (Cancel/Remove)
                                        //  - Ongoing   → Status (Present badge if marked) + Actions (Present)
                                        //  - Cancelled → Status (Cancelled badge), no actions
                                        const showCheckbox = tab === "booked" && (isUpcoming || isOngoing);
                                        const showSpot = tab === "booked"
                                            ? isUpcoming
                                            : tab === "waitlisted"; // waitlist also shows Spot per the design
                                        const showWaitlistPos = tab === "waitlisted";
                                        const showStatus = (tab === "booked" && (isOngoing || isCancelled || isCompleted)) || tab === "cancelled";
                                        const showActions = tab === "booked" && (isUpcoming || isOngoing);
                                        return (
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr>
                                                        {showCheckbox && (
                                                            <th className={cn(TH, "w-[44px]")}>
                                                                {(() => {
                                                                    const visibleIds = paginatedRows.map(r => r.id);
                                                                    const selectedVisible = visibleIds.filter(id => selectedIds.has(id));
                                                                    const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
                                                                    const someSelected = selectedVisible.length > 0 && !allSelected;
                                                                    return (
                                                                        <CheckboxCell
                                                                            ariaLabel="Select all visible"
                                                                            checked={allSelected}
                                                                            indeterminate={someSelected}
                                                                            onChange={next => {
                                                                                if (next) {
                                                                                    setSelectedIds(prev => {
                                                                                        const n = new Set(prev);
                                                                                        visibleIds.forEach(id => n.add(id));
                                                                                        return n;
                                                                                    });
                                                                                } else {
                                                                                    setSelectedIds(prev => {
                                                                                        const n = new Set(prev);
                                                                                        visibleIds.forEach(id => n.delete(id));
                                                                                        return n;
                                                                                    });
                                                                                }
                                                                            }}
                                                                        />
                                                                    );
                                                                })()}
                                                            </th>
                                                        )}
                                                        <th className={cn(TH, "w-[220px]")}>
                                                            <SortableHeader sortKey="name" currentSort={currentSortKey} dir={currentSortDir} onSort={currentToggleSort}>Name</SortableHeader>
                                                        </th>
                                                        <th className={cn(TH, "w-[180px]")}>
                                                            <SortableHeader sortKey="booking" currentSort={currentSortKey} dir={currentSortDir} onSort={currentToggleSort}>Booking date</SortableHeader>
                                                        </th>
                                                        <th className={cn(TH, "w-[140px]")}>
                                                            <SortableHeader sortKey="plan" currentSort={currentSortKey} dir={currentSortDir} onSort={currentToggleSort}>Packages</SortableHeader>
                                                        </th>
                                                        {showWaitlistPos && (
                                                            <th className={cn(TH, "w-[140px]")}>
                                                                <SortableHeader sortKey="position" currentSort={currentSortKey} dir={currentSortDir} onSort={currentToggleSort}>Waitlist position</SortableHeader>
                                                            </th>
                                                        )}
                                                        {showSpot && <th className={cn(TH, "w-[80px]")}>Spot</th>}
                                                        {showStatus && (
                                                            <th className={cn(TH, "w-[200px]")}>
                                                                <SortableHeader sortKey="status" currentSort={currentSortKey} dir={currentSortDir} onSort={currentToggleSort}>Status</SortableHeader>
                                                            </th>
                                                        )}
                                                        {showActions && <th className={cn(TH, "w-[52px]")}></th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {paginatedRows.map(b => {
                                                        const spotLabel = ci.spotSelectionEnabled
                                                            ? spotForIndex(bookedIndexById.get(b.id) ?? 0)
                                                            : "—";
                                                        const isSelected = selectedIds.has(b.id);
                                                        return (
                                                            <tr key={b.id} className="hover:bg-[#f9fafb] transition-colors">
                                                                {showCheckbox && (
                                                                    <td className={TD}>
                                                                        <CheckboxCell
                                                                            ariaLabel={`Select ${b.customerName}`}
                                                                            checked={isSelected}
                                                                            onChange={next => setSelectedIds(prev => {
                                                                                const n = new Set(prev);
                                                                                if (next) n.add(b.id); else n.delete(b.id);
                                                                                return n;
                                                                            })}
                                                                        />
                                                                    </td>
                                                                )}
                                                                <td className={TD}>
                                                                    <div className="flex items-center gap-3">
                                                                        <TableAvatar initials={b.customerInitials} imageUrl={customerById.get(b.customerId)?.imageUrl} size={40} />
                                                                        <div>
                                                                            <div className="text-[14px] font-medium text-[#101828]">{b.customerName}</div>
                                                                            <div className="text-[13px] text-[#667085]">{b.customerName.toLowerCase().replace(/\s+/g, ".")}@email.com</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className={TD}>{fmtBookingTime(b.bookingTime)}</td>
                                                                <td className={TD}><PlanBadge kind={planKindFromName(b.planName)} /></td>
                                                                {showWaitlistPos && (
                                                                    <td className={TD}>#{b.waitlistPosition ?? "—"}</td>
                                                                )}
                                                                {showSpot && <td className={TD}>{spotLabel}</td>}
                                                                {showStatus && (
                                                                    <td className={TD}>
                                                                        {tab === "booked" && (isOngoing || isCompleted)
                                                                            ? (b.attendanceStatus === "present"
                                                                                ? <PresentBadge />
                                                                                : b.attendanceStatus === "no_show"
                                                                                    ? <NoShowBadge />
                                                                                    : null)
                                                                            : <BookingStatusBadge kind={cancellationBadgeKind({
                                                                                cancelledAt: b.cancelledAt,
                                                                                classDateISO: ci.dateISO,
                                                                                classStartTime: ci.startTime,
                                                                            })} />}
                                                                    </td>
                                                                )}
                                                                {showActions && (
                                                                    <td className={TD}>
                                                                        {isUpcoming ? (
                                                                            <BookedRowActions variant="upcoming"
                                                                                onCancel={() => setCancelBookingTarget(b)}
                                                                                onRemove={() => setRemoveBookingTarget(b)} />
                                                                        ) : (
                                                                            <BookedRowActions variant="ongoing"
                                                                                presentDisabled={b.attendanceStatus === "present"}
                                                                                onPresent={() => handleMarkPresent(b)} />
                                                                        )}
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        {(tab === "reviews" ? reviewsList.length > 0 : activeRows.length > 0) && (
                            <div className="px-6 shrink-0">
                                <Pagination
                                    page={tab === "reviews" ? reviewsClampedPage : clampedPage}
                                    totalPages={tab === "reviews" ? reviewsTotalPages : totalPages}
                                    pageSize={pageSize}
                                    onPageChange={setPage}
                                    onPageSizeChange={s => { setPageSize(s); setPage(1); }}
                                />
                            </div>
                        )}

                        {/* Bulk-action floating bar */}
                        {tab === "booked" && isUpcoming && (
                            <BulkActionBar
                                variant="upcoming"
                                count={selectedIds.size}
                                onClear={() => setSelectedIds(new Set())}
                                onCancel={() => setBulkCancelOpen(true)}
                                onRemove={() => setBulkRemoveOpen(true)}
                            />
                        )}
                        {tab === "booked" && isOngoing && (
                            <BulkActionBar
                                variant="ongoing"
                                count={selectedIds.size}
                                onClear={() => setSelectedIds(new Set())}
                                onPresent={() => setBulkPresentOpen(true)}
                            />
                        )}
                        {tab === "reviews" && (
                            <BulkActionBar
                                variant="reviews"
                                count={selectedIds.size}
                                onClear={() => setSelectedIds(new Set())}
                                onDelete={() => setBulkDeleteReviewsOpen(true)}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Right-slide filter panels — Booking for booked/waitlist/cancelled, Review for reviews tab */}
            <BookingFilterPanel
                open={filterOpen} onClose={() => setFilterOpen(false)}
                applied={appliedFilter}
                onApply={f => { setAppliedFilter(f); setPage(1); }}
            />
            <ReviewFilterPanel
                open={reviewFilterOpen} onClose={() => setReviewFilterOpen(false)}
                applied={appliedReviewFilter}
                onApply={f => { setAppliedReviewFilter(f); setPage(1); }}
            />

            {/* Modals */}
            <CancelClassModal
                open={cancelClassOpen} classInstance={ci} bookedCount={bookedCount}
                onClose={() => setCancelClassOpen(false)}
                onConfirm={handleCancelClass}
            />
            <CancelBookingModal
                open={!!cancelBookingTarget}
                count={1}
                sampleName={cancelBookingTarget?.customerName ?? ""}
                defaultRefund={cancelDefaultRefund}
                onClose={() => setCancelBookingTarget(null)}
                onConfirm={handleCancelBooking}
            />
            <RemoveBookingModal
                open={!!removeBookingTarget}
                count={1}
                sampleName={removeBookingTarget?.customerName ?? ""}
                defaultRefund={cancelDefaultRefund}
                onClose={() => setRemoveBookingTarget(null)}
                onConfirm={handleRemoveBooking}
            />
            <CancelBookingModal
                open={bulkCancelOpen}
                count={selectedIds.size}
                sampleName=""
                defaultRefund={cancelDefaultRefund}
                onClose={() => setBulkCancelOpen(false)}
                onConfirm={handleBulkCancel}
            />
            <RemoveBookingModal
                open={bulkRemoveOpen}
                count={selectedIds.size}
                sampleName=""
                defaultRefund={cancelDefaultRefund}
                onClose={() => setBulkRemoveOpen(false)}
                onConfirm={handleBulkRemove}
            />
            <AddCustomerModal
                open={addCustomerOpen}
                existingCustomerIds={existingCustomerIds}
                onClose={() => setAddCustomerOpen(false)}
                onAdd={handleAddCustomer}
            />

            {/* Bulk mark-present confirmation */}
            {bulkPresentOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center">
                    <div className="absolute inset-0 bg-[#0c111d]/60" onClick={() => setBulkPresentOpen(false)} />
                    <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                        <button type="button" onClick={() => setBulkPresentOpen(false)}
                            className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                            <XClose className="w-6 h-6 text-[#667085]" />
                        </button>
                        <div className="flex flex-col items-center gap-4 pt-6 px-6">
                            <div className="w-12 h-12 rounded-full bg-[#ecfdf3] flex items-center justify-center shrink-0">
                                <CheckCircle className="w-6 h-6 text-[#067647]" />
                            </div>
                            <div className="flex flex-col gap-1 text-center w-full">
                                <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Mark {selectedIds.size} customer{selectedIds.size === 1 ? "" : "s"} as present?</h3>
                                <p className="text-[14px] text-[#475467] leading-[20px]">
                                    The selected customers will be marked as present for this class.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 px-6 pt-6 pb-6">
                            <button type="button" onClick={() => setBulkPresentOpen(false)}
                                className="flex-1 py-[10px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] font-semibold text-[#344054] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors">
                                Cancel
                            </button>
                            <button type="button" onClick={handleBulkPresent}
                                className="flex-1 py-[10px] rounded-[8px] text-[16px] font-semibold text-white bg-[#658774] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#3b5446] transition-colors">
                                Yes, mark present
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <DeleteReviewModal
                open={!!deleteReviewTarget}
                count={1}
                sampleName={deleteReviewTarget?.customerName ?? ""}
                onClose={() => setDeleteReviewTarget(null)}
                onConfirm={handleDeleteReview}
            />
            <DeleteReviewModal
                open={bulkDeleteReviewsOpen}
                count={selectedIds.size}
                sampleName=""
                onClose={() => setBulkDeleteReviewsOpen(false)}
                onConfirm={handleBulkDeleteReviews}
            />

            <Toast />
        </div>
    );
}
