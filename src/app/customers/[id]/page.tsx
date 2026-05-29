"use client";

// Customer detail — full-page screen. Thin route wrapper around
// CustomerDetailPage (side panel + tabs; the Plan tab is fully built).

import { useParams } from "next/navigation";
import { CustomerDetailPage } from "@/components/customers/CustomerDetailPage";

export default function CustomerPage() {
    const { id } = useParams<{ id: string }>();
    return <CustomerDetailPage customerId={id} />;
}
