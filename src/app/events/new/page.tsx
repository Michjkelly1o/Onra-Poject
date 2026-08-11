"use client";

// Create-event route — thin wrapper around EventFormPage in create mode. Lives
// at the top-level /events namespace so the 2-step flow takes over the whole
// viewport (outside the admin sidebar chrome), matching the campaign create
// flow at /marketing/new.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EventFormPage } from "@/components/marketing/EventFormPage";

function CreateEventRouteInner() {
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/marketing/events";
    return <EventFormPage mode="create" returnTo={returnTo} />;
}

export default function CreateEventRoute() {
    return (
        <Suspense fallback={null}>
            <CreateEventRouteInner />
        </Suspense>
    );
}
