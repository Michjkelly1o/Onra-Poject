"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RoomFormPage } from "@/components/settings/rooms/RoomFormPage";

export default function NewRoomRoute() {
    return (
        <Suspense fallback={null}>
            <NewRoomInner />
        </Suspense>
    );
}

function NewRoomInner() {
    // When the user enters via a branch row's "Add room" action, the parent
    // branch is pre-selected through the `branchId` query param.
    const params = useSearchParams();
    const branchId = params.get("branchId") ?? undefined;
    return <RoomFormPage mode="create" defaultBranchId={branchId} />;
}
