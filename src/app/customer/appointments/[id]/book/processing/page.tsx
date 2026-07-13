"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Appointment processing (`/customer/appointments/[id]/book/processing`)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 4212-39540. Writes the (UI-only) appointment booking once, then plays the
// same transient 3-step loader as the class flow and routes to Success carrying
// the new booking id (so Success → "View bookings" opens its detail).

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { appointmentDraft } from "@/lib/customer/booking-flow";
import { useAppointment } from "@/lib/customer/appointments-data";
import { addAppointmentBooking } from "@/lib/customer/appointment-bookings";
import { addCustomerNotification } from "@/lib/customer/notifications-feed";
import { to12h } from "@/lib/customer/dates";

const STEPS = ["Checking availability", "Securing your appointment", "Confirming your booking"];
const STEP_MS = 900;

function StepLine({ text, variant }: { text: string; variant: "done" | "active" | "next" }) {
    if (variant === "active") {
        return <p className="text-xl font-semibold leading-[30px] text-[var(--brand-primary)]">{text}</p>;
    }
    return (
        <p className={`text-base font-semibold leading-6 text-[#344054] ${variant === "done" ? "opacity-30" : "opacity-10"}`}>
            {text || " "}
        </p>
    );
}

export default function AppointmentProcessingPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const appointment = useAppointment(id);
    const instructors = useAppStore((s) => s.instructors);
    const branches = useAppStore((s) => s.branches);
    const [step, setStep] = useState(0);
    const wroteRef = useRef(false);

    useEffect(() => {
        let bookingId = "";
        // The checkout passes the chosen method as `?method=<label>` — capture it on
        // the booking so the cancel/refund flow can show "Refund via <method>".
        const paymentMethod =
            new URLSearchParams(window.location.search).get("method") ?? undefined;
        // Record the booking once (synchronous), then sequence the steps over it.
        if (!wroteRef.current && appointment && appointmentDraft.slotISO && appointmentDraft.slotTime) {
            wroteRef.current = true;
            const inst = appointmentDraft.instructorId
                ? instructors.find((i) => i.id === appointmentDraft.instructorId) ?? null
                : null;
            const branch = branches.find((b) => b.id === appointment.branchId) ?? null;
            bookingId = addAppointmentBooking({
                appointmentId: appointment.id,
                name: appointment.name,
                type: appointment.type,
                description: appointment.description,
                category: appointment.category,
                durationMins: appointment.durationMins,
                capacity: appointment.capacity,
                price: appointment.price,
                coverImage: appointment.coverImage,
                coverColor: appointment.coverColor,
                branchName: appointment.branchName,
                branchAddress: branch ? [branch.address, branch.city, branch.country].filter(Boolean).join(", ") : undefined,
                slotISO: appointmentDraft.slotISO,
                slotTime: appointmentDraft.slotTime,
                instructorId: appointmentDraft.instructorId,
                instructorName: inst?.name,
                instructorImageUrl: inst?.imageUrl,
                instructorInitials: inst?.initials,
                paymentMethod,
            });
            const when = `${new Date(`${appointmentDraft.slotISO}T00:00:00`).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
            })} at ${to12h(appointmentDraft.slotTime)}`;
            addCustomerNotification({
                tab: "bookings",
                event: "appointment_booked",
                title: "Appointment booked",
                message: `You're all set for ${appointment.name} on ${when}.`,
                relatedType: "appointment",
                relatedId: bookingId,
            });
        }
        const t1 = setTimeout(() => setStep(1), STEP_MS);
        const t2 = setTimeout(() => setStep(2), STEP_MS * 2);
        const t3 = setTimeout(
            () => router.replace(`/customer/appointments/${id}/book/success${bookingId ? `?booking=${bookingId}` : ""}`),
            STEP_MS * 3,
        );
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="flex min-h-full flex-col items-center justify-center gap-12 px-4">
            <div className="flex items-center gap-1.5" aria-label="Processing">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="size-2 animate-bounce rounded-full bg-[var(--brand-primary)]"
                        style={{ animationDelay: `${i * 0.15}s` }}
                    />
                ))}
            </div>

            <div className="flex w-[343px] max-w-full flex-col items-center gap-4 text-center">
                <StepLine text={step > 0 ? STEPS[step - 1] : ""} variant={step > 0 ? "done" : "next"} />
                <StepLine text={STEPS[step]} variant="active" />
                <StepLine text={STEPS[step + 1] ?? ""} variant="next" />
                <StepLine text={STEPS[step + 2] ?? ""} variant="next" />
            </div>
        </div>
    );
}
