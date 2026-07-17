"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Home nav glyph (custom)
// ─────────────────────────────────────────────────────────────────────────────
//
// A clean house: peaked roof + chimney + a door. Drawn as ONE closed silhouette
// (roof AND body) so the active-tab fill covers the whole house, scaled to fill
// the 24×24 Untitled UI grid so it reads the same size as the other nav tabs.
// Strokes use currentColor (active/inactive nav colour); the door is filled with
// currentColor; the house honours the `fill` prop for its light-mint (#d7ffe9)
// active fill.

import type { SVGProps } from "react";

export function HomeGlyph({ fill = "none", ...props }: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            {/* House silhouette — roof + walls + rounded base, one closed path */}
            <path
                d="M3 10L12 2.5L21 10V19.5C21 20.6 20.1 21.5 19 21.5H5C3.9 21.5 3 20.6 3 19.5V10Z"
                fill={fill}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Chimney (right roof slope) */}
            <path
                d="M16.4 6.2V3.8H18V7.6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Door — filled */}
            <path
                d="M9.5 21.5V16.6C9.5 15.7 10.1 15.2 11 15.2H13C13.9 15.2 14.5 15.7 14.5 16.6V21.5"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
        </svg>
    );
}
