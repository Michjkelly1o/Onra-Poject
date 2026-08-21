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

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    SearchMd, FilterLines, ChevronLeft, XClose, AlignLeft,
    CoinsSwap02, CreditCard01, CreditCard02, Package, Gift01, BankNote01,
    SlashCircle01, Calendar, Receipt, ChevronDown, ChevronRight,
} from "@untitledui/icons";
import { TransactionReceiptModal } from "@/components/customers/TransactionReceiptModal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarExport } from "@/components/patterns/ToolbarExport";
import { customerTransactionsExportData } from "@/lib/export/specs/customer-records";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { DatePicker } from "@/components/ui/DatePicker";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { FilterPill } from "@/components/ui/FilterPill";
import { RowActions } from "@/components/patterns/RowActions";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { SelectInput } from "@/components/ui/select-input";
import {
    useAppStore, PAYMENT_METHODS,
    type CustomerTransaction, type IssuedGiftCard, type GiftCardDesign, type PaymentMethod,
} from "@/lib/store";
import { groupIntoOrders, type OrderGroup } from "@/lib/payments/orders";

// ─── Types ──────────────────────────────────────────────────────────────────

type TxnStatus = CustomerTransaction["status"];
type TxnKind = CustomerTransaction["kind"];
type FilterStatus = "complete" | "pending" | "failed";

export interface PaymentFilter {
    dateStart: string;
    dateEnd: string;
    statuses: FilterStatus[];
    kinds: TxnKind[];
}
export const EMPTY_PAYMENT_FILTER: PaymentFilter = { dateStart: "", dateEnd: "", statuses: [], kinds: [] };

// Filter-chip / column labels. Only the two purchase kinds get a chip
// or a column value — a `cancellation_penalty` row's Plan type column
// is derived from the CUSTOMER'S plan (see `planTypeLabel` below) so a
// penalty on a membership-plan customer reads "Membership" and on a
// package-plan customer reads "Package". The row is identified
// as a penalty via its icon + transaction name, NOT its plan-type text
// (client feedback Jul 2026).
const KIND_LABEL: Record<Extract<TxnKind, "membership" | "package" | "retail" | "gift_card">, string> = {
    membership: "Membership",
    package: "Package",
    retail: "Retail",
    gift_card: "Gift card",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "AED 1,200". */
export function fmtAed(n: number): string {
    return `AED ${n.toLocaleString("en-US")}`;
}

/** "2025-10-28, 10:00 PM" — the payment-history Date & Time column format. */
export function fmtDateTime(iso: string): string {
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isNaN(d.getTime())) return "—";
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    let h = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    const time = minutes === 0 ? `${h} ${ampm}` : `${h}.${String(minutes).padStart(2, "0")} ${ampm}`;
    return `${y}-${m}-${day}, ${time}`;
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

export function TxnStatusBadge({ status }: { status: TxnStatus }) {
    const styles: Record<TxnStatus, string> = {
        complete: "bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
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

export function TxnIcon({ kind }: { kind: TxnKind }) {
    // Membership → card · package → package · penalty → slash-circle
    // (block glyph — per client spec Jul 2026). Same neutral colour
    // stack as the other two so the row doesn't shout — the icon is
    // just there to identify the row shape at a glance.
    const Icon = kind === "membership"
        ? CreditCard02
        : kind === "gift_card"
            ? Gift01
            : (kind === "cancellation_penalty" || kind === "freeze_fee")
                ? SlashCircle01
                : (kind === "private" || kind === "recovery")
                    ? Calendar   // sessions read as appointments, not boxed products
                    : Package;
    return (
        <div className="relative shrink-0 size-10 rounded-full bg-[var(--colors-bg-tertiary)] flex items-center justify-center">
            <Icon className="w-5 h-5 text-[var(--colors-text-tertiary)]" />
            <div className="absolute inset-0 rounded-full border-[0.75px] border-black/[0.08] pointer-events-none" />
        </div>
    );
}

// Plan-type column resolver — for the two purchase kinds we render the
// kind's label; for a cancellation-penalty row we ALWAYS return
// "Membership" because the cancellation-penalty flow is scoped to
// UNLIMITED-membership customers ONLY (`computeCancellationPenalty`
// gates on `membership.credits === "unlimited"`) — credit-package
// customers can never receive one, so there's no "Package"
// case here. Client requirement Jul 2026.
// A gift-card SALE is refundable only while the linked card is FULLY UNUSED —
// once any balance is spent (or it's already refunded), the sale can't be
// reversed. All other kinds pass through (their own `isRefundable` flag +
// status already gate them). Mirrors the store guard in `refundTransaction`.
export function isTxnRefundable(t: CustomerTransaction, cards: IssuedGiftCard[]): boolean {
    if (t.kind !== "gift_card") return true;
    if (!t.issuedGiftCardId) return true;
    const card = cards.find(c => c.id === t.issuedGiftCardId);
    if (!card) return true;
    return card.status === "active" && card.current_balance_aed >= card.face_value_aed;
}

export function planTypeLabel(t: CustomerTransaction): string {
    // Penalty + freeze-fee rows are membership-scoped fees → always "Membership".
    if (t.kind === "cancellation_penalty" || t.kind === "freeze_fee") return "Membership";
    if (t.kind === "retail") return "Retail";
    if (t.kind === "gift_card") return "Gift card";
    if (t.kind === "private") return "Private session";
    if (t.kind === "recovery") return "Recovery";
    return KIND_LABEL[t.kind];
}

// ─── Card-brand mark (Payment method section) ─────────────────────────────────

function CardBrandMark({ brand }: { brand: PaymentMethod["brand"] }) {
    return (
        <div className="w-[34px] h-[24px] rounded-[4px] bg-white border-1 border-[var(--colors-border-secondary)] flex items-center justify-center shrink-0">
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
        active: "bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
        redeemed: "bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)]",
        expired: "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
        refunded: "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
    };
    const statusLabel = card.status.charAt(0).toUpperCase() + card.status.slice(1);

    return (
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[16px] overflow-hidden flex flex-col gap-4 pb-5">
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
                        <p className="text-[16px] font-medium text-[var(--colors-text-primary)] truncate">{name}</p>
                        <span className={cn("inline-flex items-center px-[8px] py-[2px] rounded-full text-[12px] font-medium shrink-0", statusStyle[card.status])}>
                            {statusLabel}
                        </span>
                    </div>
                </div>
                {/* Amount / Duration / Code */}
                <div className="flex gap-4">
                    <div className="flex-1 min-w-0 flex flex-col">
                        <p className="text-[14px] text-[var(--colors-text-quaternary)]">Amount</p>
                        <p className="text-[14px] font-medium text-[var(--colors-text-primary)]">{fmtAed(card.face_value_aed)}</p>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                        <p className="text-[14px] text-[var(--colors-text-quaternary)]">Duration</p>
                        <p className="text-[14px] font-medium text-[var(--colors-text-primary)]">{months} {months === 1 ? "Month" : "Months"}</p>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                        <p className="text-[14px] text-[var(--colors-text-quaternary)]">Code</p>
                        <p className="text-[14px] font-medium text-[var(--colors-text-primary)] truncate">{card.code}</p>
                    </div>
                </div>
                {/* Footer — balance + expiry + progress */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[14px] text-[var(--colors-text-quaternary)]">
                        <p>{fmtAed(card.current_balance_aed)}/{card.face_value_aed} left</p>
                        <p>End {fmtDate(card.expires_at)}</p>
                    </div>
                    <div className="h-1 w-full rounded-full bg-[var(--colors-bg-quaternary)] overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--colors-secondary-400)]" style={{ width: `${pct}%` }} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────


// ─── Payment-history filter panel (Figma 2481:114232) ─────────────────────────

export function PaymentFilterPanel({ open, onClose, applied, onApply }: {
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
<div className="flex items-center px-6 border-b border-[var(--colors-border-secondary)] shrink-0 h-[64px]">
                    <p className="font-heading flex-1 font-semibold text-[18px] text-[var(--colors-text-primary)]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                        <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Date range */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Date range</p>
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
                    <div className="h-px w-full bg-[var(--colors-bg-quaternary)] shrink-0" />
                    {/* Status */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {STATUSES.map(s => (
                                <FilterPill key={s} label={TXN_STATUS_LABEL[s]} selected={pending.statuses.includes(s)}
                                    onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, s) }))} />
                            ))}
                        </div>
                    </div>
                    <div className="h-px w-full bg-[var(--colors-bg-quaternary)] shrink-0" />
                    {/* Products */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Products</p>
                        <div className="flex flex-wrap gap-2">
                            {KINDS.map(k => (
                                <FilterPill key={k} label={KIND_LABEL[k]} selected={pending.kinds.includes(k)}
                                    onClick={() => setPending(p => ({ ...p, kinds: toggle(p.kinds, k) }))} />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="shrink-0 border-t border-[var(--colors-border-secondary)] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" disabled={!hasAny}
                        onClick={() => { setPending(EMPTY_PAYMENT_FILTER); onApply(EMPTY_PAYMENT_FILTER); onClose(); }}>Clear filter</Button>
                    <Button variant="primary" disabled={!hasAny}
                        onClick={() => { onApply(pending); onClose(); }}>Apply</Button>
                </div>
        </SlidePanel>
    );
}

// ─── Refund modal (Figma 2481:21452) ──────────────────────────────────────────

// Standardised refund reasons (client-specified). "Other" opens a required
// free-text note. The chosen value (or the note, for "Other") is stored on the
// transaction as `refundReason` and surfaces in the Refunds report.
const REFUND_REASONS = [
    "Studio cancelled",
    "Billing error",
    "Booked by mistake",
    "Medical",
    "Not satisfied",
    "Retail return",
    "Other",
] as const;

// Payment-method display labels + split reconstruction. A refund always returns
// to the ORIGINAL source(s), so the modal shows "Paid with" and mirrors it as
// "Refunds to" instead of asking the staff to pick cash/card.
const PAY_METHOD_LABEL: Record<CustomerTransaction["paymentMethod"], string> = {
    cash: "Cash", card: "Card", applepay: "Apple Pay", googlepay: "Google Pay",
    banktransfer: "Bank transfer", wallet: "Account credit",
};
function primaryMethodLabel(t: CustomerTransaction): string {
    if (t.paymentMethod === "card" && t.cardType) {
        return `${t.cardType.charAt(0).toUpperCase()}${t.cardType.slice(1)} card`;
    }
    return PAY_METHOD_LABEL[t.paymentMethod] ?? "Card";
}
/** How this transaction was paid — the primary method plus any account-credit
 *  (wallet) and gift-card portions from a split payment. Each portion refunds
 *  back to its own source. */
function paymentBreakdown(t: CustomerTransaction): { label: string; amountAed: number }[] {
    const total = Math.abs(t.amountAed);
    const wallet = t.accountCreditAppliedAed ?? 0;
    const gift = (t.giftCardDebits ?? []).reduce((s, d) => s + d.amountAed, 0);
    const primary = Math.max(0, total - wallet - gift);
    const out: { label: string; amountAed: number }[] = [];
    if (primary > 0) out.push({ label: primaryMethodLabel(t), amountAed: primary });
    if (wallet > 0) out.push({ label: "Account credit (wallet)", amountAed: wallet });
    if (gift > 0) out.push({ label: "Gift card", amountAed: gift });
    if (out.length === 0) out.push({ label: primaryMethodLabel(t), amountAed: total });
    return out;
}

export function RefundModal({ txn, onClose, onConfirm }: {
    txn: CustomerTransaction;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}) {
    const [reason, setReason] = useState("");
    const [otherText, setOtherText] = useState("");
    const resolvedReason = reason === "Other" ? otherText.trim() : reason;
    // Proceed is gated until a reason is chosen (and, for "Other", a note typed).
    const canProceed = reason !== "" && (reason !== "Other" || otherText.trim() !== "");
    const breakdown = paymentBreakdown(txn);

    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-[640px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden max-h-[90vh]">
                {/* Header */}
                <div className="relative shrink-0">
                    <button type="button" onClick={onClose}
                        className="absolute right-3 top-3 w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                        <XClose className="w-6 h-6 text-[var(--colors-text-quaternary)]" />
                    </button>
                    <div className="flex flex-col gap-1 px-6 pt-6 pb-5 pr-14">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[var(--colors-text-primary)]">Refund Payment</h3>
                        <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-[20px]">The refund is returned to the original payment source. Choose a reason to confirm.</p>
                    </div>
                    <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />
                </div>
                {/* Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-3">
                    {/* Detail refund — item, total, and the paid-with / refunds-to
                        breakdown (each split portion returns to its own source). */}
                    <div className="border-1 border-[var(--colors-border-secondary)] rounded-[16px] p-5 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <div className="flex items-center justify-between gap-4">
                            <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">Detail refund</p>
                            <p className="text-[16px] font-medium text-[var(--colors-text-primary)] whitespace-nowrap">{fmtAed(txn.amountAed)}</p>
                        </div>
                        <p className="text-[14px] text-[var(--colors-text-quaternary)] -mt-1">{txn.name}</p>
                        <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />
                        {/* Paid with */}
                        <div className="flex flex-col gap-1">
                            <p className="text-[12px] font-medium text-[var(--colors-text-quaternary)] uppercase tracking-wide">Paid with</p>
                            {breakdown.map((b, i) => (
                                <div key={`paid-${i}`} className="flex items-center justify-between gap-4">
                                    <p className="text-[14px] text-[var(--colors-text-secondary)]">{b.label}</p>
                                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] whitespace-nowrap">{fmtAed(b.amountAed)}</p>
                                </div>
                            ))}
                        </div>
                        {/* Refunds to — mirrors the original source(s) automatically */}
                        <div className="flex flex-col gap-1">
                            <p className="text-[12px] font-medium text-[var(--colors-text-quaternary)] uppercase tracking-wide">Refunds to</p>
                            {breakdown.map((b, i) => (
                                <div key={`refund-${i}`} className="flex items-center justify-between gap-4">
                                    <p className="text-[14px] text-[var(--colors-text-secondary)]">{b.label}</p>
                                    <p className="text-[14px] font-medium text-[var(--colors-secondary-600)] whitespace-nowrap">{fmtAed(b.amountAed)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Refund reason — standardised list; "Other" opens a required note. */}
                    <div className="border-1 border-[var(--colors-border-secondary)] rounded-[16px] p-5 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">Refund reason</p>
                        <SelectInput
                            value={reason}
                            onChange={v => { setReason(v); if (v !== "Other") setOtherText(""); }}
                            placeholder="Select a reason"
                            options={REFUND_REASONS.map(r => ({ value: r, label: r }))}
                            width="w-full"
                        />
                        {reason === "Other" && (
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="refund-other" className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Reason note</label>
                                <textarea
                                    id="refund-other"
                                    value={otherText}
                                    onChange={e => setOtherText(e.target.value)}
                                    placeholder="Describe the refund reason..."
                                    rows={3}
                                    className="w-full resize-none rounded-[8px] border-1 border-[var(--colors-border-primary)] px-[14px] py-[10px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] focus:outline-none focus:border-[var(--colors-secondary-300)] focus:ring-4 focus:ring-[var(--colors-secondary-100)]"
                                />
                            </div>
                        )}
                    </div>
                </div>
                {/* Footer */}
                <div className="shrink-0">
                    <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />
                    <div className="px-6 pt-6 pb-6 flex gap-3">
                        <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                        <Button variant="primary" size="lg" className="flex-1" disabled={!canProceed} onClick={() => onConfirm(resolvedReason)}>Proceed refund</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Local RowActions removed — uses canonical `@/components/patterns/RowActions`.

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Empty state ──────────────────────────────────────────────────────────────

export function EmptyBlock({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-6 pointer-events-auto">
                <div className="bg-[var(--colors-bg-secondary)] rounded-[16px] p-[10px] w-[360px] flex gap-[10px] items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <div className="bg-white rounded-[10px] w-[51px] h-[51px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02)]">
                        <div className="bg-[var(--colors-bg-secondary)] rounded-[7px] w-[31px] h-[31px] flex items-center justify-center">
                            <AlignLeft className="w-[18px] h-[18px] text-[var(--colors-fg-quaternary)]" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-[8px] flex-1 min-w-0">
                        <div className="bg-[var(--colors-bg-tertiary)] h-[13px] w-[82px] rounded-full" />
                        <div className="bg-[var(--colors-bg-tertiary)] h-[13px] w-full rounded-full" />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1 text-center max-w-[320px]">
                    <p className="text-[16px] font-semibold text-[var(--colors-text-primary)] leading-[24px]">{title}</p>
                    <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-[20px]">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}


// ─── Section header — shared style across every customer-detail tab ──────────

function SectionHeader({ children }: { children: React.ReactNode }) {
    return <p className="text-[16px] font-medium text-[var(--colors-text-quaternary)]">{children}</p>;
}

// ─── Payments tab ─────────────────────────────────────────────────────────────

// Order row-model = the shared order group + the two display labels derived from
// a store atom (`planTypeLabel`) / line count.
interface OrderRow extends OrderGroup {
    name: string;        // single → product name; multi → "N products"
    kindLabel: string;   // single → plan type; multi → "Multiple"
}

export function CustomerPaymentsTab({ customerId }: { customerId: string }) {
    const customerTransactions = useAppStore(s => s.customerTransactions);
    const customers = useAppStore(s => s.customers);
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
    // The receipt shows a whole order (all its line items).
    const [receiptOrder, setReceiptOrder] = useState<CustomerTransaction[] | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    // This tab is scoped to one customer — resolve their display name once for
    // the receipt modal.
    const thisCustomer = customers.find(c => c.id === customerId);
    const thisCustomerName = thisCustomer ? (`${thisCustomer.firstName} ${thisCustomer.lastName}`.trim() || thisCustomer.email) : "—";

    useEffect(() => { setPage(1); }, [search, applied, inner]);

    // ─── This customer's transactions (newest first) ────────────────────────
    const txns = useMemo(
        () => customerTransactions
            .filter(t => t.customerId === customerId)
            .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO)),
        [customerTransactions, customerId],
    );

    // ─── Overview metrics ───────────────────────────────────────────────────
    //
    // The seed carries TWO refund conventions that must produce the same
    // customer-facing totals:
    //   • Legacy — one row per sale; on refund, the row's `status` flips to
    //     "refunded". `amountAed` STAYS POSITIVE. `transactionType` is
    //     usually undefined.
    //   • Reports v30 ledger — the original sale row keeps its positive
    //     amount + "complete" (or "refunded") status, AND a SEPARATE
    //     refund event is written with a NEGATIVE amount +
    //     `transactionType === "refund"`.
    //
    // Naïve filtering breaks under the v30 pattern because:
    //   • A sale row + a refund row would DOUBLE-count into `totalSpent`
    //     (the negative refund partially cancels the positive sale).
    //   • Summing `amountAed` on `status === "refunded"` returns a mix of
    //     positive (legacy) and negative (v30) numbers — the total can go
    //     negative even though refunds are always outbound-to-customer.
    //
    // Correct rules:
    //   • Total spent      = every POSITIVE row EXCEPT v30 refund / void /
    //                        write-off events (which are already the
    //                        "return" leg of an accounted sale).
    //   • Total refunded   = `|amountAed|` on any `status === "refunded"`
    //                        row — legacy and v30 both counted at their
    //                        magnitude, voids / write-offs excluded (they
    //                        erase both sides, not refund).
    //   • Net spend        = totalSpent − totalRefunded.
    //
    // Under this: a legacy refunded row contributes to BOTH sums (net 0);
    // a v30 sale + refund pair contributes to BOTH sums (net 0); a voided
    // row contributes to neither. Every combination is consistent.
    const isNonRefundLike = (tt: CustomerTransaction["transactionType"]) =>
        tt !== "refund" && tt !== "void" && tt !== "write_off";
    // Gift-card SALES are excluded from spend/refund totals (client Aug 2026):
    // the money is recognised when the card is REDEEMED on another product (that
    // redemption is its own sale row). Counting the card purchase here as well
    // would double-count it against the redemption. The card purchase still
    // shows as its own Payment History row — it's just not re-summed.
    const totalSpent = txns
        .filter(t => t.amountAed > 0 && isNonRefundLike(t.transactionType) && t.kind !== "gift_card")
        .reduce((s, t) => s + t.amountAed, 0);
    const totalRefunded = txns
        .filter(t => t.status === "refunded"
            && t.transactionType !== "void"
            && t.transactionType !== "write_off"
            && t.kind !== "gift_card")
        .reduce((s, t) => s + Math.abs(t.amountAed), 0);
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

    // ─── Saved cards on file for THIS customer (FK filter, not the global
    //     seed) — so each profile shows its own cards, empty state when none.
    const savedCards = useMemo(
        () => PAYMENT_METHODS.filter(pm => pm.customer_id === customerId),
        [customerId],
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

    // A multi-product checkout writes one ledger row per product (reports need
    // them) that share an `orderId`. Collapse them into ONE order row here — a
    // single-item order is a plain row, a multi-item order an accordion. The
    // per-product rows still live in `filtered` for export + the reports.
    const orders = useMemo<OrderRow[]>(
        () => groupIntoOrders(filtered).map(o => ({
            ...o,
            name: o.isMulti ? `${o.txns.length} products` : o.txns[0].name,
            kindLabel: o.isMulti ? "Multiple" : planTypeLabel(o.txns[0]),
        })),
        [filtered],
    );

    // ── Payment-history sort — Transaction name / Products / Amount (numeric) /
    //    Status / Date & time — all at the ORDER level. ──
    const { sorted: sortedOrders, sortKey: txnSortKey, sortDir: txnSortDir, toggle: toggleTxnSort } = useSort<OrderRow>(orders, {
        name:     (a, b) => a.name.localeCompare(b.name),
        planType: (a, b) => a.kindLabel.localeCompare(b.kindLabel),
        amount:   (a, b) => a.amount - b.amount,
        status:   (a, b) => a.status.localeCompare(b.status),
        date:     (a, b) => a.dateISO.localeCompare(b.dateISO),
    });

    const totalPages = Math.max(1, Math.ceil(sortedOrders.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const paged = sortedOrders.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    function toggleExpand(key: string) {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }

    // Refund gating for one line item — completed, flagged refundable, and the
    // gift-card guard passes.
    function refundableLine(t: CustomerTransaction): boolean {
        return t.status === "complete" && t.isRefundable !== false && isTxnRefundable(t, issuedGiftCards);
    }

    // When a `?tx=` is present, jump to the page containing the ORDER that holds
    // that line item, pulse-highlight the order row for 2.5s, and expand it when
    // it's a multi-product order so the targeted line is visible. Runs once when
    // the inner tab + tx id are both available.
    useEffect(() => {
        if (!highlightTx || inner !== "history" || sortedOrders.length === 0) return;
        const idx = sortedOrders.findIndex(o => o.txns.some(t => t.id === highlightTx));
        if (idx < 0) return;
        const target = sortedOrders[idx];
        const targetPage = Math.floor(idx / pageSize) + 1;
        if (targetPage !== page) setPage(targetPage);
        if (target.isMulti) setExpanded(prev => new Set(prev).add(target.key));
        setPulseTxId(target.key);
        const timer = setTimeout(() => setPulseTxId(null), 2500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightTx, inner, filtered.length]);

    const hasActiveFilter =
        applied.statuses.length > 0 || applied.kinds.length > 0 ||
        applied.dateStart !== "" || applied.dateEnd !== "";

    // ─── Refund handler ─────────────────────────────────────────────────────
    function handleRefund(txn: CustomerTransaction, reason: string) {
        refundTransaction(txn.id, reason);
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
                <div className="flex bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] rounded-[10px] p-1">
                    {([["overview", "Overview"], ["history", "Payment history"]] as const).map(([id, label]) => (
                        <button key={id} type="button" onClick={() => setInner(id)}
                            className={cn(
                                "flex-1 h-9 rounded-[8px] text-[14px] font-semibold transition-all",
                                inner === id
                                    ? "bg-white text-[var(--colors-text-primary)] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
                                    : "text-[var(--colors-text-quaternary)] hover:text-[var(--colors-text-secondary)]",
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
                            <div key={m.label} className="flex-1 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[16px] p-6 flex flex-col gap-2">
                                <p className="text-[14px] text-[var(--colors-text-quaternary)]">{m.label}</p>
                                <p className="text-[24px] font-semibold text-[var(--colors-text-primary)] leading-[32px]">{fmtAed(m.value)}</p>
                            </div>
                        ))}
                    </div>

                    {/* Gift card */}
                    <div className="flex flex-col gap-3">
                        <SectionHeader>Gift card</SectionHeader>
                        {giftCards.length === 0 ? (
                            <div className="border-1 border-dashed border-[var(--colors-border-secondary)] rounded-[16px] py-10 flex flex-col items-center gap-1">
                                <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">No gift cards</p>
                                <p className="text-[13px] text-[var(--colors-text-quaternary)]">This customer has no gift cards on file.</p>
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
                        {savedCards.length === 0 ? (
                            <div className="border-1 border-dashed border-[var(--colors-border-secondary)] rounded-[16px] py-10 flex flex-col items-center gap-1">
                                <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">No saved cards</p>
                                <p className="text-[13px] text-[var(--colors-text-quaternary)]">This customer has no saved cards on file.</p>
                            </div>
                        ) : (
                            <div className="flex gap-4">
                                {savedCards.map(pm => (
                                    <div key={pm.id}
                                        className="flex-1 min-w-0 flex items-center gap-4 p-4 rounded-[12px] bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)]">
                                        <CardBrandMark brand={pm.brand} />
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">{pm.brand}</p>
                                            <p className="text-[14px] text-[var(--colors-text-quaternary)]">****{pm.last4}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    {/* Toolbar */}
                    <div className="shrink-0 flex items-center gap-3 px-6 pb-4">
                        <ToolbarTotal count={orders.length} entitySingular="transaction" />
                        <ToolbarSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search transaction..."

                        />
                        <ToolbarExport
                            disabled={filtered.length === 0}
                            exportData={() => {
                                if (filtered.length === 0) return null;
                                const nameById = new Map(customers.map(c => [c.id, `${c.firstName} ${c.lastName}`.trim() || c.email]));
                                return customerTransactionsExportData(filtered, id => nameById.get(id) ?? "");
                            }}
                            onExported={(fmt) => {
                                showToast("Payments exported", `${filtered.length} transaction${filtered.length === 1 ? "" : "s"} exported to ${fmt.toUpperCase()}.`, "success", "check");
                            }}
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
                                                <SortableHeader sortKey="planType" currentSort={txnSortKey} dir={txnSortDir} onSort={toggleTxnSort}>Products</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[120px]", "!text-right")}>
                                                <SortableHeader sortKey="amount"   currentSort={txnSortKey} dir={txnSortDir} onSort={toggleTxnSort} align="right">Amount</SortableHeader>
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
                                        {paged.map(o => {
                                            const isOpen = expanded.has(o.key);
                                            const single = o.txns[0];
                                            return (
                                                <Fragment key={o.key}>
                                                    {/* Order row — single-item orders are a plain row,
                                                        multi-item orders an accordion header (click to
                                                        expand the per-product lines). */}
                                                    <tr className={cn(
                                                        "transition-colors",
                                                        pulseTxId === o.key
                                                            ? "bg-[var(--colors-secondary-50)] animate-pulse"
                                                            : "hover:bg-[var(--colors-bg-secondary)]",
                                                        o.isMulti && "cursor-pointer",
                                                    )}
                                                        onClick={o.isMulti ? () => toggleExpand(o.key) : undefined}>
                                                        <td className={TD}>
                                                            <div className="flex items-center gap-3">
                                                                {o.isMulti ? (
                                                                    <span className="shrink-0 w-5 h-5 flex items-center justify-center text-[var(--colors-text-quaternary)]">
                                                                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                    </span>
                                                                ) : (
                                                                    <TxnIcon kind={single.kind} />
                                                                )}
                                                                <span className="text-[14px] font-medium text-[var(--colors-text-primary)]">{o.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className={cn(TD, "text-[var(--colors-text-tertiary)]")}>{o.kindLabel}</td>
                                                        {/* Refunded orders prefix `+` so the amount reads as
                                                            money returned to the customer — matches the
                                                            Wallet tab's `+ / −` convention (customer POV:
                                                            `+` money in, `−` money out). The order total is
                                                            already Σ|amountAed|, so no `Math.abs` needed. */}
                                                        <td className={cn(TD, "text-[var(--colors-text-tertiary)] whitespace-nowrap", "text-right")}>
                                                            {o.status === "refunded" ? `+ ${fmtAed(o.amount)}` : fmtAed(o.amount)}
                                                        </td>
                                                        <td className={TD}>
                                                            {/* A still-`complete` single payment with a pending
                                                                refund request (raised from the dashboard) reads
                                                                as "Refund requested" so the customer module
                                                                reflects the dashboard queue. Multi-item orders
                                                                show the aggregate order status. */}
                                                            {!o.isMulti && single.status === "complete" && single.refundRequestedAtISO ? (
                                                                <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]">
                                                                    Refund requested
                                                                </span>
                                                            ) : (
                                                                <TxnStatusBadge status={o.status} />
                                                            )}
                                                        </td>
                                                        <td className={cn(TD, "text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{fmtDateTime(o.dateISO)}</td>
                                                        <td className={TD} onClick={(e) => e.stopPropagation()}>
                                                            {/* "Receipt" shows the whole order. A single-item
                                                                order also exposes Refund inline (when refundable);
                                                                a multi-item order refunds per product inside the
                                                                accordion. */}
                                                            <RowActions
                                                                items={[
                                                                    { label: "Receipt", icon: Receipt, onClick: () => setReceiptOrder(o.txns) },
                                                                    ...(!o.isMulti && refundableLine(single)
                                                                        ? [{ label: "Refund payment", icon: CoinsSwap02, onClick: () => setRefundTxn(single) }]
                                                                        : []),
                                                                ]}
                                                            />
                                                        </td>
                                                    </tr>

                                                    {o.isMulti && isOpen && (
                                                        <tr className="bg-[var(--colors-bg-secondary)]/40">
                                                            <td className={cn(TD, "!py-0")} colSpan={6}>
                                                                <div className="flex flex-col gap-2 pl-11 pr-2 py-3">
                                                                    {o.txns.map(t => (
                                                                        <div key={t.id} className="flex items-center gap-3">
                                                                            <TxnIcon kind={t.kind} />
                                                                            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                                                                <span className="text-[14px] font-medium text-[var(--colors-text-primary)]">{t.name}</span>
                                                                                <span className="text-[13px] text-[var(--colors-text-quaternary)]">{planTypeLabel(t)}</span>
                                                                            </div>
                                                                            <span className="text-[14px] text-[var(--colors-text-tertiary)] whitespace-nowrap tabular-nums w-[120px] text-right">
                                                                                {t.status === "refunded" ? `+ ${fmtAed(Math.abs(t.amountAed))}` : fmtAed(t.amountAed)}
                                                                            </span>
                                                                            <div className="w-[150px] flex items-center">
                                                                                {t.status === "complete" && t.refundRequestedAtISO ? (
                                                                                    <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]">
                                                                                        Refund requested
                                                                                    </span>
                                                                                ) : (
                                                                                    <TxnStatusBadge status={t.status} />
                                                                                )}
                                                                            </div>
                                                                            <div className="w-[120px] flex justify-end">
                                                                                {refundableLine(t) && (
                                                                                    <Button variant="secondary-gray" size="sm" leftIcon={<CoinsSwap02 className="w-4 h-4" />}
                                                                                        onClick={() => setRefundTxn(t)}>
                                                                                        Refund
                                                                                    </Button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="px-6 shrink-0">
                        <Pagination page={clampedPage} total={sortedOrders.length} pageSize={pageSize}
                            onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />
                    </div>
                </>
            )}

            <PaymentFilterPanel open={filterOpen} onClose={() => setFilterOpen(false)}
                applied={applied} onApply={f => { setApplied(f); setPage(1); }} />

            {refundTxn && (
                <RefundModal txn={refundTxn} onClose={() => setRefundTxn(null)}
                    onConfirm={reason => handleRefund(refundTxn, reason)} />
            )}

            {receiptOrder && (
                <TransactionReceiptModal txns={receiptOrder} customerName={thisCustomerName}
                    onClose={() => setReceiptOrder(null)} />
            )}
        </div>
    );
}
