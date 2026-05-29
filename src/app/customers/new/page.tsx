"use client";

// Add customer — full-page screen. Thin route wrapper around the shared
// CustomerFormPage (also used by /customers/[id]/edit). Suspense boundary is
// required because CustomerFormPage reads `?returnTo=` via useSearchParams.

import { Suspense } from "react";
import { CustomerFormPage } from "@/components/customers/CustomerFormPage";

export default function NewCustomerPage() {
    return (
        <Suspense fallback={null}>
            <CustomerFormPage />
        </Suspense>
    );
}
