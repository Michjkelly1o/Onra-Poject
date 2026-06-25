"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Appointment booking detail (`/customer/bookings/appointment/[apptId]`)
// ─────────────────────────────────────────────────────────────────────────────
//
// Read-only detail for a booked appointment (UI-only store). Mirrors the class
// Booking Detail anatomy: hero cover + "Booked" badge, name, slot date/time,
// duration · instructor, and a location section.

import { useParams, useRouter } from "next/navigation";
import { CheckCircle, ChevronLeft, Clock, MarkerPin01 } from "@untitledui/icons";
import { to12h } from "@/lib/customer/dates";
import { useAppointmentBookingById } from "@/lib/customer/appointment-bookings";
import { Button } from "@/components/ui/button";

export default function AppointmentBookingDetailPage() {
    const router = useRouter();
    const { apptId } = useParams<{ apptId: string }>();
    const booking = useAppointmentBookingById(apptId);

    if (!booking) {
        return (
            <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-base font-semibold text-[#101828]">Booking not found</p>
                <Button variant="secondary-gray" size="sm" className="rounded-full" onClick={() => router.push("/customer/bookings")}>
                    Back to bookings
                </Button>
            </div>
        );
    }

    const isPrivate = booking.type === "private";
    const fullDate = new Date(`${booking.slotISO}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
    });

    return (
        <div className="flex min-h-full flex-col">
            <header className="sticky top-0 z-20 flex w-full items-center gap-3 px-4 py-3">
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[#101828]">
                    Booking detail
                </p>
                <span aria-hidden className="size-10 shrink-0" />
            </header>

            <div className="flex flex-1 flex-col gap-6 px-4 pb-6 pt-2">
                <div
                    className="relative h-[200px] w-full overflow-hidden rounded-2xl border border-[#e4e7ec]"
                    style={!booking.coverImage ? { backgroundColor: booking.coverColor } : undefined}
                >
                    {booking.coverImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={booking.coverImage} alt="" className="absolute inset-0 size-full object-cover" />
                    )}
                    <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-[#abefc6] bg-[#ecfdf3] px-2 py-0.5 text-xs font-medium leading-[18px] text-[#067647]">
                        <CheckCircle className="size-3 shrink-0" aria-hidden />
                        Booked
                    </span>
                </div>

                <div className="flex w-full flex-col gap-1">
                    <p className="text-xl font-semibold leading-[30px] text-[#101828]">{booking.name}</p>
                    <p className="text-sm font-normal leading-5 text-[#475467]">
                        {fullDate} at {to12h(booking.slotTime)}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
                        <span className="flex items-center gap-1 text-sm font-normal leading-5 text-[#475467]">
                            <Clock className="size-4 shrink-0 text-[#667085]" aria-hidden />
                            {booking.durationMins} mins
                        </span>
                        {isPrivate && booking.instructorName && (
                            <>
                                <span className="text-sm leading-5 text-[#475467]" aria-hidden>
                                    •
                                </span>
                                <span className="flex items-center gap-1.5 text-sm font-normal leading-5 text-[#475467]">
                                    <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f4f7]">
                                        {booking.instructorImageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={booking.instructorImageUrl} alt="" className="size-full scale-[1.4] object-cover" />
                                        ) : (
                                            <span className="text-[9px] font-semibold leading-none text-[#667085]">
                                                {booking.instructorInitials}
                                            </span>
                                        )}
                                    </span>
                                    {booking.instructorName}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <div className="h-px w-full bg-[#e4e7ec]" />

                <section className="flex w-full flex-col gap-3">
                    <p className="text-base font-semibold leading-6 text-[#101828]">Location</p>
                    <div className="flex w-full items-start gap-2">
                        <MarkerPin01 className="mt-0.5 size-4 shrink-0 text-[#667085]" aria-hidden />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <p className="text-sm font-medium leading-5 text-[#101828]">{booking.branchName}</p>
                            {booking.branchAddress && (
                                <p className="text-sm font-normal leading-5 text-[#475467]">{booking.branchAddress}</p>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
