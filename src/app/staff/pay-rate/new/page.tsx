"use client";

// Root-level full-page route (no admin layout) — same pattern as
// /products/new, /customers/new, /class-types/new etc.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PayRateFormPage from "@/components/staff/PayRateFormPage";

function NewPayRateInner() {
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/staff/pay-rate";
    return <PayRateFormPage mode="create" returnTo={returnTo} />;
}

export default function NewPayRatePage() {
    return (
        <Suspense fallback={null}>
            <NewPayRateInner />
        </Suspense>
    );
}
