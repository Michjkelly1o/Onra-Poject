"use client";

// Create-marketing route — thin wrapper around the shared MarketingFormPage
// in create mode. The same component powers edit mode via mode="edit" with
// prefilled initial state. Lives at the top-level /marketing namespace so the
// 2-step flow takes over the whole viewport (outside the admin sidebar chrome),
// matching /products/promo-codes/new.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MarketingFormPage } from "@/components/marketing/MarketingFormPage";

function CreateMarketingRouteInner() {
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/marketing";
    return <MarketingFormPage mode="create" returnTo={returnTo} />;
}

export default function CreateMarketingRoute() {
    return (
        <Suspense fallback={null}>
            <CreateMarketingRouteInner />
        </Suspense>
    );
}
