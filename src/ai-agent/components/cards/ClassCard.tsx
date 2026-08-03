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
import { CalendarPlus01, PencilLine, CheckCircle, Lightbulb02 } from "@untitledui/icons";
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

export function ClassCard({ data, send }: { data: ClassCardData; send: (text: string) => void }) {
    if (data.card === "class_options") return null;

    if (data.card === "class_spot_editor") {
        return <SpotEditorCard capacity={data.capacity} send={send} />;
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
        return (
            <div className="w-full flex items-start gap-2.5 rounded-[12px] border border-[#aad4bd] bg-[#f1f7f4] px-4 py-3">
                <CheckCircle className="size-4 text-[#3f8f68] shrink-0 mt-0.5" />
                <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-5">
                        Your {NOUN[data.sessionType] ?? "class schedule"} has been published.
                    </p>
                    <p className="text-[13px] text-[#475467] leading-5 mt-0.5">{data.summary}</p>
                </div>
            </div>
        );
    }

    // class_preview
    return (
        <div className="w-full flex flex-col gap-3">
            <SchedulePreviewCard
                data={data.preview}
                title={`${(NOUN[data.sessionType] ?? "class schedule").replace(/^\w/, (c) => c.toUpperCase())} preview`}
            />

            {data.recurringStub && (
                <div className="flex items-start gap-2.5 rounded-[12px] border border-[#e4e7ec] bg-[#f1f2ed] px-4 py-3">
                    <Lightbulb02 className="size-4 text-[#475467] shrink-0 mt-0.5" />
                    <p className="text-[14px] text-[#475467] leading-5">
                        Recurring schedules aren&rsquo;t available in the assistant yet. I can set up a single class now,
                        or you can create a repeating one from the Schedule page.
                    </p>
                </div>
            )}

            {data.readyToPublish && !data.recurringStub && (
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
                            onClick={() => send("I'd like to edit a field")}
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
