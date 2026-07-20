// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · ChatThread (Phase 5)
// ─────────────────────────────────────────────────────────────────────────────
//
// The live chat pane. Owns the whole right-side content area (empty state
// AND message list AND composer) so the composer's state stays tied to the
// message list without prop drilling. Mirrors the shape of
// ONRA AI-Agent/components/ChatThread.tsx.
//
// Key differences from the POC:
//
// 1. Points at `/api/ai-agent` (not `/api/agent` — namespaced route per
//    the plan doc).
//
// 2. Uses `experimental_prepareRequestBody` from useChat to snapshot the
//    client's Zustand store at request time and stuff it in the POST
//    body. Syncfit's store is marked "use client" — the server can't
//    call getState(), so the client MUST carry the snapshot per request
//    (see Phase 2 constraint note in the plan doc). The route reads it
//    from body and passes it to buildCatalog().
//
// 3. Suggestion cards + typing dots + tool-call rendering are all
//    Tailwind-styled to match the Figma. Empty state (orb + heading +
//    subtitle + cards) matches AgentEmptyState from AiAgentPage.tsx.
//
// 4. Insight mode ONLY in Phase 5 — Migration is Phase 7. No file upload,
//    no MigrationCards, no mode switching.

"use client";

import { useRef, useEffect } from "react";
import type { UIMessage } from "@ai-sdk/ui-utils";
import { useChat } from "@ai-sdk/react";
import {
    Attachment01,
    Send03,
    PencilLine,
    Stars02,
    User01,
} from "@untitledui/icons";
import Image from "next/image";
import { useAppStore, type AppState } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { InsightCard } from "@/ai-agent/agent/cards";
import type { AiAgentStateSnapshot } from "@/ai-agent/types/request";
import type { User, UserRole } from "@/types";
import { Card } from "@/ai-agent/components/cards/Card";
import { TypingDots } from "@/ai-agent/components/TypingDots";

const DM_SANS_STACK =
    "var(--font-brand-dm-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/** Snapshot exactly the 10 store slices `buildCatalog` reads. Any wider
 *  and the request payload balloons for nothing; any narrower and the
 *  server can't build the catalog. Kept in sync with
 *  src/ai-agent/types/request.ts `AiAgentStateSnapshot`. */
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
    };
}

export function ChatThread() {
    const currentUser = useAppStore((s) => s.currentUser);
    const currentRole = useAppStore((s) => s.currentRole);

    const {
        messages,
        input,
        handleInputChange,
        handleSubmit,
        append,
        status,
    } = useChat({
        api: "/api/ai-agent",
        maxSteps: 3, // matches AI_AGENT_MAX_STEPS in flags.ts (Hobby 10s cap)
        // Per-request body: grab a fresh Zustand snapshot every time so the
        // model sees whatever the admin just created/edited seconds ago.
        experimental_prepareRequestBody: ({ messages: msgs }) => {
            const state = useAppStore.getState();
            const body = {
                messages: msgs,
                context: {
                    user: currentUser as User,
                    role: currentRole as UserRole,
                },
                storeSnapshot: pickStoreSnapshot(state),
            };
            return body;
        },
    });

    const isBusy = status === "submitted" || status === "streaming";
    const empty = messages.length === 0;

    const endRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const send = (text: string) => {
        if (!text.trim() || isBusy) return;
        append({ role: "user", content: text });
    };

    return (
        <div
            className="relative h-full flex flex-col"
            style={{ fontFamily: DM_SANS_STACK }}
        >
            {/* Scrolling message region takes remaining height. Composer
                docks at the bottom outside the scroll. */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {empty ? (
                    <EmptyState onSend={send} />
                ) : (
                    <div className="w-full max-w-[720px] mx-auto px-6 py-8 flex flex-col gap-6">
                        {messages.map((m) => (
                            <MessageRow key={m.id} message={m} />
                        ))}
                        {isBusy && messages[messages.length - 1]?.role === "user" && (
                            <div className="flex items-start gap-3">
                                <AssistantAvatar />
                                <TypingDots />
                            </div>
                        )}
                        <div ref={endRef} />
                    </div>
                )}
            </div>

            {/* Composer — docked at the bottom, always visible. */}
            <div className="shrink-0 border-t border-[#eaecf0] bg-white/80 backdrop-blur-sm">
                <div className="w-full max-w-[720px] mx-auto px-6 py-4">
                    <Composer
                        value={input}
                        onChange={handleInputChange}
                        onSubmit={handleSubmit}
                        disabled={isBusy}
                    />
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state — orb, heading, subtitle, three suggestion cards
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ onSend }: { onSend: (t: string) => void }) {
    return (
        <div className="w-full max-w-[720px] mx-auto px-6 h-full flex items-center justify-center py-12">
            <div className="flex flex-col gap-8 items-center w-full">
                {/* Orb + copy */}
                <div className="flex flex-col gap-4 items-center w-full">
                    <AgentOrb />
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

function AgentOrb() {
    return (
        <div
            aria-hidden
            className="size-[72px] rounded-full"
            style={{
                background:
                    "radial-gradient(circle at 32% 30%, #eaf7ee 0%, #b7dcc4 35%, #7ba08c 68%, #4c6a5a 100%)",
                boxShadow:
                    "0 18px 32px -10px rgba(75, 140, 90, 0.35), inset 0 -6px 20px rgba(12, 45, 22, 0.25)",
            }}
        />
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

function MessageRow({ message: m }: { message: UIMessage }) {
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
                    {/* Tool invocations render as cards */}
                    {m.toolInvocations?.map((ti) =>
                        ti.state === "result" ? (
                            <Card
                                key={ti.toolCallId}
                                data={ti.result as InsightCard}
                            />
                        ) : (
                            <TypingDots key={ti.toolCallId} label="Working" />
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
// Composer — attachment (inert until Phase 7), input, send
// ─────────────────────────────────────────────────────────────────────────────

function Composer({
    value,
    onChange,
    onSubmit,
    disabled,
}: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    disabled: boolean;
}) {
    const canSend = value.trim().length > 0 && !disabled;
    return (
        <form
            onSubmit={onSubmit}
            className={cn(
                "flex items-center gap-2 p-2.5 bg-white border border-[#d0d5dd] rounded-xl",
                "shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]",
            )}
        >
            {/* Attachment — inert placeholder (Phase 7 wires CSV upload
                for the Migration thread). Kept in the layout so the
                composer geometry doesn't shift when Migration lands. */}
            <button
                type="button"
                aria-label="Attach file (coming soon)"
                disabled
                className={cn(
                    "size-9 flex-shrink-0 flex items-center justify-center rounded-md",
                    "bg-white border border-[#d0d5dd] text-[#344054]",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                    "disabled:opacity-60 disabled:cursor-not-allowed",
                )}
            >
                <Attachment01 className="size-5" />
            </button>

            <input
                value={value}
                onChange={onChange}
                placeholder="Ask me anything"
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
