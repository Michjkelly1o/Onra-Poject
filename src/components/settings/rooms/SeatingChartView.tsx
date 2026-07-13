"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared seating-chart view (Figma 4148:231473 + 5940:222152)
// ─────────────────────────────────────────────────────────────────────────────
//
// Same primitive used by the Room creation form's right-side preview and
// the Room detail modal — instructor bar at top + grid of mint dots
// labelled A1, A2, …, B1, … Wrapped in `overflow-auto` so large layouts
// scroll inside their container instead of bursting the parent card.

export function SeatingChartView({ rows, columns }: { rows: number; columns: number }) {
    function rowLabel(index: number): string {
        let n = index, label = "";
        do {
            label = String.fromCharCode(65 + (n % 26)) + label;
            n = Math.floor(n / 26) - 1;
        } while (n >= 0);
        return label;
    }
    return (
        <div className="bg-[#f8f9f6] rounded-[12px] p-6 max-h-[520px] h-full overflow-auto">
            <div className="flex flex-col items-center gap-3 w-max mx-auto">
                {/* Instructor bar */}
                <div className="flex flex-col items-center gap-1.5">
                    <div className="h-4 w-20 rounded-[6px] bg-[#717bbc]" />
                    <span className="text-[10px] font-semibold text-[#475467]">Instructor</span>
                </div>
                <div className="flex flex-col gap-3 mt-2">
                    {Array.from({ length: rows }).map((_, ri) => (
                        <div key={ri} className="flex gap-4 items-center">
                            {Array.from({ length: columns }).map((_, ci) => (
                                <div key={ci} className="flex flex-col items-center gap-1">
                                    <div className="w-7 h-7 rounded-full bg-[var(--brand-tertiary)] shrink-0" />
                                    <span className="text-[9px] font-semibold text-[#475467]">
                                        {rowLabel(ri)}{ci + 1}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
