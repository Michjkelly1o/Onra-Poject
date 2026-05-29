"use client";

// Root-level full-page route (no admin layout) — pairs with /compensation/run.

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import PayrollInstructorDetailPage from "@/components/staff/PayrollInstructorDetailPage";

function InstructorInner() {
    const params = useParams<{ instructorId: string }>();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/compensation";
    return <PayrollInstructorDetailPage instructorId={params.instructorId} returnTo={returnTo} />;
}

export default function InstructorEarningsRoute() {
    return (
        <Suspense fallback={null}>
            <InstructorInner />
        </Suspense>
    );
}
