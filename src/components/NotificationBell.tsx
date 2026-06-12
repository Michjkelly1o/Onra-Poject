"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Notification bell (floating dropdown)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma reference: node 2854-101941 ("Notification Menu").
//
// Anatomy:
//   • Bell icon (top-right of the global Header) — shows a red dot when
//     there's at least one unread notification.
//   • Floating panel (anchored to the bell, 380px wide) opens on click.
//     - Header row: just the title "Notification" (single line). The
//       Figma intentionally has no "mark all read" / "close" affordances
//       inside the dropdown; clicking outside dismisses, and the full page
//       handles bulk actions.
//     - Body: scrollable list of recent notifications (up to 6). Each row
//       shows the featured-icon tile, title + relative timestamp, body
//       (2-line clamp), and a green dot indicator on the right for unread.
//       Click navigates to the related record and marks it read.
//     - Footer: centered "View all notification" link → `/admin/notifications`.
//   • Empty state: in-line message when no notifications exist.

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { instructor_profile } from "@/data/mock/instructor_profile";
import { cn } from "@/lib/utils";
import { iconForNotification, relativeTime, routeForNotification } from "./notifications/notification-utils";

/** Cap on how many rows the dropdown shows — the full page is for the rest. */
const DROPDOWN_MAX = 4;

export default function NotificationBell() {
    const router = useRouter();
    const notifications        = useAppStore(s => s.notifications);
    const markNotificationRead = useAppStore(s => s.markNotificationRead);
    const currentRole          = useAppStore(s => s.currentRole);
    const currentUser          = useAppStore(s => s.currentUser);

    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    // Close on click outside.
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Audience-scoped feed — instructor sees only instructor rows; admin
    // sees admin rows (and legacy rows where audience is undefined). For
    // instructor rows there's a second filter on `targetInstructorId`
    // so each instructor sees ONLY notifications for their own classes
    // — without this, every instructor's bell would surface every other
    // instructor's cancellations.
    const isInstructor = currentRole === "instructor";
    const currentStaffId = (currentUser as typeof currentUser & { staff_profile_id?: string }).staff_profile_id
        ?? instructor_profile.staff_profile_id;
    const scoped = notifications.filter(n => {
        if (isInstructor) {
            if (n.audience !== "instructor") return false;
            // Backwards-compat: rows without a `targetInstructorId` (legacy
            // seeds, system-wide events) stay visible to every instructor.
            return !n.targetInstructorId || n.targetInstructorId === currentStaffId;
        }
        return n.audience !== "instructor";
    });

    // Newest first — the dropdown shows the most recent slice.
    const sorted = [...scoped].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const visible = sorted.slice(0, DROPDOWN_MAX);
    const hasUnread = sorted.some(n => !n.isRead);

    function handleRowClick(id: string) {
        const n = sorted.find(nn => nn.id === id);
        if (!n) return;
        markNotificationRead(id);
        setOpen(false);
        router.push(routeForNotification(n));
    }

    function handleViewAll() {
        setOpen(false);
        router.push(isInstructor ? "/instructor/notifications" : "/admin/notifications");
    }

    return (
        <div ref={wrapRef} className="relative">
            {/* Bell trigger */}
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                aria-label="Notifications"
                className="relative w-9 h-9 flex items-center justify-center rounded-[8px] text-[#667085] hover:text-[#101828] hover:bg-[#f9fafb] transition-colors"
            >
                <Bell01 className="w-[21px] h-[21px]" />
                {hasUnread && (
                    <span className="absolute top-[8px] right-[8px] w-[8px] h-[8px] bg-[#f04438] border-1 border-white rounded-full" />
                )}
            </button>

            {/* Floating panel */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-[380px] bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] z-50 overflow-hidden">
                    {/* Header */}
                    <div className="border-b border-[#e4e7ec] px-6 py-4">
                        <p className="text-[18px] font-medium leading-[28px] text-[#101828]">
                            Notification
                        </p>
                    </div>

                    {/* List */}
                    <div className="px-6 py-4 max-h-[380px] overflow-y-auto scrollbar-hide">
                        {visible.length === 0 ? (
                            <div className="py-8 flex flex-col items-center gap-2">
                                <Bell01 className="w-6 h-6 text-[#d0d5dd]" />
                                <p className="text-[14px] text-[#667085]">You're all caught up.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {visible.map((n, idx) => {
                                    const Icon = iconForNotification(n.icon);
                                    const isLast = idx === visible.length - 1;
                                    return (
                                        <div key={n.id}>
                                            <button
                                                type="button"
                                                onClick={() => handleRowClick(n.id)}
                                                className="w-full flex gap-3 items-start text-left py-2 -mx-2 px-2 rounded-[8px] hover:bg-[#f9fafb] transition-colors"
                                            >
                                                {/* Featured icon tile */}
                                                <div className="shrink-0 w-10 h-10 rounded-[10px] bg-[#f9fafb] border-1 border-[#e4e7ec] flex items-center justify-center shadow-[0px_1.481px_1.481px_rgba(0,0,0,0.04)]">
                                                    <Icon className="w-5 h-5 text-[#475467]" />
                                                </div>
                                                {/* Text block */}
                                                <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
                                                    <div className="flex items-baseline gap-[6px] flex-wrap">
                                                        <p className="text-[14px] font-semibold text-[#344054] leading-[20px]">
                                                            {n.title}
                                                        </p>
                                                        <p className="text-[14px] font-normal text-[#667085] leading-[20px]">
                                                            {relativeTime(n.createdAt)}
                                                        </p>
                                                    </div>
                                                    <p className="text-[14px] font-normal text-[#475467] leading-[20px] line-clamp-1">
                                                        {n.body}
                                                    </p>
                                                </div>
                                                {/* Unread dot */}
                                                {!n.isRead && (
                                                    <span className="shrink-0 mt-[14px] w-2 h-2 bg-[#658774] rounded-full" />
                                                )}
                                            </button>
                                            {!isLast && (
                                                <div className="h-px bg-[#e4e7ec] my-1" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-center">
                        <button
                            type="button"
                            onClick={handleViewAll}
                            className={cn(
                                "text-[14px] font-semibold leading-[20px] text-[#475467] hover:text-[#101828] transition-colors",
                            )}
                        >
                            View all notification
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
