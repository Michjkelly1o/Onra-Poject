"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared ToolbarExport dropdown
// ─────────────────────────────────────────────────────────────────────────────
//
// Icon-only Button with a `Download01` glyph + hover tooltip + a CSV /
// PDF / Excel format-picker dropdown. Client 2026-07-21 asked us to
// centralize the Export button so every list page reads with the same
// chrome (icon-only, hover tooltip, right-anchored menu).
//
// API mirrors the ad-hoc `ExportDropdown` copies that used to live in
// each admin list page. Only CSV is wired today; PDF / Excel exist as
// placeholders in the menu so a future flip is a one-liner.

import { useEffect, useRef, useState } from "react";
import { Download01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "./IconTooltip";

const EXPORT_FORMATS = ["CSV", "PDF", "Excel"] as const;

export interface ToolbarExportProps {
    /** Fires when the admin picks CSV. PDF / Excel are placeholders. */
    onExportCsv: () => void;
    disabled?: boolean;
    /** Tooltip label on hover. Defaults to "Export". */
    label?: string;
}

export function ToolbarExport({ onExportCsv, disabled = false, label = "Export" }: ToolbarExportProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    return (
        <div ref={ref} className="relative">
            {/* Menu open → suppress the tooltip so it doesn't overlap the
                dropdown. Reopens naturally when the menu closes. */}
            <IconTooltip label={label} disabled={open}>
                <Button
                    variant="secondary-gray"
                    size="icon"
                    disabled={disabled}
                    aria-label={label}
                    onClick={() => setOpen(p => !p)}
                >
                    <Download01 className="w-4 h-4" />
                </Button>
            </IconTooltip>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[160px]">
                    {EXPORT_FORMATS.map(fmt => (
                        <button
                            key={fmt}
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                if (fmt === "CSV") onExportCsv();
                            }}
                            className="w-full text-left px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors"
                        >
                            {fmt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
