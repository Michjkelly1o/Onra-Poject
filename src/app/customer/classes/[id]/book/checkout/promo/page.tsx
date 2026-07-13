"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Promo list (`/customer/classes/[id]/book/checkout/promo`) — 3697-62612
// ─────────────────────────────────────────────────────────────────────────────
//
// Opened from the checkout "Apply promo" row. A code input plus the voucher
// cards (discount promos are applicable; non-discount offers show disabled).
// Tapping a card opens its detail; Apply/Remove sets the cart promo and returns
// to checkout. The applied card flips its button to "Remove".

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Ticket01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useMainScrolled } from "@/lib/customer/use-scrollable";
import { ensurePurchaseCart, purchaseCart, usePromos, type PromoVM } from "@/lib/customer/purchase";
import { PromoCard } from "@/components/customer/products/PromoCard";

export default function PromoListPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const scrolled = useMainScrolled();
    const promos = usePromos();
    const showToast = useAppStore((s) => s.showToast);

    ensurePurchaseCart(id);
    const [code, setCode] = useState("");
    const checkout = `/customer/classes/${id}/book/checkout`;

    function apply(p: PromoVM) {
        purchaseCart.promoId = p.id;
        showToast("Promotion applied", `${p.label} has been applied.`, "success");
        router.replace(checkout);
    }
    function remove() {
        purchaseCart.promoId = null;
        showToast("Promotion removed", "The promotion has been removed.", "success");
        router.replace(checkout);
    }
    function applyCode() {
        const match = promos.find((p) => p.applicable && p.code.toLowerCase() === code.trim().toLowerCase());
        if (match) apply(match);
        else showToast("Invalid code", "That promotion isn't valid.", "error");
    }

    return (
        <div className="flex min-h-full flex-col">
            <header
                className={`sticky top-0 z-20 flex w-full items-center gap-3 px-4 py-3 transition-colors ${
                    scrolled ? "bg-white/80 backdrop-blur-md" : ""
                }`}
            >
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">
                    Promotion
                </p>
                <div className="size-10 shrink-0" aria-hidden />
            </header>

            <div className="flex flex-1 flex-col gap-6 px-4 pb-6 pt-2">
                {/* Code entry */}
                <div className="flex items-center gap-2 rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                    <Ticket01 className="size-5 shrink-0 text-[#667085]" aria-hidden />
                    <input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && applyCode()}
                        placeholder="Enter promotion"
                        className="min-w-0 flex-1 bg-transparent text-base font-normal leading-6 text-[var(--brand-text)] outline-none placeholder:text-[#667085]"
                    />
                    {code.trim() && (
                        <button
                            type="button"
                            onClick={applyCode}
                            className="shrink-0 text-sm font-semibold leading-5 text-[var(--brand-primary)]"
                        >
                            Apply
                        </button>
                    )}
                </div>

                {/* Voucher cards */}
                <div className="flex flex-col gap-4">
                    {promos.map((p) => (
                        <PromoCard
                            key={p.id}
                            promo={p}
                            disabled={!p.applicable}
                            applied={purchaseCart.promoId === p.id}
                            onOpen={() => router.push(`${checkout}/promo/${p.id}`)}
                            onApply={() => (purchaseCart.promoId === p.id ? remove() : apply(p))}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
