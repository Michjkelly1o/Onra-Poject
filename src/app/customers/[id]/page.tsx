"use client";

// Customer detail — full-page screen. Thin route wrapper around
// CustomerDetailPage (side panel + tabs; the Plan tab is fully built).
//
// Wrapped in `<Suspense>` so the embedded `useSearchParams` call (used to
// honour `?tab=` deep-links from the notification feed AND `?returnTo=`
// from any entry point that opened this page) doesn't trip Next.js's
// static-rendering boundary requirement.

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CustomerDetailPage } from "@/components/customers/CustomerDetailPage";

function CustomerDetailInner() {
    const { id } = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/customers";
    return <CustomerDetailPage customerId={id} returnTo={returnTo} />;
}

export default function CustomerPage() {
    return (
        <Suspense fallback={null}>
            <CustomerDetailInner />
        </Suspense>
    );
}
