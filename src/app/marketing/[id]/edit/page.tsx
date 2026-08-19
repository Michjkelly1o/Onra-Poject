"use client";

// Edit-marketing route — reads the item from the store, maps the persisted
// `marketing_items` row back into the form's working shape, and hands it to
// the shared MarketingFormPage in edit mode. Saving patches the same row via
// `updateMarketingItem`, so the detail page reflects the change immediately.

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { MarketingFormPage, marketingItemToInitial } from "@/components/marketing/MarketingFormPage";
import { useAppStore } from "@/lib/store";

function EditMarketingRouteInner() {
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/marketing";
    const item = useAppStore(s => s.marketingItems.find(m => m.id === id));

    if (!item) {
        return (
            <div className="h-screen bg-white flex flex-col items-center justify-center">
                <p className="text-[18px] font-semibold text-[var(--colors-text-primary)]">Marketing item not found</p>
            </div>
        );
    }

    return (
        <MarketingFormPage
            mode="edit"
            marketingId={id}
            returnTo={returnTo}
            initial={marketingItemToInitial(item)}
        />
    );
}

export default function EditMarketingRoute() {
    return (
        <Suspense fallback={null}>
            <EditMarketingRouteInner />
        </Suspense>
    );
}
