"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Booking Processing (`/customer/classes/[id]/book/processing`) — Phase 5
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 2134-23719. Transient full-screen loader (no nav, no back). Performs the
// actual booking write once on mount, then sequences a 3-step status over it for
// realism before routing to Success. The active step is brand-green + large; the
// done step fades above and upcoming steps fade below (windowed at a fixed slot).

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { bookingDraft } from "@/lib/customer/booking-flow";

const STEPS = ["Checking availability", "Securing your spot", "Confirming your booking"];
const STEP_MS = 900;

export default function BookingProcessingPage() {
    return (
        <Suspense fallback={<div className="min-h-full" />}>
            <BookingProcessing />
        </Suspense>
    );
}

function StepLine({ text, variant }: { text: string; variant: "done" | "active" | "next" }) {
    if (variant === "active") {
        return <p className="text-xl font-semibold leading-[30px] text-[#4f6e5d]">{text}</p>;
    }
    return (
        <p className={`text-base font-semibold leading-6 text-[#344054] ${variant === "done" ? "opacity-30" : "opacity-10"}`}>
            {text || " "}
        </p>
    );
}

function BookingProcessing() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const search = useSearchParams();
    const mode = search.get("mode") === "waitlist" ? "waitlist" : "book";
    const spot = search.get("spot") ?? undefined;

    const { member } = useCurrentCustomerContext();
    const addClassBooking = useAppStore((s) => s.addClassBooking);
    const [step, setStep] = useState(0);
    const wroteRef = useRef(false);

    useEffect(() => {
        // Perform the write once (synchronous), then sequence the steps over it.
        if (!wroteRef.current && member) {
            wroteRef.current = true;
            addClassBooking({
                classScheduleId: id,
                customerId: member.id,
                status: mode === "waitlist" ? "waitlisted" : "booked",
                spot,
            });
            bookingDraft.classId = null;
            bookingDraft.guests = [];
        }
        const t1 = setTimeout(() => setStep(1), STEP_MS);
        const t2 = setTimeout(() => setStep(2), STEP_MS * 2);
        const t3 = setTimeout(
            () => router.replace(`/customer/classes/${id}/book/success?mode=${mode}`),
            STEP_MS * 3,
        );
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="flex min-h-full flex-col items-center justify-center gap-12 px-4">
            {/* 3-dot loader */}
            <div className="flex items-center gap-1.5" aria-label="Processing">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="size-2 animate-bounce rounded-full bg-[#658774]"
                        style={{ animationDelay: `${i * 0.15}s` }}
                    />
                ))}
            </div>

            {/* Stepped status — active line fixed in the 2nd slot. */}
            <div className="flex w-[343px] max-w-full flex-col items-center gap-4 text-center">
                <StepLine text={step > 0 ? STEPS[step - 1] : ""} variant={step > 0 ? "done" : "next"} />
                <StepLine text={STEPS[step]} variant="active" />
                <StepLine text={STEPS[step + 1] ?? ""} variant="next" />
                <StepLine text={STEPS[step + 2] ?? ""} variant="next" />
            </div>
        </div>
    );
}
