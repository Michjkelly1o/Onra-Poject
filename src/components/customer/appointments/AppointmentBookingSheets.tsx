"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Appointment booking as ONE sliding bottom sheet (Private + Recovery)
// ─────────────────────────────────────────────────────────────────────────────
//
// A single CustomerSheet that stays open across the flow and SLIDES between
// steps (Select instructor → Select date & time) like a page transition — never
// closing/reopening. The sticky header (title + progress bar edge-to-edge) sits
// above a horizontal track; picking an instructor slides to the date/time step,
// Back slides back, and picking a slot hands off to the full-page Payment Details
// (`/customer/appointments/[id]/book`).
//
//   Private:  instructor → date & time → Payment
//   Open/Rec: date & time → Payment

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Shuffle01, Users01, XClose } from "@untitledui/icons";
import { useCustomerInstructors } from "@/lib/customer/instructors";
import { useAppointment } from "@/lib/customer/appointments-data";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { useAppStore } from "@/lib/store";
import {
    useAvailableSlots,
    useFlexibleAvailableSlots,
    useInstructorsWithWeekAvailability,
    useDaysWithAvailability,
} from "@/lib/customer/slot-availability";
import { appointmentDraft, ensureAppointmentDraft } from "@/lib/customer/booking-flow";
import { addDaysISO, formatMonth, REAL_TODAY_ISO } from "@/lib/customer/dates";
import { timeInZoneLabel } from "@/lib/customer/class-time";
import { branchTimezone } from "@/lib/branch-time";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { DateStrip } from "@/components/customer/classes/DateStrip";
import { TimezonePill } from "@/components/customer/shell/TimezonePill";
import { TimeZoneSheet } from "@/components/customer/shell/TimeZoneSheet";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";
import { AppointmentCheckoutContent } from "@/components/customer/appointments/AppointmentCheckoutContent";
import { tzGate } from "@/lib/customer/timezones";
import type { AppointmentVM } from "@/lib/customer/appointments-data";

const FLEXIBLE = "__flexible__";
const SLIDE_MS = 360;
const SLIDE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

// ─── Step content — Select instructor (Private only) ─────────────────────────

function InstructorContent({ appointment, onPicked }: {
    appointment: AppointmentVM | null;
    onPicked: () => void;
}) {
    const instructors = useCustomerInstructors();
    const branchInstructors = appointment
        ? instructors.filter((i) => i.status === "active" && i.branchId === appointment.branchId)
        : [];
    // Hide instructors with NO bookable slot this week (today … today+6) so the
    // picker only lists people you can actually book — client 2026-08.
    const availableIds = useInstructorsWithWeekAvailability(appointment, branchInstructors.map((i) => i.id));
    const visibleInstructors = branchInstructors.filter((i) => availableIds.has(i.id));

    function pick(instructorId: string) {
        appointmentDraft.flexible = false;
        appointmentDraft.instructorId = instructorId;
        onPicked();
    }
    function pickFlexible() {
        appointmentDraft.flexible = true;
        appointmentDraft.instructorId = null;
        onPicked();
    }

    return (
        <div className="flex flex-col gap-3 pb-2">
            <button
                type="button"
                onClick={pickFlexible}
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--colors-border-secondary)] bg-white p-4 text-left transition-colors active:bg-gray-50"
            >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-tertiary)]">
                    <Shuffle01 className="size-5 text-[var(--brand-primary)]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium leading-5 text-[var(--colors-text-secondary)]">Preference: Flexible</span>
                    <span className="block text-xs leading-4 text-[var(--colors-text-quaternary)]">Let the studio assign an available instructor</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-[var(--colors-fg-quaternary)]" aria-hidden />
            </button>

            {visibleInstructors.map((i) => (
                <button
                    key={i.id}
                    type="button"
                    onClick={() => pick(i.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-[var(--colors-border-secondary)] bg-white p-4 text-left transition-colors active:bg-gray-50"
                >
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--colors-bg-tertiary)]">
                        {i.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={i.imageUrl} alt="" className="size-full scale-[1.4] object-cover" />
                        ) : (
                            <span className="text-xs font-semibold text-[var(--colors-text-quaternary)]">{i.initials}</span>
                        )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-[var(--colors-text-secondary)]">{i.name}</span>
                    <ChevronRight className="size-5 shrink-0 text-[var(--colors-fg-quaternary)]" aria-hidden />
                </button>
            ))}
        </div>
    );
}

// ─── Step content — Select date & time ───────────────────────────────────────

function SlotContent({ appointment, active, onPickedSlot }: {
    appointment: AppointmentVM | null;
    /** True when this step is the visible one — drives the default-date effect. */
    active: boolean;
    onPickedSlot: () => void;
}) {
    const { timezone, setTimezone, localTimezone } = useCurrentCustomerContext();
    const branch = useAppStore((st) => st.branches).find((b) => b.id === appointment?.branchId);
    const isOpen = appointment?.type === "open";
    const isPrivate = appointment?.type === "private";
    const isFlexible = appointmentDraft.flexible;
    const instructorId = appointmentDraft.instructorId;

    const [dateISO, setDateISO] = useState<string>(REAL_TODAY_ISO);
    const [tzOpen, setTzOpen] = useState(false);
    // Bumped every time this step becomes active so the DateStrip snaps its scroll
    // back to the selected day's week (a drag-scrolled strip can otherwise reopen
    // on a later week).
    const [dateResetSignal, setDateResetSignal] = useState(0);

    // Which days (today … +6 weeks) have ≥1 bookable slot. Days NOT in this set are
    // greyed out + non-tappable in the strip, and the default selection lands on
    // the first available day rather than dropping the shopper on an empty day.
    const availableDays = useDaysWithAvailability(appointment, instructorId, isFlexible);
    // The first available day WITHIN the bookable window (today → +7, matching the
    // DateStrip's bookingOpenDays). Falls back to today when the whole window is
    // fully booked (the slot list then shows the "No available times" state).
    const firstBookableDay = useMemo(() => {
        const lastBookable = addDaysISO(REAL_TODAY_ISO, 7);
        return (
            Array.from(availableDays)
                .filter((d) => d >= REAL_TODAY_ISO && d <= lastBookable)
                .sort()[0] ?? REAL_TODAY_ISO
        );
    }, [availableDays]);

    // On entry, land the selection on the first available day (never a stale
    // carried-over slot) and snap the strip's scroll to that week.
    useEffect(() => {
        if (active) {
            setDateISO(firstBookableDay);
            setDateResetSignal((n) => n + 1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, firstBookableDay]);

    const singleSlots = useAvailableSlots(appointment, instructorId, dateISO);
    const flexibleSlots = useFlexibleAvailableSlots(appointment, dateISO);
    const slots = isFlexible ? flexibleSlots : singleSlots;

    function pickSlot(time: string) {
        appointmentDraft.slotISO = dateISO;
        appointmentDraft.slotTime = time;
        onPickedSlot();
    }

    return (
        <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center justify-between">
                <span className="text-sm font-semibold leading-5 text-[var(--brand-text)]">{formatMonth(dateISO)}</span>
                <TimezonePill tz={timezone} onClick={() => setTzOpen(true)} />
            </div>

            <div className="mt-4 shrink-0">
                {/* Same DateStrip the Search Classes tab uses — forward-only, opens
                    on the first available day. Accessible range is today → +7 days
                    (bookingOpenDays), scroll capped at this week + next (maxWeeks).
                    Days with no bookable slot are greyed out + non-tappable via
                    `enabledDays`; only a fully-booked window falls through to the
                    "No available times" empty state. */}
                <DateStrip selectedISO={dateISO} onSelect={setDateISO} bookingOpenDays={7} maxWeeks={2} enabledDays={availableDays} resetSignal={dateResetSignal} />
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {slots.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center py-10">
                        <SearchEmptyState
                            title="No available times"
                            description={
                                isFlexible
                                    ? "No instructors are available on this day. Try another date."
                                    : isPrivate
                                      ? "This instructor is fully booked on this day. Try another date."
                                      : "There are no open sessions on this day. Try another date."
                            }
                        />
                    </div>
                ) : (
                    <div className="flex w-full flex-col gap-4 pb-2">
                        {slots.map((s) => (
                            <button
                                key={s.time}
                                type="button"
                                onClick={() => pickSlot(s.time)}
                                className="relative flex w-full items-center justify-center rounded-xl border border-[var(--colors-border-secondary)] bg-white p-4 transition-colors active:bg-gray-50"
                            >
                                <span className="text-sm font-medium leading-5 text-[var(--colors-text-secondary)]">
                                    {timeInZoneLabel(dateISO, s.time, branch, timezone, true)}
                                </span>
                                {isOpen && s.spotsLeft != null && (
                                    <span className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full border border-[var(--colors-border-secondary)] bg-[var(--colors-bg-secondary)] px-2 py-0.5 text-xs font-medium leading-[18px] text-[var(--colors-text-secondary)]">
                                        <Users01 className="size-3 shrink-0" aria-hidden />
                                        {s.booked}/{s.capacity}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <TimeZoneSheet
                open={tzOpen}
                onClose={() => {
                    tzGate.shownForZone = branch ? branchTimezone(branch) : tzGate.shownForZone;
                    setTzOpen(false);
                }}
                branch={branch}
                localCity={localTimezone}
                value={timezone}
                onSelect={(city) => {
                    setTimezone(city);
                    setTzOpen(false);
                }}
                onConfirm={() => {
                    tzGate.shownForZone = branch ? branchTimezone(branch) : tzGate.shownForZone;
                }}
            />
        </div>
    );
}

// ─── Flow controller — one sheet, sliding steps ──────────────────────────────

export function AppointmentBookingFlow({ appointmentId, open, onClose }: {
    appointmentId: string;
    open: boolean;
    onClose: () => void;
}) {
    const appointment = useAppointment(appointmentId);
    const isPrivate = appointment?.type === "private";
    // Private steps: 0 = instructor, 1 = date & time, 2 = payment.
    // Open steps:    0 = date & time, 1 = payment.
    const slotStep = isPrivate ? 1 : 0;
    const paymentStep = isPrivate ? 2 : 1;
    const [stepIdx, setStepIdx] = useState(0);
    // Latches once the customer reaches Payment so the panel stays mounted (with a
    // valid draft) — a fresh mount mid-flow would flip the checkout's hook count.
    const [reachedPayment, setReachedPayment] = useState(false);
    // True while the checkout's Payment method / Promo sub-panel covers the sheet —
    // the flow hides its own header so there's never a double header.
    const [checkoutSubActive, setCheckoutSubActive] = useState(false);

    useEffect(() => {
        if (open) {
            ensureAppointmentDraft(appointmentId);
            setStepIdx(0);
            setReachedPayment(false);
            setCheckoutSubActive(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, appointmentId, appointment?.type]);

    // Picking a slot slides forward to the in-sheet Payment step (draft is already
    // set by pickSlot) — no sheet close / reopen, so the motion stays continuous.
    function goToPayment() {
        setReachedPayment(true);
        setStepIdx(paymentStep);
    }

    const atSlot = stepIdx === slotStep;
    const atPayment = stepIdx === paymentStep;
    const title = atPayment ? "Payment" : atSlot ? "Select date & time" : "Select instructor";
    const totalSteps = isPrivate ? 3 : 2;
    const progress = Math.round(((stepIdx + 1) / totalSteps) * 100);
    const onBack = atPayment ? () => setStepIdx(slotStep) : isPrivate && stepIdx === 1 ? () => setStepIdx(0) : undefined;
    const trackShift = stepIdx * 100;

    return (
        <CustomerSheet open={open} onClose={onClose} tall>
            {/* Sticky header — hidden while a checkout sub-panel covers the sheet
                (that panel renders its own header). */}
            {!checkoutSubActive && (
            <div className="shrink-0">
                <div className="relative flex items-center justify-center pb-3">
                    {onBack ? (
                        <button
                            type="button"
                            onClick={onBack}
                            aria-label="Back"
                            className="absolute left-0 flex size-8 items-center justify-center rounded-full border border-[var(--colors-border-secondary)] bg-white transition-colors active:bg-gray-50"
                        >
                            <ChevronLeft className="size-5 text-[var(--colors-text-secondary)]" aria-hidden />
                        </button>
                    ) : (
                        <span aria-hidden className="absolute left-0 size-8" />
                    )}
                    <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">{title}</p>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute right-0 flex size-8 items-center justify-center rounded-full border border-[var(--colors-border-secondary)] bg-white transition-colors active:bg-gray-50"
                    >
                        <XClose className="size-5 text-[var(--colors-text-secondary)]" aria-hidden />
                    </button>
                </div>
                <div className="-mx-4 h-1 w-[calc(100%+32px)] overflow-hidden bg-[var(--colors-bg-quaternary)]">
                    <div
                        className="h-full rounded-r-full bg-[var(--colors-secondary-400)]"
                        style={{ width: `${progress}%`, transition: `width ${SLIDE_MS}ms ${SLIDE_EASE}` }}
                    />
                </div>
            </div>
            )}

            {/* Sliding track — instructor → slot → payment panels (edge-to-edge slide). */}
            <div className="relative -mx-4 mt-4 min-h-0 flex-1 overflow-hidden">
                <div
                    className="flex h-full w-full"
                    style={{ transform: `translateX(-${trackShift}%)`, transition: `transform ${SLIDE_MS}ms ${SLIDE_EASE}` }}
                >
                    {isPrivate && (
                        <div className="h-full w-full shrink-0 overflow-y-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <InstructorContent appointment={appointment} onPicked={() => setStepIdx(1)} />
                        </div>
                    )}
                    <div className="h-full w-full shrink-0 px-4">
                        <SlotContent appointment={appointment} active={atSlot} onPickedSlot={goToPayment} />
                    </div>
                    {reachedPayment && (
                        <div className="h-full w-full shrink-0 px-4">
                            <AppointmentCheckoutContent
                                appointmentId={appointmentId}
                                variant="sheet"
                                hideHeader
                                onBack={() => setStepIdx(slotStep)}
                                onSubviewChange={setCheckoutSubActive}
                            />
                        </div>
                    )}
                </div>
            </div>
        </CustomerSheet>
    );
}
