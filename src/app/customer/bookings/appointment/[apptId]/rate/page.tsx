"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Rate appointment (`/customer/bookings/appointment/[apptId]/rate`)
// ─────────────────────────────────────────────────────────────────────────────
// The appointment mirror of the class Rate flow (`[bookingId]/rate`). Star rating
// (required) + "What stood out" tags + optional comment. Submit writes to the
// SHARED `appointmentRatings` store (keyed by the linked admin appointment) so the
// completed-review state + admin rating summary read one source, then returns to
// the Appointment Detail in its rated state.

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clock, XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { useAppointmentBookingById } from "@/lib/customer/appointment-bookings";
import { useHasRatedAppointment } from "@/lib/customer/bookings-data";
import { to12h } from "@/lib/customer/dates";
import { useCustomerBack } from "@/lib/customer/use-customer-back";
import { useMainScrollable, useMainScrolled } from "@/lib/customer/use-scrollable";
import { CheckBox } from "@/components/customer/shell/SelectIndicators";
import { Button } from "@/components/ui/button";

const TAGS = ["Instructor", "Atmosphere", "Cleanliness", "Pacing", "Facilities", "Value"];

export default function RateAppointmentPage() {
    const router = useRouter();
    const { apptId } = useParams<{ apptId: string }>();
    const booking = useAppointmentBookingById(apptId);
    const member = useCurrentCustomer();
    const appointments = useAppStore((s) => s.appointments);
    const submitAppointmentRating = useAppStore((s) => s.submitAppointmentRating);
    const showToast = useAppStore((s) => s.showToast);
    const hasRated = useHasRatedAppointment(booking?.adminAppointmentId);
    const scrolled = useMainScrolled();
    const scrollable = useMainScrollable();

    const [score, setScore] = useState(0);
    const [tags, setTags] = useState<string[]>([]);
    const [comment, setComment] = useState("");
    const [anonymous, setAnonymous] = useState(false);

    const back = useCustomerBack(`/customer/bookings/appointment/${apptId}`);

    // Linked admin appointment — the rating target + instructor source.
    const adminAppt = booking?.adminAppointmentId
        ? appointments.find((a) => a.id === booking.adminAppointmentId)
        : undefined;
    const isCancelled = booking?.status === "cancelled" || adminAppt?.status === "Cancelled";
    const startMs = booking ? new Date(`${booking.slotISO}T${booking.slotTime}:00`).getTime() : 0;
    const isAttended = !!booking && !isCancelled && startMs <= Date.now();

    // Rateable only for an attended appointment that hasn't been rated yet, and
    // only once linked to a shared appointment (adminAppointmentId).
    if (!booking || !isAttended || !booking.adminAppointmentId || hasRated) {
        return (
            <div className="flex min-h-full flex-col">
                <header className="sticky top-0 z-20 flex items-center justify-end px-4 py-3">
                    <button
                        type="button"
                        onClick={back}
                        aria-label="Close"
                        className="flex size-10 items-center justify-center rounded-full border border-[var(--colors-border-secondary)] bg-white"
                    >
                        <XClose className="size-5 text-[var(--colors-text-secondary)]" aria-hidden />
                    </button>
                </header>
                <div className="flex flex-1 items-center justify-center px-6 text-center">
                    <p className="text-sm text-[var(--colors-text-tertiary)]">This appointment can't be rated.</p>
                </div>
            </div>
        );
    }

    const instructorName = adminAppt?.instructorName ?? booking.instructorName ?? "";
    const instructorInitials = adminAppt?.instructorInitials ?? booking.instructorInitials ?? "";
    const instructorImageUrl = adminAppt?.instructorImageUrl ?? booking.instructorImageUrl;
    const heroSubtitle = `${new Date(`${booking.slotISO}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
    })} at ${to12h(booking.slotTime)}`;

    function toggleTag(t: string) {
        setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
    }

    function submit() {
        if (score < 1 || !member || !booking?.adminAppointmentId) return;
        submitAppointmentRating({
            appointmentId: booking.adminAppointmentId,
            customerId: member.id,
            score,
            comment: comment.trim(),
            tags,
        });
        showToast("Thanks for rating", `Your review of ${booking.name} was submitted.`, "success");
        router.replace(`/customer/bookings/appointment/${apptId}`);
    }

    return (
        <div className="flex min-h-full flex-col">
            <header
                className={`sticky top-0 z-20 flex w-full items-center gap-3 px-4 py-3 transition-colors ${
                    scrolled ? "bg-white/80 backdrop-blur-md" : ""
                }`}
            >
                <div className="size-10 shrink-0" aria-hidden />
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">
                    Add ratings &amp; review
                </p>
                <button
                    type="button"
                    onClick={back}
                    aria-label="Close"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--colors-border-secondary)] bg-white transition-colors active:bg-gray-50"
                >
                    <XClose className="size-5 text-[var(--colors-text-secondary)]" aria-hidden />
                </button>
            </header>

            <div className="flex flex-1 flex-col gap-6 px-4 pb-4 pt-2">
                {/* Overview */}
                <div className="flex items-center gap-3">
                    <div
                        className="size-[82px] shrink-0 overflow-hidden rounded-[10px] border border-[var(--colors-border-secondary)]"
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
                            <p className="text-sm font-normal leading-5 text-[var(--colors-text-tertiary)]">{heroSubtitle}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-normal leading-5 text-[var(--colors-text-tertiary)]">
                            <span className="flex items-center gap-1">
                                <Clock className="size-4 shrink-0 text-[var(--colors-text-quaternary)]" aria-hidden />
                                {booking.durationMins} mins
                            </span>
                            {instructorName && (
                                <>
                                    <span aria-hidden>•</span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--colors-bg-tertiary)]">
                                            {instructorImageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={instructorImageUrl} alt="" className="size-full scale-[1.4] object-cover" />
                                            ) : (
                                                <span className="text-[8px] font-semibold leading-none text-[var(--colors-text-quaternary)]">
                                                    {instructorInitials}
                                                </span>
                                            )}
                                        </span>
                                        {instructorName}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />

                {/* Stars */}
                <section className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">How was your appointment?</p>
                        <p className="text-sm font-normal leading-5 text-[var(--colors-text-tertiary)]">
                            Your feedback helps improve future sessions.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((n) => {
                            const filled = n <= score;
                            const c = filled ? "#fdb022" : "#d5d9df";
                            return (
                                <button key={n} type="button" onClick={() => setScore(n)} aria-label={`${n} star${n === 1 ? "" : "s"}`}>
                                    <svg viewBox="0 0 24 24" className="size-10" fill={c} aria-hidden>
                                        <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                                    </svg>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />

                {/* What stood out */}
                <section className="flex flex-col gap-4">
                    <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">What stood out?</p>
                    <div className="flex flex-wrap gap-2">
                        {TAGS.map((t) => {
                            const on = tags.includes(t);
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => toggleTag(t)}
                                    className={`rounded-lg px-4 py-2 text-sm font-medium leading-5 text-[var(--colors-text-secondary)] transition-colors ${
                                        on ? "border-2 border-[var(--brand-primary)] bg-[var(--brand-tertiary)]" : "border border-[var(--colors-border-secondary)] bg-white"
                                    }`}
                                >
                                    {t}
                                </button>
                            );
                        })}
                    </div>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value.slice(0, 200))}
                        placeholder="Add a comment (optional)"
                        rows={4}
                        className="w-full resize-none rounded-md border border-[var(--colors-border-primary)] px-3.5 py-3 text-base font-normal leading-6 text-[var(--brand-text)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] outline-none placeholder:text-[var(--colors-text-quaternary)]"
                    />
                </section>
            </div>

            {/* Sticky submit */}
            <div
                className={`sticky bottom-0 z-10 flex flex-col gap-4 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
                    scrollable ? "bg-white" : ""
                }`}
            >
                <button type="button" onClick={() => setAnonymous((v) => !v)} className="flex items-center gap-2 self-start">
                    <CheckBox checked={anonymous} />
                    <span className="text-sm font-medium leading-5 text-[var(--colors-text-secondary)]">Rate as anonymous</span>
                </button>
                <Button variant="primary" size="xl" className="w-full rounded-full" disabled={score < 1} onClick={submit}>
                    Submit
                </Button>
            </div>
        </div>
    );
}
