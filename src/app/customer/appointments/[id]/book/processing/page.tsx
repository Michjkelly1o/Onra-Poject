"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Appointment processing (`/customer/appointments/[id]/book/processing`)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 4212-39540. Writes the (UI-only) appointment booking once, then plays the
// same transient 3-step loader as the class flow and routes to Success carrying
// the new booking id (kept for reference; Success → "View bookings" now
// always opens the Upcoming bookings list, not this booking's detail).

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore, walletBalanceAed } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { purchaseCart } from "@/lib/customer/purchase";
import { appointmentDraft } from "@/lib/customer/booking-flow";
import { useAppointment } from "@/lib/customer/appointments-data";
import { addAppointmentBooking } from "@/lib/customer/appointment-bookings";
import { useFlexibleInstructorsForSlot } from "@/lib/customer/slot-availability";
import { addCustomerNotification } from "@/lib/customer/notifications-feed";
import { to12h } from "@/lib/customer/dates";

const STEPS = ["Checking availability", "Securing your appointment", "Confirming your booking"];
const STEP_MS = 900;

function StepLine({ text, variant }: { text: string; variant: "done" | "active" | "next" }) {
    if (variant === "active") {
        return <p className="text-xl font-semibold leading-[30px] text-[var(--brand-primary)] font-heading">{text}</p>;
    }
    return (
        <p className={`text-base font-semibold font-heading leading-6 text-[var(--colors-text-secondary)] ${variant === "done" ? "opacity-30" : "opacity-10"}`}>
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
    const services = useAppStore((s) => s.services);
    const member = useCurrentCustomer();
    const walletTxns = useAppStore((s) => s.walletTransactions);
    // Route the appointment sale through the shared checkout path — it creates
    // BOTH the shared appointment (admin schedule + Appointment Details, Flexible
    // badge + Reassign) AND a service `customer_transaction` (the invoice that
    // shows in Payment history), keeping admin + customer fully in sync.
    const applyPurchase = useAppStore((s) => s.applyPurchase);
    // "Preference: Flexible" — the qualified instructors genuinely free for the
    // chosen slot. We auto-assign one at write time (below).
    const flexibleInstructorIds = useFlexibleInstructorsForSlot(
        appointment,
        appointmentDraft.slotISO,
        appointmentDraft.slotTime,
    );
    const [step, setStep] = useState(0);
    const wroteRef = useRef(false);

    useEffect(() => {
        let bookingId = "";
        // The checkout passes the chosen method as `?method=<label>` — capture it on
        // the booking so the cancel/refund flow can show "Refund via <method>".
        const paymentMethod =
            new URLSearchParams(window.location.search).get("method") ?? undefined;
        const isFlexible = appointmentDraft.flexible;
        // Never book a flexible slot with no available instructor. The slot was
        // only offered because ≥1 qualified instructor was free, but availability
        // can shift between slot-pick and confirm (another booking on that slot,
        // cross-tab). If the pool is now empty, abort the write and send the
        // customer back to re-pick a still-available slot rather than record an
        // instructor-less booking. Guards the "never book without an instructor"
        // rule against the concurrency edge.
        if (isFlexible && flexibleInstructorIds.length === 0) {
            router.replace(`/customer/appointments/${id}/slot`);
            return;
        }
        // Record the booking once (synchronous), then sequence the steps over it.
        if (!wroteRef.current && appointment && appointmentDraft.slotISO && appointmentDraft.slotTime) {
            wroteRef.current = true;
            // Flexible → auto-assign one of the qualified instructors free for
            // this slot (first available; the slot was only offered because ≥1
            // is free). Otherwise use the customer's chosen instructor.
            const assignedInstructorId = isFlexible
                ? (flexibleInstructorIds[0] ?? null)
                : appointmentDraft.instructorId;
            const inst = assignedInstructorId
                ? instructors.find((i) => i.id === assignedInstructorId) ?? null
                : null;
            const branch = branches.find((b) => b.id === appointment.branchId) ?? null;
            const service = services.find((sv) => sv.id === appointment.id);
            const productType = service?.type === "recovery" ? "recovery" : "private";
            const openSession = service?.openSession ?? appointment.type === "open";
            // Account Credit applied toward this appointment, capped at the
            // balance + the price. applyPurchase debits the wallet in the same
            // tick, so there is no separate debit below.
            const accountCreditApplied =
                purchaseCart.redeemAccountCredit && member
                    ? Math.min(walletBalanceAed(walletTxns, member.id), appointment.price)
                    : 0;
            // Commit the sale through applyPurchase (the SAME path admin POS uses)
            // — it creates the shared appointment + the service transaction. We
            // diff the shared appointmentBookings to recover the appointment id
            // it created and link it onto the local booking (adminAppointmentId),
            // so admin reassign/cancel reflect back and the customer cancel
            // cascades to admin.
            const bookingIdsBefore = new Set(useAppStore.getState().appointmentBookings.map((b) => b.id));
            if (member) {
                applyPurchase(
                    member.id,
                    [{
                        productId: appointment.id,
                        productType,
                        name: appointment.name,
                        unitPrice: appointment.price,
                        quantity: 1,
                        appointment: {
                            dateISO: appointmentDraft.slotISO,
                            startTime: appointmentDraft.slotTime,
                            durationMin: appointment.durationMins,
                            instructorId: assignedInstructorId,
                            instructorName: inst?.name,
                            flexible: isFlexible,
                            openSession,
                        },
                    }],
                    "customer_portal",
                    undefined,
                    accountCreditApplied > 0 ? accountCreditApplied : undefined,
                );
            }
            const adminAppointmentId = member
                ? useAppStore
                    .getState()
                    .appointmentBookings.find((b) => !bookingIdsBefore.has(b.id) && b.customerId === member.id)
                    ?.appointmentId
                : undefined;
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
                instructorId: assignedInstructorId,
                flexible: isFlexible,
                instructorName: inst?.name,
                instructorImageUrl: inst?.imageUrl,
                instructorInitials: inst?.initials,
                adminAppointmentId,
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
            // Account Credit was already applied + debited inside applyPurchase
            // above (5th arg) — just clear the checkout toggle.
            purchaseCart.redeemAccountCredit = false;
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
