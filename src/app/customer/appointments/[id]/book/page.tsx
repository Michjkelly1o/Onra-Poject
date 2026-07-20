"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Appointment "Review and book" (`/customer/appointments/[id]/book`)
// ─────────────────────────────────────────────────────────────────────────────
//
// Currency-based checkout: appointments are paid in AED (not credits). Reuses the
// shared CheckoutCart with an appointment summary (overview + location) and a
// fixed subtotal = the appointment price (0% tax, per design). Apply promo →
// appointment promo pages; Pay now → appointment processing → success.

import { useParams, useRouter } from "next/navigation";
import { Clock, MarkerPin01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { to12h } from "@/lib/customer/dates";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { timeInZoneLabel } from "@/lib/customer/class-time";
import { appointmentDraft } from "@/lib/customer/booking-flow";
import { useAppointment } from "@/lib/customer/appointments-data";
import { CheckoutCart } from "@/components/customer/checkout/CheckoutCart";
import { Button } from "@/components/ui/button";

export default function AppointmentReviewPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const appointment = useAppointment(id);
    const instructors = useAppStore((s) => s.instructors);
    const branches = useAppStore((s) => s.branches);

    const instructor = appointmentDraft.instructorId
        ? instructors.find((i) => i.id === appointmentDraft.instructorId) ?? null
        : null;

    // Reached only with a chosen slot; guard against deep-links / stale draft.
    if (!appointment || appointmentDraft.appointmentId !== id || !appointmentDraft.slotISO || !appointmentDraft.slotTime) {
        return (
            <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-base font-semibold text-[var(--brand-text)]">Appointment unavailable</p>
                <Button
                    variant="secondary-gray"
                    size="sm"
                    className="rounded-full"
                    onClick={() => router.push("/customer/search")}
                >
                    Back to Search
                </Button>
            </div>
        );
    }

    const isPrivate = appointment.type === "private";
    const branch = branches.find((b) => b.id === appointment.branchId) ?? null;
    const { timezone } = useCurrentCustomerContext();
    const addressLine = branch
        ? [branch.address, branch.city, branch.country].filter(Boolean).join(", ")
        : "";
    const fullDate = new Date(`${appointmentDraft.slotISO}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
    });

    const summary = (
        <div className="flex w-full flex-col gap-6">
            {/* Appointment overview */}
            <div className="flex w-full items-center gap-3">
                <div
                    className="size-[82px] shrink-0 overflow-hidden rounded-[10px] border border-[#e4e7ec]"
                    style={!appointment.coverImage ? { backgroundColor: appointment.coverColor } : undefined}
                >
                    {appointment.coverImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={appointment.coverImage} alt="" className="size-full object-cover" />
                    )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-base font-semibold leading-6 text-[var(--brand-text)]">{appointment.name}</p>
                    <p className="text-sm font-normal leading-5 text-[#475467]">{fullDate} at {timeInZoneLabel(appointmentDraft.slotISO ?? "", appointmentDraft.slotTime, branch, timezone)}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="flex items-center gap-1 text-sm font-normal leading-5 text-[#475467]">
                            <Clock className="size-4 shrink-0 text-[#667085]" aria-hidden />
                            {appointment.durationMins} mins
                        </span>
                        {isPrivate && instructor && (
                            <>
                                <span className="text-sm leading-5 text-[#475467]" aria-hidden>
                                    •
                                </span>
                                <span className="flex items-center gap-1.5 text-sm font-normal leading-5 text-[#475467]">
                                    <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f4f7]">
                                        {instructor.imageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={instructor.imageUrl} alt="" className="size-full scale-[1.4] object-cover" />
                                        ) : (
                                            <span className="text-[9px] font-semibold leading-none text-[#667085]">{instructor.initials}</span>
                                        )}
                                    </span>
                                    {instructor.name}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="h-px w-full bg-[#e4e7ec]" />

            {/* Location */}
            <section className="flex w-full flex-col gap-3">
                <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Location</p>
                <div className="flex w-full items-start gap-2">
                    <MarkerPin01 className="mt-0.5 size-4 shrink-0 text-[#667085]" aria-hidden />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="text-sm font-medium leading-5 text-[var(--brand-text)]">{appointment.branchName}</p>
                        {addressLine && (
                            <p className="text-sm font-normal leading-5 text-[#475467]">{addressLine}</p>
                        )}
                    </div>
                </div>
            </section>

            <div className="h-px w-full bg-[#e4e7ec]" />
        </div>
    );

    return (
        <CheckoutCart
            originId={`appointment-${id}`}
            onBack={() => router.back()}
            promoHref={`/customer/appointments/${id}/book/promo`}
            processingHref={`/customer/appointments/${id}/book/processing`}
            summary={summary}
            fixedSubtotal={appointment.price}
            taxRatePct={0}
        />
    );
}
