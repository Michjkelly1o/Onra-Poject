"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Cancel appointment (`/customer/bookings/appointment/[apptId]/cancel`)
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors the class Cancel-booking review, worded for appointments and priced in
// AED (appointments are paid, not credit-based): an appointment overview,
// location, refund details, and a cancellation-policy warning when <24h before
// the slot (no refund). "Cancel appointment" writes the cancel directly (no
// confirmation sheet) to the UI-only store → the (now Cancelled) booking detail.

import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, Clock, MarkerPin01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { to12h } from "@/lib/customer/dates";
import { cancelAppointmentBooking, useAppointmentBookingById } from "@/lib/customer/appointment-bookings";
import { addCustomerNotification } from "@/lib/customer/notifications-feed";
import { useMainScrollable, useMainScrolled } from "@/lib/customer/use-scrollable";
import { Button } from "@/components/ui/button";

const CANCEL_BTN =
    "border-[#fda29b] bg-[#fef3f2] text-[#b42318] hover:bg-[#fee4e2] hover:text-[#912018] active:bg-[#fee4e2] active:text-[#912018]";

function Divider() {
    return <div className="h-px w-full bg-[#e4e7ec]" />;
}

export default function CancelAppointmentPage() {
    const router = useRouter();
    const { apptId } = useParams<{ apptId: string }>();
    const booking = useAppointmentBookingById(apptId);
    const showToast = useAppStore((s) => s.showToast);
    const scrolled = useMainScrolled();
    const scrollable = useMainScrollable();

    const startMs = booking ? new Date(`${booking.slotISO}T${booking.slotTime}:00`).getTime() : 0;
    const cancellable = !!booking && booking.status === "booked" && startMs > Date.now();

    if (!booking || !cancellable) {
        return (
            <div className="flex min-h-full flex-col">
                <header className="sticky top-0 z-20 flex items-center px-4 py-3">
                    <button
                        type="button"
                        onClick={() => router.push(`/customer/bookings/appointment/${apptId}`)}
                        aria-label="Back"
                        className="flex size-10 items-center justify-center rounded-full border border-[#e4e7ec] bg-white"
                    >
                        <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                    </button>
                </header>
                <div className="flex flex-1 items-center justify-center px-6 text-center">
                    <p className="text-sm text-[#475467]">This appointment can no longer be cancelled.</p>
                </div>
            </div>
        );
    }

    // ≥24h before start = on-time (full AED refund); <24h = late (forfeited).
    const isLate = (startMs - Date.now()) / 3_600_000 < 24;
    const isPrivate = booking.type === "private";

    const fullDate = new Date(`${booking.slotISO}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
    });

    function confirmCancel() {
        if (!booking) return;
        cancelAppointmentBooking(apptId, isLate);
        addCustomerNotification({
            tab: "bookings",
            event: "appointment_cancelled",
            title: "Appointment cancelled",
            message: `Your ${booking.name} appointment on ${fullDate} has been cancelled.`,
            relatedType: "appointment",
            relatedId: apptId,
        });
        showToast(
            "Appointment cancelled",
            isLate
                ? "No refund was issued — cancelled within 24 hours."
                : `AED ${booking.price} has been refunded to your account.`,
            "success",
            isLate ? "slash" : "check",
        );
        router.replace(`/customer/bookings/appointment/${apptId}`);
    }

    return (
        <div className="flex min-h-full flex-col">
            <header
                className={`sticky top-0 z-20 flex w-full items-center gap-3 px-4 py-3 transition-colors ${
                    scrolled ? "bg-white/80 backdrop-blur-md" : ""
                }`}
            >
                <button
                    type="button"
                    onClick={() => router.push(`/customer/bookings/appointment/${apptId}`)}
                    aria-label="Back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">
                    Cancel appointment
                </p>
                <div className="size-10 shrink-0" aria-hidden />
            </header>

            <div className="flex flex-1 flex-col gap-6 px-4 pb-4 pt-2">
                {/* Overview */}
                <div className="flex items-center gap-3">
                    <div
                        className="size-[82px] shrink-0 overflow-hidden rounded-[10px] border border-[#e4e7ec]"
                        style={!booking.coverImage ? { backgroundColor: booking.coverColor } : undefined}
                    >
                        {booking.coverImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={booking.coverImage} alt="" className="size-full object-cover" />
                        )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-col">
                            <p className="truncate text-base font-semibold leading-6 text-[var(--brand-text)]">{booking.name}</p>
                            <p className="text-sm font-normal leading-5 text-[#475467]">
                                {fullDate} at {to12h(booking.slotTime)}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-normal leading-5 text-[#475467]">
                            <span className="flex items-center gap-1">
                                <Clock className="size-4 shrink-0 text-[#667085]" aria-hidden />
                                {booking.durationMins} mins
                            </span>
                            {isPrivate && booking.instructorName && (
                                <>
                                    <span aria-hidden>•</span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f4f7]">
                                            {booking.instructorImageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={booking.instructorImageUrl} alt="" className="size-full scale-[1.4] object-cover" />
                                            ) : (
                                                <span className="text-[8px] font-semibold leading-none text-[#667085]">
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
                </div>

                <Divider />

                {/* Location */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Location</h2>
                    <div className="flex items-start gap-2">
                        <MarkerPin01 className="mt-0.5 size-4 shrink-0 text-[#667085]" aria-hidden />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <p className="text-sm font-medium leading-5 text-[var(--brand-text)]">{booking.branchName}</p>
                            {booking.branchAddress && (
                                <p className="text-sm font-normal leading-5 text-[#475467]">{booking.branchAddress}</p>
                            )}
                        </div>
                    </div>
                </section>

                <Divider />

                {/* Cancellation policy warning — late only */}
                {isLate && (
                    <>
                        <section className="flex flex-col gap-3">
                            <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Cancellation policy</h2>
                            <div className="flex items-start gap-3 rounded-2xl border border-[#fedf89] bg-[#fffaeb] p-4">
                                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#dc6803]" aria-hidden />
                                <p className="flex-1 text-sm font-normal leading-5 text-[#475467]">
                                    This cancellation is within 24 hours. You won't be refunded for this appointment.
                                </p>
                            </div>
                        </section>
                        <Divider />
                    </>
                )}

                {/* Refund details (AED) */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Refund details</h2>
                    <div className="flex flex-col gap-2 text-sm leading-5">
                        <div className="flex items-center justify-between">
                            <span className="font-normal text-[#475467]">You've paid</span>
                            <span className="font-medium text-[var(--brand-text)]">AED {booking.price}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-normal text-[#475467]">Your refund</span>
                            <span className="font-medium text-[var(--brand-text)]">AED {isLate ? 0 : booking.price}</span>
                        </div>
                        {!isLate && (
                            <div className="flex items-center justify-between">
                                <span className="font-normal text-[#475467]">Refund via</span>
                                <span className="font-medium text-[var(--brand-text)]">
                                    {booking.paymentMethod ?? "Original payment method"}
                                </span>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <div
                className={`sticky bottom-0 z-10 px-5 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
                    scrollable ? "bg-white" : ""
                }`}
            >
                <Button
                    variant="secondary"
                    size="xl"
                    className={`w-full rounded-full ${CANCEL_BTN}`}
                    onClick={confirmCancel}
                >
                    Cancel appointment
                </Button>
            </div>
        </div>
    );
}
