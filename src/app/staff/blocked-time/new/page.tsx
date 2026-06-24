"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BlockedTimeFormPage } from "@/components/staff/BlockedTimeFormPage";

function NewBlockedTimeInner() {
    const sp = useSearchParams();
    const returnTo = sp.get("returnTo") ?? "/admin/staff";
    return <BlockedTimeFormPage mode="create" returnTo={returnTo} />;
}

export default function NewBlockedTimeRoute() {
    return <Suspense fallback={null}><NewBlockedTimeInner /></Suspense>;
}
