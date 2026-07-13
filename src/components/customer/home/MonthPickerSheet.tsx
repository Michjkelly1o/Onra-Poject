"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Month picker sheet (Search date selector) — Figma 2452-82075
// ─────────────────────────────────────────────────────────────────────────────
//
// A bottom sheet with scroll-snap month + year wheels (drag/scroll to spin; the
// centred value is bold, neighbours faded). Apply jumps the date selector to the
// chosen month. Bounded to [today → +1 year].

import { useState } from "react";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { ScrollWheel } from "@/components/customer/shell/WheelPicker";
import { Button } from "@/components/ui/button";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_VALUES = MONTHS_SHORT.map((_, i) => i);

export interface MonthPickerSheetProps {
    open: boolean;
    onClose: () => void;
    month: number;
    year: number;
    minYear: number;
    maxYear: number;
    onApply: (month: number, year: number) => void;
}

export function MonthPickerSheet({ open, onClose, month, year, minYear, maxYear, onApply }: MonthPickerSheetProps) {
    const [m, setM] = useState(month);
    const [y, setY] = useState(year);
    // Sync to the incoming month/year the moment the sheet opens (during render, so
    // the wheels mount with the right value and their layout-effect can centre it).
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            setM(month);
            setY(year);
        }
    }

    const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

    return (
        <CustomerSheet open={open} onClose={onClose}>
            <SheetToolbar title={`${MONTHS[m]} ${y}`} onClose={onClose} />

            {/* Scroll-snap wheels with a centred highlight band. */}
            <div className="relative flex items-center justify-center gap-6 py-2">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-6 top-1/2 h-10 -translate-y-1/2 rounded-xl bg-[#f9fafb]"
                />
                <ScrollWheel labels={MONTHS_SHORT} values={MONTH_VALUES} value={m} onChange={setM} widthClass="w-[80px]" />
                <span className="relative text-lg font-semibold leading-7 text-[var(--brand-text)]">–</span>
                <ScrollWheel labels={years.map(String)} values={years} value={y} onChange={setY} widthClass="w-[80px]" />
            </div>

            <Button
                variant="primary"
                size="xl"
                className="mt-2 w-full rounded-full"
                onClick={() => {
                    onApply(m, y);
                    onClose();
                }}
            >
                Apply
            </Button>
        </CustomerSheet>
    );
}
