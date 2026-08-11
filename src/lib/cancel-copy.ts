// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — shared cancel-confirmation copy (client 2026-08-11)
// ─────────────────────────────────────────────────────────────────────────────
//
// One source of truth for the cancel pop-up wording so every surface (schedule
// list/day/week/month + quick action bar, class detail, private/recovery session
// detail) reads identically.
//
// Rules (client feedback):
//   • Title    — class → "Cancel this class?"; private/recovery → "Cancel this session?"
//   • Notify   — 0 booked  → "No one is booked yet."
//                1 booked  → "Sara M. will be notified and refunded."   (customer's name)
//                2+ booked → "6 booked customers will be notified and refunded."
//   • Buttons  — "Keep session" / "Cancel session" (per client feedback, all types).

/** "Sara" + "Miller" → "Sara M." (first name + last initial). */
export function shortCustomerName(firstName: string, lastName?: string): string {
    const first = (firstName ?? "").trim();
    const li = (lastName ?? "").trim().charAt(0);
    return li ? `${first} ${li}.` : first;
}

/** The notify line, driven by the list of booked customers' short names. */
export function cancelNotifyLine(bookedNames: string[]): string {
    const n = bookedNames.length;
    if (n === 0) return "No one is booked yet.";
    if (n === 1) return `${bookedNames[0]} will be notified and refunded.`;
    return `${n} booked customers will be notified and refunded.`;
}

/** Modal title by session type. */
export function cancelTitle(isAppointment: boolean): string {
    return isAppointment ? "Cancel this session?" : "Cancel this class?";
}

/** Confirmation buttons — same wording for every type (client feedback). */
export const CANCEL_KEEP_LABEL = "Keep session";
export const CANCEL_CONFIRM_LABEL = "Cancel session";
