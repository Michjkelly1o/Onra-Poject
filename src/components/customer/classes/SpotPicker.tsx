"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — SpotPicker — class booking spot grid (Figma 3675-58648 / 2-seat)
// ─────────────────────────────────────────────────────────────────────────────
//
// Grid from the admin's `spotLayout` ({ cols, rows, blockedSpots }). Spot ids =
// row letter + column number (A1 … C4). Admin-blocked / already-booked spots show
// "Booked" (grey, disabled). One spot PER SEAT (you + a brought-along guest),
// chosen INDIVIDUALLY: the active seat (its legend pill highlighted) receives the
// next tapped spot; tapping the active seat's own spot clears it; tapping a spot
// held by your OTHER seat makes that seat active. `selected` is positional
// (index 0 = you, 1 = guest).

import { useState } from "react";
import { Minus, Plus, User01 } from "@untitledui/icons";

/** Admin scheme: row 0 → "A", column 0 → "1" → "A1". */
export function spotId(row: number, col: number): string {
    return `${String.fromCharCode(65 + row)}${col + 1}`;
}

export interface SpotSeat {
    initials: string;
    label: string;
}

export interface SpotPickerProps {
    cols: number;
    rows: number;
    /** Spot ids that cannot be picked (admin-blocked ∪ already booked). */
    unavailable: string[];
    /** Assigned spots, index-aligned to `seats` (index 0 = you). */
    selected: (string | undefined)[];
    /** One entry per seat to place (You, Guest). */
    seats: SpotSeat[];
    /** New positional selection after a tap. */
    onChange: (next: (string | undefined)[]) => void;
}

export function SpotPicker({ cols, rows, unavailable, selected, seats, onChange }: SpotPickerProps) {
    const [zoom, setZoom] = useState(1);
    const [activeSeat, setActiveSeat] = useState(0);
    const taken = new Set(unavailable);

    function pick(sid: string) {
        // Belongs to my OTHER seat → switch to editing that seat instead.
        const owner = selected.findIndex((x) => x === sid);
        if (owner !== -1 && owner !== activeSeat) {
            setActiveSeat(owner);
            return;
        }
        const next = seats.map((_, i) => selected[i]);
        if (next[activeSeat] === sid) {
            next[activeSeat] = undefined; // tap own spot → clear
        } else {
            next[activeSeat] = sid;
            const nextEmpty = seats.findIndex((_, i) => !next[i]);
            if (nextEmpty !== -1) setActiveSeat(nextEmpty);
        }
        onChange(next);
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex min-h-[380px] flex-col gap-3 rounded-2xl bg-[#f2f4f7] p-3">
                {/* Legend — states */}
                <div className="flex items-center justify-between rounded-[10px] bg-white px-3 py-2">
                    <span className="flex items-center gap-1 text-xs font-normal leading-[18px] text-[#475467]">
                        <span className="size-2 shrink-0 rounded-full bg-[#d0d5dd]" />
                        Booked
                    </span>
                    <span className="flex items-center gap-1 text-xs font-normal leading-[18px] text-[#475467]">
                        <span className="size-2 shrink-0 rounded-full border border-[#e4e7ec] bg-[#f9fafb]" />
                        Available
                    </span>
                    <span className="flex items-center gap-1 text-xs font-normal leading-[18px] text-[#475467]">
                        <span className="size-2 shrink-0 rounded-full border border-[var(--brand-primary)] bg-[var(--brand-tertiary)]" />
                        Selected
                    </span>
                </div>

                {/* Front marker + grid (centered) */}
                <div className="flex flex-1 items-center justify-center overflow-hidden">
                    <div
                        className="flex flex-col items-center gap-6"
                        style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
                    >
                        <span className="flex size-10 items-center justify-center rounded-full border-2 border-white bg-[#f2f4f7] shadow-[0px_2px_4px_-2px_rgba(16,24,40,0.1),0px_1px_2px_-2px_rgba(16,24,40,0.06)]">
                            <User01 className="size-5 text-[#667085]" aria-hidden />
                        </span>
                        <div className="flex flex-col gap-5">
                            {Array.from({ length: rows }).map((_, r) => (
                                <div key={r} className="flex items-center justify-center gap-6">
                                    {Array.from({ length: cols }).map((_, c) => {
                                        const id = spotId(r, c);
                                        const isTaken = taken.has(id);
                                        const seatIdx = selected.indexOf(id);
                                        const isSel = seatIdx !== -1;
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                disabled={isTaken}
                                                onClick={() => pick(id)}
                                                aria-pressed={isSel}
                                                className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium leading-5 transition-colors ${
                                                    isTaken
                                                        ? "cursor-not-allowed bg-[#d0d5dd] text-white"
                                                        : isSel
                                                          ? "border-[1.5px] border-[var(--brand-primary)] bg-[var(--brand-tertiary)] text-[var(--brand-primary)]"
                                                          : "border border-[#e4e7ec] bg-[#f9fafb] text-[#344054] active:bg-[#f2f4f7]"
                                                }`}
                                            >
                                                {isSel ? seats[seatIdx]?.initials ?? id : id}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Zoom */}
                <div className="flex items-center self-end rounded-lg border border-[#e4e7ec] bg-white">
                    <button
                        type="button"
                        onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.15).toFixed(2)))}
                        aria-label="Zoom out"
                        className="flex size-9 items-center justify-center text-[#344054] transition-colors active:bg-gray-50"
                    >
                        <Minus className="size-[18px]" aria-hidden />
                    </button>
                    <span className="h-5 w-px shrink-0 bg-[#e4e7ec]" />
                    <button
                        type="button"
                        onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.15).toFixed(2)))}
                        aria-label="Zoom in"
                        className="flex size-9 items-center justify-center text-[#344054] transition-colors active:bg-gray-50"
                    >
                        <Plus className="size-[18px]" aria-hidden />
                    </button>
                </div>
            </div>

            {/* Seat chips — tap to choose whose spot you're picking (multi-seat only). */}
            {seats.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                    {seats.map((seat, i) => {
                        const active = activeSeat === i;
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setActiveSeat(i)}
                                className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 transition-colors ${
                                    active
                                        ? "border-2 border-[var(--brand-primary)] bg-[var(--brand-tertiary)]"
                                        : selected[i]
                                          ? "border border-[var(--brand-primary)] bg-white"
                                          : "border border-[#e4e7ec] bg-white"
                                }`}
                            >
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f2f4f7] text-[10px] font-semibold text-[#667085]">
                                    {seat.initials}
                                </span>
                                <span className="text-sm font-medium leading-5 text-[var(--brand-text)]">{seat.label}</span>
                                <span className="text-sm font-semibold leading-5 text-[var(--brand-primary)]">
                                    {selected[i] ?? "Pick"}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
