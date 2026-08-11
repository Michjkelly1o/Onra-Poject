"use client";

// Create-announcement route — thin wrapper around AnnouncementFormPage in
// create mode. Lives at the top-level /announcements namespace so the 2-step
// flow takes over the whole viewport (outside the admin sidebar chrome),
// matching the campaign create flow at /marketing/new.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnnouncementFormPage } from "@/components/marketing/AnnouncementFormPage";

function CreateAnnouncementRouteInner() {
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/marketing/announcements";
    return <AnnouncementFormPage mode="create" returnTo={returnTo} />;
}

export default function CreateAnnouncementRoute() {
    return (
        <Suspense fallback={null}>
            <CreateAnnouncementRouteInner />
        </Suspense>
    );
}
