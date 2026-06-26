"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — ProductBadge — the plan/product icon tile (Figma 4014-47723 etc.)
// ─────────────────────────────────────────────────────────────────────────────
//
// A rounded tile with a faint lilac wash and a skeuomorphic featured icon
// (credit-card for memberships, package for credit packages). Sizes: 64px on the
// plan card, 72px in the product-details sheet.

import { CreditCard02, Package } from "@untitledui/icons";
import type { PlanKind } from "@/lib/customer/purchase";

export function ProductBadge({ kind, px = 64 }: { kind: PlanKind; px?: number }) {
    const Icon = kind === "membership" ? CreditCard02 : Package;
    return (
        <div
            className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e4e7ec] bg-[#fdf4ff]"
            style={{ width: px, height: px }}
        >
            <span
                className="flex items-center justify-center rounded-md bg-[#feebff] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)]"
                style={{ width: px * 0.5, height: px * 0.5 }}
            >
                <Icon className="text-[#7a5891]" style={{ width: px * 0.28, height: px * 0.28 }} aria-hidden />
            </span>
        </div>
    );
}
