"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared Divider
// ─────────────────────────────────────────────────────────────────────────────
//
// Centralised 1px horizontal divider used across cards, modals, side panels,
// and detail-page sections. The base styling is:
//
//   <div className="h-px w-full bg-[#e4e7ec]" />
//
// 64+ inline copies exist in the codebase. Most callers are byte-identical;
// the rest only add layout-positioning classes (e.g. `shrink-0` inside a
// flex container, `mb-5` for trailing space). Pass those via `className`.
//
// Per-instance value is small (one line each), so migrations happen
// opportunistically — call sites can adopt this as they're touched for
// other reasons.

import { cn } from "@/lib/utils";

export interface DividerProps {
    /** Extra Tailwind classes to compose with the base. Use for
     *  `shrink-0` inside a flex parent, `mb-5` for trailing space, etc. */
    className?: string;
}

export function Divider({ className }: DividerProps) {
    return <div className={cn("h-px w-full bg-[#e4e7ec]", className)} aria-hidden="true" />;
}
