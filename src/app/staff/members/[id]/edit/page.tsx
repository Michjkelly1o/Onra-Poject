"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import StaffFormPage from "@/components/staff/StaffFormPage";

function EditStaffInner() {
    const params = useParams<{ id: string }>();
    const sp = useSearchParams();
    const returnTo = sp.get("returnTo") ?? "/admin/staff";
    return <StaffFormPage mode="edit" staffId={params.id} returnTo={returnTo} />;
}

export default function EditStaffRoute() {
    return <Suspense fallback={null}><EditStaffInner /></Suspense>;
}
