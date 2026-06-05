"use client";

// Add-new-version route — thin wrapper around AgreementNewVersionPage.

import { useParams } from "next/navigation";
import { AgreementNewVersionPage } from "@/components/settings/AgreementNewVersionPage";

export default function NewVersionRoute() {
    const params = useParams<{ id: string }>();
    return <AgreementNewVersionPage agreementId={params.id} />;
}
