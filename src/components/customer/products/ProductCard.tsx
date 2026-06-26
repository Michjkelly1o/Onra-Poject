"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — ProductCard (Products catalog) — Figma 2225-14011 / 3697-41312
// ─────────────────────────────────────────────────────────────────────────────
//
// A catalog row reused across All / Packages / Gift card tabs: a tinted product
// icon, name, overview line, price. The WHOLE card is clickable → opens the
// Product Detail sheet (onAdd), where quantity can be reviewed / adjusted — even
// for a product already in the cart. The right-hand control reflects cart state:
//   • gift card           → always a "+" (each is its own line; multiples allowed)
//   • membership in cart  → a static "1" badge (only one membership; max qty 1)
//   • package in cart     → a − / qty / + stepper (quick adjust; multiples allowed)
//   • addDisabled         → no control, card otherwise looks normal (membership
//                           while a package is in cart; package while the member
//                           owns an active membership with credits)
// Inner controls stopPropagation so they don't also fire the card's open action.

import { Minus, Plus } from "@untitledui/icons";
import type { PlanRow } from "@/lib/customer/purchase";
import { ProductArt } from "@/components/customer/products/ProductArt";

function AddButton({ label, onClick }: { label: string; onClick?: () => void }) {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            aria-label={label}
            className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#d0d5dd] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors active:bg-gray-50"
        >
            <Plus className="relative size-5 text-[#344054]" aria-hidden />
            <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-lg shadow-[inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)]"
            />
        </button>
    );
}

function StepBtn({ label, onClick, children }: { label: string; onClick?: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            aria-label={label}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#d0d5dd] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors active:bg-gray-50"
        >
            {children}
        </button>
    );
}

export function ProductCard({
    product,
    cartQty = 0,
    addDisabled = false,
    onAdd,
    onIncrement,
    onDecrement,
}: {
    product: PlanRow;
    cartQty?: number;
    addDisabled?: boolean;
    onAdd?: () => void;
    onIncrement?: () => void;
    onDecrement?: () => void;
}) {
    const inCart = cartQty > 0;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onAdd}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onAdd?.();
                }
            }}
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#e4e7ec] bg-white p-4 text-left transition-shadow active:shadow-sm"
        >
            <ProductArt kind={product.kind} variant="card" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 flex-col">
                    <p className="truncate text-sm font-medium leading-5 text-[#101828]">{product.name}</p>
                    <p className="truncate text-sm font-normal leading-5 text-[#475467]">{product.sub}</p>
                </div>
                <p className="text-sm font-semibold leading-5 text-[#658774]">
                    {product.priceLabel ?? `AED ${product.price}`}
                </p>
            </div>

            {inCart ? (
                product.kind === "package" ? (
                    <div className="flex shrink-0 items-center gap-2">
                        <StepBtn label={`Decrease ${product.name}`} onClick={onDecrement}>
                            <Minus className="size-4 text-[#344054]" aria-hidden />
                        </StepBtn>
                        <span className="min-w-4 text-center text-sm font-semibold leading-5 text-[#101828]">{cartQty}</span>
                        <StepBtn label={`Increase ${product.name}`} onClick={onIncrement}>
                            <Plus className="size-4 text-[#344054]" aria-hidden />
                        </StepBtn>
                    </div>
                ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#658774] text-sm font-semibold leading-5 text-[#101828]">
                        {cartQty}
                    </span>
                )
            ) : addDisabled ? null : (
                <AddButton label={`Add ${product.name}`} onClick={onAdd} />
            )}
        </div>
    );
}
