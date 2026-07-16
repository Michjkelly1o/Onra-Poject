"use client";

// Customer — generic single-select radio bottom sheet (Gender, Cancel reason, …).
// `flat` renders borderless rows like the Time Zone selector; default is bordered.

import { useEffect, useState } from "react";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { RadioDot } from "@/components/customer/shell/SelectIndicators";
import { Button } from "@/components/ui/button";

export function OptionSheet({
    open,
    onClose,
    title,
    options,
    value,
    confirmLabel = "Confirm",
    destructive = false,
    flat = false,
    onConfirm,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    options: string[];
    value?: string | null;
    confirmLabel?: string;
    destructive?: boolean;
    flat?: boolean;
    onConfirm: (value: string) => void;
}) {
    const [draft, setDraft] = useState<string | null>(value ?? null);
    useEffect(() => {
        if (open) setDraft(value ?? null);
    }, [open, value]);

    return (
        <CustomerSheet open={open} onClose={onClose}>
            <SheetToolbar title={title} onClose={onClose} />
            <div className={`flex flex-col ${flat ? "" : "gap-3 pt-1"}`}>
                {options.map((opt) =>
                    flat ? (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => setDraft(opt)}
                            className="flex items-center gap-3 py-4 text-left"
                        >
                            <span className="flex-1 text-base leading-6 text-[var(--brand-text)]">{opt}</span>
                            <RadioDot checked={draft === opt} />
                        </button>
                    ) : (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => setDraft(opt)}
                            className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors ${
                                draft === opt ? "border-2 border-[var(--brand-primary)] bg-[#fbfdfc]" : "border border-[#e4e7ec]"
                            }`}
                        >
                            <span className="flex-1 text-base leading-6 text-[var(--brand-text)]">{opt}</span>
                            <RadioDot checked={draft === opt} />
                        </button>
                    ),
                )}
            </div>
            <Button
                variant={destructive ? "secondary" : "primary"}
                size="xl"
                disabled={!draft}
                className={`mt-4 w-full rounded-full ${
                    destructive
                        ? "border-[#fda29b] bg-[#fef3f2] font-semibold text-[#b42318] hover:bg-[#fee4e2] hover:text-[#912018] active:bg-[#fee4e2] active:text-[#912018]"
                        : ""
                }`}
                onClick={() => {
                    if (draft) {
                        onConfirm(draft);
                        onClose();
                    }
                }}
            >
                {confirmLabel}
            </Button>
        </CustomerSheet>
    );
}
