"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Services → New (route)
// ─────────────────────────────────────────────────────────────────────────────
//
// Thin route file. The 3-step create form chrome lives in the shared
// ServiceFormPage so /[id]/edit can render the same UI with prefilled
// state via `mode="edit"`.

import { ServiceFormPage } from "@/components/services/ServiceFormPage";

export default function NewServiceRoute() {
    return <ServiceFormPage mode="create" />;
}
