"use client";

import { useParams } from "next/navigation";
import { ScheduleFormPage } from "@/components/schedule/ScheduleFormPage";

export default function EditClassPage() {
    const params = useParams();
    const classId = String(params.classId);
    return <ScheduleFormPage editingId={classId} />;
}
