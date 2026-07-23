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
    Copy03,
    Edit02,
    Check,
    XClose,
    ArrowNarrowRight,
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
import type { EntityKey } from "@/ai-agent/migration/entities";
import { applyImportToStore } from "@/ai-agent/migration/apply-import";
import type { User, UserRole } from "@/types";
import { Card } from "@/ai-agent/components/cards/Card";
import { MigCard, type MigActions } from "@/ai-agent/components/cards/MigCard";
import { TypingDots } from "@/ai-agent/components/TypingDots";
import { AiQuestionPrompt, type AiQuestionAnswer } from "@/ai-agent/components/AiQuestionPrompt";

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

/** Safety-net that strips any markdown the model still emits so the bubble
 *  reads as plain, human text — the prompt already forbids markdown, this
 *  catches leftovers (**bold**, __x__, `code`, ## headings, "- " bullets,
 *  and "--" dashes). */
function humanizeAgentText(s: string): string {
    return s
        .replace(/\*\*/g, "")            // bold markers
        .replace(/__/g, "")              // bold markers
        .replace(/`/g, "")               // inline-code ticks
        .replace(/^#{1,6}\s+/gm, "")     // ## headings → plain
        .replace(/^\s*[-*]\s+/gm, "")    // "- " / "* " bullets → plain
        .replace(/\s*--\s*/g, " — ")     // "--" → em dash
        .replace(/[ \t]{2,}/g, " ")      // collapse runs of spaces
        .trim();
}

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
        // Phase 11 — studio-setup counts:
        rooms:                   state.rooms,
        classCategories:         state.classCategories,
        memberships:             state.memberships,
        packages:                state.packages,
    };
}

/** SSR-safe read of a conversation's persisted chat history from `storageKey`.
 *  `null` (an ephemeral entry that has not become a conversation yet) hydrates
 *  empty and never persists. `typeof window` guard for static prerender. */
function loadPersistedMessages(storageKey: string | null): UIMessage[] {
    if (storageKey === null || typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(storageKey);
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
    chatId,
    storageKey = null,
    onFirstUserMessage,
}: {
    mode?: AiAgentMode;
    visible?: boolean;
    /** Stable, unique `useChat` id for THIS view (e.g. "entry:general:3" or
     *  "conv:abc"). Distinct per open conversation so the SDK never shares
     *  cached message state between two different chats. */
    chatId: string;
    /** localStorage key to hydrate + persist under. `null` = an ephemeral entry
     *  point: starts empty and is never persisted — until the parent adopts it
     *  into a Recents conversation and passes a real key (no remount). */
    storageKey?: string | null;
    /** Fired ONCE when the first user message lands in an ephemeral entry
     *  (`storageKey` was null). The parent turns that entry into a saved Recents
     *  conversation. Not passed for an already-saved conversation. */
    onFirstUserMessage?: (firstText: string) => void;
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
    const initialMessages = useRef<UIMessage[]>(loadPersistedMessages(storageKey));

    // Migration import applier — track which import_result cards we've already
    // written to the store so a card is applied exactly once. Seeded from the
    // HYDRATED history so a page reload never re-imports past commits.
    const appliedImportsRef = useRef<Set<string>>(
        new Set(
            initialMessages.current.flatMap((mm) =>
                (mm.toolInvocations ?? [])
                    .filter(
                        (ti) =>
                            ti.state === "result" &&
                            (ti.result as { card?: string } | undefined)?.card === "import_result",
                    )
                    .map((ti) => ti.toolCallId),
            ),
        ),
    );

    const {
        messages,
        input,
        setMessages,
        handleInputChange,
        handleSubmit,
        append,
        status,
        error,
        reload,
        stop,
    } = useChat({
        // Distinct id per OPEN conversation (not per mode) so switching between
        // Recents conversations never shares cached message state.
        id: chatId,
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
                // Send the attached upload in EVERY mode (the user can now
                // attach a file in general/studio chat too). Ref instead of
                // state so the freshest value is captured at request time
                // even if the closure was created earlier.
                parsedFile: parsedFileRef.current,
            };
            return body;
        },
    });

    const isBusy = status === "submitted" || status === "streaming";
    const empty = messages.length === 0;

    // Migration — when a confirmed `import_result` lands, write the rows into
    // the live store + drop a Migrations-module history row. Runs once per card
    // (appliedImportsRef guards re-runs, including across reloads). Only the
    // migration thread ever emits import_result, so this is inert elsewhere.
    useEffect(() => {
        if (mode !== "migration") return;
        for (const mm of messages) {
            if (mm.role !== "assistant" || !mm.toolInvocations) continue;
            for (const ti of mm.toolInvocations) {
                if (ti.state !== "result") continue;
                const res = ti.result as { card?: string; entity?: string } | undefined;
                if (res?.card !== "import_result" || !res.entity) continue;
                if (appliedImportsRef.current.has(ti.toolCallId)) continue;
                appliedImportsRef.current.add(ti.toolCallId);
                const st = useAppStore.getState();
                applyImportToStore(
                    res.entity as EntityKey,
                    parsedFileRef.current,
                    parsedFileRef.current?.filename ?? "Imported file.csv",
                    {
                        addCustomer: st.addCustomer,
                        addMembership: st.addMembership,
                        addPackage: st.addPackage,
                        addLead: st.addLead,
                        addClassTemplate: st.addClassTemplate,
                        addClassSchedule: st.addClassSchedule,
                        addGiftCardDesign: st.addGiftCardDesign,
                        addService: st.addService,
                        addRoom: st.addRoom,
                        addBranch: st.addBranch,
                        addStaff: st.addStaff,
                        addPromoCode: st.addPromoCode,
                        addPayRate: st.addPayRate,
                        addMarketingItem: st.addMarketingItem,
                        addTaxRate: st.addTaxRate,
                        addAgreement: st.addAgreement,
                        addAgreementVersion: st.addAgreementVersion,
                        addClassCategory: st.addClassCategory,
                        addCustomerPlan: st.addCustomerPlan,
                        addCustomerTransaction: st.addCustomerTransaction,
                        addImportedClassBooking: st.addImportedClassBooking,
                        customers: st.customers,
                        memberships: st.memberships,
                        packages: st.packages,
                        classSchedules: st.classSchedules,
                        classCategories: st.classCategories,
                        classTemplates: st.classTemplates,
                        instructors: st.instructors,
                        rooms: st.rooms,
                        branches: st.branches,
                        roles: st.roles,
                        addImportHistory: st.addImportHistory,
                        branchId: st.branches[0]?.id ?? "",
                    },
                );
            }
        }
    }, [messages, mode]);

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
        // Ephemeral entry (storageKey null) never persists — that is what keeps
        // the three entry points empty on refresh. A conversation persists under
        // its own key so Recents can reopen it.
        if (typeof window === "undefined" || storageKey === null) return;
        try {
            if (messages.length === 0) {
                window.localStorage.removeItem(storageKey);
            } else {
                window.localStorage.setItem(storageKey, JSON.stringify(messages));
            }
        } catch {
            // localStorage can throw (quota, disabled, private mode) —
            // swallow and continue; persistence is best-effort.
        }
    }, [messages, storageKey]);

    // First-message adoption — the moment an ephemeral entry gets its first user
    // message, tell the parent so it creates a Recents conversation. Fires once;
    // not wired for an already-saved conversation (no onFirstUserMessage passed).
    const firstMsgFiredRef = useRef(false);
    useEffect(() => {
        if (firstMsgFiredRef.current || !onFirstUserMessage) return;
        const firstUser = messages.find((m) => m.role === "user");
        if (!firstUser) return;
        firstMsgFiredRef.current = true;
        const text =
            typeof firstUser.content === "string" && firstUser.content.trim()
                ? firstUser.content.trim()
                : "New chat";
        onFirstUserMessage(text);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages]);

    // Migration audit-row hook: when the model's `commit_import` tool
    // returns a non-trivial result (any of created/skipped/failed > 0),
    // append a row to the Zustand `importHistory` slice so the row
    // appears at the top of /admin/settings/migrations-imports the next
    // time the admin visits. The set of recorded toolCallIds is
    // initialised from `initialMessages` — so a hydrated message from a
    // previous session (already recorded then) can't double-post.
    const recordedImportsRef = useRef<Set<string>>(new Set());
    // Seed the set on mount with every commit_import tool-call id that
    // already came in from localStorage — those were audit-logged in
    // their original session.
    useEffect(() => {
        if (mode !== "migration") return;
        for (const m of initialMessages.current) {
            if (m.role !== "assistant" || !m.toolInvocations) continue;
            for (const ti of m.toolInvocations) {
                if (
                    ti.state === "result" &&
                    ti.toolName === "commit_import"
                ) {
                    recordedImportsRef.current.add(ti.toolCallId);
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    useEffect(() => {
        if (mode !== "migration") return;
        const last = messages[messages.length - 1];
        if (!last || last.role !== "assistant" || !last.toolInvocations)
            return;
        for (const ti of last.toolInvocations) {
            if (
                ti.state !== "result" ||
                ti.toolName !== "commit_import" ||
                recordedImportsRef.current.has(ti.toolCallId)
            ) {
                continue;
            }
            const result = ti.result as {
                card?: string;
                entity?: string;
                created?: number;
                skipped?: number;
                failed?: number;
            };
            if (result?.card !== "import_result") continue;
            const created = result.created ?? 0;
            const skipped = result.skipped ?? 0;
            const failed = result.failed ?? 0;
            const totalRows = created + skipped + failed;
            if (totalRows === 0) {
                // Nothing meaningful happened — still mark as recorded
                // so we don't rescan the same invocation next render.
                recordedImportsRef.current.add(ti.toolCallId);
                continue;
            }
            const file = parsedFileRef.current;
            const state = useAppStore.getState();
            const branchId =
                (state.currentUser?.branch_id as string | undefined) ||
                state.branches[0]?.id ||
                "";
            const dataType = (result.entity ??
                "customers") as import("@/data/mock/_types").ImportHistorySeed["data_type"];
            const status: "imported" | "partial" | "failed" =
                failed === 0
                    ? "imported"
                    : created === 0
                      ? "failed"
                      : "partial";
            state.addImportHistory({
                data_type: dataType,
                file_name: file?.filename ?? "upload.csv",
                file_type: "csv",
                total_rows: totalRows,
                imported_rows: created,
                invalid_rows: failed,
                status,
                branch_id: branchId,
            });
            recordedImportsRef.current.add(ti.toolCallId);
        }
    }, [messages, mode]);


    const send = (text: string) => {
        if (!text.trim() || isBusy) return;
        append({ role: "user", content: text });
    };

    // Inline edit (Claude-style): editing a user message truncates the thread
    // back to just before it, then re-sends the edited text so the assistant
    // regenerates its answer from the new prompt. Only offered on the LAST
    // user message (see `lastUserId` below).
    const submitEdit = (messageId: string, nextText: string) => {
        const clean = nextText.trim();
        if (!clean || isBusy) return;
        const idx = messages.findIndex((mm) => mm.id === messageId);
        if (idx === -1) return;
        // Atomic swap so the typing indicator (which anchors below the LAST
        // user message) always lands under the freshly-edited bubble instead
        // of momentarily under a stale earlier message. Truncate + append the
        // new user message in ONE setMessages, then trigger reload so the
        // model regenerates from the new prompt.
        const editedUser: UIMessage = {
            id: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: "user",
            content: clean,
            parts: [{ type: "text", text: clean }],
        };
        setMessages([...messages.slice(0, idx), editedUser]);
        reload();
    };
    // The id of the most recent user message — the only one that's editable.
    const lastUserId = [...messages].reverse().find((mm) => mm.role === "user")?.id ?? null;

    // Pending ask_questions — when the LAST message is an assistant turn whose
    // tool result is a `questions` card, its options float above the composer.
    // Once the user answers (a new user message lands), this clears itself.
    const pendingQuestions = (() => {
        if (isBusy) return null;
        const last = messages[messages.length - 1];
        if (!last || last.role !== "assistant") return null;
        const ti = last.toolInvocations?.find(
            (t) => t.state === "result" && (t.result as InsightCard)?.card === "questions",
        );
        if (!ti || ti.state !== "result") return null;
        return ti.result as Extract<InsightCard, { card: "questions" }>;
    })();
    // Compose the picked answers into one readable reply and send it.
    const answerQuestions = (
        spec: Extract<InsightCard, { card: "questions" }>["questions"],
        answers: AiQuestionAnswer[],
    ) => {
        const parts = answers
            .map((a, i) => {
                if (a.kind === "option") {
                    const opt = spec[i]?.options.find((o) => o.id === a.optionId);
                    return opt ? `${spec[i].title}: ${opt.label}` : null;
                }
                if (a.kind === "other") return `${spec[i]?.title}: ${a.text}`;
                return null;
            })
            .filter((x): x is string => !!x);
        send(parts.join("\n") || "Skip");
    };

    const openUpload = () => fileInputRef.current?.click();

    async function uploadFile(file: File) {
        setUploadError(null);
        // Client 2026-07-23 — widen upload beyond CSV to images / PDFs / docs.
        // Non-CSV files skip the server parser (which only handles CSV) and
        // just attach as a chip with filename + size so the model has context.
        // The migration flow keeps its full CSV path (server-parsed rows so
        // inspect_source has real data).
        const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
        const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
        if (file.size > MAX_BYTES) {
            setUploadError(
                `File is too large — max ${MAX_BYTES / 1024 / 1024}MB.`,
            );
            return;
        }
        if (!isCsv) {
            // Attach-only path: no server call, just a chip. Empty `rows` and
            // `columns` mean the migration inspect flow won't try to parse it.
            const attached: ParsedFile = {
                fileId: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                filename: file.name,
                columns: [],
                rows: [],
            };
            setParsedFile(attached);
            parsedFileRef.current = attached;
            return;
        }
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
            // Client 2026-07-23 — every upload is now attach-only, in every
            // mode (including migration). The AI never starts generating on
            // its own; it waits for the user to type + press Send. This makes
            // the flow feel intentional (no surprise responses) and gives the
            // user room to ask a specific question about the file.
        } catch (e) {
            setUploadError(
                e instanceof Error ? e.message : "Upload failed unexpectedly.",
            );
        }
    }

    const act: MigActions = { send, openUpload };

    // Shared composer — centered in the empty hero, docked in a conversation.
    const composerNode = (
        <Composer
            mode={mode}
            value={input}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            onAttach={openUpload}
            isBusy={isBusy}
            onStop={stop}
            attachedFileName={parsedFile?.filename ?? null}
            onRemoveFile={() => setParsedFile(null)}
        />
    );

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
                accept=".csv,text/csv,image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                    e.target.value = "";
                }}
            />

            {/* Empty state (Figma 413:460177): composer is centered in the hero,
                between the subtext and the entry cards. Docks at the bottom once
                a conversation starts. */}
            {empty ? (
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                    {mode === "migration" ? (
                        <MigrationEmptyState onStart={send} composer={composerNode} query={input} />
                    ) : mode === "studio_setup" ? (
                        <StudioSetupEmptyState onStart={send} composer={composerNode} query={input} />
                    ) : (
                        <InsightEmptyState onSend={send} composer={composerNode} query={input} />
                    )}
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                    <div className="w-full max-w-[720px] mx-auto px-6 py-8 flex flex-col gap-6">
                        {messages.map((m) => (
                            <MessageRow
                                key={m.id}
                                message={m}
                                mode={mode}
                                act={act}
                                isLastUser={m.role === "user" && m.id === lastUserId && !isBusy}
                                onSubmitEdit={(text) => submitEdit(m.id, text)}
                            />
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
                </div>
            )}

            {/* Docked composer — live conversation only. Constrained to the
                720px chat column (client 2026-07-23) so the input aligns with
                the message list instead of spanning the full canvas. When the
                agent has asked a question, its options panel floats directly
                above the input, matching the same width. */}
            {!empty && (
                <div className="shrink-0 bg-transparent">
                    {pendingQuestions && (
                        <div className="w-full max-w-[720px] mx-auto px-6 pb-2">
                            <AiQuestionPrompt
                                compact
                                questions={pendingQuestions.questions}
                                onComplete={(answers) => answerQuestions(pendingQuestions.questions, answers)}
                            />
                        </div>
                    )}
                    <div className="w-full max-w-[720px] mx-auto px-6 py-4">{composerNode}</div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty states — Insight suggests capabilities; Migration promotes a start
// ─────────────────────────────────────────────────────────────────────────────

function InsightEmptyState({
    onSend,
    composer,
    query = "",
}: {
    onSend: (t: string) => void;
    composer: React.ReactNode;
    query?: string;
}) {
    return (
        // Vertically-centered hero. min-h-full so items-center centres it, yet
        // it can still scroll if the viewport is short.
        <div className="min-h-full w-full flex items-center justify-center px-6 py-12">
            {/* Container — Figma max-w-720, gap-32 (top block ↔ input block). */}
            <div className="w-full max-w-[720px] flex flex-col gap-8 items-center">
                {/* Top — orb + heading + subtext (Figma gap-16). */}
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

                {/* AI input block — composer, the typeahead suggestions (only
                    while typing), then the Create / Insight / Customer cards. */}
                <div className="flex flex-col gap-5 w-full">
                    <div className="relative w-full">
                        {composer}
                        <SuggestedPromptList prompts={SUGGESTED_PROMPTS.insight} onSend={onSend} query={query} />
                    </div>
                    {/* Entry cards — Create / Insight / Customer (row, gap-16). */}
                    <div className="flex gap-4 w-full">
                        <SuggestionCard
                            icon={PencilLine}
                            title="Create"
                            description="Set up new classes, plans, packs, and staff."
                            onClick={() => onSend("Show me every quick-create shortcut in admin.")}
                        />
                        <SuggestionCard
                            icon={Stars02}
                            title="Insight"
                            description="Get quick insights to help grow your studio."
                            onClick={() =>
                                onSend(
                                    "Give me a studio overview — revenue this month, active customers, top-selling plans.",
                                )
                            }
                        />
                        <SuggestionCard
                            icon={User01}
                            title="Customer"
                            description="Find customers and jump straight to their profile."
                            onClick={() =>
                                onSend(
                                    "Help me find a customer. Ask me for the name, email, or phone to search for.",
                                )
                            }
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function StudioSetupEmptyState({
    onStart,
    composer,
    query = "",
}: {
    onStart: (t: string) => void;
    composer: React.ReactNode;
    query?: string;
}) {
    return (
        <div className="min-h-full w-full flex items-center justify-center px-6 py-12">
            <div className="flex flex-col gap-6 items-center w-full max-w-[720px]">
                <ParticleOrb size={72} />
                <div className="flex flex-col gap-1 text-center w-full items-center max-w-[560px]">
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
                        Set up your studio
                    </h1>
                    <p className="text-[15px] leading-6 text-[#667085]">
                        I&apos;ll walk you through branches, rooms, classes,
                        memberships, and the rest — step by step. I can
                        also show you what&apos;s already configured.
                    </p>
                </div>
                {/* Composer + typeahead suggestions (floating, only while typing). */}
                <div className="relative w-full">
                    {composer}
                    <SuggestedPromptList prompts={SUGGESTED_PROMPTS.studio_setup} onSend={onStart} query={query} />
                </div>
            </div>
        </div>
    );
}

function MigrationEmptyState({
    onStart,
    composer,
    query = "",
}: {
    onStart: (t: string) => void;
    composer: React.ReactNode;
    query?: string;
}) {
    return (
        <div className="min-h-full w-full flex items-center justify-center px-6 py-12">
            <div className="flex flex-col gap-6 items-center w-full max-w-[720px]">
                <ParticleOrb size={72} />
                <div className="flex flex-col gap-1 text-center w-full items-center max-w-[560px]">
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
                        I&apos;ll guide you through importing your data from
                        another platform — step by step, using your actual
                        export. Attach a CSV any time with the paperclip.
                    </p>
                </div>
                {/* Composer + typeahead suggestions (floating, only while typing). */}
                <div className="relative w-full">
                    {composer}
                    <SuggestedPromptList prompts={SUGGESTED_PROMPTS.migration} onSend={onStart} query={query} />
                </div>
            </div>
        </div>
    );
}

/** A suggested starter prompt — a muted lead + an emphasised label, plus the
 *  full text sent when the row is clicked. */
interface SuggestedPrompt {
    lead: string;
    label: string;
    send: string;
}

/** Context-appropriate starter prompts per chat type (Figma 18841:8842). Each
 *  set fits its mode: analytics for insight, onboarding for studio setup, and
 *  import steps for migration. */
const SUGGESTED_PROMPTS: Record<AiAgentMode, SuggestedPrompt[]> = {
    insight: [
        { lead: "Show me", label: "the most popular classes this month", send: "Show me the most popular classes this month." },
        { lead: "Break down", label: "revenue by branch this month", send: "Break down revenue by branch this month." },
        { lead: "Show me", label: "which memberships are selling best", send: "Which memberships are selling best?" },
        { lead: "Find", label: "customers at risk of churning", send: "Find customers at risk of churning." },
        { lead: "Give me", label: "a studio overview for this month", send: "Give me a studio overview for this month — revenue, active customers, and top-selling plans." },
    ],
    studio_setup: [
        { lead: "Show me", label: "what's still missing in my setup", send: "What's still missing in my studio setup?" },
        { lead: "Help me", label: "add my first class template", send: "Help me add my first class template." },
        { lead: "Walk me through", label: "creating a membership plan", send: "Walk me through creating a membership plan." },
        { lead: "Set up", label: "my branches and rooms", send: "Help me set up my branches and rooms." },
        { lead: "Show me", label: "what's already configured", send: "Show me what's already configured in my studio." },
    ],
    migration: [
        { lead: "Import", label: "my customers from another platform", send: "I want to import my customers from another platform." },
        { lead: "Migrate", label: "my class schedule into Onra", send: "Help me migrate my class schedule into Onra." },
        { lead: "Help me", label: "map columns from my export file", send: "Help me map the columns from my export file." },
        { lead: "Show me", label: "which data I can import", send: "Which data can I import into Onra?" },
        { lead: "Start", label: "importing my customer list", send: "Start importing my customer list." },
    ],
};

/** Suggested-prompt list — Figma 18841:8842. A card of clickable starter
 *  prompts (arrow icon + lead + label). Hidden by default; it only appears
 *  once the user starts typing, as a live typeahead of the prompts whose
 *  lead+label match what they've typed. Empty input → nothing shown. */
function SuggestedPromptList({
    prompts,
    onSend,
    query = "",
}: {
    prompts: SuggestedPrompt[];
    onSend: (t: string) => void;
    query?: string;
}) {
    const q = query.trim().toLowerCase();
    // Nothing typed → don't show the box at all.
    if (!q) return null;
    const shown = prompts.filter((p) =>
        `${p.lead} ${p.label}`.toLowerCase().includes(q),
    );
    // Typing but no matches → hide rather than show an empty frame.
    if (shown.length === 0) return null;
    return (
        // Floating dropdown — absolutely positioned under the composer so it
        // overlays whatever is below (cards / buttons) instead of pushing the
        // layout taller. The parent wraps the composer in `relative`.
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 w-full bg-white border border-[#e4e7ec] rounded-[12px] overflow-hidden shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
            <div className="flex flex-col py-1">
                {shown.map((p, i) => (
                    <div key={i} className="px-1.5 py-0.5">
                        <button
                            type="button"
                            onClick={() => onSend(p.send)}
                            className="w-full flex items-center gap-3 pl-2 pr-2.5 py-1.5 rounded-[6px] text-left hover:bg-[#f9fafb] transition-colors"
                        >
                            <span className="shrink-0 size-6 flex items-center justify-center rounded-[6px] border border-[#e4e7ec] bg-white">
                                <ArrowNarrowRight className="size-3 text-[#667085]" />
                            </span>
                            <span className="flex-1 min-w-0 flex items-center gap-1 text-[14px] leading-5 truncate">
                                <span className="text-[#667085] font-normal">{p.lead}</span>
                                <span className="text-[#344054] font-medium truncate">{p.label}</span>
                            </span>
                        </button>
                    </div>
                ))}
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

/** User message bubble — Figma 18669:24877. Brand-200 (#c4edd6) fill,
 *  brand-300 (#aad4bd) border, tail notch on the top-right, right-aligned.
 *  On hover a copy + edit action pair reveals to the LEFT of the bubble.
 *  When `editable` (the LAST user message only, Claude-style), the edit icon
 *  turns the bubble into an inline textarea — saving resubmits the edited
 *  prompt and regenerates the answer. */
function UserMessageBubble({
    text,
    editable = false,
    onSubmitEdit,
}: {
    text: string;
    editable?: boolean;
    onSubmitEdit?: (t: string) => void;
}) {
    const [copied, setCopied] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(text);
    const editRef = useRef<HTMLTextAreaElement>(null);

    // When edit mode starts, focus the textarea AND park the caret at the end
    // (autoFocus alone puts it at index 0). Runs only on the editing→true edge.
    useEffect(() => {
        if (!editing) return;
        const el = editRef.current;
        if (!el) return;
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
    }, [editing]);

    const copy = () => {
        try {
            navigator.clipboard?.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard unavailable — no-op */
        }
    };

    const startEdit = () => {
        setDraft(text);
        setEditing(true);
    };
    const cancelEdit = () => {
        setDraft(text);
        setEditing(false);
    };
    const saveEdit = () => {
        const clean = draft.trim();
        if (!clean) return;
        setEditing(false);
        if (clean !== text) onSubmitEdit?.(clean);
    };

    // ── Editing state — inline textarea styled as the bubble, with the
    //    Cancel / Send actions sitting OUTSIDE (below) the bubble. ─────────────
    if (editing) {
        return (
            // Full column-width edit surface (client 2026-07-23): the bubble
            // stretches to the chat column instead of the narrow 400/520 read
            // width, so long prompts don't wrap awkwardly during editing.
            <div className="w-full flex flex-col items-end gap-2">
                <div
                    className={cn(
                        "w-full p-4 flex",
                        "bg-[#c4edd6] border border-[#aad4bd]",
                        "rounded-tl-[16px] rounded-bl-[16px] rounded-br-[16px] rounded-tr-[2px]",
                        "shadow-[0px_1px_1px_0px_rgba(16,24,40,0.05)]",
                    )}
                >
                    <textarea
                        ref={editRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                saveEdit();
                            } else if (e.key === "Escape") {
                                cancelEdit();
                            }
                        }}
                        rows={Math.min(6, Math.max(1, draft.split("\n").length))}
                        className="w-full resize-none bg-transparent text-[14px] font-medium leading-5 text-[#344054] outline-none placeholder:text-[#658774]"
                    />
                </div>
                {/* Actions live outside the bubble — icon-only. */}
                <div className="flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={cancelEdit}
                        aria-label="Cancel edit"
                        className="size-9 flex items-center justify-center rounded-[8px] text-[#344054] bg-white border border-[#d0d5dd] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors"
                    >
                        <XClose className="size-5" />
                    </button>
                    <button
                        type="button"
                        onClick={saveEdit}
                        disabled={!draft.trim()}
                        aria-label="Send edit"
                        className="size-9 flex items-center justify-center rounded-[8px] text-white bg-[#658774] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-[#577665] disabled:opacity-50 transition-colors"
                    >
                        <Send03 className="size-5" />
                    </button>
                </div>
            </div>
        );
    }

    // ── Default state — bubble + hover actions ────────────────────────────────
    return (
        <div className="group flex items-end justify-end gap-2">
            <div className="flex items-center gap-4 self-center opacity-0 transition-opacity group-hover:opacity-100">
                <button
                    type="button"
                    onClick={copy}
                    aria-label={copied ? "Copied" : "Copy message"}
                    className="text-[#667085] hover:text-[#344054] transition-colors"
                >
                    {copied ? <Check className="size-5 text-[#658774]" /> : <Copy03 className="size-5" />}
                </button>
                {editable && onSubmitEdit && (
                    <button
                        type="button"
                        onClick={startEdit}
                        aria-label="Edit message"
                        className="text-[#667085] hover:text-[#344054] transition-colors"
                    >
                        <Edit02 className="size-5" />
                    </button>
                )}
            </div>
            <div
                className={cn(
                    "min-h-[56px] max-w-[400px] p-4 flex items-center",
                    "bg-[#c4edd6] border border-[#aad4bd]",
                    "rounded-tl-[16px] rounded-bl-[16px] rounded-br-[16px] rounded-tr-[2px]",
                    "shadow-[0px_1px_1px_0px_rgba(16,24,40,0.05)]",
                )}
            >
                <p className="text-[14px] font-medium leading-5 text-[#344054] whitespace-pre-wrap [word-break:break-word]">
                    {text}
                </p>
            </div>
        </div>
    );
}

/** Compact step card shown in the assistant bubble for an ask_questions call —
 *  a "N of M step" badge, a title, and a message. The interactive options live
 *  in the panel that floats above the composer, not here. */
function QuestionStepCard({
    data,
}: {
    data: Extract<InsightCard, { card: "questions" }>;
}) {
    return (
        <div className="w-full max-w-[560px] bg-white border border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-1.5">
            {data.stepLabel && (
                <span className="self-start inline-flex items-center px-[10px] py-[2px] rounded-full text-[12px] font-medium border-1 border-[#aad4bd] bg-[#eafaf1] text-[#3f6350]">
                    {data.stepLabel}
                </span>
            )}
            {data.title && (
                <p className="text-[16px] font-semibold text-[#101828] leading-6">
                    {humanizeAgentText(data.title)}
                </p>
            )}
            {data.message && (
                <p className="text-[14px] text-[#475467] leading-5">
                    {humanizeAgentText(data.message)}
                </p>
            )}
        </div>
    );
}

function MessageRow({
    message: m,
    mode,
    act,
    isLastUser = false,
    onSubmitEdit,
}: {
    message: UIMessage;
    mode: AiAgentMode;
    act: MigActions;
    /** True only for the most recent user message — the one that can be
     *  edited inline (Claude-style). */
    isLastUser?: boolean;
    onSubmitEdit?: (text: string) => void;
}) {
    if (m.role === "user") {
        return <UserMessageBubble text={m.content} editable={isLastUser} onSubmitEdit={onSubmitEdit} />;
    }

    if (m.role === "assistant") {
        return (
            <div className="flex items-start gap-3">
                <AssistantAvatar />
                <div className="flex-1 min-w-0 flex flex-col gap-3">
                    {/* Tool invocations render as cards. The ask_questions tool
                        renders the interactive popup in EVERY mode (checked
                        first); otherwise migration results go through MigCard
                        and insight results through Card. */}
                    {m.toolInvocations?.map((ti) => {
                        if (ti.state !== "result") {
                            return (
                                <TypingDots
                                    key={ti.toolCallId}
                                    label={mode === "migration" ? "Reading" : "Working"}
                                />
                            );
                        }
                        const result = ti.result as InsightCard | MigrationCard;
                        if ((result as InsightCard).card === "questions") {
                            // In the bubble we only show a compact step card
                            // (badge + title + message). The interactive options
                            // float above the composer (see PendingQuestionPanel).
                            const qc = result as Extract<InsightCard, { card: "questions" }>;
                            return <QuestionStepCard key={ti.toolCallId} data={qc} />;
                        }
                        return mode === "migration" ? (
                            <MigCard key={ti.toolCallId} data={result as MigrationCard} act={act} />
                        ) : (
                            <Card key={ti.toolCallId} data={result as InsightCard} />
                        );
                    })}
                    {/* Free-text response (interpretation line under a card,
                        or a plain-text answer when no tool was called).
                        Sanitised so any stray markdown reads as plain text. */}
                    {m.content && (
                        <div className="text-[14px] text-[#344054] leading-6 whitespace-pre-wrap">
                            {humanizeAgentText(m.content)}
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
    isBusy,
    onStop,
    attachedFileName = null,
    onRemoveFile,
}: {
    mode: AiAgentMode;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    onAttach: () => void;
    isBusy: boolean;
    onStop: () => void;
    /** Filename of the currently-attached upload (migration mode). When set,
     *  a removable file chip shows above the input and the border turns
     *  brand-green — Figma 18716:5616 "Added file" state. */
    attachedFileName?: string | null;
    onRemoveFile?: () => void;
}) {
    const canSend = value.trim().length > 0 && !isBusy;
    // Attach a file in EVERY mode (client 2026-07-22) — the paperclip used to
    // be migration-only, which read as "broken" in general/studio chat.
    const attachActive = true;
    const hasFile = !!attachedFileName;
    // Skeuomorphic inner border + inner shadow (Figma shadow-xs-skeuomorphic).
    const SKEUO =
        "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)]";
    return (
        // Answer field (Figma 405:455839 / 18716:5616): p-10, rounded-12,
        // shadow-xl. Border is #d0d5dd normally, brand-green (border-2) once a
        // file is attached; focus also turns it green with a soft ring.
        <form
            onSubmit={onSubmit}
            className={cn(
                "flex flex-col gap-3 p-2.5 bg-white rounded-xl transition-colors",
                "shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]",
                hasFile
                    ? "border-2 border-[#7ba08c]"
                    : "border border-[#d0d5dd] focus-within:border-[#7ba08c] focus-within:ring-4 focus-within:ring-[#7ba08c]/[0.12]",
            )}
        >
            {/* File chip row — Figma 18716:5616 "Added file". Only the CSV
                upload the migration flow supports is shown. */}
            {hasFile && (
                <div className="flex flex-wrap items-start gap-3">
                    <FileChip name={attachedFileName as string} onRemove={onRemoveFile} />
                </div>
            )}

            <div className="flex items-center justify-between gap-2">
            {/* Left: attach + input. */}
            <div className="flex flex-1 min-w-0 items-center gap-2">
                <button
                    type="button"
                    aria-label={attachActive ? "Upload CSV" : "Attach file (not available)"}
                    onClick={attachActive ? onAttach : undefined}
                    disabled={!attachActive}
                    className={cn(
                        "size-9 flex-shrink-0 flex items-center justify-center rounded-lg",
                        "bg-white border border-[#d0d5dd] text-[#344054]",
                        SKEUO,
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
                    placeholder={mode === "migration" ? "Reply, or attach a CSV…" : "Ask me anything"}
                    className="flex-1 min-w-0 h-9 px-1 text-[16px] text-[#101828] placeholder:text-[#667085] bg-transparent outline-none leading-6"
                    style={{ fontFamily: DM_SANS_STACK }}
                />
            </div>

            {/* Right: Send → Stop while generating (Figma answer-field states). */}
            {isBusy ? (
                <button
                    type="button"
                    aria-label="Stop generating"
                    onClick={onStop}
                    className={cn(
                        "size-9 flex-shrink-0 flex items-center justify-center rounded-lg",
                        "bg-[#c4edd6] text-[#0c2d34] border-2 border-white/[0.12]",
                        SKEUO,
                        "hover:bg-[#aad4bd] transition-colors",
                    )}
                >
                    <span className="size-3.5 rounded-[4px] border-2 border-current" aria-hidden />
                </button>
            ) : (
                <button
                    type="submit"
                    aria-label="Send"
                    disabled={!canSend}
                    className={cn(
                        "size-9 flex-shrink-0 flex items-center justify-center rounded-lg",
                        "bg-[#c4edd6] text-[#0c2d34] border-2 border-white/[0.12]",
                        SKEUO,
                        "hover:bg-[#aad4bd] transition-colors",
                        "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-[#c4edd6]",
                    )}
                >
                    <Send03 className="size-5" />
                </button>
            )}
            </div>
        </form>
    );
}

/** Uploaded-file chip — Figma 18716:6902. A page icon with a green "CSV"
 *  badge, the filename, and a removable X in the top-right corner. */
function FileChip({ name, onRemove }: { name: string; onRemove?: () => void }) {
    return (
        <div className="relative flex items-center gap-3 pl-4 pr-6 py-3 bg-white border border-[#e4e7ec] rounded-[12px] max-w-[240px]">
            {/* File-type icon — a document sheet with a CSV badge. */}
            <div className="relative size-6 shrink-0">
                <div className="absolute inset-0 rounded-[3px] border border-[#e4e7ec] bg-[#f9fafb]" />
                <span className="absolute left-[2px] bottom-[3px] px-[3px] py-[1px] rounded-[2px] bg-[#079455] text-white text-[6px] font-bold leading-none tracking-wide">
                    CSV
                </span>
            </div>
            <p className="min-w-0 truncate text-[14px] font-medium leading-5 text-[#344054]">{name}</p>
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label="Remove file"
                    className="absolute top-[7px] right-[7px] size-4 flex items-center justify-center rounded-full bg-[#f2f4f7] hover:bg-[#e4e7ec] transition-colors"
                >
                    <XClose className="size-3 text-[#667085]" />
                </button>
            )}
        </div>
    );
}
