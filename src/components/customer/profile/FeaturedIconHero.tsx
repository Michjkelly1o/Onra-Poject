"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — FeaturedIconHero (shared) — Figma 4095:89996 pattern
// ─────────────────────────────────────────────────────────────────────────────
//
// The centred featured-icon hero used by the Gift card + Invite friends pages:
// a rotated frosted diamond tile over faint concentric rounded-square rings, with
// a title + subtitle. Only the accent color (tile + icon + ring color) varies
// between pages; the pattern, layout, and title style (text-xl/semibold) are shared.

import type { ComponentType, SVGProps } from "react";

export interface FeaturedIconHeroProps {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    /** Diamond tile background + shadow (e.g. "bg-[#dbf8ff] shadow-[…]"). */
    tileClassName: string;
    /** Icon size + color (e.g. "size-[42px] text-[var(--brand-text)]"). */
    iconClassName: string;
    /** Concentric-ring border color. Default secondary/300 green. */
    patternColor?: string;
    /** Upright rounded-square tile (Referral) instead of the rotated diamond (Gift). */
    upright?: boolean;
    title: string;
    subtitle: string;
}

export function FeaturedIconHero({
    icon: Icon,
    tileClassName,
    iconClassName,
    patternColor = "#aad4bd",
    upright = false,
    title,
    subtitle,
}: FeaturedIconHeroProps) {
    return (
        <div className="relative flex flex-col items-center pt-6 text-center">
            <div className="relative flex h-[184px] w-full items-center justify-center">
                {/* Concentric rounded-square rings, radially faded. */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.24]"
                    style={{
                        maskImage: "radial-gradient(closest-side, #000 42%, transparent 100%)",
                        WebkitMaskImage: "radial-gradient(closest-side, #000 42%, transparent 100%)",
                    }}
                >
                    {[96, 152, 208, 264, 320].map((sz) => (
                        <div
                            key={sz}
                            className="absolute rounded-[14px] border"
                            style={{ width: sz, height: sz, transform: "rotate(45deg)", borderColor: patternColor }}
                        />
                    ))}
                </div>
                {/* Frosted tile — rotated diamond (gift) or upright square (referral). */}
                <div
                    className={`relative flex size-[72px] items-center justify-center rounded-[18px] ${upright ? "" : "rotate-45"} ${tileClassName}`}
                >
                    <Icon className={`${upright ? "" : "-rotate-45"} ${iconClassName}`} aria-hidden />
                </div>
            </div>
            <p className="mt-1 text-xl font-semibold leading-[30px] text-[var(--brand-text)]">{title}</p>
            <p className="mt-1 text-sm font-medium leading-5 text-[#475467]">{subtitle}</p>
        </div>
    );
}
