"use client";

// Customer — Products Checkout Cart (`/customer/products/checkout`) — Figma 3298-70846
// Thin wrapper over the shared <CheckoutCart>, products-origin cart.

import { CheckoutCart } from "@/components/customer/checkout/CheckoutCart";
import { useCustomerBack } from "@/lib/customer/use-customer-back";

export default function ProductsCheckoutPage() {
    const base = "/customer/products/checkout";
    const goBack = useCustomerBack("/customer/products");
    return (
        <CheckoutCart
            originId="products"
            onBack={goBack}
            processingHref={`${base}/processing`}
        />
    );
}
