"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Appointment checkout content (page + bottom sheet)
// ─────────────────────────────────────────────────────────────────────────────
//
// Currency-based checkout for a Private/Recovery appointment — the shared
// CheckoutCart with an appointment summary (location merged in). Rendered
// full-page by the route wrapper and as a bottom sheet from Search.

import { useRouter } from "next/navigation";
import { AlertCircle, Clock, MarkerPin01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomer, useCurrentCustomerContext } from "@/lib/customer/context";
import { timeInZoneLabel } from "@/lib/customer/class-time";
import { appointmentDraft } from "@/lib/customer/booking-flow";
import { useAppointment } from "@/lib/customer/appointments-data";
import { getFrozenActiveMembership } from "@/lib/customer/freeze-eligibility";
import { shortDate } from "@/lib/customer/profile-format";
import { CheckoutCart } from "@/components/customer/checkout/CheckoutCart";
import { Button } from "@/components/ui/button";

export function AppointmentCheckoutContent({
    appointmentId,
    variant = "page",
    onBack,
    hideHeader = false,
    onSubviewChange,
}: {
    appointmentId: string;
    variant?: "page" | "sheet";
    onBack: () => void;
    /** Suppress the internal Payment header when embedded in the booking flow
     *  (the flow renders its own header + back + progress). */
    hideHeader?: boolean;
    /** Bubbles CheckoutCart's sub-panel state so the flow can hide its header. */
    onSubviewChange?: (inSubview: boolean) => void;
}) {
    const router = useRouter();
    const id = appointmentId;
    const appointment = useAppointment(id);
    const instructors = useAppStore((s) => s.instructors);
    const branches = useAppStore((s) => s.branches);
    const rooms = useAppStore((s) => s.rooms);
    const customerPlans = useAppStore((s) => s.customerPlans);
    const member = useCurrentCustomer();
    // Phase 3 — same freeze guard the class booking page uses. During a
    // freeze the customer cannot book anything else, including appointments.
    // Same copy across the two entry points for a consistent experience.
    const frozenMembership = member ? getFrozenActiveMembership(member.id, customerPlans) : null;

    const instructor = appointmentDraft.instructorId
        ? instructors.find((i) => i.id === appointmentDraft.instructorId) ?? null
        : null;

    // Reached only with a chosen slot; guard against deep-links / stale draft.
    if (!appointment || appointmentDraft.appointmentId !== id || !appointmentDraft.slotISO || !appointmentDraft.slotTime) {
        return (
            <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-base font-semibold text-[var(--brand-text)]">Appointment unavailable</p>
                <Button
                    variant="secondary-gray"
                    size="sm"
                    className="rounded-full"
                    onClick={() => router.push("/customer/search")}
                >
                    Back to Search
                </Button>
            </div>
        );
    }

    // Frozen-membership short-circuit — replaces the whole checkout with a
    // clear "you can book again on X" card + Back to my plan CTA so the
    // member never reaches the payment step.
    if (frozenMembership) {
        return (
            <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-[#fee4e2]">
                    <AlertCircle className="size-6 text-[#d92d20]" aria-hidden />
                </div>
                <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Your membership is frozen</p>
                <p className="max-w-[280px] text-sm leading-5 text-[var(--colors-text-tertiary)]">
                    Your <span className="font-semibold text-[var(--brand-text)]">{frozenMembership.planName}</span> is paused.
                    You can book again on {shortDate(frozenMembership.resumeISO)}.
                </p>
                <Button
                    variant="primary"
                    size="lg"
                    className="rounded-full"
                    onClick={() => router.push("/customer/profile/plan")}
                >
                    Manage plan
                </Button>
            </div>
        );
    }

    const isPrivate = appointment.type === "private";
    const branch = branches.find((b) => b.id === appointment.branchId) ?? null;
    const { timezone } = useCurrentCustomerContext();
    // Room - Branch when a room is assigned, else Branch only (no full address) —
    // mirrors the Review & Book summary location line.
    const room = rooms.find((r) => r.id === appointment.roomId);
    const locationLine = room ? `${room.name} - ${appointment.branchName}` : appointment.branchName;
    const fullDate = new Date(`${appointmentDraft.slotISO}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
    });

    const summary = (
        <div className="flex w-full flex-col gap-5">
            {/* Appointment summary — location merged in (mirrors Review & Book). */}
            <div className="flex w-full items-start gap-3">
                <div
                    className="size-[82px] shrink-0 overflow-hidden rounded-[10px] border border-[var(--colors-border-secondary)]"
                    style={!appointment.coverImage ? { backgroundColor: appointment.coverColor } : undefined}
                >
                    {appointment.coverImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={appointment.coverImage} alt="" className="size-full object-cover" />
                    )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="truncate text-sm font-medium leading-5 text-[var(--colors-text-primary)]">{appointment.name}</p>
                    <p className="text-xs font-normal leading-[18px] text-[var(--colors-text-tertiary)]">{fullDate} at {timeInZoneLabel(appointmentDraft.slotISO ?? "", appointmentDraft.slotTime, branch, timezone)}</p>
                    <div className="flex items-start gap-1.5">
                        <MarkerPin01 className="mt-0.5 size-4 shrink-0 text-[var(--colors-text-quaternary)]" aria-hidden />
                        <p className="text-xs font-normal leading-[18px] text-[var(--colors-text-tertiary)]">{locationLine}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="flex items-center gap-1 text-xs font-normal leading-[18px] text-[var(--colors-text-tertiary)]">
                            <Clock className="size-4 shrink-0 text-[var(--colors-text-quaternary)]" aria-hidden />
                            {appointment.durationMins} mins
                        </span>
                        {isPrivate && instructor && (
                            <>
                                <span className="text-xs leading-[18px] text-[var(--colors-text-tertiary)]" aria-hidden>
                                    •
                                </span>
                                <span className="flex items-center gap-1.5 text-xs font-normal leading-[18px] text-[var(--colors-text-tertiary)]">
                                    <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--colors-bg-tertiary)]">
                                        {instructor.imageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={instructor.imageUrl} alt="" className="size-full scale-[1.4] object-cover" />
                                        ) : (
                                            <span className="text-[9px] font-semibold leading-none text-[var(--colors-text-quaternary)]">{instructor.initials}</span>
                                        )}
                                    </span>
                                    {instructor.name}
                                </span>
                            </>
                        )}
                        {/* Flexible preference — instructor is auto-assigned at booking. */}
                        {isPrivate && appointmentDraft.flexible && (
                            <>
                                <span className="text-xs leading-[18px] text-[var(--colors-text-tertiary)]" aria-hidden>•</span>
                                <span className="text-xs font-medium leading-[18px] text-[var(--brand-primary)]">
                                    Flexible — instructor assigned at booking
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />
        </div>
    );

    return (
        <CheckoutCart
            originId={`appointment-${id}`}
            onBack={onBack}
            variant={variant}
            hideHeader={hideHeader}
            onSubviewChange={onSubviewChange}
            processingHref={`/customer/appointments/${id}/book/processing`}
            summary={summary}
            fixedSubtotal={appointment.price}
            taxRatePct={0}
        />
    );
}
