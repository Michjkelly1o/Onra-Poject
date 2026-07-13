"use client";

// Customer — Profile › Promo (`/customer/profile/promo`). Reuses the checkout promo
// list; applying a code stores it on the cart and opens Products to shop with it.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronLeft, Ticket01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { ensurePurchaseCart, purchaseCart, usePromos, type PromoVM } from "@/lib/customer/purchase";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { PromoCard } from "@/components/customer/products/PromoCard";

const PRODUCTS = "/customer/products";

export default function ProfilePromoPage() {
    const router = useRouter();
    const promos = usePromos();
    const showToast = useAppStore((s) => s.showToast);

    ensurePurchaseCart("products");
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);

    function apply(p: PromoVM) {
        purchaseCart.promoId = p.id;
        showToast("Promotion applied", `${p.label} has been applied. Pick a product to use it.`, "success");
        router.push(PRODUCTS);
    }
    function remove() {
        purchaseCart.promoId = null;
        showToast("Promotion removed", "The promotion has been removed.", "success");
    }
    function applyCode() {
        const c = code.trim().toLowerCase();
        if (!c) return;
        const match = promos.find((p) => p.code.toLowerCase() === c);
        if (match && match.applicable) {
            apply(match);
            return;
        }
        setError(match ? "This code has expired" : "Promotion not found");
    }

    const promoField = (
        <div className="flex flex-col gap-1.5">
            <div
                className={`flex items-center gap-2 rounded-lg border bg-white px-3.5 py-2.5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] ${
                    error ? "border-[#fda29b]" : "border-[#d0d5dd]"
                }`}
            >
                <Ticket01 className={`size-5 shrink-0 ${error ? "text-[#d92d20]" : "text-[#667085]"}`} aria-hidden />
                <input
                    value={code}
                    onChange={(e) => {
                        setCode(e.target.value);
                        setError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && applyCode()}
                    placeholder="Enter promotion"
                    className="min-w-0 flex-1 bg-transparent text-base font-normal leading-6 text-[var(--brand-text)] outline-none placeholder:text-[#667085]"
                />
                {error ? (
                    <AlertCircle className="size-5 shrink-0 text-[#d92d20]" aria-hidden />
                ) : (
                    code.trim() && (
                        <button type="button" onClick={applyCode} className="shrink-0 text-sm font-semibold leading-5 text-[var(--brand-primary)]">
                            Apply
                        </button>
                    )
                )}
            </div>
            {error && <p className="text-sm font-normal leading-5 text-[#d92d20]">{error}</p>}
        </div>
    );

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader subBar={promoField}>
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">Promo</p>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-4 px-4 pb-6 pt-3">
                {promos.map((p) => (
                    <PromoCard
                        key={p.id}
                        promo={p}
                        disabled={!p.applicable}
                        applied={purchaseCart.promoId === p.id}
                        onOpen={() => router.push(`/customer/products/checkout/promo/${p.id}`)}
                        onApply={() => (purchaseCart.promoId === p.id ? remove() : apply(p))}
                    />
                ))}
            </div>
        </div>
    );
}
