"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — UnitSuffixSelect
// ─────────────────────────────────────────────────────────────────────────────
//
// Compact unit picker designed to sit INSIDE another bordered input
// container as a right-side suffix (e.g. Booking window's "7 [days ▾]",
// Waitlist's "12 [hours ▾]"). Renders as a borderless button + portal
// dropdown so it visually blends with the parent input's border
// instead of stacking a second bordered box (which was the seam bug in
// the previous SelectInput-based implementation).
//
// USAGE — wrap the numeric input + this suffix in a single bordered
// flex container:
//
//   <div className="flex items-stretch h-10 border-1 border-[#d0d5dd]
//                    rounded-[8px] overflow-hidden ...">
//       <input ... />
//       <UnitSuffixSelect value={unit} onChange={setUnit} options={UNITS} />
//   </div>

import { useRef, useState } from "react";
import { ChevronDown } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { FixedDropdown } from "@/components/ui/FixedDropdown";

export interface UnitSuffixOption {
    value: string;
    label: string;
}

export function UnitSuffixSelect({
    value, onChange, options, width = 120, disabled = false,
}: {
    value: string;
    onChange: (next: string) => void;
    options: UnitSuffixOption[];
    /** Fixed width of the suffix in px. Defaults to 120. */
    width?: number;
    disabled?: boolean;
}) {
    const btnRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);

    const current = options.find(o => o.value === value)?.label ?? value;

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={() => !disabled && setOpen(p => !p)}
                disabled={disabled}
                style={{ width }}
                className={cn(
                    "shrink-0 h-full flex items-center justify-between gap-2 px-3 border-l border-[#d0d5dd] bg-[#f9fafb] text-[14px] text-[#344054] transition-colors",
                    !disabled && "hover:bg-[#f2f4f7]",
                    disabled && "cursor-not-allowed opacity-70",
                )}
            >
                <span className="truncate">{current}</span>
                <ChevronDown className="w-4 h-4 text-[#667085] shrink-0" />
            </button>
            <FixedDropdown
                triggerRef={btnRef}
                open={open}
                onClose={() => setOpen(false)}
                minWidth={width}
            >
                {options.map(o => (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => { onChange(o.value); setOpen(false); }}
                        className={cn(
                            "w-full flex items-center px-3 py-2 text-[14px] font-medium transition-colors text-left",
                            value === o.value
                                ? "bg-[#f9fafb] text-[#101828]"
                                : "text-[#344054] hover:bg-[#f9fafb]",
                        )}
                    >
                        {o.label}
                    </button>
                ))}
            </FixedDropdown>
        </>
    );
}
