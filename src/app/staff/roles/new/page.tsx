"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RoleFormPage from "@/components/staff/RoleFormPage";

function NewRoleInner() {
    const sp = useSearchParams();
    const returnTo = sp.get("returnTo") ?? "/admin/staff";
    return <RoleFormPage mode="create" returnTo={returnTo} />;
}

export default function NewRoleRoute() {
    return <Suspense fallback={null}><NewRoleInner /></Suspense>;
}
