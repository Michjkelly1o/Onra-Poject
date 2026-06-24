"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Appointments → Detail (route)
// ─────────────────────────────────────────────────────────────────────────────
//
// Top-level route — renders full-screen with no admin chrome. Mirrors the
// /services/[id] route pattern. Reads the dynamic [id] segment and hands
// it to the shared AppointmentDetailPage component.

import { useParams } from "next/navigation";
import { AppointmentDetailPage } from "@/components/services/AppointmentDetailPage";

export default function AppointmentDetailRoute() {
    const params = useParams();
    const id = String(params.id);
    return <AppointmentDetailPage appointmentId={id} />;
}
