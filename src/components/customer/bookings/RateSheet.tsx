"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — RateSheet — "Add ratings & review" as a bottom sheet
// ─────────────────────────────────────────────────────────────────────────────
//
// The sheet version of the class / appointment Rate flow (Figma 3581-33751). Star
// rating (required) + "What stood out" tag chips + an optional comment + a "Rate
// as anonymous" toggle. Opened from a booking card / detail via a `rateHref`
// (`…/rate` or `…/appointment/<id>/rate`); the same href the routes use, so one
// component covers both. Submit writes the rating (class or appointment store)
// and closes. Reuses the shared CustomerSheet chrome (header + scroll + footer).

import { useEffect, useState } from "react";
import { Clock, XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { useBookingDetail } from "@/lib/customer/bookings-data";
import { useAppointmentBookingById } from "@/lib/customer/appointment-bookings";
import { to12h } from "@/lib/customer/dates";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { CheckBox } from "@/components/customer/shell/SelectIndicators";
import { Button } from "@/components/ui/button";

const CLASS_TAGS = ["Instructor", "Atmosphere", "Difficulty", "Pacing", "Music", "Equipment"];
const APPT_TAGS = ["Instructor", "Atmosphere", "Cleanliness", "Pacing", "Facilities", "Value"];

export function RateSheet({
    open,
    onClose,
    rateHref,
    onRated,
}: {
    open: boolean;
    onClose: () => void;
    /** `/customer/bookings/<id>/rate` or `/customer/bookings/appointment/<id>/rate`. */
    rateHref: string | null;
    /** Fires after a successful submit (host can refresh its list / state). */
    onRated?: () => void;
}) {
    const isAppt = !!rateHref && rateHref.includes("/appointment/");
    const id = rateHref ? rateHref.split("/rate")[0].split("/").pop() ?? "" : "";
    const classId = isAppt ? "" : id;
    const apptId = isAppt ? id : "";

    const member = useCurrentCustomer();
    const classVm = useBookingDetail(classId);
    const apptBooking = useAppointmentBookingById(apptId);
    const appointments = useAppStore((s) => s.appointments);
    const submitClassRating = useAppStore((s) => s.submitClassRating);
    const submitAppointmentRating = useAppStore((s) => s.submitAppointmentRating);
    const showToast = useAppStore((s) => s.showToast);

    const [score, setScore] = useState(0);
    const [tags, setTags] = useState<string[]>([]);
    const [comment, setComment] = useState("");
    const [anonymous, setAnonymous] = useState(false);

    // Clean slate every time the sheet opens (or the target changes).
    useEffect(() => {
        if (open) {
            setScore(0);
            setTags([]);
            setComment("");
            setAnonymous(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, rateHref]);

    const apptAdmin = apptBooking?.adminAppointmentId
        ? appointments.find((a) => a.id === apptBooking.adminAppointmentId)
        : undefined;

    // Unified overview across the two booking kinds.
    const overview =
        isAppt && apptBooking
            ? {
                  name: apptBooking.name,
                  coverImage: apptBooking.coverImage,
                  coverColor: apptBooking.coverColor,
                  durationMins: apptBooking.durationMins,
                  subtitle: `${new Date(`${apptBooking.slotISO}T00:00:00`).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                  })} at ${to12h(apptBooking.slotTime)}`,
                  instructorName: apptAdmin?.instructorName ?? apptBooking.instructorName ?? "",
                  instructorInitials: apptAdmin?.instructorInitials ?? apptBooking.instructorInitials ?? "",
                  instructorImageUrl: apptAdmin?.instructorImageUrl ?? apptBooking.instructorImageUrl,
              }
            : classVm
              ? {
                    name: classVm.detail.name,
                    coverImage: classVm.detail.coverImage,
                    coverColor: classVm.detail.coverColor,
                    durationMins: classVm.detail.durationMins,
                    subtitle: classVm.heroSubtitle,
                    instructorName: classVm.detail.instructorName,
                    instructorInitials: classVm.detail.instructorInitials,
                    instructorImageUrl: classVm.detail.instructorImageUrl,
                }
              : null;

    const TAGS = isAppt ? APPT_TAGS : CLASS_TAGS;

    function toggleTag(t: string) {
        setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
    }

    function submit() {
        if (score < 1 || !member) return;
        if (isAppt && apptBooking?.adminAppointmentId) {
            submitAppointmentRating({
                appointmentId: apptBooking.adminAppointmentId,
                customerId: member.id,
                score,
                comment: comment.trim(),
                tags,
            });
            showToast("Thanks for rating", `Your review of ${apptBooking.name} was submitted.`, "success");
        } else if (classVm) {
            submitClassRating({
                classScheduleId: classVm.detail.id,
                customerId: member.id,
                instructorId: classVm.detail.instructorId,
                score,
                comment: comment.trim(),
                tags,
            });
            showToast("Thanks for rating", `Your review of ${classVm.detail.name} was submitted.`, "success");
        }
        onRated?.();
        onClose();
    }

    return (
        <CustomerSheet open={open} onClose={onClose} tall>
            {/* Header — centred title + X close (reuses the sheet chrome). */}
            <div className="relative flex shrink-0 items-center justify-center pb-3">
                <p className="text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">Add ratings &amp; review</p>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-0 flex size-8 items-center justify-center rounded-full border border-[var(--colors-border-secondary)] bg-white transition-colors active:bg-gray-50"
                >
                    <XClose className="size-5 text-[var(--colors-text-secondary)]" aria-hidden />
                </button>
            </div>

            {/* Scroll body */}
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {overview && (
                    <>
                        {/* Overview */}
                        <div className="flex items-center gap-3">
                            <div
                                className="size-[82px] shrink-0 overflow-hidden rounded-[10px] border border-[var(--colors-border-secondary)]"
                                style={!overview.coverImage ? { backgroundColor: overview.coverColor } : undefined}
                            >
                                {overview.coverImage && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={overview.coverImage} alt="" className="size-full object-cover" />
                                )}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <div className="flex flex-col">
                                    <p className="truncate text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">{overview.name}</p>
                                    <p className="text-sm font-normal leading-5 text-[var(--colors-text-tertiary)]">{overview.subtitle}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-normal leading-5 text-[var(--colors-text-tertiary)]">
                                    <span className="flex items-center gap-1">
                                        <Clock className="size-4 shrink-0 text-[var(--colors-text-quaternary)]" aria-hidden />
                                        {overview.durationMins} mins
                                    </span>
                                    {overview.instructorName && (
                                        <>
                                            <span aria-hidden>•</span>
                                            <span className="flex items-center gap-1.5">
                                                <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--colors-bg-tertiary)]">
                                                    {overview.instructorImageUrl ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={overview.instructorImageUrl} alt="" className="size-full scale-[1.4] object-cover" />
                                                    ) : (
                                                        <span className="text-[8px] font-semibold leading-none text-[var(--colors-text-quaternary)]">
                                                            {overview.instructorInitials}
                                                        </span>
                                                    )}
                                                </span>
                                                {overview.instructorName}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="h-px w-full shrink-0 bg-[var(--colors-bg-quaternary)]" />

                        {/* Stars */}
                        <section className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <p className="text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">How was your {isAppt ? "session" : "class"}?</p>
                                <p className="text-sm font-normal leading-5 text-[var(--colors-text-tertiary)]">
                                    Your feedback helps improve future {isAppt ? "sessions" : "classes"}.
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

                        <div className="h-px w-full shrink-0 bg-[var(--colors-bg-quaternary)]" />

                        {/* What stood out */}
                        <section className="flex flex-col gap-4">
                            <p className="text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">What stood out?</p>
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
                    </>
                )}
            </div>

            {/* Footer — anonymous toggle + Submit. */}
            <div className="flex shrink-0 flex-col gap-4 pt-4">
                <button type="button" onClick={() => setAnonymous((v) => !v)} className="flex items-center gap-2 self-start">
                    <CheckBox checked={anonymous} />
                    <span className="text-sm font-medium leading-5 text-[var(--colors-text-secondary)]">Rate as anonymous</span>
                </button>
                <Button variant="primary" size="xl" className="w-full rounded-full" disabled={score < 1} onClick={submit}>
                    Submit
                </Button>
            </div>
        </CustomerSheet>
    );
}
