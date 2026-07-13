"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — BookingStatusCard — the status block under the hero (Figma 3696-33904)
// ─────────────────────────────────────────────────────────────────────────────
//
// A tinted card stating the booking's state (Booked / Joined waitlist / Class
// attended / Cancelled (no charge) / Cancelled (late) / No show). Brand-secondary
// green tint for confirmed; faint concentric rings emanate from the top-right
// corner; the status icon sits inline at 20px (no ring wrapper).

import { BOOKING_STATUS, STATUS_RING, type BookingViewStatus } from "@/lib/customer/bookings-data";

export function BookingStatusCard({
    viewStatus,
    spot,
    waitlistPosition,
}: {
    viewStatus: BookingViewStatus;
    spot?: string;
    waitlistPosition?: number;
}) {
    const p = BOOKING_STATUS[viewStatus];
    const Icon = p.cardIcon;
    const ring = STATUS_RING[viewStatus];
    // Booked surfaces the reserved spot; waitlisted surfaces the queue position.
    const sub =
        viewStatus === "booked" && spot
            ? `Your spot in this class is confirmed, and spot ${spot} is reserved for you.`
            : viewStatus === "waitlisted" && waitlistPosition
              ? `You're #${waitlistPosition} on the waitlist. You'll be notified if a spot becomes available.`
              : p.cardSub;
    return (
        <div className={`relative flex items-start gap-4 overflow-hidden rounded-2xl border p-4 ${p.cardBg}`}>
            {/* A few faint concentric rings emanating from just past the top-right
                corner (Figma "Background pattern decorative/Circles", opacity 16%). */}
            <div aria-hidden className="pointer-events-none absolute right-0 top-0" style={{ opacity: 0.5 }}>
                {[96, 168, 240, 312].map((d) => (
                    <span
                        key={d}
                        className="absolute rounded-full border"
                        style={{ width: d, height: d, right: -14 - d / 2, top: -14 - d / 2, borderColor: ring }}
                    />
                ))}
            </div>
            <div className="relative flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-sm font-semibold leading-5 text-[var(--brand-text)]">{p.cardTitle}</p>
                <p className="text-xs font-normal leading-[18px] text-[#344054]">{sub}</p>
            </div>
            <Icon className="relative size-5 shrink-0" style={{ color: p.cardIconColor }} aria-hidden />
        </div>
    );
}
