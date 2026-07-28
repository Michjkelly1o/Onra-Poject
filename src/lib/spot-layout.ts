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

/** Auto-generate the most BALANCED rows × cols grid for a class of `capacity`
 *  seats, used when spot selection is on but the admin never customised the
 *  layout. Prefers an exact factorisation when the sides aren't too skewed
 *  (10 → 5×2, 15 → 5×3, 8 → 4×2, 12 → 4×3); when `capacity` doesn't factor
 *  cleanly it rounds UP to the nearest balanced grid, leaving a few unused
 *  positions (11 → 4×3 = 12, one unused). Never a skinny 1×N strip. Returns
 *  `cols ≥ rows` (wider than tall) for a room-like layout. Client 2026-07-28. */
export function balancedSpotGrid(capacity: number): { cols: number; rows: number } {
    const n = Math.max(1, Math.floor(capacity));
    let best: { cols: number; rows: number; score: number; waste: number } | null = null;
    for (let rows = 1; rows <= n; rows++) {
        const cols = Math.ceil(n / rows);
        if (rows > cols) break; // past the square point — mirrors already seen
        const waste = rows * cols - n;
        // Weight wasted positions heavily so an exact fit (e.g. 2×5 for 10)
        // beats a squarer-but-wasteful grid (3×4 = 12), while still rejecting
        // skinny strips via the |cols − rows| balance term.
        const score = waste * 3 + Math.abs(cols - rows);
        if (!best || score < best.score || (score === best.score && waste < best.waste)) {
            best = { cols, rows, score, waste };
        }
    }
    return { cols: best!.cols, rows: best!.rows };
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
