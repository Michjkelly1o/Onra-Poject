"use client";

import { useParams } from "next/navigation";
import { BranchFormPage } from "@/components/settings/branches/BranchFormPage";

export default function EditBranchRoute() {
    const params = useParams();
    const id = String(params.id);
    return <BranchFormPage mode="edit" branchId={id} />;
}
