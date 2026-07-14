"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Services → New (route)
// ─────────────────────────────────────────────────────────────────────────────
//
// Thin route file. The 3-step create form chrome lives in the shared
// ServiceFormPage so /[id]/edit can render the same UI with prefilled
// state via `mode="edit"`.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ServiceFormPage } from "@/components/services/ServiceFormPage";
import type { ServiceType } from "@/lib/store";

function NewServiceRouteInner() {
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/services";
    // Scope the create to the menu it came from — "Private sessions" locks the
    // form to Private, "Recovery & wellness" to Recovery.
    const typeParam = searchParams.get("type");
    const presetType: ServiceType | undefined =
        typeParam === "private" || typeParam === "recovery" ? typeParam : undefined;
    return <ServiceFormPage mode="create" returnTo={returnTo} presetType={presetType} />;
}

export default function NewServiceRoute() {
    return (
        <Suspense fallback={null}>
            <NewServiceRouteInner />
        </Suspense>
    );
}
