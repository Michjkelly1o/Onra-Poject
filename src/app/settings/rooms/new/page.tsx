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
    // When the user enters via a branch row's "Add room" action OR via the
    // schedule form's location dropdown, the parent branch is pre-selected
    // through the `branchId` query param. `returnTo` lets the entry point
    // (e.g. the schedule form) tell the form where to redirect after
    // Save / Cancel so the admin lands back where they came from.
    const params   = useSearchParams();
    const branchId = params.get("branchId") ?? undefined;
    const returnTo = params.get("returnTo") ?? undefined;
    return <RoomFormPage mode="create" defaultBranchId={branchId} returnTo={returnTo} />;
}
