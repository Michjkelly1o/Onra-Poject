"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Appointment booking detail (`/customer/bookings/appointment/[apptId]`)
// ─────────────────────────────────────────────────────────────────────────────
//
// Reuses the shared <ClassDetailLayout> (same hero + status card + sections +
// sticky action as the class Booking Detail), reworded for appointments: an
// "Appointment details" description, an appointment info grid (Duration ·
// Session type · Instructor/Capacity), a Booked/Cancelled status card, and a
// Cancel-appointment action for upcoming bookings. Backed by the UI-only
// appointment-bookings store.

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCustomerBack } from "@/lib/customer/use-customer-back";
import { RefreshCcw01, CheckCircle, ChevronLeft, ClockFastForward, Coins01, SlashCircle01, UserCheck01, Users01 } from "@untitledui/icons";
import { to12h } from "@/lib/customer/dates";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { classTimeDisplay } from "@/lib/customer/class-time";
import { cancelAppointmentBooking, useAppointmentBookingById } from "@/lib/customer/appointment-bookings";
import { addCustomerNotification } from "@/lib/customer/notifications-feed";
import { useAppStore } from "@/lib/store";
import type { ClassDetailVM } from "@/lib/customer/search-data";
import { useHasRatedAppointment, useAppointmentReviews } from "@/lib/customer/bookings-data";
import { ClassDetailLayout, DetailTimeRow, InfoRow } from "@/components/customer/classes/ClassDetailLayout";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { CancelConfirmSheet } from "@/components/customer/bookings/CancelConfirmSheet";
import { RateSheet } from "@/components/customer/bookings/RateSheet";
import { RatingsSection } from "@/components/customer/bookings/RatingsSection";
import { Button } from "@/components/ui/button";
import { BookingDetailSections, type BookingRefund } from "@/components/customer/bookings/GuestBookToSection";

// Destructive secondary (matches the class Cancel-booking button).
const CANCEL_BTN =
    "border-[#fda29b] bg-[#fef3f2] text-[#b42318] hover:bg-[#fee4e2] hover:text-[#912018] active:bg-[#fee4e2] active:text-[#912018]";

export default function AppointmentBookingDetailPage() {
    const router = useRouter();
    const { apptId } = useParams<{ apptId: string }>();
    const booking = useAppointmentBookingById(apptId);
    // Hooks must run every render (before any early return) — Rules of Hooks.
    const branches = useAppStore(s => s.branches);
    const services = useAppStore(s => s.services);
    const rooms = useAppStore(s => s.rooms);
    const appointments = useAppStore(s => s.appointments);
    const cancelAdminAppointment = useAppStore(s => s.cancelAppointment);
    const showToast = useAppStore(s => s.showToast);
    const cancellationPolicy = useAppStore(s => s.cancellationPolicy);
    // Effectively cancelled if the customer cancelled OR an admin cancelled the
    // linked shared appointment — drives the Back target (Past vs Upcoming).
    const backIsCancelled =
        booking?.status === "cancelled" ||
        (booking?.adminAppointmentId != null &&
            appointments.find(a => a.id === booking.adminAppointmentId)?.status === "Cancelled");
    const goBack = useCustomerBack(
        backIsCancelled ? "/customer/bookings/past" : "/customer/bookings/upcoming",
    );
    const { timezone, localTimezone, member } = useCurrentCustomerContext();
    const [cancelOpen, setCancelOpen] = useState(false);
    const [rateOpen, setRateOpen] = useState(false);
    // Rating state — keyed by the linked shared appointment (adminAppointmentId)
    // so the review + admin summary read one source. Mirrors the class flow.
    const ratedAppointmentId = booking?.adminAppointmentId;
    const hasRated = useHasRatedAppointment(ratedAppointmentId);
    const reviews = useAppointmentReviews(ratedAppointmentId);

    if (!booking) {
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
                    <p className="text-base font-semibold text-[var(--brand-text)] font-heading">This booking is no longer available</p>
                    <Button variant="secondary" size="sm" className="rounded-full" onClick={() => router.push("/customer/bookings")}>
                        Back to Bookings
                    </Button>
                </div>
            </div>
        );
    }

    // Linked admin appointment (created at booking time). It's the shared source
    // of truth for the instructor + cancellation, so an admin-side reassignment
    // or cancellation reflects here without a second write to this store.
    const adminAppt = booking.adminAppointmentId
        ? appointments.find(a => a.id === booking.adminAppointmentId)
        : undefined;
    // Instructor — prefer the (possibly reassigned) admin appointment values.
    const instructorId = adminAppt?.instructorId ?? booking.instructorId ?? "";
    const instructorName = adminAppt?.instructorName ?? booking.instructorName ?? "";
    const instructorInitials = adminAppt?.instructorInitials ?? booking.instructorInitials ?? "";
    const instructorImageUrl = adminAppt?.instructorImageUrl ?? booking.instructorImageUrl;

    const isPrivate = booking.type === "private";
    // Cancelled if the customer cancelled OR an admin cancelled the linked appt.
    const isCancelled = booking.status === "cancelled" || adminAppt?.status === "Cancelled";
    const startMs = new Date(`${booking.slotISO}T${booking.slotTime}:00`).getTime();
    const isUpcoming = !isCancelled && startMs > Date.now();
    // A finished (past), non-cancelled appointment is "Attended" — mirrors the
    // class booking's attended state so every booking type reads consistently.
    const isAttended = !isCancelled && !isUpcoming;

    // Resolve the appointment's location from the LIVE service config (admin
    // side) so it always reflects the current Private/Recovery setup:
    //   • service assigned to a branch  → show that branch's full details.
    //   • service also assigned a room  → prefix the room on the name line.
    // Falls back to matching the branch by the snapshotted name if the service
    // was archived/removed, so existing bookings still resolve a branch.
    const service = services.find(s => s.id === booking.appointmentId);
    const branch =
        (service ? branches.find(b => b.id === service.branchId) : undefined) ??
        branches.find(b => b.name === booking.branchName);
    // Room name from the service's default room (empty when none configured).
    const roomName = service?.roomId ? rooms.find(r => r.id === service.roomId)?.name ?? "" : "";
    // Dual-timezone Date & time for the info grid — same as the class detail.
    const apptTime = classTimeDisplay(booking.slotISO, booking.slotTime, branch, timezone);

    // Cancel outcome follows the studio's Booking-Rules cancellation window
    // (Settings), read live — not a hardcoded 24h. On-time (≥ window → full AED
    // refund) vs late (< window → forfeited).
    const lateWindowHours = cancellationPolicy.credit_within_window_unit === "minutes"
        ? cancellationPolicy.credit_within_window_value / 60
        : cancellationPolicy.credit_within_window_value;
    const windowLabel = `${cancellationPolicy.credit_within_window_value} ${cancellationPolicy.credit_within_window_unit}`;
    const isLate = (startMs - Date.now()) / 3_600_000 < lateWindowHours;
    const cancelFullDate = new Date(`${booking.slotISO}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long", day: "numeric", month: "short", year: "numeric",
    });
    const cancelCopy = isLate
        ? { title: "Cancel this appointment?", description: `This cancellation is within ${windowLabel} of the appointment. No refund will be issued.`, confirmLabel: "Yes, cancel appointment", refundNote: undefined as string | undefined }
        : { title: "Cancel this appointment?", description: "This will cancel your appointment.", confirmLabel: "Yes, cancel appointment", refundNote: `AED ${booking.price} refunded to your account` };
    function confirmCancel() {
        if (!booking) return;
        cancelAppointmentBooking(apptId, isLate);
        // Cascade to the linked admin appointment so it drops off the admin
        // schedule / shows Cancelled in Appointment Details. Refund on-time.
        if (booking.adminAppointmentId) {
            cancelAdminAppointment(booking.adminAppointmentId, !isLate, "customer");
        }
        addCustomerNotification({
            tab: "bookings",
            event: "appointment_cancelled",
            title: "Appointment cancelled",
            message: `Your ${booking.name} appointment on ${cancelFullDate} has been cancelled.`,
            relatedType: "appointment",
            relatedId: apptId,
        });
        showToast(
            "Appointment cancelled",
            isLate ? `No refund was issued — cancelled within ${windowLabel}.` : `AED ${booking.price} has been refunded to your account.`,
            "success",
            isLate ? "slash" : "check",
        );
        router.replace("/customer/bookings/past");
    }

    // Map the appointment booking onto the class detail view-model. Fields the
    // appointment grid/location don't use are given safe placeholders; equipment
    // is empty so that section auto-hides.
    const detail: ClassDetailVM = {
        id: booking.appointmentId,
        name: booking.name,
        category: booking.category,
        coverImage: booking.coverImage,
        coverColor: booking.coverColor,
        instructorId,
        instructorName,
        instructorInitials,
        instructorColor: "#f2f4f7",
        instructorImageUrl,
        room: roomName,
        branchId: branch?.id ?? "",
        branchName: branch?.name ?? booking.branchName,
        dateISO: booking.slotISO,
        startTime: booking.slotTime,
        endTime: "",
        durationMins: booking.durationMins,
        booked: 0,
        capacity: booking.capacity ?? 0,
        spotsLeft: 0,
        waitlistEnabled: false,
        waitlistSpotsLeft: null,
        waitlistCount: 0,
        maxWaitlist: 0,
        waitlistPosition: null,
        state: "booked",
        description: booking.description,
        equipment: [],
        classType: isPrivate ? "Private" : "Group",
        rating: 0,
        ratingCount: 0,
        branchAddress: booking.branchAddress ?? "",
        spotSelectionEnabled: false,
    };

    const heroBadge = isCancelled ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full border border-[#fecdca] bg-[#fef3f2] px-2 py-0.5 text-xs font-medium leading-[18px] text-[#b42318]">
            {booking.lateCancel ? <SlashCircle01 className="size-3" aria-hidden /> : <RefreshCcw01 className="size-3" aria-hidden />}
            {booking.lateCancel ? "Cancelled (late)" : "Cancelled (no charge)"}
        </span>
    ) : (
        <span className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] px-2 py-0.5 text-xs font-medium leading-[18px] text-[var(--brand-primary)]">
            <CheckCircle className="size-3" aria-hidden />
            {isAttended ? "Attended" : "Booked"}
        </span>
    );

    const statusBlock = (
        <div
            className={`relative flex items-start gap-4 overflow-hidden rounded-2xl border p-4 ${
                isCancelled ? "border-[var(--colors-border-secondary)] bg-[var(--colors-bg-secondary)]" : "border-[var(--brand-primary)] bg-[var(--brand-tertiary)]"
            }`}
        >
            <div aria-hidden className="pointer-events-none absolute right-0 top-0" style={{ opacity: 0.5 }}>
                {[96, 168, 240, 312].map((d) => (
                    <span
                        key={d}
                        className="absolute rounded-full border"
                        style={{
                            width: d,
                            height: d,
                            right: -14 - d / 2,
                            top: -14 - d / 2,
                            borderColor: isCancelled ? "#e4e7ec" : "var(--brand-tertiary)",
                        }}
                    />
                ))}
            </div>
            <div className="relative flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-sm font-semibold leading-5 text-[var(--brand-text)]">
                    {isCancelled
                        ? booking.lateCancel
                            ? "Cancelled (late)"
                            : "Cancelled (no charge)"
                        : isAttended
                          ? "Appointment attended"
                          : "Appointment confirmed"}
                </p>
                <p className="text-xs font-normal leading-[18px] text-[var(--colors-text-secondary)]">
                    {isCancelled
                        ? booking.lateCancel
                            ? `This appointment was cancelled within ${windowLabel} — no refund was issued.`
                            : "This appointment was cancelled and your refund has been processed."
                        : isAttended
                          ? "Your attendance has been recorded."
                          : "Your appointment is confirmed. Please arrive a few minutes before your scheduled time."}
                </p>
            </div>
            {isCancelled ? (
                booking.lateCancel ? (
                    <SlashCircle01 className="relative size-5 shrink-0 text-[#d92d20]" aria-hidden />
                ) : (
                    <RefreshCcw01 className="relative size-5 shrink-0 text-[#d92d20]" aria-hidden />
                )
            ) : (
                <CheckCircle className="relative size-5 shrink-0 text-[var(--brand-primary)]" aria-hidden />
            )}
        </div>
    );

    const infoGrid = (
        <div className="flex flex-col gap-4">
            <DetailTimeRow time={apptTime} label={timezone === localTimezone ? "Your time" : timezone} />
            <InfoRow icon={ClockFastForward}>
                <span>{booking.durationMins} minutes</span>
            </InfoRow>
            <InfoRow icon={Coins01}>
                <span>{isPrivate ? "Private" : "Open session"}</span>
            </InfoRow>
            {isPrivate && instructorName ? (
                <InfoRow icon={UserCheck01}>
                    <button
                        type="button"
                        onClick={() => instructorId && router.push(`/customer/instructors/${instructorId}`)}
                        className="flex min-w-0 items-center gap-1.5 text-left"
                    >
                        <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--colors-bg-tertiary)]">
                            {instructorImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={instructorImageUrl} alt="" className="size-full scale-[1.4] object-cover" />
                            ) : (
                                <span className="text-[8px] font-semibold leading-none text-[var(--colors-text-quaternary)]">{instructorInitials}</span>
                            )}
                        </span>
                        <span className="truncate">{instructorName}</span>
                    </button>
                </InfoRow>
            ) : (
                <InfoRow icon={Users01}>
                    <span>{booking.capacity ? `${booking.capacity} participants` : "Group session"}</span>
                </InfoRow>
            )}
        </div>
    );

    // Refund folds into Payment detail for a cancelled appointment (paid in AED):
    // late cancel forfeits the fee, an on-time cancel refunds it in full.
    const refund: BookingRefund | null = isCancelled
        ? booking.lateCancel
            ? { amount: "AED 0", status: `Not refunded — cancelled within ${windowLabel}` }
            : { amount: `AED ${booking.price}`, status: "Refunded" }
        : null;

    const actionZone = isUpcoming ? (
        <Button
            variant="secondary"
            size="xl"
            className={`w-full rounded-full ${CANCEL_BTN}`}
            onClick={() => setCancelOpen(true)}
        >
            Cancel appointment
        </Button>
    ) : isAttended && !hasRated ? (
        // Attended + not yet rated → the same "Rate" flow as classes.
        <Button
            variant="primary"
            size="xl"
            className="w-full rounded-full"
            onClick={() => setRateOpen(true)}
        >
            Rate appointment
        </Button>
    ) : undefined;

    // Book to (always yourself for an appointment) + Payment detail — the refund
    // breakdown folds into Payment detail for a cancelled booking. Attended shows
    // its rating + reviews after.
    const afterLocation = (
        <>
            <BookingDetailSections
                name={`${member?.firstName ?? ""} ${member?.lastName ?? ""}`.trim() || "You"}
                email={member?.email}
                initial={member?.initials}
                imageUrl={member?.imageUrl}
                amount={`AED ${booking.price}`}
                payWith={booking.paymentMethod || "Card"}
                refund={refund}
            />
            {isAttended && (
                <RatingsSection reviews={reviews} onMoreReviews={() => router.push(`/customer/bookings/appointment/${apptId}/reviews`)} />
            )}
        </>
    );

    return (
        <>
        <ClassDetailLayout
            detail={detail}
            mutedCover={isCancelled}
            detailsHeading="Appointment details"
            infoGrid={infoGrid}
            statusBlock={statusBlock}
            heroBadge={heroBadge}
            afterLocation={afterLocation}
            onBack={goBack}
            actionZone={actionZone}
            stickyAction={!isUpcoming}
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
        <RateSheet
            open={rateOpen}
            onClose={() => setRateOpen(false)}
            rateHref={`/customer/bookings/appointment/${apptId}/rate`}
        />
        </>
    );
}
