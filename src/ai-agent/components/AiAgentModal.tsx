// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Modal shell (Phase 4)
// ─────────────────────────────────────────────────────────────────────────────
//
// The large centered dialog the floating button (and the URL bootstrap page)
// opens. Structure ports from ONRA AI-Agent/components/AgentModal.tsx but
// styled in Tailwind against the Syncfit DS.
//
// This file is Phase 4's shell:
//   • Header with the "onra" mark + title + close button
//   • Left sidebar with three threads:
//       – "General chat" (Insight) — the only active thread
//       – "Studio setup" — coming-soon placeholder (Phase 8+)
//       – "Migrate data" — coming-soon placeholder (Phase 7)
//   • Right pane shows the empty state (static green orb + prompt line).
//     The actual ChatThread + card renderers land in Phase 5.
//
// Behavior:
//   • ESC closes the modal.
//   • Click on the overlay closes it too.
//   • Body scroll is locked while open (prevents the admin page underneath
//     from scrolling on wheel-over-overlay).
//
// Rendered through a React portal so its stacking context is the document
// root, not whatever `<main>` container the admin page happens to nest under.

"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Stars02, LineChartUp03, Upload01, LayersThree01 } from "@untitledui/icons";
import { useAiAgentStore, type AiAgentThread } from "@/ai-agent/state";
import { cn } from "@/lib/utils";

interface ThreadDef {
    key: AiAgentThread;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    /** Coming-soon threads render at half opacity and don't switch. */
    enabled: boolean;
}

const THREADS: readonly ThreadDef[] = [
    { key: "insight",       label: "General chat",  icon: LineChartUp03, enabled: true  },
    { key: "studio_setup",  label: "Studio setup",  icon: LayersThree01, enabled: false },
    { key: "migration",     label: "Migrate data",  icon: Upload01,      enabled: false },
];

export function AiAgentModal() {
    const isOpen = useAiAgentStore((s) => s.isOpen);
    const activeThread = useAiAgentStore((s) => s.activeThread);
    const close = useAiAgentStore((s) => s.close);
    const setThread = useAiAgentStore((s) => s.setThread);

    // ESC to close.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen, close]);

    // Body scroll lock while the modal is open.
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isOpen]);

    if (!isOpen) return null;
    if (typeof window === "undefined") return null; // SSR safety

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Onra Agent"
            className="fixed inset-0 z-[70] flex items-center justify-center p-6"
        >
            {/* Overlay — click-to-close. Sibling of the panel so bubbling from
                inside the panel doesn't dismiss the modal. */}
            <button
                type="button"
                aria-label="Close Onra Agent"
                onClick={close}
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                tabIndex={-1}
            />

            {/* Panel — same rounded-20 white shell as the admin content area. */}
            <div
                className={cn(
                    "relative z-10 w-full max-w-[1040px] h-[640px]",
                    "bg-white border border-[#dcded5] rounded-[20px] shadow-2xl",
                    "flex flex-col overflow-hidden",
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 h-14 border-b border-[#eaecf0]">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[var(--brand-tertiary)] flex items-center justify-center text-[#0c2d34] text-[13px] font-semibold">
                            O
                        </div>
                        <div className="text-[15px] font-medium text-[#101828]">
                            Onra Agent
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={close}
                        className="h-8 w-8 rounded-full flex items-center justify-center text-[#475467] hover:bg-[#f9fafb] hover:text-[#101828]"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 min-h-0 flex">
                    {/* Sidebar */}
                    <aside className="w-[240px] border-r border-[#eaecf0] flex flex-col p-3 gap-1 bg-[#fafafa]">
                        <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#98a2b3] px-2 pt-1 pb-2">
                            Threads
                        </div>
                        {THREADS.map((t) => {
                            const Icon = t.icon;
                            const active = t.enabled && t.key === activeThread;
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    disabled={!t.enabled}
                                    onClick={() => t.enabled && setThread(t.key)}
                                    className={cn(
                                        "flex items-center gap-2 h-9 px-2 rounded-md text-[13px] transition-colors text-left",
                                        active && "bg-white text-[#101828] border border-[#eaecf0] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                                        !active && t.enabled && "text-[#475467] hover:bg-white/70",
                                        !t.enabled && "text-[#98a2b3] cursor-not-allowed",
                                    )}
                                >
                                    <Icon className="h-4 w-4 flex-shrink-0" />
                                    <span className="flex-1 truncate">{t.label}</span>
                                    {!t.enabled && (
                                        <span className="text-[10px] uppercase tracking-wide text-[#98a2b3] border border-[#eaecf0] rounded px-1.5 py-0.5">
                                            Soon
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </aside>

                    {/* Right pane — empty state until Phase 5 wires ChatThread. */}
                    <section className="flex-1 min-w-0 flex items-center justify-center px-8">
                        <AgentEmptyState />
                    </section>
                </div>
            </div>
        </div>,
        document.body,
    );
}

/** Static empty state — the green gradient orb (three.js particle version
 *  lands Phase 5.5) and a "How can I assist you today?" line. */
function AgentEmptyState() {
    return (
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
            <div
                aria-hidden
                className="h-24 w-24 rounded-full"
                style={{
                    background:
                        "radial-gradient(circle at 35% 35%, #d4f0dd 0%, #84c393 45%, #4b8c9a 100%)",
                    boxShadow:
                        "0 20px 40px -12px rgba(75, 140, 154, 0.35), inset 0 -8px 24px rgba(12, 45, 52, 0.25)",
                }}
            />
            <div className="flex flex-col gap-1">
                <div className="text-[20px] font-medium text-[#101828] flex items-center gap-2 justify-center">
                    <Stars02 className="h-5 w-5 text-[#4b8c9a]" />
                    How can I assist you today?
                </div>
                <div className="text-[14px] text-[#475467]">
                    Ask about revenue, memberships, class attendance, at-risk
                    customers — anything you can see in your dashboards.
                </div>
            </div>
        </div>
    );
}
