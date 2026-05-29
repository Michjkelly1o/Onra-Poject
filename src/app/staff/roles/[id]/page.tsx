"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import RoleDetailPage from "@/components/staff/RoleDetailPage";

function RoleDetailInner() {
    const params = useParams<{ id: string }>();
    const sp = useSearchParams();
    const returnTo = sp.get("returnTo") ?? "/admin/staff";
    return <RoleDetailPage roleId={params.id} returnTo={returnTo} />;
}

export default function RoleDetailRoute() {
    return <Suspense fallback={null}><RoleDetailInner /></Suspense>;
}
