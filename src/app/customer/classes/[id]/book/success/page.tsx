"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Booking Success (`/customer/classes/[id]/book/success`) — Phase 7
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 2134-23763. Full-screen end of the booking flow: a ringed check-circle,
// a confirmation headline, and a class summary card (Booked / Waitlisted #N
// badge + cover + name + date·time + duration·instructor + room·branch). The X
// (top-right) returns to Search; "View bookings" routes into the Bookings module.

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Check, CheckCircle, Clock, MarkerPin01, XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { useClassDetail } from "@/lib/customer/search-data";
import { to12h } from "@/lib/customer/dates";
import { useMainScrollable } from "@/lib/customer/use-scrollable";
import { Button } from "@/components/ui/button";

export default function BookingSuccessPage() {
    return (
        <Suspense fallback={<div className="min-h-full" />}>
            <BookingSuccess />
        </Suspense>
    );
}

function BookingSuccess() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const search = useSearchParams();
    const waitlist = search.get("mode") === "waitlist";

    const detail = useClassDetail(id);
    const { member } = useCurrentCustomerContext();
    const allBookings = useAppStore((s) => s.classBookings);
    const scrollable = useMainScrollable();

    if (!detail) {
        return (
            <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-base font-semibold text-[var(--brand-text)]">Booking complete</p>
                <Button variant="secondary-gray" size="sm" className="rounded-full" onClick={() => router.push("/customer/bookings")}>
                    View bookings
                </Button>
            </div>
        );
    }

    // Waitlist position from the just-created booking (for the "Waitlisted #N" badge).
    const myBooking = allBookings
        .filter((b) => b.classScheduleId === id && b.customerId === member?.id && b.status === (waitlist ? "waitlisted" : "booked"))
        .sort((a, b) => b.bookingTime.localeCompare(a.bookingTime))[0];
    const waitlistLabel = `Waitlisted${myBooking?.waitlistPosition ? ` #${myBooking.waitlistPosition}` : ""}`;

    const fullDate = new Date(`${detail.dateISO}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
    });

    return (
        <div className="flex min-h-full flex-col">
            {/* Header — close only (returns to Search). */}
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
                {/* Ringed check — filled brand circle + white tick (Figma 2134-24288). */}
                <div className="relative flex size-12 shrink-0 items-center justify-center">
                    <span className="absolute -inset-[7px] rounded-full border-2 border-[var(--brand-primary)] opacity-30" aria-hidden />
                    <span className="absolute -inset-[15px] rounded-full border-2 border-[var(--brand-primary)] opacity-10" aria-hidden />
                    <span className="flex size-12 items-center justify-center rounded-full bg-[var(--brand-primary)]">
                        <Check className="size-6 text-white" strokeWidth={3} aria-hidden />
                    </span>
                </div>

                <p className="text-center text-xl font-semibold leading-[30px] text-[var(--brand-text)]">
                    {waitlist ? "You're on the waitlist!" : "Your booking is confirmed!"}
                </p>

                {/* Class summary card */}
                <div className="flex w-full flex-col gap-4 rounded-[20px] border border-[#e4e7ec] bg-white p-4 shadow-[0px_24px_48px_-12px_rgba(16,24,40,0.12)]">
                    <div
                        className="relative h-[200px] w-full overflow-hidden rounded-2xl"
                        style={!detail.coverImage ? { backgroundColor: detail.coverColor } : undefined}
                    >
                        {detail.coverImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={detail.coverImage} alt="" className="absolute inset-0 size-full object-cover" />
                        )}
                        <span
                            className={`absolute left-3 top-3 flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-[18px] ${
                                waitlist
                                    ? "border-[#e4e7ec] bg-white text-[#344054]"
                                    : "border-[var(--brand-primary)] bg-[var(--brand-tertiary)] text-[var(--brand-primary)]"
                            }`}
                        >
                            {!waitlist && <CheckCircle className="size-3 shrink-0" aria-hidden />}
                            {waitlist ? waitlistLabel : "Booked"}
                        </span>
                    </div>

                    <div className="flex w-full flex-col gap-5">
                        <div className="flex w-full flex-col gap-1">
                            <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">{detail.name}</p>
                            <p className="text-sm font-normal leading-5 text-[#475467]">
                                {fullDate} at {to12h(detail.startTime)}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
                                <span className="flex items-center gap-1 text-sm font-normal leading-5 text-[#475467]">
                                    <Clock className="size-4 shrink-0 text-[#667085]" aria-hidden />
                                    {detail.durationMins} mins
                                </span>
                                {detail.instructorName && (
                                    <span className="text-sm leading-5 text-[#475467]" aria-hidden>
                                        •
                                    </span>
                                )}
                                {detail.instructorName && (
                                    <span className="flex items-center gap-1.5 text-sm font-normal leading-5 text-[#475467]">
                                        <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f4f7]">
                                            {detail.instructorImageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={detail.instructorImageUrl}
                                                    alt=""
                                                    className="size-full scale-[1.4] object-cover"
                                                />
                                            ) : (
                                                <span className="text-[9px] font-semibold leading-none text-[#667085]">
                                                    {detail.instructorInitials}
                                                </span>
                                            )}
                                        </span>
                                        {detail.instructorName}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex w-full items-start gap-1.5">
                            <MarkerPin01 className="mt-0.5 size-4 shrink-0 text-[#667085]" aria-hidden />
                            <p className="min-w-0 flex-1 text-sm font-normal leading-5 text-[#475467]">
                                {detail.room} - {detail.branchName}
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
                    onClick={() => router.push(myBooking ? `/customer/bookings/${myBooking.id}` : "/customer/bookings")}
                >
                    View bookings
                </Button>
            </div>
        </div>
    );
}
