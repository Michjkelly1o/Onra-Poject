"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — PromoCard / PromoBanner — voucher cards (Figma 3697-62612 / 67938)
// ─────────────────────────────────────────────────────────────────────────────
//
// PromoBanner is the 140px image header (banner photo + dark scrim + headline +
// category). PromoCard wraps it with the title row, "1x" badge, description, and
// an Apply button — used in the promo list. Disabled cards (non-discount offers)
// are desaturated with a disabled Apply button.

import { Sale04 } from "@untitledui/icons";
import type { PromoVM } from "@/lib/customer/purchase";
import { Button } from "@/components/ui/button";

export function PromoBanner({
    promo,
    disabled = false,
    rounded = false,
}: {
    promo: PromoVM;
    disabled?: boolean;
    /** Standalone use (voucher detail page) gets a 16px radius; inside a card the
     *  parent's overflow-hidden clips it, so the card passes rounded={false}. */
    rounded?: boolean;
}) {
    return (
        <div
            className={`relative flex h-[140px] w-full flex-col justify-between overflow-hidden px-4 pb-3 pt-8 ${
                rounded ? "rounded-2xl" : ""
            }`}
        >
            {promo.bannerImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={promo.bannerImage}
                    alt=""
                    className={`absolute inset-0 size-full object-cover ${disabled ? "grayscale" : ""}`}
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/30" aria-hidden />
            <div className="relative flex flex-col text-white">
                <p className="text-2xl font-semibold leading-8">{promo.label}</p>
                <p className="text-sm font-medium leading-5">{promo.category}</p>
            </div>
            <p className="relative text-xs font-normal leading-[18px] text-[#d0d5dd]">*T&Cs Apply</p>
        </div>
    );
}

function SaleBadge() {
    return (
        <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] py-0.5 pl-1.5 pr-2">
            <Sale04 className="size-3 text-[var(--brand-primary)]" aria-hidden />
            <span className="text-xs font-medium leading-[18px] text-[var(--brand-primary)]">1x</span>
        </span>
    );
}

export interface PromoCardProps {
    promo: PromoVM;
    disabled?: boolean;
    /** Open the promo detail. */
    onOpen: () => void;
    /** Apply (or remove, when already applied) directly from the list. */
    onApply: () => void;
    applied?: boolean;
}

export function PromoCard({ promo, disabled = false, onOpen, onApply, applied = false }: PromoCardProps) {
    return (
        <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={disabled ? undefined : onOpen}
            onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen();
                }
            }}
            className={`w-full overflow-hidden rounded-2xl bg-white text-left ${
                applied ? "border-2 border-[var(--brand-primary)]" : "border border-[#e4e7ec]"
            } ${disabled ? "cursor-default" : "cursor-pointer transition-shadow active:shadow-sm"}`}
        >
            <PromoBanner promo={promo} disabled={disabled} />
            <div className="flex flex-col gap-3 px-4 pb-4 pt-3">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">{promo.label}</p>
                        <SaleBadge />
                    </div>
                    <p className="line-clamp-2 text-xs font-normal leading-[18px] text-[#475467]">
                        {promo.description}
                    </p>
                </div>
                <div
                    className="h-px w-full"
                    style={{
                        backgroundImage:
                            "repeating-linear-gradient(90deg, #d0d5dd 0, #d0d5dd 6px, transparent 6px, transparent 12px)",
                    }}
                />
                <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 text-xs leading-[18px]">
                        <span className="font-normal text-[#667085]">Valid until </span>
                        <span className="font-medium text-[var(--brand-text)]">{promo.validUntil}</span>
                    </p>
                    {applied ? (
                        <Button
                            variant="destructive-secondary"
                            size="sm"
                            className="shrink-0 rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                onApply();
                            }}
                        >
                            Cancel
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            size="sm"
                            disabled={disabled}
                            className="shrink-0 rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                onApply();
                            }}
                        >
                            Apply
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
