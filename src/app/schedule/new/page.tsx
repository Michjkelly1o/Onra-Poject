"use client";

import { Suspense } from "react";
import { ScheduleFormPage } from "@/components/schedule/ScheduleFormPage";

export default function ScheduleNewPage() {
    return (
        <Suspense fallback={null}>
            <ScheduleFormPage />
        </Suspense>
    );
}
