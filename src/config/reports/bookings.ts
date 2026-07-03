// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Bookings
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 294-304 · Bookings).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    bookingDateISO:   "bookingDateISO",
    classDateISO:     "classDateISO",
    typeLabel:        "typeLabel",
    instructor:       "instructor",
    customerName:     "customerName",
    customerId:       "customerId",
    customerEmail:    "customerEmail",
    outcomeLabel:     "outcomeLabel",
    cancellationType: "cancellationType",
    salesChannel:     "salesChannel",
    branchId:         "branchId",
    location:         "location",
} as const;

export const BOOKINGS_REPORT: ReportDefinition = {
    id:          "bookings",
    category:    "class",
    title:       "Bookings",
    description: "Every booking and its outcome (attended, cancelled, no-show).",
    type:        "lookback",
    route:       "/reports/bookings",
    selector:    "selectBookings",
    periodField: "bookingDateISO",
    rbac:        ["admin", "instructor:self"],

    columns: [
        { key: K.bookingDateISO,   label: "Booking date",     kind: "date",   minWidth: 140 },
        { key: K.classDateISO,     label: "Class date",       kind: "date",   minWidth: 140 },
        { key: K.typeLabel,        label: "Type",             kind: "text",   minWidth: 140 },
        { key: K.instructor,       label: "Instructor",       kind: "text",   minWidth: 180 },
        { key: K.customerName,     label: "Customer name",    kind: "text",   minWidth: 200 },
        { key: K.customerId,       label: "Customer ID",      kind: "id",     minWidth: 160, hiddenByDefault: true },
        { key: K.customerEmail,    label: "Customer email",   kind: "text",   minWidth: 220 },
        { key: K.outcomeLabel,     label: "Status",           kind: "status", minWidth: 140 },
        { key: K.cancellationType, label: "Cancellation type", kind: "text",  minWidth: 170 },
        { key: K.salesChannel,     label: "Sales channel",    kind: "text",   minWidth: 180 },
    ],

    // Sheet 1 defaults: status · event type · customer · instructor · sales channel.
    dimensions: [
        { key: "status",        label: "Status",        extract: r => String(r[K.outcomeLabel]  ?? "—") },
        { key: "type",          label: "Event type",    extract: r => String(r[K.typeLabel]     ?? "—") },
        { key: "instructor",    label: "Instructor",    extract: r => String(r[K.instructor]    ?? "—") },
        { key: "sales_channel", label: "Sales channel", extract: r => String(r[K.salesChannel]  ?? "—") },
        { key: "location",      label: "Location",      extract: r => String(r[K.location]      ?? "—") },
    ],

    measures: [
        { key: "count", label: "Bookings", kind: "number", extract: () => 1 },
    ],

    periods: ["none", "day", "week", "month", "quarter", "year"],
};
