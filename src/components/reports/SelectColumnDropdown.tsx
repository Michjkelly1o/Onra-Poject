"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Select column dropdown
// ─────────────────────────────────────────────────────────────────────────────
//
// Toolbar widget on every report page. Figma 4233:102660 / 4232:123398 /
// 4256:49234 / 4232:183452.
//
// Trigger pill: `[Columns01] Select column (N) ▾` where N = checked count.
// Popover: Select all (top) + horizontal divider + one checkbox per
// toggleable column. Fixed columns (the report's identity columns like
// "Branch location" / "Order date") are NEVER shown here — they live
// outside the toggle set.

import { useEffect, useRef, useState } from "react";
import { Columns01, ChevronDown, Check } from "@untitledui/icons";
import { cn } from "@/lib/utils";

export interface SelectColumnOption {
    key: string;
    label: string;
}

export interface SelectColumnDropdownProps {
    options: SelectColumnOption[];
    /** Keys currently checked. */
    value: Set<string>;
    /** Called whenever the checked set changes. */
    onChange: (next: Set<string>) => void;
}

export function SelectColumnDropdown({ options, value, onChange }: SelectColumnDropdownProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const allChecked = options.length > 0 && options.every(o => value.has(o.key));

    function toggleAll() {
        if (allChecked) onChange(new Set());
        else onChange(new Set(options.map(o => o.key)));
    }

    function toggleOne(key: string) {
        const next = new Set(value);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        onChange(next);
    }

    const count = value.size;

    return (
        <div ref={ref} className="relative">
            <button type="button"
                onClick={() => setOpen(p => !p)}
                className={cn(
                    "h-[40px] bg-white border-1 border-[#d0d5dd] rounded-[8px] px-3.5 flex items-center gap-2 text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                )}>
                <Columns01 className="w-4 h-4 text-[#667085]" />
                <span>Select column</span>
                <span className="inline-flex items-center justify-center min-w-[24px] h-[20px] px-1.5 rounded-full bg-[#f2f4f7] border-1 border-[#e4e7ec] text-[12px] font-medium text-[#344054]">
                    {count}
                </span>
                <ChevronDown className={cn(
                    "w-4 h-4 text-[#667085] transition-transform",
                    open && "rotate-180",
                )} />
            </button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[220px] max-h-[400px] overflow-y-auto">
                    <CheckboxRow label="Select all" checked={allChecked} onToggle={toggleAll} />
                    <div className="h-px bg-[#e4e7ec] my-1 mx-1.5" />
                    {options.map(opt => (
                        <CheckboxRow key={opt.key}
                            label={opt.label}
                            checked={value.has(opt.key)}
                            onToggle={() => toggleOne(opt.key)} />
                    ))}
                </div>
            )}
        </div>
    );
}

function CheckboxRow({ label, checked, onToggle }: {
    label: string; checked: boolean; onToggle: () => void;
}) {
    return (
        <button type="button"
            onClick={onToggle}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#f9fafb] transition-colors">
            <span className={cn(
                "w-4 h-4 rounded-[4px] border-1 flex items-center justify-center shrink-0 transition-colors",
                checked
                    ? "bg-[#658774] border-[#658774]"
                    : "bg-white border-[#d0d5dd]",
            )}>
                {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span className="text-[14px] font-medium text-[#344054] leading-[20px]">{label}</span>
        </button>
    );
}
