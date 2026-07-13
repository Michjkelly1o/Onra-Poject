"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Cancel booking review (`/customer/bookings/[bookingId]/cancel`)
// ─────────────────────────────────────────────────────────────────────────────
// Figma 2191-15799 (≥24h) / 2440-21018 (<24h). Reuses the booking-confirmation
// review anatomy: a class overview, location, spot, and the credit outcome — a
// Refund-details block (≥24h → 1 credit refunded) or a Cancellation-policy
// warning (<24h → credit forfeited). "Cancel booking" writes the cancel
// directly (no confirmation sheet) → the cancelled Booking Detail.

import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, Clock, MarkerPin01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { REAL_TODAY_ISO } from "@/lib/customer/dates";
import { useBookingDetail } from "@/lib/customer/bookings-data";
import { useMainScrollable, useMainScrolled } from "@/lib/customer/use-scrollable";
import { Button } from "@/components/ui/button";

// Destructive secondary (Figma 4248-39738 / 39756): error-50 bg + error border/
// text by default; hover deepens to error-100 bg + error-800 text. Overrides the
// DS secondary variant's gray hover bg + dark hover text.
const CANCEL_BTN =
    "border-[#fda29b] bg-[#fef3f2] text-[#b42318] hover:bg-[#fee4e2] hover:text-[#912018] active:bg-[#fee4e2] active:text-[#912018]";

function Divider() {
    return <div className="h-px w-full bg-[#e4e7ec]" />;
}

export default function CancelBookingPage() {
    const router = useRouter();
    const { bookingId } = useParams<{ bookingId: string }>();
    const vm = useBookingDetail(bookingId);
    const cancelClassBooking = useAppStore((s) => s.cancelClassBooking);
    const updateAttendance = useAppStore((s) => s.updateAttendance);
    const showToast = useAppStore((s) => s.showToast);
    const scrolled = useMainScrolled();
    const scrollable = useMainScrollable();

    if (!vm || vm.tab !== "upcoming") {
        return (
            <div className="flex min-h-full flex-col">
                <header className="sticky top-0 z-20 flex items-center px-4 py-3">
                    <button
                        type="button"
                        onClick={() => router.push(`/customer/bookings/${bookingId}`)}
                        aria-label="Back"
                        className="flex size-10 items-center justify-center rounded-full border border-[#e4e7ec] bg-white"
                    >
                        <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                    </button>
                </header>
                <div className="flex flex-1 items-center justify-center px-6 text-center">
                    <p className="text-sm text-[#475467]">This booking can no longer be cancelled.</p>
                </div>
            </div>
        );
    }

    const { detail, viewStatus, spot, booking } = vm;
    const isWaitlist = viewStatus === "waitlisted";

    // ≥24h before start = on-time (credit refunded); <24h = late (forfeited).
    const startMs = new Date(`${detail.dateISO}T${detail.startTime}:00`).getTime();
    const nowMs = new Date(`${REAL_TODAY_ISO}T00:00:00`).getTime();
    const isLate = !isWaitlist && (startMs - nowMs) / 3_600_000 < 24;

    const fullDate = new Date(`${detail.dateISO}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
    });

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
        router.replace(`/customer/bookings/${bookingId}`);
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
                    onClick={() => router.push(`/customer/bookings/${bookingId}`)}
                    aria-label="Back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">
                    {isWaitlist ? "Leave waitlist" : "Cancel booking"}
                </p>
                <div className="size-10 shrink-0" aria-hidden />
            </header>

            <div className="flex flex-1 flex-col gap-6 px-4 pb-4 pt-2">
                {/* Overview */}
                <div className="flex items-center gap-3">
                    <div
                        className="size-[82px] shrink-0 overflow-hidden rounded-[10px] border border-[#e4e7ec]"
                        style={!detail.coverImage ? { backgroundColor: detail.coverColor } : undefined}
                    >
                        {detail.coverImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={detail.coverImage} alt="" className="size-full object-cover" />
                        )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-col">
                            <p className="truncate text-base font-semibold leading-6 text-[var(--brand-text)]">{detail.name}</p>
                            <p className="text-sm font-normal leading-5 text-[#475467]">{fullDate} at {timeOf(detail.startTime)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-normal leading-5 text-[#475467]">
                            <span className="flex items-center gap-1">
                                <Clock className="size-4 shrink-0 text-[#667085]" aria-hidden />
                                {detail.durationMins} mins
                            </span>
                            {detail.instructorName && (
                                <>
                                    <span aria-hidden>•</span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f4f7]">
                                            {detail.instructorImageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={detail.instructorImageUrl} alt="" className="size-full scale-[1.4] object-cover" />
                                            ) : (
                                                <span className="text-[8px] font-semibold leading-none text-[#667085]">
                                                    {detail.instructorInitials}
                                                </span>
                                            )}
                                        </span>
                                        {detail.instructorName}
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
                            <p className="text-sm leading-5 text-[#475467]">
                                <span className="font-medium text-[var(--brand-text)]">{detail.room}</span> - {detail.branchName}
                            </p>
                            <p className="text-sm font-normal leading-5 text-[#475467]">{detail.branchAddress}</p>
                        </div>
                    </div>
                </section>

                <Divider />

                {/* Waitlist → queue position; booked → reserved spot (live booking data) */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">
                        {isWaitlist ? "Waitlist number" : "Spot"}
                    </h2>
                    <p className="text-sm font-normal leading-5 text-[#475467]">
                        {isWaitlist ? (booking.waitlistPosition ? `#${booking.waitlistPosition}` : "—") : spot}
                    </p>
                </section>

                <Divider />

                {/* Credit outcome */}
                {isLate && !isWaitlist && (
                    <>
                        <section className="flex flex-col gap-3">
                            <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Cancellation policy</h2>
                            <div className="flex items-start gap-3 rounded-2xl border border-[#fedf89] bg-[#fffaeb] p-4">
                                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#dc6803]" aria-hidden />
                                <p className="flex-1 text-sm font-normal leading-5 text-[#475467]">
                                    This cancellation is within 24 hours. Your credit will not be returned to your package.
                                </p>
                            </div>
                        </section>
                        <Divider />
                    </>
                )}

                {/* Refund details — always at the bottom */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Refund details</h2>
                    <div className="flex flex-col gap-2 text-sm leading-5">
                        <div className="flex items-center justify-between">
                            <span className="font-normal text-[#475467]">You've paid</span>
                            <span className="font-medium text-[var(--brand-text)]">{isWaitlist ? "0 credit" : "1 credit"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-normal text-[#475467]">Your refund</span>
                            <span className="font-medium text-[var(--brand-text)]">{isWaitlist || isLate ? "0 credit" : "1 credit"}</span>
                        </div>
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
                    {isWaitlist ? "Leave waitlist" : "Cancel booking"}
                </Button>
            </div>
        </div>
    );
}

function timeOf(hhmm: string): string {
    const [h, m] = hhmm.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
