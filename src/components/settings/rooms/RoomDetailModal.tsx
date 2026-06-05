"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Business & Locations → Room detail modal
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 4148:231473 — small modal with room avatar + name + "X max" at
// the top, then a seating-chart visualization (instructor bar + grid of
// mint dots with A1, A2, … B1, B2, … labels).
//
// Used by:
//   • The Business & Locations landing — row actions menu → View details
//   • The Branch detail page — Rooms table row actions → View details

import { useEffect } from "react";
import { XClose, LayoutGrid01 } from "@untitledui/icons";
import type { Room } from "@/data/mock/_types";

// Reused from the Room creation form so the visualization looks identical.
import { SeatingChartView } from "@/components/settings/rooms/SeatingChartView";

export function RoomDetailModal({ room, onClose }: {
    room: Room;
    onClose: () => void;
}) {
    // Esc dismiss
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    // Read the persisted rows/columns the admin set in the Room form. Falls
    // back to a sqrt-derived square only for legacy seed rooms that don't
    // carry the explicit dimensions yet.
    const fallbackCols = Math.ceil(Math.sqrt(room.capacity));
    const fallbackRows = Math.ceil(room.capacity / fallbackCols);
    const cols = room.columns && room.columns > 0 ? room.columns : fallbackCols;
    const rows = room.rows    && room.rows    > 0 ? room.rows    : fallbackRows;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] w-[760px] max-w-[calc(100vw-32px)] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-[#e4e7ec]">
                    <div className="w-10 h-10 rounded-full bg-[#f2f4f7] border border-[rgba(0,0,0,0.08)] flex items-center justify-center shrink-0">
                        <LayoutGrid01 className="w-5 h-5 text-[#475467]" />
                    </div>
                    <div className="flex-1 flex flex-col">
                        <p className="text-[18px] font-semibold text-[#101828] leading-7">{room.name}</p>
                        <p className="text-[14px] text-[#667085] leading-5">{room.capacity} max</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors"
                    >
                        <XClose className="w-5 h-5 text-[#98a2b3]" />
                    </button>
                </div>

                {/* Body — seating chart */}
                <div className="p-6 bg-white">
                    <SeatingChartView rows={rows} columns={cols} />
                </div>
            </div>
        </div>
    );
}
