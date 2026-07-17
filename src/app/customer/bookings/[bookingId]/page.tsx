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
import { RefundDetailsSection, type RefundLine } from "@/components/customer/bookings/RefundDetailsSection";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { CancelConfirmSheet } from "@/components/customer/bookings/CancelConfirmSheet";
import { Button } from "@/components/ui/button";

export default function BookingDetailPage() {
    const router = useRouter();
    const goBack = useCustomerBack("/customer/bookings/upcoming");
    const { bookingId } = useParams<{ bookingId: string }>();
    const vm = useBookingDetail(bookingId);
    const reviews = useClassReviews(vm?.detail.id ?? "");
    const hasRated = useHasRated(vm?.detail.id ?? "");
    const [cancelOpen, setCancelOpen] = useState(false);
    const cancelClassBooking = useAppStore((st) => st.cancelClassBooking);
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

    // Cancel outcome: waitlist (no credit) · on-time ≥24h (credit refunded) ·
    // late <24h (credit forfeited). Confirmed via the bottom sheet, then → Past.
    const isWaitlist = viewStatus === "waitlisted";
    const startMs = new Date(`${detail.dateISO}T${detail.startTime}:00`).getTime();
    const nowMs = new Date(`${REAL_TODAY_ISO}T00:00:00`).getTime();
    const isLate = !isWaitlist && (startMs - nowMs) / 3_600_000 < 24;
    const cancelCopy = isWaitlist
        ? { title: "Leave this class?", description: "This will remove you from the waitlist.", confirmLabel: "Yes, leave waitlist", refundNote: undefined as string | undefined }
        : isLate
          ? { title: "Cancel this class?", description: "This cancellation is within 24 hours. Your credit will not be returned to your package.", confirmLabel: "Yes, cancel booking", refundNote: undefined as string | undefined }
          : { title: "Cancel this class?", description: "This will cancel your booking and free up your spot.", confirmLabel: "Yes, cancel booking", refundNote: "1 credit refunded to your account" };
    function confirmCancel() {
        if (isWaitlist) {
            cancelClassBooking(bookingId, "Left the waitlist", true, "customer_portal");
            showToast("Left the waitlist", "You've been removed from the waitlist.", "success", "slash");
        } else if (isLate) {
            cancelClassBooking(bookingId, "Cancelled within 24 hours", false, "customer_portal");
            updateAttendance(bookingId, "late_cancel");
            showToast("Booking cancelled", "No credit was returned — cancelled within 24 hours.", "success", "refresh");
        } else {
            cancelClassBooking(bookingId, "Cancelled by member", true, "customer_portal");
            showToast("Booking cancelled", "Your credit has been returned to your account.", "success", "refresh");
        }
        router.replace("/customer/bookings/past");
    }
    const p = BOOKING_STATUS[viewStatus];
    const HeroIcon = p.heroIcon;
    const isAttended = viewStatus === "attended";
    // Classes are credit-based — the view status already encodes the outcome:
    // cancelled_free → 1 credit returned; cancelled_late / no_show → forfeited.
    const refundLines: RefundLine[] | null =
        viewStatus === "cancelled_free"
            ? [
                  { label: "You've paid", value: "1 credit" },
                  { label: "Your refund", value: "1 credit" },
                  { label: "Status", value: "Returned to your account" },
              ]
            : viewStatus === "cancelled_late" || viewStatus === "no_show"
              ? [
                    { label: "You've paid", value: "1 credit" },
                    { label: "Your refund", value: "0 credit", tone: "muted" },
                    {
                        label: "Status",
                        value:
                            viewStatus === "no_show"
                                ? "Forfeited — no show"
                                : "Not returned — cancelled within 24 hours",
                        tone: "muted",
                    },
                ]
              : null;

    const actionZone =
        tab === "upcoming" ? (
            <Button
                variant="secondary"
                size="xl"
                className="w-full rounded-full border-[#fda29b] bg-[#fef3f2] text-[#b42318] hover:bg-[#fee4e2] hover:text-[#912018] active:bg-[#fee4e2] active:text-[#912018]"
                onClick={() => setCancelOpen(true)}
            >
                {viewStatus === "waitlisted" ? "Leave waitlist" : "Cancel booking"}
            </Button>
        ) : isAttended && !hasRated ? (
            <Button
                variant="primary"
                size="xl"
                className="w-full rounded-full"
                onClick={() => router.push(`/customer/bookings/${bookingId}/rate`)}
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
                isAttended ? (
                    <RatingsSection
                        reviews={reviews}
                        onMoreReviews={() => router.push(`/customer/bookings/${bookingId}/reviews`)}
                    />
                ) : refundLines ? (
                    <RefundDetailsSection lines={refundLines} />
                ) : undefined
            }
            actionZone={actionZone}
        />
        <CancelConfirmSheet
            open={cancelOpen}
            onClose={() => setCancelOpen(false)}
            title={cancelCopy.title}
            description={cancelCopy.description}
            refundNote={cancelCopy.refundNote}
            confirmLabel={cancelCopy.confirmLabel}
            onConfirm={confirmCancel}
        />
        </>
    );
}
