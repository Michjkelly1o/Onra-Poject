"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer Home — header content (PRD 13 §6.1 studio selector + §6.2 bell)
// ─────────────────────────────────────────────────────────────────────────────
//
// This is just the Home screen's CONTENT (studio chip + notification bell) slotted
// into the shared <CustomerHeader> shell — the shell owns all chrome (background,
// spacing, sticky/frost-on-scroll), so the header is identical across every member
// screen. Built from scratch for the member surface (not the admin DS). Figma:
// 9ByGNc4N7Vw3BLMHyaWJ1j node 3307-69492. Icons from `@untitledui/icons`.

import { ChevronDown, MarkerPin01 } from "@untitledui/icons";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { NotificationBell } from "@/components/customer/shell/NotificationBell";

export interface CustomerHomeHeaderProps {
    /** Active studio label, e.g. "Forma Studio (South)". */
    studioName: string;
    /** When false the studio chip is static (single-branch studio) — no chevron, not tappable (PRD 13 §6.1). */
    canSwitchStudio?: boolean;
    /** Unread member notifications → drives the bell badge (PRD 13 §6.2). */
    unreadCount?: number;
    /** Open the studio switcher (the Select branch screen). */
    onOpenStudioSwitcher?: () => void;
    /** Open the notification center panel. */
    onOpenNotifications?: () => void;
    /** Show the notification bell — hidden for guests (no notification module). */
    showBell?: boolean;
}

/** Pin + studio label — shared between the tappable and static chip variants. */
function StudioChipContent({ studioName }: { studioName: string }) {
    return (
        <span className="flex min-w-0 flex-1 items-center gap-1">
            <MarkerPin01 className="size-5 shrink-0 text-[var(--colors-text-placeholder,#667085)]" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-base font-normal leading-6 text-[var(--colors-text-placeholder,#667085)]">
                {studioName}
            </span>
        </span>
    );
}

export function CustomerHomeHeader({
    studioName,
    canSwitchStudio = true,
    unreadCount = 0,
    onOpenStudioSwitcher,
    onOpenNotifications,
    showBell = true,
}: CustomerHomeHeaderProps) {
    return (
        <CustomerHeader>
            {/* Studio selector */}
            {canSwitchStudio ? (
                <button
                    type="button"
                    onClick={onOpenStudioSwitcher}
                    aria-label={`Current studio: ${studioName}. Tap to switch studio.`}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--colors-border-secondary,#e4e7ec)] bg-[var(--colors-bg-primary,#fff)] px-3 py-2 text-left transition-colors active:bg-gray-50"
                >
                    <StudioChipContent studioName={studioName} />
                    <ChevronDown className="size-4 shrink-0 text-[var(--colors-text-placeholder,#667085)]" aria-hidden />
                </button>
            ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--colors-border-secondary,#e4e7ec)] bg-[var(--colors-bg-primary,#fff)] px-3 py-2">
                    <StudioChipContent studioName={studioName} />
                </div>
            )}

            {/* Notification bell — hidden for guests (no notification module) */}
            {showBell && <NotificationBell count={unreadCount} onClick={onOpenNotifications ?? (() => {})} />}
        </CustomerHeader>
    );
}
