"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Mail, MessageCircle, Smartphone, X, Check, CheckCheck } from "lucide-react";
import { useDataStore } from "@/lib/data-store";
import { cn } from "@/lib/utils";

const channelIcons = {
    email: Mail,
    whatsapp: MessageCircle,
    push: Smartphone,
};

const typeColors: Record<string, string> = {
    booking_confirmation: "text-green-600 bg-green-50",
    reminder_24h: "text-blue-600 bg-blue-50",
    cancellation: "text-red-600 bg-red-50",
    payment: "text-emerald-600 bg-emerald-50",
    waitlist_promotion: "text-purple-600 bg-purple-50",
    system_alert: "text-amber-600 bg-amber-50",
};

const typeLabels: Record<string, string> = {
    booking_confirmation: "Booking",
    reminder_24h: "Reminder",
    cancellation: "Cancelled",
    payment: "Payment",
    waitlist_promotion: "Waitlist",
    system_alert: "Alert",
};

function timeAgo(dateStr: string) {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface NotificationBellProps {
    userId: string;
    accentColor?: string; // e.g. "blue", "emerald", "brand"
}

export default function NotificationBell({ userId, accentColor = "brand" }: NotificationBellProps) {
    const { notifications, dismissNotification, markAllNotificationsRead } = useDataStore();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const myNotifications = notifications.filter((n) => n.user_id === userId);
    const unreadCount = myNotifications.filter((n) => n.status === "pending").length;

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const badgeColor = accentColor === "emerald" ? "bg-emerald-500" : accentColor === "blue" ? "bg-blue-500" : "bg-red-500";

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="relative p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className={cn("absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1", badgeColor)}>
                        {unreadCount}
                    </span>
                )}
                {unreadCount === 0 && myNotifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gray-300 rounded-full" />
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-[380px] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 animate-fade-in overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={() => markAllNotificationsRead(userId)}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    Mark all read
                                </button>
                            )}
                            <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {myNotifications.length === 0 ? (
                            <div className="py-12 text-center">
                                <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">No notifications</p>
                            </div>
                        ) : (
                            myNotifications
                                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                .map((n) => {
                                    const ChannelIcon = channelIcons[n.channel] || Mail;
                                    const color = typeColors[n.type] || "text-gray-600 bg-gray-50";
                                    const label = typeLabels[n.type] || n.type;
                                    return (
                                        <div
                                            key={n.id}
                                            className={cn(
                                                "flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50/50 transition-colors",
                                                n.status === "pending" && "bg-blue-50/30"
                                            )}
                                        >
                                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5", color)}>
                                                <ChannelIcon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded", color)}>
                                                        {label}
                                                    </span>
                                                    {n.status === "pending" && (
                                                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium text-gray-900 leading-snug">{n.subject}</p>
                                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                                                <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                                            </div>
                                            <button
                                                onClick={() => dismissNotification(n.id)}
                                                className="p-1 rounded-lg hover:bg-gray-200 text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5"
                                                title="Dismiss"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })
                        )}
                    </div>

                    {/* Footer */}
                    {myNotifications.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
                            <p className="text-xs text-gray-400 text-center">
                                {myNotifications.length} notification{myNotifications.length !== 1 ? "s" : ""}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
