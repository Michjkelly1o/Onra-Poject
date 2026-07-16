"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Home nav glyph — Figma 4515-147080 (hugeicons:home-12)
// ─────────────────────────────────────────────────────────────────────────────
//
// The bottom-nav Home icon: a rounded house with a smile, traced 1:1 from the
// Figma vector. Normalised onto a 24×24 grid (the Untitled UI icon box) and
// centred with a translate — so it is NOT stretched — and drawn at strokeWidth 2
// so its border weight matches every other nav icon. Strokes use currentColor
// (driven by the nav's active/inactive color); the house body honours the `fill`
// prop so the active tab keeps its light-mint (#d7ffe9) fill.

import type { SVGProps } from "react";

// Centre the 22.81×21.76 artwork inside the 24×24 icon box (no scaling → no stretch).
const CENTER = "translate(0.5945 1.1211)";

export function HomeGlyph({ fill = "none", ...props }: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <g transform={CENTER}>
                {/* Roof + chimney outline */}
                <path
                    d="M0.879005 8.77341L10.4666 1.20481C10.7341 0.993756 11.0649 0.878968 11.4056 0.878968C11.7463 0.878968 12.0771 0.993756 12.3445 1.20481L16.1425 4.20278V2.45747C16.1425 2.17829 16.2534 1.91054 16.4508 1.71313C16.6483 1.51572 16.916 1.40481 17.1952 1.40481H18.2478C18.527 1.40481 18.7948 1.51572 18.9922 1.71313C19.1896 1.91054 19.3005 2.17829 19.3005 2.45747V6.69547L21.9321 8.77341"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {/* House body — fill follows the active state */}
                <path
                    d="M11.4056 0.878968C11.0649 0.878968 10.7341 0.993756 10.4666 1.20481L2.98432 7.11144V10.3524V14.563C2.98432 17.5399 2.98432 19.0294 3.9096 19.9537C4.83384 20.879 6.32335 20.879 9.30026 20.879H13.5109C16.4878 20.879 17.9773 20.879 18.9015 19.9537C19.8268 19.0294 19.8268 17.5399 19.8268 14.563V10.3524V6.66807V2.45744C19.8268 2.17826 19.8268 1.93111 19.6392 1.71313C19.3005 1.40478 19.0534 1.40478 18.7742 1.40478L17.1952 1.40481C16.916 1.40481 16.6483 1.51572 16.4508 1.71313C16.2534 1.91054 16.1425 2.17829 16.1425 2.45747V4.20278L12.3445 1.20481C12.0771 0.993756 11.7463 0.878968 11.4056 0.878968Z"
                    fill={fill}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {/* Smile */}
                <path
                    d="M14.5656 14.563C13.7235 15.2177 12.6182 15.6157 11.4076 15.6157C10.1971 15.6157 9.09178 15.2177 8.24966 14.563"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </g>
        </svg>
    );
}
