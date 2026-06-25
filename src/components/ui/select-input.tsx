"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Check } from "@untitledui/icons";
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
    /** Disables the trigger button — used when the parent form is locked
     *  (e.g. editing the Owner role). Greys the trigger and prevents the
     *  menu from opening. */
    disabled?: boolean;
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
    disabled = false,
}: SelectInputProps) {
    const [open, setOpen] = React.useState(false);
    const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({ position: "fixed", visibility: "hidden" });
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

    // Position the menu with `position: fixed` (computed from the trigger
    // rect) so it escapes any modal / scroll-container `overflow` clipping,
    // and flip it above the trigger when there isn't room below.
    React.useLayoutEffect(() => {
        if (!open || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const menuH = Math.min(264, options.length * 38 + 8);
        const spaceBelow = window.innerHeight - r.bottom;
        const flipUp = spaceBelow < menuH + 8 && r.top > menuH + 8;
        setMenuStyle({
            position: "fixed",
            left: r.left,
            width: r.width,
            zIndex: 9999,
            ...(flipUp ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
        });
    }, [open, options.length]);

    // A fixed-positioned menu can't track scrolling — close it on any scroll
    // that ORIGINATES OUTSIDE the menu. Scrolls inside the menu (the user
    // scrolling through a long option list) must not close it.
    const menuRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        if (!open) return;
        function onScroll(e: Event) {
            const target = e.target as Node | null;
            if (menuRef.current && target && menuRef.current.contains(target)) return;
            setOpen(false);
        }
        window.addEventListener("scroll", onScroll, true);
        return () => window.removeEventListener("scroll", onScroll, true);
    }, [open]);

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
                disabled={disabled}
                onClick={() => !disabled && setOpen((p) => !p)}
                className={cn(
                    "flex items-center gap-[8px] w-full h-[40px]",
                    "bg-white border-1 border-[#d0d5dd] rounded-[8px]",
                    "px-[12px]",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]",
                    "focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c]",
                    "transition-all",
                    disabled && "opacity-60 cursor-not-allowed bg-[#f9fafb]",
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
                    ref={menuRef}
                    style={menuStyle}
                    className={cn(
                        // Solid bg matters here — without it, scrolling the
                        // option list lets the layer underneath bleed through
                        // when the menu floats over a modal.
                        "bg-white border-1 border-[#e4e7ec] rounded-[8px]",
                        "shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]",
                        "p-[4px] max-h-[264px] overflow-y-auto scrollbar-hide",
                        menuClassName,
                    )}
                >
                    {options.map((option) => {
                        const isSelected = option.value === value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => select(option)}
                                className={cn(
                                    "flex items-center gap-[8px] w-full",
                                    "px-[10px] py-[9px] rounded-[6px]",
                                    "text-[14px] font-medium text-[#344054]",
                                    "hover:bg-[#f9fafb] transition-colors",
                                    isSelected && "bg-[#f9fafb] text-[#101828]",
                                )}
                            >
                                {option.icon && (
                                    <span className="w-4 h-4 flex items-center justify-center shrink-0 text-[#667085]">
                                        {option.icon}
                                    </span>
                                )}
                                <span className="flex-1 min-w-0 truncate text-left">{option.label}</span>
                                {/* Selected indicator — sage check, matches the
                                    filter-dropdown pattern used by pay-rate /
                                    gift-cards. */}
                                {isSelected && (
                                    <Check className="w-4 h-4 text-[#658774] shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
