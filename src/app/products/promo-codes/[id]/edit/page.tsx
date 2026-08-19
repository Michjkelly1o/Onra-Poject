"use client";

// Edit-promo route — reads the promo from the store, maps the persisted
// `promo_codes` row back into the form's working shape, and hands it to the
// shared PromoFormPage in edit mode. Saving patches the same row via
// `updatePromoCode`, so the detail page reflects the change immediately.

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PromoFormPage, promoToInitial } from "@/components/products/PromoFormPage";
import { useAppStore } from "@/lib/store";

function EditPromoRouteInner() {
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/products/promo-codes";
    const promo = useAppStore(s => s.promoCodes.find(p => p.id === id));

    if (!promo) {
        return (
            <div className="h-screen bg-white flex flex-col items-center justify-center">
                <p className="text-[18px] font-semibold text-[var(--colors-text-primary)]">Promotion not found</p>
            </div>
        );
    }

    return (
        <PromoFormPage
            mode="edit"
            promoId={id}
            returnTo={returnTo}
            initial={promoToInitial(promo)}
        />
    );
}

export default function EditPromoRoute() {
    return (
        <Suspense fallback={null}>
            <EditPromoRouteInner />
        </Suspense>
    );
}
