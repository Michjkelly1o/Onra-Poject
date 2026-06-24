"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import ShiftDetailPage from "@/components/staff/ShiftDetailPage";

function ShiftDetailInner() {
    const params = useParams<{ id: string }>();
    const sp = useSearchParams();
    const returnTo = sp.get("returnTo") ?? "/admin/staff";
    return <ShiftDetailPage shiftId={params.id} returnTo={returnTo} />;
}

export default function ShiftDetailRoute() {
    return <Suspense fallback={null}><ShiftDetailInner /></Suspense>;
}
