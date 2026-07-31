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
import Image from "next/image";
import { ChevronLeft, ChevronRight, PencilLine, SearchLg, Star01, Check } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Small status pill tone. Mirrors the DS badge tones used across admin. */
export type AiOptionBadgeTone = "neutral" | "success" | "warning" | "danger";

export interface AiOptionBadge {
    label: string;
    tone?: AiOptionBadgeTone;
}

export interface AiQuestionOption {
    /** Stable id returned in the answer payload. */
    id: string;
    /** Muted lead-in phrase, e.g. "Show me". Optional. */
    lead?: string;
    /** The emphasised answer text, e.g. "the most popular classes this month". */
    label: string;
    /** Optional one-line supporting text under the label. */
    subtitle?: string;
    // ── Rich option content (class-creation wizard, Figma frames 1–9) ──
    /** Square cover image (class template cards). Rendered as a 40px tile. */
    thumbnailUrl?: string;
    /** Round avatar image (instructor rows). Falls back to `avatarInitials`. */
    avatarUrl?: string;
    /** Initials shown in the avatar tile when there is no `avatarUrl`. */
    avatarInitials?: string;
    /** Real aggregate rating (instructor rows), e.g. 4.8 → "★ 4.8". */
    rating?: number;
    /** Inline attribute chips, e.g. ["60 min", "8 spots"] (template cards). */
    attributes?: string[];
    /** Status pill on the right, e.g. { label: "In use", tone: "warning" }. */
    badge?: AiOptionBadge;
    /** Hard-block this option (e.g. a room already used by another class).
     *  Not selectable; rendered muted with `disabledReason` when present. */
    disabled?: boolean;
    /** Muted explanation shown under a disabled option. */
    disabledReason?: string;
    /** Section header this option belongs under (kind: "grouped"). Options
     *  sharing a `groupLabel` render together beneath one header, in the
     *  order they appear in the `options` array. */
    groupLabel?: string;
}

/** Widget shape.
 *  • `radio`      — single-select list (default; unchanged legacy behaviour).
 *  • `checkbox`   — multi-select; requires an explicit confirm (equipment,
 *                   applicable plans).
 *  • `grouped`    — single-select, options bucketed by `groupLabel` headers.
 *  • `searchable` — single-select with a filter box above the list
 *                   (instructor / room / customer pickers). */
export type AiQuestionKind = "radio" | "checkbox" | "grouped" | "searchable";

export interface AiQuestionSpec {
    /** Header title — defaults to "Question" when omitted. */
    title?: string;
    /** Widget shape. Defaults to "radio". */
    kind?: AiQuestionKind;
    /** The selectable suggested answers. */
    options: AiQuestionOption[];
    /** Show a final free-text "other" row (pencil icon). Default true for
     *  radio; for checkbox it becomes an inline "Something else" adder. */
    allowOther?: boolean;
    /** Placeholder for the free-text row when `allowOther`. */
    otherPlaceholder?: string;
    /** Placeholder for the search box (kind: "searchable"). */
    searchPlaceholder?: string;
    /** Minimum selections before Confirm enables (kind: "checkbox"). Default 1. */
    minSelected?: number;
    /** Maximum selections allowed (kind: "checkbox"). Unlimited when omitted. */
    maxSelected?: number;
}

/** One answer: a chosen option id, a multi-select set, free text, or skipped. */
export type AiQuestionAnswer =
    | { kind: "option"; optionId: string }
    | { kind: "options"; optionIds: string[]; otherText?: string }
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
    /** Panel/dropdown presentation (floats above the composer): clicking an
     *  option commits it and auto-advances; the free-text "other" row and the
     *  Skip / Next footer are hidden (the real composer handles free text). */
    compact?: boolean;
}

const OTHER_ID = "__other__";

const BADGE_TONE: Record<AiOptionBadgeTone, string> = {
    neutral: "bg-[#f2f4f7] text-[#344054]",
    success: "bg-[#ecfdf3] text-[#067647]",
    warning: "bg-[#fffaeb] text-[#b54708]",
    danger: "bg-[#fef3f2] text-[#b42318]",
};

/** Leading visual for a rich option: cover thumbnail, or avatar (image /
 *  initials). Returns null for plain options so the numbered badge shows. */
function OptionMedia({ opt }: { opt: AiQuestionOption }) {
    if (opt.thumbnailUrl) {
        return (
            <span className="shrink-0 size-10 rounded-[8px] overflow-hidden bg-[#f2f4f7] relative">
                <Image src={opt.thumbnailUrl} alt="" fill sizes="40px" className="object-cover" />
            </span>
        );
    }
    if (opt.avatarUrl) {
        return (
            <span className="shrink-0 size-8 rounded-full overflow-hidden bg-[#f2f4f7] relative">
                <Image src={opt.avatarUrl} alt="" fill sizes="32px" className="object-cover" />
            </span>
        );
    }
    if (opt.avatarInitials) {
        return (
            <span className="shrink-0 size-8 rounded-full bg-[#f2f4f7] flex items-center justify-center text-[12px] font-semibold text-[#475467]">
                {opt.avatarInitials}
            </span>
        );
    }
    return null;
}

export function AiQuestionPrompt({ questions, onComplete, onStep, className, compact = false }: AiQuestionPromptProps) {
    const total = questions.length;
    const [step, setStep] = useState(0);
    // Per-step working state; committed answers accumulate in `answers`.
    const [selectedId, setSelectedId] = useState<string | null>(null); // single-select
    const [checkedIds, setCheckedIds] = useState<string[]>([]);        // multi-select
    const [otherText, setOtherText] = useState("");
    const [query, setQuery] = useState("");                            // searchable filter
    const [answers, setAnswers] = useState<AiQuestionAnswer[]>([]);

    const q = questions[step];
    const kind: AiQuestionKind = q.kind ?? "radio";
    const isMulti = kind === "checkbox";
    const isSearchable = kind === "searchable";
    const isGrouped = kind === "grouped";
    const allowOther = q.allowOther ?? !isMulti; // checkbox opts in explicitly
    const minSelected = q.minSelected ?? 1;
    const maxSelected = q.maxSelected;
    const otherSelected = selectedId === OTHER_ID;

    // Next / Confirm enablement.
    const canAdvance = isMulti
        ? checkedIds.length + (otherText.trim() ? 1 : 0) >= minSelected
        : otherSelected
          ? otherText.trim().length > 0
          : selectedId !== null;

    // Reset the working state to whatever was previously answered for `next`.
    const loadStep = (next: number) => {
        const prior = answers[next];
        setQuery("");
        if (prior?.kind === "option") {
            setSelectedId(prior.optionId);
            setCheckedIds([]);
            setOtherText("");
        } else if (prior?.kind === "options") {
            setSelectedId(null);
            setCheckedIds(prior.optionIds);
            setOtherText(prior.otherText ?? "");
        } else if (prior?.kind === "other") {
            setSelectedId(OTHER_ID);
            setCheckedIds([]);
            setOtherText(prior.text);
        } else {
            setSelectedId(null);
            setCheckedIds([]);
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

    const buildAnswer = (): AiQuestionAnswer => {
        if (isMulti) {
            const text = otherText.trim();
            return { kind: "options", optionIds: checkedIds, ...(text ? { otherText: text } : {}) };
        }
        return otherSelected
            ? { kind: "other", text: otherText.trim() }
            : { kind: "option", optionId: selectedId as string };
    };

    const handleNext = () => {
        if (!canAdvance) return;
        advance(buildAnswer());
    };
    const handleSkip = () => advance({ kind: "skipped" });
    const handlePrev = () => {
        if (step > 0) loadStep(step - 1);
    };

    // Option click.
    //  • checkbox → toggle membership (respecting maxSelected); never advances.
    //  • single-select compact → commit + auto-advance immediately.
    //  • single-select inline → mark the selection for the Next button.
    const selectOption = (opt: AiQuestionOption) => {
        if (opt.disabled) return;
        if (isMulti) {
            setCheckedIds((prev) => {
                if (prev.includes(opt.id)) return prev.filter((id) => id !== opt.id);
                if (maxSelected != null && prev.length >= maxSelected) return prev;
                return [...prev, opt.id];
            });
            return;
        }
        if (compact) {
            advance({ kind: "option", optionId: opt.id });
        } else {
            setSelectedId(opt.id);
            setOtherText("");
        }
    };

    // Forward chevron: inline advances the working selection; compact only
    // walks forward through steps already answered.
    const canGoNext = compact ? !!answers[step] && step + 1 < total : canAdvance;
    const goNext = () => {
        if (compact) {
            if (answers[step] && step + 1 < total) loadStep(step + 1);
        } else {
            handleNext();
        }
    };

    const pager = useMemo(() => `${step + 1} of ${total}`, [step, total]);

    // Searchable filtering — matches label / lead / subtitle / attributes.
    const visibleOptions = useMemo(() => {
        if (!isSearchable || !query.trim()) return q.options;
        const needle = query.trim().toLowerCase();
        return q.options.filter((o) =>
            [o.label, o.lead, o.subtitle, ...(o.attributes ?? [])]
                .filter(Boolean)
                .some((s) => (s as string).toLowerCase().includes(needle)),
        );
    }, [isSearchable, query, q.options]);

    // Grouped rendering: bucket by groupLabel, preserving first-seen order.
    const groups = useMemo(() => {
        if (!isGrouped) return null;
        const order: string[] = [];
        const map = new Map<string, AiQuestionOption[]>();
        for (const o of visibleOptions) {
            const key = o.groupLabel ?? "";
            if (!map.has(key)) {
                map.set(key, []);
                order.push(key);
            }
            map.get(key)!.push(o);
        }
        return order.map((key) => ({ label: key, options: map.get(key)! }));
    }, [isGrouped, visibleOptions]);

    const renderOption = (opt: AiQuestionOption, badgeNumber: number) => {
        const active = isMulti ? checkedIds.includes(opt.id) : selectedId === opt.id;
        const hasMedia = !!(opt.thumbnailUrl || opt.avatarUrl || opt.avatarInitials);
        return (
            <div key={opt.id} className="px-1.5 py-0.5">
                <button
                    type="button"
                    onClick={() => selectOption(opt)}
                    disabled={opt.disabled}
                    aria-pressed={active}
                    className={cn(
                        "w-full flex items-center gap-3 pl-2 pr-2.5 py-1.5 rounded-[6px] text-left transition-colors",
                        opt.disabled
                            ? "opacity-50 cursor-not-allowed"
                            : active
                              ? "bg-[#f1f7f4]"
                              : "hover:bg-[#f9fafb]",
                    )}
                >
                    {/* Leading selector. Multi → checkbox square. Single with
                        media → the media tile. Single plain → numbered badge. */}
                    {isMulti ? (
                        <span
                            className={cn(
                                "shrink-0 size-5 flex items-center justify-center rounded-[5px] border transition-colors",
                                active ? "border-[#3f8f68] bg-[#3f8f68]" : "border-[#d0d5dd] bg-white",
                            )}
                        >
                            {active && <Check className="size-3.5 text-white" strokeWidth={3} />}
                        </span>
                    ) : hasMedia ? null : (
                        <span
                            className={cn(
                                "shrink-0 size-6 flex items-center justify-center rounded-[6px] border text-[12px] font-medium",
                                active ? "border-[#aad4bd] text-[#344054] bg-white" : "border-[#e4e7ec] text-[#667085] bg-white",
                            )}
                        >
                            {badgeNumber}
                        </span>
                    )}

                    {hasMedia && <OptionMedia opt={opt} />}

                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-[14px] leading-5 min-w-0">
                            {opt.lead && <span className="text-[#667085] font-normal shrink-0">{opt.lead}</span>}
                            <span className="text-[#344054] font-medium truncate">{opt.label}</span>
                            {opt.rating != null && (
                                <span className="shrink-0 inline-flex items-center gap-0.5 text-[12px] font-medium text-[#667085]">
                                    <Star01 className="size-3 text-[#f79009] fill-[#f79009]" />
                                    {opt.rating.toFixed(1)}
                                </span>
                            )}
                        </span>
                        {opt.subtitle && (
                            <span className="text-[12px] leading-[18px] text-[#667085] truncate">{opt.subtitle}</span>
                        )}
                        {opt.disabled && opt.disabledReason && (
                            <span className="text-[12px] leading-[18px] text-[#b42318] truncate">{opt.disabledReason}</span>
                        )}
                        {opt.attributes && opt.attributes.length > 0 && (
                            <span className="flex flex-wrap items-center gap-1 pt-0.5">
                                {opt.attributes.map((a, ai) => (
                                    <span
                                        key={ai}
                                        className="inline-flex items-center rounded-[4px] bg-[#f2f4f7] px-1.5 py-0.5 text-[11px] font-medium text-[#475467]"
                                    >
                                        {a}
                                    </span>
                                ))}
                            </span>
                        )}
                    </span>

                    {opt.badge && (
                        <span
                            className={cn(
                                "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium",
                                BADGE_TONE[opt.badge.tone ?? "neutral"],
                            )}
                        >
                            {opt.badge.label}
                        </span>
                    )}
                    {!isMulti && active && !opt.badge && <ChevronRight className="size-4 text-[#667085] shrink-0" />}
                </button>
            </div>
        );
    };

    // Running number for plain radio badges (only counts rendered rows).
    let badgeCounter = 0;
    const nextBadge = () => (badgeCounter += 1);

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
                            onClick={canGoNext ? goNext : undefined}
                            disabled={!canGoNext}
                            aria-label="Next question"
                            className="size-6 flex items-center justify-center rounded-[3px] text-[#667085] enabled:hover:bg-[#f9fafb] disabled:opacity-40 transition-colors"
                        >
                            <ChevronRight className="size-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Search box (searchable kind). */}
            {isSearchable && (
                <div className="px-3.5 pt-3 pb-1">
                    <div className="flex items-center gap-2 h-10 px-3 rounded-[8px] border border-[#d0d5dd] bg-white">
                        <SearchLg className="size-4 text-[#667085] shrink-0" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={q.searchPlaceholder ?? "Search…"}
                            className="flex-1 min-w-0 bg-transparent text-[14px] text-[#344054] placeholder:text-[#667085] outline-none"
                        />
                    </div>
                </div>
            )}

            {/* Options list. */}
            <div className="flex flex-col py-1 max-h-[360px] overflow-y-auto">
                {isGrouped && groups
                    ? groups.map((g) => (
                          <div key={g.label} className="flex flex-col">
                              {g.label && (
                                  <p className="px-4 pt-2 pb-1 text-[12px] font-semibold uppercase tracking-wide text-[#667085]">
                                      {g.label}
                                  </p>
                              )}
                              {g.options.map((opt) => renderOption(opt, nextBadge()))}
                          </div>
                      ))
                    : visibleOptions.map((opt) => renderOption(opt, nextBadge()))}

                {isSearchable && visibleOptions.length === 0 && (
                    <p className="px-4 py-6 text-center text-[13px] text-[#667085]">No matches.</p>
                )}
            </div>

            {/* Footer. Hidden in the compact single-select panel (the composer
                handles free text and option-clicks auto-advance). Checkbox
                ALWAYS shows a footer, even compact — multi-select can't
                auto-advance. */}
            {compact && !isMulti ? null : (
                <div className="flex flex-col">
                    {/* Free-text "other" / "Something else" row. */}
                    {allowOther && (
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
                                    value={isMulti ? otherText : otherSelected ? otherText : ""}
                                    onFocus={() => !isMulti && setSelectedId(OTHER_ID)}
                                    onChange={(e) => {
                                        if (!isMulti) setSelectedId(OTHER_ID);
                                        setOtherText(e.target.value);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !isMulti) handleNext();
                                    }}
                                    placeholder={
                                        q.otherPlaceholder ??
                                        (isMulti ? "Something else (comma-separated)…" : "Type your own answer…")
                                    }
                                    className="flex-1 min-w-0 bg-transparent text-[14px] text-[#344054] placeholder:text-[#667085] outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* Skip / Next|Confirm actions. */}
                    <div className="flex items-center justify-end gap-3 px-3 py-2">
                        {!compact && (
                            <Button variant="secondary-gray" size="sm" onClick={handleSkip}>
                                Skip
                            </Button>
                        )}
                        <Button variant="primary" size="sm" disabled={!canAdvance} onClick={handleNext}>
                            {isMulti ? "Confirm" : step + 1 >= total ? "Done" : "Next"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
