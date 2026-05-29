"use client";

// Root-level full-page route (no admin layout) — same pattern as
// /products/[id]/edit, /customers/[id]/edit etc.

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import PayRateFormPage from "@/components/staff/PayRateFormPage";

function EditPayRateInner() {
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? `/staff/pay-rate/${params.id}`;
    return <PayRateFormPage mode="edit" payRateId={params.id} returnTo={returnTo} />;
}

export default function EditPayRatePage() {
    return (
        <Suspense fallback={null}>
            <EditPayRateInner />
        </Suspense>
    );
}
