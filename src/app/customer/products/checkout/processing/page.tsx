"use client";

// Customer — Products payment processing — Figma 3298-70428. Shared loader.

import { PaymentProcessing } from "@/components/customer/checkout/PaymentProcessing";

export default function ProductsProcessingPage() {
    return <PaymentProcessing originId="products" successHref="/customer/products/checkout/success" />;
}
