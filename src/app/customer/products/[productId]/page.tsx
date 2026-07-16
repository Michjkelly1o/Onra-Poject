"use client";

// Customer — Product Details (`/customer/products/[productId]`). Thin wrapper over
// the shared <ProductDetailScreen>; returns to the Products catalog.

import { useParams, useRouter } from "next/navigation";
import { ProductDetailScreen } from "@/components/customer/products/ProductDetailScreen";
import { useCustomerBack } from "@/lib/customer/use-customer-back";

export default function ProductDetailPage() {
    const router = useRouter();
    const { productId } = useParams<{ productId: string }>();
    const goBack = useCustomerBack("/customer/products");
    return (
        <ProductDetailScreen
            productId={productId}
            originId="products"
            onBack={goBack}
            afterAdd={() => router.push("/customer/products")}
        />
    );
}
