// Customer — Profile module formatters (AED + dates). Currency per CLAUDE.md.

export function aed(n: number): string {
    return `AED ${n}`;
}

function toDate(iso: string): Date {
    // Date-only ("YYYY-MM-DD") is parsed in local time to avoid a UTC day shift.
    return new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
}

/** "June 30, 2026" */
export function longDate(iso: string): string {
    return toDate(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** "Jun 30, 2026" */
export function shortDate(iso: string): string {
    return toDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "16 Mar 2026" */
export function dayMonthYear(iso: string): string {
    return toDate(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
