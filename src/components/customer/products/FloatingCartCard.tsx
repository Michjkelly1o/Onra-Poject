"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — FloatingCartCard (Products catalog) — Figma 3298-70460
// ─────────────────────────────────────────────────────────────────────────────
//
// After adding a credit package / gift card, a card floats above the bottom nav on
// the catalog summarising the cart (count + total) and opening the Checkout Cart.
// Fixed to the bottom of the centred member column, above the 5-tab nav.

import { ChevronRight } from "@untitledui/icons";

export function FloatingCartCard({
    count,
    total,
    onCheckout,
}: {
    count: number;
    total: number;
    onCheckout: () => void;
}) {
    return (
        <div
            className="fixed inset-x-0 z-40 mx-auto w-full max-w-[500px] px-4"
            style={{ bottom: "calc(59px + max(16px, env(safe-area-inset-bottom)) + 16px)" }}
        >
            <button
                type="button"
                onClick={onCheckout}
                className="flex w-full items-center gap-4 rounded-xl bg-[#c4edd6] px-4 py-3 text-left shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] transition-colors active:brightness-95"
            >
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-normal leading-5 text-[#475467]">
                        {count} item{count === 1 ? "" : "s"}
                    </span>
                    <span className="text-base font-semibold leading-6 text-[#101828]">AED {total}</span>
                </div>
                <ChevronRight className="size-5 shrink-0 text-[#344054]" aria-hidden />
            </button>
        </div>
    );
}
