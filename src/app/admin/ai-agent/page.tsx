// ─────────────────────────────────────────────────────────────────────────────
// URL bootstrap for the Onra AI Agent
// ─────────────────────────────────────────────────────────────────────────────
//
// Route: /admin/ai-agent
//
// Purpose: while `AI_AGENT_UI_VISIBLE` is `false` (2026-07-20 client push),
// the FloatingAiButton renders null everywhere — so the modal has no visible
// entry point. This page IS that entry point: navigate to `/admin/ai-agent`
// and the modal pops open (the layout root has both `<FloatingAiButton />`
// and `<AiAgentModal />` mounted; we just flip the store's `isOpen` flag).
//
// The page renders nothing of its own — the admin chrome (sidebar + header)
// stays visible behind the modal, so closing the modal drops the tester
// back onto whatever admin page they were on before, without a redirect.
//
// Role gate lives on the modal + button. If a non-admin ever navigates here,
// the modal's role gate won't fire on this URL (`FloatingAiButton` gates
// on role but the modal itself doesn't — historically we assumed only the
// button triggers `open()`). To be safe, this page mirrors that gate so a
// non-admin who guesses the URL sees the standard "coming soon" empty area.

"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { openAiAgent } from "@/ai-agent/state";
import { isAiAgentEnabled } from "@/ai-agent/flags";

export default function AiAgentBootstrapPage() {
    const role = useAppStore((s) => s.currentRole);
    const allowed = isAiAgentEnabled(role);

    useEffect(() => {
        if (allowed) openAiAgent("insight");
    }, [allowed]);

    if (!allowed) {
        return (
            <div className="flex flex-1 items-center justify-center text-center">
                <div className="max-w-sm">
                    <div className="text-[16px] font-medium text-[#101828] mb-1">
                        Onra Agent isn&apos;t available for this role.
                    </div>
                    <div className="text-[13px] text-[#475467]">
                        Switch to an admin persona to open the assistant.
                    </div>
                </div>
            </div>
        );
    }

    // The modal opens itself on mount (see useEffect above). Nothing else to
    // render — the admin layout stays visible under the modal overlay.
    return null;
}
