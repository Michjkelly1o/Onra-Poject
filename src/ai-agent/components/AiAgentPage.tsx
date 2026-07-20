// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Full-viewport page (Figma nodes 405:455789 / 802 / 839 / 795)
// ─────────────────────────────────────────────────────────────────────────────
//
// Layout mirrors the Figma exactly. Renders as the entire viewport (no admin
// sidebar/header wrapping — this route lives at /ai-agent, not
// /admin/ai-agent). Uses DM Sans throughout via the site-wide
// `--font-brand-dm-sans` CSS variable already loaded in
// src/app/branding-fonts.ts; that variable is available on <body> so any
// descendant can pin it with `fontFamily: 'var(--font-brand-dm-sans), …'`.
//
// Structure:
//   Header (72px, sticky, white)
//     ├─ close (X) — navigates to ?returnTo or /admin/dashboard
//     └─ Onra logomark (24px, rounded-[6px]) + "AI Agent"
//   Section (below header, 24px horizontal padding, 24px gap, LEFT-aligned)
//     ├─ Sidebar (288px, rounded-3xl, border): search + 3 threads +
//     │     Archive footer.
//     └─ Chat surface (flex-1, max 1080px, rounded-3xl, border):
//           mint gradient bg + decorative concentric squares (from the
//           top edge, fading down). Live ChatThread rendered inside —
//           empty state (orb + heading + suggestion cards) until the
//           user sends a message, then message list + streaming
//           assistant responses with generative-UI cards.
//
// Phase 5 update (from Phase 4 shell): AgentEmptyState / AskAnythingInput /
// SuggestionCardRow moved INTO ChatThread so the composer's `useChat`
// state stays co-located with the message list. AiAgentPage now hosts
// only the outer chrome + surface + the mounted ChatThread.

"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    XClose,
    SearchLg,
    MessageChatCircle,
    Building01,
    UploadCloud02,
    Archive,
    Lock01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { isAiAgentEnabled } from "@/ai-agent/flags";
import { ChatThread } from "@/ai-agent/components/ChatThread";

type ThreadKey = "general" | "studio_setup" | "migrate_data";

interface ThreadDef {
    key: ThreadKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    /** Coming-soon threads render but stay non-interactive. */
    enabled: boolean;
}

// Phase 7 enables migrate_data. Studio setup is still Phase 11.
const THREADS: readonly ThreadDef[] = [
    { key: "general",       label: "General chat", icon: MessageChatCircle, enabled: true  },
    { key: "studio_setup",  label: "Studio setup", icon: Building01,        enabled: false },
    { key: "migrate_data",  label: "Migrate data", icon: UploadCloud02,     enabled: true  },
];

const DM_SANS_STACK =
    "var(--font-brand-dm-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export function AiAgentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentRole = useAppStore((s) => s.currentRole);
    const returnTo = useMemo(
        () => searchParams.get("returnTo") ?? "/admin/dashboard",
        [searchParams],
    );

    const [activeThread, setActiveThread] = useState<ThreadKey>("general");

    const handleClose = () => router.push(returnTo);
    const roleAllowed = isAiAgentEnabled(currentRole);

    return (
        <div
            className="flex flex-col h-screen w-screen bg-white text-[#101828]"
            style={{ fontFamily: DM_SANS_STACK }}
        >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <header className="sticky top-0 z-10 h-[72px] flex items-center px-6 bg-white shrink-0">
                <div className="flex items-center gap-3">
                    {/* Close (X) — matches the app's detail-page pattern
                        (see CustomerDetailPage:1020-1023). */}
                    <button
                        type="button"
                        aria-label="Close AI Agent"
                        onClick={handleClose}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0"
                    >
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>

                    {/* Logomark + title */}
                    <div className="flex items-center gap-2">
                        <div className="size-6 rounded-[6px] border border-[#d0d5dd] bg-white flex items-center justify-center shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden">
                            <Image
                                src="/Logomark.webp"
                                alt="Onra"
                                width={18}
                                height={18}
                                className="block object-contain"
                                priority
                            />
                        </div>
                        <span className="text-[18px] font-semibold text-[#344054] leading-7">
                            AI Agent
                        </span>
                    </div>
                </div>
            </header>

            {/* ── Section: sidebar + chat pane ──────────────────────────
                Role-gated. Non-admin (instructor/member) who somehow
                lands here — direct URL, shared link, browser back —
                gets a friendly "not available" state INSTEAD of a
                broken chat. Belt-and-suspenders with the server 403:
                if this gate ever leaks, the API still refuses. */}
            <section className="flex-1 min-h-0 flex gap-6 px-6 pb-6 items-start">
                {roleAllowed ? (
                    <>
                        <AgentSidebar
                            activeThread={activeThread}
                            onSelectThread={setActiveThread}
                        />
                        <AgentChatSurface activeThread={activeThread} />
                    </>
                ) : (
                    <NotAvailableForRoleState onClose={handleClose} />
                )}
            </section>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback state — non-admin persona reached /ai-agent somehow
// ─────────────────────────────────────────────────────────────────────────────

function NotAvailableForRoleState({ onClose }: { onClose: () => void }) {
    return (
        <div className="flex-1 h-full bg-white border border-[#e4e7ec] rounded-[24px] flex items-center justify-center px-6">
            <div className="flex flex-col items-center gap-4 max-w-md text-center">
                <div className="size-12 rounded-full bg-[#f9fafb] border border-[#eaecf0] flex items-center justify-center">
                    <Lock01 className="size-6 text-[#667085]" />
                </div>
                <div className="flex flex-col gap-1">
                    <div className="text-[18px] font-semibold text-[#101828]">
                        Onra Agent isn&apos;t available for this role.
                    </div>
                    <div className="text-[14px] text-[#475467]">
                        The AI assistant is admin-only. Switch to an admin
                        persona to open it.
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className={cn(
                        "h-9 px-4 rounded-md",
                        "bg-white text-[#344054] text-[14px] font-medium border border-[#d0d5dd]",
                        "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                        "hover:bg-[#f9fafb] transition-colors",
                    )}
                >
                    Go back
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Left sidebar
// ─────────────────────────────────────────────────────────────────────────────

function AgentSidebar({
    activeThread,
    onSelectThread,
}: {
    activeThread: ThreadKey;
    onSelectThread: (key: ThreadKey) => void;
}) {
    return (
        <aside className="w-[288px] flex-shrink-0 h-full bg-white border border-[#e4e7ec] rounded-[24px] flex flex-col overflow-hidden">
            {/* Search input */}
            <div className="p-4 border-b border-[#e4e7ec]">
                <div className="flex items-center gap-2 h-10 px-4 rounded-lg border border-[#d0d5dd] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                    <SearchLg className="size-5 text-[#667085] flex-shrink-0" />
                    <input
                        type="text"
                        placeholder="Search chat..."
                        className="flex-1 min-w-0 text-[16px] text-[#101828] placeholder:text-[#667085] bg-transparent outline-none leading-6"
                    />
                </div>
            </div>

            {/* Thread list */}
            <nav className="flex flex-col gap-1 px-2 py-3">
                {THREADS.map((t) => {
                    const Icon = t.icon;
                    const isActive = t.enabled && t.key === activeThread;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            disabled={!t.enabled}
                            onClick={() => t.enabled && onSelectThread(t.key)}
                            className={cn(
                                "flex items-center gap-3 px-2 py-3 rounded-md text-left transition-colors",
                                isActive && "bg-[#f9fafb]",
                                !isActive && t.enabled && "hover:bg-[#f9fafb]",
                                !t.enabled && "cursor-not-allowed",
                            )}
                        >
                            <Icon className="size-4 flex-shrink-0 text-[#182230]" />
                            <span className="flex-1 text-[14px] font-medium text-[#182230] leading-5 truncate">
                                {t.label}
                            </span>
                            {!t.enabled && (
                                <span className="text-[10px] uppercase tracking-wide text-[#98a2b3] border border-[#eaecf0] rounded px-1.5 py-0.5">
                                    Soon
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Spacer + Archive footer */}
            <div className="flex-1" />
            <div className="p-4 border-t border-[#e4e7ec]">
                <button
                    type="button"
                    className="w-full flex items-center gap-3 px-2 py-3 rounded-md hover:bg-[#f9fafb] transition-colors"
                >
                    <Archive className="size-4 flex-shrink-0 text-[#182230]" />
                    <span className="flex-1 text-[14px] font-medium text-[#182230] leading-5 text-left">
                        Archive
                    </span>
                </button>
            </div>
        </aside>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right chat surface — wraps the ChatThread + decorative background
// ─────────────────────────────────────────────────────────────────────────────

function AgentChatSurface({ activeThread }: { activeThread: ThreadKey }) {
    return (
        <div
            className={cn(
                "flex-1 min-w-0 max-w-[1080px] h-full",
                "bg-white border border-[#e4e7ec] rounded-[24px] overflow-hidden relative",
            )}
        >
            {/* Mint gradient bg + concentric squares — grouped in one
                aria-hidden layer so nothing decorative can intercept clicks.
                Client 2026-07-20: pattern rises from the TOP of the canvas
                (mint field, chevron tips point downward toward the chat). */}
            <div aria-hidden className="absolute inset-0 pointer-events-none">
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            "linear-gradient(to top, rgba(233,255,243,0) 40%, #e9fff3 100%)",
                    }}
                />
                <ConcentricSquaresDecoration />
            </div>

            {/* Both ChatThreads stay MOUNTED (one per mode) so each keeps
                its own message history when the user switches threads —
                same pattern as the POC. `visible` toggles display but
                the useChat state under each survives. */}
            <div className="relative h-full">
                <ChatThread
                    mode="insight"
                    visible={activeThread === "general"}
                />
                <ChatThread
                    mode="migration"
                    visible={activeThread === "migrate_data"}
                />
            </div>
        </div>
    );
}

/** Decorative concentric rounded squares — reproduces the Figma's
 *  "Background pattern decorative" without pulling in the asset PNG. */
function ConcentricSquaresDecoration() {
    const sizes = [228, 342, 457, 571, 685, 800];
    return (
        <div
            className="absolute inset-0 overflow-hidden"
            style={{
                opacity: 0.35,
                WebkitMaskImage:
                    "radial-gradient(ellipse 55% 45% at 50% 0%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0) 75%)",
                maskImage:
                    "radial-gradient(ellipse 55% 45% at 50% 0%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0) 75%)",
            }}
        >
            <div
                className="absolute left-1/2 top-0"
                style={{
                    width: 800,
                    height: 800,
                    transform: "translate(-50%, -35%) rotate(-32deg)",
                }}
            >
                {sizes.map((size) => (
                    <div
                        key={size}
                        className="absolute top-1/2 left-1/2 border-2 border-[#7ba08c] rounded-[28px]"
                        style={{
                            width: size,
                            height: size,
                            transform: "translate(-50%, -50%) rotate(-12.5deg)",
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
