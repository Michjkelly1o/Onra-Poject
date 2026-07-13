"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Forma gift-card illustration (shared) — Figma 4095:90098 / 4095:90135
// ─────────────────────────────────────────────────────────────────────────────
//
// The green-wash Forma gift card, built from the same assets as the Checkout
// Cart's payment tile (`gift-shape.svg` + `forma-logomark.svg`):
//   • GiftCardMark — the small rounded tile (payment picker + redeemed-list row).
//   • GiftCardArt  — the full 335×210 card used in the Redeem modal, in two
//     states: "sent" (large logomark) and "redeemed" (Forma + check + balance).

import { Check } from "@untitledui/icons";

/** Exact Figma card gradient (stops reordered ascending for CSS). */
const FORMA_GRADIENT =
    "linear-gradient(178.25deg, rgb(234,239,243) 4%, rgb(216,243,228) 22.7%, rgb(177,231,201) 34.5%, rgb(239,250,244) 69%, rgb(196,237,214) 100%)";

/** Small green gift-card tile (46×32) — the exact Forma payment tile used in the
 *  checkout Pay-with picker and the redeemed-gift-card list row. */
export function GiftCardMark({ className }: { className?: string }) {
    return (
        <span
            className={`relative h-8 w-[46px] shrink-0 overflow-hidden rounded border-[0.17px] border-[#e4e7ec] ${className ?? ""}`}
            style={{ backgroundImage: FORMA_GRADIENT }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/pay/gift-shape.svg" alt="" className="absolute left-[-7px] top-1/2 size-11 -translate-y-1/2" />
            <span className="absolute left-[2.5px] top-1/2 flex -translate-y-1/2 items-center p-[3.3px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/pay/forma-logomark.svg" alt="" className="h-[13.7px] w-[11.4px]" />
            </span>
        </span>
    );
}

export interface GiftCardArtProps {
    /** "sent" = pre-redeem (large logomark); "redeemed" = Forma + check + balance. */
    variant: "sent" | "redeemed";
    /** Face value shown on the redeemed card (e.g. 250 → "AED 250 Gift Card"). */
    value?: number;
    className?: string;
}

/** The full Forma gift card (335×210 ratio). */
export function GiftCardArt({ variant, value, className }: GiftCardArtProps) {
    return (
        <div
            className={`relative aspect-[335/210] w-full overflow-hidden rounded-2xl border border-[var(--brand-tertiary)] shadow-[0px_1px_1px_0px_rgba(16,24,40,0.05)] ${className ?? ""}`}
            style={{ backgroundImage: FORMA_GRADIENT }}
        >
            {/* Curved swoosh overlay */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/images/pay/gift-shape.svg"
                alt=""
                className="pointer-events-none absolute left-[-15.2%] top-1/2 aspect-square w-[95.5%] -translate-y-1/2"
            />

            {variant === "sent" ? (
                // Large centered-left logomark
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src="/images/pay/forma-logomark.svg"
                    alt="Forma"
                    className="absolute left-[5.7%] top-1/2 aspect-[11.44/13.73] w-[24.9%] -translate-y-1/2"
                />
            ) : (
                <>
                    {/* Top-left — Forma lockup. The logomark SVG is preserveAspectRatio
                        "none", so it needs an explicit-ratio box (26.67×32 = viewBox
                        11.44:13.73) or it stretches. */}
                    <div className="absolute left-0 top-0 flex items-center gap-1.5 p-5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/images/pay/forma-logomark.svg" alt="" className="h-8 w-[26.67px] shrink-0" />
                        <span className="text-lg font-semibold leading-7 text-[var(--brand-primary)]">Forma</span>
                    </div>
                    {/* Top-right — check */}
                    <div className="absolute right-0 top-0 p-5">
                        <span className="flex size-7 items-center justify-center rounded-full bg-[var(--brand-primary)]">
                            <Check className="size-[18px] text-white" strokeWidth={3} aria-hidden />
                        </span>
                    </div>
                    {/* Bottom-left — balance (padding on the wrapper so the 112px text box
                        wraps to "AED 250" / "Gift Card", not one word per line). */}
                    <div className="absolute bottom-0 left-0 p-6">
                        <p className="w-28 text-xl font-semibold leading-[30px] text-[var(--brand-primary)]">AED {value} Gift Card</p>
                    </div>
                </>
            )}
        </div>
    );
}
