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

function NewServiceRouteInner() {
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/services";
    return <ServiceFormPage mode="create" returnTo={returnTo} />;
}

export default function NewServiceRoute() {
    return (
        <Suspense fallback={null}>
            <NewServiceRouteInner />
        </Suspense>
    );
}
