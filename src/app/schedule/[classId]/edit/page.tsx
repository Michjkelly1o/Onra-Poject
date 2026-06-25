"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ScheduleFormPage } from "@/components/schedule/ScheduleFormPage";

function EditClassInner() {
    const params = useParams();
    const classId = String(params.classId);
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/schedule";
    return <ScheduleFormPage editingId={classId} returnTo={returnTo} />;
}

export default function EditClassPage() {
    return (
        <Suspense fallback={null}>
            <EditClassInner />
        </Suspense>
    );
}
