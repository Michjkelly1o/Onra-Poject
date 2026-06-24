"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ShiftFormPage } from "@/components/staff/ShiftFormPage";

export default function EditShiftRoute() {
    const params = useParams();
    const sp = useSearchParams();
    const id = String(params.id);
    const returnTo = sp.get("returnTo") ?? "/admin/staff";
    return <ShiftFormPage mode="edit" shiftId={id} returnTo={returnTo} />;
}
