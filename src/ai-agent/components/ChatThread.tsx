// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · ChatThread (Phase 7 — mode-aware: insight + migration)
// ─────────────────────────────────────────────────────────────────────────────
//
// The live chat pane. Owns the whole right-side content area (empty state
// AND message list AND composer) so the composer's state stays tied to the
// message list without prop drilling. Mirrors the shape of
// ONRA AI-Agent/components/ChatThread.tsx.
//
// Two instances are mounted (one per mode — see AiAgentPage.tsx); only the
// active one is visible. The thread IS the mode, and each thread keeps
// its own message history via useChat's `id` prop.
//
// Behaviour by mode:
//   • "insight"   — analytics chat. Composer's paperclip is inert. Empty
//                   state shows Create/Insight/Customer suggestion cards.
//                   Tool results render as Card (metric group / bar chart
//                   / line chart / donut / data table / export).
//   • "migration" — 4-step wizard. Composer's paperclip opens a hidden
//                   <input type=file accept=".csv"> and, on pick, POSTs
//                   the file to /api/ai-agent/upload. The parsed file is
//                   kept in local React state and sent in every
//                   subsequent chat POST body (stateless server —
//                   Phase 7 architecture note in the plan doc). Empty
//                   state shows a "Migrate your data" heading + "Start
//                   migration" button. Tool results render as MigCard.

"use client";

import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { UIMessage } from "@ai-sdk/ui-utils";
import { useChat } from "@ai-sdk/react";
import {
    Attachment01,
    Send03,
    PencilLine,
    Stars02,
    User01,
    AlertCircle,
    RefreshCw01,
    UploadCloud02,
} from "@untitledui/icons";
import Image from "next/image";
import { useAppStore, type AppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { InsightCard } from "@/ai-agent/agent/cards";
import type {
    AiAgentStateSnapshot,
    AiAgentMode,
} from "@/ai-agent/types/request";
import type {
    MigrationCard,
    ParsedFile,
} from "@/ai-agent/migration/migration-cards";
import type { User, UserRole } from "@/types";
import { Card } from "@/ai-agent/components/cards/Card";
import { MigCard, type MigActions } from "@/ai-agent/components/cards/MigCard";
import { TypingDots } from "@/ai-agent/components/TypingDots";

// three.js is ~600KB — dynamic import so it only ships when the empty
// state is actually rendered (i.e. before the user's first message).
// `ssr: false` avoids "document is not defined" during prerender.
const ParticleOrb = dynamic(
    () =>
        import("@/ai-agent/components/ParticleOrb").then((m) => m.ParticleOrb),
    {
        ssr: false,
        loading: () => <div aria-hidden className="size-[72px]" />,
    },
);

const DM_SANS_STACK =
    "var(--font-brand-dm-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/** Snapshot exactly the store slices `buildCatalog` reads. Any wider and
 *  the request payload balloons for nothing; any narrower and the server
 *  can't build the catalog. Kept in sync with
 *  src/ai-agent/types/request.ts `AiAgentStateSnapshot`.
 *
 *  Phase 8: +5 slices (appointments, services, walletTransactions,
 *  payrollEntries, promoCodes). Payload grows a few KB per request but
 *  still well under any practical limit. */
function pickStoreSnapshot(state: AppState): AiAgentStateSnapshot {
    return {
        branches:                state.branches,
        customers:               state.customers,
        customerTransactions:    state.customerTransactions,
        classSchedules:          state.classSchedules,
        classBookings:           state.classBookings,
        classTemplates:          state.classTemplates,
        instructors:             state.instructors,
        leads:                   state.leads,
        marketingCampaignStats:  state.marketingCampaignStats,
        marketingSpend:          state.marketingSpend,
        // Phase 8:
        appointments:            state.appointments,
        services:                state.services,
        walletTransactions:      state.walletTransactions,
        payrollEntries:          state.payrollEntries,
        promoCodes:              state.promoCodes,
    };
}

/** localStorage key for a thread's persisted chat history. One key per
 *  mode so Insight + Migration histories don't collide. Bumped when the
 *  message shape changes to force a clean reseed. */
const CHAT_HISTORY_KEY = (mode: AiAgentMode) =>
    `onra-ai-agent-messages-v1-${mode}`;

/** SSR-safe read of the persisted chat history. `typeof window` guard
 *  because Next.js will call this during static prerender. */
function loadPersistedMessages(mode: AiAgentMode): UIMessage[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(CHAT_HISTORY_KEY(mode));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
    } catch {
        return [];
    }
}

export function ChatThread({
    mode = "insight",
    visible = true,
}: {
    mode?: AiAgentMode;
    /** Two ChatThreads stay mounted (one per mode) so each keeps its own
     *  history when the user switches threads. Only the active one is
     *  visible. */
    visible?: boolean;
}) {
    const currentUser = useAppStore((s) => s.currentUser);
    const currentRole = useAppStore((s) => s.currentRole);

    // Migration only — the parsed CSV lives in local state and travels
    // with every request. Persisting to Zustand would put a fat blob in
    // localStorage; not worth it for a session-scoped upload.
    const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
    const parsedFileRef = useRef<ParsedFile | null>(null);
    parsedFileRef.current = parsedFile;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Phase 10 — persist chat history to localStorage per thread. Hydrate
    // ONCE on mount (initialMessages is a stable snapshot); the persist
    // effect below writes on every change.
    const initialMessages = useRef<UIMessage[]>(loadPersistedMessages(mode));

    const {
        messages,
        input,
        handleInputChange,
        handleSubmit,
        append,
        status,
        error,
        reload,
    } = useChat({
        // Distinct id per mode → two mounted instances, two histories.
        id: `onra-agent-${mode}`,
        api: "/api/ai-agent",
        initialMessages: initialMessages.current,
        maxSteps: 3, // matches AI_AGENT_MAX_STEPS in flags.ts (Hobby 10s cap)
        // Per-request body: grab a fresh Zustand snapshot every time so the
        // model sees whatever the admin just created/edited seconds ago.
        // Also carries `mode` + (for migration) the current `parsedFile`.
        experimental_prepareRequestBody: ({ messages: msgs }) => {
            const state = useAppStore.getState();
            const body = {
                messages: msgs,
                context: {
                    user: currentUser as User,
                    role: currentRole as UserRole,
                },
                storeSnapshot: pickStoreSnapshot(state),
                mode,
                // parsedFile is only meaningful for migration; server
                // ignores it for insight mode. Ref instead of state so
                // the freshest value is captured at request time even if
                // the closure was created earlier.
                parsedFile:
                    mode === "migration" ? parsedFileRef.current : null,
            };
            return body;
        },
    });

    const isBusy = status === "submitted" || status === "streaming";
    const empty = messages.length === 0;

    const endRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (visible) {
            endRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, visible]);

    // Persist chat history to localStorage on every messages change so a
    // refresh returns the tester to the same conversation — matches
    // Syncfit's demo-persistence convention (see CLAUDE.md § Demo State
    // Persistence). Skipped when messages is empty to avoid writing an
    // empty array on mount before hydration completes.
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            if (messages.length === 0) {
                window.localStorage.removeItem(CHAT_HISTORY_KEY(mode));
            } else {
                window.localStorage.setItem(
                    CHAT_HISTORY_KEY(mode),
                    JSON.stringify(messages),
                );
            }
        } catch {
            // localStorage can throw (quota, disabled, private mode) —
            // swallow and continue; persistence is best-effort.
        }
    }, [messages, mode]);


    const send = (text: string) => {
        if (!text.trim() || isBusy) return;
        append({ role: "user", content: text });
    };

    const openUpload = () => fileInputRef.current?.click();

    async function uploadFile(file: File) {
        setUploadError(null);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("role", currentRole ?? "");
        try {
            const res = await fetch("/api/ai-agent/upload", {
                method: "POST",
                body: fd,
            });
            if (!res.ok) {
                const { error: msg } = (await res.json().catch(() => ({}))) as {
                    error?: string;
                };
                setUploadError(msg ?? `Upload failed (${res.status}).`);
                return;
            }
            const parsed = (await res.json()) as ParsedFile;
            setParsedFile(parsed);
            parsedFileRef.current = parsed;
            send(
                `I've uploaded my customer file (${parsed.filename}, ${parsed.rows.length} rows). Please inspect it.`,
            );
        } catch (e) {
            setUploadError(
                e instanceof Error ? e.message : "Upload failed unexpectedly.",
            );
        }
    }

    const act: MigActions = { send, openUpload };

    return (
        <div
            className="relative h-full flex flex-col"
            style={{
                fontFamily: DM_SANS_STACK,
                display: visible ? "flex" : "none",
            }}
        >
            {/* Hidden file input — only used in migration mode. Kept
                mounted in both modes so the DOM shape is consistent. */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                    e.target.value = "";
                }}
            />

            {/* Scrolling message region takes remaining height. Composer
                docks at the bottom outside the scroll. */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {empty ? (
                    mode === "migration" ? (
                        <MigrationEmptyState onStart={send} />
                    ) : (
                        <InsightEmptyState onSend={send} />
                    )
                ) : (
                    <div className="w-full max-w-[720px] mx-auto px-6 py-8 flex flex-col gap-6">
                        {messages.map((m) => (
                            <MessageRow key={m.id} message={m} mode={mode} act={act} />
                        ))}
                        {isBusy && messages[messages.length - 1]?.role === "user" && (
                            <div className="flex items-start gap-3">
                                <AssistantAvatar />
                                <TypingDots />
                            </div>
                        )}
                        {/* Error banner — visible on 400/403/500 from
                            /api/ai-agent. Includes a Retry button so the
                            user can re-run without retyping. */}
                        {error && !isBusy && (
                            <ErrorBanner
                                message={error.message}
                                onRetry={() => reload()}
                            />
                        )}
                        {uploadError && (
                            <ErrorBanner
                                message={uploadError}
                                onRetry={openUpload}
                                retryLabel="Try again"
                            />
                        )}
                        <div ref={endRef} />
                    </div>
                )}
            </div>

            {/* Composer — docked at the bottom, always visible. */}
            <div className="shrink-0 border-t border-[#eaecf0] bg-white/80 backdrop-blur-sm">
                <div className="w-full max-w-[720px] mx-auto px-6 py-4">
                    <Composer
                        mode={mode}
                        value={input}
                        onChange={handleInputChange}
                        onSubmit={handleSubmit}
                        onAttach={openUpload}
                        disabled={isBusy}
                    />
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty states — Insight suggests capabilities; Migration promotes a start
// ─────────────────────────────────────────────────────────────────────────────

function InsightEmptyState({ onSend }: { onSend: (t: string) => void }) {
    return (
        <div className="w-full max-w-[720px] mx-auto px-6 h-full flex items-center justify-center py-12">
            <div className="flex flex-col gap-8 items-center w-full">
                {/* Orb + copy */}
                <div className="flex flex-col gap-4 items-center w-full">
                    <ParticleOrb size={72} />
                    <div className="flex flex-col gap-1 text-center w-full items-center">
                        <h1
                            className="text-[36px] font-semibold leading-[44px] tracking-[-0.72px] inline-block"
                            style={{
                                fontFamily: DM_SANS_STACK,
                                backgroundImage:
                                    "linear-gradient(90deg, #658774 0%, #7ba08c 100%)",
                                WebkitBackgroundClip: "text",
                                backgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                color: "transparent",
                            }}
                        >
                            How can I assist you today?
                        </h1>
                        <p className="text-[16px] leading-6 text-[#667085]">
                            Manage bookings, customers, and schedules with ease.
                        </p>
                    </div>
                </div>

                {/* Suggestion cards */}
                <div className="flex gap-4 w-full">
                    <SuggestionCard
                        icon={PencilLine}
                        title="Create"
                        description="Set up new classes, plans, packs, and staff."
                        onClick={() =>
                            onSend(
                                "What can I create in the studio — walk me through classes, plans, packs, and staff.",
                            )
                        }
                    />
                    <SuggestionCard
                        icon={Stars02}
                        title="Insight"
                        description="Get quick insights to help grow your studio."
                        onClick={() =>
                            onSend(
                                "Give me a studio overview — revenue this month, active members, top-selling plans.",
                            )
                        }
                    />
                    <SuggestionCard
                        icon={User01}
                        title="Customer"
                        description="Find customers and handle refunds or credits."
                        onClick={() =>
                            onSend(
                                "Who are the customers at churn risk right now?",
                            )
                        }
                    />
                </div>
            </div>
        </div>
    );
}

function MigrationEmptyState({ onStart }: { onStart: (t: string) => void }) {
    return (
        <div className="w-full max-w-[560px] mx-auto px-6 h-full flex items-center justify-center py-12">
            <div className="flex flex-col gap-6 items-center w-full">
                <ParticleOrb size={72} />
                <div className="flex flex-col gap-1 text-center w-full items-center">
                    <h1
                        className="text-[36px] font-semibold leading-[44px] tracking-[-0.72px] inline-block"
                        style={{
                            fontFamily: DM_SANS_STACK,
                            backgroundImage:
                                "linear-gradient(90deg, #658774 0%, #7ba08c 100%)",
                            WebkitBackgroundClip: "text",
                            backgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            color: "transparent",
                        }}
                    >
                        Migrate your data
                    </h1>
                    <p className="text-[15px] leading-6 text-[#667085]">
                        I&apos;ll guide you through importing your customers
                        from another platform — step by step, using your
                        actual export.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() =>
                        onStart("I want to migrate my customer data into Onra.")
                    }
                    className={cn(
                        "h-10 px-4 rounded-md inline-flex items-center gap-2",
                        "bg-[#c4edd6] text-[#0c2d34] text-[14px] font-medium border-1 border-white/[0.12]",
                        "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)]",
                        "hover:bg-[#aad4bd] transition-colors",
                    )}
                >
                    <UploadCloud02 className="size-4" />
                    Start migration
                </button>
            </div>
        </div>
    );
}

function SuggestionCard({
    icon: Icon,
    title,
    description,
    onClick,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex-1 min-w-0 p-4 rounded-xl text-left",
                "bg-white border border-[#e4e7ec]",
                "shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]",
                "hover:border-[#d0d5dd] hover:shadow-[0px_16px_20px_-4px_rgba(16,24,40,0.12),0px_6px_8px_-2px_rgba(16,24,40,0.04)] transition-all",
            )}
        >
            <div className="flex flex-col gap-2 items-start">
                <div
                    className={cn(
                        "size-8 flex items-center justify-center rounded-[6px]",
                        "bg-white border border-[#e4e7ec]",
                        "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)]",
                    )}
                >
                    <Icon className="size-4 text-[#344054]" />
                </div>
                <div className="flex flex-col w-full">
                    <span className="text-[14px] font-medium leading-5 text-[#344054]">
                        {title}
                    </span>
                    <span className="text-[14px] leading-5 text-[#475467]">
                        {description}
                    </span>
                </div>
            </div>
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message rendering
// ─────────────────────────────────────────────────────────────────────────────

function MessageRow({
    message: m,
    mode,
    act,
}: {
    message: UIMessage;
    mode: AiAgentMode;
    act: MigActions;
}) {
    if (m.role === "user") {
        return (
            <div className="flex items-start justify-end gap-3">
                <div
                    className={cn(
                        "max-w-[78%] px-4 py-2.5 rounded-xl",
                        "bg-[#c4edd6] text-[#101828] text-[14px] leading-6 whitespace-pre-wrap",
                    )}
                >
                    {m.content}
                </div>
            </div>
        );
    }

    if (m.role === "assistant") {
        return (
            <div className="flex items-start gap-3">
                <AssistantAvatar />
                <div className="flex-1 min-w-0 flex flex-col gap-3">
                    {/* Tool invocations render as cards. Migration tool
                        results go through MigCard (with action callbacks);
                        insight tool results go through Card. */}
                    {m.toolInvocations?.map((ti) =>
                        ti.state === "result" ? (
                            mode === "migration" ? (
                                <MigCard
                                    key={ti.toolCallId}
                                    data={ti.result as MigrationCard}
                                    act={act}
                                />
                            ) : (
                                <Card
                                    key={ti.toolCallId}
                                    data={ti.result as InsightCard}
                                />
                            )
                        ) : (
                            <TypingDots
                                key={ti.toolCallId}
                                label={
                                    mode === "migration" ? "Reading" : "Working"
                                }
                            />
                        ),
                    )}
                    {/* Free-text response (interpretation line under a card,
                        or a plain-text answer when no tool was called) */}
                    {m.content && (
                        <div className="text-[14px] text-[#344054] leading-6 whitespace-pre-wrap">
                            {m.content}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}

function ErrorBanner({
    message,
    onRetry,
    retryLabel = "Retry",
}: {
    message: string;
    onRetry: () => void;
    retryLabel?: string;
}) {
    // Trim the raw error to something a client can read. Server responses
    // like "AI Agent is admin-only." pass through; server timeouts show as
    // "Failed to fetch" — surface a friendlier line for those.
    const friendly = /failed to fetch|network/i.test(message)
        ? "Network hiccup — the assistant couldn't reach the server."
        : message.trim();
    return (
        <div
            role="alert"
            className={cn(
                "flex items-start gap-3 p-3 rounded-lg",
                "bg-[#fef3f2] border border-[#fecdca]",
            )}
        >
            <AlertCircle className="size-5 text-[#b42318] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-[#b42318] leading-5">
                    Something went wrong
                </div>
                <div className="text-[13px] text-[#7a271a] leading-5 break-words">
                    {friendly}
                </div>
            </div>
            <button
                type="button"
                onClick={onRetry}
                className={cn(
                    "shrink-0 h-8 px-3 inline-flex items-center gap-1.5 rounded-md",
                    "bg-white text-[#344054] text-[13px] font-medium border border-[#d0d5dd]",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                    "hover:bg-[#f9fafb] transition-colors",
                )}
            >
                <RefreshCw01 className="size-3.5" />
                {retryLabel}
            </button>
        </div>
    );
}

function AssistantAvatar() {
    return (
        <div className="size-8 shrink-0 rounded-[8px] border border-[#d0d5dd] bg-white flex items-center justify-center shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden">
            <Image
                src="/Logomark.webp"
                alt="Onra"
                width={22}
                height={22}
                className="block object-contain"
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composer — attachment (active in migration mode), input, send
// ─────────────────────────────────────────────────────────────────────────────

function Composer({
    mode,
    value,
    onChange,
    onSubmit,
    onAttach,
    disabled,
}: {
    mode: AiAgentMode;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    onAttach: () => void;
    disabled: boolean;
}) {
    const canSend = value.trim().length > 0 && !disabled;
    const attachActive = mode === "migration";
    return (
        <form
            onSubmit={onSubmit}
            className={cn(
                "flex items-center gap-2 p-2.5 bg-white border border-[#d0d5dd] rounded-xl",
                "shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]",
            )}
        >
            {/* Attachment. Active in migration mode (opens the file picker
                for a CSV upload). Inert in insight mode — kept in the
                layout so composer geometry doesn't shift between threads. */}
            <button
                type="button"
                aria-label={
                    attachActive ? "Upload CSV" : "Attach file (not available)"
                }
                onClick={attachActive ? onAttach : undefined}
                disabled={!attachActive || disabled}
                className={cn(
                    "size-9 flex-shrink-0 flex items-center justify-center rounded-md",
                    "bg-white border border-[#d0d5dd] text-[#344054]",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                    attachActive
                        ? "hover:bg-[#f9fafb] transition-colors"
                        : "disabled:opacity-60 disabled:cursor-not-allowed",
                )}
            >
                <Attachment01 className="size-5" />
            </button>

            <input
                value={value}
                onChange={onChange}
                placeholder={
                    mode === "migration"
                        ? "Reply, or attach a CSV…"
                        : "Ask me anything"
                }
                disabled={disabled}
                className="flex-1 min-w-0 h-9 px-2 text-[16px] text-[#101828] placeholder:text-[#667085] bg-transparent outline-none leading-6 disabled:opacity-70"
                style={{ fontFamily: DM_SANS_STACK }}
            />

            <button
                type="submit"
                aria-label="Send"
                disabled={!canSend}
                className={cn(
                    "size-9 flex-shrink-0 flex items-center justify-center rounded-md",
                    "bg-[#c4edd6] text-[#0c2d34] border-1 border-white/[0.12]",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)]",
                    "hover:bg-[#aad4bd] transition-colors",
                    "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-[#c4edd6]",
                )}
            >
                <Send03 className="size-5" />
            </button>
        </form>
    );
}
