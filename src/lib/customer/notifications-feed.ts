"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — notification feed (UI-only) — persisted client store
// ─────────────────────────────────────────────────────────────────────────────
//
// The seeded `notifications` table is admin/instructor-scoped (its `customer_id`
// only names the customer an admin event is ABOUT — no customer-facing rows). So
// the customer Notification Center is backed here: a localStorage-backed,
// reactive feed, seeded with the Figma demo set and appended live by the actions
// other modules already "write a notification" for (booking confirm/cancel,
// waitlist promote, plan/package purchase, failed payment). Read-only over the
// shared seed; version-guarded (bump to re-seed).

import { useSyncExternalStore } from "react";
import { customerNotificationSink, customerAnnouncementSink, customerCampaignSink, useAppStore } from "@/lib/store";
import { to12h } from "./dates";
import { DEMO_MEMBER_ID } from "./context";
import { getAuthSession } from "./auth";

export type NotifTab = "bookings" | "payments" | "updates";
export type NotifEvent =
    | "booking_confirmed"
    | "spot_available"
    | "booking_cancelled"
    | "appointment_booked"
    | "appointment_cancelled"
    | "membership_purchase"
    | "class_package"
    | "failed_payment"
    // ── Freeze policy v2 Phase 4 (client 2026-07-20) ────────────────
    | "membership_frozen"
    | "membership_reactivated"
    | "freeze_reminder"
    // ── Marketing rework (2026-08) — Studio announcements + campaigns ─
    | "announcement"
    | "campaign";

export type NotifRelatedType = "booking" | "appointment" | "plan" | "product" | "payment_method" | "marketing";

export interface CustomerNotification {
    id: string;
    /** Which tab it lives in (All = both). */
    tab: NotifTab;
    event: NotifEvent;
    title: string;
    message: string;
    /** ISO created-at — drives Today/Past grouping + "time ago". */
    createdAtISO: string;
    isRead: boolean;
    relatedType?: NotifRelatedType;
    /** Deep-link target id (e.g. bookingId); omitted → route to the owning list. */
    relatedId?: string;
}

const KEY = "onra-customer-notifications";
// Bump to re-seed the demo feed (clears live-appended + read state).
// v4 — adds Studio-announcement + Campaign "Updates" rows (marketing rework).
const VERSION = 4;

/** The viewer's opt-in flag for a campaign topic. */
function optedIntoTopic(
    viewer: { marketingTopicNewClassLaunch?: boolean; marketingTopicSpecialOffers?: boolean; marketingTopicPromoCodeOffers?: boolean },
    topic: string | undefined,
): boolean {
    switch (topic) {
        case "new_class_launch":  return !!viewer.marketingTopicNewClassLaunch;
        case "special_offers":    return !!viewer.marketingTopicSpecialOffers;
        case "promo_code_offers": return !!viewer.marketingTopicPromoCodeOffers;
        default:                  return true;
    }
}

let feed: CustomerNotification[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

/** Short date "26 Feb" from an ISO day/timestamp. */
function fmtDay(iso: string): string {
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Seed the feed from the demo customer's REAL bookings + plans, so every row
 *  carries real copy + a real deep-link (booking detail / My plan). Timestamps
 *  are demo-fresh (Today/Past) — the content + navigation are the real data. */
function seedFeed(): CustomerNotification[] {
    const now = Date.now();
    const min = 60_000;
    const hr = 60 * min;
    const day = 24 * hr;
    const iso = (ms: number) => new Date(now - ms).toISOString();
    const out: CustomerNotification[] = [];

    let st: ReturnType<typeof useAppStore.getState> | null = null;
    try {
        st = useAppStore.getState();
    } catch {
        st = null;
    }

    if (st) {
        const schedById = new Map(st.classSchedules.map((c) => [c.id, c]));
        const mine = st.classBookings.filter((b) => b.customerId === DEMO_MEMBER_ID);

        // Two most-recently-booked upcoming classes → "Booking confirmed".
        const booked = mine
            .filter((b) => b.status === "booked")
            .map((b) => ({ b, s: schedById.get(b.classScheduleId) }))
            .filter((x): x is { b: (typeof mine)[number]; s: NonNullable<typeof x.s> } => !!x.s)
            .sort((a, b) => (b.b.bookingTime ?? "").localeCompare(a.b.bookingTime ?? ""));
        booked.slice(0, 2).forEach((x, i) => {
            out.push({
                id: `cn_seed_bk_${x.b.id}`,
                tab: "bookings",
                event: "booking_confirmed",
                title: "Booking confirmed",
                message: `You're all set for ${x.s.name} with ${x.s.instructorName} on ${fmtDay(x.s.dateISO)} at ${to12h(x.s.startTime)}.`,
                createdAtISO: iso((i === 0 ? 2 : 10) * min),
                isRead: false,
                relatedType: "booking",
                relatedId: x.b.id,
            });
        });

        // Most recent cancelled class → "Booking cancelled".
        const cancelled = mine
            .filter((b) => b.status === "cancelled")
            .map((b) => ({ b, s: schedById.get(b.classScheduleId) }))
            .filter((x): x is { b: (typeof mine)[number]; s: NonNullable<typeof x.s> } => !!x.s)
            .sort((a, b) => (b.b.cancelledAt ?? b.b.bookingTime ?? "").localeCompare(a.b.cancelledAt ?? a.b.bookingTime ?? ""));
        if (cancelled[0]) {
            const x = cancelled[0];
            out.push({
                id: `cn_seed_cx_${x.b.id}`,
                tab: "bookings",
                event: "booking_cancelled",
                title: "Booking cancelled",
                message: `Your ${x.s.name} class on ${fmtDay(x.s.dateISO)} · ${to12h(x.s.startTime)} has been cancelled.`,
                createdAtISO: iso(2 * hr),
                isRead: true,
                relatedType: "booking",
                relatedId: x.b.id,
            });
        }

        // Active membership → "Membership purchase" (→ My plan).
        const plans = st.customerPlans.filter((p) => p.customerId === DEMO_MEMBER_ID);
        const mem =
            plans.find((p) => p.kind === "membership" && (p.status === "active" || p.status === "frozen")) ??
            plans.find((p) => p.kind === "membership");
        if (mem) {
            out.push({
                id: `cn_seed_mem_${mem.id}`,
                tab: "payments",
                event: "membership_purchase",
                title: "Membership purchase",
                message: `Your ${mem.name} is now active${mem.expiryISO ? ` · Renews ${fmtDay(mem.expiryISO)}` : ""}.`,
                createdAtISO: iso(1 * day),
                isRead: true,
                relatedType: "plan",
                relatedId: mem.id,
            });
        }

        // A package → "Class package" (→ My plan).
        const pkg =
            plans.find((p) => p.kind === "package" && (p.status === "active" || p.status === "frozen")) ??
            plans.find((p) => p.kind === "package");
        if (pkg) {
            out.push({
                id: `cn_seed_pkg_${pkg.id}`,
                tab: "payments",
                event: "class_package",
                title: "Class package",
                message: `${pkg.creditsLabel} added to your account${pkg.expiryISO ? ` · Valid until ${fmtDay(pkg.expiryISO)}` : ""}.`,
                createdAtISO: iso(1 * day + 1 * hr),
                isRead: true,
                relatedType: "plan",
                relatedId: pkg.id,
            });
        }

        // Studio announcements → "Updates" tab. Pushed only to members opted
        // into BOTH the Push channel AND the Studio-announcements topic
        // (mirrors the store's dispatch gate), scoped to the member's branch,
        // and only while within the show-until date.
        const viewer = st.customers.find((c) => c.id === DEMO_MEMBER_ID);
        if (viewer?.marketingChannelPush && viewer?.marketingTopicStudioAnnouncements) {
            const nowMs = Date.now();
            st.marketingItems
                .filter((m) => m.type === "announcement" && m.status === "active")
                .filter((m) => !m.expiry_date || new Date(m.expiry_date).getTime() >= nowMs)
                .filter((m) => {
                    const ids = m.branch_ids ?? [];
                    return ids.length === 0 || (viewer.branchId ? ids.includes(viewer.branchId) : true);
                })
                .forEach((m, i) => {
                    out.push({
                        id: `cn_seed_ann_${m.id}`,
                        tab: "updates",
                        event: "announcement",
                        title: m.title,
                        message: m.short_description,
                        createdAtISO: iso((3 + i) * hr),
                        isRead: false,
                        relatedType: "marketing",
                        relatedId: m.id,
                    });
                });
        }

        // Sent campaigns → also "Updates". Gated by the Push channel + the
        // campaign's TOPIC + branch scope. Campaigns are a one-time send (no
        // show-until), so no expiry check.
        if (viewer?.marketingChannelPush) {
            st.marketingItems
                .filter((m) => m.type === "campaign" && m.delivery_status === "sent")
                .filter((m) => optedIntoTopic(viewer, m.topic))
                .filter((m) => {
                    const ids = m.branch_ids ?? [];
                    return ids.length === 0 || (viewer.branchId ? ids.includes(viewer.branchId) : true);
                })
                .forEach((m, i) => {
                    out.push({
                        id: `cn_seed_camp_${m.id}`,
                        tab: "updates",
                        event: "campaign",
                        title: m.title,
                        message: m.short_description,
                        createdAtISO: iso((6 + i) * hr),
                        isRead: false,
                        relatedType: "marketing",
                        relatedId: m.id,
                    });
                });
        }
    }

    // Simulated failed-payment reminder → Payment methods.
    out.push({
        id: "cn_seed_failed",
        tab: "payments",
        event: "failed_payment",
        title: "Failed payment",
        message: "We couldn't renew your membership · Update your payment method.",
        createdAtISO: iso(1 * day + 2 * hr),
        isRead: true,
        relatedType: "payment_method",
    });

    return out;
}

function hydrate() {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
        if (window.localStorage.getItem(`${KEY}-v`) !== String(VERSION)) {
            feed = seedFeed();
            window.localStorage.setItem(`${KEY}-v`, String(VERSION));
            persist();
            return;
        }
        const raw = window.localStorage.getItem(KEY);
        feed = raw ? (JSON.parse(raw) as CustomerNotification[]) : seedFeed();
    } catch {
        feed = seedFeed();
    }
}
function persist() {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(feed));
    } catch {
        /* storage full / unavailable — keep in-memory */
    }
}
function emit() {
    persist();
    listeners.forEach((l) => l());
}

/** Append a notification (newest first, unread). Used by cross-module actions. */
export function addCustomerNotification(input: Omit<CustomerNotification, "id" | "createdAtISO" | "isRead">): string {
    hydrate();
    const id = `cn_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    feed = [{ ...input, id, createdAtISO: new Date().toISOString(), isRead: false }, ...feed];
    emit();
    return id;
}

export function markNotifRead(id: string): void {
    hydrate();
    feed = feed.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    emit();
}

/** Mark all read; scope to a tab when provided (else the whole feed). */
export function markAllNotifRead(tab?: NotifTab): void {
    hydrate();
    feed = feed.map((n) => (!tab || n.tab === tab ? { ...n, isRead: true } : n));
    emit();
}

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}
function snapshot(): CustomerNotification[] {
    hydrate();
    return feed;
}

export function useCustomerNotifications(): CustomerNotification[] {
    return useSyncExternalStore(subscribe, snapshot, () => feed);
}
/** Unread count (for the header bell badge). */
export function useUnreadNotifCount(): number {
    return useCustomerNotifications().filter((n) => !n.isRead).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store bridge — waitlist promotions / claim offers
// ─────────────────────────────────────────────────────────────────────────────
//
// `store.ts` owns the waitlist rules but cannot import this module (this module
// imports the store), so it fires through a sink registered here on load. The
// feed is single-customer, so rows addressed to anyone else are dropped: a
// promotion for another member must never surface in this member's bell.
customerNotificationSink.emit = ({ customerId, event, title, message, relatedType, relatedId }) => {
    const viewer = getAuthSession().customerId ?? DEMO_MEMBER_ID;
    if (customerId !== viewer) return;
    // Bookings tab hosts every membership-lifecycle event today
    // (booking_confirmed / spot_available / membership_frozen /
    // membership_reactivated / freeze_reminder). Payments tab is reserved
    // for the transaction/refund/receipt feed. Keep this line in sync with
    // the sink's event union in store.ts if new events are added.
    //
    // The store-side sink uses `customer_plan` for freeze events (matches
    // its audit-log target type); the customer feed's own `related_type`
    // column standardised on `plan`. Map here so both sides stay natural
    // in their own module.
    const feedRelatedType: NotifRelatedType = relatedType === "customer_plan" ? "plan" : relatedType;
    addCustomerNotification({ tab: "bookings", event, title, message, relatedType: feedRelatedType, relatedId });
};

// Studio announcement broadcast → the "Updates" tab, gated per-viewer by the
// same consent rule as the seed (Push channel + Studio-announcements topic) +
// branch scope. Fires PushNotificationToasts automatically when push is on.
customerAnnouncementSink.emit = ({ id, title, message, branchIds }) => {
    const viewerId = getAuthSession().customerId ?? DEMO_MEMBER_ID;
    let st: ReturnType<typeof useAppStore.getState> | null = null;
    try {
        st = useAppStore.getState();
    } catch {
        st = null;
    }
    const viewer = st?.customers.find((c) => c.id === viewerId);
    if (!viewer?.marketingChannelPush || !viewer?.marketingTopicStudioAnnouncements) return;
    const ids = branchIds ?? [];
    const branchOk = ids.length === 0 || (viewer.branchId ? ids.includes(viewer.branchId) : true);
    if (!branchOk) return;
    addCustomerNotification({ tab: "updates", event: "announcement", title, message, relatedType: "marketing", relatedId: id });
};

// Campaign send → the "Updates" tab, gated by the Push channel + the campaign's
// TOPIC + branch scope.
customerCampaignSink.emit = ({ id, title, message, branchIds, topic }) => {
    const viewerId = getAuthSession().customerId ?? DEMO_MEMBER_ID;
    let st: ReturnType<typeof useAppStore.getState> | null = null;
    try {
        st = useAppStore.getState();
    } catch {
        st = null;
    }
    const viewer = st?.customers.find((c) => c.id === viewerId);
    if (!viewer?.marketingChannelPush || !optedIntoTopic(viewer, topic)) return;
    const ids = branchIds ?? [];
    const branchOk = ids.length === 0 || (viewer.branchId ? ids.includes(viewer.branchId) : true);
    if (!branchOk) return;
    addCustomerNotification({ tab: "updates", event: "campaign", title, message, relatedType: "marketing", relatedId: id });
};
