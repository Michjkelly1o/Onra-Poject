// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Header trigger (Figma 871:53466)
// ─────────────────────────────────────────────────────────────────────────────
//
// The AI Agent entry point now lives in the admin top header, just before the
// notification bell (was a bottom-centre floating pill). Simplified — no hover
// grow/animation — since it sits inline in the header on every admin module.
//
// Gates: `AI_AGENT_UI_VISIBLE` (master) + `isAiAgentEnabled(role)` (admin only).
// On click, navigates to `/ai-agent?returnTo=<current path>` so the agent's
// close (X) returns the user exactly where they came from.

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { AI_AGENT_UI_VISIBLE, isAiAgentEnabled } from "@/ai-agent/flags";
import { ShinyText } from "@/ai-agent/components/ShinyText";

export function AiAgentHeaderButton() {
    const router = useRouter();
    const pathname = usePathname();
    const role = useAppStore((s) => s.currentRole);

    if (!AI_AGENT_UI_VISIBLE) return null;
    if (!isAiAgentEnabled(role)) return null;

    const handleClick = () => {
        const returnTo = pathname || "/admin/dashboard";
        router.push(`/ai-agent?returnTo=${encodeURIComponent(returnTo)}`);
    };

    return (
        <button
            type="button"
            aria-label="Ask AI Agent"
            onClick={handleClick}
            className={
                // Soft brand-tinted pill: blue-green Onra icon + "Ask AI Agent".
                // Gradient + border match Figma 871:53466 (muted sage -> off-white)
                // exactly: linear-gradient(112deg, #cbe1d7 3%, #eff6f3 63%).
                "flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1.5 " +
                "border-1 border-[#dcebe4] " +
                "bg-[linear-gradient(112deg,#cbe1d7_3%,#eff6f3_63%)] " +
                "hover:brightness-[0.98] active:brightness-95 transition-[filter] " +
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#457175]"
            }
        >
            <span className="w-6 h-6 rounded-full bg-white border border-[#e4e7ec] flex items-center justify-center shrink-0 overflow-hidden">
                {/* Logo shimmers in sync with the label — the brand mark is a
                    single-colour SVG masked with the same moving gradient. It
                    rests at its natural blue-green (#164e52) and glints brighter. */}
                <ShinyText
                    maskUrl="/brand-logo/icon/Icon%20-%20Blue%20Green.svg"
                    className="w-4 h-4"
                    baseColor="#164e52"
                    shineColor="#7ad9c2"
                    speed={2.3}
                />
            </span>
            <ShinyText
                text="Ask AI Agent"
                className="text-[14px] font-medium leading-[20px] whitespace-nowrap"
                baseColor="#101828"
                shineColor="#45b89e"
                speed={2.3}
                delay={0.18}
            />
        </button>
    );
}
