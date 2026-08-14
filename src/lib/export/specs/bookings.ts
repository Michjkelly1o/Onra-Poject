// ─────────────────────────────────────────────────────────────────────────────
// Export specs — Bookings (child tables)  (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────
//
// Class bookings + appointment bookings — the roster/relationship rows that join
// a customer to a scheduled class or an appointment. Each carries its parent FK
// (class_schedule_id / appointment_id) + customer_id (+ readable name) + status
// + attendance so a migration reconstructs who booked what.

import type { ClassBooking, AppointmentBooking } from "@/lib/store";
import type { ExportColumn, ExportData } from "@/lib/export/export-data";

const boolCell = (v?: boolean): string => (v === undefined ? "" : v ? "true" : "false");

export function classBookingsExportData(rows: ClassBooking[], customerName: (id: string) => string): ExportData<ClassBooking> {
    const columns: ExportColumn<ClassBooking>[] = [
        { key: "id", value: b => b.id },
        { key: "class_schedule_id", value: b => b.classScheduleId },
        { key: "customer_id", value: b => b.customerId },
        { key: "customer_name", value: b => (b.customerId ? customerName(b.customerId) : (b.guestName ?? "")) },
        { key: "branch_id", value: b => b.branchId },
        { key: "plan_id", value: b => b.planId },
        { key: "plan_name", value: b => b.planName },
        { key: "plan_kind_used", value: b => b.planKindUsed ?? "" },
        { key: "status", value: b => b.status },
        { key: "attendance_status", value: b => b.attendanceStatus },
        { key: "spot", value: b => b.spot ?? "" },
        { key: "booking_time", value: b => b.bookingTime },
        { key: "booking_source", value: b => b.bookingSource ?? "" },
        { key: "cancelled_at", value: b => b.cancelledAt ?? "" },
        { key: "cancellation_reason", value: b => b.cancellationReason ?? "" },
        { key: "cancelled_source", value: b => b.cancelledSource ?? "" },
        { key: "refund_credit_issued", value: b => boolCell(b.refundCreditIssued) },
        { key: "waitlist_position", value: b => b.waitlistPosition ?? "" },
        { key: "attendance_marked_at", value: b => b.attendanceMarkedAt ?? "" },
        { key: "attendance_marked_by", value: b => b.attendanceMarkedBy ?? "" },
        { key: "guest_name", value: b => b.guestName ?? "" },
        { key: "guest_phone", value: b => b.guestPhone ?? "" },
        { key: "guest_email", value: b => b.guestEmail ?? "" },
    ];
    return { entity: "class-bookings", columns, rows };
}

export function appointmentBookingsExportData(rows: AppointmentBooking[]): ExportData<AppointmentBooking> {
    const columns: ExportColumn<AppointmentBooking>[] = [
        { key: "id", value: b => b.id },
        { key: "appointment_id", value: b => b.appointmentId },
        { key: "customer_id", value: b => b.customerId },
        { key: "customer_name", value: b => b.customerName },
        { key: "status", value: b => b.status },
        { key: "booked_at", value: b => b.bookedAt },
        { key: "cancelled_at", value: b => b.cancelledAt ?? "" },
        { key: "cancelled_by", value: b => b.cancelledBy ?? "" },
        { key: "attendance_marked_at", value: b => b.attendanceMarkedAt ?? "" },
    ];
    return { entity: "appointment-bookings", columns, rows };
}
