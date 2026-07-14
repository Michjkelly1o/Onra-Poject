"use client";

// Edit-marketing route — reads the item from the store, maps the persisted
// `marketing_items` row back into the form's working shape, and hands it to
// the shared MarketingFormPage in edit mode. Saving patches the same row via
// `updateMarketingItem`, so the detail page reflects the change immediately.

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { MarketingFormPage } from "@/components/marketing/MarketingFormPage";
import { useAppStore } from "@/lib/store";

/** Split an ISO "2026-02-20T12:00:00Z" into "2026-02-20" + "12:00". */
function splitIso(iso?: string): { date: string; time: string } {
    if (!iso) return { date: "", time: "" };
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
    if (!m) return { date: iso.slice(0, 10), time: "" };
    return { date: m[1], time: m[2] };
}

function EditMarketingRouteInner() {
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/marketing";
    const item = useAppStore(s => s.marketingItems.find(m => m.id === id));

    if (!item) {
        return (
            <div className="h-screen bg-white flex flex-col items-center justify-center">
                <p className="text-[18px] font-semibold text-[#101828]">Marketing item not found</p>
            </div>
        );
    }

    const start = splitIso(item.publish_date);
    const end = splitIso(item.expiry_date);
    const branchIds = item.branch_ids ?? [];
    const multiLocation = item.multi_location ?? (branchIds.length !== 1);

    return (
        <MarketingFormPage
            mode="edit"
            marketingId={id}
            returnTo={returnTo}
            initial={{
                bannerPreview: item.cover_image_url ?? "",
                name: item.title,
                type: item.type,
                description: item.short_description,
                action: item.action_type,
                ticketPrice: item.ticket_price != null ? String(item.ticket_price) : "",
                ctaClassId: item.cta_class_id ?? "",
                externalUrl: (item.external_url ?? "").replace(/^https?:\/\//i, ""),
                startDate: start.date,
                startTime: start.time,
                endDate: end.date,
                endTime: end.time,
                countdown: item.countdown ?? false,
                multiLocation,
                branchIds,
                singleBranchId: multiLocation ? null : (branchIds[0] ?? null),
                productIds: item.target_package_ids ?? [],
                classIds: item.target_class_ids ?? [],
                customerTargeting: item.customer_targeting ?? "",
            }}
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
