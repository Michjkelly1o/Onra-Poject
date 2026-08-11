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
// Four gates stack — every one MUST pass, or the button renders null:
//
//   1. `AI_AGENT_UI_VISIBLE` (flags.ts) — master switch.
//   2. `isAiAgentEnabled(role)` (flags.ts) — role gate. Admin only.
//   3. `pathname === "/ai-agent"` — hide while the user is already on
//      the agent page.
//   4. `bulkSelectionActive` (store) — hide the moment any admin list
//      page's Bulk-select mode has ≥1 row checked. Both the pill AND
//      the page's BulkActionBar are bottom-fixed; they'd stack /
//      overlap and steal each other's clicks. See
//      `useBulkSelectionSignal` — every list page owns the wire.
//
// On click, navigates to `/ai-agent?returnTo=<current path>` so the
// page's close (X) can put the user back exactly where they came from.

"use client";

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
    const bulkSelectionActive = useAppStore((s) => s.bulkSelectionActive);
    const [hovered, setHovered] = useState(false);

    if (!AI_AGENT_UI_VISIBLE) return null;
    if (!isAiAgentEnabled(role)) return null;
    if (pathname === "/ai-agent") return null;
    if (bulkSelectionActive) return null;

    const handleClick = () => {
        const returnTo = pathname || "/admin/dashboard";
        router.push(`/ai-agent?returnTo=${encodeURIComponent(returnTo)}`);
    };

    return (
        // Client 2026-08-04 — pinned to the BOTTOM RIGHT of the viewport
        // (`right-8`), 32px from both edges per Figma spacing-4xl.
        //
        // z-40 (client 2026-08-04) — sits just BELOW the app's modal / side-
        // panel layer (every admin dialog, sheet, and filter panel is z-50 or
        // higher) so the pill slides BEHIND any open overlay instead of
        // floating over a dimmed backdrop. Still above all page chrome
        // (sticky headers / in-page dropdowns top out at z-30), so it keeps
        // floating over ordinary content. Was z-[60], which sat over z-50
        // modals — the bug the client reported on the Add-widget modal.
        <div
            className="fixed bottom-8 right-8 z-40"
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
                    "border-1 border-[var(--colors-secondary-200)]",
                    hovered ? "pl-2 pr-2 py-2" : "pl-2 pr-3 py-2",
                    // Brand gradient bg — utility-brand-200 → utility-brand-50
                    // at ~114° (default) / ~126° (hover). Kept a single
                    // linear-gradient here because the shift between angles
                    // is imperceptible next to the pill's shadow bloom.
                    "bg-[linear-gradient(114deg,#dcebe4_3%,#eff6f3_63%)]",
                    // Multi-layer shadow with brand-teal (#457175) tint —
                    // stack matches the Figma drop-shadow spec.
                    "shadow-[0px_7px_7.5px_rgba(69,113,117,0.10),0px_28px_14px_rgba(69,113,117,0.09),0px_63px_19px_rgba(69,113,117,0.05)]",
                    "transition-all duration-200 ease-out",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#457175]",
                )}
            >
                {/* Logomark tile — 36px white circle, 1.125px border. */}
                <span className="w-9 h-9 rounded-full bg-white border-[1.125px] border-[var(--colors-border-secondary)] overflow-hidden flex items-center justify-center shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/brand-logo/icon/Icon%20-%20Blue%20Green.svg"
                        alt=""
                        className="w-[27px] h-[27px] object-contain"
                    />
                </span>

                {/* Prompt text — always visible in both states. */}
                <span className="text-[14px] font-medium leading-[20px] text-[var(--colors-text-primary)] whitespace-nowrap">
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
                                "bg-[var(--colors-secondary-200)] border-2 border-white/[0.12]",
                                "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)]",
                                "text-[14px] font-semibold leading-[20px] text-[var(--colors-brand-900)]",
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
