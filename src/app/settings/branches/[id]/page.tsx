"use client";

import { useParams } from "next/navigation";
import { BranchDetailPage } from "@/components/settings/branches/BranchDetailPage";

export default function BranchDetailRoute() {
    const params = useParams();
    const id = String(params.id);
    return <BranchDetailPage branchId={id} />;
}
