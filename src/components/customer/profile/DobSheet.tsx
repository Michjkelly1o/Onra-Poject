"use client";

// Customer — Date-of-birth picker (bottom sheet).
// A thin wrapper over the shared <DatePickerSheet>: opens on 2000-01-01 by
// default and caps the year selector at the current year (a birthdate is never
// in the future). The generic calendar lives in components/customer/shell.

import { DatePickerSheet } from "@/components/customer/shell/DatePickerSheet";

const CURRENT_YEAR = 2026;

export function DobSheet({
    open,
    onClose,
    value,
    onSelect,
}: {
    open: boolean;
    onClose: () => void;
    value?: string;
    onSelect: (iso: string) => void;
}) {
    return (
        <DatePickerSheet
            open={open}
            onClose={onClose}
            title="Date of birth"
            value={value}
            onSelect={onSelect}
            defaultISO="2000-01-01"
            maxISO={`${CURRENT_YEAR}-12-31`}
            maxYear={CURRENT_YEAR}
        />
    );
}
