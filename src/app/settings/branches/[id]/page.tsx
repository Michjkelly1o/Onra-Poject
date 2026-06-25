"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BranchDetailPage } from "@/components/settings/branches/BranchDetailPage";

function BranchDetailInner() {
    const params = useParams();
    const id = String(params.id);
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/settings";
    return <BranchDetailPage branchId={id} returnTo={returnTo} />;
}

export default function BranchDetailRoute() {
    return (
        <Suspense fallback={null}>
            <BranchDetailInner />
        </Suspense>
    );
}
