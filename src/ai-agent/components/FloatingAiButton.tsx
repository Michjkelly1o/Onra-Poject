// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Floating trigger button (fixed bottom-right)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-07-30 (Figma 667:650314) — hover-reveal chat bubble.
// The logomark tile stays as the always-visible fixed trigger; hovering
// the entry area slides in a "Talk to agent" chat bubble to its LEFT,
// styled per the Figma reference (white card, 16/16/16/4 radii — the
// bottom-right corner is small so the shape reads as a chat bubble
// pointing at the logo, subtle brand-green tinted shadow). Both halves
// (bubble + logo) navigate to /ai-agent on click.
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
import { Stars02 } from "@untitledui/icons";
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
        // Wrapper is anchored to bottom-right with 32px page padding
        // (Figma spacing-4xl). Bubble sits absolutely to the LEFT of the
        // logo tile so its shadow can extend beyond the visible chrome
        // without being clipped — a `max-w-0 + overflow-hidden` layout
        // would swallow the drop shadow when the bubble collapses.
        <div
            className="fixed bottom-8 right-8 z-[60]"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div className="relative flex items-center">
                {/* Hover chat bubble — absolute + right-full so it hangs off
                    the LEFT of the logo tile without consuming layout space
                    when hidden. `visibility` toggles off hit-testing when
                    the bubble is fully transparent; scale/translate + opacity
                    drive the slide-in. Because there's no overflow wrapper,
                    the shadow renders in full every direction. */}
                <button
                    type="button"
                    onClick={handleClick}
                    aria-label="Talk to Onra AI Agent"
                    tabIndex={hovered ? 0 : -1}
                    className={cn(
                        // Position: floats to the left of the logo (right-full)
                        // with a 16px gap. Vertically centred against the tile.
                        "absolute right-full top-1/2 -translate-y-1/2 mr-4",
                        "flex items-center gap-2 whitespace-nowrap",
                        // Figma chrome — brand primary background (matches DS
                        // Button variant="primary": brand-tertiary bg with
                        // brand-primary text). Bottom-right corner cuts to
                        // 4px so the shape reads as a chat pointer aimed at
                        // the logo.
                        "bg-[var(--brand-tertiary)] px-4 py-4",
                        "border-1 border-white/[0.12]",
                        "rounded-tl-[16px] rounded-tr-[16px] rounded-bl-[16px] rounded-br-[4px]",
                        // Two-layer shadow per Figma — the second layer
                        // carries the brand-green tint (#e9fff3) so the
                        // bubble feels "warm" against the page bg. Inset
                        // rings mirror the DS Button primary spec.
                        "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),0px_2.4px_2.4px_0px_rgba(0,0,0,0.04),0px_6.4px_6.4px_0px_rgba(0,0,0,0.03),0px_4px_24px_0px_#e9fff3,inset_0px_0px_0px_1px_rgba(16,24,40,0.10),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]",
                        "hover:bg-[#aad4bd] active:bg-[#92baa4]",
                        "transition-all duration-200 ease-out",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#84c393]",
                        hovered
                            ? "opacity-100 translate-x-0 scale-100 visible"
                            : "opacity-0 translate-x-2 scale-95 invisible",
                    )}
                >
                    <Stars02 className="w-6 h-6 shrink-0 text-[var(--brand-primary)]" aria-hidden />
                    <span className="text-[14px] font-medium leading-[20px] text-[#0c2d34]">
                        Talk to agent
                    </span>
                </button>

                {/* Logomark trigger — always visible, always clickable. */}
                <button
                    type="button"
                    aria-label="Open Onra AI Agent"
                    onClick={handleClick}
                    className={cn(
                        "shrink-0 w-14 h-14 rounded-[14px] bg-white",
                        "border-[0.35px] border-[#d0d5dd] overflow-hidden",
                        "flex items-center justify-center",
                        "shadow-[0px_4px_14px_0px_rgba(16,24,40,0.12),0px_1.75px_1.75px_rgba(16,24,40,0.06)]",
                        "hover:bg-[#f9fafb] transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#84c393]",
                    )}
                >
                    <Image
                        src="/Logomark.webp"
                        alt=""
                        width={42}
                        height={42}
                        className="w-[42px] h-[42px] object-contain"
                        unoptimized
                    />
                </button>
            </div>
        </div>
    );
}
