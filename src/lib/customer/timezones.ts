// ─────────────────────────────────────────────────────────────────────────────
// Customer — timezone dataset (real IANA zones, live UTC offsets)
// ─────────────────────────────────────────────────────────────────────────────
//
// A curated list of major world cities mapped to their IANA time zone. The UTC
// offset is computed LIVE from the zone via Intl (so it reflects the actual
// current offset, DST included) — never hard-coded. Selection is stored by city
// (a unique label); the pill shows the city's current offset.

export interface TimezoneEntry {
    city: string;
    zone: string; // IANA zone id, e.g. "Asia/Dubai"
}

// West → east, the way a timezone picker reads.
export const TIMEZONES: TimezoneEntry[] = [
    { city: "Midway", zone: "Pacific/Midway" },
    { city: "Honolulu", zone: "Pacific/Honolulu" },
    { city: "Anchorage", zone: "America/Anchorage" },
    { city: "Los Angeles", zone: "America/Los_Angeles" },
    { city: "Vancouver", zone: "America/Vancouver" },
    { city: "Denver", zone: "America/Denver" },
    { city: "Mexico City", zone: "America/Mexico_City" },
    { city: "Chicago", zone: "America/Chicago" },
    { city: "New York", zone: "America/New_York" },
    { city: "Toronto", zone: "America/Toronto" },
    { city: "Bogotá", zone: "America/Bogota" },
    { city: "Santiago", zone: "America/Santiago" },
    { city: "São Paulo", zone: "America/Sao_Paulo" },
    { city: "Buenos Aires", zone: "America/Argentina/Buenos_Aires" },
    { city: "Azores", zone: "Atlantic/Azores" },
    { city: "Reykjavik", zone: "Atlantic/Reykjavik" },
    { city: "London", zone: "Europe/London" },
    { city: "Lisbon", zone: "Europe/Lisbon" },
    { city: "Dublin", zone: "Europe/Dublin" },
    { city: "Paris", zone: "Europe/Paris" },
    { city: "Berlin", zone: "Europe/Berlin" },
    { city: "Madrid", zone: "Europe/Madrid" },
    { city: "Rome", zone: "Europe/Rome" },
    { city: "Amsterdam", zone: "Europe/Amsterdam" },
    { city: "Lagos", zone: "Africa/Lagos" },
    { city: "Athens", zone: "Europe/Athens" },
    { city: "Helsinki", zone: "Europe/Helsinki" },
    { city: "Cairo", zone: "Africa/Cairo" },
    { city: "Johannesburg", zone: "Africa/Johannesburg" },
    { city: "Istanbul", zone: "Europe/Istanbul" },
    { city: "Moscow", zone: "Europe/Moscow" },
    { city: "Nairobi", zone: "Africa/Nairobi" },
    { city: "Riyadh", zone: "Asia/Riyadh" },
    { city: "Tehran", zone: "Asia/Tehran" },
    { city: "Abu Dhabi", zone: "Asia/Dubai" },
    { city: "Baku", zone: "Asia/Baku" },
    { city: "Kabul", zone: "Asia/Kabul" },
    { city: "Karachi", zone: "Asia/Karachi" },
    { city: "Tashkent", zone: "Asia/Tashkent" },
    { city: "Mumbai", zone: "Asia/Kolkata" },
    { city: "Kathmandu", zone: "Asia/Kathmandu" },
    { city: "Dhaka", zone: "Asia/Dhaka" },
    { city: "Yangon", zone: "Asia/Yangon" },
    { city: "Bangkok", zone: "Asia/Bangkok" },
    { city: "Jakarta", zone: "Asia/Jakarta" },
    { city: "Bali (Denpasar)", zone: "Asia/Makassar" },
    { city: "Jayapura", zone: "Asia/Jayapura" },
    { city: "Singapore", zone: "Asia/Singapore" },
    { city: "Hong Kong", zone: "Asia/Hong_Kong" },
    { city: "Shanghai", zone: "Asia/Shanghai" },
    { city: "Manila", zone: "Asia/Manila" },
    { city: "Perth", zone: "Australia/Perth" },
    { city: "Tokyo", zone: "Asia/Tokyo" },
    { city: "Seoul", zone: "Asia/Seoul" },
    { city: "Adelaide", zone: "Australia/Adelaide" },
    { city: "Sydney", zone: "Australia/Sydney" },
    { city: "Brisbane", zone: "Australia/Brisbane" },
    { city: "Nouméa", zone: "Pacific/Noumea" },
    { city: "Auckland", zone: "Pacific/Auckland" },
    { city: "Fiji", zone: "Pacific/Fiji" },
    { city: "Tongatapu", zone: "Pacific/Tongatapu" },
];

const ZONE_BY_CITY = new Map(TIMEZONES.map((t) => [t.city, t.zone]));

/** Set by the appointment slot step before opening the Timezone page, so that
 *  page can badge the branch's zone with "Branch time" (appointment flow only).
 *  The Classes flow clears it (null → no branch badge). */
export const tzPickerCtx: { branchCity: string | null } = { branchCity: null };

/** One-shot per-session flag: the out-of-zone Time Zone sheet is shown once when
 *  the customer enters Search / Appointments, then not auto-shown again. Resets
 *  on a full reload. */
export const tzGate: { confirmed: boolean } = { confirmed: false };

/** The current UTC offset of an IANA zone, e.g. "UTC+04:00" / "UTC±00:00". */
export function offsetLabel(zone: string): string {
    try {
        const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(
            new Date(),
        );
        const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
        const m = name.match(/([+-])(\d{2}):(\d{2})/);
        if (!m) return "UTC±00:00";
        const [, sign, hh, mm] = m;
        if (hh === "00" && mm === "00") return "UTC±00:00";
        return `UTC${sign}${hh}:${mm}`;
    } catch {
        return "UTC±00:00";
    }
}

/** The current UTC offset for a selected city label (falls back gracefully). */
export function offsetForCity(city: string): string {
    const zone = ZONE_BY_CITY.get(city);
    return zone ? offsetLabel(zone) : "UTC±00:00";
}

/** Compact offset for a pill: "UTC+04:00" → "UTC+4", "UTC+05:30" → "UTC+5:30". */
export function compactOffsetLabel(zone: string): string {
    const m = offsetLabel(zone).match(/UTC([+\-±])(\d{2}):(\d{2})/);
    if (!m) return "UTC";
    const [, sign, hh, mm] = m;
    if (sign === "±") return "UTC";
    return mm === "00" ? `UTC${sign}${Number(hh)}` : `UTC${sign}${Number(hh)}:${mm}`;
}
/** Compact offset for a city label ("Abu Dhabi" → "UTC+4"). */
export function compactOffsetForCity(city: string): string {
    const zone = ZONE_BY_CITY.get(city);
    return zone ? compactOffsetLabel(zone) : "UTC";
}

export function isKnownCity(city: string): boolean {
    return ZONE_BY_CITY.has(city);
}

/** The IANA zone for a display-timezone city label (e.g. "Abu Dhabi" →
 *  "Asia/Dubai"), or undefined when the city isn't in the dataset. */
export function zoneForCity(city: string): string | undefined {
    return ZONE_BY_CITY.get(city);
}

const CITY_BY_ZONE = new Map(TIMEZONES.map((t) => [t.zone, t.city]));

/** The picker city for a device IANA zone (from
 *  `Intl.DateTimeFormat().resolvedOptions().timeZone`). Exact zone match first;
 *  otherwise the first city sharing the same current UTC offset (so any device
 *  zone still maps to a selectable option). Undefined if nothing matches. */
export function cityForZone(zone: string): string | undefined {
    const exact = CITY_BY_ZONE.get(zone);
    if (exact) return exact;
    const target = offsetLabel(zone);
    return TIMEZONES.find((t) => offsetLabel(t.zone) === target)?.city;
}
