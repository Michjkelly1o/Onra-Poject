"use client";

// Agreement detail route — thin wrapper around AgreementDetailPage.
// Renders at /settings/agreements/[id] (top-level, no admin chrome).

import { useParams } from "next/navigation";
import { AgreementDetailPage } from "@/components/settings/AgreementDetailPage";

export default function AgreementDetailRoute() {
    const params = useParams<{ id: string }>();
    return <AgreementDetailPage agreementId={params.id} />;
}
