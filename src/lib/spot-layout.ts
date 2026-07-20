// ─────────────────────────────────────────────────────────────────────────────
// Spot layout — ONE definition shared by admin and customer
// ─────────────────────────────────────────────────────────────────────────────
//
// The admin "Customize area" editor (Schedule → class → spot selection) is the
// source of truth: it stores `{ cols, rows, blockedSpots }` on the class. When a
// class has spot selection on but the admin never customised the grid, BOTH
// sides fall back to the same best-fit default derived from capacity — so the
// customer can never be shown a different room than the studio configured.

/** Row letter for a 0-based row index: 0 → "A", 1 → "B", … */
export function spotRowLabel(row: number): string {
    return String.fromCharCode(65 + row);
}

/** Spot id for a 0-based (row, col): (0,0) → "A1". */
export function spotIdFor(row: number, col: number): string {
    return `${spotRowLabel(row)}${col + 1}`;
}

/** The grid a class gets when spot selection is on but the admin never opened
 *  "Customize area".
 *
 *  This is the SAME default the admin schedule form starts from (`csCols = 4`,
 *  `csRows = 2`) — a fixed 4×2. It is deliberately NOT derived from class
 *  capacity: the grid describes the ROOM, while capacity limits how many
 *  bookings the class takes. A capacity-6 class in an 8-spot room still shows
 *  all 8 spots on both sides. */
export function defaultSpotLayout(): { cols: number; rows: number } {
    return { cols: 4, rows: 2 };
}

/** Every spot id in the configured grid, in reading order.
 *
 *  The FULL grid is rendered — never truncated to class capacity. A studio can
 *  configure an 8-spot room for a class with capacity 6 (blocked spots and
 *  capacity are separate concerns), and the admin editor shows all 8. The
 *  customer must show the same 8, or the two sides display different rooms.
 *  Availability is expressed by BLOCKING spots, not by hiding them. */
export function visibleSpotIds(cols: number, rows: number): string[] {
    const out: string[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) out.push(spotIdFor(r, c));
    }
    return out;
}

/** First spot a member can actually take, in reading order. Used to auto-assign
 *  a spot when a waitlisted booking is promoted (waitlist joins never pick one).
 *  Returns undefined when the class has no spot selection or nothing is free. */
export function firstFreeSpot(
    layout: { cols: number; rows: number; blockedSpots: string[] } | undefined,
    takenSpots: string[],
): string | undefined {
    if (!layout) return undefined;
    const unavailable = new Set([...layout.blockedSpots, ...takenSpots]);
    return visibleSpotIds(layout.cols, layout.rows).find((id) => !unavailable.has(id));
}
