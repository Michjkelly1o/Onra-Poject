"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Settings03, ChevronUp, ChevronDown, AlertCircle } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Row label helper: 0→A, 1→B, ... ─────────────────────────────────────────

function rowLabel(i: number): string {
    return String.fromCharCode(65 + i);
}

// ─── Spot circle ──────────────────────────────────────────────────────────────

interface SpotProps {
    id: string;       // e.g. "A1"
    blocked: boolean;
    active: boolean;  // selected (clicked) state
    customized: boolean; // layout has been enabled
    onClick: () => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    tooltip: boolean;
}

function SpotCircle({ id, blocked, active, customized, onClick, onMouseEnter, onMouseLeave, tooltip }: SpotProps) {
    return (
        <div className="flex flex-col items-center gap-2 relative group">
            {/* Tooltip on hover */}
            {tooltip && customized && !active && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap bg-[#101828] text-white text-[12px] font-medium px-3 py-1.5 rounded-[6px] shadow-lg pointer-events-none">
                    {blocked ? "Select spot to unblock" : "Select spot to block"}
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-[#101828]" />
                </div>
            )}
            {/* Circle */}
            <button type="button"
                disabled={!customized}
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                className={cn(
                    "w-16 h-16 rounded-full transition-all",
                    !customized && "cursor-default",
                    blocked
                        ? "bg-[#fecdca] border-2 border-[#f04438]"
                        : active
                            ? "bg-[#c4edd6] border-2 border-[#658774] scale-105"
                            : customized
                                ? "bg-[#c4edd6] hover:brightness-95 hover:scale-105 cursor-pointer border-2 border-transparent"
                                : "bg-[#c4edd6] border-2 border-transparent"
                )}
            />
            {/* Label */}
            <span className="text-[16px] font-semibold text-[#475467]">{id}</span>
        </div>
    );
}

// ─── Number stepper ───────────────────────────────────────────────────────────

function NumberStepper({ label, value, onChange, min = 1, max = 12, disabled = false }: {
    label: string; value: number; onChange: (v: number) => void;
    min?: number; max?: number; disabled?: boolean;
}) {
    return (
        <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            <div className={cn("flex items-center border border-[#d0d5dd] rounded-[8px] overflow-hidden",
                disabled ? "bg-[#f9fafb]" : "bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]")}>
                <input type="number" value={value} min={min} max={max} disabled={disabled}
                    onChange={e => { const v = Number(e.target.value); if (v >= min && v <= max) onChange(v); }}
                    className={cn("flex-1 px-[14px] py-[10px] text-[16px] border-0 focus:outline-none",
                        disabled ? "bg-[#f9fafb] text-[#667085] cursor-not-allowed" : "text-[#101828]")} />
                <div className="flex flex-col border-l border-[#e4e7ec]">
                    <button type="button" disabled={disabled || value >= max}
                        onClick={() => value < max && onChange(value + 1)}
                        className="flex items-center justify-center h-[20px] w-8 hover:bg-[#f9fafb] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronUp className="w-3 h-3 text-[#667085]" />
                    </button>
                    <button type="button" disabled={disabled || value <= min}
                        onClick={() => value > min && onChange(value - 1)}
                        className="flex items-center justify-center h-[20px] w-8 border-t border-[#e4e7ec] hover:bg-[#f9fafb] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronDown className="w-3 h-3 text-[#667085]" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Block confirmation floating bar ─────────────────────────────────────────

function BlockBar({ spotId, blocked, onBlock, onUnblock, onDismiss }: {
    spotId: string; blocked: boolean;
    onBlock: () => void; onUnblock: () => void; onDismiss: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-end justify-center pb-8">
            <div className="pointer-events-auto bg-white border border-[#e4e7ec] rounded-[12px] shadow-[0px_8px_16px_-4px_rgba(16,24,40,0.12)] px-5 py-3 flex items-center gap-4">
                <span className="text-[14px] font-medium text-[#344054]">
                    {blocked ? `Unblock spot ${spotId}?` : `Block spot ${spotId}?`}
                </span>
                <button type="button" onClick={onDismiss}
                    className="text-[14px] font-semibold text-[#667085] hover:text-[#344054] transition-colors">
                    Dismiss
                </button>
                {blocked ? (
                    <button type="button" onClick={onUnblock}
                        className="px-4 py-2 rounded-[8px] bg-[#658774] text-white text-[14px] font-semibold hover:bg-[#3b5446] transition-colors">
                        Unblock
                    </button>
                ) : (
                    <button type="button" onClick={onBlock}
                        className="px-4 py-2 rounded-[8px] bg-[#d92d20] text-white text-[14px] font-semibold hover:bg-[#b42318] transition-colors">
                        Block
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomizeSpotPage() {
    return (
        <Suspense fallback={null}>
            <CustomizeSpotInner />
        </Suspense>
    );
}

function CustomizeSpotInner() {
    const router     = useRouter();
    const params     = useSearchParams();
    // Room capacity from URL — total spots is fixed at this value
    const roomCapacity = Math.max(1, parseInt(params.get("capacity") ?? "8"));

    // Default layout: best-fit cols for the capacity (prefer wider)
    const defaultCols = (() => {
        for (const c of [4, 3, 5, 2, 6]) { if (roomCapacity % c === 0 && roomCapacity / c <= 8) return c; }
        return Math.min(roomCapacity, 4);
    })();
    const defaultRows = Math.ceil(roomCapacity / defaultCols);

    // Layout config
    const [cols,        setCols]        = useState(defaultCols);
    const [rows,        setRows]        = useState(defaultRows);
    const [pendingCols, setPendingCols] = useState(defaultCols);
    const [pendingRows, setPendingRows] = useState(defaultRows);

    // Interaction state
    const [customized, setCustomized] = useState(false);
    const [blocked,    setBlocked]    = useState<Set<string>>(new Set());
    const [hovered,    setHovered]    = useState<string | null>(null);
    const [selected,   setSelected]   = useState<string | null>(null);

    const layoutExceeds = pendingCols * pendingRows > roomCapacity;

    // Generate exactly min(cols×rows, roomCapacity) spots
    const totalVisible  = Math.min(cols * rows, roomCapacity);
    const spots: string[][] = [];
    let count = 0;
    for (let r = 0; r < rows && count < totalVisible; r++) {
        const row: string[] = [];
        for (let c = 0; c < cols && count < totalVisible; c++) {
            row.push(`${rowLabel(r)}${c + 1}`);
            count++;
        }
        if (row.length > 0) spots.push(row);
    }

    function handleSpotClick(id: string) {
        if (!customized) return;
        setSelected(prev => prev === id ? null : id);
    }

    function handleBlock() {
        if (!selected) return;
        setBlocked(prev => { const next = new Set(prev); next.add(selected); return next; });
        setSelected(null);
    }

    function handleUnblock() {
        if (!selected) return;
        setBlocked(prev => { const next = new Set(prev); next.delete(selected); return next; });
        setSelected(null);
    }

    function handleCustomize() {
        setCustomized(true);
    }

    function handleUpdate() {
        setCols(pendingCols);
        setRows(pendingRows);
        setBlocked(prev => {
            const next = new Set<string>();
            prev.forEach(id => {
                const rowChar = id[0];
                const colNum  = parseInt(id.slice(1));
                const rowIdx  = rowChar.charCodeAt(0) - 65;
                if (rowIdx < pendingRows && colNum <= pendingCols) next.add(id);
            });
            return next;
        });
        setSelected(null);
        router.back();
    }

    function handleCancel() {
        router.back();
    }

    const selectedSpot = selected ? { id: selected, isBlocked: blocked.has(selected) } : null;

    return (
        <div className="h-screen overflow-hidden flex flex-col bg-white">
            {/* Header */}
            <div className="shrink-0 h-[72px] flex items-center px-6">
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => router.back()}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <ChevronLeft className="w-5 h-5 text-[#667085]" />
                    </button>
                    <p className="text-[20px] font-semibold text-[#101828]">Customize spot</p>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 flex justify-center">
                <div className="w-full max-w-[812px] bg-white border border-[#e4e7ec] rounded-[20px] flex flex-col gap-6 p-6 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] h-fit">

                    {/* ── Customize area section ── */}
                    <div className="flex flex-col gap-4">
                        {/* Header row */}
                        <div className="flex items-end justify-between">
                            <div className="flex flex-col gap-1">
                                <p className="text-[18px] font-semibold text-[#101828]">Customize area</p>
                                <p className="text-[14px] text-[#6e776f]">Select spot to block or unblock.</p>
                            </div>
                            {/* Legend */}
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[#c4edd6]" />
                                    <span className="text-[14px] text-[#667085]">Available spot</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[#f04438]" />
                                    <span className="text-[14px] text-[#475467]">Blocked spot</span>
                                </div>
                            </div>
                        </div>

                        {/* Spot map */}
                        <div className="bg-[#f8f8f6] rounded-[16px] px-10 py-10 flex flex-col items-center gap-8 min-h-[280px]">
                            {/* Instructor placeholder */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-[140px] h-[48px] rounded-[10px] bg-[#717bbc]" />
                                <span className="text-[16px] font-semibold text-[#475467]">Instructor</span>
                            </div>

                            {/* Spots grid */}
                            <div className="flex flex-col gap-8">
                                {spots.map((row, rowIdx) => (
                                    <div key={rowIdx} className="flex gap-12 justify-center">
                                        {row.map(spotId => (
                                            <SpotCircle
                                                key={spotId}
                                                id={spotId}
                                                blocked={blocked.has(spotId)}
                                                active={selected === spotId}
                                                customized={customized}
                                                tooltip={hovered === spotId}
                                                onClick={() => handleSpotClick(spotId)}
                                                onMouseEnter={() => customized && setHovered(spotId)}
                                                onMouseLeave={() => setHovered(null)}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── Spot layout section ── */}
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <p className="text-[18px] font-semibold text-[#101828]">Spot layout</p>
                            <p className="text-[14px] text-[#6e776f]">
                                Define the number of rows and columns to arrange the {roomCapacity} spots in this room.
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <NumberStepper
                                label="Column number"
                                value={customized ? pendingCols : cols}
                                onChange={v => { setPendingCols(v); }}
                                min={1} max={roomCapacity}
                                disabled={!customized}
                            />
                            <NumberStepper
                                label="Row number"
                                value={customized ? pendingRows : rows}
                                onChange={v => { setPendingRows(v); }}
                                min={1} max={roomCapacity}
                                disabled={!customized}
                            />
                        </div>

                        {/* Layout validation */}
                        {customized && layoutExceeds && (
                            <div className="flex items-start gap-3 p-4 rounded-[12px] bg-[#fef3f2] border border-[#fecdca]">
                                <AlertCircle className="w-4 h-4 text-[#d92d20] shrink-0 mt-0.5" />
                                <p className="text-[14px] text-[#7a271a]">
                                    Layout exceeds room capacity ({roomCapacity} spots). Reduce columns or rows.
                                </p>
                            </div>
                        )}
                        {customized && !layoutExceeds && pendingCols * pendingRows < roomCapacity && (
                            <p className="text-[13px] text-[#667085]">
                                {pendingCols * pendingRows} of {roomCapacity} spots will be visible in this layout.
                            </p>
                        )}
                    </div>

                    {/* ── Footer ── */}
                    <div className="flex items-center justify-between pt-2">
                        <Button variant="secondary-gray" size="md" onClick={handleCancel}>Cancel</Button>
                        {customized ? (
                            <Button variant="primary" size="md" onClick={handleUpdate}>
                                Update spot
                            </Button>
                        ) : (
                            <Button variant="primary" size="md" leftIcon={<Settings03 className="w-4 h-4" />}
                                onClick={handleCustomize}>
                                Customize spot
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Block/Unblock floating bar */}
            {selectedSpot && (
                <BlockBar
                    spotId={selectedSpot.id}
                    blocked={selectedSpot.isBlocked}
                    onBlock={handleBlock}
                    onUnblock={handleUnblock}
                    onDismiss={() => setSelected(null)}
                />
            )}
        </div>
    );
}
