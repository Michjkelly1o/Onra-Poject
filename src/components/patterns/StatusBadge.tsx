"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared StatusBadge
// ─────────────────────────────────────────────────────────────────────────────
//
// Single source of truth for every coloured status pill across admin +
// instructor + customer-profile inner tabs.
//
// Before centralisation: 38 module-specific `*StatusBadge` components were
// scattered across the codebase, each redefining the same Active / Inactive /
// Archived palette inline. A second-pass audit captured every variant + every
// palette before this file was authored — see
// [COMPONENT_CENTRALIZATION_PLAN.md](../../../COMPONENT_CENTRALIZATION_PLAN.md)
// for the migration matrix.
//
// Design notes:
//  • The `type` prop discriminates which `status` values + palette are valid
//    for this badge. TypeScript autocompletes per type via the discriminated
//    union below.
//  • The `size` prop maps the 3 wrapper variants observed across the
//    existing badges (12 / 13 / 14 px text). `md` is the default and matches
//    ~30 of the 38 prior implementations.
//  • The `label` prop overrides the displayed text when the caller needs
//    something dynamic ("Waitlist #3") instead of the default status string.
//  • The `className` prop appends extra classes — used for layout overrides
//    (e.g. the dashboard's `absolute right-3 top-3` overlay variant).

import * as React from "react";
import { cn } from "@/lib/utils";

// ─── Palette catalogue ──────────────────────────────────────────────────────
//
// Twelve unique palettes captured from the audit. Reused across many type ×
// status combinations — e.g. `green` is both "Active" (every entity), "Paid"
// (payroll), "Completed" (class / appointment), and "Signed" (agreement).

const PALETTE = {
    green:        "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    greenLight:   "bg-[#e9fff3] border-1 border-[#abefc6] text-[#067647]",       // Booked appointment variant
    gray:         "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    grayLight:    "bg-[#f2f4f7] border-1 border-[#e4e7ec] text-[#344054]",       // Upcoming class detail variant
    grayDashed:   "bg-white border border-dashed border-[#d0d5dd] text-[#667085]", // "No plan" only
    blue:         "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    red:          "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
    redIntense:   "bg-[#fef3f2] border-1 border-[#fda29b] text-[#b42318]",       // Appointment NoShow only
    orange:       "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
    purple:       "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]",
    indigo:       "bg-[#eef4ff] border-1 border-[#c7d7fe] text-[#3538cd]",
    teal:         "bg-[#f5fffa] border-1 border-[#aad4bd] text-[#3b5446]",       // Monthly pay-rate
} as const;
export type PaletteKey = keyof typeof PALETTE;

// ─── Wrapper size variants ──────────────────────────────────────────────────

const SIZE = {
    sm: "inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium",
    md: "inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap",
    lg: "inline-flex items-center px-[10px] py-[2px] rounded-full text-[14px] font-medium whitespace-nowrap",
} as const;
type Size = keyof typeof SIZE;

// ─── Registry: which (type, status) → which palette + label ─────────────────
//
// One row per badge variant in the codebase. The mapping was extracted from
// the second-pass audit (38 implementations captured verbatim). Adding a new
// status type means adding a single line here.

interface RegistryEntry {
    palette: PaletteKey;
    label: string;
}
type StatusRegistry = Record<string, Record<string, RegistryEntry>>;

const REGISTRY: StatusRegistry = {
    // ── Lifecycle (Active / Inactive / Archived) ──────────────────────────
    customer: {
        active:   { palette: "green", label: "Active" },
        inactive: { palette: "gray",  label: "Inactive" },
        archived: { palette: "gray",  label: "Archived" },
    },
    product: {
        active:   { palette: "green", label: "Active" },
        inactive: { palette: "gray",  label: "Inactive" },
        archived: { palette: "gray",  label: "Archived" },
    },
    "gift-card": {
        active:   { palette: "green", label: "Active" },
        inactive: { palette: "gray",  label: "Inactive" },
        archived: { palette: "gray",  label: "Archived" },
    },
    promo: {
        active:   { palette: "green", label: "Active" },
        inactive: { palette: "gray",  label: "Inactive" },
        archived: { palette: "gray",  label: "Archived" },
        expired:  { palette: "gray",  label: "Expired" },
    },
    marketing: {
        active:   { palette: "green", label: "Active" },
        inactive: { palette: "gray",  label: "Inactive" },
        archived: { palette: "gray",  label: "Archived" },
        expired:  { palette: "gray",  label: "Expired" },
    },
    "tax-rate": {
        active:   { palette: "green", label: "Active" },
        inactive: { palette: "gray",  label: "Inactive" },
        archived: { palette: "gray",  label: "Archived" },
    },
    agreement: {
        active:   { palette: "green", label: "Active" },
        archived: { palette: "gray",  label: "Archived" },
    },
    template: {
        Active:   { palette: "green", label: "Active" },
        Inactive: { palette: "gray",  label: "Inactive" },
        Archived: { palette: "gray",  label: "Archived" },
    },
    service: {
        Active:   { palette: "green", label: "Active" },
        Inactive: { palette: "gray",  label: "Inactive" },
        Archived: { palette: "gray",  label: "Archived" },
    },
    branch: {
        active:   { palette: "green", label: "Active" },
        inactive: { palette: "gray",  label: "Inactive" },
        archive:  { palette: "gray",  label: "Archived" },
    },
    shift: {
        active:   { palette: "green", label: "Active" },
        inactive: { palette: "gray",  label: "Inactive" },
        archive:  { palette: "gray",  label: "Archived" },
    },

    // ── Class lifecycle (Upcoming / Ongoing / Completed / Cancelled) ──────
    class: {
        Upcoming:  { palette: "gray",      label: "Upcoming" },
        Ongoing:   { palette: "blue",      label: "Ongoing" },
        Completed: { palette: "green",     label: "Completed" },
        Cancelled: { palette: "red",       label: "Cancelled" },
    },
    "class-detail": {
        // ClassStatusBadge inside /schedule/[id] uses grayLight (#f2f4f7) for
        // Upcoming instead of gray (#f9fafb). Preserved as a distinct entry.
        Upcoming:  { palette: "grayLight", label: "Upcoming" },
        Ongoing:   { palette: "blue",      label: "Ongoing" },
        Completed: { palette: "green",     label: "Completed" },
        Cancelled: { palette: "red",       label: "Cancelled" },
    },
    "class-payroll": {
        // PayrollInstructorDetailPage tints Upcoming blue + Ongoing orange.
        Upcoming:  { palette: "blue",      label: "Upcoming" },
        Ongoing:   { palette: "orange",    label: "Ongoing" },
        Completed: { palette: "green",     label: "Completed" },
        Cancelled: { palette: "red",       label: "Cancelled" },
    },
    appointment: {
        // ServiceDetailPage's AppointmentStatusBadge uses grayLight for Upcoming.
        Upcoming:  { palette: "grayLight", label: "Upcoming" },
        Ongoing:   { palette: "blue",      label: "Ongoing" },
        Completed: { palette: "green",     label: "Completed" },
        Cancelled: { palette: "red",       label: "Cancelled" },
    },

    // ── Bookings (customer-facing) ────────────────────────────────────────
    booking: {
        Upcoming:           { palette: "gray",   label: "Upcoming" },
        Waitlisted:         { palette: "purple", label: "Waitlisted" },
        Ongoing:            { palette: "blue",   label: "Ongoing" },
        Completed:          { palette: "green",  label: "Completed" },
        "No show":          { palette: "red",    label: "No show" },
        Cancelled:          { palette: "red",    label: "Cancelled" },
        "Cancelled (late)": { palette: "red",    label: "Cancelled (late)" },
    },
    "appointment-booking": {
        Booked:    { palette: "greenLight", label: "Booked" },
        Attended:  { palette: "green",      label: "Attended" },
        NoShow:    { palette: "redIntense", label: "No show" },
        Cancelled: { palette: "red",        label: "Cancelled" },
    },

    // ── Plans ─────────────────────────────────────────────────────────────
    plan: {
        membership: { palette: "indigo",     label: "Membership" },
        package:    { palette: "gray",       label: "Package" },
        none:       { palette: "grayDashed", label: "No plan" },
    },
    "plan-status": {
        active:    { palette: "green", label: "Active" },
        expired:   { palette: "gray",  label: "Expired" },
        frozen:    { palette: "blue",  label: "Frozen" },
        cancelled: { palette: "gray",  label: "Cancelled" },
        removed:   { palette: "red",   label: "Removed" },
    },

    // ── Transactions ──────────────────────────────────────────────────────
    transaction: {
        complete: { palette: "green",  label: "Complete" },
        pending:  { palette: "orange", label: "Pending" },
        failed:   { palette: "red",    label: "Failed" },
        refunded: { palette: "blue",   label: "Refunded" },
    },

    // ── Staff / Instructor / Pay-rate ─────────────────────────────────────
    instructor: {
        active:   { palette: "green", label: "Active" },
        inactive: { palette: "red",   label: "Inactive" },
        archive:  { palette: "gray",  label: "Archived" },
    },
    staff: {
        pending:  { palette: "orange", label: "Pending" },
        active:   { palette: "green",  label: "Active" },
        inactive: { palette: "gray",   label: "Inactive" },
        archive:  { palette: "gray",   label: "Archived" },
    },
    role: {
        active:   { palette: "green", label: "Active" },
        inactive: { palette: "gray",  label: "Inactive" },
        archive:  { palette: "gray",  label: "Archived" },
    },
    "pay-rate": {
        active:  { palette: "green", label: "Active" },
        archive: { palette: "gray",  label: "Archived" },
    },
    "pay-rate-type": {
        flat:    { palette: "blue",   label: "Flat" },
        tiered:  { palette: "orange", label: "Tiered" },
        revenue: { palette: "green",  label: "Revenue" },
        hybrid:  { palette: "purple", label: "Hybrid" },
        monthly: { palette: "teal",   label: "Monthly" },
    },
    payroll: {
        paid:    { palette: "green",  label: "Paid" },
        pending: { palette: "orange", label: "Pending" },
    },

    // ── Customer agreements (signed / unsigned) ───────────────────────────
    "agreement-customer": {
        signed:   { palette: "green", label: "Signed" },
        unsigned: { palette: "red",   label: "Unsigned" },
    },

    // ── Boolean connection / version states ──────────────────────────────
    payment: {
        connected:    { palette: "green", label: "Connected" },
        disconnected: { palette: "gray",  label: "Not connected" },
    },
    integration: {
        connected:    { palette: "green", label: "Connected" },
        disconnected: { palette: "gray",  label: "Not connected" },
    },
    version: {
        active:   { palette: "green", label: "Active" },
        archived: { palette: "gray",  label: "Archived" },
    },
    // ── AI Agent migration & imports (2026-07-20) ────────────────────────
    import: {
        imported: { palette: "green",  label: "Imported" },
        partial:  { palette: "orange", label: "Partial"  },
        failed:   { palette: "red",    label: "Failed"   },
        pending:  { palette: "gray",   label: "Pending"  },
    },

    // ── Customer & Lead Management v83 (client 2026-07-24) ───────────────
    //
    // Layer 1 — AI-owned lifecycle stage. One of 7 tags per the plan's
    // "Lifecycle rules" table (Churned > At Risk > Won-back > New Active >
    // Loyal Active > Trialist > Lead). Palette chosen so severity reads
    // at a glance without a legend:
    //   Lead        → blue        (fresh prospect, neutral-positive)
    //   Trialist    → purple      (in a trial, not yet converted)
    //   New Active  → greenLight  (fresh paid, less bold than Loyal)
    //   Loyal Active→ green       (fully active paying member)
    //   At Risk     → orange      (warning — recover before churn)
    //   Churned     → gray        (lost, muted)
    //   Won-back    → teal        (returning after lapse, distinct hue)
    lifecycle: {
        "Lead":         { palette: "blue",       label: "Lead"         },
        "Trialist":     { palette: "purple",     label: "Trialist"     },
        "New Active":   { palette: "greenLight", label: "New Active"   },
        "Loyal Active": { palette: "green",      label: "Loyal Active" },
        "At Risk":      { palette: "orange",     label: "At Risk"      },
        "Churned":      { palette: "gray",       label: "Churned"      },
        "Won-back":     { palette: "teal",       label: "Won-back"     },
    },
    // Orthogonal VIP flag — stacks on top of `lifecycle`. Single status,
    // rendered whenever `customer.isVip === true`.
    vip: {
        vip: { palette: "indigo", label: "VIP" },
    },
    // Layer 2 — human-owned pre-conversion follow-up state. Only rendered
    // for Lead / Trialist customers; the profile hides it downstream.
    "follow-up": {
        "New":           { palette: "gray",   label: "New"          },
        "Contacted":     { palette: "blue",   label: "Contacted"    },
        "Trial booked":  { palette: "purple", label: "Trial booked" },
        "Follow-up":     { palette: "orange", label: "Follow-up"    },
        "Won":           { palette: "green",  label: "Won"          },
        "Lost":          { palette: "red",    label: "Lost"         },
    },
};

export type StatusBadgeType = keyof typeof REGISTRY;

// ─── Props ──────────────────────────────────────────────────────────────────

export interface StatusBadgeProps {
    /** Which badge family — determines the (status → palette + label) lookup
     *  table. Add new types to the REGISTRY above; this prop autocompletes. */
    type: StatusBadgeType;
    /** Status value within the chosen type. Cast strings here are safe
     *  because the caller's local type already constrains the union. */
    status: string;
    /** Optional override for the displayed text. Use when the label needs
     *  dynamic content like a queue position ("Waitlist #3") that the
     *  registry can't compute. */
    label?: string;
    /** v83 audit-3 (2026-07-27) — explicit palette override. Used by the
     *  follow-up pill where the customer's stored `followUpStatus` can
     *  be renamed by the studio and no longer matches the REGISTRY key.
     *  Caller resolves the palette from the stable stage id + passes it
     *  here; the registry lookup is bypassed. */
    paletteOverride?: PaletteKey;
    /** Wrapper size. Defaults to "md" (px-[10px] py-[2px] text-[13px]). */
    size?: Size;
    /** Extra Tailwind classes appended to the wrapper. Used for layout
     *  overrides like `absolute right-3 top-3 pointer-events-none`. */
    className?: string;
    /** Optional element rendered inside the pill, right after the text.
     *  Client 2026-07-29 — added so the lifecycle pill can carry a small
     *  info-icon entry point INSIDE the badge (opens the Lifecycle-stage
     *  side panel). Callers pass a button; the pill just provides the
     *  slot with a small left margin. */
    trailingIcon?: React.ReactNode;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function StatusBadge({ type, status, label, paletteOverride, size = "md", className, trailingIcon }: StatusBadgeProps) {
    const entry = REGISTRY[type]?.[status];
    // paletteOverride wins over the REGISTRY lookup — used by the
    // follow-up pill so a Phase-6 rename doesn't lose the palette
    // (renamed labels don't match REGISTRY keys). Otherwise defensive
    // fallback: unknown (type, status) → gray + dev warning.
    const palette = paletteOverride
        ? PALETTE[paletteOverride]
        : entry ? PALETTE[entry.palette] : PALETTE.gray;
    const text    = label ?? entry?.label ?? status;
    if (!entry && !paletteOverride && process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`[StatusBadge] unknown (type, status) pair: ("${type}", "${status}"). Add it to REGISTRY in src/components/patterns/StatusBadge.tsx.`);
    }
    return (
        <span className={cn(SIZE[size], palette, className, trailingIcon && "inline-flex items-center gap-1.5")}>
            {text}
            {trailingIcon}
        </span>
    );
}
