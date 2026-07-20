// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Floating trigger button (fixed bottom-right)
// ─────────────────────────────────────────────────────────────────────────────
//
// The bottom-right entry point that navigates to the AI Agent page. Three
// gates stack — every one MUST pass, or the button renders null:
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
        <button
            type="button"
            aria-label="Open Onra Agent"
            onClick={handleClick}
            className={[
                "fixed bottom-6 right-6 z-[60]",
                "h-14 w-14 rounded-full flex items-center justify-center",
                "bg-[var(--brand-tertiary)] text-[#0c2d34] border-1 border-white/[0.12]",
                "shadow-[0px_4px_14px_0px_rgba(16,24,40,0.18),inset_0px_0px_0px_1px_rgba(16,24,40,0.10),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]",
                "hover:bg-[#aad4bd] active:bg-[#92baa4] transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#84c393]",
            ].join(" ")}
        >
            <Stars02 className="h-6 w-6" />
        </button>
    );
}
