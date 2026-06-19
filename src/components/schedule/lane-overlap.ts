// Side-by-side overlap layout for the week-view time grid.
//
// When two or more classes share the same day + time window, they need to
// render side by side in the same column (Google / Outlook calendar pattern)
// instead of stacking on top of each other. This helper computes a horizontal
// "lane" per class so the WeekView renderer can position each card with a
// shared column width.
//
// Visible lanes are capped at `maxVisible` (default 2 for the week view — any
// more and the cards become unreadably narrow at common screen widths). Any
// classes that fall into overflow lanes are NOT rendered; their count surfaces
// as a "+N more" badge on the rightmost-visible card of the same group.

export interface LaneAssignment {
    /** 0-based lane within the overlap group. Lane 0 = leftmost. */
    lane: number;
    /** Total visible lanes the group is split into (≤ `maxVisible`). */
    totalLanes: number;
    /** False when this card falls into an overflow lane and should not
     *  render — its presence is surfaced via `moreCount` on the badge
     *  holder instead. */
    visible: boolean;
    /** Number of additional overlapping classes hidden behind this card.
     *  Set on the rightmost-visible card per overlap group (the badge
     *  holder). Zero on every other card. */
    moreCount: number;
}

interface TimedItem {
    id: string;
    /** "HH:MM" 24-hour format — matches the schedule store's `startTime`. */
    startTime: string;
    /** "HH:MM" 24-hour format — matches the schedule store's `endTime`. */
    endTime: string;
}

export function computeOverlapLanes<T extends TimedItem>(
    items: T[],
    maxVisible = 2,
): Map<string, LaneAssignment> {
    const result = new Map<string, LaneAssignment>();
    if (items.length === 0) return result;

    // Stable sort: startTime ascending, longer classes first on ties so tall
    // cards anchor lane 0 and shorter ones stack to their right.
    const sorted = [...items].sort((a, b) =>
        a.startTime.localeCompare(b.startTime) ||
        b.endTime.localeCompare(a.endTime),
    );

    // Transitive overlap groups — open a new group whenever the next item
    // starts at-or-after the running group end. Classes that share even one
    // overlap chain land in the same group (A↔B + B↔C ⇒ {A,B,C}).
    type Group = { items: T[]; end: string };
    const groups: Group[] = [];
    for (const cls of sorted) {
        const last = groups[groups.length - 1];
        if (last && cls.startTime < last.end) {
            last.items.push(cls);
            if (cls.endTime > last.end) last.end = cls.endTime;
        } else {
            groups.push({ items: [cls], end: cls.endTime });
        }
    }

    for (const group of groups) {
        // Greedy lane fitting — first lane whose last event ended on or
        // before the current event's start.
        const laneEnds: string[] = [];
        const assignment: number[] = [];
        for (const cls of group.items) {
            let lane = laneEnds.findIndex(end => cls.startTime >= end);
            if (lane === -1) lane = laneEnds.length;
            laneEnds[lane] = cls.endTime;
            assignment.push(lane);
        }

        const usedLanes = laneEnds.length;
        const visibleLanes = Math.min(usedLanes, maxVisible);
        const hiddenCount = group.items.reduce(
            (acc, _, i) => assignment[i] >= visibleLanes ? acc + 1 : acc,
            0,
        );

        // Badge holder = last item in the rightmost-visible lane (the one
        // the user sees last in left-to-right reading order).
        let badgeHolderId: string | null = null;
        if (hiddenCount > 0) {
            for (let i = group.items.length - 1; i >= 0; i--) {
                if (assignment[i] === visibleLanes - 1) {
                    badgeHolderId = group.items[i].id;
                    break;
                }
            }
        }

        group.items.forEach((cls, i) => {
            const lane = assignment[i];
            result.set(cls.id, {
                lane,
                totalLanes: visibleLanes,
                visible: lane < visibleLanes,
                moreCount: cls.id === badgeHolderId ? hiddenCount : 0,
            });
        });
    }

    return result;
}
