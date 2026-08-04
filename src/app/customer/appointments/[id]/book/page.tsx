"use client";

// Customer — Appointment "Review and book" (`/customer/appointments/[id]/book`).
// Thin wrapper over the shared <AppointmentCheckoutContent> (also hosted as a
// sheet from Search). Back returns to the previous screen.

import { useParams, useRouter } from "next/navigation";
import { AppointmentCheckoutContent } from "@/components/customer/appointments/AppointmentCheckoutContent";

export default function AppointmentReviewPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    return <AppointmentCheckoutContent appointmentId={id} variant="page" onBack={() => router.back()} />;
}
