"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports module badge components
// ─────────────────────────────────────────────────────────────────────────────
//
// SINGLE source of truth for every pill / badge rendered inside the
// reports tables. Colour tokens are lifted verbatim from the source
// modules so a "Membership" pill, a "Complete" pill, or a "Frozen"
// pill all read identically in a report as they do in the customer /
// payments / membership detail pages.
//
// Sources:
//   • PlanBadge / membership + credit_package   → /admin/customers `PlanBadge`
//   • Status colours (complete / pending / …)    → CustomerPaymentsTab
//   • Plan-status colours (active / expired / …) → CustomerDetailPage
//                                                 `PlanStatusBadge`
//
// Pill chrome (`px-[10px] py-[2px] text-[13px] rounded-full whitespace-nowrap`)
// also matches the source pattern so sizing reads consistently.

import { cn } from "@/lib/utils";

const PILL_BASE =
    "inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap";

// ─── Tone palette (canonical tokens from source modules) ────────────────────

type Tone = "green" | "red" | "yellow" | "blue" | "indigo" | "purple" | "gray";

const TONE: Record<Tone, string> = {
    // Active / Complete / Attended / Rewarded — same green as
    // CustomerPaymentsTab `complete` and StatusBadge `active`.
    green:  "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    // Failed / Removed / Late cancellation.
    red:    "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
    // Pending / In progress / Waitlisted / Paused / Extended.
    yellow: "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
    // Refunded / Frozen / Booked / informational neutral-positive.
    blue:   "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    // Membership pill / Joined referral.
    indigo: "bg-[#eef4ff] border-1 border-[#c7d7fe] text-[#3538cd]",
    // Reserved for purple accents (gift cards / drop-ins).
    purple: "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]",
    // Inactive / Archived / Expired / Cancelled — same gray as
    // PlanStatusBadge `cancelled` / `expired` / StatusBadge `inactive`.
    gray:   "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
};

export interface BadgeProps {
    tone: Tone;
    children: React.ReactNode;
    className?: string;
}

/** Generic tone-keyed pill. Pick the tone by semantic meaning, not by
 *  the literal label — that way every report renders the same status
 *  with the same colour. */
export function Badge({ tone, children, className }: BadgeProps) {
    return <span className={cn(PILL_BASE, TONE[tone], className)}>{children}</span>;
}

// ─── PlanBadge — same shape as /admin/customers `PlanBadge` ────────────────

export type PlanKind = "membership" | "credit_package" | "gift_card" | "drop_in";

const PLAN_LABEL: Record<PlanKind, string> = {
    membership:     "Membership",
    credit_package: "Credit package",
    gift_card:      "Gift card",
    drop_in:        "Drop in",
};
const PLAN_TONE: Record<PlanKind, Tone> = {
    membership:     "indigo",
    credit_package: "gray",
    gift_card:      "yellow",
    drop_in:        "blue",
};

export function PlanBadge({ kind }: { kind: PlanKind }) {
    return <Badge tone={PLAN_TONE[kind]}>{PLAN_LABEL[kind]}</Badge>;
}

export { PLAN_LABEL };
