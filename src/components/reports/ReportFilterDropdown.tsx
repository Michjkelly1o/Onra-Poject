"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Generic single-select filter dropdown for the reports toolbar
// ─────────────────────────────────────────────────────────────────────────────
//
// Shared by every per-report "Select location" and (Payments) "Status"
// trigger. Same chrome as the Select-column pill but renders a single-
// select option list. Empty `value` = "All …" — the placeholder label
// reads from `placeholder`.

import { useEffect, useRef, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { ChevronDown, Check } from "@untitledui/icons";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export interface ReportFilterOption {
    value: string;
    label: string;
}

export interface ReportFilterDropdownProps {
    icon: IconComponent;
    placeholder: string;
    value: string;
    options: ReportFilterOption[];
    onChange: (next: string) => void;
}

export function ReportFilterDropdown({
    icon: Icon, placeholder, value, options, onChange,
}: ReportFilterDropdownProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const selected = options.find(o => o.value === value);
    const label = selected?.label ?? placeholder;

    return (
        <div ref={ref} className="relative">
            <button type="button"
                onClick={() => setOpen(p => !p)}
                className={cn(
                    "h-[40px] bg-white border-1 border-[#d0d5dd] rounded-[8px] px-3.5 flex items-center gap-2 text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                )}>
                <Icon className="w-4 h-4 text-[#667085]" />
                <span>{label}</span>
                <ChevronDown className={cn(
                    "w-4 h-4 text-[#667085] transition-transform",
                    open && "rotate-180",
                )} />
            </button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[200px]">
                    {options.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-[#f9fafb] transition-colors text-left">
                            <span className="text-[14px] font-medium text-[#344054] leading-[20px]">
                                {opt.label}
                            </span>
                            {opt.value === value && (
                                <Check className="w-4 h-4 text-[#658774]" strokeWidth={2.5} />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
