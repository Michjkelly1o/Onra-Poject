"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — single-select segmented control (the "Type" filter)
// ─────────────────────────────────────────────────────────────────────────────
//
// A labelled row of equal segments, single-select: one option is highlighted;
// tapping the active one clears it (value → null). Shared by the Bookings filter
// (Classes / Private / Recovery) and the Search → Appointments filter (Private /
// Recovery) so both read and behave identically. NOT multi-select.

export function SegmentedControl<T extends string>({
    label,
    options,
    value,
    onChange,
}: {
    label: string;
    options: readonly T[];
    value: T | null;
    onChange: (v: T | null) => void;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-5 text-[#344054]">{label}</span>
            <div className="flex overflow-hidden rounded-md border border-[#d0d5dd] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                {options.map((opt, i) => {
                    const on = value === opt;
                    return (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => onChange(on ? null : opt)}
                            className={`min-h-10 flex-1 px-4 py-2 text-sm font-semibold leading-5 text-[#344054] transition-colors ${
                                i < options.length - 1 ? "border-r border-[#d0d5dd]" : ""
                            } ${on ? "bg-[#f9fafb]" : "bg-white"}`}
                        >
                            {opt}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
