"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }

// (Onra DS table-cell avatar below)
// ─── Onra DS table-cell avatar ────────────────────────────────────────────────

/**
 * Neutral table-cell avatar — matches the Onra DS pattern at Figma node 5852:75347.
 *
 * - bg: `#f2f4f7` (avatar-bg)
 * - contrast border: 0.75px inset, `rgba(0,0,0,0.08)`
 * - initials: semibold, `#667085` (text-quaternary)
 *
 * When `imageUrl` is provided, renders the image fitted into the circle. Used anywhere
 * a customer / instructor / staff avatar would appear inside a table row.
 */
export function TableAvatar({ initials, imageUrl, size = 40, className }: {
    initials?: string;
    imageUrl?: string;
    size?: number;
    className?: string;
}) {
    const textPx = size <= 24 ? 11 : size <= 32 ? 13 : 16;
    const trimmed = (initials ?? "").trim().slice(0, 2).toUpperCase();
    return (
        <div
            className={cn("relative rounded-full bg-[#f2f4f7] shrink-0 overflow-hidden", className)}
            style={{ width: size, height: size }}
        >
            {imageUrl ? (
                <img src={imageUrl} alt={initials ?? ""} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
                <span
                    className="absolute inset-0 flex items-center justify-center font-semibold text-[#667085] leading-none"
                    style={{ fontSize: textPx }}
                >
                    {trimmed}
                </span>
            )}
            <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ boxShadow: "inset 0 0 0 0.75px rgba(0,0,0,0.08)" }}
            />
        </div>
    );
}
