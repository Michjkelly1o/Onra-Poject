"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "@untitledui/icons";
import { cn } from "@/lib/utils";

// ─── SelectInput — generic trigger + dropdown ─────────────────────────────────
//
// One component for every "icon + label + dropdown" selector in the app.
// Pass a different `triggerIcon` and `options` array per use-case:
//
//   Location selector:
//     <SelectInput triggerIcon={<MarkerPin01 />} placeholder="Select location"
//       options={locations.map(l => ({ value: l.id, label: l.name, icon: <Building01 /> }))}
//       value={location} onChange={setLocation} />
//
//   Instructor selector:
//     <SelectInput triggerIcon={<User01 />} placeholder="All instructors"
//       options={instructors.map(i => ({ value: i.id, label: i.name }))}
//       value={instructor} onChange={setInstructor} />
//
//   Period selector:
//     <SelectInput triggerIcon={<Calendar />} placeholder="This week"
//       options={periods} value={period} onChange={setPeriod} />

export interface SelectOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

export interface SelectInputProps {
    triggerIcon?: React.ReactNode;
    placeholder?: string;
    options: SelectOption[];
    value?: string;
    onChange?: (value: string) => void;
    className?: string;
    menuClassName?: string;
    width?: string;
}

export function SelectInput({
    triggerIcon,
    placeholder = "Select...",
    options,
    value,
    onChange,
    className,
    menuClassName,
    width = "w-[220px]",
}: SelectInputProps) {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    // Close on outside click
    React.useEffect(() => {
        function handle(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, []);

    const selected = options.find((o) => o.value === value);
    const displayLabel = selected?.label ?? placeholder;
    const isPlaceholder = !selected;

    function select(option: SelectOption) {
        onChange?.(option.value);
        setOpen(false);
    }

    return (
        <div ref={ref} className={cn("relative", width, className)}>
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen((p) => !p)}
                className={cn(
                    "flex items-center gap-[8px] w-full h-[40px]",
                    "bg-white border-1 border-[#d0d5dd] rounded-[8px]",
                    "px-[12px]",
                    "shadow-[0px_1px_1px_rgba(16,24,40,0.05)]",
                    "focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c]",
                    "transition-all",
                )}
            >
                {/* Leading icon */}
                {triggerIcon && (
                    <span className="w-5 h-5 flex items-center justify-center shrink-0 text-[#667085]">
                        {triggerIcon}
                    </span>
                )}

                {/* Label */}
                <span
                    className={cn(
                        "flex-1 text-left text-[14px] leading-[20px] truncate",
                        isPlaceholder ? "text-[#667085] font-normal" : "text-[#344054] font-medium",
                    )}
                >
                    {displayLabel}
                </span>

                {/* Chevron */}
                <span className="w-4 h-4 flex items-center justify-center shrink-0 text-[#667085]">
                    {open ? (
                        <ChevronUp className="w-4 h-4" />
                    ) : (
                        <ChevronDown className="w-4 h-4" />
                    )}
                </span>
            </button>

            {/* Dropdown menu */}
            {open && (
                <div
                    className={cn(
                        "absolute z-50 top-[calc(100%+4px)] left-0 min-w-full",
                        "bg-white border-1 border-[#e4e7ec] rounded-[8px]",
                        "shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]",
                        "p-[4px]",
                        menuClassName,
                    )}
                >
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => select(option)}
                            className={cn(
                                "flex items-center gap-[8px] w-full",
                                "px-[10px] py-[9px] rounded-[6px]",
                                "text-[14px] font-medium text-[#344054]",
                                "hover:bg-[#f9fafb] transition-colors",
                                option.value === value && "bg-[#f9fafb] text-[#101828]",
                            )}
                        >
                            {option.icon && (
                                <span className="w-4 h-4 flex items-center justify-center shrink-0 text-[#667085]">
                                    {option.icon}
                                </span>
                            )}
                            <span className="truncate">{option.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
