"use client";

// Edit customer — full-page screen. Same form as /customers/new, pre-filled
// with the selected customer (Brief §3). Thin route wrapper around the shared
// CustomerFormPage. Suspense boundary covers CustomerFormPage's useSearchParams.

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { CustomerFormPage } from "@/components/customers/CustomerFormPage";

export default function EditCustomerPage() {
    const { id } = useParams<{ id: string }>();
    return (
        <Suspense fallback={null}>
            <CustomerFormPage editingId={id} />
        </Suspense>
    );
}
