// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shift palette (shared)
// ─────────────────────────────────────────────────────────────────────────────
//
// The shift colours used across the Staff module — Morning (green) / Afternoon
// (blue) / Evening (purple), matching the shift-picker + week-calendar chips.
// Falls back to green by name, else cycles by index so a custom shift still
// reads as a distinct colour. Kept here so the week view and the staff table's
// "Today's schedule" column render the exact same colours.

import type { Shift } from "@/lib/store";

export interface ShiftColor {
    stripe: string;
    bg: string;
    border: string;
    name: string;
    time: string;
}

export const SHIFT_PALETTE: ShiftColor[] = [
    { stripe: "#7ba08c", bg: "#f0faf3", border: "#dcefe3", name: "#101828", time: "#667085" }, // green
    { stripe: "#7cb9d6", bg: "#eef8fc", border: "#d8eef7", name: "#101828", time: "#667085" }, // blue
    { stripe: "#b89bd0", bg: "#f6f1fb", border: "#eaddf5", name: "#101828", time: "#667085" }, // purple
];

export function shiftPalette(shift: Pick<Shift, "name">, index: number): ShiftColor {
    const n = shift.name.toLowerCase();
    if (n.includes("morning")) return SHIFT_PALETTE[0];
    if (n.includes("afternoon")) return SHIFT_PALETTE[1];
    if (n.includes("evening")) return SHIFT_PALETTE[2];
    return SHIFT_PALETTE[index % SHIFT_PALETTE.length];
}
