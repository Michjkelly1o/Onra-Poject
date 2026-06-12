"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — NumberWithUnitInput (compound number + unit dropdown)
// ─────────────────────────────────────────────────────────────────────────────
//
// One bordered container hosting:
//   • a transparent number input on the left
//   • a borderless dropdown trigger on the right (label + chevron)
//   • a fixed-positioned popover that escapes overflow clipping inside
//     scrollable form cards (same pattern as `SelectInput`)
//
// Focus state lives on the OUTER wrapper via `focus-within:` — so tabbing
// into the number OR opening the dropdown both ring the whole control.
//
// The popover positioning mirrors `SelectInput` so its DS feel is identical
// (close on outside click / outside scroll / flip-up when no room below).

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "@untitledui/icons";
import { cn } from "@/lib/utils";

export interface NumberWithUnitOption {
    value: string;
    label: string;
}

export interface NumberWithUnitInputProps {
    value: number;
    unit: string;
    units: NumberWithUnitOption[];
    onValueChange: (next: number) => void;
    onUnitChange: (next: string) => void;
    disabled?: boolean;
    placeholder?: string;
    min?: number;
    max?: number;
    /** Tailwind width class for the unit popover. Defaults to a width that
     *  matches the trigger so the menu looks anchored. */
    menuWidth?: number;
    "aria-label"?: string;
}

export function NumberWithUnitInput({
    value,
    unit,
    units,
    onValueChange,
    onUnitChange,
    disabled = false,
    placeholder = "0",
    min = 0,
    max,
    menuWidth = 160,
    "aria-label": ariaLabel,
}: NumberWithUnitInputProps) {
    const [open, setOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({ position: "fixed", visibility: "hidden" });
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef    = useRef<HTMLDivElement>(null);

    // Close on outside click — but not when the click lands inside the
    // floating menu (the menu lives in a fixed-position layer outside the
    // wrapper subtree).
    useEffect(() => {
        if (!open) return;
        function handle(e: MouseEvent) {
            const target = e.target as Node | null;
            if (!target) return;
            if (wrapperRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setOpen(false);
        }
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, [open]);

    // Position the menu — anchor to the trigger's right edge so the
    // dropdown reads as the unit picker. Flip above when room below is tight.
    useLayoutEffect(() => {
        if (!open || !triggerRef.current) return;
        const r = triggerRef.current.getBoundingClientRect();
        const menuH = Math.min(264, units.length * 38 + 8);
        const spaceBelow = window.innerHeight - r.bottom;
        const flipUp = spaceBelow < menuH + 8 && r.top > menuH + 8;
        setMenuStyle({
            position: "fixed",
            left: r.right - menuWidth,
            width: menuWidth,
            zIndex: 9999,
            ...(flipUp ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
        });
    }, [open, units.length, menuWidth]);

    // Close on any scroll that originates outside the menu — keeps the
    // anchor honest if the form card itself scrolls.
    useEffect(() => {
        if (!open) return;
        function onScroll(e: Event) {
            const target = e.target as Node | null;
            if (menuRef.current && target && menuRef.current.contains(target)) return;
            setOpen(false);
        }
        window.addEventListener("scroll", onScroll, true);
        return () => window.removeEventListener("scroll", onScroll, true);
    }, [open]);

    function handleNumberChange(raw: string) {
        const cleaned = raw.replace(/^0+(?=\d)/, "");
        if (cleaned === "") { onValueChange(0); return; }
        const num = Number(cleaned);
        if (Number.isNaN(num)) return;
        if (num < min) return;
        if (max !== undefined && num > max) return;
        onValueChange(num);
    }

    const selected = units.find(u => u.value === unit);
    const selectedLabel = selected?.label ?? unit;

    return (
        <div
            ref={wrapperRef}
            className={cn(
                "flex items-stretch border-1 rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-all",
                disabled
                    ? "bg-[#f9fafb] border-[#d0d5dd]"
                    : "bg-white border-[#d0d5dd] focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c]",
            )}
        >
            <input
                type="number"
                value={value === 0 ? "" : String(value)}
                placeholder={placeholder}
                onChange={e => handleNumberChange(e.target.value)}
                onKeyDown={e => {
                    if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") e.preventDefault();
                }}
                disabled={disabled}
                min={min}
                max={max}
                aria-label={ariaLabel ?? "Number"}
                className={cn(
                    "flex-1 min-w-0 h-10 px-[14px] text-[16px] bg-transparent rounded-l-[8px]",
                    "focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                    disabled ? "text-[#667085] cursor-not-allowed" : "text-[#101828] placeholder:text-[#667085]",
                )}
            />
            <button
                ref={triggerRef}
                type="button"
                onClick={() => !disabled && setOpen(p => !p)}
                disabled={disabled}
                aria-label="Select unit"
                className={cn(
                    "shrink-0 flex items-center gap-1 px-3 h-10 rounded-r-[8px]",
                    "focus:outline-none",
                    disabled && "cursor-not-allowed",
                )}
            >
                <span className={cn("text-[16px]", disabled ? "text-[#667085]" : "text-[#344054]")}>
                    {selectedLabel}
                </span>
                <span className="w-5 h-5 flex items-center justify-center text-[#667085]">
                    {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </span>
            </button>

            {open && (
                <div
                    ref={menuRef}
                    style={menuStyle}
                    className="bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] p-[4px] max-h-[264px] overflow-y-auto scrollbar-hide"
                >
                    {units.map(u => {
                        const isSelected = u.value === unit;
                        return (
                            <button
                                key={u.value}
                                type="button"
                                onClick={() => { onUnitChange(u.value); setOpen(false); }}
                                className={cn(
                                    "flex items-center w-full text-left px-[10px] py-[9px] rounded-[6px] text-[14px] font-medium transition-colors",
                                    isSelected ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                                )}
                            >
                                {u.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
