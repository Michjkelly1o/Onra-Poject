"use client";

import * as React from "react";
import { CreditCard02, Package, Gift01, Plus, Minus, CalendarCheck01, ClockFastForward, BankNote01, ShoppingBag01, Box, Tag03 } from "@untitledui/icons";
import { cn } from "@/lib/utils";

// ─── Onra DS — Product POS Card ───────────────────────────────────────────────
//
// Reusable card used in the POS module (and the schedule module's POS shortcut)
// for memberships, credit packages, and gift cards.
//
// Figma source: ONRA DESIGN SYSTEM Light Version — node 18501:9099
//
// Variants
//   type      — "membership" | "package" | "gift-card"  (drives icon + accent colour)
//   size      — "lg" (352px wide, used in full POS) | "sm" (188px wide, used in
//               compact contexts like the cart preview)
//
// State
//   quantity  — 0 means "not in cart" → renders the `+` button
//               ≥ 1 renders a `−  qty  +` stepper inline with the price
//   disabled  — locks the add button (used when the customer already has an
//               incompatible product in the cart, e.g. trying to add a credit
//               package while a membership is selected)
//
// Callbacks
//   onAdd / onIncrement / onDecrement — wire the cart actions

export type ProductPosCardType = "membership" | "package" | "gift-card" | "retail";

export interface ProductPosCardProps {
    type: ProductPosCardType;
    name: string;
    /** Subtitle chip shown next to the name row — e.g. "10 Credits" or "Unlimited". */
    primaryMeta?: string;
    /** Secondary subtitle chip — e.g. "1 Month" or "7 Days". */
    secondaryMeta?: string;
    /** Price string with currency, e.g. "AED 1200". For gift cards pass "Custom". */
    price: string;
    /** Retail only (2026-07-29). When set, the banner renders as a full-cover
     *  product image instead of the tinted-icon + concentric pattern used by
     *  membership / package / gift-card cards. Optional — no image falls back
     *  to a soft sage gradient placeholder (no glyph, matches the DS pattern
     *  used elsewhere in the retail module). */
    bannerImageUrl?: string;
    /** Retail only. When true, the whole card renders as a disabled "Out of
     *  stock" state — no add-to-cart, muted opacity, red pill overlay. */
    outOfStock?: boolean;
    /** Cart quantity. 0 = not in cart, ≥ 1 = added. */
    quantity?: number;
    /** How quantity is surfaced when ≥ 1.
     *  • "stepper" (default) — inline −/qty/+ control. Used by the mini-POS
     *    inside the class-schedule flow where the cart is a modal.
     *  • "badge" — passive count circle (Figma 18501:9122). Used by the
     *    standalone POS module where the cart panel owns the stepper. */
    quantityDisplay?: "stepper" | "badge";
    /** Locks the add button — used to enforce single-membership/no-mix rules. */
    disabled?: boolean;
    onAdd?: () => void;
    onIncrement?: () => void;
    onDecrement?: () => void;
    size?: "lg" | "sm";
    className?: string;
}

const TYPE_TOKENS: Record<ProductPosCardType, { iconBg: string; iconColor: string; patternBorder: string }> = {
    membership: { iconBg: "bg-[#e0eaff]", iconColor: "text-[#3538cd]", patternBorder: "border-[#c7d7fe]" },
    package:    { iconBg: "bg-[var(--brand-tertiary)]", iconColor: "text-[#658774]", patternBorder: "border-[#aad4bd]" },
    // Gift cards use the cyan family — same tint as the gift-card create/edit
    // preview + detail sidebar so the card reads consistently everywhere.
    "gift-card":{ iconBg: "bg-[#ccf6ff]", iconColor: "text-[#0e7090]", patternBorder: "border-[#92d1de]" },
    // Retail (2026-07-29) — banner is a real product image; tokens still
    // needed for the tiny name-row bag icon when no bannerImageUrl is set.
    retail:     { iconBg: "bg-[var(--brand-tertiary)]", iconColor: "text-[#658774]", patternBorder: "border-[#aad4bd]" },
};

function TypeIcon({ type, className }: { type: ProductPosCardType; className?: string }) {
    if (type === "membership") return <CreditCard02 className={className} />;
    if (type === "gift-card") return <Gift01 className={className} />;
    if (type === "retail") return <ShoppingBag01 className={className} />;
    return <Package className={className} />;
}

/**
 * Decorative concentric-rectangle pattern shown in the banner — Figma uses six
 * rotated rounded rectangles fading outward. We render five for the visual
 * effect; this is purely cosmetic and won't affect layout.
 */
function BannerPattern({ borderClass }: { borderClass: string }) {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-32deg] opacity-30">
                {[80, 130, 180, 230, 280].map((size) => (
                    <div
                        key={size}
                        className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-12.5deg] rounded-[14px] border-1", borderClass)}
                        style={{ width: size, height: size }}
                    />
                ))}
            </div>
        </div>
    );
}

export function ProductPosCard({
    type,
    name,
    primaryMeta,
    secondaryMeta,
    price,
    bannerImageUrl,
    outOfStock = false,
    quantity = 0,
    quantityDisplay = "stepper",
    disabled = false,
    onAdd,
    onIncrement,
    onDecrement,
    size = "lg",
    className,
}: ProductPosCardProps) {
    const tokens = TYPE_TOKENS[type];
    const inCart = quantity > 0;
    const isSmall = size === "sm";
    const isRetail = type === "retail";
    // Out-of-stock retail cards lock every interactive path — the card
    // reads visually muted with an "Out of stock" pill overlay.
    const effectiveDisabled = disabled || outOfStock;

    return (
        <div
            className={cn(
                // h-full + flex-col so siblings stretch to the tallest card in
                // the row; long product names no longer leave neighbours short.
                "bg-white border-1 border-[#e4e7ec] rounded-[16px] flex flex-col overflow-hidden h-full",
                isSmall ? "w-[188px]" : "w-full",
                outOfStock && "opacity-60",
                className,
            )}
        >
            {/* Banner — every non-retail type shares the same banner treatment
                (`#f9fafb` fill + decorative pattern + tinted icon) so gift
                cards sit consistently next to memberships + packages. Retail
                overrides this with a full-cover product image (or a sage
                gradient placeholder when no image was uploaded). */}
            <div className={cn(
                "relative flex items-center justify-center shrink-0 overflow-hidden",
                !isRetail && "bg-[#f9fafb]",
                isSmall ? "h-[64px]" : (isRetail ? "h-[120px]" : "h-[80px]"),
            )}>
                {isRetail ? (
                    bannerImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={bannerImageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#e9fff3] to-[#f5fffa]" />
                    )
                ) : (
                    <>
                        <BannerPattern borderClass={tokens.patternBorder} />
                        <div className={cn(
                            "relative z-10 rounded-[10px] border-1 border-white/10 flex items-center justify-center shadow-[0px_2px_4px_rgba(0,0,0,0.04)]",
                            tokens.iconBg,
                            isSmall ? "size-[36px]" : "size-[48px]",
                        )}>
                            <TypeIcon type={type} className={cn(tokens.iconColor, isSmall ? "w-[20px] h-[20px]" : "w-[28px] h-[28px]")} />
                        </div>
                    </>
                )}
                {outOfStock && (
                    <span className="absolute top-2 right-2 z-10 inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-white border-1 border-[#fecdca] text-[#b42318]">
                        Out of stock
                    </span>
                )}
            </div>

            {/* Content — flex-1 so the price/CTA row anchors to the card bottom
                regardless of how many lines the name/meta wrap. */}
            <div className={cn(
                "flex flex-col gap-3 pb-4 w-full flex-1",
                isSmall ? "px-4 pt-3" : "px-5 pt-4",
            )}>
                <div className="flex flex-col gap-2 w-full flex-1">
                    <p className="text-[16px] font-medium text-[#101828] leading-[24px]">
                        {name}
                    </p>
                    {(primaryMeta || secondaryMeta) && (
                        <div className="flex items-center gap-4 flex-wrap">
                            {primaryMeta && (
                                <div className="flex items-center gap-1">
                                    {/* Gift cards lead with the loaded value (bank-note);
                                        retail leads with the category (Tag03 — same
                                        icon the customer product-detail page uses for
                                        the "Category" row);
                                        memberships/packages lead with class count. */}
                                    {type === "gift-card"
                                        ? <BankNote01 className="w-4 h-4 text-[#667085] shrink-0" />
                                        : type === "retail"
                                            ? <Tag03 className="w-4 h-4 text-[#667085] shrink-0" />
                                            : <CalendarCheck01 className="w-4 h-4 text-[#667085] shrink-0" />}
                                    <span className="text-[14px] font-medium text-[#667085]">{primaryMeta}</span>
                                </div>
                            )}
                            {secondaryMeta && (
                                <div className="flex items-center gap-1">
                                    {/* Retail shows a "box" for total-stock units; other
                                        types keep the clock-fast-forward duration icon. */}
                                    {type === "retail"
                                        ? <Box className="w-4 h-4 text-[#667085] shrink-0" />
                                        : <ClockFastForward className="w-4 h-4 text-[#667085] shrink-0" />}
                                    <span className="text-[14px] font-medium text-[#667085]">{secondaryMeta}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Price + cart action — always pinned to the bottom of the card.
                    Two variants when in the cart:
                      • stepper (mini-POS) — full −/qty/+ control
                      • badge  (POS module) — passive sage circle showing qty;
                                              the cart panel owns the stepper */}
                <div className="flex items-end gap-4 h-9 w-full mt-auto">
                    <p className="flex-1 text-[16px] font-semibold text-[#658774]">
                        {price}
                    </p>
                    {inCart && quantityDisplay === "stepper" ? (
                        <div className="border-1 border-[#e4e7ec] rounded-[8px] flex items-center gap-3 px-1.5 py-1.5 shrink-0">
                            <button type="button" onClick={onDecrement} className="w-[18px] h-[18px] flex items-center justify-center text-[#667085] hover:text-[#101828] transition-colors">
                                <Minus className="w-[18px] h-[18px]" />
                            </button>
                            <span className="text-[12px] font-semibold text-[#101828] min-w-[16px] text-center">{quantity}</span>
                            <button type="button" onClick={onIncrement} disabled={effectiveDisabled} className="w-[18px] h-[18px] flex items-center justify-center text-[#667085] hover:text-[#101828] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                <Plus className="w-[18px] h-[18px]" />
                            </button>
                        </div>
                    ) : inCart && quantityDisplay === "badge" ? (
                        <div
                            aria-label={`${name} added (${quantity})`}
                            className="w-9 h-9 rounded-full border-1 border-[#658774] flex items-center justify-center text-[14px] font-semibold text-[#658774] shrink-0"
                        >
                            {quantity}
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={onAdd}
                            disabled={effectiveDisabled}
                            aria-label={`Add ${name}`}
                            className="border-1 border-[#d0d5dd] bg-[#f9fafb] rounded-[8px] p-2 shrink-0 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#f2f4f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <Plus className="w-5 h-5 text-[#344054]" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
