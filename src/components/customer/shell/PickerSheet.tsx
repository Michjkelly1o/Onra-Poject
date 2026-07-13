"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — PickerSheet (searchable single-select bottom sheet)
// ─────────────────────────────────────────────────────────────────────────────
//
// The country / emirate / region picker behind the Profile address form. Reuses
// the branch-selector anatomy: a tall <CustomerSheet> (consistent height, header
// visible behind), a search field, flat selectable rows (optional leading flag +
// label + radio — the same "checkbox group item" shape as the instructor filter),
// and a Confirm button. Select-then-confirm, matching Figma 4416 (country picker).

import { useEffect, useState } from "react";
import { SearchLg } from "@untitledui/icons";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { RadioDot } from "@/components/customer/shell/SelectIndicators";
import { Button } from "@/components/ui/button";

export interface PickerOption {
    value: string;
    label: string;
    /** Optional emoji flag rendered in a leading circle (country picker). */
    flag?: string;
}

export function PickerSheet({
    open,
    onClose,
    title,
    options,
    value,
    onConfirm,
    searchPlaceholder = "Search...",
    confirmLabel = "Confirm",
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    options: PickerOption[];
    value?: string;
    onConfirm: (value: string) => void;
    searchPlaceholder?: string;
    confirmLabel?: string;
}) {
    const [q, setQ] = useState("");
    const [sel, setSel] = useState<string | undefined>(value);

    useEffect(() => {
        if (open) {
            setSel(value);
            setQ("");
        }
    }, [open, value]);

    const query = q.trim().toLowerCase();
    const rows = query ? options.filter((o) => o.label.toLowerCase().includes(query)) : options;

    return (
        <CustomerSheet open={open} onClose={onClose} tall>
            <p className="shrink-0 pb-3 text-center text-lg font-semibold leading-7 text-[#101828]">{title}</p>

            {/* Search */}
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-[#d0d5dd] bg-white px-3.5 py-2.5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <SearchLg className="size-5 shrink-0 text-[#667085]" aria-hidden />
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="min-w-0 flex-1 bg-transparent text-base leading-6 text-[#101828] outline-none placeholder:text-[#667085]"
                />
            </div>

            {/* Options */}
            <div className="mt-1 flex min-h-0 flex-1 flex-col overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {rows.length > 0 ? (
                    rows.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => setSel(o.value)}
                            aria-pressed={sel === o.value}
                            className="flex w-full items-center gap-3 py-4 text-left"
                        >
                            {o.flag && (
                                <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f4f7] text-lg leading-none">
                                    {o.flag}
                                </span>
                            )}
                            <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-[#344054]">
                                {o.label}
                            </span>
                            <RadioDot checked={sel === o.value} />
                        </button>
                    ))
                ) : (
                    <p className="py-12 text-center text-sm text-[#667085]">No results found.</p>
                )}
            </div>

            {/* Confirm */}
            <div className="shrink-0 pt-4">
                <Button
                    variant="primary"
                    size="xl"
                    disabled={!sel}
                    className="w-full rounded-full"
                    onClick={() => {
                        if (sel) {
                            onConfirm(sel);
                            onClose();
                        }
                    }}
                >
                    {confirmLabel}
                </Button>
            </div>
        </CustomerSheet>
    );
}
