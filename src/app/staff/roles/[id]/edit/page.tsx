"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import RoleFormPage from "@/components/staff/RoleFormPage";

function EditRoleInner() {
    const params = useParams<{ id: string }>();
    const sp = useSearchParams();
    const returnTo = sp.get("returnTo") ?? "/admin/staff";
    return <RoleFormPage mode="edit_details" roleId={params.id} returnTo={returnTo} />;
}

export default function EditRoleRoute() {
    return <Suspense fallback={null}><EditRoleInner /></Suspense>;
}
