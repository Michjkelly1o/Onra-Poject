"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Clarifying-question prompt (Figma 18885:19674)
// ─────────────────────────────────────────────────────────────────────────────
//
// A centralized, reusable component for the moment the agent needs to ask the
// user something before it can act — the "pop-up" pattern (like Claude's
// clarifying questions). One card holds:
//
//   • Header — a "Question" title + a pager ("1 of N") with prev / next
//     chevrons when there is more than one question.
//   • Options — a selectable list of suggested answers. Each option carries a
//     lead + label (e.g. "Show me" + "the most popular classes this month")
//     and an optional one-line subtitle. Selecting one marks it (radio-style).
//   • Other — an optional final row (pencil icon) that reveals a free-text
//     field so the user can answer in their own words.
//   • Footer actions — Skip (skips this question) and Next (advances, or
//     completes on the last question).
//
// It is fully props-driven and holds no app-specific logic, so any agent flow
// can mount it and receive the collected answers via `onComplete`. This is the
// SINGLE source for this pattern — do not inline a copy elsewhere.

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, PencilLine } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface AiQuestionOption {
    /** Stable id returned in the answer payload. */
    id: string;
    /** Muted lead-in phrase, e.g. "Show me". Optional. */
    lead?: string;
    /** The emphasised answer text, e.g. "the most popular classes this month". */
    label: string;
    /** Optional one-line supporting text under the label. */
    subtitle?: string;
}

export interface AiQuestionSpec {
    /** Header title — defaults to "Question" when omitted. */
    title?: string;
    /** The selectable suggested answers. */
    options: AiQuestionOption[];
    /** Show a final free-text "other" row (pencil icon). Default true. */
    allowOther?: boolean;
    /** Placeholder for the free-text row when `allowOther`. */
    otherPlaceholder?: string;
}

/** One answer: either a chosen option id, or free text the user typed. */
export type AiQuestionAnswer =
    | { kind: "option"; optionId: string }
    | { kind: "other"; text: string }
    | { kind: "skipped" };

export interface AiQuestionPromptProps {
    /** One or more questions. A pager appears when length > 1. */
    questions: AiQuestionSpec[];
    /** Fired once the last question is answered / skipped, with every answer
     *  in question order. */
    onComplete: (answers: AiQuestionAnswer[]) => void;
    /** Optional per-step callback (fires on every Next / Skip). */
    onStep?: (index: number, answer: AiQuestionAnswer) => void;
    className?: string;
}

const OTHER_ID = "__other__";

export function AiQuestionPrompt({ questions, onComplete, onStep, className }: AiQuestionPromptProps) {
    const total = questions.length;
    const [step, setStep] = useState(0);
    // Per-step working selection + free-text; committed answers accumulate.
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [otherText, setOtherText] = useState("");
    const [answers, setAnswers] = useState<AiQuestionAnswer[]>([]);

    const q = questions[step];
    const allowOther = q.allowOther ?? true;
    const otherSelected = selectedId === OTHER_ID;
    // Next is enabled once the user has picked an option, or typed something in
    // the "other" field.
    const canAdvance = otherSelected ? otherText.trim().length > 0 : selectedId !== null;

    // Reset the working state to whatever was previously answered for `next`.
    const loadStep = (next: number) => {
        const prior = answers[next];
        if (prior?.kind === "option") {
            setSelectedId(prior.optionId);
            setOtherText("");
        } else if (prior?.kind === "other") {
            setSelectedId(OTHER_ID);
            setOtherText(prior.text);
        } else {
            setSelectedId(null);
            setOtherText("");
        }
        setStep(next);
    };

    const commit = (answer: AiQuestionAnswer): AiQuestionAnswer[] => {
        const nextAnswers = [...answers];
        nextAnswers[step] = answer;
        setAnswers(nextAnswers);
        onStep?.(step, answer);
        return nextAnswers;
    };

    const advance = (answer: AiQuestionAnswer) => {
        const nextAnswers = commit(answer);
        if (step + 1 >= total) {
            // Fill any unanswered earlier steps as skipped (defensive).
            const complete = questions.map((_, i) => nextAnswers[i] ?? { kind: "skipped" as const });
            onComplete(complete);
        } else {
            loadStep(step + 1);
        }
    };

    const handleNext = () => {
        if (!canAdvance) return;
        advance(
            otherSelected
                ? { kind: "other", text: otherText.trim() }
                : { kind: "option", optionId: selectedId as string },
        );
    };
    const handleSkip = () => advance({ kind: "skipped" });
    const handlePrev = () => {
        if (step > 0) loadStep(step - 1);
    };

    const pager = useMemo(() => `${step + 1} of ${total}`, [step, total]);

    return (
        <div
            className={cn(
                "w-full bg-white border border-[#e4e7ec] rounded-[12px] overflow-hidden",
                "shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]",
                className,
            )}
        >
            {/* Header — title + pager. */}
            <div className="h-[52px] flex items-center gap-2 px-3.5 border-b border-[#e4e7ec]">
                <p className="flex-1 min-w-0 text-[16px] font-semibold text-[#101828] leading-6 truncate">
                    {q.title ?? "Question"}
                </p>
                {total > 1 && (
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            type="button"
                            onClick={handlePrev}
                            disabled={step === 0}
                            aria-label="Previous question"
                            className="size-6 flex items-center justify-center rounded-[3px] text-[#667085] enabled:hover:bg-[#f9fafb] disabled:opacity-40 transition-colors"
                        >
                            <ChevronLeft className="size-3.5" />
                        </button>
                        <span className="text-[14px] font-medium text-[#667085] tabular-nums px-1">
                            {pager}
                        </span>
                        <button
                            type="button"
                            onClick={canAdvance ? handleNext : undefined}
                            disabled={!canAdvance}
                            aria-label="Next question"
                            className="size-6 flex items-center justify-center rounded-[3px] text-[#667085] enabled:hover:bg-[#f9fafb] disabled:opacity-40 transition-colors"
                        >
                            <ChevronRight className="size-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Options list. */}
            <div className="flex flex-col py-1">
                {q.options.map((opt, i) => {
                    const active = selectedId === opt.id;
                    return (
                        <div key={opt.id} className="px-1.5 py-0.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedId(opt.id);
                                    setOtherText("");
                                }}
                                className={cn(
                                    "w-full flex items-center gap-3 pl-2 pr-2.5 py-1.5 rounded-[6px] text-left transition-colors",
                                    active ? "bg-[#f1f7f4]" : "hover:bg-[#f9fafb]",
                                )}
                            >
                                {/* Numbered badge. */}
                                <span
                                    className={cn(
                                        "shrink-0 size-6 flex items-center justify-center rounded-[6px] border text-[12px] font-medium",
                                        active
                                            ? "border-[#aad4bd] text-[#344054] bg-white"
                                            : "border-[#e4e7ec] text-[#667085] bg-white",
                                    )}
                                >
                                    {i + 1}
                                </span>
                                <span className="flex-1 min-w-0 flex flex-col">
                                    <span className="flex items-center gap-1 text-[14px] leading-5 truncate">
                                        {opt.lead && <span className="text-[#667085] font-normal">{opt.lead}</span>}
                                        <span className="text-[#344054] font-medium truncate">{opt.label}</span>
                                    </span>
                                    {opt.subtitle && (
                                        <span className="text-[12px] leading-[18px] text-[#667085] truncate">
                                            {opt.subtitle}
                                        </span>
                                    )}
                                </span>
                                {active && <ChevronRight className="size-4 text-[#667085] shrink-0" />}
                            </button>
                        </div>
                    );
                })}

                {/* Free-text "other" row + Skip / Next actions. */}
                {allowOther ? (
                    <div className="px-1.5 py-0.5">
                        <div
                            className={cn(
                                "w-full flex items-center gap-3 pl-2 pr-2.5 py-1.5 rounded-[6px] transition-colors",
                                otherSelected ? "bg-[#f1f7f4]" : "hover:bg-[#f9fafb]",
                            )}
                        >
                            <span className="shrink-0 size-6 flex items-center justify-center rounded-[6px] border border-[#e4e7ec] bg-white">
                                <PencilLine className="size-3 text-[#667085]" />
                            </span>
                            <input
                                value={otherSelected ? otherText : ""}
                                onFocus={() => setSelectedId(OTHER_ID)}
                                onChange={(e) => {
                                    setSelectedId(OTHER_ID);
                                    setOtherText(e.target.value);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleNext();
                                }}
                                placeholder={q.otherPlaceholder ?? "Type your own answer…"}
                                className="flex-1 min-w-0 bg-transparent text-[14px] text-[#344054] placeholder:text-[#667085] outline-none"
                            />
                            <div className="flex items-center gap-3 shrink-0">
                                <Button variant="secondary-gray" size="sm" onClick={handleSkip}>
                                    Skip
                                </Button>
                                <Button variant="primary" size="sm" disabled={!canAdvance} onClick={handleNext}>
                                    {step + 1 >= total ? "Done" : "Next"}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-end gap-3 px-3 py-2">
                        <Button variant="secondary-gray" size="sm" onClick={handleSkip}>
                            Skip
                        </Button>
                        <Button variant="primary" size="sm" disabled={!canAdvance} onClick={handleNext}>
                            {step + 1 >= total ? "Done" : "Next"}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
