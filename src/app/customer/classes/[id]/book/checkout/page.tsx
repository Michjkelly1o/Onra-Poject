"use client";

// Customer — Checkout / Payment (`/customer/classes/[id]/book/checkout`) — Figma 3160-47304
// Thin wrapper over the shared <CheckoutCart> (booking-origin cart).

import { useParams, useRouter } from "next/navigation";
import { CheckoutCart } from "@/components/customer/checkout/CheckoutCart";

export default function CheckoutPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const base = `/customer/classes/${id}/book/checkout`;
    return (
        <CheckoutCart
            originId={id}
            onBack={() => router.back()}
            promoHref={`${base}/promo`}
            processingHref={`${base}/processing`}
        />
    );
}
