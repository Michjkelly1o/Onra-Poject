// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · Member Movement (Sign-ups & Net Change)
// ─────────────────────────────────────────────────────────────────────────────
//
// Columns + labels are Excel-verbatim from new-prd/Onra_Reporting.xlsx
// (Sheet 2 rows 264-272 · Member Movement).
//
// Aggregate report — one row per (branch × period). Computes opening/
// closing headcount + net change per period.

import type { ReportDefinition } from "@/lib/reports/types";

const K = {
    periodKey:           "periodKey",
    period:              "period",
    activeAtStart:       "activeAtStart",
    newSignups:          "newSignups",
    reactivated:         "reactivated",
    membersLost:         "membersLost",
    netMemberChange:     "netMemberChange",
    activeAtEnd:         "activeAtEnd",
    pctChange:           "pctChange",
    branchId:            "branchId",
    location:            "location",
} as const;

export const MEMBER_MOVEMENT_REPORT: ReportDefinition = {
    id:          "member-movement",
    category:    "customer",
    title:       "Member Movement (Sign-ups & Net Change)",
    description: "New vs lost members in the period, and net change.",
    type:        "lookback",
    route:       "/reports/member-movement",
    selector:    "selectMemberships",
    periodField: "periodKey",
    rbac:        ["admin"],

    columns: [
        { key: K.period,          label: "Period",                 kind: "text",   minWidth: 140 },
        { key: K.activeAtStart,   label: "Active members at start", kind: "number", minWidth: 190 },
        { key: K.newSignups,      label: "New sign-ups",           kind: "number", minWidth: 150 },
        { key: K.reactivated,     label: "Reactivated",            kind: "number", minWidth: 140 },
        { key: K.membersLost,     label: "Members lost",           kind: "number", minWidth: 140 },
        { key: K.netMemberChange, label: "Net member change",      kind: "number", minWidth: 180, calc: "New + Reactivated − Members lost" },
        { key: K.activeAtEnd,     label: "Active members at end",  kind: "number", minWidth: 190, calc: "Active at start + Net change" },
        { key: K.pctChange,       label: "% change",               kind: "percent", minWidth: 130, calc: "(Current − Prior) ÷ Prior" },
    ],

    // Sheet 1 defaults: period · location · source · plan type.
    dimensions: [
        { key: "location", label: "Location", extract: r => String(r[K.location] ?? "—") },
    ],

    measures: [
        { key: "netMemberChange", label: "Net member change", kind: "number", extract: r => Number(r[K.netMemberChange] ?? 0) },
        { key: "newSignups",      label: "New sign-ups",      kind: "number", extract: r => Number(r[K.newSignups]      ?? 0) },
        { key: "membersLost",     label: "Members lost",      kind: "number", extract: r => Number(r[K.membersLost]     ?? 0) },
    ],

    periods: ["none", "month", "quarter", "year"],
};
