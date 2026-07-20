"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — PushNotificationToasts
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors a real push notification: when a new row lands in the notification
// feed AND the member has "Push notifications" enabled (Profile → Notifications
// → marketingChannelPush), it surfaces as a toast instead of waiting silently
// behind the bell. Renders nothing itself — it drives the shared toast host.
//
// Only NEW arrivals toast. The first render records the current newest id as a
// baseline, so opening the app never replays the backlog.

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { useCustomerNotifications } from "@/lib/customer/notifications-feed";

export function PushNotificationToasts() {
    const notifications = useCustomerNotifications();
    const member = useCurrentCustomer();
    const showToast = useAppStore((s) => s.showToast);
    const pushEnabled = !!member?.marketingChannelPush;

    // Newest id already accounted for. `null` until the baseline is taken.
    const lastSeenId = useRef<string | null>(null);
    const baselineTaken = useRef(false);

    useEffect(() => {
        const newest = notifications[0];
        if (!newest) return;
        // First pass (or after a sign-in swap) — record, never toast.
        if (!baselineTaken.current) {
            baselineTaken.current = true;
            lastSeenId.current = newest.id;
            return;
        }
        if (newest.id === lastSeenId.current) return;
        lastSeenId.current = newest.id;
        // Push switched off → the bell still fills, but nothing interrupts.
        if (!pushEnabled) return;
        showToast(newest.title, newest.message, "success", "bell");
    }, [notifications, pushEnabled, showToast]);

    // Re-baseline when the signed-in account changes, so switching personas
    // doesn't toast the new member's existing feed.
    useEffect(() => {
        baselineTaken.current = false;
    }, [member?.id]);

    return null;
}
