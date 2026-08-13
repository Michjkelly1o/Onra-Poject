"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Booking Detail (`/customer/bookings/[bookingId]`)
// ─────────────────────────────────────────────────────────────────────────────
// Figma 3696-31868 (Booked) / 32088 (Waitlist) / 32602 (Attended) / 32419
// (Cancelled · No show). A distinct screen resolved from the booking record that
// composes the shared <ClassDetailLayout>: a status hero badge, a Booking Status
// card under the cover, (Past+Attended) a Ratings section, and a state-driven
// action zone (Cancel booking / Rate class / none). Cancelled & No-show grayscale
// the cover and show no action.

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCustomerBack } from "@/lib/customer/use-customer-back";
import { ChevronLeft } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { REAL_TODAY_ISO } from "@/lib/customer/dates";
import { BOOKING_STATUS, useBookingDetail, useClassReviews, useHasRated } from "@/lib/customer/bookings-data";
import { ClassDetailLayout } from "@/components/customer/classes/ClassDetailLayout";
import { BookingStatusCard } from "@/components/customer/bookings/BookingStatusCard";
import { RatingsSection } from "@/components/customer/bookings/RatingsSection";
import { BookingDetailSections, type BookingRefund } from "@/components/customer/bookings/GuestBookToSection";
import { useCurrentCustomer } from "@/lib/customer/context";
import { DROP_IN_PRICE_AED } from "@/lib/customer/booking-flow";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { CancelConfirmSheet } from "@/components/customer/bookings/CancelConfirmSheet";
import { RateSheet } from "@/components/customer/bookings/RateSheet";
import { Button } from "@/components/ui/button";

export default function BookingDetailPage() {
    const router = useRouter();
    const { bookingId } = useParams<{ bookingId: string }>();
    const vm = useBookingDetail(bookingId);
    const member = useCurrentCustomer();
    // A cancelled / past booking lives in the Past tab — Back returns there, so
    // it never lands on the Upcoming list the record just left.
    const goBack = useCustomerBack(vm?.tab === "past" ? "/customer/bookings/past" : "/customer/bookings/upcoming");
    const reviews = useClassReviews(vm?.detail.id ?? "");
    const hasRated = useHasRated(vm?.detail.id ?? "");
    const [cancelOpen, setCancelOpen] = useState(false);
    const [rateOpen, setRateOpen] = useState(false);
    const cancelClassBooking = useAppStore((st) => st.cancelClassBooking);
    const cancelClassBookingByCustomer = useAppStore((st) => st.cancelClassBookingByCustomer);
    const computeCancellationPenalty = useAppStore((st) => st.computeCancellationPenalty);
    const cancellationPolicy = useAppStore((st) => st.cancellationPolicy);
    const updateAttendance = useAppStore((st) => st.updateAttendance);
    const showToast = useAppStore((st) => st.showToast);

    if (!vm) {
        return (
            <div className="flex min-h-full flex-col">
                <CustomerHeader>
                    <button
                        type="button"
                        onClick={goBack}
                        aria-label="Go back"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/40 transition-colors active:bg-black/50"
                    >
                        <ChevronLeft className="size-5 text-white" aria-hidden />
                    </button>
                    <div className="flex-1" />
                </CustomerHeader>
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                    <p className="text-base font-semibold text-[var(--brand-text)]">This booking is no longer available</p>
                    <Button variant="secondary" size="sm" className="rounded-full" onClick={() => router.push("/customer/bookings")}>
                        Back to Bookings
                    </Button>
                </div>
            </div>
        );
    }

    const { detail, viewStatus, tab, spot, booking } = vm;

    // Cancel outcome follows the studio's Booking-Rules cancellation policy
    // (Settings), read live — not a hardcoded window. Waitlist = leave (no
    // credit). On-time (>= the free-cancel window) = credit returned. Late
    // (< window) = credit forfeited + a membership late-cancel fee once the
    // policy's cancellation threshold is crossed (computeCancellationPenalty
    // handles all the gating — plan type, freeze, threshold, fee toggle).
    const isWaitlist = viewStatus === "waitlisted";
    const startMs = new Date(`${detail.dateISO}T${detail.startTime}:00`).getTime();
    const nowMs = new Date(`${REAL_TODAY_ISO}T00:00:00`).getTime();
    const lateWindowHours = cancellationPolicy.credit_within_window_unit === "minutes"
        ? cancellationPolicy.credit_within_window_value / 60
        : cancellationPolicy.credit_within_window_value;
    const windowLabel = `${cancellationPolicy.credit_within_window_value} ${cancellationPolicy.credit_within_window_unit}`;
    const isLate = !isWaitlist && (startMs - nowMs) / 3_600_000 < lateWindowHours;
    // Fee preview for a membership late-cancel — returns applies:false for
    // credit/package members and for members still under the policy threshold.
    const latePenalty = isLate
        ? computeCancellationPenalty(booking.customerId, "late_cancel")
        : { applies: false, amountAed: 0, scenario: "late_cancel" as const };
    const cancelCopy = isWaitlist
        ? { title: "Leave this class?", description: "This will remove you from the waitlist.", confirmLabel: "Yes, leave waitlist", refundNote: undefined as string | undefined }
        : isLate
          ? {
              title: "Cancel this class?",
              description: latePenalty.applies
                ? `This is a late cancellation (within ${windowLabel} of the class). A late-cancellation fee of AED ${latePenalty.amountAed} will be charged to your account.`
                : `This cancellation is within ${windowLabel} of the class. Your credit will not be returned to your package.`,
              confirmLabel: "Yes, cancel booking",
              refundNote: undefined as string | undefined,
            }
          : { title: "Cancel this class?", description: "This will cancel your booking and free up your spot.", confirmLabel: "Yes, cancel booking", refundNote: "1 credit refunded to your account" };
    function confirmCancel() {
        if (isWaitlist) {
            cancelClassBooking(bookingId, "Left the waitlist", true, "customer_portal");
            showToast("Left the waitlist", "You've been removed from the waitlist.", "success", "slash");
        } else if (isLate) {
            // Routes through the policy engine: no credit returned + charges the
            // membership late-cancel fee when the threshold is crossed.
            const res = cancelClassBookingByCustomer(bookingId, "late_cancel", "Cancelled within the late-cancel window");
            updateAttendance(bookingId, "late_cancel");
            showToast(
                "Booking cancelled",
                res.penaltyAedCharged
                    ? `A late-cancellation fee of AED ${res.penaltyAedCharged} was charged to your account.`
                    : "No credit was returned — this was a late cancellation.",
                "success", "refresh",
            );
        } else {
            cancelClassBooking(bookingId, "Cancelled by member", true, "customer_portal");
            showToast("Booking cancelled", "Your credit has been returned to your account.", "success", "refresh");
        }
        router.replace("/customer/bookings/past");
    }
    const p = BOOKING_STATUS[viewStatus];
    const HeroIcon = p.heroIcon;
    const isAttended = viewStatus === "attended";

    // ── Book to + Payment detail (shown for every booking — Myself & Guest) ──
    const isGuestBooking = !!booking.guestName;
    const bookToName = isGuestBooking
        ? booking.guestName!
        : `${member?.firstName ?? ""} ${member?.lastName ?? ""}`.trim() || "You";
    // Guests are contacted by phone now (email kept as a fallback for older
    // bookings); a self booking still shows the member's email.
    const bookToEmail = isGuestBooking ? (booking.guestPhone ?? booking.guestEmail) : member?.email;
    const bookToInitial = isGuestBooking ? undefined : member?.initials;
    // Real portrait only for a self booking — guests have no photo.
    const bookToImage = isGuestBooking ? undefined : member?.imageUrl;
    // A class always costs 1 credit; a guest drop-in / invite pays differently.
    const payAmount = isGuestBooking
        ? booking.guestPayment === "drop_in"
            ? `AED ${DROP_IN_PRICE_AED}`
            : booking.guestPayment === "invite_link"
              ? "Pending"
              : "1 credit"
        : "1 credit";
    // "Pay with" — never "—": self → the plan its credit came from; guest → how
    // the guest seat was paid.
    const selfPayWith = booking.planName && booking.planName !== "—" ? booking.planName : "Class credit";
    const payWith = isGuestBooking
        ? booking.guestPayment === "drop_in"
            ? "Guest pays drop-in"
            : booking.guestPayment === "booker_credit"
              ? selfPayWith
              : booking.guestPayment === "guest_package"
                ? "Guest's plan"
                : booking.guestPayment === "invite_link"
                  ? "Guest completes payment"
                  : selfPayWith
        : selfPayWith;

    // Refund folds into Payment detail for a cancelled booking — credits are
    // returned on an on-time cancel, forfeited on a late cancel / no-show.
    const paidIsCredit = payAmount.includes("credit");
    const zeroRefund = paidIsCredit ? "0 credit" : "AED 0";
    const refund: BookingRefund | null =
        viewStatus === "cancelled_free"
            ? { amount: payAmount, status: "Returned to your account" }
            : viewStatus === "cancelled_late"
              ? { amount: zeroRefund, status: "Not returned — cancelled within 24 hours" }
              : viewStatus === "no_show"
                ? { amount: zeroRefund, status: "Forfeited — no show" }
                : null;

    const actionZone =
        tab === "upcoming" ? (
            <Button
                variant="secondary"
                size="xl"
                className="w-full rounded-full border-[#fda29b] bg-[#fef3f2] text-[#b42318] hover:bg-[#fee4e2] hover:text-[#912018] active:bg-[#fee4e2] active:text-[#912018]"
                onClick={() => setCancelOpen(true)}
            >
                {viewStatus === "waitlisted"
                    ? "Leave waitlist"
                    : booking.guestName
                      ? `Cancel ${booking.guestName}'s booking`
                      : "Cancel booking"}
            </Button>
        ) : isAttended && !hasRated ? (
            <Button
                variant="primary"
                size="xl"
                className="w-full rounded-full"
                onClick={() => setRateOpen(true)}
            >
                Rate class
            </Button>
        ) : undefined;

    return (
        <>
        <ClassDetailLayout
            detail={detail}
            mutedCover={p.mutedCover}
            onBack={goBack}
            heroBadge={
                <span
                    className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-[18px] ${p.heroClass}`}
                >
                    <HeroIcon className="size-3" aria-hidden />
                    {p.heroLabel}
                </span>
            }
            statusBlock={<BookingStatusCard viewStatus={viewStatus} spot={spot} waitlistPosition={booking.waitlistPosition} />}
            afterLocation={
                <>
                    <BookingDetailSections
                        name={bookToName}
                        email={bookToEmail}
                        isGuest={isGuestBooking}
                        initial={bookToInitial}
                        imageUrl={bookToImage}
                        amount={payAmount}
                        payWith={payWith}
                        refund={refund}
                    />
                    {isAttended && (
                        <RatingsSection
                            reviews={reviews}
                            onMoreReviews={() => router.push(`/customer/bookings/${bookingId}/reviews`)}
                        />
                    )}
                </>
            }
            actionZone={actionZone}
            stickyAction={tab !== "upcoming"}
        />
        <CancelConfirmSheet
            open={cancelOpen}
            onClose={() => setCancelOpen(false)}
            title={booking.guestName && !isWaitlist ? `Cancel ${booking.guestName}'s booking?` : cancelCopy.title}
            description={cancelCopy.description}
            refundNote={cancelCopy.refundNote}
            confirmLabel={cancelCopy.confirmLabel}
            onConfirm={confirmCancel}
        />
        <RateSheet
            open={rateOpen}
            onClose={() => setRateOpen(false)}
            rateHref={`/customer/bookings/${bookingId}/rate`}
        />
        </>
    );
}
