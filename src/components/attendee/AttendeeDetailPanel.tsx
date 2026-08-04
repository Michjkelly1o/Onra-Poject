"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Module 13 — Attendee class details (`/attendee/[classId]`) — Figma 7962:41946
// ─────────────────────────────────────────────────────────────────────────────
//
// Header reads "Class details" (X close top-left). Left info panel: cover +
// status badge, name, description, Date & time, Class type + Gender access,
// Duration, Class capacity, Location, Instructor. Right: Booked / Waitlisted /
// Cancelled tabs; the Booked roster renders as CARDS (avatar + name + spot +
// a green Present button). "Present all" + each card's Present route through a
// confirmation modal, then surface the Present Details modal (the customer's
// active Class Package + expiry — Figma 7986:135664).
//
// Attendance is the ONLY write — via the shared `updateAttendance` store action,
// so the class detail roster (Module 03), Bookings (04), customer profile (07),
// and Payroll (10) all reflect it the same render cycle.

import { useState, useMemo } from "react";
import {
    XClose, ChevronLeft, CheckCircle, Check, Clock, AlertCircle, Package, SearchMd,
} from "@untitledui/icons";
import { cn, to12h } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { TableAvatar } from "@/components/ui/avatar";
import { NoShowBadge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { isAttendeeOngoing } from "@/components/attendee/attendee-status";
import {
    useAppStore, appointmentToClassInstance, isAppointmentId,
    type ClassInstance, type ClassBooking, type Customer, type CustomerPlan, type GenderAccess,
    type AppointmentBooking,
} from "@/lib/store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function diffMinutes(start: string, end: string): number {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    // Guard sessions that cross midnight (e.g. 23:00 → 00:00) so the
    // duration never renders negative.
    return mins < 0 ? mins + 1440 : mins;
}

/** "2026-07-22" → "22/07/2026". Graceful passthrough for odd inputs. */
function formatExpiryDDMMYYYY(iso: string): string {
    if (!iso || iso.length < 10) return iso || "—";
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
}

const GENDER_LABEL: Record<GenderAccess, string> = {
    all: "All genders",
    female: "Female only",
    male: "Male only",
};

function classTypeLabel(t: "Group" | "Private"): string {
    return t === "Private" ? "Private session" : "Group class";
}

function customerDisplayName(c: Customer | undefined, b: ClassBooking): string {
    if (c) return `${c.firstName} ${c.lastName}`.trim();
    if (b.guestName) return b.guestName;
    return "Guest";
}

/** Project an AppointmentBooking into the ClassBooking shape the Attendee
 *  roster (card + tabs + present flow) already consumes — so Private and
 *  Recovery appointments render through the EXACT same customer card as
 *  classes. Attendance maps: Attended→present, NoShow→no_show. */
function apptBookingToClassBooking(b: AppointmentBooking): ClassBooking {
    return {
        id: b.id,
        classScheduleId: b.appointmentId,
        customerId: b.customerId,
        guestName: b.customerName,
        branchId: "",
        planId: "",
        planName: "",
        status: b.status === "Cancelled" ? "cancelled" : "booked",
        attendanceStatus:
            b.status === "Attended" ? "present"
                : b.status === "NoShow" ? "no_show"
                    : "pending",
        bookingTime: b.bookedAt,
        attendanceMarkedAt: b.attendanceMarkedAt,
    };
}

/** Minimal Customer synthesized from an appointment booking's denormalized
 *  fields — used only as a fallback when the booked customer isn't in the
 *  `customers` store (e.g. a guest), so the shared card's avatar + name
 *  still render. */
function synthCustomerFromApptBooking(b: AppointmentBooking): Customer {
    const [firstName, ...rest] = (b.customerName || "Guest").split(" ");
    return {
        id: b.customerId,
        firstName: firstName ?? b.customerName,
        lastName: rest.join(" "),
        initials: b.customerInitials,
        email: "",
        branchId: "",
        imageUrl: b.customerImageUrl,
        planKind: null,
        createdAt: "",
        status: "active",
    };
}

/** Resolve the customer's active Class Package for the Present Details
 *  modal — newest active package first, else the active membership, else null. */
function resolveActivePlan(plans: CustomerPlan[], customerId: string): { plan: CustomerPlan | null; kind: "package" | "membership" | null } {
    const mine = plans.filter(p => p.customerId === customerId && p.status === "active");
    const pkg = mine
        .filter(p => p.kind === "package")
        .sort((a, b) => b.purchasedAtISO.localeCompare(a.purchasedAtISO))[0];
    if (pkg) return { plan: pkg, kind: "package" };
    const mem = mine
        .filter(p => p.kind === "membership")
        .sort((a, b) => b.purchasedAtISO.localeCompare(a.purchasedAtISO))[0];
    if (mem) return { plan: mem, kind: "membership" };
    return { plan: null, kind: null };
}

// ─── Left panel — class info (Figma 7962:41946 left column) ─────────────────────

function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[14px] text-[#667085] leading-[20px]">{label}</p>
            <div className="text-[16px] font-medium text-[#101828] leading-[24px]">{children}</div>
        </div>
    );
}

function LeftPanel({ ci, instructorLabel }: { ci: ClassInstance; instructorLabel: string }) {
    return (
        <div className="w-[320px] shrink-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden h-full">
            {/* Banner */}
            <div className="relative h-[155px] shrink-0 overflow-hidden" style={{ backgroundColor: ci.coverColor }}>
                {ci.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ci.coverImage} alt={ci.name} className="absolute inset-0 w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[36px] font-bold" style={{ color: "#3b5446" }}>
                            {ci.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                        </span>
                    </div>
                )}
                <div className="absolute top-3 right-3">
                    <StatusBadge type="class-detail" status={ci.status} />
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    <div>
                        <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{ci.name}</h2>
                        <p className="text-[14px] text-[#667085] leading-[20px] mt-1 line-clamp-3">{ci.description}</p>
                    </div>

                    <div className="flex flex-col gap-4">
                        <InfoField label="Date & time">{ci.date} • {ci.displayTime}</InfoField>

                        <div className="grid grid-cols-2 gap-4">
                            <InfoField label="Class type">{classTypeLabel(ci.classType)}</InfoField>
                            <InfoField label="Gender access">{GENDER_LABEL[ci.genderAccess]}</InfoField>
                        </div>

                        <InfoField label="Duration">{diffMinutes(ci.startTime, ci.endTime)} minutes</InfoField>
                        <InfoField label="Class capacity">{ci.capacity} participants</InfoField>
                        {/* Room when one is configured; otherwise fall back to the
                            branch location (e.g. appointments booked without a
                            specific room) — client 2026-07-28. */}
                        <InfoField label="Location">{ci.room || ci.location}</InfoField>
                        <InfoField label="Instructor">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                                    style={{ backgroundColor: ci.instructorColor }}>
                                    {ci.instructorInitials}
                                </div>
                                <span>{instructorLabel}</span>
                            </div>
                        </InfoField>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Present Details modal (success — Figma 7986:135664) ────────────────────────

function PresentDetailsModal({ open, mode, customer, booking, classInstance, activePlan, allCount, onClose }: {
    open: boolean;
    /** "single" → one customer's plan; "all" → the Present-all summary. */
    mode: "single" | "all";
    customer: Customer | null;
    booking: ClassBooking | null;
    classInstance: ClassInstance;
    activePlan: { plan: CustomerPlan | null; kind: "package" | "membership" | null };
    allCount: number;
    onClose: () => void;
}) {
    if (!open) return null;
    const name = customer ? `${customer.firstName} ${customer.lastName}` : (booking?.guestName ?? "Guest");
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-full max-w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onClose}
                    className="absolute right-[16px] top-[16px] w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>

                {/* Header — green check + Present + subline */}
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#e9fff3] flex items-center justify-center shrink-0">
                        <Check className="w-6 h-6 text-[#658774]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full px-4">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Present</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            {mode === "all"
                                ? "All booked customers marked present."
                                : `Enjoy ${classInstance.name} with instructor ${classInstance.instructorName}.`}
                        </p>
                    </div>
                </div>

                {/* Bordered detail row */}
                <div className="px-6 pt-6">
                    {mode === "all" ? (
                        <div className="flex items-center gap-3 p-4 bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px]">
                            <div className="w-10 h-10 rounded-full bg-[#e9fff3] flex items-center justify-center shrink-0">
                                <Check className="w-5 h-5 text-[#658774]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-medium text-[#101828]">{allCount} customer{allCount === 1 ? "" : "s"} marked present</p>
                                <p className="text-[13px] text-[#667085]">{classInstance.name} • {classInstance.displayTime}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 p-4 bg-white border-1 border-[#e4e7ec] rounded-[12px]">
                            <TableAvatar initials={customer?.initials ?? "?"} imageUrl={customer?.imageUrl} size={48} />
                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                                <p className="text-[15px] font-semibold text-[#101828] truncate">{name}</p>
                                {activePlan.plan ? (
                                    <>
                                        <p className="flex items-center gap-1.5 text-[13px] text-[#667085] truncate">
                                            <Package className="w-4 h-4 text-[#667085] shrink-0" />
                                            {activePlan.plan.name}
                                        </p>
                                        <p className="flex items-center gap-1.5 text-[13px] text-[#667085]">
                                            <Clock className="w-4 h-4 text-[#667085] shrink-0" />
                                            Expires in {formatExpiryDDMMYYYY(activePlan.plan.expiryISO)}
                                        </p>
                                    </>
                                ) : (
                                    <p className="flex items-center gap-1.5 text-[13px] text-[#667085]">
                                        <Package className="w-4 h-4 text-[#667085] shrink-0" />
                                        No active package
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-6 pt-6 pb-6">
                    <Button variant="primary" size="lg" className="w-full" onClick={onClose}>
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Roster card (Booked — Figma 7962:41946 right column cards) ─────────────────

function BookedCard({ booking, customer, canPresent, onPresent, onViewDetails }: {
    booking: ClassBooking;
    customer: Customer | undefined;
    /** True only when the class is Ongoing (Present enabled). */
    canPresent: boolean;
    onPresent: () => void;
    onViewDetails: () => void;
}) {
    const isPresent = booking.attendanceStatus === "present";
    const isNoShow = booking.attendanceStatus === "no_show";
    const name = customerDisplayName(customer, booking);
    const spotLabel = booking.spot ? `Spot ${booking.spot}` : "No spot assigned";

    // The whole card is clickable → Present Details ONLY once the customer is
    // marked present (Figma 7962:42232). Active/upcoming cards act via the
    // button, not the card body.
    const cardClickable = isPresent;
    // Active = class Ongoing AND not yet marked → green Present button enabled.
    const active = canPresent && !isPresent && !isNoShow;

    return (
        <div
            role={cardClickable ? "button" : undefined}
            tabIndex={cardClickable ? 0 : undefined}
            onClick={cardClickable ? onViewDetails : undefined}
            onKeyDown={cardClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onViewDetails(); } } : undefined}
            className={cn(
                "flex flex-col gap-4 p-4 bg-white border-1 border-[#e4e7ec] rounded-[12px]",
                cardClickable && "cursor-pointer transition-shadow hover:shadow-[0px_4px_8px_-2px_rgba(16,24,40,0.10),0px_2px_4px_-2px_rgba(16,24,40,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#aad4bd]",
            )}
        >
            {/* Top row — 48px avatar + name (bold) + spot beneath */}
            <div className="flex items-center gap-3">
                <TableAvatar initials={customer?.initials ?? name.split(" ").map(w => w[0]).join("").slice(0, 2)} imageUrl={customer?.imageUrl} size={48} />
                <div className="flex-1 min-w-0">
                    <p className="text-[16px] font-semibold text-[#101828] leading-[24px] truncate">{name}</p>
                    <p className="text-[14px] text-[#667085] leading-[20px]">{spotLabel}</p>
                </div>
                {isNoShow && <NoShowBadge />}
            </div>

            {/* Full-width Present button — secondary green outline, at md size so
                it matches the "Present all" action's size (client 2026-07-31). */}
            {active ? (
                // Active state — green outline, opens the Present confirmation modal.
                <Button
                    variant="secondary-gray"
                    size="md"
                    className="w-full text-[#067647] border-[#a9c3b4] hover:bg-[#ecfdf3] hover:text-[#067647]"
                    leftIcon={<CheckCircle className="w-4 h-4 text-[#067647]" />}
                    onClick={(e) => { e.stopPropagation(); onPresent(); }}
                >
                    Present
                </Button>
            ) : (
                // Disabled state — muted check + "Present", NO hover, not
                // clickable. Covers both "already marked present" and "Upcoming /
                // not started". Raw button so the muted look is exact (not the DS
                // opacity-50 fade); kept at h-10 so it matches the md Present size.
                <button
                    type="button"
                    disabled
                    className="w-full h-10 flex items-center justify-center gap-1 rounded-[8px] border-1 border-[#e4e7ec] bg-white text-[14px] font-semibold text-[#98a2b3] cursor-not-allowed"
                >
                    <CheckCircle className="w-4 h-4 text-[#98a2b3]" />
                    Present
                </button>
            )}
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type RosterTab = "booked" | "waitlisted" | "cancelled";
type ConfirmKind = "single" | "all" | "self";

/** The Class-details slide panel — a wide right-anchored drawer (SlidePanel).
 *  Reused by the Attendee calendar's "View details" and the direct-URL route,
 *  so the attendance flow reads the same everywhere. */
export function AttendeeDetailPanel({ open, classId, onClose }: { open: boolean; classId: string; onClose: () => void }) {
    return (
        <SlidePanel open={open} onClose={onClose} width={1000} panelClassName="max-w-[96vw]">
            <AttendeeDetailContent classId={classId} onClose={onClose} />
        </SlidePanel>
    );
}

export function AttendeeDetailContent({ classId, variant = "panel", onClose }: {
    classId: string;
    /** "panel" — inside the SlidePanel (has a close X). "page" — standalone
     *  full-page view (no close X), used when opened in its own browser tab. */
    variant?: "panel" | "page";
    onClose?: () => void;
}) {
    const classSchedules = useAppStore(s => s.classSchedules);
    const classBookings = useAppStore(s => s.classBookings);
    const appointments = useAppStore(s => s.appointments);
    const appointmentBookings = useAppStore(s => s.appointmentBookings);
    const customers = useAppStore(s => s.customers);
    const customerPlans = useAppStore(s => s.customerPlans);
    const updateAttendance = useAppStore(s => s.updateAttendance);
    const markAppointmentPresent = useAppStore(s => s.markAppointmentPresent);
    const markAppointmentPresentBulk = useAppStore(s => s.markAppointmentPresentBulk);
    const showToast = useAppStore(s => s.showToast);

    // The Attendee console handles BOTH classes and appointments (Private +
    // Recovery) on this one screen, so both render through the exact same
    // roster card. `appt_`-prefixed ids resolve from the appointments slice.
    const isAppt = isAppointmentId(classId);
    const appointment = isAppt ? appointments.find(a => a.id === classId) : undefined;
    const classInstance = isAppt
        ? (appointment ? appointmentToClassInstance(appointment) : undefined)
        : classSchedules.find(c => c.id === classId);

    const [rosterSearch, setRosterSearch] = useState("");
    const [confirm, setConfirm] = useState<{ kind: ConfirmKind; booking?: ClassBooking } | null>(null);
    const [presentDetails, setPresentDetails] = useState<
        { mode: "single" | "all"; booking?: ClassBooking; count: number } | null
    >(null);

    const customerById = useMemo(() => {
        const map = new Map(customers.map(c => [c.id, c]));
        if (isAppt) {
            for (const b of appointmentBookings) {
                if (b.appointmentId === classId && !map.has(b.customerId)) {
                    map.set(b.customerId, synthCustomerFromApptBooking(b));
                }
            }
        }
        return map;
    }, [customers, isAppt, appointmentBookings, classId]);

    const bookings = useMemo(
        () => isAppt
            ? appointmentBookings.filter(b => b.appointmentId === classId).map(apptBookingToClassBooking)
            : classBookings.filter(b => b.classScheduleId === classId),
        [isAppt, appointmentBookings, classBookings, classId],
    );
    const bookedRows = bookings.filter(b => b.status === "booked");

    if (!classInstance) {
        return (
            <div className="flex h-full flex-col bg-white">
                <div className="flex items-center justify-between h-[64px] shrink-0 border-b border-[#e4e7ec] px-6">
                    <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">{isAppt ? "Appointment" : "Class"}</p>
                    {variant === "panel" && (
                        <button type="button" onClick={onClose} aria-label="Close"
                            className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                            <XClose className="w-5 h-5 text-[#667085]" />
                        </button>
                    )}
                </div>
                <div className="flex-1 flex items-center justify-center text-center px-6">
                    <div>
                        <p className="text-[18px] font-semibold text-[#101828]">This {isAppt ? "appointment" : "class"} is no longer available</p>
                        {variant === "panel" && (
                            <button type="button" onClick={onClose}
                                className="mt-4 text-[14px] text-[#658774] hover:underline">
                                Back to Attendee
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }
    const ci: ClassInstance = classInstance;

    // Attendee-only: Mark-present opens 30 min before start (client 2026-08-04),
    // matching the list's early-Ongoing rule — not the studio-wide status.
    const isOngoing = isAttendeeOngoing(ci.status, ci.dateISO, ci.startTime);
    const startHint = `Starts at ${to12h(ci.startTime)}`;
    const instructorLabel = (() => {
        const parts = ci.instructorName.split(" ");
        if (parts.length <= 1) return ci.instructorName || "Open session";
        return `${parts[0]} ${parts.slice(1).map(p => p[0]).join(".")}.`;
    })();

    const bookedCount = bookedRows.length;
    const notYetPresent = bookedRows.filter(b => b.attendanceStatus !== "present");

    // Roster search — filter the Booked cards by customer name (Figma "Search
    // customer…"). Empty query passes everything through.
    const q = rosterSearch.trim().toLowerCase();
    const visibleBooked = q
        ? bookedRows.filter(b => customerDisplayName(customerById.get(b.customerId), b).toLowerCase().includes(q))
        : bookedRows;

    // ── Present writes (all go through a confirm modal first) ─────────────────

    function writePresent(booking: ClassBooking) {
        if (isAppt) markAppointmentPresent(booking.id);
        else updateAttendance(booking.id, "present");
        const c = customerById.get(booking.customerId);
        showToast(
            "Attendance marked as present",
            `${customerDisplayName(c, booking)} has been marked present for ${ci.name}.`,
            "success", "check",
        );
    }

    function handleConfirm() {
        if (!confirm) return;
        if (confirm.kind === "single" && confirm.booking) {
            const b = confirm.booking;
            writePresent(b);
            setConfirm(null);
            setPresentDetails({ mode: "single", booking: b, count: 1 });
            return;
        }
        if (confirm.kind === "self") {
            const target = confirm.booking ?? notYetPresent[0];
            if (target) {
                writePresent(target);
                setConfirm(null);
                setPresentDetails({ mode: "single", booking: target, count: 1 });
            } else {
                setConfirm(null);
            }
            return;
        }
        if (confirm.kind === "all") {
            const targets = notYetPresent;
            if (isAppt) markAppointmentPresentBulk(targets.map(b => b.id));
            else targets.forEach(b => updateAttendance(b.id, "present"));
            const count = targets.length;
            setConfirm(null);
            showToast(
                "All booked customers marked present",
                `${count} customer${count === 1 ? "" : "s"} marked present for ${ci.name}.`,
                "success", "check",
            );
            setPresentDetails({ mode: "all", count });
        }
    }

    // Confirm-modal copy per variant.
    const confirmCopy = (() => {
        if (!confirm) return { title: "", description: "" as React.ReactNode, confirmLabel: "Confirm" };
        if (confirm.kind === "all") {
            return {
                title: "Present all booked customers?",
                description: "This will mark all booked customers in this session as present. This action cannot be undone.",
                confirmLabel: "Present all",
            };
        }
        if (confirm.kind === "self") {
            const target = confirm.booking ?? notYetPresent[0];
            const c = target ? customerById.get(target.customerId) : undefined;
            return {
                title: `Check in to ${ci.name}?`,
                description: target
                    ? `${customerDisplayName(c, target)} will be checked in and marked present for this session.`
                    : "Everyone booked is already present.",
                confirmLabel: "Confirm check-in",
            };
        }
        const c = confirm.booking ? customerById.get(confirm.booking.customerId) : undefined;
        return {
            title: `Mark ${confirm.booking ? customerDisplayName(c, confirm.booking) : "customer"} as present?`,
            description: "This marks the customer present for this session. This action cannot be undone.",
            confirmLabel: "Mark present",
        };
    })();

    // Present Details modal data resolution.
    const detailsCustomer = presentDetails?.booking ? customerById.get(presentDetails.booking.customerId) ?? null : null;
    const detailsActivePlan = presentDetails?.booking
        ? resolveActivePlan(customerPlans, presentDetails.booking.customerId)
        : { plan: null, kind: null };

    // Header title follows the booking name — a class reads "<name> class"; an
    // appointment (Private / Recovery) reads just its service name.
    const headerTitle = isAppt ? ci.name : `${ci.name} class`;

    return (
        <div className="flex h-full flex-col bg-white">
            {/* Header — booking name; close (X) only in the side-panel variant. */}
            <div className="flex items-center justify-between h-[64px] shrink-0 border-b border-[#e4e7ec] px-6">
                <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">{headerTitle}</p>
                {variant === "panel" && (
                    <button type="button" onClick={onClose} aria-label="Close"
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                )}
            </div>

            {/* Body — info column + participants card, side by side. */}
            <div className="flex-1 min-h-0 flex gap-6 p-6 overflow-hidden">
                <LeftPanel ci={ci} instructorLabel={instructorLabel} />
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-1 border-[#e4e7ec] rounded-[20px]">
                    {/* Participants header — title + Search participant (no tabs, no filter). */}
                    <div className="shrink-0 flex items-center gap-3 flex-wrap px-6 pt-6 pb-4">
                        <p className="flex-1 min-w-0 text-[18px] font-semibold text-[#101828] leading-[28px]">Participants</p>
                        <div className="relative w-[240px]">
                            <SearchMd className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085] pointer-events-none" />
                            <input
                                type="text"
                                value={rosterSearch}
                                onChange={(e) => setRosterSearch(e.target.value)}
                                placeholder="Search participant..."
                                className="w-full h-10 pl-9 pr-3 bg-white border border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                            />
                        </div>
                    </div>

                    {/* Participants grid */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-6 flex flex-col gap-5">
                        {!isOngoing && (
                            <div className="flex items-center gap-2 p-3 bg-[#fffaeb] border-1 border-[#fedf89] rounded-[10px]">
                                <AlertCircle className="w-4 h-4 text-[#dc6803] shrink-0" />
                                <p className="text-[13px] text-[#93370d]">
                                    This {isAppt ? "session" : "class"} hasn&apos;t started yet — attendance opens when it becomes Ongoing ({startHint}).
                                </p>
                            </div>
                        )}

                        {bookedRows.length === 0 ? (
                            <div className="py-16 text-center">
                                <p className="text-[15px] font-semibold text-[#101828]">No participants yet.</p>
                                <p className="text-[14px] text-[#667085] mt-1">Booked customers will appear here.</p>
                            </div>
                        ) : visibleBooked.length === 0 ? (
                            <div className="py-16 text-center">
                                <p className="text-[15px] font-semibold text-[#101828]">No participants match &ldquo;{rosterSearch}&rdquo;.</p>
                                <p className="text-[14px] text-[#667085] mt-1">Try a different name.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {visibleBooked.map(b => (
                                    <BookedCard
                                        key={b.id}
                                        booking={b}
                                        customer={customerById.get(b.customerId)}
                                        canPresent={isOngoing}
                                        onPresent={() => setConfirm({ kind: "single", booking: b })}
                                        onViewDetails={() => setPresentDetails({ mode: "single", booking: b, count: 1 })}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Present confirmation — every Present action confirms first. */}
            <ConfirmModal
                open={!!confirm}
                onClose={() => setConfirm(null)}
                icon={CheckCircle}
                tone="success"
                title={confirmCopy.title}
                description={confirmCopy.description}
                confirmLabel={confirmCopy.confirmLabel}
                onConfirm={handleConfirm}
            />

            {/* Present Details (success) */}
            <PresentDetailsModal
                open={!!presentDetails}
                mode={presentDetails?.mode ?? "single"}
                customer={detailsCustomer}
                booking={presentDetails?.booking ?? null}
                classInstance={ci}
                activePlan={detailsActivePlan}
                allCount={presentDetails?.count ?? 0}
                onClose={() => setPresentDetails(null)}
            />

            <Toast />
        </div>
    );
}

// ─── Simple roster list (Waitlisted / Cancelled tabs) ──────────────────────────

function RosterList({ rows, customerById, emptyTitle, emptySubtitle }: {
    rows: ClassBooking[];
    customerById: Map<string, Customer>;
    emptyTitle: string;
    emptySubtitle: string;
}) {
    if (rows.length === 0) {
        return (
            <div className="py-16 text-center">
                <p className="text-[15px] font-semibold text-[#101828]">{emptyTitle}</p>
                <p className="text-[14px] text-[#667085] mt-1">{emptySubtitle}</p>
            </div>
        );
    }
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
            {rows.map(b => {
                const c = customerById.get(b.customerId);
                const name = customerDisplayName(c, b);
                return (
                    <div key={b.id} className="flex items-center gap-3 p-4 bg-white border-1 border-[#e4e7ec] rounded-[16px]">
                        <TableAvatar initials={c?.initials ?? name.split(" ").map(w => w[0]).join("").slice(0, 2)} imageUrl={c?.imageUrl} size={40} />
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium text-[#101828] truncate">{name}</p>
                            <p className="text-[13px] text-[#667085]">
                                {b.status === "waitlisted" && b.waitlistPosition ? `Position ${b.waitlistPosition}` : b.spot ? `Spot ${b.spot}` : "—"}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
