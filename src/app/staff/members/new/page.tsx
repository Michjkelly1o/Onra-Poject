"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import StaffFormPage from "@/components/staff/StaffFormPage";

function NewStaffInner() {
    const sp = useSearchParams();
    const returnTo = sp.get("returnTo") ?? "/admin/staff";
    return <StaffFormPage mode="create" returnTo={returnTo} />;
}

export default function NewStaffRoute() {
    return <Suspense fallback={null}><NewStaffInner /></Suspense>;
}
