"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Notification Center (`/customer/notifications`) — Figma 2193-6542
// ─────────────────────────────────────────────────────────────────────────────
//
// The bell feed: All / Bookings / Payments tabs (count pills), Today/Past groups,
// unread dots, tap-to-read + deep-link, and a Mark-all-as-read header action.
// Backed by the UI-only `notifications-feed` store.

import { useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell01, ChevronLeft } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import {
    markAllNotifRead,
    markNotifRead,
    useCustomerNotifications,
    type CustomerNotification,
} from "@/lib/customer/notifications-feed";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";
import { NotificationRow } from "@/components/customer/notifications/NotificationRow";

type Tab = "all" | "bookings" | "payments";
const TABS: { id: Tab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "bookings", label: "Bookings" },
    { id: "payments", label: "Payments" },
];

// Persist the active tab across detail round-trips (module cache).
const notifUi: { tab: Tab } = { tab: "all" };

/** "2 min ago" / "2 hr ago" / "Yesterday" / "3 days ago" / "5 Jun". */
function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const min = 60_000;
    const hr = 60 * min;
    const day = 24 * hr;
    if (diff < min) return "Just now";
    if (diff < hr) return `${Math.floor(diff / min)} min ago`;
    if (diff < day) return `${Math.floor(diff / hr)} hr ago`;
    const days = Math.floor(diff / day);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function isToday(iso: string): boolean {
    const d = new Date(iso);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

/** Where a notification deep-links to (falls back to the owning list). */
function routeFor(n: CustomerNotification): string {
    switch (n.relatedType) {
        case "booking":
            return n.relatedId ? `/customer/bookings/${n.relatedId}` : "/customer/bookings";
        case "appointment":
            return n.relatedId ? `/customer/bookings/appointment/${n.relatedId}` : "/customer/bookings";
        case "plan":
            return "/customer/profile/plan";
        case "product":
            return "/customer/products";
        case "payment_method":
            return "/customer/profile/payment-methods";
        default:
            return "/customer/bookings";
    }
}

function Section({
    title,
    rows,
    onOpen,
}: {
    title: string;
    rows: CustomerNotification[];
    onOpen: (n: CustomerNotification) => void;
}) {
    if (rows.length === 0) return null;
    return (
        <div className="flex flex-col gap-3">
            <p className="text-base font-semibold leading-6 text-[#101828]">{title}</p>
            <div className="flex flex-col gap-3">
                {rows.map((n, i) => (
                    <div key={n.id} className="flex flex-col gap-3">
                        <NotificationRow notification={n} timeAgo={timeAgo(n.createdAtISO)} onClick={() => onOpen(n)} />
                        {i < rows.length - 1 && <div className="h-px w-full bg-[#e4e7ec]" />}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function NotificationsPage() {
    const router = useRouter();
    const showToast = useAppStore((s) => s.showToast);
    const all = useCustomerNotifications();
    const [, force] = useReducer((x) => x + 1, 0);
    const [tab, setTabState] = useState<Tab>(notifUi.tab);
    const setTab = (t: Tab) => {
        notifUi.tab = t;
        setTabState(t);
    };

    const countFor = (t: Tab) => (t === "all" ? all.length : all.filter((n) => n.tab === t).length);
    const visible = [...all]
        .filter((n) => tab === "all" || n.tab === tab)
        .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO));
    const today = visible.filter((n) => isToday(n.createdAtISO));
    const past = visible.filter((n) => !isToday(n.createdAtISO));
    const hasUnread = visible.some((n) => !n.isRead);

    function open(n: CustomerNotification) {
        markNotifRead(n.id);
        router.push(routeFor(n));
    }
    function markAll() {
        markAllNotifRead(tab === "all" ? undefined : tab);
        showToast("All caught up", "Notifications marked as read.", "success", "check");
        force();
    }

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 truncate text-center text-lg font-semibold leading-7 text-[#101828]">
                    Notifications
                </h1>
                {hasUnread ? (
                    <button
                        type="button"
                        onClick={markAll}
                        className="shrink-0 whitespace-nowrap text-sm font-semibold leading-5 text-[#658774]"
                    >
                        Mark all read
                    </button>
                ) : (
                    <span aria-hidden className="size-10 shrink-0" />
                )}
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-6 px-4 pb-8 pt-[80px]">
                {/* Tabs */}
                <div className="flex w-full gap-3">
                    {TABS.map((t) => {
                        const active = tab === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                className={`flex h-8 flex-1 items-center justify-center gap-2 px-2 pb-3 text-sm leading-5 transition-colors ${
                                    active
                                        ? "border-b-2 border-[#101828] font-semibold text-[#101828]"
                                        : "font-medium text-[#667085]"
                                }`}
                            >
                                {t.label}
                                <span className="flex items-center rounded-full border border-[#e4e7ec] bg-[#f9fafb] px-2 py-0.5 text-xs font-medium leading-[18px] text-[#344054]">
                                    {countFor(t.id)}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {visible.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center">
                        <SearchEmptyState
                            icon={Bell01}
                            title="No notifications yet"
                            description="New notifications will appear here when available."
                        />
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        <Section title="Today" rows={today} onOpen={open} />
                        <Section title="Past" rows={past} onOpen={open} />
                    </div>
                )}
            </div>
        </div>
    );
}
