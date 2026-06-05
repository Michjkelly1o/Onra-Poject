"use client";

// Edit-agreement route — thin wrapper around the shared AgreementFormPage in
// edit mode. The wizard drops Step 3 (content) — agreement versions are
// managed by the Phase 3 "Add new version" flow, not by the basic edit form.

import { useParams } from "next/navigation";
import { AgreementFormPage } from "@/components/settings/AgreementFormPage";

export default function EditAgreementRoute() {
    const params = useParams<{ id: string }>();
    return <AgreementFormPage mode="edit" agreementId={params.id} />;
}
