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
        return <p className="text-xl font-semibold leading-[30px] text-[var(--brand-primary)]">{text}</p>;
    }
    return (
        <p className={`text-base font-semibold leading-6 text-[var(--colors-text-secondary)] ${variant === "done" ? "opacity-30" : "opacity-10"}`}>
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
    // Guest → Lead capture: a guest we book for is a prospect. If their email
    // isn't already a customer / lead, we create a Lead so admin's Customer
    // module surfaces them (addLead dual-writes a `lifecycleTag: "Lead"` row).
    const addLead = useAppStore((s) => s.addLead);
    const customers = useAppStore((s) => s.customers);
    const leads = useAppStore((s) => s.leads);
    const schedules = useAppStore((s) => s.classSchedules);
    const [step, setStep] = useState(0);
    const wroteRef = useRef(false);

    // Perform the booking write exactly once — but only after `member` resolves.
    // Depending on `member` (not `[]`) means a first paint where the customer
    // context hasn't hydrated yet doesn't permanently skip the write; it re-runs
    // and writes the moment `member` is available (guarded by `wroteRef` so it
    // still fires only once). This is what guarantees the guest booking — and the
    // Lead it creates — are actually persisted.
    useEffect(() => {
        if (!wroteRef.current && member) {
            wroteRef.current = true;
            const status = mode === "waitlist" ? "waitlisted" : "booked";
            // Reserve-to model: the booking is for EITHER the member OR one other
            // person (never both). The single picked spot (spots[0]) goes to
            // whoever the seat is reserved to.
            const spots = bookingDraft.spots;
            if (bookingDraft.bookSelf) {
                addClassBooking({ classScheduleId: id, customerId: member.id, status, spot: spots[0] ?? spot });
            }
            const classBranchId = schedules.find((s) => s.id === id)?.branchId ?? member.branchId;
            bookingDraft.guests.forEach((g, i) => {
                addClassBooking({
                    classScheduleId: id,
                    customerId: member.id,
                    status,
                    // When only the reservee is booked, they take the picked spot
                    // (spots[0]); otherwise seats are offset past the member's.
                    spot: bookingDraft.bookSelf ? spots[i + 1] : spots[i],
                    guestName: g.name,
                    guestEmail: g.email,
                    guestPayment: g.payment,
                    chargeBookerCredit: g.payment === "booker_credit",
                });
                // Link to an existing profile by email, else create a new Lead so
                // the guest shows up under the admin Customer module.
                const email = (g.email ?? "").trim();
                if (email) {
                    const lower = email.toLowerCase();
                    const known =
                        customers.some((c) => c.email && c.email.toLowerCase() === lower) ||
                        leads.some((l) => l.contact_email && l.contact_email.toLowerCase() === lower);
                    if (!known) {
                        addLead({
                            contact_name: g.name.trim() || email,
                            contact_email: email,
                            source: "Referral",
                            stage: "new",
                            engagement_status: "warm",
                            branch_id: classBranchId,
                        });
                    }
                }
            });
            bookingDraft.classId = null;
            bookingDraft.guests = [];
            bookingDraft.bookSelf = true;
            bookingDraft.spots = [];
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [member]);

    // Sequence the 3-step status then route to Success — independent of the
    // write so the loader animation runs on a fixed cadence.
    useEffect(() => {
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
                        className="size-2 animate-bounce rounded-full bg-[var(--brand-primary)]"
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
