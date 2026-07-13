"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — ProductCreditTile (Products catalog card) — Figma 4408-43058
// ─────────────────────────────────────────────────────────────────────────────
//
// The text-label variant of the product "image": a brand-gradient tile with the
// shared decorative ring pattern + a centred credit count ("10" / "credits", "∞"
// / "credits") instead of an icon. Used by the Products catalog cards AND the My
// plan cards (so both match). `size` scales the tile + text; `disabled` renders a
// muted grey tile for frozen / cancelled plans. The icon version (<ProductArt>)
// is kept for anywhere an icon reads better.

import type { PlanKind } from "@/lib/customer/purchase";
import { Rings } from "@/components/customer/products/ProductArt";

// Unified brand-green tile for every product type (client Jul 2026).
const GREEN = { from: "var(--brand-tertiary)", to: "var(--brand-tertiary)", text: "var(--brand-primary)", ring: "#aad4bd" };
const THEME: Record<PlanKind, { from: string; to: string; text: string; ring: string }> = {
    membership: GREEN,
    package: GREEN,
    gift_card: GREEN,
};

export function ProductCreditTile({
    kind,
    big,
    small,
    size = 64,
    disabled = false,
}: {
    kind: PlanKind;
    big: string;
    small: string;
    /** Tile edge in px (text scales with it). Defaults to the catalog card's 64px. */
    size?: number;
    /** Frozen / cancelled plans → a muted grey tile (no gradient, no rings). */
    disabled?: boolean;
}) {
    const t = THEME[kind];
    const scale = size / 64;
    return (
        <div
            className="relative flex shrink-0 items-center justify-center overflow-hidden"
            style={{
                width: size,
                height: size,
                borderRadius: 10.67 * scale,
                background: disabled ? "#f2f4f7" : `linear-gradient(180deg, ${t.from} 0%, ${t.to} 100%)`,
            }}
        >
            {!disabled && <Rings color={t.ring} opacity={0.4} scale={scale} />}
            <div
                className="relative flex flex-col items-center text-center leading-none"
                style={{ color: disabled ? "#98a2b3" : t.text }}
            >
                <span style={{ fontSize: 16 * scale, fontWeight: 600, lineHeight: `${24 * scale}px` }}>{big}</span>
                <span style={{ fontSize: 10 * scale, fontWeight: 400, lineHeight: `${16 * scale}px` }}>{small}</span>
            </div>
        </div>
    );
}
