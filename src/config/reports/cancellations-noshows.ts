// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Cancellations & No-shows
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 321-337 · Cancellations & No-shows).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    cancelledAtISO:   "cancelledAtISO",
    classDateISO:     "classDateISO",
    classDay:         "classDay",
    startTime:        "startTime",
    endTime:          "endTime",
    durationMinutes:  "durationMinutes",
    className:        "className",
    instructor:       "instructor",
    customerName:     "customerName",
    customerId:       "customerId",
    customerEmail:    "customerEmail",
    outcomeType:      "outcomeType",
    creditOutcome:    "creditOutcome",
    charge:           "charge",
    paymentStatus:    "paymentStatus",
    salesChannel:     "salesChannel",
    branchId:         "branchId",
    location:         "location",
} as const;

export const CANCELLATIONS_NOSHOWS_REPORT: ReportDefinition = {
    id:          "cancellations-noshows",
    category:    "class",
    title:       "Cancellations & No-shows",
    description: "Bookings that didn't result in attendance, with credit / charge outcome.",
    type:        "lookback",
    route:       "/reports/cancellations-noshows",
    selector:    "selectBookings",
    periodField: "cancelledAtISO",
    rbac:        ["admin"],

    columns: [
        { key: K.cancelledAtISO,  label: "Cancellation date", kind: "date",     minWidth: 160 },
        { key: K.classDateISO,    label: "Class date",        kind: "date",     minWidth: 140 },
        { key: K.classDay,        label: "Class day",         kind: "text",     minWidth: 120 },
        { key: K.startTime,       label: "Start time",        kind: "text",     minWidth: 120 },
        { key: K.endTime,         label: "End time",          kind: "text",     minWidth: 120 },
        { key: K.durationMinutes, label: "Duration",          kind: "number",   minWidth: 130, calc: "End time − Start time" },
        { key: K.className,       label: "Class name",        kind: "text",     minWidth: 220 },
        { key: K.instructor,      label: "Instructor",        kind: "text",     minWidth: 180 },
        { key: K.customerName,    label: "Customer name",     kind: "text",     minWidth: 200 },
        { key: K.customerId,      label: "Customer ID",       kind: "id",       minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,   label: "Customer email",    kind: "text",     minWidth: 220 },
        { key: K.outcomeType,     label: "Type",              kind: "status",   minWidth: 160 },
        { key: K.creditOutcome,   label: "Credit outcome",    kind: "text",     minWidth: 160 },
        { key: K.charge,          label: "Charge",            kind: "currency", minWidth: 130 },
        { key: K.paymentStatus,   label: "Payment status",    kind: "status",   minWidth: 150 },
        { key: K.salesChannel,    label: "Sales channel",     kind: "text",     minWidth: 180 },
    ],

    // Sheet 1 defaults: type · class · customer.
    dimensions: [
        { key: "type",         label: "Type",         extract: r => String(r[K.outcomeType]  ?? "—") },
        { key: "class",        label: "Class",        extract: r => String(r[K.className]    ?? "—") },
        { key: "customer",     label: "Customer",     extract: r => String(r[K.customerName] ?? "—") },
        { key: "instructor",   label: "Instructor",   extract: r => String(r[K.instructor]   ?? "—") },
        { key: "location",     label: "Location",     extract: r => String(r[K.location]     ?? "—") },
    ],

    measures: [
        { key: "charge", label: "Charge", kind: "currency", extract: r => Number(r[K.charge] ?? 0) },
        { key: "count",  label: "Events", kind: "number",   extract: () => 1 },
    ],

    periods: ["none", "day", "week", "month", "quarter", "year"],
};
