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
//     px-2 rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors`
//   • Icon tile (48px): `shrink-0 w-12 h-12 rounded-[10px] bg-[var(--colors-bg-secondary)]
//     border-1 border-[var(--colors-border-secondary)] flex items-center justify-center
//     shadow-[0px_1.481px_1.481px_rgba(0,0,0,0.04)]`
//   • Title: `text-[16px] font-semibold leading-[24px] text-[var(--colors-text-secondary)]`
//   • Time:  `text-[16px] font-normal leading-[24px] text-[var(--colors-text-quaternary)]`
//   • Body:  `text-[16px] font-normal leading-[24px] text-[var(--colors-text-tertiary)]`
//   • Unread dot: `shrink-0 w-[10px] h-[10px] bg-[var(--colors-secondary-600)] rounded-full`

import type { Notification } from "@/lib/store";
import { iconForNotification, relativeTime } from "./notification-utils";

export interface NotificationRowProps {
    n: Notification;
    onClick: () => void;
    /** Branch name to show as a pill next to the timestamp. Pass undefined
     *  (or omit) to hide the pill — used by the admin notifications page
     *  when a SPECIFIC branch is selected (the pill is redundant in that
     *  case) and by the instructor + bell-dropdown surfaces that don't
     *  carry the cross-branch context. */
    branchLabel?: string;
}

export function NotificationRow({ n, onClick, branchLabel }: NotificationRowProps) {
    const Icon = iconForNotification(n.icon);
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex gap-3 items-center text-left py-1.5 -mx-2 px-2 rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors"
        >
            {/* Featured icon tile (48px) */}
            <div className="shrink-0 w-12 h-12 rounded-[10px] bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] flex items-center justify-center shadow-[0px_1.481px_1.481px_rgba(0,0,0,0.04)]">
                <Icon className="w-6 h-6 text-[var(--colors-text-tertiary)]" />
            </div>
            {/* Text block */}
            <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
                <div className="flex items-baseline gap-[6px] flex-wrap">
                    <p className="text-[16px] font-semibold leading-[24px] text-[var(--colors-text-secondary)]">
                        {n.title}
                    </p>
                    <p className="text-[16px] font-normal leading-[24px] text-[var(--colors-text-quaternary)]">
                        {relativeTime(n.createdAt)}
                    </p>
                    {/* Branch pill — surfaces which location the event
                        belongs to. Rendered only when the caller passes a
                        `branchLabel` (admin "All locations" view). */}
                    {branchLabel && (
                        <span className="inline-flex items-center px-[8px] py-[2px] rounded-full border-1 border-[var(--colors-border-secondary)] bg-[var(--colors-bg-secondary)] text-[12px] font-medium text-[var(--colors-text-tertiary)] whitespace-nowrap">
                            {branchLabel}
                        </span>
                    )}
                </div>
                <p className="text-[16px] font-normal leading-[24px] text-[var(--colors-text-tertiary)]">
                    {n.body}
                </p>
            </div>
            {/* Unread dot — 10px, matches Figma */}
            {!n.isRead && (
                <span className="shrink-0 w-[10px] h-[10px] bg-[var(--colors-secondary-600)] rounded-full" />
            )}
        </button>
    );
}
