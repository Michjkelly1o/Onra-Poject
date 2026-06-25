"use client";

// Customer — Booking payment success — Figma 3160-47033. Shared <PaymentSuccess>;
// footer returns to the now-eligible booking confirmation.

import { useParams, useRouter } from "next/navigation";
import { PaymentSuccess } from "@/components/customer/checkout/PaymentSuccess";
import { Button } from "@/components/ui/button";

export default function PaymentSuccessPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    return (
        <PaymentSuccess
            footer={
                <Button
                    variant="primary"
                    size="xl"
                    className="w-full rounded-full"
                    onClick={() => router.replace(`/customer/classes/${id}/book`)}
                >
                    Continue booking
                </Button>
            }
        />
    );
}
