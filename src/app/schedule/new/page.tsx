"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ScheduleFormPage } from "@/components/schedule/ScheduleFormPage";

function ScheduleNewInner() {
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/schedule";
    return <ScheduleFormPage returnTo={returnTo} />;
}

export default function ScheduleNewPage() {
    return (
        <Suspense fallback={null}>
            <ScheduleNewInner />
        </Suspense>
    );
}
