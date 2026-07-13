"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — ActivePlanCard (Products catalog) — ONRA DS Alert (Figma 3298-73796)
// ─────────────────────────────────────────────────────────────────────────────
//
// Shown below the tabs / above the product list for a member who holds an active
// plan. Exact DS "Alert" — Secondary/50 bg, brand border, a 32px skeuomorphic
// brand icon tile, and 14px primary/tertiary text.

import { CreditCard02 } from "@untitledui/icons";

const TILE_SHADOW =
    "0px 1.551px 1.551px 0px rgba(0,0,0,0.04), -3.102px 4.654px 9.307px 0px rgba(224,248,164,0.08), 4.654px 4.654px 9.307px 0px rgba(224,248,164,0.06), 0px 1.551px 9.307px 0px rgba(224,248,164,0.12)";

export function ActivePlanCard({ name, sub }: { name: string; sub: string }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] p-4">
            <span
                className="relative flex size-8 shrink-0 items-center justify-center rounded-[7px] border border-white/[0.12] bg-[var(--brand-primary)]"
                style={{ boxShadow: TILE_SHADOW }}
            >
                <CreditCard02 className="size-[18px] text-white" aria-hidden />
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[7px]"
                    style={{ boxShadow: "inset 2px 2px 2.667px 0px rgba(255,255,255,0.2)" }}
                />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">{name}</p>
                <p className="truncate text-sm font-normal leading-5 text-[#475467]">{sub}</p>
            </div>
        </div>
    );
}
