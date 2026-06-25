"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared NotificationRow
// ─────────────────────────────────────────────────────────────────────────────
//
// Row chrome for a notification entry — used by both the admin and
// instructor notification pages. The two inline copies were byte-identical
// (modulo a comment); centralised here so the unread-dot color, icon tile,
// and typography are a one-file change.
//
// Visual chrome (from audit):
//   • Outer button: `w-full flex gap-3 items-center text-left py-1.5 -mx-2
//     px-2 rounded-[8px] hover:bg-[#f9fafb] transition-colors`
//   • Icon tile (48px): `shrink-0 w-12 h-12 rounded-[10px] bg-[#f9fafb]
//     border-1 border-[#e4e7ec] flex items-center justify-center
//     shadow-[0px_1.481px_1.481px_rgba(0,0,0,0.04)]`
//   • Title: `text-[16px] font-semibold leading-[24px] text-[#344054]`
//   • Time:  `text-[16px] font-normal leading-[24px] text-[#667085]`
//   • Body:  `text-[16px] font-normal leading-[24px] text-[#475467]`
//   • Unread dot: `shrink-0 w-[10px] h-[10px] bg-[#658774] rounded-full`

import type { Notification } from "@/lib/store";
import { iconForNotification, relativeTime } from "./notification-utils";

export interface NotificationRowProps {
    n: Notification;
    onClick: () => void;
}

export function NotificationRow({ n, onClick }: NotificationRowProps) {
    const Icon = iconForNotification(n.icon);
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex gap-3 items-center text-left py-1.5 -mx-2 px-2 rounded-[8px] hover:bg-[#f9fafb] transition-colors"
        >
            {/* Featured icon tile (48px) */}
            <div className="shrink-0 w-12 h-12 rounded-[10px] bg-[#f9fafb] border-1 border-[#e4e7ec] flex items-center justify-center shadow-[0px_1.481px_1.481px_rgba(0,0,0,0.04)]">
                <Icon className="w-6 h-6 text-[#475467]" />
            </div>
            {/* Text block */}
            <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
                <div className="flex items-baseline gap-[6px] flex-wrap">
                    <p className="text-[16px] font-semibold leading-[24px] text-[#344054]">
                        {n.title}
                    </p>
                    <p className="text-[16px] font-normal leading-[24px] text-[#667085]">
                        {relativeTime(n.createdAt)}
                    </p>
                </div>
                <p className="text-[16px] font-normal leading-[24px] text-[#475467]">
                    {n.body}
                </p>
            </div>
            {/* Unread dot — 10px, matches Figma */}
            {!n.isRead && (
                <span className="shrink-0 w-[10px] h-[10px] bg-[#658774] rounded-full" />
            )}
        </button>
    );
}
