"use client";

// Create-agreement route — thin wrapper around the shared AgreementFormPage
// in create mode. /settings/agreements/[id]/edit reuses the same component
// in edit mode with prefilled initial state (and skips Step 3).

import { AgreementFormPage } from "@/components/settings/AgreementFormPage";

export default function CreateAgreementRoute() {
    return <AgreementFormPage mode="create" />;
}
