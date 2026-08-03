"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · In-chat spot-layout editor (Figma frames 9–11 / 394-171364)
// ─────────────────────────────────────────────────────────────────────────────
//
// Compact, in-bubble version of the admin `/schedule/new/customize-spot` page —
// same spot-generation + block/unblock logic, resized for the chat column and
// stripped of the page chrome (router, breadcrumbs, fixed bars).
//
// Two modes:
//   • Default — Column / Row steppers + "Use default" (confirm as-is) and
//     "Customize spot" (reveal the grid).
//   • Customize — the grid; click a spot to toggle blocked, then Confirm.
//
// On confirm it calls `onConfirm(cols, rows, blockedSpots)`. The parent
// (ClassCard) turns that into the machine-readable message the model parses.
// Once confirmed the editor locks (mirrors an answered ask_questions panel).

import { useMemo, useState } from "react";
import { Settings03, ChevronUp, ChevronDown, CheckCircle } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** 0→A, 1→B … */
function rowLabel(i: number): string {
    return String.fromCharCode(65 + i);
}

/** Best-fit default columns for a capacity (prefer wider rows, ≤ 8 rows). */
function defaultColsFor(capacity: number): number {
    for (const c of [4, 3, 5, 2, 6]) {
        if (capacity % c === 0 && capacity / c <= 8) return c;
    }
    return Math.min(capacity, 4);
}

function Stepper({
    label,
    value,
    onChange,
    min,
    max,
    disabled,
}: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    disabled?: boolean;
}) {
    return (
        <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[13px] font-medium text-[#344054]">{label}</label>
            <div
                className={cn(
                    "flex items-center border border-[#d0d5dd] rounded-[8px] overflow-hidden",
                    disabled ? "bg-[#f9fafb]" : "bg-white",
                )}
            >
                <input
                    type="number"
                    value={value === 0 ? "" : value}
                    placeholder="0"
                    min={min}
                    max={max}
                    disabled={disabled}
                    onChange={(e) => {
                        const v = Number(e.target.value.replace(/^0+(?=\d)/, ""));
                        if (v >= min && v <= max) onChange(v);
                    }}
                    className={cn(
                        "flex-1 min-w-0 px-3 py-2 text-[14px] border-0 focus:outline-none",
                        disabled ? "bg-[#f9fafb] text-[#667085]" : "text-[#101828]",
                    )}
                />
                <div className="flex flex-col border-l border-[#e4e7ec]">
                    <button
                        type="button"
                        disabled={disabled || value >= max}
                        onClick={() => value < max && onChange(value + 1)}
                        className="flex items-center justify-center h-[17px] w-7 hover:bg-[#f9fafb] disabled:opacity-40"
                    >
                        <ChevronUp className="w-3 h-3 text-[#667085]" />
                    </button>
                    <button
                        type="button"
                        disabled={disabled || value <= min}
                        onClick={() => value > min && onChange(value - 1)}
                        className="flex items-center justify-center h-[17px] w-7 border-t border-[#e4e7ec] hover:bg-[#f9fafb] disabled:opacity-40"
                    >
                        <ChevronDown className="w-3 h-3 text-[#667085]" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export interface SpotLayoutEditorProps {
    capacity: number;
    onConfirm: (cols: number, rows: number, blockedSpots: string[]) => void;
    /** Locks the editor + shows a summary once the parent has recorded it. */
    confirmed?: { cols: number; rows: number; blocked: string[] } | null;
}

export function SpotLayoutEditor({ capacity, onConfirm, confirmed }: SpotLayoutEditorProps) {
    const cap = Math.max(1, capacity);
    const initCols = defaultColsFor(cap);
    const initRows = Math.ceil(cap / initCols);

    const [cols, setCols] = useState(initCols);
    const [rows, setRows] = useState(initRows);
    const [blocked, setBlocked] = useState<Set<string>>(new Set());

    // Spots grid — min(cols×rows, capacity) cells, row-major, labelled A1, A2…
    const spots = useMemo(() => {
        const out: string[][] = [];
        const total = Math.min(cols * rows, cap);
        let n = 0;
        for (let r = 0; r < rows && n < total; r++) {
            const row: string[] = [];
            for (let c = 0; c < cols && n < total; c++) {
                row.push(`${rowLabel(r)}${c + 1}`);
                n++;
            }
            if (row.length) out.push(row);
        }
        return out;
    }, [cols, rows, cap]);

    const exceeds = cols * rows > cap;

    if (confirmed) {
        const desc = `${confirmed.cols} × ${confirmed.rows} layout${
            confirmed.blocked.length ? ` · ${confirmed.blocked.length} blocked` : ""
        }`;
        return (
            <div className="w-full flex items-center gap-2.5 rounded-[12px] border border-[#aad4bd] bg-[#f1f7f4] px-4 py-3">
                <CheckCircle className="size-4 text-[#3f8f68] shrink-0" />
                <p className="text-[14px] text-[#101828] leading-5">
                    Spot layout set — <span className="font-medium">{desc}</span>
                </p>
            </div>
        );
    }

    const toggle = (id: string) =>
        setBlocked((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    // Prune blocks outside the current grid before confirming.
    const liveBlocked = () => {
        const valid = new Set(spots.flat());
        return Array.from(blocked).filter((id) => valid.has(id));
    };

    return (
        <div className="w-full bg-white border border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-8">
            {/* ── Section 1 · Customize area (grid always visible, Figma 380-122725) ── */}
            <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                        <p className="text-[16px] font-semibold text-[#101828] leading-6">Customize area</p>
                        <p className="text-[14px] text-[#344054] leading-5">Select spot to block or unblock.</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 pt-0.5">
                        <span className="flex items-center gap-2 text-[14px] text-[#667085] whitespace-nowrap">
                            <span className="size-2 rounded-full bg-[#17b26a]" /> Available spot
                        </span>
                        <span className="flex items-center gap-2 text-[14px] text-[#475467] whitespace-nowrap">
                            <span className="size-2 rounded-full bg-[#f04438]" /> Blocked spot
                        </span>
                    </div>
                </div>

                <div className="bg-[#f8f8f6] rounded-[16px] px-4 py-6 flex flex-col items-center gap-6 overflow-x-auto">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-[137px] h-12 rounded-[10px] bg-[#717bbc]" />
                        <span className="text-[16px] font-semibold text-[#475467]">Instructor</span>
                    </div>
                    {/* w-max so a wide grid (many columns) scrolls horizontally
                        inside the card at narrow widths instead of overflowing. */}
                    <div className="flex flex-col gap-8 w-max mx-auto">
                        {spots.map((row, ri) => (
                            <div key={ri} className="flex gap-x-10 justify-center">
                                {row.map((id) => {
                                    const isB = blocked.has(id);
                                    return (
                                        <button
                                            key={id}
                                            type="button"
                                            onClick={() => toggle(id)}
                                            className="flex flex-col items-center gap-2 group"
                                        >
                                            <span
                                                className={cn(
                                                    "size-12 rounded-full border-2 transition-all",
                                                    isB
                                                        ? "bg-[#fecdca] border-[#f04438]"
                                                        : "bg-[#c4edd6] border-transparent group-hover:scale-105",
                                                )}
                                            />
                                            <span className="text-[16px] font-semibold text-[#475467]">{id}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Section 2 · Spot layout controls ── */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <p className="text-[18px] font-semibold text-[#101828] leading-7">Spot layout</p>
                    <p className="text-[14px] text-[#6e776f] leading-5">
                        Define the number of rows and columns to generate the room&rsquo;s spot layout.
                    </p>
                </div>

                <div className="flex gap-4">
                    <Stepper label="Column number" value={cols} onChange={setCols} min={1} max={cap} />
                    <Stepper label="Row number" value={rows} onChange={setRows} min={1} max={cap} />
                </div>

                {exceeds && (
                    <p className="text-[12px] text-[#b42318]">
                        {cols} × {rows} exceeds the {cap}-spot capacity — only {cap} will be shown.
                    </p>
                )}

                <div className="flex items-center justify-end gap-3">
                    <Button
                        variant="secondary-gray"
                        size="sm"
                        onClick={() => {
                            setBlocked(new Set());
                            onConfirm(initCols, initRows, []);
                        }}
                    >
                        Use default
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Settings03 className="w-4 h-4" />}
                        onClick={() => onConfirm(cols, rows, liveBlocked())}
                    >
                        Customize spot
                    </Button>
                </div>
            </div>
        </div>
    );
}
