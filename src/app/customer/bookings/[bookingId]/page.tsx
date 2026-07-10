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

import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "@untitledui/icons";
import { BOOKING_STATUS, useBookingDetail, useClassReviews, useHasRated } from "@/lib/customer/bookings-data";
import { ClassDetailLayout } from "@/components/customer/classes/ClassDetailLayout";
import { BookingStatusCard } from "@/components/customer/bookings/BookingStatusCard";
import { RatingsSection } from "@/components/customer/bookings/RatingsSection";
import { RefundDetailsSection, type RefundLine } from "@/components/customer/bookings/RefundDetailsSection";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { Button } from "@/components/ui/button";

export default function BookingDetailPage() {
    const router = useRouter();
    const { bookingId } = useParams<{ bookingId: string }>();
    const vm = useBookingDetail(bookingId);
    const reviews = useClassReviews(vm?.detail.id ?? "");
    const hasRated = useHasRated(vm?.detail.id ?? "");

    if (!vm) {
        return (
            <div className="flex min-h-full flex-col">
                <CustomerHeader>
                    <button
                        type="button"
                        onClick={() => router.push("/customer/bookings")}
                        aria-label="Go back"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/40 transition-colors active:bg-black/50"
                    >
                        <ChevronLeft className="size-5 text-white" aria-hidden />
                    </button>
                    <div className="flex-1" />
                </CustomerHeader>
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                    <p className="text-base font-semibold text-[#101828]">This booking is no longer available</p>
                    <Button variant="secondary" size="sm" className="rounded-full" onClick={() => router.push("/customer/bookings")}>
                        Back to Bookings
                    </Button>
                </div>
            </div>
        );
    }

    const { detail, viewStatus, tab, heroSubtitle, spot, booking } = vm;
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
                onClick={() => router.push(`/customer/bookings/${bookingId}/cancel`)}
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
        <ClassDetailLayout
            detail={detail}
            heroSubtitle={heroSubtitle}
            mutedCover={p.mutedCover}
            onBack={() => router.push("/customer/bookings")}
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
    );
}
