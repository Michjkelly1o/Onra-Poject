"use client";

// Root-level full-page route (no admin layout) — same pattern as
// /products/[id], /customers/[id], /class-types/[id] etc.

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import PayRateDetailPage from "@/components/staff/PayRateDetailPage";

function PayRateDetailInner() {
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/staff/pay-rate";
    return <PayRateDetailPage payRateId={params.id} returnTo={returnTo} />;
}

export default function PayRateDetailRoute() {
    return (
        <Suspense fallback={null}>
            <PayRateDetailInner />
        </Suspense>
    );
}
