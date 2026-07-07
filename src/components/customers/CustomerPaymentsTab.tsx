"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer detail · Payments tab
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 2481:19237 (Overview inner tab) + 2481:20709 (Payment history) +
//        2481:114232 (Payment history filter) + 2481:21452 (Refund modal) +
//        3791:91670 (refund success toast).
//
// Two inner tabs:
//   • Overview        — Total spent / Total refunded / Net spend metric cards,
//                       the customer's gift cards, and their saved payment
//                       methods.
//   • Payment history — every membership / package transaction, with a row
//                       action that refunds a completed payment.
//
// Data is derived live from useAppStore — `customerTransactions` (metrics +
// table), `issuedGiftCards` + `giftCardDesigns` (gift cards) and the global
// `PAYMENT_METHODS` seed (saved cards). The refund action flows through the
// store's `refundTransaction` so the table + metrics re-render together and
// a success toast confirms it.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    SearchMd, FilterLines, ChevronLeft, XClose, AlignLeft,
    CoinsSwap02, CreditCard01, CreditCard02, Package, Gift01, BankNote01,
    SlashCircle01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { DatePicker } from "@/components/ui/DatePicker";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { FilterPill } from "@/components/ui/FilterPill";
import { RowActions } from "@/components/patterns/RowActions";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { SlidePanel } from "@/components/ui/SlidePanel";
import {
    useAppStore, PAYMENT_METHODS,
    type CustomerTransaction, type IssuedGiftCard, type GiftCardDesign, type PaymentMethod,
} from "@/lib/store";

// ─── Types ──────────────────────────────────────────────────────────────────

type TxnStatus = CustomerTransaction["status"];
type TxnKind = CustomerTransaction["kind"];
type FilterStatus = "complete" | "pending" | "failed";

interface PaymentFilter {
    dateStart: string;
    dateEnd: string;
    statuses: FilterStatus[];
    kinds: TxnKind[];
}
const EMPTY_PAYMENT_FILTER: PaymentFilter = { dateStart: "", dateEnd: "", statuses: [], kinds: [] };

// Filter-chip / column labels. Only the two purchase kinds get a chip
// or a column value — a `cancellation_penalty` row's Plan type column
// is derived from the CUSTOMER'S plan (see `planTypeLabel` below) so a
// penalty on a membership-plan customer reads "Membership" and on a
// package-plan customer reads "Credit package". The row is identified
// as a penalty via its icon + transaction name, NOT its plan-type text
// (client feedback Jul 2026).
const KIND_LABEL: Record<Extract<TxnKind, "membership" | "package">, string> = {
    membership: "Membership",
    package: "Credit package",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "AED 1,200". */
function fmtAed(n: number): string {
    return `AED ${n.toLocaleString("en-US")}`;
}

/** "2025-10-28, 10:00 PM" — the payment-history Date & Time column format. */
function fmtDateTime(iso: string): string {
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isNaN(d.getTime())) return "—";
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    let h = d.getUTCHours();
    const min = String(d.getUTCMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${y}-${m}-${day}, ${h}:${min} ${ampm}`;
}

/** "Apr 15, 2026" — gift-card expiry label. */
function fmtDate(iso: string): string {
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Whole-month span between two ISO dates ("12 Months"). */
function monthsBetween(fromISO: string, toISO: string): number {
    const a = new Date(fromISO);
    const b = new Date(toISO);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
    const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
    return Math.max(1, months);
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const TXN_STATUS_LABEL: Record<TxnStatus, string> = {
    complete: "Complete", pending: "Pending", failed: "Failed", refunded: "Refunded",
};

function TxnStatusBadge({ status }: { status: TxnStatus }) {
    const styles: Record<TxnStatus, string> = {
        complete: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        pending: "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
        failed: "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
        refunded: "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    };
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", styles[status])}>
            {TXN_STATUS_LABEL[status]}
        </span>
    );
}

// ─── Transaction kind icon ────────────────────────────────────────────────────

function TxnIcon({ kind }: { kind: TxnKind }) {
    // Membership → card · package → package · penalty → slash-circle
    // (block glyph — per client spec Jul 2026). Same neutral colour
    // stack as the other two so the row doesn't shout — the icon is
    // just there to identify the row shape at a glance.
    const Icon = kind === "membership"
        ? CreditCard02
        : kind === "cancellation_penalty"
            ? SlashCircle01
            : Package;
    return (
        <div className="relative shrink-0 size-10 rounded-full bg-[#f2f4f7] flex items-center justify-center">
            <Icon className="w-5 h-5 text-[#475467]" />
            <div className="absolute inset-0 rounded-full border-[0.75px] border-black/[0.08] pointer-events-none" />
        </div>
    );
}

// Plan-type column resolver — for the two purchase kinds we render the
// kind's label; for a cancellation-penalty row we ALWAYS return
// "Membership" because the cancellation-penalty flow is scoped to
// UNLIMITED-membership customers ONLY (`computeCancellationPenalty`
// gates on `membership.credits === "unlimited"`) — credit-package
// customers can never receive one, so there's no "Credit package"
// case here. Client requirement Jul 2026.
function planTypeLabel(t: CustomerTransaction): string {
    if (t.kind === "cancellation_penalty") return "Membership";
    return KIND_LABEL[t.kind];
}

// ─── Card-brand mark (Payment method section) ─────────────────────────────────

function CardBrandMark({ brand }: { brand: PaymentMethod["brand"] }) {
    return (
        <div className="w-[34px] h-[24px] rounded-[4px] bg-white border-1 border-[#e4e7ec] flex items-center justify-center shrink-0">
            {brand === "Master Card" ? (
                <span className="flex items-center">
                    <span className="w-[11px] h-[11px] rounded-full bg-[#eb001b]" />
                    <span className="w-[11px] h-[11px] rounded-full bg-[#f79e1b] -ml-[5px] mix-blend-multiply" />
                </span>
            ) : brand === "Visa" ? (
                <span className="font-bold italic text-[9px] tracking-tight text-[#1434cb]">VISA</span>
            ) : (
                <span className="font-bold text-[8px] tracking-tight text-[#2e77bc]">AMEX</span>
            )}
        </div>
    );
}

// ─── Gift card widget (Figma 6440:197170) ─────────────────────────────────────

function GiftCardWidget({ card, design }: { card: IssuedGiftCard; design?: GiftCardDesign }) {
    const name = design?.name ?? `AED ${card.face_value_aed} Gift Card`;
    const months = monthsBetween(card.issued_at, card.expires_at);
    const pct = card.face_value_aed > 0
        ? Math.min(100, Math.round((card.current_balance_aed / card.face_value_aed) * 100))
        : 0;
    const statusStyle: Record<IssuedGiftCard["status"], string> = {
        active: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        redeemed: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
        expired: "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
    };
    const statusLabel = card.status.charAt(0).toUpperCase() + card.status.slice(1);

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] overflow-hidden flex flex-col gap-4 pb-5">
            {/* Decorative banner strip — faint concentric rings (Figma 6440:197172) */}
            <div className="h-6 bg-[#dbf8ff] relative overflow-hidden">
                <div className="absolute left-1/2 -top-[40px]">
                    {[60, 110, 160, 210].map(d => (
                        <div key={d} className="absolute rounded-full border-[1.5px] border-[#92d1de]/60"
                            style={{ width: d, height: d, left: -d / 2, top: -d / 2 }} />
                    ))}
                </div>
            </div>
            <div className="flex flex-col gap-4 px-5">
                {/* Item info */}
                <div className="flex items-center gap-4">
                    <div className="size-9 rounded-[8px] bg-[#ccf6ff] border-1 border-white shadow-[0px_1.7px_1.7px_0px_rgba(0,0,0,0.04)] flex items-center justify-center shrink-0">
                        <Gift01 className="w-[20px] h-[20px] text-[#0e7090]" />
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <p className="text-[16px] font-medium text-[#101828] truncate">{name}</p>
                        <span className={cn("inline-flex items-center px-[8px] py-[2px] rounded-full text-[12px] font-medium shrink-0", statusStyle[card.status])}>
                            {statusLabel}
                        </span>
                    </div>
                </div>
                {/* Amount / Duration / Code */}
                <div className="flex gap-4">
                    <div className="flex-1 min-w-0 flex flex-col">
                        <p className="text-[14px] text-[#667085]">Amount</p>
                        <p className="text-[14px] font-medium text-[#101828]">{fmtAed(card.face_value_aed)}</p>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                        <p className="text-[14px] text-[#667085]">Duration</p>
                        <p className="text-[14px] font-medium text-[#101828]">{months} {months === 1 ? "Month" : "Months"}</p>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                        <p className="text-[14px] text-[#667085]">Code</p>
                        <p className="text-[14px] font-medium text-[#101828] truncate">{card.code}</p>
                    </div>
                </div>
                {/* Footer — balance + expiry + progress */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[14px] text-[#667085]">
                        <p>{fmtAed(card.current_balance_aed)}/{card.face_value_aed} left</p>
                        <p>End {fmtDate(card.expires_at)}</p>
                    </div>
                    <div className="h-1 w-full rounded-full bg-[#e4e7ec] overflow-hidden">
                        <div className="h-full rounded-full bg-[#4b8c9a]" style={{ width: `${pct}%` }} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────


// ─── Payment-history filter panel (Figma 2481:114232) ─────────────────────────

function PaymentFilterPanel({ open, onClose, applied, onApply }: {
    open: boolean; onClose: () => void;
    applied: PaymentFilter; onApply: (f: PaymentFilter) => void;
}) {
    const [pending, setPending] = useState<PaymentFilter>(EMPTY_PAYMENT_FILTER);
    useEffect(() => { if (open) setPending({ ...applied }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);

    function toggle<T>(arr: T[], v: T): T[] { return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]; }
    const hasAny =
        pending.statuses.length > 0 || pending.kinds.length > 0 ||
        pending.dateStart !== "" || pending.dateEnd !== "";

    const STATUSES: FilterStatus[] = ["complete", "pending", "failed"];
    // Plan-type filter chips — only the two purchase kinds. Penalty
    // rows are surfaced via icon + transaction name, not via a plan-
    // type chip (client spec Jul 2026).
    const KINDS: Extract<TxnKind, "membership" | "package">[] = ["membership", "package"];

    return (
        <SlidePanel open={open} onClose={onClose} width={400}>
<div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Date range */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Date range</p>
                        <div className="grid grid-cols-2 gap-3">
                            <DatePicker value={pending.dateStart} placeholder="Start date"
                                onChange={v => setPending(p => ({
                                    ...p, dateStart: v,
                                    dateEnd: p.dateEnd && v && p.dateEnd < v ? "" : p.dateEnd,
                                }))} />
                            <DatePicker value={pending.dateEnd} placeholder="End date"
                                minDate={pending.dateStart || undefined}
                                onChange={v => setPending(p => ({ ...p, dateEnd: v }))} />
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                    {/* Status */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {STATUSES.map(s => (
                                <FilterPill key={s} label={TXN_STATUS_LABEL[s]} selected={pending.statuses.includes(s)}
                                    onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, s) }))} />
                            ))}
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                    {/* Plan type */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Plan type</p>
                        <div className="flex flex-wrap gap-2">
                            {KINDS.map(k => (
                                <FilterPill key={k} label={KIND_LABEL[k]} selected={pending.kinds.includes(k)}
                                    onClick={() => setPending(p => ({ ...p, kinds: toggle(p.kinds, k) }))} />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" disabled={!hasAny}
                        onClick={() => { setPending(EMPTY_PAYMENT_FILTER); onApply(EMPTY_PAYMENT_FILTER); onClose(); }}>Clear filter</Button>
                    <Button variant="primary" size="md" disabled={!hasAny}
                        onClick={() => { onApply(pending); onClose(); }}>Apply</Button>
                </div>
        </SlidePanel>
    );
}

// ─── Refund modal (Figma 2481:21452) ──────────────────────────────────────────

function RefundModal({ txn, onClose, onConfirm }: {
    txn: CustomerTransaction;
    onClose: () => void;
    onConfirm: (method: "cash" | "card") => void;
}) {
    const [method, setMethod] = useState<"cash" | "card">("cash");

    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    const MethodOption = ({ value, label, Icon }: {
        value: "cash" | "card"; label: string; Icon: React.ComponentType<{ className?: string }>;
    }) => {
        const selected = method === value;
        return (
            <button type="button" onClick={() => setMethod(value)}
                className={cn("flex items-center gap-3 p-4 rounded-[12px] w-full text-left transition-all",
                    selected ? "border-2 border-[#658774] bg-white" : "border-1 border-[#e4e7ec] bg-white hover:border-[#aad4bd]")}>
                {/* Icon box turns green when the method is selected, neutral otherwise. */}
                <div className={cn("size-10 rounded-[8px] flex items-center justify-center shrink-0 transition-colors",
                    selected ? "" : "bg-white border-1 border-[#e4e7ec] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]")}
                    style={selected ? { background: "linear-gradient(135deg, #edfdf5 0%, #dcfae9 100%)" } : undefined}>
                    <Icon className={cn("w-5 h-5", selected ? "text-[#658774]" : "text-[#475467]")} />
                </div>
                <p className="flex-1 min-w-0 text-[16px] font-medium text-[#344054]">{label}</p>
                <span className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                    selected ? "bg-[#658774]" : "border border-[#d0d5dd]")}>
                    {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-[640px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden max-h-[90vh]">
                {/* Header */}
                <div className="relative shrink-0">
                    <button type="button" onClick={onClose}
                        className="absolute right-3 top-3 w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-6 h-6 text-[#667085]" />
                    </button>
                    <div className="flex flex-col gap-1 px-6 pt-6 pb-5 pr-14">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Refund Payment</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">Select the refund method to confirm this transaction.</p>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />
                </div>
                {/* Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-4">
                    {/* Detail refund */}
                    <div className="border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">Detail refund</p>
                        <div className="flex items-center justify-between gap-4">
                            <p className="text-[14px] text-[#667085]">{txn.name}</p>
                            <p className="text-[16px] font-medium text-[#101828] whitespace-nowrap">{fmtAed(txn.amountAed)}</p>
                        </div>
                    </div>
                    {/* Refund method — two options side by side */}
                    <div className="border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-4 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">Refund method</p>
                        <div className="grid grid-cols-2 gap-4">
                            <MethodOption value="cash" label="Cash" Icon={BankNote01} />
                            <MethodOption value="card" label="Card on file" Icon={CreditCard01} />
                        </div>
                    </div>
                </div>
                {/* Footer */}
                <div className="shrink-0">
                    <div className="h-px w-full bg-[#e4e7ec]" />
                    <div className="px-6 pt-6 pb-6 flex gap-3">
                        <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                        <Button variant="primary" size="lg" className="flex-1" onClick={() => onConfirm(method)}>Proceed refund</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Local RowActions removed — uses canonical `@/components/patterns/RowActions`.

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyBlock({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-6 pointer-events-auto">
                <div className="bg-[#f9fafb] rounded-[16px] p-[10px] w-[360px] flex gap-[10px] items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <div className="bg-white rounded-[10px] w-[51px] h-[51px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02)]">
                        <div className="bg-[#f9fafb] rounded-[7px] w-[31px] h-[31px] flex items-center justify-center">
                            <AlignLeft className="w-[18px] h-[18px] text-[#98a2b3]" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-[8px] flex-1 min-w-0">
                        <div className="bg-[#f2f4f7] h-[13px] w-[82px] rounded-full" />
                        <div className="bg-[#f2f4f7] h-[13px] w-full rounded-full" />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1 text-center max-w-[320px]">
                    <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">{title}</p>
                    <p className="text-[14px] text-[#475467] leading-[20px]">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}


// ─── Section header — shared style across every customer-detail tab ──────────

function SectionHeader({ children }: { children: React.ReactNode }) {
    return <p className="text-[16px] font-medium text-[#667085]">{children}</p>;
}

// ─── Payments tab ─────────────────────────────────────────────────────────────

export function CustomerPaymentsTab({ customerId }: { customerId: string }) {
    const customerTransactions = useAppStore(s => s.customerTransactions);
    const issuedGiftCards = useAppStore(s => s.issuedGiftCards);
    const giftCardDesigns = useAppStore(s => s.giftCardDesigns);
    const refundTransaction = useAppStore(s => s.refundTransaction);
    const showToast = useAppStore(s => s.showToast);

    // Notification click-through can deep-link to the Payment history
    // sub-tab via `?payment=history` (and optionally `?tx=<id>` to highlight
    // a specific transaction row). Falls back to Overview otherwise.
    const searchParams = useSearchParams();
    const initialInner: "overview" | "history" =
        searchParams?.get("payment") === "history" ? "history" : "overview";
    const highlightTx = searchParams?.get("tx") ?? null;

    const [inner, setInner] = useState<"overview" | "history">(initialInner);

    // Auto-jump to the page containing the highlighted transaction, then
    // pulse-highlight the row for a couple seconds so admins can spot it.
    const [pulseTxId, setPulseTxId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [applied, setApplied] = useState<PaymentFilter>(EMPTY_PAYMENT_FILTER);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [refundTxn, setRefundTxn] = useState<CustomerTransaction | null>(null);

    useEffect(() => { setPage(1); }, [search, applied, inner]);

    // ─── This customer's transactions (newest first) ────────────────────────
    const txns = useMemo(
        () => customerTransactions
            .filter(t => t.customerId === customerId)
            .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO)),
        [customerTransactions, customerId],
    );

    // ─── Overview metrics ───────────────────────────────────────────────────
    // A refunded transaction was collected then returned — it counts toward
    // Total spent AND Total refunded, so Net spend equals completed-only.
    const totalSpent = txns
        .filter(t => t.status === "complete" || t.status === "refunded")
        .reduce((s, t) => s + t.amountAed, 0);
    const totalRefunded = txns
        .filter(t => t.status === "refunded")
        .reduce((s, t) => s + t.amountAed, 0);
    const netSpend = totalSpent - totalRefunded;

    const metrics: { label: string; value: number }[] = [
        { label: "Total spent", value: totalSpent },
        { label: "Total refunded", value: totalRefunded },
        { label: "Net spend", value: netSpend },
    ];

    // ─── Gift cards for this customer ───────────────────────────────────────
    const giftCards = useMemo(
        () => issuedGiftCards.filter(c => c.customer_id === customerId),
        [issuedGiftCards, customerId],
    );

    // ─── Payment-history filtering + pagination ─────────────────────────────
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return txns.filter(t => {
            if (q && !t.name.toLowerCase().includes(q)) return false;
            const date = t.createdAtISO.slice(0, 10);
            if (applied.dateStart && date < applied.dateStart) return false;
            if (applied.dateEnd && date > applied.dateEnd) return false;
            if (applied.kinds.length > 0 && !applied.kinds.includes(t.kind)) return false;
            if (applied.statuses.length > 0 && !(applied.statuses as string[]).includes(t.status)) return false;
            return true;
        });
    }, [txns, search, applied]);

    // ── Payment-history sort — Transaction name / Plan type (kind) /
    //    Amount (numeric) / Status / Date & time. ──
    const { sorted: sortedTxns, sortKey: txnSortKey, sortDir: txnSortDir, toggle: toggleTxnSort } = useSort<CustomerTransaction>(filtered, {
        name:     (a, b) => a.name.localeCompare(b.name),
        planType: (a, b) => a.kind.localeCompare(b.kind),
        amount:   (a, b) => a.amountAed - b.amountAed,
        status:   (a, b) => a.status.localeCompare(b.status),
        date:     (a, b) => a.createdAtISO.localeCompare(b.createdAtISO),
    });

    const totalPages = Math.max(1, Math.ceil(sortedTxns.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const paged = sortedTxns.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    // When a `?tx=` is present, jump to the page containing that row and
    // pulse-highlight it for 2.5s. Runs once when the inner tab + tx id
    // are both available — guards against the highlight blinking on every
    // unrelated re-render.
    useEffect(() => {
        if (!highlightTx || inner !== "history" || filtered.length === 0) return;
        const idx = filtered.findIndex(t => t.id === highlightTx);
        if (idx < 0) return;
        const targetPage = Math.floor(idx / pageSize) + 1;
        if (targetPage !== page) setPage(targetPage);
        setPulseTxId(highlightTx);
        const timer = setTimeout(() => setPulseTxId(null), 2500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightTx, inner, filtered.length]);

    const hasActiveFilter =
        applied.statuses.length > 0 || applied.kinds.length > 0 ||
        applied.dateStart !== "" || applied.dateEnd !== "";

    // ─── Refund handler ─────────────────────────────────────────────────────
    function handleRefund(txn: CustomerTransaction, method: "cash" | "card") {
        refundTransaction(txn.id, method);
        setRefundTxn(null);
        showToast(
            "Refund payment successfully",
            `Refund payment is confirmed for ${txn.name}.`,
            "success", "check",
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Inner-tab toggle */}
            <div className="shrink-0 px-6 pt-5 pb-4">
                <div className="flex bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[10px] p-1">
                    {([["overview", "Overview"], ["history", "Payment history"]] as const).map(([id, label]) => (
                        <button key={id} type="button" onClick={() => setInner(id)}
                            className={cn(
                                "flex-1 h-9 rounded-[8px] text-[14px] font-semibold transition-all",
                                inner === id
                                    ? "bg-white text-[#101828] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
                                    : "text-[#667085] hover:text-[#344054]",
                            )}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {inner === "overview" ? (
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-6 flex flex-col gap-6">
                    {/* Metric cards */}
                    <div className="flex gap-4">
                        {metrics.map(m => (
                            <div key={m.label} className="flex-1 bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-2">
                                <p className="text-[14px] text-[#667085]">{m.label}</p>
                                <p className="text-[24px] font-semibold text-[#101828] leading-[32px]">{fmtAed(m.value)}</p>
                            </div>
                        ))}
                    </div>

                    {/* Gift card */}
                    <div className="flex flex-col gap-3">
                        <SectionHeader>Gift card</SectionHeader>
                        {giftCards.length === 0 ? (
                            <div className="border-1 border-dashed border-[#e4e7ec] rounded-[16px] py-10 flex flex-col items-center gap-1">
                                <p className="text-[14px] font-medium text-[#344054]">No gift cards</p>
                                <p className="text-[13px] text-[#667085]">This customer has no gift cards on file.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {giftCards.map(card => (
                                    <GiftCardWidget key={card.id} card={card}
                                        design={giftCardDesigns.find(d => d.id === card.design_id)} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Payment method */}
                    <div className="flex flex-col gap-3">
                        <SectionHeader>Payment method</SectionHeader>
                        <div className="flex gap-4">
                            {PAYMENT_METHODS.map(pm => (
                                <div key={pm.id}
                                    className="flex-1 min-w-0 flex items-center gap-4 p-4 rounded-[12px] bg-[#f9fafb] border-1 border-[#e4e7ec]">
                                    <CardBrandMark brand={pm.brand} />
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <p className="text-[16px] font-semibold text-[#101828]">{pm.brand}</p>
                                        <p className="text-[14px] text-[#667085]">****{pm.last4}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Toolbar */}
                    <div className="shrink-0 flex items-center gap-3 px-6 pb-4">
                        <ToolbarTotal count={filtered.length} entitySingular="transaction" size="sm" />
                        <ToolbarSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search transaction..."
                            size="sm"
                        />
                        <ToolbarFilter onClick={() => setFilterOpen(true)} active={hasActiveFilter} />
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                        {paged.length === 0 ? (
                            <EmptyBlock
                                title={txns.length === 0 ? "No transactions yet" : "No transactions found"}
                                subtitle={txns.length === 0
                                    ? "This customer hasn't made any payments."
                                    : "Try adjusting your search or filter."}
                            />
                        ) : (
                            <div className="px-6">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className={TH}>
                                                <SortableHeader sortKey="name"     currentSort={txnSortKey} dir={txnSortDir} onSort={toggleTxnSort}>Transaction name</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[160px]")}>
                                                <SortableHeader sortKey="planType" currentSort={txnSortKey} dir={txnSortDir} onSort={toggleTxnSort}>Plan type</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[120px]")}>
                                                <SortableHeader sortKey="amount"   currentSort={txnSortKey} dir={txnSortDir} onSort={toggleTxnSort}>Amount</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[140px]")}>
                                                <SortableHeader sortKey="status"   currentSort={txnSortKey} dir={txnSortDir} onSort={toggleTxnSort}>Status</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[200px]")}>
                                                <SortableHeader sortKey="date"     currentSort={txnSortKey} dir={txnSortDir} onSort={toggleTxnSort}>Date &amp; Time</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[52px]")} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paged.map(t => (
                                            <tr key={t.id} className={cn(
                                                "transition-colors",
                                                pulseTxId === t.id
                                                    ? "bg-[#e9fff3] animate-pulse"
                                                    : "hover:bg-[#f9fafb]",
                                            )}>
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3">
                                                        <TxnIcon kind={t.kind} />
                                                        <span className="text-[14px] font-medium text-[#101828]">{t.name}</span>
                                                    </div>
                                                </td>
                                                <td className={cn(TD, "text-[#475467]")}>{planTypeLabel(t)}</td>
                                                <td className={cn(TD, "text-[#475467] whitespace-nowrap")}>{fmtAed(t.amountAed)}</td>
                                                <td className={TD}><TxnStatusBadge status={t.status} /></td>
                                                <td className={cn(TD, "text-[#475467] whitespace-nowrap")}>{fmtDateTime(t.createdAtISO)}</td>
                                                <td className={TD}>
                                                    {/* Only completed AND refundable payments can be
                                                        refunded. `isRefundable === false` is set on
                                                        every `cancellation_penalty` row per client
                                                        spec — those rows never expose the Refund
                                                        action. Legacy rows without the flag stay
                                                        refundable (undefined → falsy check misses,
                                                        explicit false gates). */}
                                                    {t.status === "complete" && t.isRefundable !== false && (
                                                        <RowActions
                                                            items={[{
                                                                label: "Refund payment",
                                                                icon: CoinsSwap02,
                                                                onClick: () => setRefundTxn(t),
                                                            }]}
                                                        />
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="px-6 shrink-0">
                        <Pagination page={clampedPage} total={sortedTxns.length} pageSize={pageSize}
                            onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />
                    </div>
                </>
            )}

            <PaymentFilterPanel open={filterOpen} onClose={() => setFilterOpen(false)}
                applied={applied} onApply={f => { setApplied(f); setPage(1); }} />

            {refundTxn && (
                <RefundModal txn={refundTxn} onClose={() => setRefundTxn(null)}
                    onConfirm={method => handleRefund(refundTxn, method)} />
            )}
        </div>
    );
}
