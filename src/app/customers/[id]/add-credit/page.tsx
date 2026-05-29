"use client";

// Add complimentary credit — full-page screen. Thin route wrapper around
// AddComplimentaryCreditPage. Suspense covers the component's useSearchParams.

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { AddComplimentaryCreditPage } from "@/components/customers/AddComplimentaryCreditPage";

export default function AddCreditPage() {
    const { id } = useParams<{ id: string }>();
    return (
        <Suspense fallback={null}>
            <AddComplimentaryCreditPage customerId={id} />
        </Suspense>
    );
}
