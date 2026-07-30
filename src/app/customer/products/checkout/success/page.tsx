"use client";

// Customer — Products Payment Success (`/customer/products/checkout/success`) — Figma 3298-70578
// Shared <PaymentSuccess>; a single, purchase-type-agnostic action —
// "View purchase history" — routes to the customer's Payment history so it reads
// consistently for memberships, packages, gift cards, and any future product.

import { useRouter } from "next/navigation";
import { PaymentSuccess } from "@/components/customer/checkout/PaymentSuccess";
import { Button } from "@/components/ui/button";

export default function ProductsSuccessPage() {
    const router = useRouter();

    return (
        <PaymentSuccess
            onClose={() => router.replace("/customer/products")}
            footer={
                <Button
                    variant="primary"
                    size="xl"
                    className="w-full rounded-full"
                    onClick={() =>
                        // ?back= → Back leaves the finished purchase flow and returns
                        // to Profile, never to checkout/processing.
                        router.replace("/customer/profile/payment-history?back=/customer/profile")
                    }
                >
                    View purchase history
                </Button>
            }
        />
    );
}
