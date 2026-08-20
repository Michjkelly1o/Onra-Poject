"use client";

// Root-level full-page route (no admin layout) — same convention as
// /staff/pay-rate/*, /products/*, /customers/* etc.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PayrollRunPage from "@/components/staff/PayrollRunPage";

function RunInner() {
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/staff/payroll";
    return <PayrollRunPage returnTo={returnTo} />;
}

export default function RunPayrollRoute() {
    return (
        <Suspense fallback={null}>
            <RunInner />
        </Suspense>
    );
}
