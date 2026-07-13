"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Class booking confirmation (`/customer/classes/[id]/book`)
// ─────────────────────────────────────────────────────────────────────────────
//
// "Review and book" — the final step of the class booking flow (Figma 4212-39421,
// the shared confirmation reused later by the appointment flow). Reached from the
// class detail action bar: ?mode=book (default) confirms a seat; ?mode=waitlist
// joins the waitlist. Confirm writes through `addClassBooking`, which bumps the
// schedule's booked count, spends one class credit, and fires the booking
// notifications — so the admin roster, the customer profile, and the member's
// Bookings list all update before we route back to the (now "Booked") detail.

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ChevronRight, Clock, CoinsStacked03, Lightbulb02, MarkerPin01, ShoppingBag03, XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { useClassDetail, useNeedsWaiver } from "@/lib/customer/search-data";
import { formatLongDate, to12h } from "@/lib/customer/dates";
import { bookingDraft, ensureBookingDraft, type BookingGuest } from "@/lib/customer/booking-flow";
import { useMainScrollable, useMainScrolled } from "@/lib/customer/use-scrollable";
import { Button } from "@/components/ui/button";
import { SpotPicker, spotId } from "@/components/customer/classes/SpotPicker";

export default function ClassBookingConfirmationPage() {
    // useSearchParams (read inside) must sit under a Suspense boundary for the
    // App Router prerender pass.
    return (
        <Suspense fallback={<div className="min-h-full" />}>
            <BookingConfirmation />
        </Suspense>
    );
}

function BookingConfirmation() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const search = useSearchParams();
    const mode = search.get("mode") === "waitlist" ? "waitlist" : "book";

    const detail = useClassDetail(id);
    const { member } = useCurrentCustomerContext();
    const allBookings = useAppStore((s) => s.classBookings);
    const schedules = useAppStore((s) => s.classSchedules);
    const scrollable = useMainScrollable();
    const scrolled = useMainScrolled();
    const needsWaiver = useNeedsWaiver();
    const [selectedSpot, setSelectedSpot] = useState<string | null>(null);

    // Guests survive the Add Guest sub-route round-trip via the shared draft.
    ensureBookingDraft(id);
    const [guests] = useState<BookingGuest[]>(() => bookingDraft.guests);

    // Auto-select the first available spot when the class has spot selection on —
    // the member can still change it. Guards null detail (rules-of-hooks order)
    // and re-runs once the class resolves after hydration.
    useEffect(() => {
        const layout = detail?.spotSelectionEnabled ? detail.spotLayout : undefined;
        if (!detail || !layout || selectedSpot !== null) return;
        const taken = new Set([
            ...layout.blockedSpots,
            ...allBookings
                .filter(
                    (b) =>
                        b.classScheduleId === detail.id &&
                        (b.status === "booked" || b.status === "waitlisted") &&
                        b.spot,
                )
                .map((b) => b.spot as string),
        ]);
        for (let r = 0; r < layout.rows; r++) {
            for (let c = 0; c < layout.cols; c++) {
                const sid = spotId(r, c);
                if (!taken.has(sid)) {
                    setSelectedSpot(sid);
                    return;
                }
            }
        }
    }, [detail, allBookings, selectedSpot]);

    if (!detail) {
        return (
            <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-base font-semibold text-[var(--brand-text)]">Class not found</p>
                <p className="text-sm text-[#667085]">This class is no longer available.</p>
                <Button variant="secondary" size="sm" className="rounded-full" onClick={() => router.push("/customer/search")}>
                    Back to Search
                </Button>
            </div>
        );
    }

    const fullDate = new Date(`${detail.dateISO}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
    const credits = member?.creditsRemaining;
    const hasCredits = typeof credits === "number";
    const creditsAfter = hasCredits ? Math.max(0, credits - 1) : null;
    // Eligible = holds a plan that still has credit (or an unlimited membership).
    // No eligible plan → the footer offers Purchase Product instead of Confirm.
    const hasEligiblePlan = !!member?.planKind && (!hasCredits || credits > 0);
    // Booking for a guest = booking a friend in (they pay drop-in / their own
    // package), so the member's own plan isn't required to confirm.
    const needsPurchase = mode === "book" && !hasEligiblePlan && guests.length === 0;
    // Today's classes whose start time has passed are closed — no booking action.
    const isClosed = detail.state === "closed";

    const planLine = !hasCredits
        ? "Included in your membership"
        : `${creditsAfter} credit${creditsAfter === 1 ? "" : "s"} left after this booking`;

    // ── Spot selection — only when the admin enabled it on this class. ──────────
    const spotLayout = detail.spotSelectionEnabled ? detail.spotLayout : undefined;
    // Unavailable = admin-blocked ∪ spots already taken by live bookings on this
    // class (so a spot booked by another member shows as "Booked").
    const takenSpots = spotLayout
        ? [
              ...spotLayout.blockedSpots,
              ...allBookings
                  .filter(
                      (b) =>
                          b.classScheduleId === detail.id &&
                          (b.status === "booked" || b.status === "waitlisted") &&
                          b.spot,
                  )
                  .map((b) => b.spot as string),
          ]
        : [];
    const spotRequired = !!spotLayout && mode === "book";
    const spotMissing = spotRequired && !selectedSpot;

    // ── Conflict check — does the member already hold a booking that overlaps
    // this class's time on the same day? (Soft warning, mirrors the admin rule.)
    const overlapClass =
        member &&
        allBookings.some(
            (b) =>
                b.customerId === member.id &&
                (b.status === "booked" || b.status === "waitlisted") &&
                b.classScheduleId !== detail.id,
        )
            ? schedules.find((s) =>
                  allBookings.some(
                      (b) =>
                          b.customerId === member.id &&
                          (b.status === "booked" || b.status === "waitlisted") &&
                          b.classScheduleId === s.id &&
                          s.id !== detail.id &&
                          s.dateISO === detail.dateISO &&
                          detail.startTime < s.endTime &&
                          s.startTime < detail.endTime,
                  ),
              )
            : undefined;

    function confirm() {
        if (!detail || !member || spotMissing || isClosed) return;
        // Hand off to the Processing screen, which performs the write then routes
        // to Success. Selections travel as query params.
        const params = new URLSearchParams({ mode });
        if (spotRequired && selectedSpot) params.set("spot", selectedSpot);
        // First-timers sign the waiver before the booking goes through.
        const next = needsWaiver ? "waiver" : "processing";
        router.push(`/customer/classes/${detail.id}/book/${next}?${params.toString()}`);
    }

    return (
        <div className="flex min-h-full flex-col">
            {/* Header — solid frosted, centered title + close only. No progress bar
                or back button: progress + back belong to the multi-step appointment
                flow; the class confirmation is a single-step full-page modal. */}
            <header
                className={`sticky top-0 z-20 flex w-full items-center gap-3 px-4 py-3 transition-colors ${
                    scrolled ? "bg-white/80 backdrop-blur-md" : ""
                }`}
            >
                <div className="size-10 shrink-0" aria-hidden />
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">
                    Review and book
                </p>
                <button
                    type="button"
                    onClick={() => router.replace(`/customer/classes/${detail.id}`)}
                    aria-label="Close"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <XClose className="size-5 text-[#344054]" aria-hidden />
                </button>
            </header>

            {/* Content */}
            <div className="flex flex-1 flex-col gap-6 px-4 pb-6 pt-6">
                {/* Overview */}
                <div className="flex w-full items-center gap-3">
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
                        <p className="truncate text-base font-semibold leading-6 text-[var(--brand-text)]">{detail.name}</p>
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
                </div>

                <div className="h-px w-full bg-[#e4e7ec]" />

                {/* Location */}
                <section className="flex w-full flex-col gap-3">
                    <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Location</p>
                    <div className="flex w-full items-start gap-2">
                        <MarkerPin01 className="mt-0.5 size-4 shrink-0 text-[#667085]" aria-hidden />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <p className="text-sm font-medium leading-5 text-[var(--brand-text)]">{detail.branchName}</p>
                            <p className="text-sm font-normal leading-5 text-[#475467]">{detail.branchAddress}</p>
                        </div>
                    </div>
                </section>

                <div className="h-px w-full bg-[#e4e7ec]" />

                {/* Spot — picker when the admin enabled spot selection, else an
                    auto-assign note. */}
                <section className="flex w-full flex-col gap-3">
                    <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">
                        {spotLayout ? "Select spot" : "Spot"}
                    </p>
                    {spotLayout ? (
                        <SpotPicker
                            cols={spotLayout.cols}
                            rows={spotLayout.rows}
                            unavailable={takenSpots}
                            selected={selectedSpot}
                            onSelect={setSelectedSpot}
                        />
                    ) : (
                        <div className="flex w-full items-center gap-2 rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] p-4">
                            <Lightbulb02 className="size-4 shrink-0 text-[var(--brand-primary)]" aria-hidden />
                            <p className="text-sm font-normal leading-5 text-[#3f5b4c]">
                                A spot will be auto assigned to you.
                            </p>
                        </div>
                    )}
                </section>

                <div className="h-px w-full bg-[#e4e7ec]" />

                {/* Guest */}
                <section className="flex w-full flex-col gap-3">
                    <div className="flex w-full items-center justify-between">
                        <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Guest</p>
                        <button
                            type="button"
                            onClick={() => router.push(`/customer/classes/${detail.id}/book/guest?index=${guests.length}`)}
                            className="text-sm font-semibold leading-5 text-[var(--brand-primary)]"
                        >
                            Add guest
                        </button>
                    </div>
                    {guests.length === 0 ? (
                        <p className="text-sm font-normal leading-5 text-[#475467]">No guest added.</p>
                    ) : (
                        <div className="flex w-full flex-col gap-2">
                            {guests.map((g, i) => (
                                <div
                                    key={i}
                                    className="flex w-full items-center gap-3 rounded-xl border border-[#e4e7ec] bg-white p-4"
                                >
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">{g.name}</span>
                                        <span className="truncate text-sm font-normal leading-5 text-[#667085]">{g.email}</span>
                                    </div>
                                    {/* Remove a guest from inside the Edit screen (trash icon), not here. */}
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/customer/classes/${detail.id}/book/guest?index=${i}`)}
                                        className="shrink-0 text-sm font-semibold leading-5 text-[var(--brand-primary)]"
                                    >
                                        Edit
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* Bottom sheet — overlap warning + payment plan + confirm. */}
            <div
                className={`sticky bottom-0 z-10 flex flex-col gap-4 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
                    scrollable ? "bg-white" : ""
                }`}
            >
                {overlapClass && (
                    <div className="flex w-full items-start gap-2 rounded-xl border border-[#fec84b] bg-[#fffcf5] p-4">
                        <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#dc6803]" aria-hidden />
                        <p className="text-sm font-normal leading-5 text-[#93370d]">
                            The booking you&apos;re trying to make is overlapping with a session “{overlapClass.name}”
                            starting on {formatLongDate(overlapClass.dateISO)} at {to12h(overlapClass.startTime)}.
                        </p>
                    </div>
                )}
                {mode === "book" ? (
                    hasEligiblePlan ? (
                        <div className="flex w-full items-center gap-3 rounded-xl border-2 border-[var(--brand-primary)] bg-white p-4">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-[#feebff]">
                                <CoinsStacked03 className="size-4 text-[#344054]" aria-hidden />
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <p className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">{member?.planName}</p>
                                <p className="text-sm font-normal leading-5 text-[#475467]">{planLine}</p>
                            </div>
                        </div>
                    ) : guests.length === 0 ? (
                        <button
                            type="button"
                            onClick={() => router.push(`/customer/classes/${detail.id}/book/plans`)}
                            className="flex w-full items-center gap-3 rounded-xl border border-[#e4e7ec] bg-white p-4 text-left transition-colors active:bg-gray-50"
                        >
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#e4e7ec] bg-white">
                                <ShoppingBag03 className="size-5 text-[#344054]" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-base font-medium leading-6 text-[var(--brand-text)]">
                                Purchase product
                            </span>
                            <ChevronRight className="size-5 shrink-0 text-[#344054]" aria-hidden />
                        </button>
                    ) : null
                ) : (
                    <div className="flex w-full items-start gap-2 rounded-xl border border-[#e4e7ec] bg-[#f9fafb] p-4">
                        <Clock className="mt-0.5 size-4 shrink-0 text-[#667085]" aria-hidden />
                        <p className="text-sm font-normal leading-5 text-[#475467]">
                            You&apos;ll be notified if a spot opens up. No credit is charged until you&apos;re promoted.
                        </p>
                    </div>
                )}

                <Button
                    variant="primary"
                    size="xl"
                    className="w-full rounded-full"
                    disabled={needsPurchase || spotMissing || isClosed}
                    onClick={confirm}
                >
                    {isClosed ? "Booking closed" : spotMissing ? "Select a spot" : mode === "waitlist" ? "Join waitlist" : "Confirm booking"}
                </Button>
            </div>
        </div>
    );
}
