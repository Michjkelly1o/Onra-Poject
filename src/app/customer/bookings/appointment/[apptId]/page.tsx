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
import { ClassDetailLayout, DetailTimeRow, InfoRow } from "@/components/customer/classes/ClassDetailLayout";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { CancelConfirmSheet } from "@/components/customer/bookings/CancelConfirmSheet";
import { Button } from "@/components/ui/button";
import { RefundDetailsSection, type RefundLine } from "@/components/customer/bookings/RefundDetailsSection";

// Destructive secondary (matches the class Cancel-booking button).
const CANCEL_BTN =
    "border-[#fda29b] bg-[#fef3f2] text-[#b42318] hover:bg-[#fee4e2] hover:text-[#912018] active:bg-[#fee4e2] active:text-[#912018]";

export default function AppointmentBookingDetailPage() {
    const router = useRouter();
    const goBack = useCustomerBack("/customer/bookings/upcoming");
    const { apptId } = useParams<{ apptId: string }>();
    const booking = useAppointmentBookingById(apptId);
    // Hooks must run every render (before any early return) — Rules of Hooks.
    const branches = useAppStore(s => s.branches);
    const showToast = useAppStore(s => s.showToast);
    const { localTimezone } = useCurrentCustomerContext();
    const [cancelOpen, setCancelOpen] = useState(false);

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
                    <p className="text-base font-semibold text-[var(--brand-text)]">This booking is no longer available</p>
                    <Button variant="secondary" size="sm" className="rounded-full" onClick={() => router.push("/customer/bookings")}>
                        Back to Bookings
                    </Button>
                </div>
            </div>
        );
    }

    const isPrivate = booking.type === "private";
    const isCancelled = booking.status === "cancelled";
    const startMs = new Date(`${booking.slotISO}T${booking.slotTime}:00`).getTime();
    const isUpcoming = !isCancelled && startMs > Date.now();

    // Resolve the appointment's branch (by name — the UI-only booking store
    // carries branchName only) → its TZ label. Stacked on its own line under
    // the subtitle so members with cross-city bookings never have to guess.
    const branch = branches.find(b => b.name === booking.branchName);
    // Dual-timezone Date & time for the info grid — same as the class detail.
    const apptTime = classTimeDisplay(booking.slotISO, booking.slotTime, branch, localTimezone);

    // Cancel outcome — on-time (≥24h → full AED refund) vs late (<24h → forfeited).
    const isLate = (startMs - Date.now()) / 3_600_000 < 24;
    const cancelFullDate = new Date(`${booking.slotISO}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long", day: "numeric", month: "short", year: "numeric",
    });
    const cancelCopy = isLate
        ? { title: "Cancel this appointment?", description: "This cancellation is within 24 hours. No refund will be issued.", confirmLabel: "Yes, cancel appointment", refundNote: undefined as string | undefined }
        : { title: "Cancel this appointment?", description: "This will cancel your appointment.", confirmLabel: "Yes, cancel appointment", refundNote: `AED ${booking.price} refunded to your account` };
    function confirmCancel() {
        if (!booking) return;
        cancelAppointmentBooking(apptId, isLate);
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
            isLate ? "No refund was issued — cancelled within 24 hours." : `AED ${booking.price} has been refunded to your account.`,
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
        instructorId: booking.instructorId ?? "",
        instructorName: booking.instructorName ?? "",
        instructorInitials: booking.instructorInitials ?? "",
        instructorColor: "#f2f4f7",
        instructorImageUrl: booking.instructorImageUrl,
        room: "",
        branchId: "",
        branchName: booking.branchName,
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
            Booked
        </span>
    );

    const statusBlock = (
        <div
            className={`relative flex items-start gap-4 overflow-hidden rounded-2xl border p-4 ${
                isCancelled ? "border-[#e4e7ec] bg-[#f9fafb]" : "border-[var(--brand-primary)] bg-[var(--brand-tertiary)]"
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
                        : "Appointment confirmed"}
                </p>
                <p className="text-xs font-normal leading-[18px] text-[#344054]">
                    {isCancelled
                        ? booking.lateCancel
                            ? "This appointment was cancelled within 24 hours — no refund was issued."
                            : "This appointment was cancelled and your refund has been processed."
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
            <DetailTimeRow time={apptTime} />
            <InfoRow icon={ClockFastForward}>
                <span>{booking.durationMins} minutes</span>
            </InfoRow>
            <InfoRow icon={Coins01}>
                <span>{isPrivate ? "Private" : "Open session"}</span>
            </InfoRow>
            {isPrivate && booking.instructorName ? (
                <InfoRow icon={UserCheck01}>
                    <button
                        type="button"
                        onClick={() => booking.instructorId && router.push(`/customer/instructors/${booking.instructorId}`)}
                        className="flex min-w-0 items-center gap-1.5 text-left"
                    >
                        <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f4f7]">
                            {booking.instructorImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={booking.instructorImageUrl} alt="" className="size-full scale-[1.4] object-cover" />
                            ) : (
                                <span className="text-[8px] font-semibold leading-none text-[#667085]">{booking.instructorInitials}</span>
                            )}
                        </span>
                        <span className="truncate">{booking.instructorName}</span>
                    </button>
                </InfoRow>
            ) : (
                <InfoRow icon={Users01}>
                    <span>{booking.capacity ? `${booking.capacity} participants` : "Group session"}</span>
                </InfoRow>
            )}
        </div>
    );

    // Refund breakdown for a cancelled appointment (paid in AED, not credit).
    const refundLines: RefundLine[] | null = isCancelled
        ? booking.lateCancel
            ? [
                  { label: "You've paid", value: `AED ${booking.price}` },
                  { label: "Your refund", value: "AED 0", tone: "muted" },
                  { label: "Status", value: "Not refunded — cancelled within 24 hours", tone: "muted" },
              ]
            : [
                  { label: "You've paid", value: `AED ${booking.price}` },
                  { label: "Your refund", value: `AED ${booking.price}` },
                  { label: "Refund via", value: booking.paymentMethod ?? "Original payment method" },
                  { label: "Status", value: "Refunded" },
              ]
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
    ) : undefined;

    return (
        <>
        <ClassDetailLayout
            detail={detail}
            mutedCover={isCancelled}
            detailsHeading="Appointment details"
            infoGrid={infoGrid}
            statusBlock={statusBlock}
            heroBadge={heroBadge}
            afterLocation={refundLines ? <RefundDetailsSection lines={refundLines} /> : undefined}
            onBack={goBack}
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
