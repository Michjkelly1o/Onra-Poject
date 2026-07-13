"use client";

// Customer — add/edit card form (illustration + fields + sticky submit).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Trash01 } from "@untitledui/icons";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { useMainScrollable } from "@/lib/customer/use-scrollable";
import { Button } from "@/components/ui/button";

export interface CardFormData {
    holder: string;
    number: string; // grouped digits, e.g. "1234 5678 9000 0000"
    expiry: string; // "MM / YY"
    cvv: string;
}

const FIELD =
    "w-full rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)] outline-none transition-colors placeholder:text-[#667085] focus:border-[var(--brand-primary)]";
const LABEL = "text-sm font-medium leading-5 text-[#344054]";

function fmtNumber(v: string): string {
    return v
        .replace(/\D/g, "")
        .slice(0, 16)
        .replace(/(.{4})/g, "$1 ")
        .trim();
}
function fmtExpiry(v: string): string {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length <= 2 ? d : `${d.slice(0, 2)} / ${d.slice(2)}`;
}

export function CardForm({
    title,
    submitLabel,
    initial,
    onSubmit,
    onDelete,
}: {
    title: string;
    submitLabel: string;
    initial?: Partial<CardFormData>;
    onSubmit: (data: CardFormData) => void;
    onDelete?: () => void;
}) {
    const router = useRouter();
    const scrollable = useMainScrollable();
    const [holder, setHolder] = useState(initial?.holder ?? "");
    const [number, setNumber] = useState(initial?.number ? fmtNumber(initial.number) : "");
    const [expiry, setExpiry] = useState(initial?.expiry ?? "");
    const [cvv, setCvv] = useState(initial?.cvv ?? "");

    const valid =
        holder.trim().length > 0 &&
        number.replace(/\D/g, "").length >= 12 &&
        expiry.replace(/\D/g, "").length >= 3 &&
        cvv.trim().length >= 3;

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-base font-semibold leading-6 text-[var(--brand-text)]">{title}</h1>
                {onDelete ? (
                    <button
                        type="button"
                        onClick={onDelete}
                        aria-label="Remove card"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                    >
                        <Trash01 className="size-5 text-[#d92d20]" aria-hidden />
                    </button>
                ) : (
                    <span aria-hidden className="size-10 shrink-0" />
                )}
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-5 px-4 pb-4 pt-[80px]">
                {/* Card illustration */}
                <div className="rounded-2xl bg-gradient-to-br from-[#eaecf0] to-[#f8f9fc] p-5 shadow-[0px_2px_8px_rgba(16,24,40,0.08)]">
                    <div className="flex items-center justify-between">
                        <div className="h-6 w-9 rounded bg-[#cbd2dd]" />
                        <span className="text-[#98a2b3]">)))</span>
                    </div>
                    <p className="mt-6 font-mono text-lg tracking-[0.2em] text-[var(--brand-text)]">
                        {number || "1234 5678 9000 0000"}
                    </p>
                    <div className="mt-3 flex items-end justify-between">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#344054]">{holder || "Card holder"}</p>
                            <p className="text-sm text-[#475467]">{expiry || "MM / YY"}</p>
                        </div>
                        <span className="text-base font-bold italic text-[#1a1f71]">VISA</span>
                    </div>
                </div>

                <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>Card holder name</span>
                    <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Card holder name" className={FIELD} />
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>Card number</span>
                    <input
                        inputMode="numeric"
                        value={number}
                        onChange={(e) => setNumber(fmtNumber(e.target.value))}
                        placeholder="1234 5678 9000 0000"
                        className={FIELD}
                    />
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5">
                        <span className={LABEL}>Expiry</span>
                        <input
                            inputMode="numeric"
                            value={expiry}
                            onChange={(e) => setExpiry(fmtExpiry(e.target.value))}
                            placeholder="MM / YY"
                            className={FIELD}
                        />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className={LABEL}>CVV</span>
                        <input
                            inputMode="numeric"
                            value={cvv}
                            onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            placeholder="123"
                            className={FIELD}
                        />
                    </label>
                </div>
            </div>

            <div
                className={`sticky bottom-0 z-10 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
                    scrollable ? "bg-white" : ""
                }`}
            >
                <Button
                    variant="primary"
                    size="xl"
                    disabled={!valid}
                    className="w-full rounded-full"
                    onClick={() => onSubmit({ holder, number, expiry, cvv })}
                >
                    {submitLabel}
                </Button>
            </div>
        </div>
    );
}
