// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Sliders icon (custom)
// ─────────────────────────────────────────────────────────────────────────────
//
// Filter/toolbar glyph the client picked to replace `FilterLines` from
// @untitledui/icons (client 2026-07-22). Matches the untitledui pattern —
// `currentColor` fill/stroke + 2 px stroke width — so it sizes and colors
// the same way as every other icon in the app.
//
// Source: `/Sliders.svg` at the project root; the raw file has stroke-width
// 3 + black stroke, but we normalise to 2 + currentColor so a `text-...`
// class on the parent tints it and the weight matches sibling icons.

import type { SVGProps } from "react";

export function Sliders({ className, strokeWidth = 2, ...props }: SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden
            {...props}
        >
            <path d="M7 20C8.65685 20 10 18.6569 10 17C10 15.3431 8.65685 14 7 14C5.34315 14 4 15.3431 4 17C4 18.6569 5.34315 20 7 20Z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 14C17.6569 14 19 12.6569 19 11C19 9.34315 17.6569 8 16 8C14.3431 8 13 9.34315 13 11C13 12.6569 14.3431 14 16 14Z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M25 24C26.6569 24 28 22.6569 28 21C28 19.3431 26.6569 18 25 18C23.3431 18 22 19.3431 22 21C22 22.6569 23.3431 24 25 24Z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 5V14"  stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M25 5V18" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 5V8"  stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 20V27" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M25 24V27" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 14V27" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
