"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Export dropdown (CSV / PDF / Excel)
// ─────────────────────────────────────────────────────────────────────────────
//
// Reused as both the toolbar's "Export" and "Export invoice" trigger.
// Phase 1 wires CSV only — PDF + Excel fire a "coming soon" toast so the
// menu is visibly real without producing broken downloads.
//
// The trigger uses the shared <Button> component so it reads identically
// to every "Add new" / "Save changes" surface in the app (per the design
// revision — DS Primary for the green Export, DS Secondary gray for the
// white Export-invoice variant).

import { useEffect, useRef, useState } from "react";
import { Download01, File02, ChevronDown } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";

const FORMATS = ["CSV", "PDF", "Excel"] as const;
type ExportFormat = (typeof FORMATS)[number];

export interface ExportDropdownProps {
    /** Visible label on the trigger. Defaults to "Export". The Total
     *  sales report uses "Export invoice" for its second dropdown. */
    label?: string;
    /** "export"  → primary (sage-green DS button)
     *  "invoice" → secondary-gray (white DS button) */
    variant?: "export" | "invoice";
    /** True when the export target has zero rows. */
    disabled?: boolean;
    /** Phase-1-only: real CSV writer for the host report. */
    onExportCsv: () => void;
}

export function ExportDropdown({
    label = "Export", variant = "export", disabled, onExportCsv,
}: ExportDropdownProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const showToast = useAppStore(s => s.showToast);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    function handlePick(fmt: ExportFormat) {
        setOpen(false);
        if (disabled) return;
        if (fmt === "CSV") {
            onExportCsv();
            return;
        }
        showToast(`${fmt} export coming soon`, "Only CSV is available in this prototype.", "success");
    }

    const Icon = variant === "invoice" ? File02 : Download01;
    const btnVariant = variant === "export" ? "primary" : "secondary-gray";

    return (
        <div ref={ref} className="relative">
            <Button
                variant={btnVariant}
                size="md"
                disabled={disabled}
                onClick={() => setOpen(p => !p)}
                leftIcon={<Icon className="w-4 h-4" />}
                rightIcon={<ChevronDown className="w-4 h-4" />}
            >
                {label}
            </Button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[160px]">
                    {FORMATS.map(fmt => (
                        <button key={fmt} type="button"
                            onClick={() => handlePick(fmt)}
                            className="w-full text-left px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                            {fmt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
