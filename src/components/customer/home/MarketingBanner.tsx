"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Marketing Banner (shared) — PRD 13 §6.6
// ─────────────────────────────────────────────────────────────────────────────
//
// The existing Marketing Banner design (admin Marketing module / ONRA DS node
// 18103-6527): a 140px rounded cover image over a dark gradient + vignette, the
// campaign title (centre-left), and "*T&Cs Apply". When the admin enables the
// campaign's countdown condition (`marketingItems.countdown`), a live countdown
// pill shows top-left. Reuses the admin Marketing data; no admin/status badges
// on the customer side.

import { useEffect, useState } from "react";
import { Clock } from "@untitledui/icons";

// Dark vignette so the white text stays legible on any artwork (admin treatment).
const VIGNETTE = "radial-gradient(ellipse at center, rgba(12,17,29,0.1) 0%, rgba(12,17,29,0.72) 100%)";

/** Live "Hh : Mm : Ss" remaining to `expiryISO`, or null when disabled/expired. */
function useCountdown(expiryISO: string | undefined, enabled: boolean | undefined): string | null {
    const [, tick] = useState(0);
    useEffect(() => {
        if (!enabled || !expiryISO) return;
        const id = setInterval(() => tick((n) => n + 1), 1000);
        return () => clearInterval(id);
    }, [enabled, expiryISO]);

    if (!enabled || !expiryISO) return null;
    const ms = new Date(expiryISO).getTime() - Date.now();
    if (ms <= 0) return null;
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return `${h}h : ${String(m).padStart(2, "0")}m : ${String(s).padStart(2, "0")}s`;
}

export interface MarketingBannerProps {
    title: string;
    image?: string;
    /** Admin's countdown condition (`marketingItems.countdown`). */
    countdown?: boolean;
    /** Campaign end — the countdown counts down to this. */
    expiryISO?: string;
    onClick?: () => void;
}

export function MarketingBanner({ title, image, countdown, expiryISO, onClick }: MarketingBannerProps) {
    const time = useCountdown(expiryISO, countdown);
    const interactive = typeof onClick === "function";

    return (
        <div
            {...(interactive
                ? {
                      role: "button",
                      tabIndex: 0,
                      onClick,
                      onKeyDown: (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && onClick?.(),
                  }
                : {})}
            className={`relative flex h-[140px] w-full flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#1d2939] via-[#344054] to-[#475467] p-3 ${interactive ? "cursor-pointer outline-none" : ""}`}
        >
            {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="pointer-events-none absolute inset-0 size-full object-cover" />
            ) : null}
            <div aria-hidden className="absolute inset-0" style={{ background: VIGNETTE }} />

            {/* Countdown pill — top left, only when the admin enabled the countdown. */}
            {time ? (
                <span className="relative z-10 flex w-fit items-center gap-0.5 self-start rounded-full bg-black/40 px-1.5 py-0.5 backdrop-blur-[8px]">
                    <Clock className="size-3 text-white" aria-hidden />
                    <span className="text-xs font-medium leading-[18px] text-white">{time}</span>
                </span>
            ) : (
                <span aria-hidden />
            )}

            {/* Title — centre-left */}
            <p className="relative z-10 line-clamp-2 text-[20px] font-semibold uppercase leading-[30px] text-white">{title}</p>

            {/* T&Cs — bottom */}
            <p className="relative z-10 text-[12px] leading-[18px] text-[#d0d5dd]">*T&amp;Cs Apply</p>
        </div>
    );
}
