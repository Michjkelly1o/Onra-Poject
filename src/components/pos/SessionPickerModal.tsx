"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra POS — Session picker modal (Private / Recovery)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-08-04 — the POS catalog now sells Private + Recovery sessions.
// Clicking a session card opens THIS modal to define WHEN (date + time) and
// WHO (instructor / Flexible), mirroring the customer-side booking flow, then
// adds a fully-specified session line to the cart. On checkout the sale both
// books the appointment and charges for it.
//
// Availability is computed by the SAME pure engine the customer flow uses
// (`computeAvailableSlots`) so a POS booking obeys identical rules — the
// instructor's shift window ∩ branch hours, minus their classes / blocked
// time / existing appointments; open (recovery) sessions follow branch hours
// and hide full slots. The selected POS customer is passed as `member` so a
// slot they're already booked at is hidden (no double-booking).
//
// Two shapes, keyed off `openSession`:
//   • Private / 1:1 (openSession=false, incl. 1:1 recovery like massage) —
//     pick an instructor OR "Flexible" (studio auto-assigns at checkout),
//     then a time slot.
//   • Open recovery (openSession=true, e.g. sauna / breathwork) — no
//     instructor; pick a time slot, each showing spots left.

import { useEffect, useMemo, useState } from "react";
import { X, ClockFastForward, User01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { computeAvailableSlots } from "@/lib/customer/slot-availability";
import { useAppointmentBookings } from "@/lib/customer/appointment-bookings";
import type { AppointmentVM } from "@/lib/customer/appointments-data";

/** Minimal session shape the modal needs — built in the POS page from the
 *  service-backed catalog product. */
export interface SessionProduct {
    id: string;
    name: string;
    sessionType: "private" | "recovery";
    /** true = open (multi-customer capacity, no instructor); false = 1:1. */
    openSession: boolean;
    durationMin: number;
    capacity: number;
    /** The branch the service is offered at — availability is computed here. */
    branchId: string;
    price: number;
}

/** The chosen slot handed back to the cart. */
export interface SessionPick {
    dateISO: string;
    startTime: string; // "HH:MM"
    endTime: string;   // "HH:MM"
    durationMin: number;
    instructorId: string | null;
    instructorName?: string;
    /** true = studio auto-assigns the instructor at checkout. */
    flexible: boolean;
    openSession: boolean;
}

const FLEXIBLE = "__flexible__";

const pad = (n: number) => String(n).padStart(2, "0");
const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function addMinutes(hhmm: string, mins: number): string {
    const [h, m] = hhmm.split(":").map(Number);
    const t = h * 60 + m + mins;
    return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
}
function fmt12(hhmm: string): string {
    const [h, m] = hhmm.split(":").map(Number);
    const period = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${pad(m)} ${period}`;
}

export function SessionPickerModal({ product, customerId, onClose, onPick }: {
    product: SessionProduct | null;
    customerId: string | null;
    onClose: () => void;
    onPick: (pick: SessionPick) => void;
}) {
    // Hooks must run unconditionally — the render is guarded at the end.
    const businessHours     = useAppStore((s) => s.businessHours);
    const shifts            = useAppStore((s) => s.shifts);
    const shiftAssignments  = useAppStore((s) => s.shiftAssignments);
    const staff             = useAppStore((s) => s.staff);
    const blockedTimes      = useAppStore((s) => s.blockedTimes);
    const classSchedules    = useAppStore((s) => s.classSchedules);
    const adminAppointments = useAppStore((s) => s.appointments);
    const classBookings     = useAppStore((s) => s.classBookings);
    const instructors       = useAppStore((s) => s.instructors);
    const customerAppointments = useAppointmentBookings();

    const [dateISO, setDateISO] = useState<string>(() => toISODate(new Date()));
    const [instructorSel, setInstructorSel] = useState<string>(FLEXIBLE);

    // Reset selection whenever a different product opens the modal.
    useEffect(() => {
        if (product) {
            setDateISO(toISODate(new Date()));
            setInstructorSel(FLEXIBLE);
        }
    }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Qualified instructors = the service branch's instructors that are active
    // staff (mirrors the customer flow's active + at-branch pool). Instructors
    // share ids with staff, so the active check crosses the staff slice.
    const qualified = useMemo(() => {
        if (!product) return [] as { id: string; name: string }[];
        const activeStaffIds = new Set(staff.filter((s) => s.status === "active").map((s) => s.id));
        return instructors
            .filter((i) => i.branchId === product.branchId && activeStaffIds.has(i.id))
            .map((i) => ({ id: i.id, name: i.name }));
    }, [product, instructors, staff]);

    // The 14-day date strip anchored to today.
    const dates = useMemo(() => {
        const base = new Date();
        return Array.from({ length: 14 }, (_, i) => {
            const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
            return {
                iso: toISODate(d),
                dow: d.toLocaleDateString("en-US", { weekday: "short" }),
                day: d.getDate(),
                mon: d.toLocaleDateString("en-US", { month: "short" }),
            };
        });
    }, []);

    // AppointmentVM shape the pure slot engine needs (it only reads id / type /
    // durationMins / branchId / capacity).
    const vm = useMemo(() => product ? ({
        id: product.id,
        type: product.openSession ? "open" : "private",
        durationMins: product.durationMin,
        branchId: product.branchId,
        capacity: product.capacity,
    } as unknown as AppointmentVM) : null, [product]);

    // The SlotData bundle — the selected POS customer rides as `member` so a
    // slot they're already booked at is hidden (no double-booking).
    const slotData = useMemo(() => ({
        businessHours, shifts, shiftAssignments, staff, blockedTimes,
        classSchedules, adminAppointments, classBookings, customerAppointments,
        member: customerId ? { id: customerId } : null,
    }), [businessHours, shifts, shiftAssignments, staff, blockedTimes,
        classSchedules, adminAppointments, classBookings, customerAppointments, customerId]);

    // Slot list for the chosen (date, instructor).
    const slots = useMemo(() => {
        if (!product || !vm) return [];
        if (product.openSession) {
            return computeAvailableSlots(vm, null, dateISO, slotData);
        }
        if (instructorSel === FLEXIBLE) {
            // Union every qualified instructor's free times — a slot appears
            // when ≥1 instructor can cover it (studio auto-assigns at pick time).
            const times = new Set<string>();
            for (const i of qualified) {
                for (const s of computeAvailableSlots(vm, i.id, dateISO, slotData)) times.add(s.time);
            }
            return Array.from(times).sort().map((time) => ({ time, spotsLeft: null, capacity: null, booked: null }));
        }
        return computeAvailableSlots(vm, instructorSel, dateISO, slotData);
    }, [product, vm, slotData, dateISO, instructorSel, qualified]);

    if (!product) return null;

    const isPrivate = !product.openSession;

    function pick(time: string) {
        if (!product) return;
        const endTime = addMinutes(time, product.durationMin);
        let instructorId: string | null = null;
        let instructorName: string | undefined;
        let flexible = false;
        if (isPrivate) {
            if (instructorSel === FLEXIBLE) {
                flexible = true;
                // Resolve a concrete free instructor for this slot now — the
                // union guaranteed ≥1 is available, so the studio "auto-assigns"
                // at pick time and the cart + checkout carry a real assignee.
                const freeId = vm
                    ? qualified.find((i) => computeAvailableSlots(vm, i.id, dateISO, slotData).some((s) => s.time === time))?.id ?? null
                    : null;
                instructorId = freeId;
                instructorName = qualified.find((i) => i.id === freeId)?.name;
            } else {
                instructorId = instructorSel;
                instructorName = qualified.find((i) => i.id === instructorSel)?.name;
            }
        }
        onPick({
            dateISO,
            startTime: time,
            endTime,
            durationMin: product.durationMin,
            instructorId,
            instructorName,
            flexible,
            openSession: product.openSession,
        });
    }

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] w-[520px] max-w-[92vw] max-h-[86vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-[#e4e7ec]">
                    <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#667085] uppercase tracking-wide">
                            {product.sessionType === "recovery" ? "Recovery session" : "Private session"}
                        </p>
                        <p className="text-[18px] font-semibold text-[#101828] leading-[26px] truncate">{product.name}</p>
                        <div className="mt-1 flex items-center gap-1.5 text-[13px] text-[#667085]">
                            <ClockFastForward className="w-4 h-4 shrink-0" />
                            <span>{product.durationMin} min</span>
                            <span className="text-[#d0d5dd]">·</span>
                            <span className="font-medium text-[#658774]">AED {product.price.toLocaleString()}</span>
                            {product.openSession && (
                                <>
                                    <span className="text-[#d0d5dd]">·</span>
                                    <span>Up to {product.capacity}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#667085] hover:bg-[#f2f4f7] transition-colors shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
                    {/* Instructor (private / 1:1 only) */}
                    {isPrivate && (
                        <div className="flex flex-col gap-2">
                            <p className="text-[13px] font-medium text-[#344054]">Instructor</p>
                            <div className="flex flex-wrap gap-2">
                                <InstructorChip
                                    label="Flexible"
                                    sublabel="Studio assigns"
                                    active={instructorSel === FLEXIBLE}
                                    onClick={() => setInstructorSel(FLEXIBLE)}
                                />
                                {qualified.map((i) => (
                                    <InstructorChip
                                        key={i.id}
                                        label={i.name}
                                        active={instructorSel === i.id}
                                        onClick={() => setInstructorSel(i.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Date */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[13px] font-medium text-[#344054]">Date</p>
                        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                            {dates.map((d) => {
                                const on = d.iso === dateISO;
                                return (
                                    <button key={d.iso} type="button" onClick={() => setDateISO(d.iso)}
                                        className={cn(
                                            "shrink-0 w-[56px] rounded-[10px] border-1 py-2 flex flex-col items-center gap-0.5 transition-colors",
                                            on ? "border-[#658774] bg-[#f1f7f3]" : "border-[#e4e7ec] bg-white hover:bg-[#f9fafb]",
                                        )}>
                                        <span className={cn("text-[11px] font-medium", on ? "text-[#658774]" : "text-[#667085]")}>{d.dow}</span>
                                        <span className={cn("text-[16px] font-semibold", on ? "text-[#101828]" : "text-[#344054]")}>{d.day}</span>
                                        <span className="text-[10px] text-[#98a2b3]">{d.mon}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Times */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[13px] font-medium text-[#344054]">Time</p>
                        {slots.length === 0 ? (
                            <div className="rounded-[10px] border-1 border-dashed border-[#e4e7ec] bg-[#f9fafb] py-8 flex flex-col items-center gap-1">
                                <p className="text-[14px] font-medium text-[#475467]">No times available</p>
                                <p className="text-[12px] text-[#98a2b3]">
                                    {isPrivate ? "Try another instructor or date." : "Try another date."}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {slots.map((s) => (
                                    <button key={s.time} type="button" onClick={() => pick(s.time)}
                                        className="rounded-[10px] border-1 border-[#e4e7ec] bg-white hover:border-[#658774] hover:bg-[#f1f7f3] px-2 py-2 flex flex-col items-center gap-0.5 transition-colors">
                                        <span className="text-[14px] font-semibold text-[#101828]">{fmt12(s.time)}</span>
                                        {s.spotsLeft !== null && (
                                            <span className="text-[11px] text-[#667085]">{s.spotsLeft} left</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function InstructorChip({ label, sublabel, active, onClick }: {
    label: string; sublabel?: string; active: boolean; onClick: () => void;
}) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "flex items-center gap-1.5 rounded-[8px] border-1 px-3 py-1.5 transition-colors",
                active ? "border-[#658774] bg-[#f1f7f3]" : "border-[#e4e7ec] bg-white hover:bg-[#f9fafb]",
            )}>
            <User01 className={cn("w-4 h-4 shrink-0", active ? "text-[#658774]" : "text-[#98a2b3]")} />
            <span className="flex flex-col items-start leading-tight">
                <span className={cn("text-[13px] font-medium", active ? "text-[#101828]" : "text-[#344054]")}>{label}</span>
                {sublabel && <span className="text-[10px] text-[#98a2b3]">{sublabel}</span>}
            </span>
        </button>
    );
}
