"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — NeutralAvatar (initials / image / icon)
// ─────────────────────────────────────────────────────────────────────────────
//
// Neutral-chrome avatar used across the Staff & Permissions / Compensation /
// Payroll surfaces. Single tone everywhere — no per-row colour palette — so
// long staff lists read as one consistent surface (Figma + audit confirmed
// across compensation, payroll, staff/role rows).
//
// Chrome (exact match to the audited locals):
//   • Outer: `rounded-full bg-[#f2f4f7] border-1 border-[#e4e7ec]
//     flex items-center justify-center shrink-0`
//   • Initials: `text-[#475467] font-medium`, font-size scales with `size`
//   • Image: `object-cover` fitted to the circle, falls back to initials on
//     onerror (parent display:none pattern preserved from local copies)
//   • Icon (alt content): `text-[#475467]`, scales to `size * 0.5` (matches
//     StaffPermissionsPage RoleAvatar)
//
// Picks the right inner content in this order:
//   1. `imageUrl`   — fitted img
//   2. `icon`       — centred untitledui icon (RoleAvatar-style)
//   3. `initials`   — fallback letters

import { cn } from "@/lib/utils";

export interface NeutralAvatarProps {
    /** Initials to render when no image / icon is supplied. */
    initials?: string;
    /** Photo URL — when present takes precedence over icon + initials. */
    imageUrl?: string;
    /** When `imageUrl` is empty and `icon` is set, the icon is rendered
     *  centred in the circle (used by Role / Shift avatars that have no
     *  photo). */
    icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    /** Outer size in pixels. Default 40 — matches every audited caller. */
    size?: number;
    /** Extra classes for the outer container. */
    className?: string;
}

export function NeutralAvatar({ initials, imageUrl, icon: Icon, size = 40, className }: NeutralAvatarProps) {
    if (imageUrl) {
        return (
            <img
                src={imageUrl}
                alt={initials ?? ""}
                className={cn("rounded-full object-cover shrink-0", className)}
                style={{ width: size, height: size }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
        );
    }
    return (
        <div
            className={cn(
                "rounded-full bg-[#f2f4f7] border-1 border-[#e4e7ec] flex items-center justify-center shrink-0",
                Icon ? "" : "font-medium text-[#475467]",
                className,
            )}
            style={{
                width: size,
                height: size,
                ...(Icon ? {} : { fontSize: size * 0.35 }),
            }}
        >
            {Icon
                ? <Icon className="text-[#475467]" style={{ width: size * 0.5, height: size * 0.5 }} />
                : initials ?? ""}
        </div>
    );
}
