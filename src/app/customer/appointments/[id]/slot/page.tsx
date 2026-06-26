"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Select date & time (`/customer/appointments/[id]/slot`) — Figma 4212-39347
// ─────────────────────────────────────────────────────────────────────────────
//
// Time-slot step. A 7-day strip + a list of bookable slots (UI-only mock built
// from the service duration; capacity badge per slot — 1/1 for Private, n/n for
// Open). Picking a slot records it on the appointment draft and (next phase)
// advances to Review and book. Reuses the multi-step flow header + progress.

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronDown, Globe04 } from "@untitledui/icons";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { addDaysISO, dayNum, formatMonth, REAL_TODAY_ISO, weekdayAbbr } from "@/lib/customer/dates";
import { offsetForCity } from "@/lib/customer/timezones";
import { useAppointment } from "@/lib/customer/appointments-data";
import { appointmentDraft, ensureAppointmentDraft } from "@/lib/customer/booking-flow";
import { AppointmentFlowHeader } from "@/components/customer/appointments/AppointmentFlowHeader";

/** "07:00" → "07:00 AM" (leading-zero hour, matching the design). */
function fmtSlot(time: string): string {
    const [h, m] = time.split(":").map(Number);
    const period = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

/** Mock open slots from 07:00 to 20:00 in service-duration steps. */
function genSlots(durationMins: number): string[] {
    const step = durationMins > 0 ? durationMins : 30;
    const out: string[] = [];
    for (let m = 7 * 60; m + step <= 20 * 60; m += step) {
        out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    }
    return out;
}

export default function SelectSlotPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const appointment = useAppointment(id);
    const { timezone } = useCurrentCustomerContext();

    ensureAppointmentDraft(id);
    const [dateISO, setDateISO] = useState<string>(appointmentDraft.slotISO ?? REAL_TODAY_ISO);
    const [slot, setSlot] = useState<string | null>(
        appointmentDraft.slotISO === dateISO ? appointmentDraft.slotTime : null,
    );

    const days = Array.from({ length: 7 }, (_, i) => addDaysISO(REAL_TODAY_ISO, i));
    const slots = genSlots(appointment?.durationMins ?? 30);
    const isOpen = appointment?.type === "open";
    const isPrivate = appointment?.type === "private";
    const capacity = isOpen ? appointment.capacity ?? 5 : 1;

    function pickSlot(time: string) {
        appointmentDraft.slotISO = dateISO;
        appointmentDraft.slotTime = time;
        // Auto-advance to Review and book.
        router.push(`/customer/appointments/${id}/book`);
    }

    return (
        <div className="flex min-h-full flex-col">
            <AppointmentFlowHeader
                title="Select date & time"
                progress={isPrivate ? 66 : 50}
                onBack={() => router.back()}
                onClose={() => router.push("/customer/search")}
            />

            <div className="flex flex-1 flex-col gap-4 px-4 pb-6 pt-6">
                {/* Month + timezone */}
                <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold leading-5 text-[#101828]">{formatMonth(dateISO)}</span>
                        <ChevronDown className="size-5 text-[#101828]" aria-hidden />
                    </div>
                    <span className="flex items-center gap-1 rounded-md border border-[#d0d5dd] bg-white px-2 py-0.5 shadow-[0px_1px_1px_0px_rgba(16,24,40,0.05)]">
                        <Globe04 className="size-3 shrink-0 text-[#667085]" aria-hidden />
                        <span className="text-xs font-medium leading-[18px] text-[#344054]">{offsetForCity(timezone)}</span>
                    </span>
                </div>

                {/* Date strip — a week from today */}
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
                                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border p-2 transition-colors ${
                                    active ? "border-[#658774] bg-white" : "border-[#e4e7ec] bg-white"
                                }`}
                            >
                                <span
                                    className={`text-xs font-normal leading-[18px] ${active ? "text-[#658774]" : "text-[#667085]"}`}
                                >
                                    {weekdayAbbr(d)}
                                </span>
                                <span
                                    className={`text-xs font-medium leading-[18px] ${active ? "text-[#4f6e5d]" : "text-[#344054]"}`}
                                >
                                    {dayNum(d)}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Time slots */}
                <div className="flex w-full flex-col gap-4">
                    {slots.map((time) => {
                        const isSel = slot === time;
                        return (
                            <button
                                key={time}
                                type="button"
                                onClick={() => pickSlot(time)}
                                className={`relative flex w-full items-center justify-center rounded-xl p-4 transition-colors ${
                                    isSel ? "border-2 border-[#7ba08c] bg-[#e9fff3]" : "border border-[#e4e7ec] bg-white"
                                }`}
                            >
                                <span className="text-sm font-medium leading-5 text-[#344054]">{fmtSlot(time)}</span>
                                {/* Capacity badge is only meaningful for Open sessions (Private is 1:1). */}
                                {isOpen && (
                                    <span
                                        className={`absolute right-4 top-1/2 -translate-y-1/2 rounded-full border px-2 py-0.5 text-xs font-medium leading-[18px] ${
                                            isSel
                                                ? "border-[#c4edd6] bg-[#e9fff3] text-[#4f6e5d]"
                                                : "border-[#e4e7ec] bg-[#f9fafb] text-[#344054]"
                                        }`}
                                    >
                                        {capacity}/{capacity}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
