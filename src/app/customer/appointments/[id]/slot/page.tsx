"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Select date & time (`/customer/appointments/[id]/slot`) — Figma 4212-39347
// ─────────────────────────────────────────────────────────────────────────────
//
// Time-slot step. A 7-day strip (anchored to the chosen month) + the day's
// bookable slots, derived from the admin data via `useAvailableSlots`:
//   • Private → the instructor's hours minus their classes / blocks / booked
//     appointments (a taken slot never reappears).
//   • Open    → the branch's working hours; a slot at full capacity is hidden.
// The month label opens the shared MonthPickerSheet and the timezone pill opens
// the shared Timezone screen. Picking a slot records it on the draft and advances
// (with a gentle fade) to Review and book.

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronDown } from "@untitledui/icons";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { addDaysISO, dayNum, formatMonth, REAL_TODAY_ISO, weekdayAbbr } from "@/lib/customer/dates";
import { useAppointment } from "@/lib/customer/appointments-data";
import { useAppStore } from "@/lib/store";
import { useAvailableSlots } from "@/lib/customer/slot-availability";
import { timeInZoneLabel } from "@/lib/customer/class-time";
import { branchTimezone } from "@/lib/branch-time";
import { cityForZone, tzPickerCtx } from "@/lib/customer/timezones";
import { appointmentDraft, ensureAppointmentDraft, resetAppointmentDraft } from "@/lib/customer/booking-flow";
import { AppointmentFlowHeader } from "@/components/customer/appointments/AppointmentFlowHeader";
import { TimezonePill } from "@/components/customer/shell/TimezonePill";
import { MonthPickerSheet } from "@/components/customer/home/MonthPickerSheet";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";

export default function SelectSlotPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const appointment = useAppointment(id);
    const { timezone } = useCurrentCustomerContext();
    const branch = useAppStore((st) => st.branches).find((b) => b.id === appointment?.branchId);

    ensureAppointmentDraft(id);
    // The strip's first day — anchored to the picked month (default: today).
    const [weekStartISO, setWeekStartISO] = useState<string>(appointmentDraft.slotISO ?? REAL_TODAY_ISO);
    const [dateISO, setDateISO] = useState<string>(appointmentDraft.slotISO ?? REAL_TODAY_ISO);
    const [slot, setSlot] = useState<string | null>(
        appointmentDraft.slotISO === dateISO ? appointmentDraft.slotTime : null,
    );
    const [monthOpen, setMonthOpen] = useState(false);
    const [fading, setFading] = useState(false);
    const advancingRef = useRef(false);

    const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISO, i));
    const isOpen = appointment?.type === "open";
    const isPrivate = appointment?.type === "private";
    // Availability is derived live from the admin schedule / branch hours / bookings.
    const slots = useAvailableSlots(appointment, appointmentDraft.instructorId, dateISO);

    // Month sheet bounds — today → +1 year (mirrors the Search date selector).
    const anchor = new Date(`${weekStartISO}T00:00:00`);
    const today = new Date(`${REAL_TODAY_ISO}T00:00:00`);
    const minYear = today.getFullYear();
    const maxYear = minYear + 1;

    /** Jump the strip to the chosen month (clamped so it never starts before today). */
    function jumpToMonth(m: number, y: number) {
        const first = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        const start = first < REAL_TODAY_ISO ? REAL_TODAY_ISO : first;
        setWeekStartISO(start);
        setDateISO(start);
        setSlot(appointmentDraft.slotISO === start ? appointmentDraft.slotTime : null);
        setMonthOpen(false);
    }

    function pickSlot(time: string) {
        if (advancingRef.current) return; // guard double-taps during the hand-off
        advancingRef.current = true;
        setSlot(time); // show the picked slot highlighted before advancing
        appointmentDraft.slotISO = dateISO;
        appointmentDraft.slotTime = time;
        // Let the selection register, then gently fade out before advancing.
        window.setTimeout(() => setFading(true), 400);
        window.setTimeout(() => router.push(`/customer/appointments/${id}/book`), 760);
    }

    return (
        <div className="flex min-h-full flex-col">
            <AppointmentFlowHeader
                title="Select date & time"
                progress={isPrivate ? 66 : 50}
                onBack={() => router.back()}
                onClose={() => {
                    resetAppointmentDraft();
                    router.push("/customer/search");
                }}
            />

            <div
                className="flex flex-1 flex-col gap-4 px-4 pb-6 pt-6"
                style={{ opacity: fading ? 0 : 1, transition: "opacity 340ms ease-out" }}
            >
                {/* Month (opens the month sheet) + timezone (opens the timezone screen) */}
                <div className="flex w-full items-center justify-between">
                    <button type="button" onClick={() => setMonthOpen(true)} className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold leading-5 text-[var(--brand-text)]">{formatMonth(weekStartISO)}</span>
                        <ChevronDown className="size-5 text-[var(--brand-text)]" aria-hidden />
                    </button>
                    <TimezonePill
                        tz={timezone}
                        onClick={() => {
                            tzPickerCtx.branchCity = cityForZone(branchTimezone(branch)) ?? null;
                            router.push("/customer/search/timezone");
                        }}
                    />
                </div>

                {/* Date strip — a week anchored to the chosen month */}
                <div className="flex w-full items-center gap-2">
                    {days.map((d) => {
                        const active = d === dateISO;
                        return (
                            <button
                                key={d}
                                type="button"
                                onClick={() => {
                                    setDateISO(d);
                                    setSlot(appointmentDraft.slotISO === d ? appointmentDraft.slotTime : null);
                                }}
                                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl p-2 transition-colors ${
                                    active ? "border-2 border-[var(--brand-primary)] bg-white" : "border border-[#e4e7ec] bg-white"
                                }`}
                            >
                                <span
                                    className={`text-xs font-normal leading-[18px] ${active ? "text-[var(--brand-primary)]" : "text-[#667085]"}`}
                                >
                                    {weekdayAbbr(d)}
                                </span>
                                <span
                                    className={`text-xs font-medium leading-[18px] ${active ? "text-[var(--brand-primary)]" : "text-[#344054]"}`}
                                >
                                    {dayNum(d)}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Time slots — empty state when the day has no availability */}
                {slots.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center py-10">
                        <SearchEmptyState
                            title="No available times"
                            description={
                                isPrivate
                                    ? "This instructor is fully booked on this day. Try another date."
                                    : "There are no open sessions on this day. Try another date."
                            }
                        />
                    </div>
                ) : (
                    <div className="flex w-full flex-col gap-4">
                        {slots.map((s) => {
                            const isSel = slot === s.time;
                            return (
                                <button
                                    key={s.time}
                                    type="button"
                                    onClick={() => pickSlot(s.time)}
                                    className={`relative flex w-full items-center justify-center rounded-xl p-4 transition-all duration-300 ease-out ${
                                        isSel ? "border-2 border-[var(--brand-primary)] bg-[var(--brand-tertiary)]" : "border border-[#e4e7ec] bg-white"
                                    }`}
                                >
                                    <span className="text-sm font-medium leading-5 text-[#344054]">{timeInZoneLabel(dateISO, s.time, branch, timezone, true)}</span>
                                    {/* Open sessions surface remaining capacity; Private is 1:1 (no badge). */}
                                    {isOpen && s.spotsLeft != null && (
                                        <span
                                            className={`absolute right-4 top-1/2 -translate-y-1/2 rounded-full border px-2 py-0.5 text-xs font-medium leading-[18px] ${
                                                isSel
                                                    ? "border-[var(--brand-tertiary)] bg-[var(--brand-tertiary)] text-[var(--brand-primary)]"
                                                    : "border-[#e4e7ec] bg-[#f9fafb] text-[#344054]"
                                            }`}
                                        >
                                            {s.spotsLeft}/{s.capacity}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <MonthPickerSheet
                open={monthOpen}
                onClose={() => setMonthOpen(false)}
                month={anchor.getMonth()}
                year={anchor.getFullYear()}
                minYear={minYear}
                maxYear={maxYear}
                onApply={jumpToMonth}
            />
        </div>
    );
}
