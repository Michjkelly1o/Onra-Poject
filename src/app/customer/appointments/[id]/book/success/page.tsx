"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Appointment success (`/customer/appointments/[id]/book/success`) — Figma 4212-39489
// ─────────────────────────────────────────────────────────────────────────────
//
// Reuses the class success overview, worded for appointments: ringed filled
// check + "Your booking is confirmed!" + a summary card (Booked badge, cover,
// name, chosen slot, duration · — Private — instructor, branch). X → Search,
// "View bookings" → Bookings. Appointments are UI-only (no store write).

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Check, CheckCircle, Clock, MarkerPin01, XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { to12h } from "@/lib/customer/dates";
import { appointmentDraft } from "@/lib/customer/booking-flow";
import { useAppointment } from "@/lib/customer/appointments-data";
import { useMainScrollable } from "@/lib/customer/use-scrollable";
import { Button } from "@/components/ui/button";

export default function AppointmentSuccessPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const bookingId = useSearchParams().get("booking");
    const appointment = useAppointment(id);
    const instructors = useAppStore((s) => s.instructors);
    const scrollable = useMainScrollable();

    const instructor = appointmentDraft.instructorId
        ? instructors.find((i) => i.id === appointmentDraft.instructorId) ?? null
        : null;

    if (!appointment) {
        return (
            <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-base font-semibold text-[var(--brand-text)]">Booking complete</p>
                <Button variant="secondary-gray" size="sm" className="rounded-full" onClick={() => router.push("/customer/bookings")}>
                    View bookings
                </Button>
            </div>
        );
    }

    const isPrivate = appointment.type === "private";
    const slotISO = appointmentDraft.slotISO;
    const slotTime = appointmentDraft.slotTime;
    const fullDate = slotISO
        ? new Date(`${slotISO}T00:00:00`).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "short",
              year: "numeric",
          })
        : "";

    return (
        <div className="flex min-h-full flex-col">
            <header className="sticky top-0 z-20 flex w-full items-center justify-end px-4 py-3">
                <button
                    type="button"
                    onClick={() => router.push("/customer/search")}
                    aria-label="Close"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <XClose className="size-5 text-[#344054]" aria-hidden />
                </button>
            </header>

            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-6 pt-2">
                {/* Ringed filled check */}
                <div className="relative flex size-12 shrink-0 items-center justify-center">
                    <span className="absolute -inset-[7px] rounded-full border-2 border-[var(--brand-primary)] opacity-30" aria-hidden />
                    <span className="absolute -inset-[15px] rounded-full border-2 border-[var(--brand-primary)] opacity-10" aria-hidden />
                    <span className="flex size-12 items-center justify-center rounded-full bg-[var(--brand-primary)]">
                        <Check className="size-6 text-white" strokeWidth={3} aria-hidden />
                    </span>
                </div>

                <p className="text-center text-xl font-semibold leading-[30px] text-[var(--brand-text)]">
                    Your booking is confirmed!
                </p>

                {/* Summary card */}
                <div className="flex w-full flex-col gap-4 rounded-[20px] border border-[#e4e7ec] bg-white p-4 shadow-[0px_24px_48px_-12px_rgba(16,24,40,0.12)]">
                    <div
                        className="relative h-[200px] w-full overflow-hidden rounded-2xl"
                        style={!appointment.coverImage ? { backgroundColor: appointment.coverColor } : undefined}
                    >
                        {appointment.coverImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={appointment.coverImage} alt="" className="absolute inset-0 size-full object-cover" />
                        )}
                        <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] px-2 py-0.5 text-xs font-medium leading-[18px] text-[var(--brand-primary)]">
                            <CheckCircle className="size-3 shrink-0" aria-hidden />
                            Booked
                        </span>
                    </div>

                    <div className="flex w-full flex-col gap-5">
                        <div className="flex w-full flex-col gap-1">
                            <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">{appointment.name}</p>
                            <p className="text-sm font-normal leading-5 text-[#475467]">
                                {fullDate}
                                {slotTime ? ` at ${to12h(slotTime)}` : ""}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
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
                                                    <img
                                                        src={instructor.imageUrl}
                                                        alt=""
                                                        className="size-full scale-[1.4] object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-[9px] font-semibold leading-none text-[#667085]">
                                                        {instructor.initials}
                                                    </span>
                                                )}
                                            </span>
                                            {instructor.name}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex w-full items-start gap-1.5">
                            <MarkerPin01 className="mt-0.5 size-4 shrink-0 text-[#667085]" aria-hidden />
                            <p className="min-w-0 flex-1 text-sm font-normal leading-5 text-[#475467]">
                                {appointment.branchName}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div
                className={`sticky bottom-0 z-10 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
                    scrollable ? "bg-white" : ""
                }`}
            >
                <Button
                    variant="primary"
                    size="xl"
                    className="w-full rounded-full"
                    onClick={() => router.push(bookingId ? `/customer/bookings/appointment/${bookingId}` : "/customer/bookings")}
                >
                    View bookings
                </Button>
            </div>
        </div>
    );
}
