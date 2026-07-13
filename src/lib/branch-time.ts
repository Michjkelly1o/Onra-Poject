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
//   • formatUtcInBranchTz  — takes a UTC ISO ("2026-05-15T09:00:00Z") and
//                            formats it in the branch's TZ. Use for stored
//                            timestamps (transactions, bookings, ratings).
//   • branchTzTag / branchTzShortLabel — return the human labels used in
//                            the small "· Asia/Dubai" / "(UTC+04:00)" tags
//                            that we append next to time strings.
//
// Wall-clock times (class start_time = "09:00") are ALREADY branch-local by
// construction — no conversion needed, just append the label if you want
// to disambiguate cross-branch views.

import type { Branch } from "@/data/mock/_types";
import { resolveBranchTimezone, timezoneLabel } from "@/lib/data/locales";

/** The IANA zone for a branch. Reads the persisted field first; falls back
 *  to re-derivation from country/city for legacy rows persisted before the
 *  field was added. Never returns undefined. */
export function branchTimezone(branch: Pick<Branch, "timezone" | "country" | "city"> | null | undefined): string {
    if (!branch) return "Asia/Dubai";
    return branch.timezone ?? resolveBranchTimezone(branch.country, branch.city);
}

/** Long label — e.g. "(UTC+04:00) Abu Dhabi". Same style used inside the
 *  Branch detail Timezone row and the Business & locations list sub-line
 *  (so every surface reads consistently). */
export function branchTzLabel(branch: Pick<Branch, "timezone" | "country" | "city"> | null | undefined): string {
    return timezoneLabel(branchTimezone(branch));
}

/** Short label — the trailing part of an IANA zone id, e.g.
 *  "Dubai" for "Asia/Dubai", "New York" for "America/New_York".
 *  Used for compact tags next to a time string. */
export function branchTzShortLabel(branch: Pick<Branch, "timezone" | "country" | "city"> | null | undefined): string {
    const iana = branchTimezone(branch);
    const last = iana.split("/").pop() ?? iana;
    return last.replace(/_/g, " ");
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
    branch: Pick<Branch, "timezone" | "country" | "city"> | null | undefined,
    opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" },
): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", { ...opts, timeZone: branchTimezone(branch) });
}
