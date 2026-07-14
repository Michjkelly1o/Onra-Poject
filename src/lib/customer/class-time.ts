"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — dual-timezone class time (Branch time + Your time)
// ─────────────────────────────────────────────────────────────────────────────
//
// A class start is a WALL-CLOCK time in its branch's zone (dateISO "2026-02-20" +
// startTime "10:00"). This resolves that instant and formats it in both the
// branch's zone ("Branch time") and the customer's display timezone ("Your time").
// When the two zones resolve to the same instant offset, `yourTime` is null — the
// caller then shows the branch time alone (per the client rule).

import type { Branch } from "@/data/mock/_types";
import { branchTimezone } from "@/lib/branch-time";
import { zoneForCity } from "@/lib/customer/timezones";

/** A zone's UTC offset (minutes) at a given absolute instant — DST-correct. */
function zoneOffsetMinutes(zone: string, atUtcMs: number): number {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    const p: Record<string, string> = {};
    for (const part of dtf.formatToParts(new Date(atUtcMs))) p[part.type] = part.value;
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return Math.round((asUtc - atUtcMs) / 60000);
}

/** Absolute instant (ms) for a wall-clock (dateISO + "HH:MM") interpreted in `zone`. */
function wallClockInstant(dateISO: string, startTime: string, zone: string): number {
    const [y, m, d] = dateISO.split("-").map(Number);
    const [hh, mm] = startTime.split(":").map(Number);
    const naiveUtc = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
    // Offset at the naive instant is a close-enough anchor for a wall-clock.
    return naiveUtc - zoneOffsetMinutes(zone, naiveUtc) * 60000;
}

/** "Sun, 20 Feb 2025 · 10:00 AM" for an instant, rendered in `zone`. */
function formatInZone(instant: number, zone: string): string {
    const date = new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(instant);
    const time = new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(instant);
    return `${date} · ${time}`;
}

/** Just the time-of-day (e.g. "10:00 PM") for a branch wall-clock, rendered in
 *  the customer's selected timezone. `pad` → leading-zero hour ("07:00 PM").
 *  Falls back to the branch's own zone when the customer city is unknown. */
export function timeInZoneLabel(
    dateISO: string,
    startTime: string,
    branch: Pick<Branch, "timezone" | "country" | "state" | "city"> | null | undefined,
    customerCity: string,
    pad = false,
): string {
    const branchZone = branchTimezone(branch);
    const customerZone = zoneForCity(customerCity) ?? branchZone;
    const instant = wallClockInstant(dateISO, startTime, branchZone);
    return new Intl.DateTimeFormat("en-US", {
        timeZone: customerZone,
        hour: pad ? "2-digit" : "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(instant);
}

export interface ClassTimeDisplay {
    /** The class time in its branch's timezone (always shown). */
    branchTime: string;
    /** The class time in the customer's timezone — null when it matches the branch. */
    yourTime: string | null;
}

/** Resolve a class's Branch-time / Your-time pair. `customerCity` is the member's
 *  display-timezone city (context `timezone`); falls back to the branch zone. */
export function classTimeDisplay(
    dateISO: string,
    startTime: string,
    branch: Pick<Branch, "timezone" | "country" | "state" | "city"> | null | undefined,
    customerCity: string,
): ClassTimeDisplay {
    const branchZone = branchTimezone(branch);
    const customerZone = zoneForCity(customerCity) ?? branchZone;
    const instant = wallClockInstant(dateISO, startTime, branchZone);
    const branchTime = formatInZone(instant, branchZone);
    // Same instant offset in both zones → one line is enough.
    const same = zoneOffsetMinutes(branchZone, instant) === zoneOffsetMinutes(customerZone, instant);
    return { branchTime, yourTime: same ? null : formatInZone(instant, customerZone) };
}
