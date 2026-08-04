"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra POS — Session picker modal (Private / Recovery)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-08-04 — clicking a Private / Recovery card in the POS catalog
// opens THIS modal to define the booking, then adds it to the cart. On checkout
// the sale books the appointment AND charges for it.
//
// Chrome matches the Gift-card recipient modal (boxed section, header + divider
// + footer). The inputs reuse the same controls the admin class-schedule form
// uses, so the POS feels consistent:
//   • Instructor — a dropdown (Flexible ⟶ studio auto-assigns, or a specific
//     instructor). Private / 1:1 only; open recovery sessions have no instructor.
//   • Date — the shared DatePicker (calendar popover, today-or-future).
//   • Time — the shared TimeDropdown, fed ONLY the slots that are actually free
//     for the chosen instructor (or the Flexible union) on the chosen date.
//
// Every input is connected: changing the instructor or date recomputes the
// available times (and clears a now-stale time pick). Availability comes from
// the SAME pure engine the customer flow uses (`computeAvailableSlots`) — the
// instructor's shift window ∩ branch hours minus their classes / blocked time /
// existing appointments; open sessions follow branch hours and hide full slots.
// The selected POS customer rides as `member` so a slot they're already booked
// at is hidden (no double-booking).

import { useEffect, useMemo, useRef, useState } from "react";
import { XClose, ChevronDown, User01, Check } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { computeAvailableSlots, type AvailableSlot } from "@/lib/customer/slot-availability";
import { useAppointmentBookings } from "@/lib/customer/appointment-bookings";
import type { AppointmentVM } from "@/lib/customer/appointments-data";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { TimeDropdown } from "@/components/ui/TimeDropdown";
import { FixedDropdown } from "@/components/ui/FixedDropdown";

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
    coverImage?: string;
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

/** A session already in the cart — used to hide slots the same customer is
 *  already booked into (they can't be in two sessions at once). */
export interface CartSession {
    dateISO: string;
    startTime: string;
    durationMin: number;
}

const FLEXIBLE = "__flexible__";

const pad = (n: number) => String(n).padStart(2, "0");
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
function addMinutes(hhmm: string, mins: number): string {
    const [h, m] = hhmm.split(":").map(Number);
    const t = h * 60 + m + mins;
    return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
}
/** [aStart,aEnd) overlaps [bStart,bEnd). */
function rangesOverlap(aStart: string, aDur: number, bStart: string, bDur: number): boolean {
    const as = toMin(aStart), ae = as + aDur, bs = toMin(bStart), be = bs + bDur;
    return as < be && ae > bs;
}

export function SessionPickerModal({ product, customerId, cartSessions = [], onClose, onPick }: {
    product: SessionProduct | null;
    customerId: string | null;
    /** Sessions already in the POS cart for this customer — their times are
     *  hidden so the same customer can't be double-booked / a slot oversold. */
    cartSessions?: CartSession[];
    onClose: () => void;
    onPick: (pick: SessionPick) => void;
}) {
    // Hooks run unconditionally — render is guarded at the end.
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

    const [dateISO, setDateISO] = useState<string>(() => todayISO());
    const [instructorSel, setInstructorSel] = useState<string>(FLEXIBLE);
    const [selectedTime, setSelectedTime] = useState<string>("");
    const [instOpen, setInstOpen] = useState(false);
    const [menuWidth, setMenuWidth] = useState(280);
    const instTriggerRef = useRef<HTMLButtonElement>(null);

    // Reset the whole form whenever a different product opens the modal.
    useEffect(() => {
        if (product) {
            setDateISO(todayISO());
            setInstructorSel(FLEXIBLE);
            setSelectedTime("");
            setInstOpen(false);
        }
    }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Qualified instructors = the service branch's active-staff instructors
    // (mirrors the customer flow's active + at-branch pool).
    const qualified = useMemo(() => {
        if (!product) return [] as { id: string; name: string }[];
        const activeStaffIds = new Set(staff.filter((s) => s.status === "active").map((s) => s.id));
        return instructors
            .filter((i) => i.branchId === product.branchId && activeStaffIds.has(i.id))
            .map((i) => ({ id: i.id, name: i.name }));
    }, [product, instructors, staff]);

    // AppointmentVM shape the pure slot engine needs (id / type / durationMins /
    // branchId / capacity).
    const vm = useMemo(() => product ? ({
        id: product.id,
        type: product.openSession ? "open" : "private",
        durationMins: product.durationMin,
        branchId: product.branchId,
        capacity: product.capacity,
    } as unknown as AppointmentVM) : null, [product]);

    const slotData = useMemo(() => ({
        businessHours, shifts, shiftAssignments, staff, blockedTimes,
        classSchedules, adminAppointments, classBookings, customerAppointments,
        member: customerId ? { id: customerId } : null,
    }), [businessHours, shifts, shiftAssignments, staff, blockedTimes,
        classSchedules, adminAppointments, classBookings, customerAppointments, customerId]);

    // The free slots for the current (instructor, date) from the engine.
    // Flexible unions every qualified instructor's free times.
    const rawSlots = useMemo<AvailableSlot[]>(() => {
        if (!product || !vm || !dateISO) return [];
        if (product.openSession) {
            return computeAvailableSlots(vm, null, dateISO, slotData);
        }
        if (instructorSel === FLEXIBLE) {
            const times = new Set<string>();
            for (const i of qualified) {
                for (const s of computeAvailableSlots(vm, i.id, dateISO, slotData)) times.add(s.time);
            }
            return Array.from(times).sort().map((time) => ({ time, spotsLeft: null, capacity: null, booked: null }));
        }
        return computeAvailableSlots(vm, instructorSel, dateISO, slotData);
    }, [product, vm, slotData, dateISO, instructorSel, qualified]);

    // Drop any slot that OVERLAPS a session the same customer already has in the
    // cart on this date — they can't be in two sessions at once, and this also
    // stops an open session being oversold by the same buyer. (Persisted
    // bookings are already handled by the engine via `member`.)
    const availableTimes = useMemo(() => {
        if (!product) return [] as string[];
        const dur = product.durationMin;
        const sameDay = cartSessions.filter((c) => c.dateISO === dateISO);
        return rawSlots
            .filter((s) => !sameDay.some((c) => rangesOverlap(s.time, dur, c.startTime, c.durationMin)))
            .map((s) => s.time);
    }, [rawSlots, cartSessions, product, dateISO]);

    if (!product) return null;

    const isPrivate = !product.openSession;
    const instructorLabel = instructorSel === FLEXIBLE
        ? "Flexible — studio assigns"
        : (qualified.find((i) => i.id === instructorSel)?.name ?? "Select instructor");
    const canAdd = !!dateISO && !!selectedTime;

    function pickInstructor(id: string) {
        setInstructorSel(id);
        setSelectedTime(""); // availability changed → clear stale time
        setInstOpen(false);
    }

    function handleAdd() {
        if (!product || !vm || !dateISO || !selectedTime) return;
        const endTime = addMinutes(selectedTime, product.durationMin);
        let instructorId: string | null = null;
        let instructorName: string | undefined;
        let flexible = false;
        if (isPrivate) {
            if (instructorSel === FLEXIBLE) {
                flexible = true;
                // Resolve a concrete free instructor for this slot now — the
                // union guaranteed ≥1 is available, so the studio "auto-assigns"
                // at pick time and the cart + checkout carry a real assignee.
                const freeId = qualified.find((i) =>
                    computeAvailableSlots(vm, i.id, dateISO, slotData).some((s) => s.time === selectedTime))?.id ?? null;
                // Guard the rare stale case (store changed while the modal was
                // open): never book an unassigned 1:1 session — bail instead.
                if (!freeId) return;
                instructorId = freeId;
                instructorName = qualified.find((i) => i.id === freeId)?.name;
            } else {
                instructorId = instructorSel;
                instructorName = qualified.find((i) => i.id === instructorSel)?.name;
            }
        }
        onPick({
            dateISO,
            startTime: selectedTime,
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
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-full max-w-[520px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-start gap-4 px-6 pt-6 pb-5">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">Book a session</p>
                        <p className="text-[14px] text-[#475467]">
                            {isPrivate ? "Pick the instructor, date and time" : "Pick the date and time"}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0 -mt-1 -mr-2">
                        <XClose className="w-6 h-6 text-[#667085]" />
                    </button>
                </div>
                <div className="h-px bg-[#e4e7ec]" />

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
                    <section className="border-1 border-[#e4e7ec] rounded-[12px] p-5 flex flex-col gap-4">
                        {/* Session summary — cover image + name + facts */}
                        <div className="flex items-center gap-3">
                            {product.coverImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={product.coverImage} alt="" className="w-14 h-14 rounded-[10px] object-cover border-1 border-[#e4e7ec] shrink-0" />
                            ) : (
                                <div className="w-14 h-14 rounded-[10px] bg-gradient-to-br from-[#e9fff3] to-[#f5fffa] border-1 border-[#e4e7ec] shrink-0" />
                            )}
                            <div className="min-w-0">
                                <p className="text-[16px] font-semibold text-[#101828] truncate">{product.name}</p>
                                <p className="text-[13px] text-[#667085]">
                                    {product.durationMin} min · AED {product.price.toLocaleString()}
                                    {product.openSession ? ` · Up to ${product.capacity}` : ""}
                                </p>
                            </div>
                        </div>

                        {/* Instructor — dropdown (private / 1:1 only) */}
                        {isPrivate && (
                            <Field label="Instructor">
                                <button
                                    ref={instTriggerRef}
                                    type="button"
                                    onClick={() => {
                                        if (instTriggerRef.current) setMenuWidth(instTriggerRef.current.offsetWidth);
                                        setInstOpen((o) => !o);
                                    }}
                                    className={cn(
                                        "flex items-center gap-2 w-full h-10 px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)] transition-all",
                                        instOpen ? "ring-2 ring-[#aad4bd] border-[#7ba08c]" : "hover:border-[#7ba08c]",
                                    )}>
                                    <User01 className="w-4 h-4 text-[#667085] shrink-0" />
                                    <span className="flex-1 text-left truncate text-[#101828]">{instructorLabel}</span>
                                    <ChevronDown className={cn("w-4 h-4 text-[#667085] shrink-0 transition-transform", instOpen && "rotate-180")} />
                                </button>
                                <FixedDropdown triggerRef={instTriggerRef} open={instOpen} onClose={() => setInstOpen(false)} minWidth={menuWidth}>
                                    <div className="max-h-[240px] overflow-y-auto">
                                        <InstOption label="Flexible — studio assigns" active={instructorSel === FLEXIBLE} onClick={() => pickInstructor(FLEXIBLE)} />
                                        {qualified.map((i) => (
                                            <InstOption key={i.id} label={i.name} active={instructorSel === i.id} onClick={() => pickInstructor(i.id)} />
                                        ))}
                                    </div>
                                </FixedDropdown>
                            </Field>
                        )}

                        {/* Date */}
                        <Field label="Date">
                            <DatePicker
                                value={dateISO}
                                onChange={(iso) => { setDateISO(iso); setSelectedTime(""); }}
                                minDate={todayISO()}
                            />
                        </Field>

                        {/* Time — fed only the free slots for the current selection */}
                        <Field
                            label="Time"
                            help={availableTimes.length === 0 ? "No times available for this selection." : undefined}
                            helpColor="muted"
                        >
                            <TimeDropdown
                                value={selectedTime}
                                onChange={setSelectedTime}
                                slots={availableTimes}
                                placeholder="Select time"
                                emptyLabel={isPrivate ? "No times available — try another instructor or date." : "No times available — try another date."}
                            />
                        </Field>
                    </section>
                </div>

                {/* Footer */}
                <div className="h-px bg-[#e4e7ec]" />
                <div className="flex gap-3 px-6 py-4 shrink-0">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" size="lg" className="flex-1" disabled={!canAdd} onClick={handleAdd}>
                        Add to cart
                    </Button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, help, helpColor = "muted", children }: {
    label: React.ReactNode;
    help?: React.ReactNode;
    helpColor?: "muted" | "error";
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            {children}
            {help && (
                <p className={cn("text-[13px]", helpColor === "error" ? "text-[#b42318]" : "text-[#667085]")}>{help}</p>
            )}
        </div>
    );
}

function InstOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "flex items-center gap-2 w-full px-4 py-2.5 text-left transition-colors",
                active ? "bg-[#f0fff8]" : "hover:bg-[#f9fafb]",
            )}>
            <span className={cn("flex-1 text-[14px] truncate", active ? "font-semibold text-[#101828]" : "text-[#344054]")}>{label}</span>
            {active && <Check className="w-4 h-4 text-[#658774] shrink-0" />}
        </button>
    );
}
