// ─────────────────────────────────────────────────────────────────────────────
// Customer experience — shared display formatters
// ─────────────────────────────────────────────────────────────────────────────
// Pure, reused across member screens (Home, Bookings, …). No store/seed access.

/** "2026-05-18" → "Mon, 18 May" (matches the booking-card date format). */
export function formatShortDate(dateISO: string): string {
    return new Date(`${dateISO}T00:00:00Z`).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
    });
}

/** "09:00" → "9 AM", "17:30" → "5.30 PM" (Onra convention: dot minutes, drop :00). */
export function formatTime12(hhmm: string): string {
    const [hRaw, mRaw] = hhmm.split(":");
    let h = Number.parseInt(hRaw ?? "0", 10);
    const mm = Number.parseInt(mRaw ?? "0", 10) || 0;
    const meridiem = h >= 12 ? "PM" : "AM";
    h %= 12;
    if (h === 0) h = 12;
    return mm === 0 ? `${h} ${meridiem}` : `${h}.${String(mm).padStart(2, "0")} ${meridiem}`;
}
