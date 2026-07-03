"use client";

// Customer — Freeze plan bottom sheet (duration + unit + reason).

import { useEffect, useState } from "react";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { RadioDot } from "@/components/customer/shell/SelectIndicators";
import { SelectInput } from "@/components/ui/select-input";
import { Button } from "@/components/ui/button";

const REASONS = [
    "I want to cancel",
    "I'm moving to a new area",
    "I'll be traveling",
    "I have an injury or medical issue",
    "I need a seasonal break",
];
const UNITS = [
    { label: "Day", days: 1 },
    { label: "Week", days: 7 },
    { label: "Month", days: 30 },
];
const FIELD =
    "h-10 w-full rounded-lg border border-[#d0d5dd] bg-white px-3.5 text-base leading-6 text-[#101828] outline-none focus:border-[#658774]";
const LABEL = "text-sm font-medium leading-5 text-[#344054]";

export function FreezePlanSheet({
    open,
    onClose,
    planNoun,
    onConfirm,
}: {
    open: boolean;
    onClose: () => void;
    planNoun: string;
    onConfirm: (days: number, reason: string) => void;
}) {
    const [duration, setDuration] = useState("30");
    const [unit, setUnit] = useState("Day");
    const [reason, setReason] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setDuration("30");
            setUnit("Day");
            setReason(null);
        }
    }, [open]);

    const n = parseInt(duration, 10);
    const valid = n > 0 && !!reason;

    return (
        <CustomerSheet open={open} onClose={onClose}>
            <SheetToolbar title={`Freeze ${planNoun}`} onClose={onClose} />
            <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="flex flex-col gap-1.5">
                    <span className={LABEL}>Duration</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
                        className={FIELD}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className={LABEL}>Unit</span>
                    <SelectInput
                        value={unit}
                        onChange={setUnit}
                        options={UNITS.map((u) => ({ value: u.label, label: u.label }))}
                        width="w-full"
                    />
                </div>
            </div>

            <p className="mb-2 mt-4 text-sm font-medium leading-5 text-[#344054]">Freeze reason</p>
            <div className="flex flex-col gap-3">
                {REASONS.map((r) => (
                    <button
                        key={r}
                        type="button"
                        onClick={() => setReason(r)}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                            reason === r ? "border-[#658774] bg-[#fbfdfc] ring-1 ring-inset ring-[#658774]" : "border-[#e4e7ec]"
                        }`}
                    >
                        <span className="flex-1 text-base leading-6 text-[#101828]">{r}</span>
                        <RadioDot checked={reason === r} />
                    </button>
                ))}
            </div>

            <Button
                variant="primary"
                size="xl"
                disabled={!valid}
                className="mt-5 w-full rounded-full"
                onClick={() => {
                    if (!valid) return;
                    const days = n * (UNITS.find((u) => u.label === unit)?.days ?? 1);
                    onConfirm(days, reason!);
                    onClose();
                }}
            >
                Confirm
            </Button>
        </CustomerSheet>
    );
}
