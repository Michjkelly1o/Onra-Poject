"use client";

// Customer — Products Checkout Cart (`/customer/products/checkout`) — Figma 3298-70846
// Thin wrapper over the shared <CheckoutCart>, products-origin cart.

import { useRouter } from "next/navigation";
import { CheckoutCart } from "@/components/customer/checkout/CheckoutCart";

export default function ProductsCheckoutPage() {
    const router = useRouter();
    const base = "/customer/products/checkout";
    return (
        <CheckoutCart
            originId="products"
            onBack={() => router.push("/customer/products")}
            promoHref={`${base}/promo`}
            processingHref={`${base}/processing`}
        />
    );
}
