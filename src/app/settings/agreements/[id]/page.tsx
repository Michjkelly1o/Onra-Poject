"use client";

// Agreement detail route — thin wrapper around AgreementDetailPage.
// Renders at /settings/agreements/[id] (top-level, no admin chrome).

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AgreementDetailPage } from "@/components/settings/AgreementDetailPage";

function AgreementDetailInner() {
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/settings/agreements";
    return <AgreementDetailPage agreementId={params.id} returnTo={returnTo} />;
}

export default function AgreementDetailRoute() {
    return (
        <Suspense fallback={null}>
            <AgreementDetailInner />
        </Suspense>
    );
}
