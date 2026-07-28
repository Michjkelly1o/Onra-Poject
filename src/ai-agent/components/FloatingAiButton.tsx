// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Floating trigger button (fixed bottom-right)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-07-27 (Figma 667:650314) — the trigger is now the "How can I
// help today?" prompt bubble + Onra logomark tile pair rather than a plain
// circle. Both halves click through to /ai-agent. Positioned bottom-right
// with 32px page padding per the Figma frame.
//
// Three gates stack — every one MUST pass, or the button renders null:
//
//   1. `AI_AGENT_UI_VISIBLE` (flags.ts) — a master switch. Currently `false`
//      because today's push ships every other update but keeps the AI Agent
//      hidden in the admin chrome. URL access via `/ai-agent` still works
//      while this is off.
//   2. `isAiAgentEnabled(role)` (flags.ts) — role gate. Admin only.
//   3. `pathname === "/ai-agent"` — hide the trigger while the user is
//      already on the agent page; no reason to nudge them somewhere they
//      already are, and avoids the button floating over its own content.
//
// On click, navigates to `/ai-agent?returnTo=<current path>` so the page's
// close (X) can put the user back exactly where they came from.

"use client";

import Image from "next/image";
import { Stars02 } from "@untitledui/icons";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import {
    AI_AGENT_UI_VISIBLE,
    isAiAgentEnabled,
} from "@/ai-agent/flags";

export function FloatingAiButton() {
    const router = useRouter();
    const pathname = usePathname();
    const role = useAppStore((s) => s.currentRole);

    if (!AI_AGENT_UI_VISIBLE) return null;
    if (!isAiAgentEnabled(role)) return null;
    if (pathname === "/ai-agent") return null;

    const handleClick = () => {
        const returnTo = pathname || "/admin/dashboard";
        router.push(`/ai-agent?returnTo=${encodeURIComponent(returnTo)}`);
    };

    return (
        // 32px frame padding to the viewport edges, per Figma spacing-4xl.
        // Wrapper is `fixed` so the pair floats above every page.
        <div className="fixed bottom-8 right-8 z-[60] flex items-center gap-4 pointer-events-none">
            {/* Prompt bubble — the wide "How can I help today?" card.
                Rounded 2xl on three corners + 4px on the bottom-right so
                it visually points toward the logomark tile. */}
            <button
                type="button"
                aria-label="Open Onra AI Agent"
                onClick={handleClick}
                className={[
                    "pointer-events-auto",
                    "bg-white border-1 border-[#e4e7ec]",
                    "flex items-center gap-2 px-4 py-3",
                    "rounded-tl-[16px] rounded-tr-[16px] rounded-bl-[16px] rounded-br-[4px]",
                    "shadow-[0px_0.8px_0.8px_0px_rgba(0,0,0,0.04),0px_2.4px_2.4px_0px_rgba(0,0,0,0.04),0px_6.4px_6.4px_0px_rgba(0,0,0,0.03),0px_20px_20px_0px_rgba(0,0,0,0.01),0px_4px_24px_0px_#e9fff3]",
                    "hover:bg-[#f9fafb] transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#84c393]",
                    // Bounded width so a long prompt doesn't stretch the
                    // whole page — matches the Figma 319px overall pair
                    // width (bubble ≈ 247px + 16px gap + 56px logo).
                    "max-w-[247px]",
                ].join(" ")}
            >
                <Stars02 className="w-6 h-6 text-[#658774] shrink-0" />
                <span className="text-[14px] font-medium leading-[20px] text-[#101828] text-left">
                    How can I help today?
                </span>
            </button>
            {/* Logomark tile — the square Onra brand mark. Uses the
                existing /Logomark.webp asset the sidebar + login page
                already ship with, so the brand stays consistent. */}
            <button
                type="button"
                aria-label="Open Onra AI Agent"
                onClick={handleClick}
                className={[
                    "pointer-events-auto",
                    "shrink-0 w-14 h-14 rounded-[14px] bg-white",
                    "border-[0.35px] border-[#d0d5dd] overflow-hidden",
                    "flex items-center justify-center",
                    "shadow-[0px_1.75px_2.625px_rgba(16,24,40,0.1),0px_1.75px_1.75px_rgba(16,24,40,0.06)]",
                    "hover:bg-[#f9fafb] transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#84c393]",
                ].join(" ")}
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
    );
}
