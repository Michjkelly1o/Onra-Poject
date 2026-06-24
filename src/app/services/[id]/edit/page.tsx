"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Services → Edit (route)
// ─────────────────────────────────────────────────────────────────────────────
//
// Reads the dynamic [id] segment and hands it to the shared ServiceFormPage
// in `edit` mode. The shared component prefills every step from the live
// store row and falls back to a "not found" panel if the id was deleted
// (e.g. another tab archived → deleted the service mid-edit).

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ServiceFormPage } from "@/components/services/ServiceFormPage";

function EditServiceRouteInner() {
    const params = useParams();
    const id = String(params.id);
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/services";
    return <ServiceFormPage mode="edit" serviceId={id} returnTo={returnTo} />;
}

export default function EditServiceRoute() {
    return (
        <Suspense fallback={null}>
            <EditServiceRouteInner />
        </Suspense>
    );
}
