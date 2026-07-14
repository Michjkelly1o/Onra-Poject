"use client";

// Customer — Product Details (`/customer/products/[productId]`). Thin wrapper over
// the shared <ProductDetailScreen>; returns to the Products catalog.

import { useParams, useRouter } from "next/navigation";
import { ProductDetailScreen } from "@/components/customer/products/ProductDetailScreen";

export default function ProductDetailPage() {
    const router = useRouter();
    const { productId } = useParams<{ productId: string }>();
    return (
        <ProductDetailScreen
            productId={productId}
            originId="products"
            onBack={() => router.push("/customer/products")}
            afterAdd={() => router.push("/customer/products")}
        />
    );
}
