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
import { createPortal } from "react-dom";
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
    DotsVertical,
    Edit02,
    Pin01,
    Trash01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { isAiAgentEnabled } from "@/ai-agent/flags";
import { ChatThread } from "@/ai-agent/components/ChatThread";
import type { AiAgentMode } from "@/ai-agent/types/request";
import { Modal } from "@/components/modals/Modal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { Button } from "@/components/ui/button";

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
    { key: "general", label: "General chat", icon: MessageChatCircle, enabled: true },
    { key: "studio_setup", label: "Studio setup", icon: Building01, enabled: true },
    { key: "migrate_data", label: "Migrate data", icon: UploadCloud02, enabled: true },
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
    /** Pinned conversations sort to the top of Recents with a pin marker. */
    pinned?: boolean;
    /** Archived conversations drop out of Recents into the Archive drawer. */
    archived?: boolean;
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

    // ── Recents row actions (3-dot menu) ─────────────────────────────────────
    // If the acted-on conversation is the one currently open, bounce the view
    // back to a fresh entry so we never leave a deleted/archived conv on screen.
    const resetViewIfOpen = useCallback((id: string) => {
        setView((v) => {
            if (v.kind === "conv" && v.id === id) {
                nonceRef.current += 1;
                return { kind: "entry", thread: "general", nonce: nonceRef.current };
            }
            return v;
        });
        setAdoptedConvId((prev) => (prev === id ? null : prev));
    }, []);

    const renameConversation = useCallback((id: string, nextTitle: string) => {
        const clean = nextTitle.trim();
        if (!clean) return;
        setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, title: clean } : c)),
        );
    }, []);

    const togglePinConversation = useCallback((id: string) => {
        setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
        );
    }, []);

    const setArchivedConversation = useCallback(
        (id: string, archived: boolean) => {
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === id ? { ...c, archived, pinned: archived ? false : c.pinned } : c,
                ),
            );
            if (archived) resetViewIfOpen(id);
        },
        [resetViewIfOpen],
    );

    const deleteConversation = useCallback(
        (id: string) => {
            setConversations((prev) => prev.filter((c) => c.id !== id));
            try {
                window.localStorage.removeItem(CONV_KEY(id));
            } catch {
                /* best-effort */
            }
            resetViewIfOpen(id);
        },
        [resetViewIfOpen],
    );

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
                            onRename={renameConversation}
                            onTogglePin={togglePinConversation}
                            onSetArchived={setArchivedConversation}
                            onDelete={deleteConversation}
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
    onRename,
    onTogglePin,
    onSetArchived,
    onDelete,
}: {
    activeEntry: ThreadKey | null;
    activeConvId: string | null;
    conversations: ConvMeta[];
    onSelectThread: (key: ThreadKey) => void;
    onOpenConversation: (id: string) => void;
    onRename: (id: string, nextTitle: string) => void;
    onTogglePin: (id: string) => void;
    onSetArchived: (id: string, archived: boolean) => void;
    onDelete: (id: string) => void;
}) {
    // Which drawer is showing — the live Recents list or the Archive drawer.
    const [showArchived, setShowArchived] = useState(false);
    // The row whose 3-dot menu is currently open (null = none).
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    // Rename dialog target + confirm-modal target.
    const [renameTarget, setRenameTarget] = useState<ConvMeta | null>(null);
    const [confirm, setConfirm] = useState<{ conv: ConvMeta; kind: "archive" | "delete" } | null>(null);

    // Active (non-archived), pinned first then newest. Archived split out for
    // the Archive drawer.
    const activeConvos = useMemo(
        () =>
            conversations
                .filter((c) => !c.archived)
                .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)),
        [conversations],
    );
    const archivedConvos = useMemo(
        () => conversations.filter((c) => c.archived),
        [conversations],
    );
    const list = showArchived ? archivedConvos : activeConvos;

    return (
        <aside className="flex-none w-[288px] min-w-[288px] max-w-[288px] h-full bg-white border border-[#e4e7ec] rounded-[24px] flex flex-col overflow-hidden">
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

            {/* Thread list — hidden while browsing the Archive drawer. */}
            {!showArchived && (
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
            )}

            {/* Recents / Archived list. Each row carries a 3-dot menu with
                Rename (dialog) / Pin / Archive / Delete (confirm modals). */}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                <p className="px-2 pt-2 pb-1 text-[12px] font-medium text-[#667085]">
                    {showArchived ? "Archived" : "Recents"}
                </p>
                {list.length === 0 ? (
                    <p className="px-2 py-6 text-[13px] text-[#98a2b3] text-center">
                        {showArchived ? "No archived chats." : "No chats yet."}
                    </p>
                ) : (
                    <div className="flex flex-col gap-1">
                        {list.map((c) => (
                            <RecentRow
                                key={c.id}
                                conv={c}
                                isActive={c.id === activeConvId}
                                menuOpen={menuOpenId === c.id}
                                onOpen={() => onOpenConversation(c.id)}
                                onToggleMenu={() =>
                                    setMenuOpenId((prev) => (prev === c.id ? null : c.id))
                                }
                                onCloseMenu={() => setMenuOpenId(null)}
                                onRename={() => {
                                    setMenuOpenId(null);
                                    setRenameTarget(c);
                                }}
                                onTogglePin={() => {
                                    setMenuOpenId(null);
                                    onTogglePin(c.id);
                                }}
                                onArchive={() => {
                                    setMenuOpenId(null);
                                    if (c.archived) onSetArchived(c.id, false);
                                    else setConfirm({ conv: c, kind: "archive" });
                                }}
                                onDelete={() => {
                                    setMenuOpenId(null);
                                    setConfirm({ conv: c, kind: "delete" });
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Archive drawer toggle. */}
            <div className="p-4 border-t border-[#e4e7ec]">
                <button
                    type="button"
                    onClick={() => {
                        setMenuOpenId(null);
                        setShowArchived((v) => !v);
                    }}
                    className={cn(
                        "w-full flex items-center gap-3 px-2 py-3 rounded-md transition-colors",
                        showArchived ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]",
                    )}
                >
                    <Archive className="size-4 flex-shrink-0 text-[#182230]" />
                    <span className="flex-1 text-[14px] font-medium text-[#182230] leading-5 text-left">
                        {showArchived ? "Back to chats" : "Archive"}
                    </span>
                    {archivedConvos.length > 0 && (
                        <span className="text-[12px] font-medium text-[#667085]">
                            {archivedConvos.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Rename dialog (Figma: rename is a dialog, not inline edit). */}
            <RenameConversationDialog
                conv={renameTarget}
                onClose={() => setRenameTarget(null)}
                onSubmit={(title) => {
                    if (renameTarget) onRename(renameTarget.id, title);
                    setRenameTarget(null);
                }}
            />

            {/* Archive / Delete confirmation. */}
            <ConfirmModal
                open={!!confirm}
                onClose={() => setConfirm(null)}
                icon={confirm?.kind === "delete" ? Trash01 : Archive}
                tone={confirm?.kind === "delete" ? "danger" : "success"}
                title={confirm?.kind === "delete" ? "Delete this chat?" : "Archive this chat?"}
                description={
                    confirm?.kind === "delete"
                        ? `"${confirm?.conv.title}" and its messages will be permanently removed. This can't be undone.`
                        : `"${confirm?.conv.title}" will move to your Archive. You can restore it anytime.`
                }
                confirmLabel={confirm?.kind === "delete" ? "Delete" : "Archive"}
                onConfirm={() => {
                    if (!confirm) return;
                    if (confirm.kind === "delete") onDelete(confirm.conv.id);
                    else onSetArchived(confirm.conv.id, true);
                    setConfirm(null);
                }}
            />
        </aside>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recents row + its 3-dot action menu
// ─────────────────────────────────────────────────────────────────────────────

function RecentRow({
    conv,
    isActive,
    menuOpen,
    onOpen,
    onToggleMenu,
    onCloseMenu,
    onRename,
    onTogglePin,
    onArchive,
    onDelete,
}: {
    conv: ConvMeta;
    isActive: boolean;
    menuOpen: boolean;
    onOpen: () => void;
    onToggleMenu: () => void;
    onCloseMenu: () => void;
    onRename: () => void;
    onTogglePin: () => void;
    onArchive: () => void;
    onDelete: () => void;
}) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    return (
        <div
            className={cn(
                "group relative flex items-center gap-2 pl-2 pr-1 py-2.5 rounded-md transition-colors",
                isActive || menuOpen ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]",
            )}
        >
            <button
                type="button"
                onClick={onOpen}
                className="flex-1 min-w-0 flex items-center gap-3 text-left"
            >
                <MessageSquare02 className="size-4 flex-shrink-0 text-[#667085]" />
                <span className="flex-1 text-[14px] font-normal text-[#182230] leading-5 truncate">
                    {conv.title}
                </span>
            </button>

            {/* Right side: a pin marker (always visible on pinned rows) and the
                3-dot trigger (reveals on hover / while its menu is open) —
                matches the client mockup where pinned chats show the pin on
                the right and sit at the top of the list. */}
            {conv.pinned && (
                <Pin01
                    className={cn(
                        "size-4 flex-shrink-0 text-[#658774] transition-opacity",
                        // Hidden under the 3-dot on hover so they don't crowd.
                        menuOpen ? "hidden" : "group-hover:hidden",
                    )}
                />
            )}
            <button
                ref={triggerRef}
                type="button"
                onClick={onToggleMenu}
                aria-label="Chat options"
                className={cn(
                    "flex-shrink-0 size-7 flex items-center justify-center rounded-md transition-all",
                    "hover:bg-[#eaecf0]",
                    menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
            >
                <DotsVertical className="size-4 text-[#667085]" />
            </button>

            {menuOpen && (
                <RowMenu
                    triggerRef={triggerRef}
                    pinned={!!conv.pinned}
                    archived={!!conv.archived}
                    onClose={onCloseMenu}
                    onRename={onRename}
                    onTogglePin={onTogglePin}
                    onArchive={onArchive}
                    onDelete={onDelete}
                />
            )}
        </div>
    );
}

/** The dropdown menu itself. Rendered in a portal at a fixed position derived
 *  from the trigger so it's never clipped by the sidebar's overflow. Closes on
 *  outside-click, Escape, or scroll. */
function RowMenu({
    triggerRef,
    pinned,
    archived,
    onClose,
    onRename,
    onTogglePin,
    onArchive,
    onDelete,
}: {
    triggerRef: React.RefObject<HTMLButtonElement>;
    pinned: boolean;
    archived: boolean;
    onClose: () => void;
    onRename: () => void;
    onTogglePin: () => void;
    onArchive: () => void;
    onDelete: () => void;
}) {
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const t = triggerRef.current;
        if (!t) return;
        const r = t.getBoundingClientRect();
        const MENU_W = 200;
        // Anchor the menu's top-right just under the trigger; clamp to viewport.
        const left = Math.min(r.right, window.innerWidth - MENU_W - 8);
        setPos({ top: r.bottom + 6, left });
    }, [triggerRef]);

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(e.target as Node)
            ) {
                onClose();
            }
        };
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("mousedown", onDocClick);
        window.addEventListener("keydown", onKey);
        window.addEventListener("scroll", onClose, true);
        return () => {
            window.removeEventListener("mousedown", onDocClick);
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", onClose, true);
        };
    }, [onClose, triggerRef]);

    if (!pos) return null;

    const item =
        "w-full flex items-center gap-3 px-3 py-2.5 text-[14px] font-medium text-left rounded-md transition-colors";
    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: 200 }}
            className="z-[400] bg-white border border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] p-1.5 flex flex-col"
        >
            <button type="button" onClick={onRename} className={cn(item, "text-[#344054] hover:bg-[#f9fafb]")}>
                <Edit02 className="size-4 text-[#667085]" />
                Rename
            </button>
            {!archived && (
                <button type="button" onClick={onTogglePin} className={cn(item, "text-[#344054] hover:bg-[#f9fafb]")}>
                    <Pin01 className="size-4 text-[#667085]" />
                    {pinned ? "Unpin" : "Pin"}
                </button>
            )}
            <button type="button" onClick={onArchive} className={cn(item, "text-[#344054] hover:bg-[#f9fafb]")}>
                <Archive className="size-4 text-[#667085]" />
                {archived ? "Unarchive" : "Archive"}
            </button>
            <button type="button" onClick={onDelete} className={cn(item, "text-[#d92d20] hover:bg-[#fef3f2]")}>
                <Trash01 className="size-4 text-[#d92d20]" />
                Delete
            </button>
        </div>,
        document.body,
    );
}

/** Rename dialog — a proper modal with a text input + Save/Cancel, per the
 *  Figma (rename is a dialog, not an inline field). */
function RenameConversationDialog({
    conv,
    onClose,
    onSubmit,
}: {
    conv: ConvMeta | null;
    onClose: () => void;
    onSubmit: (title: string) => void;
}) {
    const [value, setValue] = useState("");
    useEffect(() => {
        if (conv) setValue(conv.title);
    }, [conv]);

    const canSave = value.trim().length > 0;
    const submit = () => {
        if (canSave) onSubmit(value);
    };

    return (
        <Modal open={!!conv} onClose={onClose} maxWidth={440}>
            <Modal.Header title="Rename chat" subtitle="Give this conversation a clear name." onClose={onClose} />
            <Modal.Body>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[14px] font-medium text-[#344054]">Chat name</label>
                    <input
                        autoFocus
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") submit();
                        }}
                        placeholder="e.g. Create a class schedule"
                        className="h-10 w-full px-3.5 rounded-lg border border-[#d0d5dd] bg-white text-[16px] text-[#101828] placeholder:text-[#667085] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] outline-none focus:border-[#7ba08c] focus:ring-2 focus:ring-[#aad4bd] transition-all"
                    />
                </div>
            </Modal.Body>
            <Modal.Footer layout="full">
                <Button variant="secondary-gray" size="lg" onClick={onClose}>
                    Cancel
                </Button>
                <Button variant="primary" size="lg" disabled={!canSave} onClick={submit}>
                    Save
                </Button>
            </Modal.Footer>
        </Modal>
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
                Client 2026-07-22: Figma 783:53146 — mint field rising from
                the foot with the concentric-square chevron pattern sitting
                low, only the upper arcs peeking above the fold. */}
            <div aria-hidden className="absolute inset-0 pointer-events-none">
                {/* Concentric-square pattern FIRST (behind the gradient) so
                    the mint wash sits ON TOP of the lines and fades them
                    into the surface toward the foot. */}
                <ConcentricSquaresDecoration />
                {/* Mint gradient — full-width, rising softly from the foot
                    (Figma 783:53147). Uses the brand mint (#c4edd6 =
                    rgb(196,237,214)) so it reads clearly against the white
                    canvas while staying a gentle wash — transparent at the
                    top, easing to ~70% mint at the foot. */}
                <div
                    className="absolute inset-x-0 bottom-0 h-[58%]"
                    style={{
                        background:
                            // Opacity dialled back a further 20% (client
                            // 2026-07-23) — 0.25→0.20 mid, 0.50→0.40 foot.
                            "linear-gradient(to bottom, rgba(196,237,214,0) 0%, rgba(196,237,214,0.20) 55%, rgba(196,237,214,0.40) 100%)",
                    }}
                />
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
 *  "Background pattern decorative". Anchored to the FOOT of the canvas
 *  so the pattern's centre sits just below the fold and only the upper
 *  arcs peek through as soft chevrons rising toward the composer.
 *  The design file's radial SVG mask fades the outer squares to
 *  transparent so the softest lines dissolve at the edges. */
function ConcentricSquaresDecoration() {
    // Exact Figma 783:53148 concentric-square sizes.
    const sizes = [228.571, 342.857, 457.143, 571.429, 685.714, 800];
    const MASK_URL = "url(/ai-agent/canvas-pattern-mask.svg)";
    return (
        <div className="absolute inset-0 overflow-hidden">
            {/* Outer wrapper anchored to the foot, then translated DOWN so
                the pattern's centre sits below the canvas. Rotated -32.1°
                per the Figma spec — the concentric squares inside inherit
                the tilt. */}
            <div
                className="absolute left-1/2 bottom-0"
                style={{
                    width: 800,
                    height: 800,
                    // Pushed further DOWN (client 2026-07-22) so the pattern
                    // sits lower — only the topmost chevron arcs rise above
                    // the foot of the canvas. Opacity dialled back a further
                    // 30% (client 2026-07-23) so the lines are a faint
                    // texture — 0.28→0.196.
                    transform: "translate(-50%, 52%) rotate(-32.1deg)",
                    opacity: 0.196,
                }}
            >
                {/* Masked content — the SVG mask is a radial fade from
                    centre so the outermost squares dissolve softly at
                    the edges. */}
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
                            className="absolute top-1/2 left-1/2"
                            style={{
                                width: size,
                                height: size,
                                borderWidth: 2.381,
                                borderStyle: "solid",
                                borderColor: "#7ba08c",
                                // Chunky corner radius so the rounded peaks
                                // read clearly on the visible chevron arcs.
                                // Scales with the square so smaller rings
                                // don't look pinched — client 2026-07-22.
                                borderRadius: Math.round(size * 0.18),
                                transform: "translate(-50%, -50%) rotate(-12.5deg)",
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
