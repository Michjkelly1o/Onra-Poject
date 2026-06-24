"use client";

// Create-gift-card route — thin wrapper around the shared GiftCardFormPage in
// create mode. The same component powers edit mode via mode="edit" with
// prefilled initial state. Lives at the top-level /products namespace so the
// 3-step flow takes over the whole viewport (outside the admin sidebar chrome),
// matching /products/new and /class-types/new.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GiftCardFormPage } from "@/components/products/GiftCardFormPage";

function CreateGiftCardRouteInner() {
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/products/gift-cards";
    return <GiftCardFormPage mode="create" returnTo={returnTo} />;
}

export default function CreateGiftCardRoute() {
    return (
        <Suspense fallback={null}>
            <CreateGiftCardRouteInner />
        </Suspense>
    );
}
