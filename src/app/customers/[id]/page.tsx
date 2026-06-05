"use client";

// Customer detail — full-page screen. Thin route wrapper around
// CustomerDetailPage (side panel + tabs; the Plan tab is fully built).
//
// Wrapped in `<Suspense>` so the embedded `useSearchParams` call (used to
// honour `?tab=` deep-links from the notification feed) doesn't trip
// Next.js's static-rendering boundary requirement.

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { CustomerDetailPage } from "@/components/customers/CustomerDetailPage";

export default function CustomerPage() {
    const { id } = useParams<{ id: string }>();
    return (
        <Suspense fallback={null}>
            <CustomerDetailPage customerId={id} />
        </Suspense>
    );
}
