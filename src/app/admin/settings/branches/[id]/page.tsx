"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Business & Locations → Branch detail (admin route)
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors `/admin/staff/[id]` chrome conventions — the page component lives
// at `src/components/settings/branches/BranchDetailPage.tsx`.

import { useParams } from "next/navigation";
import { BranchDetailPage } from "@/components/settings/branches/BranchDetailPage";

export default function AdminBranchDetailRoute() {
    const params = useParams();
    const id = String(params.id);
    return <BranchDetailPage branchId={id} />;
}
