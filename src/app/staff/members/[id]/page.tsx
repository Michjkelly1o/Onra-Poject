"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import StaffDetailPage from "@/components/staff/StaffDetailPage";

function StaffDetailInner() {
    const params = useParams<{ id: string }>();
    const sp = useSearchParams();
    const returnTo = sp.get("returnTo") ?? "/admin/staff";
    return <StaffDetailPage staffId={params.id} returnTo={returnTo} />;
}

export default function StaffDetailRoute() {
    return <Suspense fallback={null}><StaffDetailInner /></Suspense>;
}
