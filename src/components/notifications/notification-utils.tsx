// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Notification rendering helpers
// ─────────────────────────────────────────────────────────────────────────────
//
// Shared between the bell-icon dropdown (`NotificationBell.tsx`) and the
// `/admin/notifications` full page so the icon mapping, relative time, and
// section bucketing stays consistent.

"use client";

import {
    CalendarCheck02,
    CalendarMinus02,
    UserX01,
    CreditCard01,
    RefreshCcw01,
    XCircle,
    BankNote01,
} from "@untitledui/icons";
import type { NotificationIcon, Notification } from "@/lib/store";

// ─── Icon mapping ────────────────────────────────────────────────────────────

const ICON_MAP: Record<NotificationIcon, React.FC<{ className?: string }>> = {
    "calendar-check": CalendarCheck02,
    "calendar-minus": CalendarMinus02,
    "user-x": UserX01,
    "credit-card": CreditCard01,
    "refresh": RefreshCcw01,
    // `calendar-x` covers the "class cancelled" notification — no dedicated
    // calendar-x glyph in the icon pack, so the next-closest crossed-out
    // circle stands in.
    "calendar-x": XCircle,
    // Instructor earnings glyph — used for `payment_earned` and
    // `weekly_earnings` rows on the instructor feed.
    "bank-note": BankNote01,
};

/** Resolve the icon component for a notification's icon glyph. */
export function iconForNotification(icon: NotificationIcon): React.FC<{ className?: string }> {
    return ICON_MAP[icon] ?? CalendarCheck02;
}

// ─── Relative timestamp ──────────────────────────────────────────────────────

/** "2 min ago" / "14 min ago" / "2 hr ago" / "Yesterday" / "2 days ago" / "May 3"
 *  — matches the Figma timestamp treatment. */
export function relativeTime(iso: string): string {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffMs = now - then;
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Section bucketing (Today / Past) ────────────────────────────────────────

/** Returns true if `iso` falls inside the calendar day of `referenceMs`
 *  (local time). Used to split the feed into "Today" and "Past". */
export function isToday(iso: string, referenceMs: number = Date.now()): boolean {
    const d = new Date(iso);
    const ref = new Date(referenceMs);
    return d.getFullYear() === ref.getFullYear()
        && d.getMonth() === ref.getMonth()
        && d.getDate() === ref.getDate();
}

/** Split a list of notifications into Today vs Past buckets, preserving the
 *  caller's incoming sort order inside each bucket. */
export function bucketByDay(list: Notification[]): { today: Notification[]; past: Notification[] } {
    const today: Notification[] = [];
    const past: Notification[] = [];
    const nowMs = Date.now();
    for (const n of list) {
        (isToday(n.createdAt, nowMs) ? today : past).push(n);
    }
    return { today, past };
}

// ─── Click-through route resolver ────────────────────────────────────────────

/** Map a notification to the route it should navigate to on click.
 *
 * Routing rules — every notification deep-links to the **module that owns
 * the underlying record**, so the click feels like opening the source of
 * truth, not just a stub:
 *
 *   • Booking events (`booking_confirmation`, `late_cancellation`,
 *     `no_show`, `waitlist_promoted`) → `/schedule/[classScheduleId]`
 *     — the class-detail page surfaces the booking on the roster tab,
 *     with `?highlight=` carrying the booking id so the row can be
 *     scrolled into view / pulsed on landing.
 *   • Class event (`class_cancelled`) → `/schedule/[classScheduleId]` —
 *     opens directly on the cancelled class detail.
 *   • Payment events (`payment_confirmed`, `refund_processed`) →
 *     `/customers/[customerId]` — the customer profile's Payments tab
 *     shows the receipt. `?tx=` carries the transaction id for highlight.
 *
 * Falls back to `/admin/notifications` only when no FK link survives. */
export function routeForNotification(n: Notification): string {
    // Instructor click-throughs land on instructor-side surfaces — bookings
    // open the instructor's schedule entry, earnings open the earnings page.
    const isInstructor = n.audience === "instructor";

    switch (n.tab) {
        case "booking": {
            // Booking + class events both live under the class-detail page.
            //
            //   • Admin → `/schedule/[id]` (admin's existing detail page)
            //   • Instructor → `/class/[id]` (instructor's Ongoing/Upcoming
            //     detail page; its mount-time guard auto-redirects
            //     Completed/Cancelled to `/earnings/[id]`, so any class
            //     status routes correctly without having to inspect status
            //     from the notification payload here).
            //
            // `returnTo` carries the notification feed so the detail page's
            // X-close button lands the user back on the bell, not the
            // schedule list.
            if (n.classScheduleId) {
                const params = new URLSearchParams();
                if (n.sourceId) params.set("highlight", n.sourceId);
                if (isInstructor) params.set("returnTo", "/instructor/notifications");
                const qs = params.toString();
                const base = isInstructor ? "/class" : "/schedule";
                return `${base}/${n.classScheduleId}${qs ? `?${qs}` : ""}`;
            }
            // Legacy fallback when classScheduleId wasn't captured.
            if (isInstructor) return "/instructor/schedule";
            return n.sourceModule === "class" && n.sourceId
                ? `/schedule/${n.sourceId}`
                : "/admin/schedule";
        }
        case "payment": {
            if (n.customerId) {
                // Always land on the customer's Payments tab → Payment
                // history inner tab — that's where the actual transaction
                // rows live (Overview is only metric cards). `tx=` carries
                // the row id so the page can highlight the receipt.
                const params = new URLSearchParams();
                params.set("tab", "Payments");
                params.set("payment", "history");
                if (n.transactionId) params.set("tx", n.transactionId);
                return `/customers/${n.customerId}?${params.toString()}`;
            }
            return "/admin/customers";
        }
        case "earnings":
            // Earnings notifications belong to the instructor — deep-link to
            // the earnings page so the instructor lands on the matching
            // payout summary. The earnings page itself will pick out the
            // referenced sourceId / transactionId when those are populated.
            return "/instructor/earnings";
        default:
            return isInstructor ? "/instructor/notifications" : "/admin/notifications";
    }
}
