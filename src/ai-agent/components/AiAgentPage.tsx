// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Full-viewport page (Figma node 405:455789)
// ─────────────────────────────────────────────────────────────────────────────
//
// Renders as the entire viewport (no admin sidebar/header wrapping — this
// route lives at /ai-agent, not /admin/ai-agent). Layout mirrors the Figma:
//
//   • Header row (72px, sticky, white)
//       ├─ Close (X) at far left
//       └─ Onra logo mark + "AI Agent" title
//   • Section (below header, 24px horizontal padding, 24px gap)
//       ├─ Left sidebar (288px, rounded-3xl, border):
//       │     search input · General chat / Studio setup / Migrate data
//       │     · flex spacer · Archive at bottom
//       └─ Right chat surface (flex-1, max-w 1080px, rounded-3xl, border):
//             mint gradient background + centered empty state
//             (orb + heading + subtitle + ask-anything input + 3 cards)
//
// Phase 4 scope: shell + empty state ONLY. The message list / streaming
// ChatThread + card renderers (MetricGroup / RankedList / BarChart etc.)
// land in Phase 5. Suggestion cards ("Create", "Insight", "Customer") are
// visible-but-inert until the input is wired up.

"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    X,
    SearchLg,
    MessageChatCircle,
    Building01,
    UploadCloud02,
    Archive,
    Attachment01,
    Send03,
    PencilLine,
    Stars02,
    User01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";

type ThreadKey = "general" | "studio_setup" | "migrate_data";

interface ThreadDef {
    key: ThreadKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    /** Coming-soon threads render but stay non-interactive in Phase 4. */
    enabled: boolean;
}

const THREADS: readonly ThreadDef[] = [
    { key: "general",       label: "General chat", icon: MessageChatCircle, enabled: true  },
    { key: "studio_setup",  label: "Studio setup", icon: Building01,        enabled: false },
    { key: "migrate_data",  label: "Migrate data", icon: UploadCloud02,     enabled: false },
];

export function AiAgentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnTo = useMemo(
        () => searchParams.get("returnTo") ?? "/admin/dashboard",
        [searchParams],
    );

    const [activeThread, setActiveThread] = useState<ThreadKey>("general");

    const handleClose = () => router.push(returnTo);

    return (
        <div className="flex flex-col h-screen w-screen bg-white">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <header className="sticky top-0 z-10 h-[72px] flex items-center px-6 bg-white">
                <div className="flex items-center gap-3">
                    {/* Close (X) — returns to `returnTo` or /admin/dashboard */}
                    <button
                        type="button"
                        aria-label="Close AI Agent"
                        onClick={handleClose}
                        className="size-9 rounded-md flex items-center justify-center text-[#475467] hover:bg-[#f9fafb] hover:text-[#101828] transition-colors"
                    >
                        <X className="size-5" />
                    </button>

                    {/* Logo mark + title */}
                    <div className="flex items-center gap-2">
                        <div className="size-6 rounded-md border border-[#d0d5dd] bg-white flex items-center justify-center shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                            <span className="text-[11px] font-semibold text-[#0c2d34]">O</span>
                        </div>
                        <span className="text-[18px] font-semibold text-[#344054] leading-7">
                            AI Agent
                        </span>
                    </div>
                </div>
            </header>

            {/* ── Section: sidebar + chat pane ─────────────────────────── */}
            <section className="flex-1 min-h-0 flex gap-6 px-6 pb-6 justify-center">
                <AgentSidebar
                    activeThread={activeThread}
                    onSelectThread={setActiveThread}
                />
                <AgentChatSurface />
            </section>
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
        <aside className="w-[288px] flex-shrink-0 self-start h-full bg-white border border-[#e4e7ec] rounded-3xl flex flex-col overflow-hidden">
            {/* Search input */}
            <div className="p-4 border-b border-[#e4e7ec]">
                <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-[#d0d5dd] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                    <SearchLg className="size-4 text-[#667085] flex-shrink-0" />
                    <input
                        type="text"
                        placeholder="Search chat..."
                        className="flex-1 min-w-0 text-[14px] text-[#101828] placeholder:text-[#667085] bg-transparent outline-none"
                    />
                </div>
            </div>

            {/* Thread list */}
            <nav className="flex flex-col gap-1 p-2 py-3">
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
                                "flex items-center gap-2 px-2 py-3 rounded-md text-left transition-colors",
                                isActive && "bg-[#f9fafb]",
                                !isActive && t.enabled && "hover:bg-[#f9fafb]",
                                !t.enabled && "cursor-not-allowed",
                            )}
                        >
                            <Icon className="size-4 flex-shrink-0 text-[#182230]" />
                            <span className="flex-1 text-[14px] font-medium text-[#182230] truncate">
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
                    className="w-full flex items-center gap-2 px-2 py-3 rounded-md hover:bg-[#f9fafb] transition-colors"
                >
                    <Archive className="size-4 flex-shrink-0 text-[#182230]" />
                    <span className="flex-1 text-[14px] font-medium text-[#182230] text-left">
                        Archive
                    </span>
                </button>
            </div>
        </aside>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right chat surface — Phase 4 shows empty state only
// ─────────────────────────────────────────────────────────────────────────────

function AgentChatSurface() {
    return (
        <div
            className={cn(
                "flex-1 min-w-0 max-w-[1080px] self-start h-full",
                "bg-white border border-[#e4e7ec] rounded-3xl overflow-hidden relative",
            )}
        >
            {/* Mint gradient background — subtle, from transparent (top)
                to brand-50 #e9fff3 (bottom). Layered behind everything with
                pointer-events-none so it can't intercept clicks. */}
            <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                    background:
                        "linear-gradient(to bottom, rgba(233,255,243,0) 0%, #e9fff3 100%)",
                }}
            />
            {/* Decorative concentric rounded squares — masked with a radial
                gradient so the pattern fades at the edges. Rotated -32deg
                to match the Figma. */}
            <ConcentricSquaresDecoration />

            {/* Content — centered, both axes. */}
            <div className="relative h-full overflow-y-auto flex items-center justify-center p-6">
                <AgentEmptyState />
            </div>
        </div>
    );
}

/** Decorative concentric rounded squares. Reproduces the Figma's
 *  "Background pattern decorative" without pulling in the asset PNG. Uses
 *  a radial-gradient mask so the pattern fades at the container edges. */
function ConcentricSquaresDecoration() {
    const sizes = [228, 342, 457, 571, 685, 800];
    return (
        <div
            aria-hidden
            className="absolute inset-0 pointer-events-none flex items-end justify-center overflow-hidden"
            style={{
                opacity: 0.4,
                maskImage:
                    "radial-gradient(circle at 50% 90%, black 0%, transparent 60%)",
                WebkitMaskImage:
                    "radial-gradient(circle at 50% 90%, black 0%, transparent 60%)",
            }}
        >
            <div
                className="relative"
                style={{
                    transform: "translateY(45%) rotate(-32deg)",
                    width: 800,
                    height: 800,
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

// ─────────────────────────────────────────────────────────────────────────────
// Empty state — orb + heading + subtitle + input + 3 cards
// ─────────────────────────────────────────────────────────────────────────────

function AgentEmptyState() {
    return (
        <div className="w-full max-w-[720px] flex flex-col gap-8 items-center">
            {/* Orb + copy */}
            <div className="flex flex-col gap-4 items-center w-full">
                <AgentOrb />
                <div className="flex flex-col gap-1 text-center w-full">
                    <h1
                        className="text-[36px] font-semibold leading-[44px] tracking-[-0.72px] bg-clip-text text-transparent"
                        style={{
                            backgroundImage:
                                "linear-gradient(90deg, #658774 0%, #7ba08c 100%)",
                        }}
                    >
                        How can I assist you today?
                    </h1>
                    <p className="text-[16px] leading-6 text-[#667085]">
                        Manage bookings, customers, and schedules with ease.
                    </p>
                </div>
            </div>

            {/* Ask-anything input + 3 suggestion cards */}
            <div className="flex flex-col gap-5 items-stretch w-full">
                <AskAnythingInput />
                <SuggestionCardRow />
            </div>
        </div>
    );
}

/** The green sphere / orb. Phase 4 is a CSS radial-gradient placeholder;
 *  the three.js particle version lands Phase 5.5. Same look-and-feel as
 *  the design's central sphere at this size. */
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

/** Bottom composer field. Phase 4 the input is non-functional (submit will
 *  be wired in Phase 5 when useChat is added). Kept visually accurate so
 *  the client-facing empty state is complete. */
function AskAnythingInput() {
    return (
        <form
            onSubmit={(e) => e.preventDefault()}
            className={cn(
                "flex items-end gap-2 p-2.5 bg-white border border-[#d0d5dd] rounded-xl",
                "shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]",
            )}
        >
            {/* Attachment (icon-only secondary button) */}
            <button
                type="button"
                aria-label="Attach file"
                className={cn(
                    "size-9 flex-shrink-0 flex items-center justify-center rounded-md",
                    "bg-white border border-[#d0d5dd] text-[#344054]",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                    "hover:bg-[#f9fafb] transition-colors",
                )}
            >
                <Attachment01 className="size-5" />
            </button>

            {/* Text input */}
            <input
                type="text"
                placeholder="Ask me anything"
                disabled
                className="flex-1 min-w-0 h-9 px-2 text-[16px] text-[#101828] placeholder:text-[#667085] bg-transparent outline-none"
            />

            {/* Send (primary mint) */}
            <button
                type="submit"
                aria-label="Send"
                disabled
                className={cn(
                    "size-9 flex-shrink-0 flex items-center justify-center rounded-md",
                    "bg-[#c4edd6] text-[#0c2d34] border-1 border-white/[0.12]",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)]",
                    "disabled:opacity-70",
                )}
            >
                <Send03 className="size-5" />
            </button>
        </form>
    );
}

/** Three suggestion cards. Phase 4: visible but inert. Phase 5 wires each
 *  card's click to a preset first message for the corresponding thread. */
function SuggestionCardRow() {
    return (
        <div className="flex gap-4 w-full">
            <SuggestionCard
                icon={PencilLine}
                title="Create"
                description="Set up new classes, plans, packs, and staff."
            />
            <SuggestionCard
                icon={Stars02}
                title="Insight"
                description="Get quick insights to help grow your studio."
            />
            <SuggestionCard
                icon={User01}
                title="Customer"
                description="Find customers and handle refunds or credits."
            />
        </div>
    );
}

function SuggestionCard({
    icon: Icon,
    title,
    description,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
}) {
    return (
        <button
            type="button"
            className={cn(
                "flex-1 min-w-0 p-4 rounded-xl text-left",
                "bg-white border border-[#e4e7ec]",
                "shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]",
                "hover:border-[#d0d5dd] hover:shadow-[0px_16px_20px_-4px_rgba(16,24,40,0.12),0px_6px_8px_-2px_rgba(16,24,40,0.04)] transition-all",
            )}
        >
            <div className="flex flex-col gap-2 items-start">
                {/* Featured-icon square */}
                <div
                    className={cn(
                        "size-8 flex items-center justify-center rounded-md",
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
