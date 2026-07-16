"use client";

// Customer — Select Plan → product detail (`/customer/classes/[id]/book/plans/[planId]`).
// The SAME full-page <ProductDetailScreen> as the Products module (no bottom sheet):
// back returns to the plan list; a membership goes straight to checkout, a package
// returns to the list so more can be added before checking out.

import { useParams, useRouter } from "next/navigation";
import { ProductDetailScreen } from "@/components/customer/products/ProductDetailScreen";
import { useCustomerBack } from "@/lib/customer/use-customer-back";

export default function BookPlanDetailPage() {
    const router = useRouter();
    const { id, planId } = useParams<{ id: string; planId: string }>();
    const plansHref = `/customer/classes/${id}/book/plans`;
    const goBack = useCustomerBack(plansHref);
    return (
        <ProductDetailScreen
            productId={planId}
            originId={id}
            onBack={goBack}
            afterAdd={(kind) =>
                router.push(kind === "membership" ? `/customer/classes/${id}/book/checkout` : plansHref)
            }
        />
    );
}
