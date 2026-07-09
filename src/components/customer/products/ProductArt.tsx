"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — ProductArt (shared) — ONRA DS ProductPosCard "Banner Image" (18066-34261)
// ─────────────────────────────────────────────────────────────────────────────
//
// The product "image": a white bordered tile with the DS "Background pattern
// decorative" (6 concentric rounded squares, rotated, emanating from above) + a
// centred, colour-coded skeuomorphic icon tile. One element, two sizes — the
// catalog card (64px) and the Product Details sheet (240px) — so both match.
// Theme per type: Membership (brand green), Credit Package (lilac), Gift Card (pink).

import type { ComponentType, SVGProps } from "react";
import { CreditCard02, Gift01, Package } from "@untitledui/icons";
import type { PlanKind } from "@/lib/customer/purchase";

const THEME: Record<
    PlanKind,
    { Icon: ComponentType<SVGProps<SVGSVGElement>>; tileBg: string; iconColor: string; ring: string; ringOpacity: number }
> = {
    // Unified brand-green theme for every product type (membership / package /
    // gift card) — only the icon differs. Client Jul 2026.
    membership: { Icon: CreditCard02, tileBg: "#e9fff3", iconColor: "#658774", ring: "#aad4bd", ringOpacity: 0.6 },
    package: { Icon: Package, tileBg: "#e9fff3", iconColor: "#658774", ring: "#aad4bd", ringOpacity: 0.6 },
    gift_card: { Icon: Gift01, tileBg: "#e9fff3", iconColor: "#658774", ring: "#aad4bd", ringOpacity: 0.6 },
};

// DS ring sizes (px @ the 64px banner) — concentric rounded squares.
const RING_SIZES = [76.19, 114.286, 152.381, 190.476, 228.571, 266.667];

const TILE_SHADOW =
    "0px 1.551px 1.551px 0px rgba(0,0,0,0.04), -3.102px 4.654px 9.307px 0px rgba(224,248,164,0.08), 4.654px 4.654px 9.307px 0px rgba(224,248,164,0.06), 0px 1.551px 9.307px 0px rgba(224,248,164,0.12)";

// DS "Background mask" — radial, opaque at centre → transparent at the edge.
const RING_MASK = "radial-gradient(50% 50% at 50% 50%, #000 0%, transparent 100%)";

export function Rings({ color, opacity, scale }: { color: string; opacity: number; scale: number }) {
    return (
        <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center justify-center"
            style={{ top: -250.47 * scale, width: 367.607 * scale, height: 367.607 * scale }}
        >
            {/* group rotation (-32.1°) + per-ring rotation (-12.5°) = -44.6° */}
            <div style={{ transform: "rotate(-44.6deg)", opacity }}>
                <div
                    className="relative"
                    style={{
                        width: 266.667 * scale,
                        height: 266.667 * scale,
                        maskImage: RING_MASK,
                        WebkitMaskImage: RING_MASK,
                    }}
                >
                    {RING_SIZES.map((sz) => {
                        const d = sz * scale;
                        return (
                            <div
                                key={sz}
                                className="absolute left-1/2 top-1/2"
                                style={{
                                    width: d,
                                    height: d,
                                    marginLeft: -d / 2,
                                    marginTop: -d / 2,
                                    // Thin line at every size (DS 0.794px) — not scaled, so the
                                    // sheet's rings stay as subtle as the card's.
                                    border: `0.794px solid ${color}`,
                                    borderRadius: 9.524 * scale,
                                }}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export function ProductArt({ kind, variant }: { kind: PlanKind; variant: "card" | "sheet" }) {
    const { Icon, tileBg, iconColor, ring, ringOpacity } = THEME[kind];
    const sheet = variant === "sheet";
    const scale = sheet ? 240 / 64 : 1;
    const tile = sheet ? 72 : 32;
    const radius = tile * (7.074 / 32);
    const iconSize = tile * (18.863 / 32);
    return (
        <div
            className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-[#e4e7ec] bg-white ${
                sheet ? "h-[240px] w-full rounded-2xl" : "size-16 rounded-[10.67px]"
            }`}
        >
            <Rings color={ring} opacity={ringOpacity} scale={scale} />

            <span
                className="relative flex items-center justify-center border border-white/[0.12]"
                style={{ width: tile, height: tile, borderRadius: radius, backgroundColor: tileBg, boxShadow: TILE_SHADOW }}
            >
                <Icon style={{ color: iconColor, width: iconSize, height: iconSize }} aria-hidden />
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{ borderRadius: radius, boxShadow: "inset 2px 2px 2.667px 0px rgba(255,255,255,0.2)" }}
                />
            </span>
        </div>
    );
}
