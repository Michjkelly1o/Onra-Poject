"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — ProductDetailsSheet — plan detail + add to cart (Figma 3465-46734)
// ─────────────────────────────────────────────────────────────────────────────
//
// Opened from the catalog "+". Shows the product image, name, sub, price, a
// quantity stepper, and "Add to cart". When the member already holds a membership
// and opens a different one, an Upgrade/Downgrade section (current → new + an info
// banner) renders above the price. The sheet opens at the product's current cart
// quantity (initialQty) so it can be adjusted. Quantity: packages step 1..N (− is
// disabled at 1); memberships are fixed at qty 1 (both ± disabled).

import { useEffect, useState } from "react";
import { ChevronRight, CreditCard02, Lightbulb02, Minus, Plus } from "@untitledui/icons";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { ProductArt } from "@/components/customer/products/ProductArt";
import { Button } from "@/components/ui/button";
import type { PlanRow } from "@/lib/customer/purchase";

export interface UpgradeInfo {
    mode: "upgrade" | "downgrade";
    currentName: string;
}

export interface ProductDetailsSheetProps {
    open: boolean;
    onClose: () => void;
    plan: PlanRow | null;
    onAdd: (plan: PlanRow, quantity: number) => void;
    /** Set when the member already holds a membership and opens a different one. */
    upgrade?: UpgradeInfo | null;
    /** Current cart quantity (so an already-added product opens at its real qty). */
    initialQty?: number;
    /** Disables "Add to cart" (e.g. a package while the member owns a membership). */
    disabled?: boolean;
}

const STEP_BTN =
    "flex size-9 items-center justify-center rounded-full border border-[#d0d5dd] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors active:bg-gray-50 disabled:opacity-40";

function PlanChip({ name }: { name: string }) {
    return (
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#e4e7ec] bg-white p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-[#658774]">
                <CreditCard02 className="size-[18px] text-white" aria-hidden />
            </span>
            <span className="min-w-0 text-sm font-medium leading-5 text-[#101828] line-clamp-2">{name}</span>
        </div>
    );
}

export function ProductDetailsSheet({ open, onClose, plan, onAdd, upgrade, initialQty = 1, disabled = false }: ProductDetailsSheetProps) {
    const [qty, setQty] = useState(1);
    useEffect(() => {
        if (open) setQty(Math.max(1, initialQty));
    }, [open, plan?.id, initialQty]);

    // Only packages have an adjustable quantity; memberships + gift cards are qty 1
    // (a gift card is configured one-at-a-time on the Gift Card Information page).
    const isPackage = plan?.kind === "package";

    return (
        <CustomerSheet open={open} onClose={onClose}>
            {plan && (
                <div className="flex flex-col gap-5">
                    {/* Toolbar */}
                    <SheetToolbar title="Product details" onClose={onClose} />

                    {/* Image */}
                    <ProductArt kind={plan.kind} variant="sheet" />

                    {/* Title + (upgrade/downgrade) + price */}
                    <div className="flex w-full flex-col gap-5">
                        <div className="flex flex-col gap-0.5">
                            <p className="text-xl font-semibold leading-[30px] text-[#101828]">{plan.name}</p>
                            <p className="text-sm font-normal leading-5 text-[#475467]">{plan.sub}</p>
                        </div>

                        {upgrade && (
                            <section className="flex flex-col gap-3">
                                <p className="text-base font-semibold leading-6 text-[#101828]">
                                    {upgrade.mode === "upgrade" ? "Upgrade plan" : "Downgrade plan"}
                                </p>
                                <div className="flex items-center gap-2">
                                    <PlanChip name={upgrade.currentName} />
                                    <ChevronRight className="size-5 shrink-0 text-[#344054]" aria-hidden />
                                    <PlanChip name={plan.name} />
                                </div>
                                <div className="flex items-start gap-3 rounded-xl border border-[#7ba08c] bg-[#e9fff3] p-4">
                                    <Lightbulb02 className="mt-0.5 size-5 shrink-0 text-[#475467]" aria-hidden />
                                    <p className="flex-1 text-sm font-normal leading-5 text-[#475467]">
                                        {upgrade.mode === "upgrade" ? "Upgrading" : "Downgrading"} will replace your
                                        current plan once the duration ends.
                                    </p>
                                </div>
                            </section>
                        )}

                        <p className="text-xl font-semibold leading-[30px] text-[#658774]">
                            {plan.priceLabel ?? `AED ${plan.price}`}
                        </p>
                    </div>

                    {/* Footer — quantity stepper + Add to cart (consistent across sheets) */}
                    <div className="flex w-full items-center justify-between gap-4 pt-2">
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => setQty((q) => Math.max(1, q - 1))}
                                aria-label="Decrease quantity"
                                disabled={disabled || !isPackage || qty <= 1}
                                className={STEP_BTN}
                            >
                                <Minus className="size-5 text-[#344054]" aria-hidden />
                            </button>
                            <span className="min-w-4 text-center text-base font-semibold leading-6 text-[#101828]">
                                {qty}
                            </span>
                            <button
                                type="button"
                                onClick={() => setQty((q) => q + 1)}
                                aria-label="Increase quantity"
                                disabled={disabled || !isPackage}
                                className={STEP_BTN}
                            >
                                <Plus className="size-5 text-[#344054]" aria-hidden />
                            </button>
                        </div>
                        <Button
                            variant="primary"
                            size="xl"
                            className="shrink-0 rounded-full"
                            disabled={disabled}
                            onClick={() => onAdd(plan, isPackage ? qty : 1)}
                        >
                            Add to cart
                        </Button>
                    </div>
                </div>
            )}
        </CustomerSheet>
    );
}
