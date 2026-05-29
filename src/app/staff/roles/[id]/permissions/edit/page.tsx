"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import RoleFormPage from "@/components/staff/RoleFormPage";

function EditPermissionsInner() {
    const params = useParams<{ id: string }>();
    const sp = useSearchParams();
    const returnTo = sp.get("returnTo") ?? "/admin/staff";
    return <RoleFormPage mode="edit_permissions" roleId={params.id} returnTo={returnTo} />;
}

export default function EditPermissionsRoute() {
    return <Suspense fallback={null}><EditPermissionsInner /></Suspense>;
}
