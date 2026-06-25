// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared calendar utilities
// ─────────────────────────────────────────────────────────────────────────────
//
// Centralises the `buildMonthGrid` helper that previously lived inline in
// two schedule pages (admin + instructor). Both copies were
// algorithmically identical — same Monday-first 42-cell layout, same ISO
// formatting — they only differed in whether the returned cell carried a
// `current: true` marker (admin used it, instructor didn't).
//
// The canonical includes `current` so the admin caller keeps its shape;
// the instructor caller simply ignores the extra field.

export interface MonthGridCell {
    /** Cell date as "YYYY-MM-DD". */
    iso: string;
    /** Day-of-month (1–31) shown in the cell. */
    num: number;
    /** Always `true` for non-null cells — kept as a marker for callers that
     *  need to distinguish current-month cells from future "leading"
     *  padding (currently every non-null cell IS the current month, so
     *  this is true for every populated entry). */
    current: true;
}

/**
 * Builds a 42-cell Monday-first month grid for the given "YYYY-MM" string.
 *
 * - Cells outside the actual month are returned as `null` so the calendar
 *   shell can render blank placeholders.
 * - `firstDay.getDay()` returns Sunday=0 — the `+ 6) % 7` offset shifts it
 *   so Monday=0 (which is the layout direction the schedule grids use).
 *
 * @param my - Month string in "YYYY-MM" format (e.g. "2026-03").
 * @returns Array of 42 cells (6 weeks × 7 days); null entries are
 *          out-of-month padding.
 */
export function buildMonthGrid(my: string): Array<MonthGridCell | null> {
    const [y, m] = my.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    // Monday-first offset — getDay() is Sun=0, so (Sun+6)%7 = 6 (last).
    const offset = (firstDay.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => {
        const d = i - offset + 1;
        if (d <= 0 || d > daysInMonth) return null;
        return {
            iso:     `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
            num:     d,
            current: true,
        };
    });
}
