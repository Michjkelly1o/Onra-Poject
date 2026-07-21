"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — NotificationRow — Figma 2193-6553 ("Checkbox group item")
// ─────────────────────────────────────────────────────────────────────────────
//
// A feed row: a 40px featured-icon tile (event-driven glyph) + title + relative
// time + message, with a brand-green unread dot. Tapping marks read + deep-links.

import { BankNote01, CalendarCheck02, CalendarMinus02, RefreshCcw02, Snowflake01 } from "@untitledui/icons";
import type { ComponentType, SVGProps } from "react";
import type { CustomerNotification, NotifEvent } from "@/lib/customer/notifications-feed";

const ICON_FOR: Record<NotifEvent, ComponentType<SVGProps<SVGSVGElement>>> = {
    booking_confirmed: CalendarCheck02,
    spot_available: CalendarCheck02,
    appointment_booked: CalendarCheck02,
    booking_cancelled: CalendarMinus02,
    appointment_cancelled: CalendarMinus02,
    membership_purchase: BankNote01,
    class_package: BankNote01,
    failed_payment: BankNote01,
    // Freeze policy v2 Phase 4 — snowflake for the frozen + reminder
    // events, refresh for the auto-resume.
    membership_frozen: Snowflake01,
    membership_reactivated: RefreshCcw02,
    freeze_reminder: Snowflake01,
};

export function NotificationRow({
    notification,
    timeAgo,
    onClick,
}: {
    notification: CustomerNotification;
    timeAgo: string;
    onClick: () => void;
}) {
    const Icon = ICON_FOR[notification.event] ?? CalendarCheck02;
    return (
        <button type="button" onClick={onClick} className="flex w-full items-start gap-3 text-left">
            {/* Featured icon tile */}
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[#e4e7ec] bg-[#f9fafb] shadow-[0px_1.5px_1.5px_0px_rgba(0,0,0,0.04),-3px_4.5px_9px_0px_rgba(0,0,0,0.02),3px_4.5px_9px_0px_rgba(0,0,0,0.02)] backdrop-blur-[4px]">
                <Icon className="size-5 text-[#344054]" aria-hidden />
            </span>

            {/* Text */}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold leading-5 text-[#344054]">{notification.title}</span>
                    <span className="shrink-0 text-sm font-normal leading-5 text-[#667085]">{timeAgo}</span>
                </span>
                <span className="text-sm font-normal leading-5 text-[#475467]">{notification.message}</span>
            </span>

            {/* Unread dot */}
            {!notification.isRead && (
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--brand-primary)]" aria-label="Unread" />
            )}
        </button>
    );
}
