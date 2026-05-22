"use client";

// Create-product route — thin wrapper around the shared ProductFormPage in
// create mode. The same component powers /products/[id]/edit with mode="edit"
// and prefilled initial state.

import { ProductFormPage } from "@/components/products/ProductFormPage";

export default function CreateProductRoute() {
    return <ProductFormPage mode="create" />;
}
