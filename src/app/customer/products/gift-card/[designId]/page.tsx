"use client";

// Customer — Gift Card Information (`/customer/products/gift-card/[designId]`).
// Thin wrapper over the shared <GiftCardInfoContent> (also hosted as a sheet from
// the Products catalog). Back returns to the catalog.

import { useParams } from "next/navigation";
import { useCustomerBack } from "@/lib/customer/use-customer-back";
import { GiftCardInfoContent } from "@/components/customer/products/GiftCardInfoContent";

export default function GiftCardInfoPage() {
    const { designId } = useParams<{ designId: string }>();
    const goBack = useCustomerBack("/customer/products");
    return <GiftCardInfoContent designId={designId} variant="page" onDone={goBack} />;
}
