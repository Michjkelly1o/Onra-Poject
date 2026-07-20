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
//     └─ "O" logomark (24px, rounded-[6px], --brand-tertiary bg) + "AI Agent"
//   Section (below header, 24px horizontal padding, 24px gap, LEFT-aligned)
//     ├─ Sidebar (288px, rounded-3xl, border): search input + 3 threads
//     │     (General chat active; Studio setup / Migrate data 'Soon') +
//     │     Archive footer separated by border-top.
//     └─ Chat surface (flex-1, max 1080px, rounded-3xl, border):
//           subtle mint gradient bg (transparent → #e9fff3), decorative
//           concentric rounded-squares pattern rotated -32° at the bottom
//           with a radial mask that fades quickly. Empty state centered:
//           orb + gradient heading "How can I assist you today?" + subtitle
//           + ask-anything composer + 3 suggestion cards.
//
// Phase 4 scope: shell + empty state ONLY. The message list / streaming
// ChatThread + card renderers (MetricGroup / RankedList / BarChart etc.)
// land in Phase 5. The composer input + suggestion cards are visible-but-
// inert until then.

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

/** DM Sans stack — pinned at the page root so every descendant inherits it.
 *  The CSS variable is set on <body> in src/app/layout.tsx via
 *  BRAND_FONT_VARIABLES; using the variable (not the raw font name) keeps
 *  the "customize brand typeface" feature intact. */
const DM_SANS_STACK =
    "var(--font-brand-dm-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

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
        <div
            className="flex flex-col h-screen w-screen bg-white text-[#101828]"
            style={{ fontFamily: DM_SANS_STACK }}
        >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <header className="sticky top-0 z-10 h-[72px] flex items-center px-6 bg-white shrink-0">
                <div className="flex items-center gap-3">
                    {/* Close (X) — matches the app's detail-page pattern
                        (see CustomerDetailPage:1020-1023): XClose icon,
                        w-9 h-9 rounded-[8px], text-#667085, hover:bg-#f9fafb.
                        No text-color hover so it stays a pure surface hover. */}
                    <button
                        type="button"
                        aria-label="Close AI Agent"
                        onClick={handleClose}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0"
                    >
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>

                    {/* Logomark + title. Real Onra logo mark (public/
                        Logomark.webp) inside a 24×24 white bordered box —
                        matches the Figma's Logomark component. */}
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

            {/* ── Section: sidebar + chat pane. LEFT-aligned per Figma
                (sidebar at 24px from viewport edge, canvas grows to 1080px,
                any extra viewport width sits empty on the right). ────── */}
            <section className="flex-1 min-h-0 flex gap-6 px-6 pb-6 items-start">
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
// Right chat surface — Phase 4 shows empty state only
// ─────────────────────────────────────────────────────────────────────────────

function AgentChatSurface() {
    return (
        <div
            className={cn(
                "flex-1 min-w-0 max-w-[1080px] h-full",
                "bg-white border border-[#e4e7ec] rounded-[24px] overflow-hidden relative",
            )}
        >
            {/* Mint gradient bg + concentric squares — grouped in one
                aria-hidden layer so nothing decorative can intercept clicks.
                Client 2026-07-20: the decorative squares point UPWARD from
                the middle of the canvas (so the "tips" of the chevrons rise
                toward the composer + empty state), NOT downward. */}
            <div aria-hidden className="absolute inset-0 pointer-events-none">
                {/* Gradient: from brand-50 #e9fff3 at the TOP down to
                    transparent — anchors the pattern at the top of the
                    canvas so it feels like the chevrons rise out of a mint
                    field. */}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            "linear-gradient(to top, rgba(233,255,243,0) 40%, #e9fff3 100%)",
                    }}
                />
                <ConcentricSquaresDecoration />
            </div>

            {/* Content — centered on both axes. Scrolls inside the pane
                (never pushes the page's chrome). */}
            <div className="relative h-full overflow-y-auto flex items-center justify-center p-6">
                <AgentEmptyState />
            </div>
        </div>
    );
}

/** Decorative concentric rounded squares — reproduces the Figma's
 *  "Background pattern decorative" without pulling in the asset PNG.
 *
 *  Client 2026-07-20: pattern moved to the TOP of the canvas (previously
 *  bottom). The concentric squares peek in from ABOVE the empty state so
 *  the chevron tips point downward toward the content — matches the
 *  "upward" direction the client wants (mint field flowing from the top,
 *  chevrons emerging from it). Overall opacity 0.35 so it reads as
 *  texture, never as content. */
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

// ─────────────────────────────────────────────────────────────────────────────
// Empty state — orb + heading + subtitle + input + 3 cards
// ─────────────────────────────────────────────────────────────────────────────

function AgentEmptyState() {
    return (
        <div className="w-full max-w-[720px] flex flex-col gap-8 items-center">
            {/* Orb + copy */}
            <div className="flex flex-col gap-4 items-center w-full">
                <AgentOrb />
                <div className="flex flex-col gap-1 text-center w-full items-center">
                    {/* Gradient heading — inline-block so the gradient only
                        stretches under the text glyphs; explicit -webkit-*
                        prefixes because Chrome/Safari require them for
                        background-clip:text (Tailwind's bg-clip-text alone
                        isn't reliably clipping in this project's build).
                        `-webkit-text-fill-color: transparent` is the modern
                        equivalent of `color: transparent` — either works;
                        we set BOTH so no other stylesheet can win. */}
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
                    <p
                        className="text-[16px] leading-6 text-[#667085]"
                        style={{ fontFamily: DM_SANS_STACK }}
                    >
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
 *  the three.js particle version lands Phase 5.5. Sized 72×72 to match
 *  the Figma. */
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
                "flex items-center gap-2 p-2.5 bg-white border border-[#d0d5dd] rounded-xl",
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
                className="flex-1 min-w-0 h-9 px-2 text-[16px] text-[#101828] placeholder:text-[#667085] bg-transparent outline-none leading-6"
                style={{ fontFamily: DM_SANS_STACK }}
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
