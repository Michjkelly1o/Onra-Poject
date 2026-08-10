"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Class-creation card renderer (Phase 4)
// ─────────────────────────────────────────────────────────────────────────────
//
// Renders the `class_*` tool results in the chat bubble:
//   • class_preview  → live SchedulePreviewCard + (when ready) the publish
//                      prompt (Publish schedule / Edit a field).
//   • class_result   → success confirmation (the store write itself happens in
//                      a ChatThread effect, guarded once per tool-call id).
//   • class_denied   → plain refusal message.
//   • class_empty    → plain note.
//   • class_options  → renders nothing (data-only, feeds the model).

import { useState } from "react";
import { CheckCircle, Lightbulb02, AlertCircle } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { SchedulePreviewCard } from "@/ai-agent/components/SchedulePreviewCard";
import { SpotLayoutEditor } from "@/ai-agent/components/SpotLayoutEditor";
import type { ClassCardData } from "@/ai-agent/schedule/schedule-cards";

const NOUN: Record<string, string> = { class: "class schedule", private: "private session", recovery: "recovery session" };

/** Spot editor card — local state so the panel locks once confirmed and the
 *  message is sent exactly once. */
function SpotEditorCard({ capacity, send }: { capacity: number; send: (text: string) => void }) {
    const [confirmed, setConfirmed] = useState<{ cols: number; rows: number; blocked: string[] } | null>(null);
    return (
        <SpotLayoutEditor
            capacity={capacity}
            confirmed={confirmed}
            onConfirm={(cols, rows, blocked) => {
                if (confirmed) return;
                setConfirmed({ cols, rows, blocked });
                // Machine-readable line the prompt teaches the model to parse.
                send(
                    `Spot layout confirmed — columns: ${cols}, rows: ${rows}, blocked: ${
                        blocked.length ? blocked.join(", ") : "none"
                    }`,
                );
            }}
        />
    );
}

/** Terminal card — the published/booked confirmation. The "publishing…" loader
 *  is no longer in-chat: a fullscreen takeover (ChatThread's ImportingScreen,
 *  raised on the Publish/Book pick) covers the round-trip, then this success
 *  card renders in the revealed chat. */
function ResultCard({ noun, summary, verb }: { noun: string; summary: string; verb: string }) {
    return (
        <div className="w-full flex items-start gap-2.5 rounded-[12px] border border-[var(--colors-border-secondary)] bg-white px-4 py-3">
            <CheckCircle className="size-4 text-[#164e52] shrink-0 mt-0.5" />
            <div className="min-w-0">
                <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-5">
                    Your {noun} has been {verb}.
                </p>
                <p className="text-[13px] text-[var(--colors-text-tertiary)] leading-5 mt-0.5">{summary}</p>
            </div>
        </div>
    );
}

export function ClassCard({ data, send }: { data: ClassCardData; send: (text: string) => void }) {
    if (data.card === "class_options" || data.card === "class_service_options") return null;

    if (data.card === "class_spot_editor") {
        return <SpotEditorCard capacity={data.capacity} send={send} />;
    }

    // Date & time editors (single + recurring) render in the panel ABOVE the
    // composer now — same treatment as ask_questions — not inline in the chat.
    // ChatThread's scheduleEditorPanel mounts them; nothing to show inline.
    if (data.card === "class_days_editor" || data.card === "class_single_datetime") {
        return null;
    }

    if (data.card === "class_room_created") {
        return (
            <div className="w-full flex items-start gap-2.5 rounded-[12px] border border-[var(--colors-secondary-300)] bg-[#f1f7f4] px-4 py-3">
                <CheckCircle className="size-4 text-[#164e52] shrink-0 mt-0.5" />
                <p className="text-[14px] text-[var(--colors-text-primary)] leading-5">
                    Added <span className="font-medium">{data.room.name}</span> to {data.branchName} (capacity{" "}
                    {data.room.capacity}). It&rsquo;s selected for this class.
                </p>
            </div>
        );
    }

    if (data.card === "class_denied") {
        return (
            <div className="w-full flex items-start gap-2.5 rounded-[12px] border border-[var(--colors-border-secondary)] bg-[var(--colors-tertiary-50)] px-4 py-3">
                <Lightbulb02 className="size-4 text-[var(--colors-text-tertiary)] shrink-0 mt-0.5" />
                <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-5 whitespace-pre-line">{data.reason}</p>
            </div>
        );
    }

    if (data.card === "class_empty") {
        return (
            <div className="w-full flex items-start gap-2.5 rounded-[12px] border border-[var(--colors-border-secondary)] bg-[var(--colors-bg-secondary)] px-4 py-3">
                <Lightbulb02 className="size-4 text-[var(--colors-text-tertiary)] shrink-0 mt-0.5" />
                <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-5">{data.message}</p>
            </div>
        );
    }

    if (data.card === "class_result") {
        const appt = data.sessionType === "private" || data.sessionType === "recovery";
        return <ResultCard noun={NOUN[data.sessionType] ?? "class schedule"} summary={data.summary} verb={appt ? "booked" : "published"} />;
    }

    // class_preview — the live preview card + any rule violations (blockers,
    // red) / notes (warnings, amber). The publish confirmation is a real
    // ask_questions step (floats above the composer), not in-chat buttons.
    const isAppt = data.sessionType === "private" || data.sessionType === "recovery";
    return (
        <div className="w-full flex flex-col gap-3">
            <SchedulePreviewCard
                data={data.preview}
                variant={isAppt ? "appointment" : "class"}
                title={`${(NOUN[data.sessionType] ?? "class schedule").replace(/^\w/, (c) => c.toUpperCase())} preview`}
                subtitle={isAppt ? "This is how your session will look." : undefined}
                sessions={data.sessions}
            />
            {data.blockers && data.blockers.length > 0 && (
                <div className="w-full flex items-start gap-2.5 rounded-[12px] border border-[#fecdca] bg-[#fef3f2] px-4 py-3">
                    <AlertCircle className="size-4 text-[#d92d20] shrink-0 mt-0.5" />
                    <div className="min-w-0 flex flex-col gap-1">
                        <p className="text-[14px] font-medium text-[#b42318] leading-5">Fix these before publishing:</p>
                        <ul className="text-[14px] text-[#b42318] leading-5 list-disc pl-4 flex flex-col gap-0.5">
                            {data.blockers.map((b, i) => <li key={i}>{b}</li>)}
                        </ul>
                    </div>
                </div>
            )}
            {data.warnings && data.warnings.length > 0 && (
                <div className="w-full flex items-start gap-2.5 rounded-[12px] border border-[#fedf89] bg-[#fffaeb] px-4 py-3">
                    <AlertCircle className="size-4 text-[#dc6803] shrink-0 mt-0.5" />
                    <ul className="text-[14px] text-[#7a2e0e] leading-5 list-disc pl-4 flex flex-col gap-0.5 min-w-0">
                        {data.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
}
