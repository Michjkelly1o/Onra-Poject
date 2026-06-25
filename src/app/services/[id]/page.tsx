"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Services → Detail (route)
// ─────────────────────────────────────────────────────────────────────────────
//
// Top-level route so the detail page renders edge-to-edge without the admin
// sidebar + header chrome (same pattern as /class-types/[id]). Reads the
// dynamic [id] and hands it to the shared ServiceDetailPage component.

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ServiceDetailPage } from "@/components/services/ServiceDetailPage";

function ServiceDetailRouteInner() {
    const params = useParams();
    const id = String(params.id);
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/services";
    return <ServiceDetailPage serviceId={id} returnTo={returnTo} />;
}

export default function ServiceDetailRoute() {
    return (
        <Suspense fallback={null}>
            <ServiceDetailRouteInner />
        </Suspense>
    );
}
