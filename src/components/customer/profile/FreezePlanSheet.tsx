"use client";

// Customer — Freeze plan bottom sheet (duration + unit + reason).
//
// Policy-driven: the freeze reasons, the maximum duration, and the freeze fee
// all come from the branch's freeze policy (Settings → Customer → Freeze
// policy). When the policy allows no reasons (exceptions off), the reason
// section is hidden. See new-prd/freeze-policy-implementation-plan.md.

import { useEffect, useState } from "react";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { RadioDot } from "@/components/customer/shell/SelectIndicators";
import { SelectInput } from "@/components/ui/select-input";
import { Button } from "@/components/ui/button";

const UNITS = [
    { label: "Day", days: 1 },
    { label: "Week", days: 7 },
    { label: "Month", days: 30 },
];
const FIELD =
    "h-10 w-full rounded-lg border border-[#d0d5dd] bg-white px-3.5 text-base leading-6 text-[var(--brand-text)] outline-none focus:border-[var(--brand-primary)]";
const LABEL = "text-sm font-medium leading-5 text-[#344054]";

export function FreezePlanSheet({
    open,
    onClose,
    planNoun,
    reasons,
    requireReason,
    maxDays,
    fee,
    onConfirm,
}: {
    open: boolean;
    onClose: () => void;
    planNoun: string;
    /** Reasons the member may pick — from the policy's enabled reasons. */
    reasons: string[];
    /** Whether a reason must be chosen (policy "Allow exceptions"). */
    requireReason: boolean;
    /** Maximum freeze length in days, or null for no cap. */
    maxDays: number | null;
    /** Freeze fee to disclose + charge, or null for no fee. */
    fee: { amount: number; type: "one_time" | "recurring" } | null;
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

    const n = parseInt(duration, 10) || 0;
    const days = n * (UNITS.find((u) => u.label === unit)?.days ?? 1);
    const overMax = maxDays != null && days > maxDays;
    const showReasons = requireReason && reasons.length > 0;
    const valid = n > 0 && !overMax && (!showReasons || !!reason);

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
            {maxDays != null && (
                <p className={`mt-2 text-sm leading-5 ${overMax ? "text-[#d92d20]" : "text-[#667085]"}`}>
                    Maximum freeze: {maxDays} day{maxDays === 1 ? "" : "s"}.
                </p>
            )}

            {showReasons && (
                <>
                    <p className="mb-2 mt-4 text-sm font-medium leading-5 text-[#344054]">Freeze reason</p>
                    <div className="flex flex-col gap-3">
                        {reasons.map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setReason(r)}
                                className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                                    reason === r ? "border-[var(--brand-primary)] bg-[#fbfdfc] ring-1 ring-inset ring-[var(--brand-primary)]" : "border-[#e4e7ec]"
                                }`}
                            >
                                <span className="flex-1 text-base leading-6 text-[var(--brand-text)]">{r}</span>
                                <RadioDot checked={reason === r} />
                            </button>
                        ))}
                    </div>
                </>
            )}

            {fee && fee.amount > 0 && (
                <div className="mt-4 rounded-xl border border-[#f9dbaf] bg-[#fffaf5] px-4 py-3">
                    <p className="text-sm leading-5 text-[#b93815]">
                        A {fee.type === "recurring" ? "recurring" : "one-time"} freeze fee of{" "}
                        <span className="font-semibold">AED {fee.amount}</span> will be charged when you confirm.
                    </p>
                </div>
            )}

            <Button
                variant="primary"
                size="xl"
                disabled={!valid}
                className="mt-5 w-full rounded-full"
                onClick={() => {
                    if (!valid) return;
                    onConfirm(days, reason ?? "");
                    onClose();
                }}
            >
                Confirm
            </Button>
        </CustomerSheet>
    );
}
