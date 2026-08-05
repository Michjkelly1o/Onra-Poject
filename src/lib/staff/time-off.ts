// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Time-off display helpers (shared across Schedule + Staff)
// ─────────────────────────────────────────────────────────────────────────────
//
// A blocked-time / time-off card reads as REASON (title) + DURATION (subtext):
//   • title    → the custom label if set, else the reason ("Vacation", "Sick"…)
//   • duration → "All day" for an all-day block, else "07:00 – 09:00 AM"
// One source so the schedule day/week grids and the staff module stay identical.

import type { BlockedTime } from "@/lib/store";

export const TIME_OFF_REASON_LABEL: Record<"sick" | "vacation" | "training" | "other", string> = {
    sick: "Sick",
    vacation: "Vacation",
    training: "Training",
    other: "Other",
};

/** Card title — the custom label if present, otherwise the reason label. */
export function timeOffTitle(b: Pick<BlockedTime, "title" | "reason">): string {
    return (b.title ?? "").trim() || TIME_OFF_REASON_LABEL[b.reason ?? "other"];
}

function fmt12(time: string): string {
    const [h, m] = time.split(":").map(Number);
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    return `${hh}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

/** Card subtext — "All day" or the "07:00 – 09:00 AM" time range. */
export function timeOffDuration(b: Pick<BlockedTime, "all_day" | "start_time" | "end_time">): string {
    if (b.all_day) return "All day";
    return `${fmt12(b.start_time)} – ${fmt12(b.end_time)}`;
}
