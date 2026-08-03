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

import { useState, useEffect } from "react";
import { CalendarPlus01, PencilLine, CheckCircle, Lightbulb02, Stars01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { SchedulePreviewCard } from "@/ai-agent/components/SchedulePreviewCard";
import { SpotLayoutEditor } from "@/ai-agent/components/SpotLayoutEditor";
import { SelectDaysEditor } from "@/ai-agent/components/SelectDaysEditor";
import type { ClassCardData } from "@/ai-agent/schedule/schedule-cards";
import type { DaySchedule } from "@/ai-agent/schedule/schedule-wizard";

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

/** Select-days editor card — sends the schedule as JSON the model copies into
 *  the recurDays argument. */
function DaysEditorCard({ send }: { send: (text: string) => void }) {
    const [confirmed, setConfirmed] = useState<DaySchedule[] | null>(null);
    return (
        <SelectDaysEditor
            confirmed={confirmed}
            onConfirm={(days) => {
                if (confirmed) return;
                setConfirmed(days);
                send(`Days confirmed — schedule: ${JSON.stringify(days)}`);
            }}
        />
    );
}

/** Terminal card — plays a brief "Validating…" sparkle (frame 36) then flips to
 *  the published confirmation (the class is already written; this is the
 *  optimistic-UI flourish the Figma shows between publish and success). */
function ResultCard({ noun, summary }: { noun: string; summary: string }) {
    const [done, setDone] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setDone(true), 1300);
        return () => clearTimeout(t);
    }, []);

    if (!done) {
        return (
            <div className="w-full flex items-center gap-2.5 rounded-[12px] border border-[#e4e7ec] bg-white px-4 py-3">
                <Stars01 className="size-4 text-[#3f8f68] shrink-0 animate-pulse" />
                <p className="text-[14px] text-[#475467] leading-5">
                    Validating your {noun} data. Moving to the next step…
                </p>
            </div>
        );
    }
    return (
        <div className="w-full flex items-start gap-2.5 rounded-[12px] border border-[#aad4bd] bg-[#f1f7f4] px-4 py-3">
            <CheckCircle className="size-4 text-[#3f8f68] shrink-0 mt-0.5" />
            <div className="min-w-0">
                <p className="text-[14px] font-medium text-[#101828] leading-5">
                    Your {noun} has been published.
                </p>
                <p className="text-[13px] text-[#475467] leading-5 mt-0.5">{summary}</p>
            </div>
        </div>
    );
}

export function ClassCard({ data, send }: { data: ClassCardData; send: (text: string) => void }) {
    if (data.card === "class_options") return null;

    if (data.card === "class_spot_editor") {
        return <SpotEditorCard capacity={data.capacity} send={send} />;
    }

    if (data.card === "class_days_editor") {
        return <DaysEditorCard send={send} />;
    }

    if (data.card === "class_room_created") {
        return (
            <div className="w-full flex items-start gap-2.5 rounded-[12px] border border-[#aad4bd] bg-[#f1f7f4] px-4 py-3">
                <CheckCircle className="size-4 text-[#3f8f68] shrink-0 mt-0.5" />
                <p className="text-[14px] text-[#101828] leading-5">
                    Added <span className="font-medium">{data.room.name}</span> to {data.branchName} (capacity{" "}
                    {data.room.capacity}). It&rsquo;s selected for this class.
                </p>
            </div>
        );
    }

    if (data.card === "class_denied") {
        return (
            <div className="w-full flex items-start gap-2.5 rounded-[12px] border border-[#e4e7ec] bg-[#f1f2ed] px-4 py-3">
                <Lightbulb02 className="size-4 text-[#475467] shrink-0 mt-0.5" />
                <p className="text-[14px] text-[#475467] leading-5">{data.reason}</p>
            </div>
        );
    }

    if (data.card === "class_empty") {
        return (
            <div className="w-full flex items-start gap-2.5 rounded-[12px] border border-[#e4e7ec] bg-[#f9fafb] px-4 py-3">
                <Lightbulb02 className="size-4 text-[#475467] shrink-0 mt-0.5" />
                <p className="text-[14px] text-[#475467] leading-5">{data.message}</p>
            </div>
        );
    }

    if (data.card === "class_result") {
        return <ResultCard noun={NOUN[data.sessionType] ?? "class schedule"} summary={data.summary} />;
    }

    // class_preview
    return (
        <div className="w-full flex flex-col gap-3">
            <SchedulePreviewCard
                data={data.preview}
                title={`${(NOUN[data.sessionType] ?? "class schedule").replace(/^\w/, (c) => c.toUpperCase())} preview`}
                sessions={data.sessions}
            />

            {data.readyToPublish && (
                <div className="w-full rounded-[12px] border border-[#e4e7ec] bg-white overflow-hidden">
                    <p className="px-4 py-3 text-[16px] font-semibold text-[#101828] leading-6 border-b border-[#e4e7ec]">
                        Are you ready to publish this schedule?
                    </p>
                    <div className="flex flex-col p-1.5 gap-1">
                        <button
                            type="button"
                            onClick={() => send("Publish schedule")}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-left hover:bg-[#f9fafb] transition-colors"
                        >
                            <CalendarPlus01 className="size-4 text-[#475467] shrink-0" />
                            <span className="text-[14px] font-medium text-[#344054]">Publish schedule</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => send("Edit a field")}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-left hover:bg-[#f9fafb] transition-colors"
                        >
                            <PencilLine className="size-4 text-[#475467] shrink-0" />
                            <span className="text-[14px] font-medium text-[#344054]">Edit a field</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
