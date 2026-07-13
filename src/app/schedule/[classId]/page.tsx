"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import {
    XClose, ChevronRight, SearchMd, FilterLines, DotsVertical, AlignLeft,
    UserPlus01, Edit02, Trash04, Trash01, Trash02, SlashCircle01, Check, CheckCircle, Star01, Plus, Minus,
    Lightbulb02, CreditCard02, ShoppingBag03, Users01, Sale04, Package, SwitchHorizontal01, AlertCircle,
} from "@untitledui/icons";
import { ProductPosCard, type ProductPosCardType } from "@/components/ui/ProductPosCard";
import type { PurchaseLineItem } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { DetailPageShell } from "@/components/patterns/DetailPageShell";
import { Pagination } from "@/components/ui/Pagination";
import { useAppStore, type ClassInstance, type ClassBooking, type Customer, type Membership as MembershipType, type Package as PackageType, type GenderAccess } from "@/lib/store";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { FilterPill } from "@/components/ui/FilterPill";
import { DatePicker } from "@/components/ui/DatePicker";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { PlanBadge, BookingStatusBadge, PresentBadge, NoShowBadge, NoPlanBadge, planKindFromName, cancellationBadgeKind } from "@/components/ui/badge";
import { ClassCustomerBadges } from "@/components/customers/CustomerBadges";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { TableAvatar } from "@/components/ui/avatar";
import type { ClassRating } from "@/lib/store";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { RowActions } from "@/components/patterns/RowActions";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { branchTzLabel } from "@/lib/branch-time";

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

// ─── Filter pill (used in the right-slide panel) ──────────────────────────────


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


    function togglePlan(p: "membership" | "package") {
        setPending(prev => ({
            ...prev,
            plans: prev.plans.includes(p) ? prev.plans.filter(x => x !== p) : [...prev.plans, p],
        }));
    }

    const hasAny = pending.plans.length > 0 || !!pending.startDate || !!pending.endDate;

    return (
        <SlidePanel open={open} onClose={onClose} width={400}>
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
                                <DatePicker value={pending.startDate}
                                    onChange={v => setPending(p => {
                                        const next = { ...p, startDate: v };
                                        if (p.endDate && v && p.endDate < v) next.endDate = "";
                                        return next;
                                    })} />
                            </div>
                            <div className="flex-1">
                                <DatePicker value={pending.endDate}
                                    onChange={v => setPending(p => ({ ...p, endDate: v }))}
                                    minDate={pending.startDate || undefined} />
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
        </SlidePanel>
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


    function toggleTag(t: string) {
        setPending(p => ({ ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t] }));
    }
    function toggleRating(n: number) {
        setPending(p => ({ ...p, ratings: p.ratings.includes(n) ? p.ratings.filter(x => x !== n) : [...p.ratings, n] }));
    }

    const hasAny = !!pending.startDate || !!pending.endDate || pending.tags.length > 0 || pending.ratings.length > 0;

    return (
        <SlidePanel open={open} onClose={onClose} width={400}>
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
        </SlidePanel>
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
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={() => onConfirm(refund)}>
                        Yes, cancel booking
                    </Button>
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
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={() => onConfirm(true)}>
                        Yes, cancel class
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Add customer modal — picks an existing customer from the store ───────────

function AddCustomerModal({ open, existingCustomerIds, applicableMembershipIds, applicablePackageIds, genderAccess, onClose, onAdd }: {
    open: boolean;
    existingCustomerIds: Set<string>;
    /** From the class template — only customers whose current plan is in one
     *  of these lists are shown. No-plan customers always appear so the
     *  admin can walk them through POS to buy an applicable plan. */
    applicableMembershipIds: string[];
    applicablePackageIds: string[];
    /** Class gender restriction — a gender-restricted class only lists
     *  customers of the matching gender. */
    genderAccess: GenderAccess;
    onClose: () => void;
    onAdd: (customer: Customer) => void;
}) {
    const router = useRouter();
    const customers = useAppStore(s => s.customers);
    const [search, setSearch] = useState("");
    useEffect(() => { if (open) setSearch(""); }, [open]);
    if (!open) return null;

    function planMatchesTemplate(c: Customer): boolean {
        if (c.planKind === null) return true;
        if (c.planKind === "membership") {
            return !!c.membershipId && applicableMembershipIds.includes(c.membershipId);
        }
        // package — at least one of their packages must be applicable.
        return (c.packageIds ?? []).some(id => applicablePackageIds.includes(id));
    }

    // Gender-restricted classes only accept customers of the matching gender.
    // Customers with no gender on file can't be verified, so they're excluded
    // from a restricted class.
    function genderMatchesClass(c: Customer): boolean {
        if (genderAccess === "all") return true;
        return (c.gender ?? "").toLowerCase() === genderAccess;
    }

    const restricted = genderAccess !== "all";
    const genderWord = genderAccess === "female" ? "female" : "male";

    const available = customers.filter(c =>
        !existingCustomerIds.has(c.id) &&
        planMatchesTemplate(c) &&
        genderMatchesClass(c) &&
        (
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
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            {restricted
                                ? `This class is open to ${genderWord} customers only — pick one to add.`
                                : "Select a customer to add to this class."}
                        </p>
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
                    <Button
                        variant="secondary-gray"
                        size="icon"
                        onClick={() => router.push(`/customers/new?returnTo=${encodeURIComponent(window.location.pathname + "?openAddCustomer=1")}`)}
                        title="Create new customer"
                    >
                        <Plus className="w-5 h-5 text-[#344054]" />
                    </Button>
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
                                    <Button variant="secondary-gray" size="md" leftIcon={<Plus className="w-4 h-4" />} onClick={() => onAdd(c)}>
                                        Add to class
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Plan icons (skeuomorphic, matching Figma cart-panel rows) ──────────────
// Both badges share the same skeuomorphic chrome (1.47px white/12 border, soft
// sage outer glow, inset top-left highlight) — only the inner tint + icon
// change so membership cards visually parallel credit-package cards.
//
//   Membership → indigo-100 bg + CreditCard02 (Figma 2849:53013)
//   Package    → secondary-200 bg + Package    (Figma 6379:54781)
function PlanIconBadge({ kind, size = 40 }: { kind: "membership" | "package"; size?: 40 | 32 }) {
    const inner = size === 40 ? 24 : 20;
    const tint = kind === "membership"
        ? { bg: "bg-[#e0eaff]", icon: "text-[#3538cd]" }
        : { bg: "bg-[var(--brand-tertiary)]", icon: "text-[#658774]" };
    const Icon = kind === "membership" ? CreditCard02 : Package;
    return (
        <div
            className={cn(
                "relative shrink-0 border-1 border-white/12 rounded-[8.84px] flex items-center justify-center backdrop-blur-[4.85px]",
                "shadow-[0px_1.94px_1.94px_rgba(0,0,0,0.04),-3.88px_5.82px_11.63px_rgba(224,248,164,0.08),5.82px_5.82px_11.63px_rgba(224,248,164,0.06),0px_1.94px_11.63px_rgba(224,248,164,0.12)]",
                tint.bg,
            )}
            style={{ width: size, height: size }}
        >
            <Icon className={tint.icon} style={{ width: inner, height: inner }} />
            <div className="absolute inset-0 pointer-events-none rounded-[8.84px] shadow-[inset_2.5px_2.5px_3.33px_0px_rgba(255,255,255,0.2)]" />
        </div>
    );
}

// Back-compat shims so the existing call sites read naturally.
function PackageIconBadge({ size = 40 }: { size?: 40 | 32 } = {}) {
    return <PlanIconBadge kind="package" size={size} />;
}
function MembershipIconBadge({ size = 40 }: { size?: 40 | 32 } = {}) {
    return <PlanIconBadge kind="membership" size={size} />;
}

// ─── Payment confirmation modal — Figma 4011:48148 ────────────────────────────
// Shown after admin picks a customer in AddCustomerModal. Two variants:
//   • Customer has plan → existing plan card + Confirm payment enabled
//   • Customer has no plan → "Buy packages" + Select membership card + Confirm disabled
//
// Multi-package: when `customer.packageIds` has 2+ entries, the plan card
// turns into a radio list so admin picks which package's credit will fund
// this booking. The selected planId flows back via onConfirm(planId).
function PaymentConfirmationModal({ open, customer, classInstance, onClose, onConfirm, onSelectMembership, onSwitchCustomer }: {
    open: boolean;
    customer: Customer | null;
    classInstance: ClassInstance | null;
    onClose: () => void;
    onConfirm: (planId?: string) => void;
    onSelectMembership: () => void;
    onSwitchCustomer: () => void;
}) {
    // Track which package the admin picked (multi-package customers only).
    // Defaults to the first package; re-syncs whenever the customer changes.
    const initialPackageId = customer?.planKind === "package" ? customer.packageIds?.[0] : undefined;
    const [selectedPackageId, setSelectedPackageId] = useState<string | undefined>(initialPackageId);
    useEffect(() => { setSelectedPackageId(initialPackageId); }, [initialPackageId]);
    // Live plan lookups so renamed / removed plans reflect here too.
    const allPackages = useAppStore(s => s.packages);
    const allMemberships = useAppStore(s => s.memberships);

    if (!open || !customer || !classInstance) return null;
    const hasPlan = customer.planKind !== null;
    const customerPackages = (customer.packageIds ?? [])
        .map(id => allPackages.find(p => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p);
    const hasMultiplePackages = customer.planKind === "package" && customerPackages.length > 1;

    // ── Credit balance ──────────────────────────────────────────────────────
    // Unlimited memberships never run out; every other plan draws on the
    // customer's `creditsRemaining` balance. A `0` balance means the plan is
    // exhausted — the booking can't proceed until a new plan is purchased.
    const membership = customer.membershipId
        ? allMemberships.find(m => m.id === customer.membershipId)
        : undefined;
    const isUnlimited = customer.planKind === "membership" && membership?.credits === "unlimited";
    const creditsRemaining = customer.creditsRemaining;
    const hasZeroCredits = hasPlan && !isUnlimited && creditsRemaining === 0;

    // Plan-card subtitle — credit balance + expiry derived from the plan's
    // duration applied to the customer's join date.
    const planExpiry = (() => {
        const d = new Date(customer.createdAt);
        if (Number.isNaN(d.getTime())) return "";
        if (customer.planKind === "membership" && membership) {
            d.setMonth(d.getMonth() + membership.duration_months);
        } else if (customer.planKind === "package" && customerPackages.length === 1) {
            d.setDate(d.getDate() + customerPackages[0].validity_days);
        } else {
            return "";
        }
        return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    })();
    const planCreditsLabel = isUnlimited
        ? "Unlimited access"
        : creditsRemaining != null
            ? `${creditsRemaining} Credit${creditsRemaining === 1 ? "" : "s"}`
            : "Active";
    const planSubtitle = planExpiry
        ? `${planCreditsLabel} • Expiry ${planExpiry}`
        : planCreditsLabel;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-full max-w-[720px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-start gap-4 px-6 pt-6">
                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                        <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">Payment confirmation</p>
                        <p className="text-[14px] text-[#475467] leading-[20px]">Review customer details and complete the payment to finalize this booking.</p>
                    </div>
                    <button type="button" onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0 -mt-1 -mr-2">
                        <XClose className="w-6 h-6 text-[#667085]" />
                    </button>
                </div>
                <div className="h-5 shrink-0" />
                {/* Header → body divider runs edge-to-edge (no horizontal gap). */}
                <div className="h-px bg-[#e4e7ec] shrink-0" />

                {/* Body — scrollable. Section dividers inside are inset 24px each side. */}
                <div className="flex-1 overflow-y-auto flex flex-col">
                    {/* Customer section — clicking the row swaps the customer
                        via onSwitchCustomer (re-opens AddCustomerModal). */}
                    <div className="flex flex-col gap-4 px-6 py-5">
                        <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">Customer</p>
                        <button type="button" onClick={onSwitchCustomer}
                            className="flex items-center gap-3 p-4 bg-white border-1 border-[#e4e7ec] rounded-[12px] w-full text-left hover:bg-[#f9fafb] transition-colors">
                            <TableAvatar initials={customer.initials} imageUrl={customer.imageUrl} size={40} />
                            <div className="flex-1 min-w-0 flex items-center gap-4">
                                <div className="flex flex-col">
                                    <p className="text-[14px] font-medium text-[#101828] truncate">{customer.firstName} {customer.lastName}</p>
                                    <p className="text-[14px] text-[#475467] truncate">{customer.email}</p>
                                </div>
                                {customer.planKind === null ? <NoPlanBadge /> : <PlanBadge kind={customer.planKind} />}
                            </div>
                            <SwitchHorizontal01 className="w-5 h-5 text-[#667085] shrink-0" />
                        </button>
                    </div>

                    <div className="mx-6 h-px bg-[#e4e7ec] shrink-0" />

                    {/* Detail class section */}
                    <div className="flex flex-col gap-4 px-6 py-5">
                        <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">Detail class</p>
                        <div className="flex items-center gap-3 w-full">
                            <div className="w-16 h-16 rounded-[8px] border-1 border-[#e4e7ec] overflow-hidden shrink-0 bg-white">
                                {classInstance.coverImage
                                    ? <img src={classInstance.coverImage} alt={classInstance.name} className="w-full h-full object-cover" />
                                    : <div className="w-full h-full" style={{ backgroundColor: classInstance.coverColor }} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-medium text-[#101828]">{classInstance.name}</p>
                                <p className="text-[14px] text-[#475467]">{classInstance.date} • {classInstance.displayTime}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <div className="w-4 h-4 rounded-full overflow-hidden bg-[#e0e0e0] shrink-0 flex items-center justify-center">
                                        <span className="text-[8px] font-semibold text-white" style={{ backgroundColor: classInstance.instructorColor }}>
                                            {classInstance.instructorInitials}
                                        </span>
                                    </div>
                                    <p className="text-[12px] text-[#667085]">{classInstance.instructorName.split(" ")[0]} {classInstance.instructorName.split(" ").slice(-1)[0][0]}.</p>
                                </div>
                            </div>
                            <p className="text-[14px] font-medium text-[#101828] whitespace-nowrap">1 credit</p>
                        </div>
                    </div>

                    <div className="mx-6 h-px bg-[#e4e7ec] shrink-0" />

                    {/* Spot section */}
                    <div className="flex flex-col gap-4 px-6 py-5">
                        <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">Spot</p>
                        <div className="flex items-center gap-4 p-4 bg-[#e9fff3] border-1 border-[#7ba08c] rounded-[12px]">
                            <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0" />
                            <p className="text-[14px] text-[#475467] flex-1">A spot will be auto assigned to this customer.</p>
                        </div>
                    </div>

                    <div className="mx-6 h-px bg-[#e4e7ec] shrink-0" />

                    {/* Select plan section — variants */}
                    <div className="flex flex-col px-6 py-5">
                    {hasPlan ? (
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                                <p className="flex-1 text-[18px] font-semibold text-[#101828] leading-[28px]">Select plan</p>
                                <button type="button" onClick={onSelectMembership} className="flex items-center gap-2 text-[16px] font-semibold text-[#475467] hover:text-[#344054] transition-colors">
                                    <ShoppingBag03 className="w-5 h-5" />
                                    Purchase new
                                </button>
                            </div>
                            {/* Exhausted-plan warning — the customer holds an applicable
                                plan but has 0 credits left, so a new purchase is needed. */}
                            {hasZeroCredits && (
                                <div className="flex items-center gap-4 p-4 rounded-[12px] bg-[#fffaeb] border-1 border-[#fedf89] shadow-[0px_1px_1px_0px_rgba(16,24,40,0.05)]">
                                    <div className="relative shrink-0 w-5 h-5">
                                        <div className="absolute inset-[-16.67%] rounded-full border-[1.667px] border-[#dc6803] opacity-30" />
                                        <div className="absolute inset-[-37.5%] rounded-full border-[1.667px] border-[#dc6803] opacity-10" />
                                        <AlertCircle className="w-5 h-5 text-[#dc6803]" />
                                    </div>
                                    <p className="flex-1 text-[14px] text-[#475467] leading-[20px]">
                                        This customer has an active plan for this class with 0 credit. A new plan purchase is required to continue.
                                    </p>
                                </div>
                            )}
                            {hasMultiplePackages ? (
                                // Multi-package customers pick which package
                                // funds the booking — radio on the right.
                                <div className="flex flex-col gap-2">
                                    {customerPackages.map(pkg => {
                                        const selected = selectedPackageId === pkg.id;
                                        return (
                                            <button key={pkg.id} type="button" onClick={() => setSelectedPackageId(pkg.id)}
                                                className={cn(
                                                    "flex items-center gap-3 p-4 rounded-[12px] text-left transition-colors w-full",
                                                    selected ? "border-2 border-[#658774] bg-[#f5fffa]" : "border-1 border-[#e4e7ec] bg-white hover:bg-[#f9fafb]",
                                                )}>
                                                <PackageIconBadge />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[14px] font-medium text-[#101828] truncate">{pkg.name}</p>
                                                    <p className="text-[14px] text-[#667085]">{pkg.credits} credit{pkg.credits === 1 ? "" : "s"} • Active</p>
                                                </div>
                                                <div className={cn(
                                                    "w-4 h-4 rounded-full flex items-center justify-center shrink-0 border-1",
                                                    selected ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd]",
                                                )}>
                                                    {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                // Single-plan customers (membership OR 1 package) — non-selectable card.
                                <div className="flex items-start gap-3 p-4 bg-white border-1 border-[#e4e7ec] rounded-[12px]">
                                    {customer.planKind === "membership" ? <MembershipIconBadge /> : <PackageIconBadge />}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] font-medium text-[#101828]">{customer.planName}</p>
                                        <p className="text-[14px] text-[#667085]">{planSubtitle}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">Buy packages</p>
                            <button type="button" onClick={onSelectMembership}
                                className="flex items-center gap-3 p-4 bg-white border-1 border-[#e4e7ec] rounded-[12px] w-full text-left hover:bg-[#f9fafb] transition-colors">
                                <div className="w-10 h-10 rounded-[6px] bg-[#f9fafb] border-1 border-[#e4e7ec] flex items-center justify-center shrink-0 shadow-[0px_1px_1px_rgba(0,0,0,0.04)]">
                                    <ShoppingBag03 className="w-5 h-5 text-[#475467]" />
                                </div>
                                <p className="flex-1 text-[16px] font-medium text-[#344054]">Select membership</p>
                                <ChevronRight className="w-5 h-5 text-[#667085] shrink-0" />
                            </button>
                        </div>
                    )}
                    </div>
                </div>

                {/* Footer — body→footer divider runs edge-to-edge (no horizontal gap). */}
                <div className="h-px bg-[#e4e7ec] shrink-0" />
                <div className="flex gap-3 px-6 pt-6 pb-6 shrink-0">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="lg" className="flex-1" disabled={!hasPlan || hasZeroCredits} onClick={() => onConfirm(selectedPackageId)}>
                        Confirm payment
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Room capacity reached modal — Figma 4029:35699 ───────────────────────────
function RoomCapacityModal({ open, onClose, onConfirm }: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onClose}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#fef0c7] flex items-center justify-center shrink-0">
                        <Users01 className="w-6 h-6 text-[#dc6803]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Room capacity limit reached</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            This booking exceeds the room capacity. The client will be placed on the waitlist.
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="lg" className="flex-1 bg-[#fdb022] text-[#101828] hover:bg-[#f79009] active:bg-[#dc6803]" onClick={onConfirm}>
                        Add to waitlist
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Add-customer confirmation modal — Figma 6717:714841 ──────────────────────
// Shown when the class has open capacity and admin clicked "Confirm payment".
// Last sanity-check before the booking is actually written.
function AddCustomerConfirmationModal({ open, onClose, onConfirm }: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onClose}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#d7ffe9] flex items-center justify-center shrink-0">
                        <Users01 className="w-6 h-6 text-[#658774]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Add customer to this class?</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            The customer will be added to this class and their balance may be updated accordingly.
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="lg" className="flex-1" onClick={onConfirm}>
                        Add to booked
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Point of sale modal — Figma 4029:71676 ───────────────────────────────────
// Shortcut from the schedule module's Payment confirmation when the customer
// has no plan (or admin clicked "Purchase new" to upgrade). Renders 3 memberships
// + 3 credit packages in a 3-column grid using <ProductPosCard>. After Continue,
// the user-promised "Checkout confirmation modal" picks up the cart.
//
// Business rule (per CLAUDE.md and user instruction):
//   • A customer can have 1 membership OR multiple credit packages — never both.
//   • The card whose type conflicts with what's already in the cart is disabled.
type PosProduct = {
    id: string;
    type: ProductPosCardType;
    name: string;
    primaryMeta: string;
    secondaryMeta: string;
    priceAed: number;
};

// Built FROM LIVE STORE STATE — memberships + packages mutate via the
// /admin/products module and this list re-renders. Display strings
// (primaryMeta/secondaryMeta) are derived from each row's columns.
function buildPosProducts(memberships: MembershipType[], packages: PackageType[]): PosProduct[] {
    return [
        ...memberships.filter(m => m.status === "active").map<PosProduct>(m => ({
            id: m.id,
            type: "membership",
            name: m.name,
            primaryMeta: m.credits === "unlimited" ? "Unlimited" : `${m.credits} Credits`,
            secondaryMeta: `${m.duration_months} Month${m.duration_months === 1 ? "" : "s"}`,
            priceAed: m.price_aed,
        })),
        ...packages.filter(p => p.status === "active").map<PosProduct>(p => ({
            id: p.id,
            type: "package",
            name: p.name,
            primaryMeta: p.credits === 1 ? "1 Class" : `${p.credits} Credits`,
            secondaryMeta: `${p.validity_days} Days`,
            priceAed: p.price_aed,
        })),
    ];
}

function POSModal({ open, onClose, onContinue, customer, applicableMembershipIds, applicablePackageIds }: {
    open: boolean;
    onClose: () => void;
    onContinue: (cart: Record<string, number>) => void;
    /** Current customer — drives the membership↔package mutex (a customer
     *  with a membership can't add packages until they cancel; same the other way). */
    customer: Customer | null;
    /** From the class template — only show products that apply to this class. */
    applicableMembershipIds: string[];
    applicablePackageIds: string[];
}) {
    /** Map of productId → quantity. Empty cart = {}. */
    const [cart, setCart] = useState<Record<string, number>>({});
    // Live store-derived catalog — picks up admin mutations from /admin/products.
    const memberships = useAppStore(s => s.memberships);
    const packages = useAppStore(s => s.packages);
    const posProducts = useMemo(() => buildPosProducts(memberships, packages), [memberships, packages]);

    // Reset cart whenever the modal closes so a fresh open starts empty.
    useEffect(() => { if (!open) setCart({}); }, [open]);

    if (!open) return null;

    // Apply the class-template "Applicable plans" filter — only show the
    // memberships/packages the class accepts. (The full POS module later
    // will list everything; this is the class-scoped mini-POS.)
    const applicableProducts = posProducts.filter(p =>
        p.type === "membership"
            ? applicableMembershipIds.includes(p.id)
            : applicablePackageIds.includes(p.id),
    );

    const hasMembership = applicableProducts.some(p => p.type === "membership" && (cart[p.id] ?? 0) > 0);
    const hasPackage    = applicableProducts.some(p => p.type === "package"    && (cart[p.id] ?? 0) > 0);
    const cartIsEmpty   = !hasMembership && !hasPackage;

    // Customer's existing plan kind — drives mutex *across* sessions, not just within the cart.
    // Rule: customer can hold 1 membership OR multiple packages, never both.
    const customerHasMembership = customer?.planKind === "membership";
    const customerHasPackage    = customer?.planKind === "package";

    function handleAdd(p: PosProduct) {
        setCart(prev => ({ ...prev, [p.id]: 1 }));
    }
    function handleIncrement(p: PosProduct) {
        // Memberships are capped at 1 (single-purchase rule).
        if (p.type === "membership") return;
        setCart(prev => ({ ...prev, [p.id]: (prev[p.id] ?? 0) + 1 }));
    }
    function handleDecrement(p: PosProduct) {
        setCart(prev => {
            const next = (prev[p.id] ?? 0) - 1;
            const copy = { ...prev };
            if (next <= 0) delete copy[p.id];
            else copy[p.id] = next;
            return copy;
        });
    }

    function isCardDisabled(p: PosProduct) {
        const qty = cart[p.id] ?? 0;
        if (qty > 0) return false;                  // already in cart — keep stepper alive
        // Customer-plan mutex (cross-session): if they already own a membership,
        // they can't buy packages until they cancel — and vice versa.
        if (p.type === "package"    && customerHasMembership) return true;
        if (p.type === "membership" && customerHasPackage)    return true;
        // In-cart mutex (within this session).
        if (p.type === "membership" && hasPackage) return true;
        if (p.type === "membership" && hasMembership) return true;   // 1 membership max
        if (p.type === "package" && hasMembership) return true;
        return false;
    }

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-full max-w-[1080px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-start gap-4 px-6 pt-6">
                    <p className="flex-1 text-[18px] font-semibold text-[#101828] leading-[28px]">Point of Sale</p>
                    <button type="button" onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0 -mt-1 -mr-2">
                        <XClose className="w-6 h-6 text-[#667085]" />
                    </button>
                </div>
                <div className="h-5 shrink-0" />
                <div className="h-px w-full bg-[#e4e7ec]" />

                {/* Body — 3-col grid of POS cards (filtered by class template applicable plans) */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {applicableProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2">
                            <p className="text-[16px] font-medium text-[#101828]">No applicable plans</p>
                            <p className="text-[14px] text-[#667085]">This class template doesn&rsquo;t accept any memberships or packages yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-4">
                            {applicableProducts.map(p => (
                                <ProductPosCard
                                    key={p.id}
                                    type={p.type}
                                    name={p.name}
                                    primaryMeta={p.primaryMeta}
                                    secondaryMeta={p.secondaryMeta}
                                    price={`AED ${p.priceAed.toLocaleString()}`}
                                    quantity={cart[p.id] ?? 0}
                                    disabled={isCardDisabled(p)}
                                    onAdd={() => handleAdd(p)}
                                    onIncrement={() => handleIncrement(p)}
                                    onDecrement={() => handleDecrement(p)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 pt-4 pb-6 border-t border-[#e4e7ec] shrink-0">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Back
                    </Button>
                    <Button variant="primary" size="lg" className="flex-1" disabled={cartIsEmpty} onClick={() => onContinue(cart)}>
                        Continue
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Checkout confirmation modal — Figma 4029:83208 ───────────────────────────
// Shown after POS "Continue" with the resolved cart. Admin reviews the line
// items, optionally applies a promo code or a custom % discount, and proceeds
// to the dedicated /checkout payment route.
function CheckoutConfirmationModal({ open, customer, items, onClose, onBackToCart, onProceed, canApplyCustomDiscount }: {
    open: boolean;
    customer: Customer | null;
    items: PurchaseLineItem[];
    onClose: () => void;
    /** Called when the user empties the cart via the qty stepper — they should return to POSModal to re-shop. */
    onBackToCart: () => void;
    onProceed: (finalItems: PurchaseLineItem[], discountPercent: number, promoCode?: string) => void;
    /** Owner / Branch Admin only — per business rule, other roles can't apply ad-hoc discounts. */
    canApplyCustomDiscount: boolean;
}) {
    // Local-editable copy of the cart (qty steppers can mutate before proceed).
    const [lineItems, setLineItems] = useState<PurchaseLineItem[]>(items);
    const [promoCode, setPromoCode] = useState("");
    const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
    const [customDiscountChecked, setCustomDiscountChecked] = useState(false);
    const [customDiscountInput, setCustomDiscountInput] = useState("");
    const [appliedCustomDiscount, setAppliedCustomDiscount] = useState<number | null>(null);

    // Reset state when the modal re-opens with a fresh cart.
    useEffect(() => {
        if (open) {
            setLineItems(items);
            setPromoCode("");
            setAppliedPromo(null);
            setCustomDiscountChecked(false);
            setCustomDiscountInput("");
            setAppliedCustomDiscount(null);
        }
    }, [open, items]);

    if (!open || !customer) return null;

    const subtotal = lineItems.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
    // Promo is a flat 20% in this prototype (matches Figma "FREE20"). Custom
    // discount overrides the promo when present.
    const promoPercent = appliedPromo ? 20 : 0;
    const discountPercent = appliedCustomDiscount ?? promoPercent;
    const discountAmount = Math.round(subtotal * (discountPercent / 100));
    // Tax defaults to 0 — per-product tax rates will ship with the Tax
    // settings module (PRD 11). Until then no tax row renders anywhere.
    const taxRate = 0;
    const taxAmount = Math.round((subtotal - discountAmount) * (taxRate / 100));
    const total = subtotal - discountAmount + taxAmount;

    function incrementQty(idx: number) {
        setLineItems(prev => prev.map((it, i) => i === idx
            ? { ...it, quantity: it.productType === "membership" ? 1 : it.quantity + 1 }
            : it));
    }
    function decrementQty(idx: number) {
        const target = lineItems[idx];
        if (!target) return;
        // If decrementing the only remaining line item to zero, bounce back to the
        // POS picker rather than leaving the user stranded on an empty checkout.
        if (lineItems.length === 1 && target.quantity === 1) {
            onBackToCart();
            return;
        }
        setLineItems(prev => prev.flatMap((it, i) => {
            if (i !== idx) return [it];
            const next = it.quantity - 1;
            if (next <= 0) return [];
            return [{ ...it, quantity: next }];
        }));
    }

    function handleApplyPromo() {
        const code = promoCode.trim().toUpperCase();
        if (!code) return;
        setAppliedPromo(code);
        // If a custom discount was active, the promo takes precedence (single-discount UX).
        if (customDiscountChecked) {
            setCustomDiscountChecked(false);
            setAppliedCustomDiscount(null);
        }
    }
    function handleApplyCustomDiscount() {
        const pct = Math.min(100, Math.max(0, Number(customDiscountInput) || 0));
        if (pct <= 0) return;
        setAppliedCustomDiscount(pct);
        if (appliedPromo) setAppliedPromo(null);
    }
    function handleCustomDiscountToggle() {
        const next = !customDiscountChecked;
        setCustomDiscountChecked(next);
        if (!next) {
            setAppliedCustomDiscount(null);
            setCustomDiscountInput("");
        }
    }

    function handleProceed() {
        if (lineItems.length === 0) return;
        onProceed(lineItems, discountPercent, appliedPromo ?? undefined);
    }

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-full max-w-[720px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-start gap-4 px-6 pt-6">
                    <p className="flex-1 text-[18px] font-semibold text-[#101828] leading-[28px]">Checkout confirmation</p>
                    <button type="button" onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0 -mt-1 -mr-2">
                        <XClose className="w-6 h-6 text-[#667085]" />
                    </button>
                </div>
                <div className="h-5 shrink-0" />
                <div className="h-px w-full bg-[#e4e7ec]" />

                {/* Body — scrollable. Customer + Products sections. */}
                <div className="flex-1 overflow-y-auto flex flex-col">
                    {/* Customer */}
                    <div className="flex flex-col gap-4 px-6 py-5 border-b border-[#e4e7ec]">
                        <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">Customer</p>
                        <div className="flex items-center gap-3 p-4 bg-white border-1 border-[#e4e7ec] rounded-[12px] w-full">
                            <TableAvatar initials={customer.initials} imageUrl={customer.imageUrl} size={40} />
                            <div className="flex-1 min-w-0 flex flex-col">
                                <p className="text-[14px] font-medium text-[#101828] truncate">{customer.firstName} {customer.lastName}</p>
                                <p className="text-[14px] text-[#475467] truncate">{customer.email}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-[#667085] shrink-0" />
                        </div>
                    </div>

                    {/* Products list */}
                    <div className="flex flex-col gap-4 px-6 py-5">
                        <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">Products</p>
                        <div className="flex flex-col gap-3">
                            {lineItems.map((it, idx) => (
                                <div key={it.productId} className="flex items-center gap-3 p-4 bg-white border-1 border-[#e4e7ec] rounded-[12px]">
                                    <div className={cn(
                                        "w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0 shadow-[inset_2px_2px_3px_rgba(255,255,255,0.2)]",
                                        it.productType === "membership" ? "bg-[#e0eaff]" : "bg-[var(--brand-tertiary)]"
                                    )}>
                                        {it.productType === "membership"
                                            ? <CreditCard02 className="w-5 h-5 text-[#3538cd]" />
                                            : <Package className="w-5 h-5 text-[#658774]" />}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                        <p className="text-[14px] font-medium text-[#101828] truncate">{it.name}</p>
                                        <div className="flex items-center gap-1.5 text-[14px] font-medium">
                                            <span className="text-[#658774]">AED {it.unitPrice}</span>
                                        </div>
                                    </div>
                                    <div className="border-1 border-[#e4e7ec] rounded-[8px] flex items-center gap-3 px-1.5 py-1.5 shrink-0">
                                        <button type="button" onClick={() => decrementQty(idx)} className="w-[18px] h-[18px] flex items-center justify-center text-[#667085] hover:text-[#101828] transition-colors">
                                            <Minus className="w-[18px] h-[18px]" />
                                        </button>
                                        <span className="text-[12px] font-semibold text-[#101828] min-w-[16px] text-center">{it.quantity}</span>
                                        <button type="button" onClick={() => incrementQty(idx)} disabled={it.productType === "membership"} className="w-[18px] h-[18px] flex items-center justify-center text-[#667085] hover:text-[#101828] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                            <Plus className="w-[18px] h-[18px]" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sticky footer panel — discount controls + totals + buttons */}
                <div className="bg-[#f8f8f6] border-t border-[#e4e7ec] flex flex-col gap-5 px-6 py-6 shrink-0">
                    <div className="flex flex-col gap-3">
                        {customDiscountChecked ? (
                            // Custom discount input (replaces promo input when admin opts in)
                            <>
                                <div className="flex items-end gap-3">
                                    <div className="flex flex-col gap-1.5 flex-1">
                                        <label className="text-[14px] font-medium text-[#344054]">Custom discount</label>
                                        <div className="flex items-center h-10 bg-white border-1 border-[#d0d5dd] rounded-[8px] px-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                            <input type="number" min="0" max="100" value={customDiscountInput}
                                                onChange={e => setCustomDiscountInput(e.target.value.replace(/^0+(?=\d)/, ""))}
                                                placeholder="0"
                                                className="flex-1 bg-transparent text-[16px] text-[#101828] placeholder-[#667085] focus:outline-none" />
                                            <span className="text-[16px] text-[#667085] ml-2">%</span>
                                        </div>
                                    </div>
                                    <Button variant="secondary-gray" size="md" onClick={handleApplyCustomDiscount}>Apply</Button>
                                </div>
                            </>
                        ) : (
                            // Promo code input (default)
                            <>
                                <div className="flex items-end gap-3">
                                    <div className="flex flex-col gap-1.5 flex-1">
                                        <label className="text-[14px] font-medium text-[#344054]">Promotion</label>
                                        <div className="flex items-center h-10 bg-white border-1 border-[#d0d5dd] rounded-[8px] px-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                            <Sale04 className="w-5 h-5 text-[#667085] shrink-0" />
                                            <input type="text" value={promoCode}
                                                onChange={e => setPromoCode(e.target.value)}
                                                placeholder="Enter promotion"
                                                className="flex-1 bg-transparent text-[16px] text-[#101828] placeholder-[#667085] focus:outline-none ml-2" />
                                        </div>
                                    </div>
                                    <Button variant="secondary-gray" size="md" onClick={handleApplyPromo}>Apply</Button>
                                </div>
                                {appliedPromo && (
                                    <div className="flex flex-col gap-1.5">
                                        <p className="text-[14px] text-[#667085]">Applied promo</p>
                                        <div className="bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[8px] flex items-center gap-1 pl-3 pr-2.5 py-2">
                                            <span className="flex-1 text-[14px] font-medium text-[#344054]">{appliedPromo}</span>
                                            <button type="button" onClick={() => setAppliedPromo(null)} className="text-[#667085] hover:text-[#101828]">
                                                <XClose className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Apply custom discount checkbox — Owner/Branch Admin only */}
                        {canApplyCustomDiscount && (
                            <button type="button" onClick={handleCustomDiscountToggle} className="flex items-start gap-2 text-left">
                                <span className={cn(
                                    "w-4 h-4 rounded-[4px] border-1 flex items-center justify-center mt-0.5 shrink-0 transition-colors",
                                    customDiscountChecked ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd]"
                                )}>
                                    {customDiscountChecked && <Check className="w-3 h-3 text-white" />}
                                </span>
                                <span className="text-[14px] font-medium text-[#344054]">Apply custom discount</span>
                            </button>
                        )}
                    </div>

                    {/* Detail payment */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#101828]">Detail payment</p>
                        <div className="flex items-center justify-between">
                            <p className="text-[14px] text-[#667085]">Subtotal</p>
                            <p className="text-[16px] font-medium text-[#101828]">AED {subtotal.toLocaleString()}</p>
                        </div>
                        {discountPercent > 0 && (
                            <div className="flex items-center justify-between">
                                <p className="text-[14px] text-[#667085]">
                                    {appliedCustomDiscount !== null
                                        ? <>Discount (<span className="font-medium text-[#101828]">{discountPercent}%</span>)</>
                                        : <>Promotion (<span className="font-medium text-[#101828]">{appliedPromo}</span>)</>
                                    }
                                </p>
                                <p className="text-[16px] font-medium text-[#d92d20]">-AED {discountAmount.toLocaleString()}</p>
                            </div>
                        )}
                        {/* Tax row hidden until a product carries a tax rate
                            (Tax settings / PRD 11 ships per-product rates). */}
                        {taxRate > 0 && (
                            <div className="flex items-center justify-between">
                                <p className="text-[14px] text-[#667085]">Tax rate (<span className="font-medium text-[#101828]">{taxRate}%</span>)</p>
                                <p className="text-[16px] font-medium text-[#101828]">AED {taxAmount.toLocaleString()}</p>
                            </div>
                        )}
                        <div className="h-px w-full bg-[#e4e7ec] my-1" />
                        <div className="flex items-center justify-between">
                            <p className="text-[14px] font-semibold text-[#101828]">Total</p>
                            <p className="text-[16px] font-semibold text-[#101828]">AED {total.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Footer buttons */}
                    <div className="flex gap-3">
                        <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                            Back
                        </Button>
                        <Button variant="primary" size="lg" className="flex-1" disabled={lineItems.length === 0} onClick={handleProceed}>
                            Proceed to payment
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

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
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={() => onConfirm(refund)}>
                        Yes, remove booking
                    </Button>
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
        <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
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
                            <Button variant="secondary-gray" size="sm" leftIcon={<SlashCircle01 className="w-5 h-5 text-[#667085]" />} onClick={onCancel}>
                                Cancel
                            </Button>
                            <Button variant="secondary-gray" size="sm" className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]" leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />} onClick={onRemove}>
                                Remove
                            </Button>
                        </>
                    )}
                    {variant === "ongoing" && (
                        <Button variant="secondary-gray" size="sm" className="text-[#067647] hover:text-[#067647] hover:bg-[#ecfdf3]" leftIcon={<CheckCircle className="w-5 h-5 text-[#067647]" />} onClick={onPresent}>
                            Mark present
                        </Button>
                    )}
                    {variant === "reviews" && (
                        <Button variant="secondary-gray" size="sm" className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]" leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />} onClick={onDelete}>
                            Delete review
                        </Button>
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
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={onConfirm}>
                        {isBulk ? "Yes, delete reviews" : "Yes, delete review"}
                    </Button>
                </div>
            </div>
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

function LeftPanel({ ci, branchTzShort, isUpcoming, isOngoing, isCancelled, isCompleted, canCancelClass, onAddCustomer, onEdit, onCancelClass }: {
    ci: ClassInstance;
    /** Short TZ label (e.g. "Dubai") for the class's branch — shown next to
     *  the wall-clock time so cross-branch views (Owner) never mix up which
     *  09:00 they're looking at. */
    branchTzShort?: string;
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
                    <StatusBadge type="class-detail" status={ci.status} />
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
                            {branchTzShort && (
                                <p className="text-[13px] font-normal text-[#667085]">{branchTzShort}</p>
                            )}
                        </div>
                        {/* Class type row removed — class schedules always represent
                            Group classes; Private 1-on-1 lives in the Services module. */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <p className="text-[14px] text-[#667085]">Gender access</p>
                                <p className="text-[16px] font-medium text-[#101828]">
                                    {ci.genderAccess === "female" ? "Female only"
                                        : ci.genderAccess === "male" ? "Male only"
                                        : "All genders"}
                                </p>
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
    { id: "booked", label: "Booked" },
    { id: "waitlisted", label: "Waitlisted" },
    { id: "cancelled", label: "Cancelled" },
];
const COMPLETED_TABS: { id: DetailTab; label: string }[] = [
    ...BASE_TABS,
    { id: "reviews", label: "Reviews & Rating" },
];

export default function ClassDetailPage() {
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams();
    const classId = String(params.classId);
    const {
        classSchedules, classBookings, classRatings,
        customers: allCustomers,
        currentRole,
        cancelClassSchedule, cancelClassBooking, cancelClassBookings,
        removeClassBooking, removeClassBookings,
        updateAttendance, deleteClassRating,
        showToast,
    } = useAppStore();
    // Custom discount is gated to Owner / Branch Admin per business rules. The
    // prototype's `UserRole` type only differentiates "admin" today; we use that
    // bucket to mean "back-office staff with discounting authority".
    const canApplyCustomDiscount = currentRole === "admin";
    const customerById = useMemo(() => new Map(allCustomers.map(c => [c.id, c])), [allCustomers]);

    const classInstance = classSchedules.find(c => c.id === classId);
    const allBookings = classBookings.filter(b => b.classScheduleId === classId);
    const classIsCancelled = classInstance?.status === "Cancelled";
    // Resolve the class's branch so we can tag times with the branch's TZ
    // — a 9:00 AM class at the Riyadh branch is one hour off a 9:00 AM
    // class at Dubai. Reads live so a mid-session branch edit reflects.
    const branches = useAppStore(s => s.branches);
    const classBranch = classInstance ? branches.find(b => b.id === classInstance.branchId) : undefined;
    const classBranchTzShort = classBranch ? branchTzLabel(classBranch) : undefined;

    // The class-scoped POS catalog is filtered by the schedule's applicable
    // plans (per CLAUDE.md mini-POS rule). Resolution order:
    //   1) schedule's own override (set when admin edited applicable plans
    //      from the schedule form, or when class was created from scratch)
    //   2) parent template's list (cascade — most schedules)
    //   3) empty (scratch + never set — no one can book)
    const classTemplates = useAppStore(s => s.classTemplates);
    const classTemplate = classTemplates.find(t => t.id === classInstance?.templateId);
    const applicableMembershipIds =
        classInstance?.applicableMembershipIds ?? classTemplate?.applicableMembershipIds ?? [];
    const applicablePackageIds =
        classInstance?.applicablePackageIds ?? classTemplate?.applicablePackageIds ?? [];

    // Live POS catalog from store (mirrors POSModal subscription) so handlePosContinue
    // can resolve cart product ids without referencing stale module constants.
    const allMemberships = useAppStore(s => s.memberships);
    const allPackagesForPos = useAppStore(s => s.packages);
    const posProducts = useMemo(
        () => buildPosProducts(allMemberships, allPackagesForPos),
        [allMemberships, allPackagesForPos]
    );

    // **Tab-preservation cancel model** — bookings keep their ORIGINAL
    // `status` regardless of the parent class's state. So:
    //   • Booked tab     → status === "booked" rows
    //   • Waitlisted tab → status === "waitlisted" rows
    //   • Cancelled tab  → status === "cancelled" rows (customer-self-
    //                      cancellations only)
    //
    // On a Cancelled class, the row's status BADGE flips to "Cancelled"
    // in the Booked tab — but the row stays where it was, so the tab
    // doesn't render empty. The page logic stays simple (no special
    // `if (isCancelled)` branches); the visual flip happens at the
    // badge layer.
    const bookedBookings = useMemo(
        () => allBookings.filter(b => b.status === "booked"),
        [allBookings]
    );
    const waitlistBookings = useMemo(
        () => allBookings.filter(b => b.status === "waitlisted").sort((a, b) => (a.waitlistPosition ?? 99) - (b.waitlistPosition ?? 99)),
        [allBookings]
    );
    const cancelledBookings = useMemo(
        () => allBookings.filter(b => b.status === "cancelled"),
        [allBookings]
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
    // Add-customer flow staging:
    //   • paymentCustomer       — selected on the AddCustomer list, sitting in the Payment confirmation modal
    //   • confirmAddCustomer    — has open capacity, awaiting final "Add to booked" click
    //   • capacityFullCustomer  — class is full, awaiting waitlist confirmation
    //   • posOpen               — POS modal visible (after "Purchase new" / "Select membership")
    const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
    const [confirmAddCustomer, setConfirmAddCustomer] = useState<Customer | null>(null);
    const [capacityFullCustomer, setCapacityFullCustomer] = useState<Customer | null>(null);
    const [posOpen, setPosOpen] = useState(false);
    /** Items resolved from the POS cart, held in state for the CheckoutConfirmationModal. */
    const [checkoutItems, setCheckoutItems] = useState<PurchaseLineItem[] | null>(null);
    /** The customer this checkout is for — may differ from the schedule's bookable customer if shopping for another. */
    const [checkoutCustomer, setCheckoutCustomer] = useState<Customer | null>(null);
    // Re-open the Add Customer modal automatically when returning from /customers/new
    // (the new-customer page appends ?openAddCustomer=1 to the returnTo path).
    const searchParams = useSearchParams();
    // Where the X-close button should bounce back to. Entry points that opened
    // this page (dashboard widget, schedule list row, notification panel, etc.)
    // pass `?returnTo=<their pathname>`. Falls back to the schedule list when
    // unset (e.g. user reached this page via direct URL).
    const returnTo = searchParams.get("returnTo") ?? "/admin/schedule";
    useEffect(() => {
        if (searchParams.get("openAddCustomer") === "1") {
            setAddCustomerOpen(true);
            const url = new URL(window.location.href);
            url.searchParams.delete("openAddCustomer");
            window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
        }
    }, [searchParams]);

    // Post-purchase return: /checkout pushes us back with ?paymentSuccess=1&customerId=…
    // We re-open the Payment confirmation modal for the same customer (with the
    // newly-purchased plan now visible), clear the transient pendingPurchase
    // slice, and fire the success toast.
    useEffect(() => {
        if (searchParams.get("paymentSuccess") === "1") {
            const customerId = searchParams.get("customerId");
            const customer = customerId ? allCustomers.find(c => c.id === customerId) ?? null : null;
            if (customer) setPaymentCustomer(customer);
            useAppStore.getState().setPendingPurchase(null);
            showToast(
                "Transaction complete",
                "The payment was successful and the record is saved.",
                "success", "check"
            );
            const url = new URL(window.location.href);
            url.searchParams.delete("paymentSuccess");
            url.searchParams.delete("customerId");
            window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // Reviews & Rating tab state
    const [reviewsSubTab, setReviewsSubTab] = useState<ReviewsSubTab>("ratings");
    const [deleteReviewTarget, setDeleteReviewTarget] = useState<ClassRating | null>(null);
    const [appliedReviewFilter, setAppliedReviewFilter] = useState<ReviewFilter>(EMPTY_REVIEW_FILTER);
    const [reviewFilterOpen, setReviewFilterOpen] = useState(false);

    // Resolve a customer's display name lazily via the customers store (no copies on booking rows).
    const customerName = (id: string): string => {
        const c = customerById.get(id);
        return c ? `${c.firstName} ${c.lastName}` : "";
    };

    // Filter helper — applies search + applied filter to a list of bookings
    const filterBookings = (list: ClassBooking[]): ClassBooking[] => {
        const q = search.toLowerCase();
        return list.filter(b => {
            if (q && !customerName(b.customerId).toLowerCase().includes(q)) return false;
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
        name: (a, b) => customerName(a.customerId).localeCompare(customerName(b.customerId)),
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
    const { sorted: sortedBooked, sortKey: bookedSortKey, sortDir: bookedSortDir, toggle: toggleBookedSort } = useSort(filteredBooked, bookingComparators);
    const { sorted: sortedWaitlist, sortKey: waitlistSortKey, sortDir: waitlistSortDir, toggle: toggleWaitlistSort } = useSort(filteredWaitlist, bookingComparators);
    const { sorted: sortedCancelled, sortKey: cancelledSortKey, sortDir: cancelledSortDir, toggle: toggleCancelledSort } = useSort(filteredCancelled, bookingComparators);

    if (!classInstance) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-[18px] font-semibold text-[#101828]">Class not found</p>
                    <button type="button" onClick={() => router.push(returnTo)}
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
        cancelClassSchedule(ci.id, refund);
        setCancelClassOpen(false);
        showToast(
            "Class cancelled successfully",
            `${ci.name} on ${ci.date} has been cancelled${refund ? " and customers' credits have been returned to their balance" : ""}.`,
            "error", "slash"
        );
    }

    function handleCancelBooking(refund: boolean) {
        if (!cancelBookingTarget) return;
        cancelClassBooking(cancelBookingTarget.id, "Cancelled by admin", refund, "admin");
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
        cancelClassBookings(ids, "Cancelled by admin", refund, "admin");
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
        const name = customerName(deleteReviewTarget.customerId);
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

    /** Inserts a booking record for `c` on this class — `status` differentiates booked vs waitlisted.
     *  `pickedPlanId` is the package the admin chose in PaymentConfirmation for
     *  multi-package customers; falls back to the customer's first available plan. */
    function insertBooking(c: Customer, status: "booked" | "waitlisted", pickedPlanId?: string) {
        const bookingId = `b-${Date.now()}`;
        useAppStore.setState(state => {
            const planId = c.planKind === "membership"
                ? c.membershipId ?? ""
                : c.planKind === "package"
                    ? pickedPlanId ?? c.packageIds?.[0] ?? ""
                    : "";
            const planName = c.planKind === "package" && pickedPlanId
                ? state.packages.find(p => p.id === pickedPlanId)?.name ?? c.planName ?? "No plan"
                : c.planName ?? "No plan";
            const newBooking: ClassBooking = {
                id: bookingId,
                classScheduleId: ci.id,
                customerId: c.id,
                branchId: c.branchId,
                planId,
                planName,
                planKindUsed: c.planKind ?? undefined,
                bookingTime: new Date().toISOString(),
                status,
                attendanceStatus: "pending",
                ...(status === "waitlisted" ? { waitlistPosition: waitlistBookings.length + 1 } : {}),
            };
            return {
                classBookings: [...state.classBookings, newBooking],
                classSchedules: status === "booked"
                    ? state.classSchedules.map(inst => inst.id === ci.id ? { ...inst, booked: inst.booked + 1 } : inst)
                    : state.classSchedules,
            };
        });
        // Feed: surface in the notification center (PRD 12). Only confirmed
        // bookings emit a "Booking Confirmation" — a waitlist add isn't a
        // confirmed seat so it would surface as a separate event when that
        // template lands.
        if (status === "booked") {
            const customerName = `${c.firstName} ${c.lastName}`.trim();
            useAppStore.getState().addNotification({
                tab: "booking",
                event: "booking_confirmation",
                title: "Booking Confirmation",
                body: `${customerName} booked ${ci.name} on ${ci.dayOfWeek} at ${ci.displayTime}.`,
                icon: "calendar-check",
                sourceModule: "booking",
                sourceId: bookingId,
                classScheduleId: ci.id,
                customerId: c.id,
                branchId: c.branchId,
            });
        }
    }

    /** AddCustomerModal row's "Add to class" — moves the flow into the payment-confirmation step. */
    function handleSelectCustomer(c: Customer) {
        setAddCustomerOpen(false);
        setPaymentCustomer(c);
    }

    // For multi-package customers, this captures which package the admin
    // picked in the modal so the booking is written against the right plan.
    const [confirmPlanId, setConfirmPlanId] = useState<string | undefined>(undefined);

    /** PaymentConfirmation "Confirm payment" — branches on class capacity. */
    function handleConfirmPayment(planId?: string) {
        if (!paymentCustomer) return;
        setConfirmPlanId(planId);
        const isFull = ci.booked >= ci.capacity;
        if (isFull) {
            setCapacityFullCustomer(paymentCustomer);
            setPaymentCustomer(null);
            return;
        }
        // Capacity available — show the "Add customer to this class?" confirmation
        // before actually writing the booking.
        setConfirmAddCustomer(paymentCustomer);
        setPaymentCustomer(null);
    }

    /** Customer card → switch icon: re-open AddCustomerModal so admin can
     *  pick a different customer for this booking. */
    function handleSwitchCustomer() {
        setPaymentCustomer(null);
        setAddCustomerOpen(true);
    }

    /** AddCustomerConfirmationModal "Add to booked" — final commit. */
    function handleConfirmAdd() {
        if (!confirmAddCustomer) return;
        insertBooking(confirmAddCustomer, "booked", confirmPlanId);
        const name = `${confirmAddCustomer.firstName} ${confirmAddCustomer.lastName}`;
        setConfirmAddCustomer(null);
        setConfirmPlanId(undefined);
        showToast("Customer added", `${name} has been added to ${ci.name}.`, "success", "check");
    }

    /** RoomCapacityModal "Add to waitlist". */
    function handleAddToWaitlist() {
        if (!capacityFullCustomer) return;
        insertBooking(capacityFullCustomer, "waitlisted", confirmPlanId);
        const name = `${capacityFullCustomer.firstName} ${capacityFullCustomer.lastName}`;
        setCapacityFullCustomer(null);
        setConfirmPlanId(undefined);
        showToast("Added to waitlist", `${name} has been placed on the ${ci.name} waitlist.`, "success", "check");
    }

    /** PaymentConfirmation "Purchase new" / "Select membership" — opens the POS modal. */
    function handleSelectMembership() {
        // Hold the paymentCustomer in memory while POS is open; the user goes through
        // checkout (will be wired in the upcoming Checkout confirmation screen) and
        // then returns to the Payment confirmation with their new plan.
        setPosOpen(true);
    }

    /** POSModal "Continue" — resolve cart against the catalog and open Checkout confirmation. */
    function handlePosContinue(cart: Record<string, number>) {
        // Resolve productId→qty into rich PurchaseLineItem rows for downstream screens.
        const items: PurchaseLineItem[] = posProducts
            .filter(p => (cart[p.id] ?? 0) > 0)
            .map(p => ({
                productId: p.id,
                productType: p.type as "membership" | "package",
                name: p.name,
                unitPrice: p.priceAed,
                quantity: cart[p.id],
            }));
        if (items.length === 0) return;
        // The checkout is always for the customer currently in the payment-confirmation step
        // (the one we routed here from "Purchase new" / "Select membership").
        const customer = paymentCustomer ?? confirmAddCustomer ?? checkoutCustomer;
        if (!customer) return;
        setCheckoutCustomer(customer);
        setCheckoutItems(items);
        setPosOpen(false);
    }

    /** CheckoutConfirmationModal "Proceed to payment" — stash purchase in store + navigate to /checkout. */
    const setPendingPurchase = useAppStore(s => s.setPendingPurchase);
    function handleProceedToPayment(items: PurchaseLineItem[], discountPercent: number, promoCode?: string) {
        if (!checkoutCustomer) return;
        setPendingPurchase({
            classScheduleId: ci.id,
            customerId: checkoutCustomer.id,
            items,
            discountPercent,
            promoCode,
        });
        setCheckoutItems(null);
        // Keep paymentCustomer set so the modal re-opens after the receipt flow returns.
        router.push(`/schedule/${ci.id}/checkout?returnTo=${encodeURIComponent(pathname)}`);
    }

    const bookedCount = bookedBookings.length;
    const waitlistCount = waitlistBookings.length;
    const cancelledCount = cancelledBookings.length;
    const existingCustomerIds = new Set(allBookings.filter(b => b.status !== "cancelled").map(b => b.customerId));
    const bookedIndexById = new Map(bookedBookings.map((b, i) => [b.id, i]));

    // Reviews & Rating data
    const allRatings = classRatings.filter(r => r.classScheduleId === ci.id);
    const visibleRatings = allRatings.filter(r => !r.deletedAt);
    const deletedRatings = allRatings.filter(r => !!r.deletedAt);
    const reviewsListRaw = reviewsSubTab === "ratings" ? visibleRatings : deletedRatings;
    const reviewsList = reviewsListRaw.filter(r => {
        if (search) {
            const q = search.toLowerCase();
            if (!customerName(r.customerId).toLowerCase().includes(q) && !r.comment.toLowerCase().includes(q)) return false;
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
    const currentToggleSort = tab === "booked" ? toggleBookedSort : tab === "waitlisted" ? toggleWaitlistSort : tab === "cancelled" ? toggleCancelledSort : () => { };

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Class details</h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* Two-column content — canonical DetailPageShell wraps the 832px frame. */}
            <DetailPageShell
                sidebar={
                    <LeftPanel
                        ci={ci}
                        branchTzShort={classBranchTzShort}
                        isUpcoming={isUpcoming} isOngoing={isOngoing} isCancelled={isCancelled} isCompleted={isCompleted} canCancelClass={canCancelClass}
                        onAddCustomer={() => setAddCustomerOpen(true)}
                        onEdit={() => router.push(`/schedule/${ci.id}/edit?returnTo=${encodeURIComponent(pathname)}`)}
                        onCancelClass={() => setCancelClassOpen(true)}
                    />
                }
                main={
                    /* Right panel */
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
                                        { id: "ratings" as const, label: "Rating & reviews" },
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
                                                                <CheckboxCell ariaLabel={`Select review by ${customerName(r.customerId)}`}
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
                                                                <TableAvatar initials={customerById.get(r.customerId)?.initials ?? ""} imageUrl={customerById.get(r.customerId)?.imageUrl} size={40} />
                                                                <div>
                                                                    <div className="text-[14px] font-medium text-[#101828]">{customerName(r.customerId)}</div>
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
                                                                <RowActions items={[
                                                                    { label: "Delete review", icon: Trash01, danger: true, onClick: () => setDeleteReviewTarget(r) },
                                                                ]} minWidth={180} />
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
                                                                            ariaLabel={`Select ${customerName(b.customerId)}`}
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
                                                                        <TableAvatar initials={customerById.get(b.customerId)?.initials ?? ""} imageUrl={customerById.get(b.customerId)?.imageUrl} size={40} />
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <span className="text-[14px] font-medium text-[#101828] truncate">{customerName(b.customerId)}</span>
                                                                                {/* Context pills — "1st class", "100th class", "Birthday",
                                                                                    "New member". Priority-sorted, capped at 2 by the
                                                                                    component. Renders nothing when the customer has none. */}
                                                                                <ClassCustomerBadges customerId={b.customerId} classDateISO={classInstance?.dateISO ?? ""} />
                                                                            </div>
                                                                            <div className="text-[13px] text-[#667085]">{customerById.get(b.customerId)?.email ?? ""}</div>
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
                                                                        {/* Booked tab on a Cancelled class →
                                                                            class-level "Cancelled" badge (tab-
                                                                            preservation model: rows stay in their
                                                                            original tab; the badge tells the story). */}
                                                                        {tab === "booked" && isCancelled
                                                                            ? <BookingStatusBadge kind="class" />
                                                                            : tab === "booked" && (isOngoing || isCompleted)
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
                                                                            <RowActions items={[
                                                                                { label: "Cancel customer", icon: SlashCircle01, onClick: () => setCancelBookingTarget(b) },
                                                                                { label: "Remove customer", icon: Trash01, danger: true, onClick: () => setRemoveBookingTarget(b) },
                                                                            ]} />
                                                                        ) : (
                                                                            <RowActions items={[
                                                                                { label: b.attendanceStatus === "present" ? "Already present" : "Present", icon: CheckCircle, success: true, successText: true, disabled: b.attendanceStatus === "present", onClick: () => handleMarkPresent(b) },
                                                                            ]} />
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
                                    total={tab === "reviews" ? reviewsList.length : activeRows.length}
                                    pageSize={pageSize}
                                    onPage={setPage}
                                    onPageSize={s => { setPageSize(s); setPage(1); }}
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
                }
            />

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
                sampleName={cancelBookingTarget ? customerName(cancelBookingTarget.customerId) : ""}
                defaultRefund={cancelDefaultRefund}
                onClose={() => setCancelBookingTarget(null)}
                onConfirm={handleCancelBooking}
            />
            <RemoveBookingModal
                open={!!removeBookingTarget}
                count={1}
                sampleName={removeBookingTarget ? customerName(removeBookingTarget.customerId) : ""}
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
                applicableMembershipIds={applicableMembershipIds}
                applicablePackageIds={applicablePackageIds}
                genderAccess={ci.genderAccess}
                onClose={() => setAddCustomerOpen(false)}
                onAdd={handleSelectCustomer}
            />

            <PaymentConfirmationModal
                open={paymentCustomer !== null}
                customer={paymentCustomer}
                classInstance={classInstance}
                onClose={() => setPaymentCustomer(null)}
                onConfirm={handleConfirmPayment}
                onSelectMembership={handleSelectMembership}
                onSwitchCustomer={handleSwitchCustomer}
            />

            <AddCustomerConfirmationModal
                open={confirmAddCustomer !== null}
                onClose={() => setConfirmAddCustomer(null)}
                onConfirm={handleConfirmAdd}
            />

            <RoomCapacityModal
                open={capacityFullCustomer !== null}
                onClose={() => setCapacityFullCustomer(null)}
                onConfirm={handleAddToWaitlist}
            />

            <POSModal
                open={posOpen}
                onClose={() => setPosOpen(false)}
                onContinue={handlePosContinue}
                customer={paymentCustomer ?? checkoutCustomer}
                applicableMembershipIds={applicableMembershipIds}
                applicablePackageIds={applicablePackageIds}
            />

            <CheckoutConfirmationModal
                open={checkoutItems !== null}
                customer={checkoutCustomer}
                items={checkoutItems ?? []}
                canApplyCustomDiscount={canApplyCustomDiscount}
                onClose={() => { setCheckoutItems(null); setPosOpen(true); }}
                onBackToCart={() => { setCheckoutItems(null); setPosOpen(true); }}
                onProceed={handleProceedToPayment}
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
                            <Button variant="secondary-gray" size="lg" className="flex-1" onClick={() => setBulkPresentOpen(false)}>
                                Cancel
                            </Button>
                            <Button variant="primary" size="lg" className="flex-1 bg-[#658774] text-white hover:bg-[#3b5446] active:bg-[#3b5446]" onClick={handleBulkPresent}>
                                Yes, mark present
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <DeleteReviewModal
                open={!!deleteReviewTarget}
                count={1}
                sampleName={deleteReviewTarget ? customerName(deleteReviewTarget.customerId) : ""}
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
