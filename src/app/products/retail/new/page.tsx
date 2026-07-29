"use client";

// Create-retail-product route — thin wrapper around the shared
// RetailProductFormPage in create mode. Same component powers the edit route
// with mode="edit" + productId.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RetailProductFormPage } from "@/components/products/RetailProductFormPage";

function CreateRetailProductRouteInner() {
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/products/retail";
    return <RetailProductFormPage mode="create" returnTo={returnTo} />;
}

export default function CreateRetailProductRoute() {
    return (
        <Suspense fallback={null}>
            <CreateRetailProductRouteInner />
        </Suspense>
    );
}
