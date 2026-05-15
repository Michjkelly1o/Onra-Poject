"use client";

import * as React from "react";
import { CreditCard02, Package, Plus, Minus, CalendarCheck01, ClockFastForward } from "@untitledui/icons";
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

export type ProductPosCardType = "membership" | "package" | "gift-card";

export interface ProductPosCardProps {
    type: ProductPosCardType;
    name: string;
    /** Subtitle line shown under the name — e.g. "10 Credits" or "Unlimited". */
    primaryMeta?: string;
    /** Secondary subtitle line — e.g. "1 Month" or "7 Days". */
    secondaryMeta?: string;
    /** Price string with currency, e.g. "AED 1200". For gift cards pass "Custom". */
    price: string;
    /** Cart quantity. 0 = not in cart, ≥ 1 = added (stepper visible). */
    quantity?: number;
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
    package:    { iconBg: "bg-[#c4edd6]", iconColor: "text-[#658774]", patternBorder: "border-[#aad4bd]" },
    "gift-card":{ iconBg: "bg-[#c4edd6]", iconColor: "text-[#658774]", patternBorder: "border-[#92baa4]" },
};

function TypeIcon({ type, className }: { type: ProductPosCardType; className?: string }) {
    if (type === "membership") return <CreditCard02 className={className} />;
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
    quantity = 0,
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

    return (
        <div
            className={cn(
                "bg-white border-1 border-[#e4e7ec] rounded-[16px] flex flex-col overflow-hidden",
                isSmall ? "w-[188px]" : "w-full",
                className,
            )}
        >
            {/* Banner */}
            <div className={cn(
                "relative bg-[#f9fafb] flex items-center justify-center shrink-0",
                isSmall ? "h-[64px]" : "h-[80px]",
            )}>
                <BannerPattern borderClass={tokens.patternBorder} />
                <div className={cn(
                    "relative z-10 rounded-[10px] border-1 border-white/10 flex items-center justify-center shadow-[0px_2px_4px_rgba(0,0,0,0.04)]",
                    tokens.iconBg,
                    isSmall ? "size-[36px]" : "size-[48px]",
                )}>
                    <TypeIcon type={type} className={cn(tokens.iconColor, isSmall ? "w-[20px] h-[20px]" : "w-[28px] h-[28px]")} />
                </div>
            </div>

            {/* Content */}
            <div className={cn(
                "flex flex-col gap-3 pb-4 w-full",
                isSmall ? "px-4 pt-3" : "px-5 pt-4",
            )}>
                <div className="flex flex-col gap-2 w-full">
                    <p className="text-[16px] font-medium text-[#101828] leading-[24px]">
                        {name}
                    </p>
                    {(primaryMeta || secondaryMeta) && (
                        <div className="flex flex-col gap-2">
                            {primaryMeta && (
                                <div className="flex items-center gap-1">
                                    <CalendarCheck01 className="w-4 h-4 text-[#667085] shrink-0" />
                                    <span className="text-[14px] font-medium text-[#667085]">{primaryMeta}</span>
                                </div>
                            )}
                            {secondaryMeta && (
                                <div className="flex items-center gap-1">
                                    <ClockFastForward className="w-4 h-4 text-[#667085] shrink-0" />
                                    <span className="text-[14px] font-medium text-[#667085]">{secondaryMeta}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Price + cart action */}
                <div className="flex items-end gap-4 h-9 w-full">
                    <p className="flex-1 text-[16px] font-semibold text-[#658774]">
                        {price}
                    </p>
                    {inCart ? (
                        <div className="border-1 border-[#e4e7ec] rounded-[8px] flex items-center gap-3 px-1.5 py-1.5 shrink-0">
                            <button type="button" onClick={onDecrement} className="w-[18px] h-[18px] flex items-center justify-center text-[#667085] hover:text-[#101828] transition-colors">
                                <Minus className="w-[18px] h-[18px]" />
                            </button>
                            <span className="text-[12px] font-semibold text-[#101828] min-w-[16px] text-center">{quantity}</span>
                            <button type="button" onClick={onIncrement} disabled={disabled} className="w-[18px] h-[18px] flex items-center justify-center text-[#667085] hover:text-[#101828] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                <Plus className="w-[18px] h-[18px]" />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={onAdd}
                            disabled={disabled}
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
