"use client";

// Edit-retail-product route — same RetailProductFormPage in edit mode.

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { RetailProductFormPage } from "@/components/products/RetailProductFormPage";

function EditRetailProductRouteInner() {
    const params = useParams();
    const searchParams = useSearchParams();
    const productId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
    const returnTo = searchParams.get("returnTo") ?? `/products/retail/${productId}`;
    return <RetailProductFormPage mode="edit" productId={productId} returnTo={returnTo} />;
}

export default function EditRetailProductRoute() {
    return (
        <Suspense fallback={null}>
            <EditRetailProductRouteInner />
        </Suspense>
    );
}
