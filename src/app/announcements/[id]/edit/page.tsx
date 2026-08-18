"use client";

// Edit-announcement route — reads the item from the store, maps the persisted
// `marketing_items` row back into the form's working shape, and hands it to
// AnnouncementFormPage in edit mode. Saving patches the same row via
// `updateMarketingItem`, so the detail page reflects the change immediately.

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AnnouncementFormPage, announcementItemToInitial } from "@/components/marketing/AnnouncementFormPage";
import { useAppStore } from "@/lib/store";

function EditAnnouncementRouteInner() {
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/marketing/announcements";
    const item = useAppStore(s => s.marketingItems.find(m => m.id === id));

    if (!item) {
        return (
            <div className="h-screen bg-white flex flex-col items-center justify-center">
                <p className="text-[18px] font-semibold text-[var(--colors-text-primary)]">Announcement not found</p>
            </div>
        );
    }

    return (
        <AnnouncementFormPage
            mode="edit"
            marketingId={id}
            returnTo={returnTo}
            initial={announcementItemToInitial(item)}
        />
    );
}

export default function EditAnnouncementRoute() {
    return (
        <Suspense fallback={null}>
            <EditAnnouncementRouteInner />
        </Suspense>
    );
}
