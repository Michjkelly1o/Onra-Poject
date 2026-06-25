"use client";

// Customer — Products Payment Success (`/customer/products/checkout/success`) — Figma 3298-70578
// Shared <PaymentSuccess>; footer routes into Profile — "View plan" (membership/
// package) and/or "View gift card" — based on what was purchased.

import { useRouter } from "next/navigation";
import { lastOrder } from "@/lib/customer/purchase";
import { PaymentSuccess } from "@/components/customer/checkout/PaymentSuccess";
import { Button } from "@/components/ui/button";

export default function ProductsSuccessPage() {
    const router = useRouter();
    const kinds = lastOrder.value?.kinds ?? [];
    const hasPlan = kinds.includes("membership") || kinds.includes("package");
    const hasGiftCard = kinds.includes("gift_card");

    return (
        <PaymentSuccess
            onClose={() => router.replace("/customer/products")}
            footer={
                <>
                    {hasPlan && (
                        <Button
                            variant="primary"
                            size="xl"
                            className="w-full rounded-full"
                            onClick={() => router.replace("/customer/profile")}
                        >
                            View plan
                        </Button>
                    )}
                    {hasGiftCard && (
                        <Button
                            variant={hasPlan ? "secondary" : "primary"}
                            size="xl"
                            className="w-full rounded-full"
                            onClick={() => router.replace("/customer/profile")}
                        >
                            View gift card
                        </Button>
                    )}
                    {!hasPlan && !hasGiftCard && (
                        <Button
                            variant="primary"
                            size="xl"
                            className="w-full rounded-full"
                            onClick={() => router.replace("/customer/products")}
                        >
                            Done
                        </Button>
                    )}
                </>
            }
        />
    );
}
