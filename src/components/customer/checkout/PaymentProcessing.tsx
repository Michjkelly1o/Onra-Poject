"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — PaymentProcessing (shared) — Figma 3298-70428 / 3160-46725
// ─────────────────────────────────────────────────────────────────────────────
//
// Transient loader (booking-processing pattern, payment copy). Applies the
// purchase once on mount, snapshots the order for the success screen, clears the
// cart, then routes to `successHref`. Origin-agnostic (the caller passes the cart
// origin id + the success route).

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import {
    cartCount,
    cartTotal,
    computeTotals,
    ensurePurchaseCart,
    lastOrder,
    purchaseCart,
    usePromo,
} from "@/lib/customer/purchase";

const STEPS = ["Processing payment", "Securing your payment", "Confirming your purchase"];
const STEP_MS = 900;

function StepLine({ text, variant }: { text: string; variant: "done" | "active" | "next" }) {
    if (variant === "active") {
        return <p className="text-xl font-semibold leading-[30px] text-[var(--brand-primary)]">{text}</p>;
    }
    return (
        <p className={`text-base font-semibold leading-6 text-[#344054] ${variant === "done" ? "opacity-30" : "opacity-10"}`}>
            {text || " "}
        </p>
    );
}

function Processing({ originId, successHref }: { originId: string; successHref: string }) {
    const router = useRouter();
    const search = useSearchParams();
    const method = search.get("method") ?? "Apple pay";

    const { member } = useCurrentCustomerContext();
    const applyPurchase = useAppStore((s) => s.applyPurchase);
    const promo = usePromo(purchaseCart.promoId);
    const [step, setStep] = useState(0);
    const wroteRef = useRef(false);

    ensurePurchaseCart(originId);

    useEffect(() => {
        if (!wroteRef.current && member && purchaseCart.items.length > 0) {
            wroteRef.current = true;

            const items = purchaseCart.items;
            const totalItems = cartCount();
            const totals = computeTotals(cartTotal(), promo);
            const kinds = Array.from(new Set(items.map((it) => it.kind)));

            applyPurchase(
                member.id,
                items.map((it) => ({
                    productId: it.id,
                    productType: it.kind,
                    name: it.name,
                    unitPrice: it.price,
                    quantity: it.quantity,
                })),
            );

            const now = new Date();
            lastOrder.value = {
                ...totals,
                totalItems,
                method,
                kinds,
                txnId: `#P${Math.floor(100000000 + Math.random() * 900000000)}`,
                dateLabel: now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
                timeLabel: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
            };

            purchaseCart.classId = null;
            purchaseCart.items = [];
            purchaseCart.promoId = null;
        }

        const t1 = setTimeout(() => setStep(1), STEP_MS);
        const t2 = setTimeout(() => setStep(2), STEP_MS * 2);
        const t3 = setTimeout(() => router.replace(successHref), STEP_MS * 3);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="flex min-h-full flex-col items-center justify-center gap-12 px-4">
            <div className="flex items-center gap-1.5" aria-label="Processing">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="size-2 animate-bounce rounded-full bg-[var(--brand-primary)]"
                        style={{ animationDelay: `${i * 0.15}s` }}
                    />
                ))}
            </div>

            <div className="flex w-[343px] max-w-full flex-col items-center gap-4 text-center">
                <StepLine text={step > 0 ? STEPS[step - 1] : ""} variant={step > 0 ? "done" : "next"} />
                <StepLine text={STEPS[step]} variant="active" />
                <StepLine text={STEPS[step + 1] ?? ""} variant="next" />
                <StepLine text={STEPS[step + 2] ?? ""} variant="next" />
            </div>
        </div>
    );
}

export function PaymentProcessing({ originId, successHref }: { originId: string; successHref: string }) {
    return (
        <Suspense fallback={<div className="min-h-full" />}>
            <Processing originId={originId} successHref={successHref} />
        </Suspense>
    );
}
