"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Rate class (`/customer/bookings/[bookingId]/rate`) — Figma 3581-33751
// ─────────────────────────────────────────────────────────────────────────────
// Star rating (required) + "What stood out" tag chips + an optional comment, with
// a "Rate as anonymous" toggle. Submit writes a class_ratings row (recomputing the
// class aggregate) and returns to the Booking Detail in its rated state.

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clock, XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { useBookingDetail } from "@/lib/customer/bookings-data";
import { useMainScrollable, useMainScrolled } from "@/lib/customer/use-scrollable";
import { CheckBox } from "@/components/customer/shell/SelectIndicators";
import { Button } from "@/components/ui/button";

const TAGS = ["Instructor", "Atmosphere", "Difficulty", "Pacing", "Music", "Equipment"];

export default function RateBookingPage() {
    const router = useRouter();
    const { bookingId } = useParams<{ bookingId: string }>();
    const vm = useBookingDetail(bookingId);
    const member = useCurrentCustomer();
    const submitClassRating = useAppStore((s) => s.submitClassRating);
    const showToast = useAppStore((s) => s.showToast);
    const scrolled = useMainScrolled();
    const scrollable = useMainScrollable();

    const [score, setScore] = useState(0);
    const [tags, setTags] = useState<string[]>([]);
    const [comment, setComment] = useState("");
    const [anonymous, setAnonymous] = useState(false);

    const back = () => router.push(`/customer/bookings/${bookingId}`);

    if (!vm || vm.viewStatus !== "attended") {
        return (
            <div className="flex min-h-full flex-col">
                <header className="sticky top-0 z-20 flex items-center justify-end px-4 py-3">
                    <button
                        type="button"
                        onClick={back}
                        aria-label="Close"
                        className="flex size-10 items-center justify-center rounded-full border border-[#e4e7ec] bg-white"
                    >
                        <XClose className="size-5 text-[#344054]" aria-hidden />
                    </button>
                </header>
                <div className="flex flex-1 items-center justify-center px-6 text-center">
                    <p className="text-sm text-[#475467]">This class can't be rated.</p>
                </div>
            </div>
        );
    }

    const { detail, heroSubtitle } = vm;

    function toggleTag(t: string) {
        setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
    }

    function submit() {
        if (score < 1 || !member) return;
        submitClassRating({
            classScheduleId: detail.id,
            customerId: member.id,
            instructorId: detail.instructorId,
            score,
            comment: comment.trim(),
            tags,
        });
        showToast("Thanks for rating", `Your review of ${detail.name} was submitted.`, "success");
        back();
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
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <XClose className="size-5 text-[#344054]" aria-hidden />
                </button>
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
                            <p className="text-sm font-normal leading-5 text-[#475467]">{heroSubtitle}</p>
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

                <div className="h-px w-full bg-[#e4e7ec]" />

                {/* Stars */}
                <section className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">How was your class?</p>
                        <p className="text-sm font-normal leading-5 text-[#475467]">
                            Your feedback helps improve future classes.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((n) => {
                            const filled = n <= score;
                            // Sharp filled star (Figma 3581-33534) — grey placeholder, gold when picked.
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

                <div className="h-px w-full bg-[#e4e7ec]" />

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
                                    className={`rounded-lg px-4 py-2 text-sm font-medium leading-5 text-[#344054] transition-colors ${
                                        on ? "border-2 border-[var(--brand-primary)] bg-[var(--brand-tertiary)]" : "border border-[#e4e7ec] bg-white"
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
                        className="w-full resize-none rounded-md border border-[#d0d5dd] px-3.5 py-3 text-base font-normal leading-6 text-[var(--brand-text)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] outline-none placeholder:text-[#667085]"
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
                    <span className="text-sm font-medium leading-5 text-[#344054]">Rate as anonymous</span>
                </button>
                <Button variant="primary" size="xl" className="w-full rounded-full" disabled={score < 1} onClick={submit}>
                    Submit
                </Button>
            </div>
        </div>
    );
}
