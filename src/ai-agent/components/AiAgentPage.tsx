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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    XClose,
    SearchLg,
    MessageChatCircle,
    Building01,
    UploadCloud02,
    Archive,
    Lock01,
    MessageSquare02,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { isAiAgentEnabled } from "@/ai-agent/flags";
import { ChatThread } from "@/ai-agent/components/ChatThread";
import type { AiAgentMode } from "@/ai-agent/types/request";

type ThreadKey = "general" | "studio_setup" | "migrate_data";

interface ThreadDef {
    key: ThreadKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    /** Coming-soon threads render but stay non-interactive. */
    enabled: boolean;
}

// Phase 11 enables studio_setup — all three threads are live.
const THREADS: readonly ThreadDef[] = [
    { key: "general",       label: "General chat", icon: MessageChatCircle, enabled: true },
    { key: "studio_setup",  label: "Studio setup", icon: Building01,        enabled: true },
    { key: "migrate_data",  label: "Migrate data", icon: UploadCloud02,     enabled: true },
];

/** Each entry point maps to the agent MODE its conversations run in. */
const MODE_FOR: Record<ThreadKey, AiAgentMode> = {
    general: "insight",
    studio_setup: "studio_setup",
    migrate_data: "migration",
};

/** A saved conversation shown in Recents. Metadata only — the messages live in
 *  localStorage under CONV_KEY(id), owned by the ChatThread. */
interface ConvMeta {
    id: string;
    mode: AiAgentMode;
    thread: ThreadKey;
    title: string;
    createdAtISO: string;
}

const RECENTS_KEY = "onra-ai-agent-conversations-v1";
const CONV_KEY = (id: string) => `onra-ai-agent-conv-${id}`;

/** The active view: a fresh EMPTY entry point, or an opened conversation.
 *  Never persisted — a refresh always resets to a fresh entry, so the three
 *  entry points stay empty landing pages. */
type AgentView =
    | { kind: "entry"; thread: ThreadKey; nonce: number }
    | { kind: "conv"; id: string };

function loadRecents(): ConvMeta[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(RECENTS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? (parsed as ConvMeta[]) : [];
    } catch {
        return [];
    }
}

const DM_SANS_STACK =
    "var(--font-brand-dm-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/** Parse a `?thread=` URL param into a valid ThreadKey. Callers can
 *  land the tester directly on a specific thread — the Migration &
 *  imports "+ Import" button uses this to open the Migrate data thread
 *  with a returnTo back to the imports list. */
function readThreadFromUrl(raw: string | null): ThreadKey {
    if (
        raw === "general" ||
        raw === "studio_setup" ||
        raw === "migrate_data"
    ) {
        return raw;
    }
    return "general";
}

export function AiAgentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentRole = useAppStore((s) => s.currentRole);
    const returnTo = useMemo(
        () => searchParams.get("returnTo") ?? "/admin/dashboard",
        [searchParams],
    );

    // Saved Recents (persisted). The active VIEW is deliberately NOT persisted,
    // so a refresh always lands on a fresh, empty entry point.
    const [conversations, setConversations] = useState<ConvMeta[]>(() => loadRecents());
    useEffect(() => {
        try {
            window.localStorage.setItem(RECENTS_KEY, JSON.stringify(conversations));
        } catch {
            /* best-effort */
        }
    }, [conversations]);

    // Phase 12: honour ?thread= for deep links (Migration & imports "+ Import").
    // A fresh, EMPTY entry every mount — the entry points are never resumed.
    const [view, setView] = useState<AgentView>(() => ({
        kind: "entry",
        thread: readThreadFromUrl(searchParams.get("thread")),
        nonce: 0,
    }));
    // The conversation the CURRENT entry has been adopted into (null until its
    // first message). Reset on every navigation.
    const [adoptedConvId, setAdoptedConvId] = useState<string | null>(null);
    const nonceRef = useRef(0);

    // Open a fresh, empty entry point (also used to start a new chat on the same
    // thread — the nonce bump forces a clean ChatThread mount).
    const openEntry = useCallback((thread: ThreadKey) => {
        setAdoptedConvId(null);
        nonceRef.current += 1;
        setView({ kind: "entry", thread, nonce: nonceRef.current });
    }, []);

    // Reopen a saved conversation from Recents.
    const openConversation = useCallback((id: string) => {
        setAdoptedConvId(null);
        setView({ kind: "conv", id });
    }, []);

    // Adopt the current entry into a saved conversation on its first message.
    const adoptEntry = useCallback((thread: ThreadKey, firstText: string) => {
        const id = `c_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
        const title = firstText.length > 60 ? `${firstText.slice(0, 60).trimEnd()}…` : firstText;
        setConversations((prev) => [
            { id, mode: MODE_FOR[thread], thread, title, createdAtISO: new Date().toISOString() },
            ...prev,
        ]);
        setAdoptedConvId(id);
    }, []);

    // Highlighting: a conversation (opened or freshly adopted) wins; otherwise
    // the empty entry point is highlighted.
    const activeConvId = view.kind === "conv" ? view.id : adoptedConvId;
    const activeEntry = view.kind === "entry" && !adoptedConvId ? view.thread : null;

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
                            activeEntry={activeEntry}
                            activeConvId={activeConvId}
                            conversations={conversations}
                            onSelectThread={openEntry}
                            onOpenConversation={openConversation}
                        />
                        <AgentChatSurface
                            view={view}
                            adoptedConvId={adoptedConvId}
                            conversations={conversations}
                            onAdopt={adoptEntry}
                        />
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
    activeEntry,
    activeConvId,
    conversations,
    onSelectThread,
    onOpenConversation,
}: {
    activeEntry: ThreadKey | null;
    activeConvId: string | null;
    conversations: ConvMeta[];
    onSelectThread: (key: ThreadKey) => void;
    onOpenConversation: (id: string) => void;
}) {
    return (
        <aside className="w-[288px] max-w-[288px] flex-shrink-0 h-full bg-white border border-[#e4e7ec] rounded-[24px] flex flex-col overflow-hidden">
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
                    const isActive = t.enabled && t.key === activeEntry;
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

            {/* Recents — a conversation appears here the moment the user sends a
                first message in an entry point; the entry itself stays empty. */}
            {conversations.length > 0 && (
                <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                    <p className="px-2 pt-2 pb-1 text-[12px] font-medium text-[#667085]">Recents</p>
                    <div className="flex flex-col gap-1">
                        {conversations.map((c) => {
                            const isActive = c.id === activeConvId;
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => onOpenConversation(c.id)}
                                    className={cn(
                                        "flex items-center gap-3 px-2 py-2.5 rounded-md text-left transition-colors",
                                        isActive ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]",
                                    )}
                                >
                                    <MessageSquare02 className="size-4 flex-shrink-0 text-[#667085]" />
                                    <span className="flex-1 text-[14px] font-normal text-[#182230] leading-5 truncate">
                                        {c.title}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Spacer + Archive footer */}
            {conversations.length === 0 && <div className="flex-1" />}
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

function AgentChatSurface({
    view,
    adoptedConvId,
    conversations,
    onAdopt,
}: {
    view: AgentView;
    adoptedConvId: string | null;
    conversations: ConvMeta[];
    onAdopt: (thread: ThreadKey, firstText: string) => void;
}) {
    return (
        <div
            className={cn(
                // Fill the available width (Figma 413:460177) — no fixed cap.
                "flex-1 min-w-0 h-full",
                "bg-white border border-[#e4e7ec] rounded-[24px] overflow-hidden relative",
            )}
        >
            {/* Mint gradient bg + concentric squares — grouped in one
                aria-hidden layer so nothing decorative can intercept clicks.
                Client 2026-07-22: refreshed to Figma 783:53146 — same
                mint field + chevron rise, now with an overall 64%
                opacity wrap so the pattern blends softer against the
                chat, and the SVG radial-mask from the design file. */}
            <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ opacity: 0.64 }}>
                {/* Mint gradient — Figma 783:53147: 1392×428, centered, rising
                    from the foot (transparent → #e9fff3). */}
                <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1392px] h-[428px]"
                    style={{
                        background:
                            "linear-gradient(to bottom, rgba(233,255,243,0) 0%, #e9fff3 100%)",
                    }}
                />
                <ConcentricSquaresDecoration />
            </div>

            {/* ONE ChatThread, keyed by the active view. An entry point is
                ephemeral (no storageKey → empty, unsaved); its first message
                adopts it into a Recents conversation WITHOUT remounting (the
                React key is unchanged), so the in-flight stream survives. An
                opened conversation mounts fresh and hydrates from its own key. */}
            <div className="relative h-full">
                {view.kind === "entry" ? (
                    <ChatThread
                        key={`entry:${view.thread}:${view.nonce}`}
                        chatId={`entry:${view.thread}:${view.nonce}`}
                        mode={MODE_FOR[view.thread]}
                        storageKey={adoptedConvId ? CONV_KEY(adoptedConvId) : null}
                        onFirstUserMessage={(text) => onAdopt(view.thread, text)}
                    />
                ) : (
                    <ChatThread
                        key={`conv:${view.id}`}
                        chatId={`conv:${view.id}`}
                        mode={conversations.find((c) => c.id === view.id)?.mode ?? "insight"}
                        storageKey={CONV_KEY(view.id)}
                    />
                )}
            </div>
        </div>
    );
}

/** Decorative concentric rounded squares — reproduces Figma 783:53148's
 *  "Background pattern decorative". The whole thing lives inside a
 *  1102.822×1102.822 wrapper anchored at top:381.3px from the foot of
 *  the chat surface, rotated −32.1°; the inner 800×800 content is
 *  masked by the design file's radial SVG so the outer arcs fade to
 *  transparent, leaving only the soft chevron tips visible where the
 *  pattern peeks above the fold. */
function ConcentricSquaresDecoration() {
    // Exact Figma 783:53148 concentric-square sizes.
    const sizes = [228.571, 342.857, 457.143, 571.429, 685.714, 800];
    // Figma places the 1102×1102 wrapper at `top: 381.3px`; on shorter
    // chat surfaces this pushes the pattern's centre well below the fold
    // so only its upper arcs peek through. Using absolute-from-top with
    // a percentage-friendly value keeps the same visual on tall/short
    // canvases (matches the Figma frame's intent).
    const MASK_URL = "url(/ai-agent/canvas-pattern-mask.svg)";
    return (
        <div className="absolute inset-0 overflow-hidden">
            {/* Outer 1102 wrapper — rotated once so the concentric squares
                inside inherit the tilt. Positioned with the top nailed to
                381.3px from the top of the canvas (Figma 783:53148). */}
            <div
                className="absolute left-1/2"
                style={{
                    width: 1102.822,
                    height: 1102.822,
                    top: 381.3,
                    transform: "translateX(-50%) rotate(-32.1deg)",
                }}
            >
                {/* opacity-48 content wrapper (Figma "Background pattern
                    decorative") — the 800×800 canvas the concentric squares
                    are centred within. */}
                <div
                    className="absolute top-1/2 left-1/2"
                    style={{
                        width: 800,
                        height: 800,
                        transform: "translate(-50%, -50%)",
                        opacity: 0.48,
                    }}
                >
                    {/* Masked content — the SVG mask is a radial fade from
                        centre so the outermost squares dissolve softly. */}
                    <div
                        className="absolute inset-0"
                        style={{
                            WebkitMaskImage: MASK_URL,
                            maskImage: MASK_URL,
                            WebkitMaskRepeat: "no-repeat",
                            maskRepeat: "no-repeat",
                            WebkitMaskPosition: "center",
                            maskPosition: "center",
                            WebkitMaskSize: "100% 100%",
                            maskSize: "100% 100%",
                        }}
                    >
                        {sizes.map((size) => (
                            <div
                                key={size}
                                className="absolute top-1/2 left-1/2 border-[#7ba08c] rounded-[28.571px]"
                                style={{
                                    width: size,
                                    height: size,
                                    borderWidth: 2.381,
                                    transform: "translate(-50%, -50%) rotate(-12.5deg)",
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
