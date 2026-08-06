"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — IconAvatar
// ─────────────────────────────────────────────────────────────────────────────
//
// Generic "round icon-fronted avatar" — a 40px gray circle with a centred
// untitledui icon inside. Used by the row leading-cell in every admin list
// table where the entity is identified by an iconic glyph rather than a
// photo or initials (memberships, packages, gift cards, agreements, tax
// rates, etc).
//
// Captures the EXACT chrome from the audit:
//   • Outer: `relative shrink-0 size-10 rounded-full bg-[var(--colors-bg-tertiary)] flex
//     items-center justify-center`
//   • Icon:  `w-5 h-5 text-[var(--colors-text-tertiary)]`
//   • Inset 0.75px contrast border via overlay div per the Figma spec
//
// Currently replaces:
//   • `AgreementAvatar` (admin/settings/agreements)
//   • `PercentAvatar`   (admin/settings/tax)
//   • `GiftAvatar`      (admin/products/gift-cards)
//   • `ProductAvatar`   (admin/products — pass icon selected from `kind`)

import { cn } from "@/lib/utils";

export interface IconAvatarProps {
    /** Untitled UI icon component to render at 20×20 inside the circle. */
    icon: React.ComponentType<{ className?: string }>;
    /** Extra Tailwind classes for the outer container. Rarely needed. */
    className?: string;
}

export function IconAvatar({ icon: Icon, className }: IconAvatarProps) {
    return (
        <div className={cn(
            "relative shrink-0 size-10 rounded-full bg-[var(--colors-bg-tertiary)] flex items-center justify-center",
            className,
        )}>
            <Icon className="w-5 h-5 text-[var(--colors-text-tertiary)]" />
            <div className="absolute inset-0 rounded-full border-[0.75px] border-black/[0.08] pointer-events-none" />
        </div>
    );
}
