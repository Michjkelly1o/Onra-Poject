"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared StarRating cell
// ─────────────────────────────────────────────────────────────────────────────
//
// The 5-star + caption rating cell used in every table that shows class /
// session ratings — the Schedule List view, the Customer booking history, etc.
// ALWAYS renders 5 stars (filled up to `rating`, empty placeholders otherwise)
// plus a caption, so the "no ratings yet" state reads as five hollow stars +
// "0 (0 ratings)" instead of a bare text label. Lifted verbatim from the
// schedule List view so both surfaces render identically (client 2026-08-14).

function FilledStar({ filled }: { filled: boolean }) {
    return (
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.167l1.575 3.19 3.52.513-2.547 2.483.601 3.505L7 9.107l-3.149 1.751.601-3.505L1.905 4.87l3.52-.513L7 1.167z"
                fill={filled ? "#f79009" : "none"} stroke={filled ? "#f79009" : "#d0d5dd"} strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
    );
}

export function StarRating({ rating, count }: { rating: number; count: number }) {
    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(i => <FilledStar key={i} filled={i <= Math.round(rating)} />)}
            </div>
            <span className="text-[12px] text-[var(--colors-text-quaternary)]">{count > 0 ? `${rating.toFixed(1)} (${count} ratings)` : "0 (0 ratings)"}</span>
        </div>
    );
}
