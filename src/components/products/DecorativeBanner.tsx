// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Decorative product banner (Figma 3726:23885 / 18501:9099)
// ─────────────────────────────────────────────────────────────────────────────
//
// Shared banner for every product card — the gift-card create/edit preview,
// the gift-card detail sidebar, and the membership / credit-package create/
// edit previews. Pure-CSS adaptation of the Figma "Banner Image": six
// concentric rounded squares rotated -12.5° inside a -32.1° wrapper, soft-
// masked into the centre, with a frosted product-icon avatar on top.
//
// The tint (pattern line colour + frosted-avatar fill + icon colour) is passed
// per product type via the `BANNER_TINTS` presets so memberships read indigo,
// credit packages sage-green, and gift cards cyan.
//
// `bannerHeight` + `iconBox` cover every size in the design:
//   • preview card   — bannerHeight 120, iconBox 56
//   • detail sidebar — bannerHeight 156, iconBox 72

import type { ComponentType, CSSProperties } from "react";

export const BANNER_TINTS = {
    membership: { lineColor: "#c7d7fe", iconBg: "#e0eaff", iconColor: "#3538cd" },
    package:    { lineColor: "#aad4bd", iconBg: "#c4edd6", iconColor: "#658774" },
    giftCard:   { lineColor: "#92d1de", iconBg: "#ccf6ff", iconColor: "#0e7090" },
    /** Pay rate (PRD 10) — brand sage palette so the monthly-salary badge
     *  reads as a "house"-tagged item. Same color stack as `package`. */
    payRate:    { lineColor: "#aad4bd", iconBg: "#c4edd6", iconColor: "#658774" },
} as const;

type IconComponent = ComponentType<{ className?: string; style?: CSSProperties }>;

export function DecorativeBanner({
    bannerHeight = 156,
    iconBox = 72,
    lineColor,
    iconBg,
    iconColor,
    icon: Icon,
}: {
    bannerHeight?: number;
    iconBox?: number;
    lineColor: string;
    iconBg: string;
    iconColor: string;
    icon: IconComponent;
}) {
    // Ratios lifted straight from the Figma variants — one set of dimensions
    // scales the frosted avatar across every size.
    const radius   = iconBox * 0.2210;
    const borderW  = iconBox * 0.0369;
    const blur     = iconBox * 0.1212;
    const iconSize = iconBox * 0.589;
    const s        = iconBox / 72; // shadow scale factor

    return (
        <div className="relative w-full overflow-hidden bg-[#f9fafb] shrink-0" style={{ height: bannerHeight }}>
            {/* Background pattern — concentric rounded squares, tilted. The
                outer wrapper applies the -32.1° rotation; the inner squares
                apply the -12.5° offset around the centre. A radial mask fades
                the pattern out before it reaches the banner edges. */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
                <div className="size-[560px] flex items-center justify-center" style={{ transform: "rotate(-32.1deg)" }}>
                    <div className="relative size-[560px]"
                        style={{
                            WebkitMaskImage: "radial-gradient(circle at center, black 0%, black 30%, transparent 70%)",
                            maskImage:       "radial-gradient(circle at center, black 0%, black 30%, transparent 70%)",
                        }}>
                        {[160, 240, 320, 400, 480, 560].map(sz => (
                            <div key={sz}
                                className="absolute left-1/2 top-1/2 rounded-[20px]"
                                style={{
                                    width: sz, height: sz,
                                    transform: "translate(-50%, -50%) rotate(-12.5deg)",
                                    border: `1.667px solid ${lineColor}`,
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Frosted product-icon avatar */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative flex items-center justify-center"
                    style={{
                        width: iconBox, height: iconBox, borderRadius: radius,
                        background: iconBg,
                        border: `${borderW}px solid rgba(255,255,255,0.12)`,
                        backdropFilter: `blur(${blur}px)`,
                        WebkitBackdropFilter: `blur(${blur}px)`,
                        boxShadow: `0px ${2.7 * s}px ${2.7 * s}px rgba(0,0,0,0.04),-${5.4 * s}px ${8.1 * s}px ${16.3 * s}px rgba(224,248,164,0.08),${8.1 * s}px ${8.1 * s}px ${16.3 * s}px rgba(224,248,164,0.06),0px ${2.7 * s}px ${16.3 * s}px rgba(224,248,164,0.12)`,
                    }}>
                    <Icon style={{ width: iconSize, height: iconSize, color: iconColor }} />
                    <div className="absolute inset-0 pointer-events-none"
                        style={{ borderRadius: radius, boxShadow: `inset ${3 * s}px ${3 * s}px ${4 * s}px rgba(255,255,255,0.2)` }} />
                </div>
            </div>
        </div>
    );
}
