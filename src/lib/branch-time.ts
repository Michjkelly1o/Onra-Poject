// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Branch-scoped time formatting
// ─────────────────────────────────────────────────────────────────────────────
//
// Every branch owns its own IANA timezone (auto-derived from country + city
// via `resolveBranchTimezone` — see src/lib/data/locales.ts). These helpers
// let any surface that displays a branch-scoped time (schedule, class detail,
// appointment detail, customer booking list, instructor account, reports…)
// render the value in that branch's local zone without every caller having
// to look the branch up itself.
//
// Two flavours:
//   • formatUtcInBranchTz — takes a UTC ISO ("2026-05-15T09:00:00Z") and
//                           formats it in the branch's TZ. Use for stored
//                           timestamps (transactions, bookings, ratings).
//   • branchTzLabel      — returns "(UTC+04:00) Abu Dhabi" — the canonical
//                           label appended to every time display. City-only
//                           was tested and dropped (non-technical users
//                           didn't know which city meant which offset).
//
// Wall-clock times (class start_time = "09:00") are ALREADY branch-local by
// construction — no conversion needed, just append the label if you want
// to disambiguate cross-branch views.

import type { Branch } from "@/data/mock/_types";
import { resolveBranchTimezone, timezoneLabel } from "@/lib/data/locales";

/** The IANA zone for a branch. Reads the persisted field first; falls back
 *  to re-derivation from country/city for legacy rows persisted before the
 *  field was added. Never returns undefined. */
export function branchTimezone(branch: Pick<Branch, "timezone" | "country" | "state" | "city"> | null | undefined): string {
    if (!branch) return "Asia/Dubai";
    return branch.timezone ?? resolveBranchTimezone(branch.country, branch.state, branch.city);
}

/** Long label — e.g. "(UTC+04:00) Abu Dhabi". Client Jul 2026: this is the
 *  canonical form for every consumption surface (schedule row, class detail,
 *  customer bookings, reports Location column, etc.) — city-only was
 *  shorter but non-technical users didn't know which city meant which zone.
 *  A short/city variant used to exist here; consolidated into this one. */
export function branchTzLabel(branch: Pick<Branch, "timezone" | "country" | "state" | "city"> | null | undefined): string {
    return timezoneLabel(branchTimezone(branch));
}

/** Format a UTC ISO timestamp (e.g. "2026-05-15T09:00:00Z") in a specific
 *  branch's timezone. Use for stored UTC timestamps that the admin sees
 *  in a branch-scoped context (transactions, booking timestamps, etc.).
 *  Wall-clock times are already local — don't feed them through this.
 *
 *  `opts` is passed through to Intl.DateTimeFormat — omit for the default
 *  short date + time; pass e.g. `{ hour: "2-digit", minute: "2-digit" }`
 *  for time-only. */
export function formatUtcInBranchTz(
    iso: string,
    branch: Pick<Branch, "timezone" | "country" | "state" | "city"> | null | undefined,
    opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" },
): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", { ...opts, timeZone: branchTimezone(branch) });
}
