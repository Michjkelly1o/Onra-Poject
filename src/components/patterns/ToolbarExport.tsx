"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared ToolbarExport dropdown
// ─────────────────────────────────────────────────────────────────────────────
//
// Icon-only Button with a `Download01` glyph + hover tooltip + a CSV / Excel /
// PDF format-picker dropdown. Centralized so every admin list reads with the
// same chrome (icon-only, hover tooltip, right-anchored menu).
//
// Two ways to drive it:
//   • `exportData` (preferred, Phase 0) — a column spec → REAL CSV **and** Excel
//     from `exportRows`. Both formats come from one spec so they can't drift.
//   • `onExportCsv` (legacy) — a module that builds+downloads its own CSV. Only
//     CSV is enabled in that mode until the module migrates to `exportData`.
// PDF stays disabled (see dev-handoff/pdf-export.md) — a menu item is shown but
// greyed with a "soon" tag rather than silently doing nothing.

import { useEffect, useRef, useState } from "react";
import { Download01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "./IconTooltip";
import { exportRows, type ExportData } from "@/lib/export/export-data";

const EXPORT_FORMATS = ["CSV", "Excel", "PDF"] as const;
type ExportFmt = (typeof EXPORT_FORMATS)[number];

export interface ToolbarExportProps {
    /** LEGACY (CSV-only) — a module that builds + downloads its own CSV. When
     *  provided without `exportData`, only CSV is enabled. */
    onExportCsv?: () => void;
    /** PREFERRED — column-spec data → real CSV AND Excel. Computed lazily on the
     *  click so it reflects the current rows. Takes precedence over onExportCsv. */
    exportData?: () => ExportData<unknown> | null;
    /** CUSTOM per-format handler — for exports that don't fit the column-spec
     *  model (e.g. the dashboard's jagged multi-section snapshot). When provided,
     *  CSV + Excel are both live and call `onExport(format)`; the caller builds +
     *  downloads the file itself. `onExported` still fires afterwards. */
    onExport?: (format: "csv" | "xlsx") => void | Promise<void>;
    /** Fired after a successful `exportData` / `onExport` export (CSV or Excel) —
     *  use it to show the success toast. Not called on the legacy `onExportCsv`
     *  path (those modules fire their own toast). */
    onExported?: (format: "csv" | "xlsx") => void;
    disabled?: boolean;
    /** Tooltip label on hover. Defaults to "Export". */
    label?: string;
    /** Visual size — matches ToolbarSearch's size prop. Defaults to "md". */
    size?: "md" | "sm";
}

export function ToolbarExport({ onExportCsv, exportData, onExport, onExported, disabled = false, label = "Export", size = "md" }: ToolbarExportProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const canCsv = !!exportData || !!onExport || !!onExportCsv;
    const canExcel = !!exportData || !!onExport;
    const isEnabled = (fmt: ExportFmt): boolean =>
        fmt === "CSV" ? canCsv : fmt === "Excel" ? canExcel : false; // PDF not wired yet

    async function pick(fmt: ExportFmt) {
        setOpen(false);
        try {
            if (fmt === "CSV") {
                if (exportData) {
                    const d = exportData();
                    if (d) { await exportRows(d, "csv"); onExported?.("csv"); }
                } else if (onExport) {
                    await onExport("csv"); onExported?.("csv");
                } else {
                    onExportCsv?.();
                }
            } else if (fmt === "Excel") {
                if (exportData) {
                    const d = exportData();
                    if (d) { await exportRows(d, "xlsx"); onExported?.("xlsx"); }
                } else if (onExport) {
                    await onExport("xlsx"); onExported?.("xlsx");
                }
            }
        } catch (err) {
            // Surface the failure to the console instead of an unhandled promise
            // rejection (e.g. if the lazy xlsx import fails). onExported (the
            // success toast) only fires after a resolved export, never here.
            console.error("[ToolbarExport] export failed", err);
        }
    }

    return (
        <div ref={ref} className="relative">
            {/* Menu open → suppress the tooltip so it doesn't overlap the
                dropdown. Reopens naturally when the menu closes. */}
            <IconTooltip label={label} disabled={open}>
                <Button
                    variant="secondary-gray"
                    size={size === "md" ? "icon" : "icon-sm"}
                    disabled={disabled}
                    aria-label={label}
                    onClick={() => setOpen(p => !p)}
                >
                    <Download01 className="w-4 h-4" />
                </Button>
            </IconTooltip>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[160px]">
                    {EXPORT_FORMATS.map(fmt => {
                        const on = isEnabled(fmt);
                        return (
                            <button
                                key={fmt}
                                type="button"
                                disabled={!on}
                                onClick={() => { if (on) void pick(fmt); }}
                                className={cn(
                                    "w-full text-left px-4 py-[10px] text-[14px] font-medium transition-colors flex items-center justify-between",
                                    on
                                        ? "text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]"
                                        : "text-[var(--colors-text-quaternary)] cursor-not-allowed",
                                )}
                            >
                                <span>{fmt}</span>
                                {!on && <span className="text-[12px] text-[var(--colors-text-quaternary)]">soon</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
