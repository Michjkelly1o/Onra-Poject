"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BlockedTimeFormPage } from "@/components/staff/BlockedTimeFormPage";

function EditBlockedTimeInner() {
    const params = useParams<{ id: string }>();
    const sp = useSearchParams();
    const returnTo = sp.get("returnTo") ?? "/admin/staff";
    return <BlockedTimeFormPage mode="edit" blockedTimeId={params.id} returnTo={returnTo} />;
}

export default function EditBlockedTimeRoute() {
    return <Suspense fallback={null}><EditBlockedTimeInner /></Suspense>;
}
