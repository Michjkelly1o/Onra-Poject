"use client";

// Customer — shared notification bell (studio header trailing action).
// ONE component used across Home + Search (+ any future header) so the icon,
// button chrome, and the unread badge are identical everywhere. Badge uses the
// brand green (colors/foreground/fg-brand-primary-600) — never red.

import { Bell01 } from "@untitledui/icons";

export function NotificationBell({ count, onClick }: { count: number; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
            className="relative flex shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white p-2.5 transition-colors active:bg-gray-50"
        >
            <Bell01 className="size-5 text-[#344054]" aria-hidden />
            {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#658774] px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                    {count > 9 ? "9+" : count}
                </span>
            )}
        </button>
    );
}
