// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `business_hours` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per (branch × weekday). Drives the schedule form's Start/End time
// dropdowns AND the day/week grid time axis — so the two surfaces always
// agree on what's a valid hour to schedule a class.
//
// Hours mix is intentional:
//   • South (main):   7:00–22:00 weekdays, 8:00–20:00 weekends
//   • East:           6:00–21:00 Mon–Fri, 7:00–19:00 Sat, CLOSED Sun
//   • West (inactive branch): closed every day — exercises the "no slots
//                             available" empty state in the form.
//
// `day_of_week` uses JS Date.getUTCDay() conventions: 0=Sun..6=Sat.
//
// FKs: `branch_id` → branches.id

import type { BusinessHours } from "./_types";

type Hours = {
    open: string;
    close: string;
};

function makeWeek(
    branchId: string,
    weekdayHours: Hours | null,
    saturdayHours: Hours | null,
    sundayHours: Hours | null,
): BusinessHours[] {
    const days: { dow: 0 | 1 | 2 | 3 | 4 | 5 | 6; key: string; hours: Hours | null }[] = [
        { dow: 0, key: "sun", hours: sundayHours },
        { dow: 1, key: "mon", hours: weekdayHours },
        { dow: 2, key: "tue", hours: weekdayHours },
        { dow: 3, key: "wed", hours: weekdayHours },
        { dow: 4, key: "thu", hours: weekdayHours },
        { dow: 5, key: "fri", hours: weekdayHours },
        { dow: 6, key: "sat", hours: saturdayHours },
    ];
    return days.map(d => ({
        id: `bh_${branchId.replace("branch_", "")}_${d.key}`,
        branch_id: branchId,
        day_of_week: d.dow,
        open_time:  d.hours?.open  ?? "00:00",
        close_time: d.hours?.close ?? "00:00",
        is_closed:  d.hours === null,
    }));
}

export const business_hours: BusinessHours[] = [
    // Forma South — main branch, longest hours
    ...makeWeek(
        "branch_forma_south",
        { open: "07:00", close: "22:00" },   // Mon–Fri
        { open: "08:00", close: "20:00" },   // Sat
        { open: "08:00", close: "20:00" },   // Sun
    ),

    // Forma East — opens earlier, closes earlier; closed Sundays
    ...makeWeek(
        "branch_forma_east",
        { open: "06:00", close: "21:00" },   // Mon–Fri
        { open: "07:00", close: "19:00" },   // Sat
        null,                                // Sun closed
    ),

    // Forma West — inactive branch, closed every day
    ...makeWeek("branch_forma_west", null, null, null),
];
