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
        // Client 2026-07-27 — the "How can I help today?" bubble was
        // hidden per client feedback ("hide this like the bubble chat")
        // to keep the entry point compact + non-blocking on scroll. Only
        // the logomark tile remains as the fixed trigger. The wrapper's
        // bottom-8 right-8 gives 32px viewport padding per Figma
        // spacing-4xl.
        <div className="fixed bottom-8 right-8 z-[60] flex items-center gap-4 pointer-events-none">
            <button
                type="button"
                aria-label="Open Onra AI Agent"
                onClick={handleClick}
                className={[
                    "pointer-events-auto",
                    "shrink-0 w-14 h-14 rounded-[14px] bg-white",
                    "border-[0.35px] border-[#d0d5dd] overflow-hidden",
                    "flex items-center justify-center",
                    "shadow-[0px_4px_14px_0px_rgba(16,24,40,0.12),0px_1.75px_1.75px_rgba(16,24,40,0.06)]",
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
