// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Floating trigger button (fixed bottom-right)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-07-31 (Figma 822:51966 default · 822:52630 hover) — the
// floating entry point is now a horizontal PILL:
//
//   Default state — a soft brand-tinted gradient pill containing the
//   Onra logomark (36px white circle) + "How can I help today?" text.
//   Always visible; the whole pill is clickable.
//
//   Hover state — the pill grows to the right and reveals a "Talk to Agent"
//   DS-primary button. Both the pill background AND the inline button
//   remain clickable — same click handler.
//
// Three gates stack — every one MUST pass, or the button renders null:
//
//   1. `AI_AGENT_UI_VISIBLE` (flags.ts) — master switch.
//   2. `isAiAgentEnabled(role)` (flags.ts) — role gate. Admin only.
//   3. `pathname === "/ai-agent"` — hide while the user is already on
//      the agent page.
//
// On click, navigates to `/ai-agent?returnTo=<current path>` so the
// page's close (X) can put the user back exactly where they came from.

"use client";

import Image from "next/image";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import {
    AI_AGENT_UI_VISIBLE,
    isAiAgentEnabled,
} from "@/ai-agent/flags";

export function FloatingAiButton() {
    const router = useRouter();
    const pathname = usePathname();
    const role = useAppStore((s) => s.currentRole);
    const [hovered, setHovered] = useState(false);

    if (!AI_AGENT_UI_VISIBLE) return null;
    if (!isAiAgentEnabled(role)) return null;
    if (pathname === "/ai-agent") return null;

    const handleClick = () => {
        const returnTo = pathname || "/admin/dashboard";
        router.push(`/ai-agent?returnTo=${encodeURIComponent(returnTo)}`);
    };

    return (
        // Client 2026-07-31 — pinned to the BOTTOM CENTRE of the viewport
        // (was bottom-right). `left-1/2` + `-translate-x-1/2` on the
        // wrapper horizontally centres the pill regardless of its width;
        // 32px bottom padding stays per Figma spacing-4xl.
        <div
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60]"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <button
                type="button"
                aria-label="Open Onra AI Agent"
                onClick={handleClick}
                className={cn(
                    // Pill chrome — full-radius, 1px brand-utility-200 border,
                    // 8px padding around the logo + text; right padding grows
                    // to 8px when the Talk-to-Agent button appears on hover
                    // so both segments have equal breathing room.
                    "flex items-center gap-2 rounded-full",
                    "border-1 border-[#c4edd6]",
                    hovered ? "pl-2 pr-2 py-2" : "pl-2 pr-3 py-2",
                    // Brand gradient bg — utility-brand-200 → utility-brand-50
                    // at ~114° (default) / ~126° (hover). Kept a single
                    // linear-gradient here because the shift between angles
                    // is imperceptible next to the pill's shadow bloom.
                    "bg-[linear-gradient(114deg,#c4edd6_3%,#e9fff3_63%)]",
                    // Multi-layer shadow with brand-green (#7ba08c) tint —
                    // stack matches the Figma drop-shadow spec.
                    "shadow-[0px_7px_7.5px_rgba(123,160,140,0.10),0px_28px_14px_rgba(123,160,140,0.09),0px_63px_19px_rgba(123,160,140,0.05)]",
                    "transition-all duration-200 ease-out",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#84c393]",
                )}
            >
                {/* Logomark tile — 36px white circle, 1.125px border. */}
                <span className="w-9 h-9 rounded-full bg-white border-[1.125px] border-[#e4e7ec] overflow-hidden flex items-center justify-center shrink-0">
                    <Image
                        src="/Logomark.webp"
                        alt=""
                        width={27}
                        height={27}
                        className="w-[27px] h-[27px] object-contain"
                        unoptimized
                    />
                </span>

                {/* Prompt text — always visible in both states. */}
                <span className="text-[14px] font-medium leading-[20px] text-[#101828] whitespace-nowrap">
                    How can I help today?
                </span>

                {/* "Talk to Agent" DS-primary pill — collapses to zero
                    width when not hovered so the outer pill's shape
                    changes smoothly. Uses the same skeuomorphic inset-
                    shadow stack as Button variant="primary" so it
                    reads as a real button when it appears. */}
                <span
                    className={cn(
                        "grid items-center overflow-hidden transition-[grid-template-columns,opacity,margin] duration-200 ease-out",
                        hovered
                            ? "opacity-100 ml-1 grid-cols-[1fr]"
                            : "opacity-0 ml-0 grid-cols-[0fr]",
                    )}
                    aria-hidden={!hovered}
                >
                    <span className="min-w-0 overflow-hidden">
                        <span
                            className={cn(
                                // Match Button variant="primary" chrome exactly
                                // so it reads as a real DS button.
                                "inline-flex items-center justify-center rounded-full",
                                "px-3 py-2 whitespace-nowrap",
                                "bg-[#c4edd6] border-2 border-white/[0.12]",
                                "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)]",
                                "text-[14px] font-semibold leading-[20px] text-[#0c2d34]",
                            )}
                        >
                            Talk to Agent
                        </span>
                    </span>
                </span>
            </button>
        </div>
    );
}
