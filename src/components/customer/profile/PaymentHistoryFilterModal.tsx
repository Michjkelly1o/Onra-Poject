"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — PaymentHistoryFilterModal — Figma 4479 (Payment history filter)
// ─────────────────────────────────────────────────────────────────────────────
//
// Same full-screen chrome + date-range fields as the Bookings filter, with two
// multi-select pill groups: Payment type (Service / Products) and Payment method
// (Apple Pay / Google pay / Gift card / Other card).

import { useState } from "react";
import { Calendar } from "@untitledui/icons";
import { FullScreenFilterModal } from "@/components/customer/shell/FullScreenFilterModal";
import { DatePickerSheet } from "@/components/customer/shell/DatePickerSheet";
import { FilterPill } from "@/components/customer/shell/FilterPill";
import { REAL_TODAY_ISO } from "@/lib/customer/dates";
import { PAYMENT_METHOD_LABEL, type PaymentMethod, type PaymentType } from "@/lib/customer/payment-history";

export interface PaymentHistoryFilters {
    dateFrom: string | null;
    dateTo: string | null;
    /** Single-select — Service OR Products (never both). */
    type: PaymentType | null;
    methods: PaymentMethod[];
}

export const EMPTY_PAYMENT_FILTERS: PaymentHistoryFilters = { dateFrom: null, dateTo: null, type: null, methods: [] };

export function paymentFilterCount(f: PaymentHistoryFilters): number {
    return (f.dateFrom || f.dateTo ? 1 : 0) + (f.type ? 1 : 0) + f.methods.length;
}

export function hasPaymentFilters(f: PaymentHistoryFilters): boolean {
    return paymentFilterCount(f) > 0;
}

const TYPE_OPTIONS: { id: PaymentType; label: string }[] = [
    { id: "service", label: "Service" },
    { id: "products", label: "Products" },
];
const METHOD_OPTIONS: { id: PaymentMethod; label: string }[] = [
    { id: "apple", label: "Apple Pay" },
    { id: "google", label: PAYMENT_METHOD_LABEL.google },
    { id: "gift_card", label: "Gift card" },
    { id: "card", label: "Other card" },
];

/** ISO `YYYY-MM-DD` → "13 Jul 2026". */
function fmtDate(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** One field label for a single day or a span. */
function rangeLabel(from: string | null, to: string | null): string {
    if (!from && !to) return "Select date";
    if (from && (!to || to === from)) return fmtDate(from);
    return `${fmtDate(from as string)} – ${fmtDate(to as string)}`;
}

export interface PaymentHistoryFilterModalProps {
    open: boolean;
    onClose: () => void;
    draft: PaymentHistoryFilters;
    onDraftChange: (f: PaymentHistoryFilters) => void;
    onReset: () => void;
    onApply: () => void;
    /** Rows the current draft selection would return — drives "Show N results". */
    resultCount?: number;
}

export function PaymentHistoryFilterModal({
    open,
    onClose,
    draft,
    onDraftChange,
    onReset,
    onApply,
    resultCount,
}: PaymentHistoryFilterModalProps) {
    const disabled = paymentFilterCount(draft) === 0;
    const [pickerOpen, setPickerOpen] = useState(false);
    const dateFieldCls =
        "flex w-full items-center gap-2 rounded-md border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-sm leading-5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors active:bg-gray-50";

    const toggleMethod = (v: PaymentMethod) => {
        const arr = draft.methods;
        onDraftChange({ ...draft, methods: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] });
    };
    const clearDates = () => onDraftChange({ ...draft, dateFrom: null, dateTo: null });

    return (
        <FullScreenFilterModal
            open={open}
            onClose={onClose}
            onReset={onReset}
            onApply={onApply}
            resultCount={resultCount}
            resetDisabled={disabled}
            applyDisabled={disabled}
        >
            <div className="flex flex-col gap-6">
                {/* Date range */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium leading-5 text-[#344054]">Date range</span>
                        {(draft.dateFrom || draft.dateTo) && (
                            <button type="button" onClick={clearDates} className="text-sm font-semibold leading-5 text-[var(--brand-primary)]">
                                Clear
                            </button>
                        )}
                    </div>
                    <button type="button" onClick={() => setPickerOpen(true)} className={dateFieldCls}>
                        <Calendar className="size-4 shrink-0 text-[#667085]" aria-hidden />
                        <span className={`min-w-0 flex-1 truncate text-left ${draft.dateFrom ? "text-[var(--brand-text)]" : "text-[#667085]"}`}>
                            {rangeLabel(draft.dateFrom, draft.dateTo)}
                        </span>
                    </button>
                </div>

                <div className="h-px w-full bg-[#e4e7ec]" />

                {/* Payment type */}
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium leading-5 text-[#344054]">Payment type</span>
                    <div className="flex flex-wrap gap-2">
                        {TYPE_OPTIONS.map((t) => (
                            <FilterPill
                                key={t.id}
                                label={t.label}
                                selected={draft.type === t.id}
                                onClick={() => onDraftChange({ ...draft, type: draft.type === t.id ? null : t.id })}
                            />
                        ))}
                    </div>
                </div>

                <div className="h-px w-full bg-[#e4e7ec]" />

                {/* Payment method */}
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium leading-5 text-[#344054]">Payment method</span>
                    <div className="flex flex-wrap gap-2">
                        {METHOD_OPTIONS.map((m) => (
                            <FilterPill key={m.id} label={m.label} selected={draft.methods.includes(m.id)} onClick={() => toggleMethod(m.id)} />
                        ))}
                    </div>
                </div>
            </div>

            <DatePickerSheet
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                title="Select date range"
                range
                rangeValue={{ from: draft.dateFrom, to: draft.dateTo }}
                defaultISO={REAL_TODAY_ISO}
                onSelectRange={(from, to) => onDraftChange({ ...draft, dateFrom: from, dateTo: to })}
            />
        </FullScreenFilterModal>
    );
}
