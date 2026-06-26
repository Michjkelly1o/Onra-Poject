"use client";

// Customer — Booking payment processing — Figma 3160-46725. Shared loader.

import { useParams } from "next/navigation";
import { PaymentProcessing } from "@/components/customer/checkout/PaymentProcessing";

export default function PaymentProcessingPage() {
    const { id } = useParams<{ id: string }>();
    return <PaymentProcessing originId={id} successHref={`/customer/classes/${id}/book/checkout/success`} />;
}
