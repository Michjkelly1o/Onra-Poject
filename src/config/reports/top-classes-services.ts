// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Top Classes & Services
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 339-349 · Top Classes & Services).

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    serviceType:      "serviceType",
    className:        "className",
    sessionsRun:      "sessionsRun",
    totalBookings:    "totalBookings",
    totalAttended:    "totalAttended",
    noShows:          "noShows",
    avgFillPct:       "avgFillPct",
    avgShowUpPct:     "avgShowUpPct",
    uniqueCustomers:  "uniqueCustomers",
    branchId:         "branchId",
    location:         "location",
    dateAnchorISO:    "dateAnchorISO",
} as const;

export const TOP_CLASSES_SERVICES_REPORT: ReportDefinition = {
    id:          "top-classes-services",
    category:    "class",
    title:       "Top Classes & Services",
    description: "Classes and services ranked by bookings, attendance and fill.",
    type:        "lookback",
    route:       "/reports/top-classes-services",
    selector:    "selectClassSessions",
    periodField: "dateAnchorISO",
    rbac:        ["admin"],

    columns: [
        { key: K.serviceType,     label: "Service type",         kind: "text",    minWidth: 160 },
        { key: K.className,       label: "Class / service name", kind: "text",    minWidth: 240 },
        { key: K.sessionsRun,     label: "Sessions run",         kind: "number",  minWidth: 140 },
        { key: K.totalBookings,   label: "Total bookings",       kind: "number",  minWidth: 150 },
        { key: K.totalAttended,   label: "Total attended",       kind: "number",  minWidth: 150 },
        { key: K.noShows,         label: "No-shows",             kind: "number",  minWidth: 130 },
        { key: K.avgFillPct,      label: "Avg fill %",           kind: "percent", minWidth: 130, calc: "Booked ÷ Capacity" },
        { key: K.avgShowUpPct,    label: "Avg show-up %",        kind: "percent", minWidth: 160, calc: "Total attended ÷ Total booked" },
        { key: K.uniqueCustomers, label: "Unique customers",     kind: "number",  minWidth: 170 },
    ],

    // Sheet 1 default: service type.
    dimensions: [
        { key: "service_type", label: "Service type", extract: r => String(r[K.serviceType]  ?? "—") },
        { key: "class",        label: "Class",        extract: r => String(r[K.className]    ?? "—") },
        { key: "location",     label: "Location",     extract: r => String(r[K.location]     ?? "—") },
    ],

    measures: [
        { key: "totalBookings",  label: "Total bookings",  kind: "number", extract: r => Number(r[K.totalBookings]  ?? 0) },
        { key: "totalAttended",  label: "Total attended",  kind: "number", extract: r => Number(r[K.totalAttended]  ?? 0) },
        { key: "uniqueCustomers", label: "Unique customers", kind: "number", extract: r => Number(r[K.uniqueCustomers] ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
