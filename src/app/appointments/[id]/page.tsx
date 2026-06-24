"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Appointments → Detail (route)
// ─────────────────────────────────────────────────────────────────────────────
//
// Top-level route — renders full-screen with no admin chrome. Mirrors the
// /services/[id] route pattern. Reads the dynamic [id] segment and hands
// it to the shared AppointmentDetailPage component.

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AppointmentDetailPage } from "@/components/services/AppointmentDetailPage";

function AppointmentDetailRouteInner() {
    const params = useParams();
    const id = String(params.id);
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/schedule";
    return <AppointmentDetailPage appointmentId={id} returnTo={returnTo} />;
}

export default function AppointmentDetailRoute() {
    return (
        <Suspense fallback={null}>
            <AppointmentDetailRouteInner />
        </Suspense>
    );
}
