"use client";

// Create-promo route — thin wrapper around the shared PromoFormPage in create
// mode. The same component powers edit mode via mode="edit" with prefilled
// initial state. Lives at the top-level /products namespace so the 2-step flow
// takes over the whole viewport (outside the admin sidebar chrome), matching
// /products/new, /products/gift-cards/new and /class-types/new.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PromoFormPage } from "@/components/products/PromoFormPage";

function CreatePromoRouteInner() {
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/products/promo-codes";
    return <PromoFormPage mode="create" returnTo={returnTo} />;
}

export default function CreatePromoRoute() {
    return (
        <Suspense fallback={null}>
            <CreatePromoRouteInner />
        </Suspense>
    );
}
