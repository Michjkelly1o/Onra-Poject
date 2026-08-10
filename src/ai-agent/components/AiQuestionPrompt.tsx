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

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, PencilLine, SearchLg, Star01, Check, Plus, Grid01, MarkerPin01, ClockFastForward, Users01, Building01, Trash01, UploadCloud02 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/DatePicker";

// Icons for a template option's attribute chips, by position — mirrors the
// admin schedule form's template card (category · location/type · duration ·
// capacity), so the AI wizard's template picker matches Figma 368-123129.
const ATTR_ICONS = [Grid01, MarkerPin01, ClockFastForward, Users01] as const;

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
    /** Square cover image (class template cards). Rendered as a tile. */
    thumbnailUrl?: string;
    /** Render a bordered "+" placeholder tile instead of an image — used for
     *  the "Create from scratch" option in the template picker (Figma). */
    iconTile?: boolean;
    /** Round avatar image (instructor rows). Falls back to `avatarInitials`. */
    avatarUrl?: string;
    /** Initials shown in the avatar tile when there is no `avatarUrl`. */
    avatarInitials?: string;
    /** Real aggregate rating (instructor rows), e.g. 4.8 → "★ 4.8". */
    rating?: number;
    /** Review count shown after the rating, e.g. 6000 → "★ 5.0 (6K reviews)". */
    ratingCount?: number;
    /** Muted suffix after the label, e.g. "(15 max)" on a room row. */
    metaLabel?: string;
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
    /** Render this row as a "Pick a custom date" option — a plain borderless
     *  row with a calendar icon that opens the date picker on click. The picked
     *  ISO date becomes the answer (kind: "other", text: <YYYY-MM-DD>). */
    datePicker?: boolean;
    /** Inclusive earliest selectable date for a `datePicker` option (ISO). */
    minDateISO?: string;
}

/** Widget shape.
 *  • `radio`      — single-select list (default; unchanged legacy behaviour).
 *  • `checkbox`   — multi-select; requires an explicit confirm (equipment,
 *                   applicable plans).
 *  • `grouped`    — single-select, options bucketed by `groupLabel` headers.
 *  • `searchable` — single-select with a filter box above the list
 *                   (instructor / room / customer pickers). */
export type AiQuestionKind = "radio" | "checkbox" | "grouped" | "searchable" | "image";

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
    /** kind: "grouped" — render a right-aligned action button in every group
     *  header (e.g. "Add room" on each branch in the room picker). Fires
     *  `onGroupAction(groupLabel)`. */
    groupActionLabel?: string;
    /** Render a building icon before each group header (branch groups). */
    groupIcon?: "building";
}

/** One answer: a chosen option id, a multi-select set, free text, an uploaded
 *  image (data URL — never relayed through the model), or skipped. */
export type AiQuestionAnswer =
    | { kind: "option"; optionId: string }
    | { kind: "options"; optionIds: string[]; otherText?: string }
    | { kind: "other"; text: string }
    | { kind: "image"; dataUrl: string }
    | { kind: "skipped" };

export interface AiQuestionPromptProps {
    /** One or more questions. A pager appears when length > 1. */
    questions: AiQuestionSpec[];
    /** Fired once the last question is answered / skipped, with every answer
     *  in question order. */
    onComplete: (answers: AiQuestionAnswer[]) => void;
    /** Optional per-step callback (fires on every Next / Skip). */
    onStep?: (index: number, answer: AiQuestionAnswer) => void;
    /** Fired when a group-header action button is clicked (e.g. "Add room" on a
     *  branch) — receives the group label. */
    onGroupAction?: (groupLabel: string) => void;
    className?: string;
    /** Panel/dropdown presentation (floats above the composer): clicking an
     *  option commits it and auto-advances; the free-text "other" row and the
     *  Skip / Next footer are hidden (the real composer handles free text). */
    compact?: boolean;
}

const OTHER_ID = "__other__";

/** 6000 → "6K", 950 → "950". */
function fmtReviews(n: number): string {
    return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : `${n}`;
}

const BADGE_TONE: Record<AiOptionBadgeTone, string> = {
    neutral: "bg-[var(--colors-bg-tertiary)] text-[var(--colors-text-secondary)]",
    success: "bg-[#ecfdf3] text-[#067647]",
    warning: "bg-[#fffaeb] text-[#b54708]",
    danger: "bg-[#fef3f2] text-[#b42318]",
};

/** First-letter initials from a person's display name — "Olivia Rhye" → "OR".
 *  Used as the avatar fallback for searchable (people) rows with no photo. */
function initialsFromLabel(label: string): string {
    const parts = label.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Leading visual for a rich option: cover thumbnail, or avatar (image /
 *  initials). Returns null for plain options so the numbered badge shows. */
function OptionMedia({ opt }: { opt: AiQuestionOption }) {
    if (opt.thumbnailUrl) {
        return (
            <span className="shrink-0 size-14 rounded-[8px] overflow-hidden bg-[var(--colors-bg-tertiary)] relative">
                <Image src={opt.thumbnailUrl} alt="" fill sizes="56px" className="object-cover" />
            </span>
        );
    }
    if (opt.iconTile) {
        return (
            <span className="shrink-0 size-14 rounded-[8px] border border-[var(--colors-border-secondary)] bg-[var(--colors-bg-secondary)] flex items-center justify-center">
                <Plus className="size-5 text-[var(--colors-text-quaternary)]" />
            </span>
        );
    }
    if (opt.avatarUrl) {
        return (
            <span className="shrink-0 size-8 rounded-full overflow-hidden bg-[var(--colors-bg-tertiary)] relative">
                <Image src={opt.avatarUrl} alt="" fill sizes="32px" className="object-cover" />
            </span>
        );
    }
    if (opt.avatarInitials) {
        return (
            <span className="shrink-0 size-8 rounded-full bg-[var(--colors-bg-tertiary)] flex items-center justify-center text-[12px] font-semibold text-[var(--colors-text-tertiary)]">
                {opt.avatarInitials}
            </span>
        );
    }
    return null;
}

export function AiQuestionPrompt({ questions, onComplete, onStep, onGroupAction, className, compact = false }: AiQuestionPromptProps) {
    const total = questions.length;
    const [step, setStep] = useState(0);
    // Per-step working state; committed answers accumulate in `answers`.
    const [selectedId, setSelectedId] = useState<string | null>(null); // single-select
    const [checkedIds, setCheckedIds] = useState<string[]>([]);        // multi-select
    const [otherText, setOtherText] = useState("");
    const [query, setQuery] = useState("");                            // searchable filter
    const [imageDataUrl, setImageDataUrl] = useState<string | null>(null); // kind: "image"
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [answers, setAnswers] = useState<AiQuestionAnswer[]>([]);

    const q = questions[step];
    const kind: AiQuestionKind = q.kind ?? "radio";
    const isMulti = kind === "checkbox";
    const isSearchable = kind === "searchable";
    const isGrouped = kind === "grouped";
    const isImage = kind === "image";
    const allowOther = isImage ? false : (q.allowOther ?? !isMulti); // checkbox opts in explicitly; image never
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
        setImageDataUrl(prior?.kind === "image" ? prior.dataUrl : null);
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
    // Read a picked cover-image file as a data URL and hold it locally. The
    // URL is committed as an { kind: "image" } answer on Continue — never as
    // free text, so a base64 blob is never relayed through the model.
    const handleImageFile = (file: File | undefined) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") setImageDataUrl(reader.result);
        };
        reader.readAsDataURL(file);
    };
    // Commit the current question's working answer WITHOUT advancing — so a
    // checkbox (equipment) is saved when the user pages away instead of needing
    // a Confirm button, and a radio selection is preserved when navigating.
    const commitCurrent = () => {
        if (isImage) {
            if (imageDataUrl) commit({ kind: "image", dataUrl: imageDataUrl });
        } else if (isMulti) {
            if (checkedIds.length > 0 || otherText.trim()) commit(buildAnswer());
        } else if (selectedId !== null) {
            commit(buildAnswer());
        }
    };
    const handlePrev = () => {
        if (step > 0) { commitCurrent(); loadStep(step - 1); }
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

    // Pager chevrons are free NAVIGATION, both directions — the user can page
    // ahead to read question 2 (or back to review/change an earlier one)
    // without having answered the current one. (Answering still happens by
    // picking an option, which commits + auto-advances in compact mode.) The
    // forward chevron is only disabled on the very last question.
    const canGoNext = step + 1 < total;
    const goNext = () => {
        if (step + 1 < total) { commitCurrent(); loadStep(step + 1); }
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
        // "Pick a custom date" — a plain borderless row with a calendar icon
        // that opens the date picker; the picked ISO becomes the answer.
        if (opt.datePicker) {
            return (
                <div key={opt.id} className="px-1.5 py-0.5">
                    <DatePicker
                        value=""
                        onChange={(iso) => advance({ kind: "other", text: iso })}
                        minDate={opt.minDateISO}
                        placeholder={opt.label}
                        triggerClassName="w-full flex items-center gap-3 pl-2 pr-2.5 py-1.5 rounded-[6px] text-left text-[14px] font-medium text-[var(--colors-text-quaternary)] hover:bg-[var(--colors-bg-secondary)] transition-colors"
                    />
                </div>
            );
        }
        const active = isMulti ? checkedIds.includes(opt.id) : selectedId === opt.id;
        // Searchable lists are people-pickers (instructors) — every row reads as
        // a round avatar. When a person has no photo we derive initials from the
        // label so the list stays visually consistent instead of half-avatars,
        // half numbered-badges.
        const derivedInitials =
            isSearchable && !opt.thumbnailUrl && !opt.avatarUrl && !opt.avatarInitials && !opt.iconTile
                ? initialsFromLabel(opt.label)
                : undefined;
        const mediaOpt: AiQuestionOption = derivedInitials
            ? { ...opt, avatarInitials: derivedInitials }
            : opt;
        const hasMedia = !!(mediaOpt.thumbnailUrl || mediaOpt.avatarUrl || mediaOpt.avatarInitials || mediaOpt.iconTile);
        return (
            <div key={opt.id} className="px-1.5 py-0.5">
                <button
                    type="button"
                    onClick={() => selectOption(opt)}
                    disabled={opt.disabled}
                    aria-pressed={active}
                    className={cn(
                        "w-full flex gap-3 pr-2.5 py-1.5 rounded-[6px] text-left transition-colors",
                        // Grouped rows (rooms under a branch header) get a deeper
                        // indent; everything else the standard inset.
                        isGrouped ? "pl-6" : "pl-2",
                        // Rich cards (thumbnail + description + chips) align to
                        // the top so the image lines up with the title; plain
                        // rows stay vertically centered.
                        hasMedia ? "items-start" : "items-center",
                        opt.disabled
                            ? "opacity-50 cursor-not-allowed"
                            : active
                              ? "bg-[#f1f7f4]"
                              : "hover:bg-[var(--colors-bg-secondary)]",
                    )}
                >
                    {/* Leading selector. Multi → checkbox square. Single with
                        media → the media tile. Single plain → numbered badge. */}
                    {isMulti ? (
                        <span
                            className={cn(
                                "shrink-0 size-5 flex items-center justify-center rounded-[5px] border transition-colors",
                                active ? "border-[#164e52] bg-[#164e52]" : "border-[var(--colors-border-primary)] bg-white",
                            )}
                        >
                            {active && <Check className="size-3.5 text-white" strokeWidth={3} />}
                        </span>
                    ) : hasMedia || isGrouped ? null : (
                        // Grouped lists (rooms by branch) don't use numbered
                        // badges — they read as a plain indented list.
                        <span
                            className={cn(
                                "shrink-0 size-6 flex items-center justify-center rounded-[6px] border text-[12px] font-medium",
                                active ? "border-[var(--colors-secondary-300)] text-[var(--colors-text-secondary)] bg-white" : "border-[var(--colors-border-secondary)] text-[var(--colors-text-quaternary)] bg-white",
                            )}
                        >
                            {badgeNumber}
                        </span>
                    )}

                    {hasMedia && <OptionMedia opt={mediaOpt} />}

                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-[14px] leading-5 min-w-0">
                            {opt.lead && <span className="text-[var(--colors-text-quaternary)] font-normal shrink-0">{opt.lead}</span>}
                            <span className="text-[var(--colors-text-secondary)] font-medium truncate">{opt.label}</span>
                            {opt.metaLabel && <span className="shrink-0 text-[13px] font-normal text-[var(--colors-fg-quaternary)]">{opt.metaLabel}</span>}
                            {/* Person rows (searchable instructor picker) always
                                show a rating — a new instructor with no reviews
                                yet reads as "0 (0 reviews)" rather than nothing. */}
                            {(opt.rating != null || (isSearchable && hasMedia)) && (
                                <span className="shrink-0 inline-flex items-center gap-0.5 text-[12px] font-medium text-[var(--colors-text-quaternary)]">
                                    <Star01 className="size-3 text-[#f79009] fill-[#f79009]" />
                                    {(opt.rating ?? 0).toFixed(1)}
                                    <span className="text-[var(--colors-fg-quaternary)] font-normal">({fmtReviews(opt.ratingCount ?? 0)} reviews)</span>
                                </span>
                            )}
                        </span>
                        {opt.subtitle && (
                            <span className="text-[12px] leading-[18px] text-[var(--colors-text-quaternary)] truncate">{opt.subtitle}</span>
                        )}
                        {opt.disabled && opt.disabledReason && (
                            <span className="text-[12px] leading-[18px] text-[#b42318] truncate">{opt.disabledReason}</span>
                        )}
                        {opt.attributes && opt.attributes.length > 0 && (
                            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                                {opt.attributes.map((a, ai) => {
                                    const AttrIcon = ATTR_ICONS[ai];
                                    return (
                                        <span key={ai} className="inline-flex items-center gap-1 text-[12px] text-[var(--colors-text-quaternary)] leading-[18px]">
                                            {AttrIcon && <AttrIcon className="size-4 shrink-0" />}
                                            {a}
                                        </span>
                                    );
                                })}
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
                    {!isMulti && active && !opt.badge && <ChevronRight className="size-4 text-[var(--colors-text-quaternary)] shrink-0" />}
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
                "w-full bg-white border border-[var(--colors-border-secondary)] rounded-[12px] overflow-hidden",
                "shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]",
                className,
            )}
        >
            {/* Header — title + pager. */}
            <div className="h-[52px] flex items-center gap-2 px-3.5 border-b border-[var(--colors-border-secondary)]">
                <p className="flex-1 min-w-0 text-[16px] font-semibold text-[var(--colors-text-primary)] leading-6 truncate">
                    {q.title ?? "Question"}
                </p>
                {total > 1 && (
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            type="button"
                            onClick={handlePrev}
                            disabled={step === 0}
                            aria-label="Previous question"
                            className="size-6 flex items-center justify-center rounded-[3px] text-[var(--colors-text-quaternary)] enabled:hover:bg-[var(--colors-bg-secondary)] disabled:opacity-40 transition-colors"
                        >
                            <ChevronLeft className="size-3.5" />
                        </button>
                        <span className="text-[14px] font-medium text-[var(--colors-text-quaternary)] tabular-nums px-1">
                            {pager}
                        </span>
                        <button
                            type="button"
                            onClick={canGoNext ? goNext : undefined}
                            disabled={!canGoNext}
                            aria-label="Next question"
                            className="size-6 flex items-center justify-center rounded-[3px] text-[var(--colors-text-quaternary)] enabled:hover:bg-[var(--colors-bg-secondary)] disabled:opacity-40 transition-colors"
                        >
                            <ChevronRight className="size-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Search box (searchable kind). */}
            {isSearchable && (
                <div className="px-3.5 pt-3 pb-1">
                    <div className="flex items-center gap-2 h-10 px-3 rounded-[8px] border border-[var(--colors-border-primary)] bg-white">
                        <SearchLg className="size-4 text-[var(--colors-text-quaternary)] shrink-0" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={q.searchPlaceholder ?? "Search…"}
                            className="flex-1 min-w-0 bg-transparent text-[14px] text-[var(--colors-text-secondary)] placeholder:text-[var(--colors-text-quaternary)] outline-none"
                        />
                    </div>
                </div>
            )}

            {/* Image upload body (kind: "image"). Own Skip / Continue buttons
                since the shared footer is hidden for this kind — the picked
                file is held locally and committed as an { kind: "image" }
                answer, never relayed as text. */}
            {isImage ? (
                <div className="p-3.5 flex flex-col gap-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageFile(e.target.files?.[0])}
                    />
                    {imageDataUrl ? (
                        <div className="relative w-full h-[140px] rounded-[10px] overflow-hidden border border-[var(--colors-border-secondary)] bg-[var(--colors-bg-tertiary)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imageDataUrl} alt="Class cover" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => { setImageDataUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                aria-label="Remove image"
                                className="absolute top-2 right-2 size-8 flex items-center justify-center rounded-[8px] bg-white/90 hover:bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.15)] transition-colors"
                            >
                                <Trash01 className="size-4 text-[#b42318]" />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-[140px] flex flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[var(--colors-border-primary)] bg-[var(--colors-bg-secondary)] hover:bg-[var(--colors-bg-tertiary)] transition-colors"
                        >
                            <span className="size-10 rounded-full bg-white border border-[var(--colors-border-secondary)] flex items-center justify-center">
                                <UploadCloud02 className="size-5 text-[var(--colors-text-tertiary)]" />
                            </span>
                            <span className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Upload class image</span>
                            <span className="text-[12px] text-[var(--colors-text-quaternary)]">PNG or JPG</span>
                        </button>
                    )}
                    <div className="flex items-center justify-end gap-3 pt-0.5">
                        <Button variant="secondary-gray" size="sm" onClick={() => advance({ kind: "skipped" })}>
                            Skip
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            disabled={!imageDataUrl}
                            onClick={() => advance(imageDataUrl ? { kind: "image", dataUrl: imageDataUrl } : { kind: "skipped" })}
                        >
                            Continue
                        </Button>
                    </div>
                </div>
            ) : (
            /* Options list. */
            <div className="flex flex-col py-1 max-h-[360px] overflow-y-auto">
                {isGrouped && groups
                    ? groups.map((g, gi) => (
                          <div key={g.label} className={cn("flex flex-col", gi > 0 && "border-t border-[var(--colors-border-secondary)]")}>
                              {g.label && (
                                  <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
                                      <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--colors-text-primary)]">
                                          {q.groupIcon === "building" && <Building01 className="size-4 text-[var(--colors-text-quaternary)]" />}
                                          {g.label}
                                      </span>
                                      {q.groupActionLabel && onGroupAction && (
                                          <button
                                              type="button"
                                              onClick={() => onGroupAction(g.label)}
                                              className="flex items-center gap-1 text-[13px] font-semibold text-[var(--colors-text-secondary)] hover:text-[var(--colors-text-primary)] transition-colors"
                                          >
                                              <Plus className="size-3.5" />
                                              {q.groupActionLabel}
                                          </button>
                                      )}
                                  </div>
                              )}
                              {g.options.map((opt) => renderOption(opt, nextBadge()))}
                          </div>
                      ))
                    : visibleOptions.map((opt) => renderOption(opt, nextBadge()))}

                {isSearchable && visibleOptions.length === 0 && (
                    <p className="px-4 py-6 text-center text-[13px] text-[var(--colors-text-quaternary)]">No matches.</p>
                )}
            </div>
            )}

            {/* Footer. Hidden in the compact single-select panel (the composer
                handles free text and option-clicks auto-advance). Checkbox
                ALWAYS shows a footer, even compact — multi-select can't
                auto-advance. */}
            {(() => {
                // The image kind renders its own Skip / Continue inside the
                // body — no shared footer.
                if (isImage) return null;
                // Free-text row: non-compact always (per allowOther); compact
                // ONLY when the question opts in explicitly (q.allowOther===true)
                // — e.g. "Custom X weeks" / "Type number of classes". Actions
                // stay hidden in the compact paged panel.
                const showOther = allowOther && (!compact || q.allowOther === true);
                // Compact single-select normally auto-advances on option click, so
                // no button — BUT when the user types a custom value there's no
                // click to advance on, so surface a "Continue" button once they've
                // typed something.
                const compactCustom = compact && !isMulti && showOther && otherText.trim().length > 0;
                const showActions = !compact || (isMulti && step + 1 >= total) || compactCustom;
                const actionLabel = compactCustom
                    ? "Continue"
                    : step + 1 >= total ? "Done" : isMulti ? "Confirm" : "Next";
                if (!showOther && !showActions) return null;
                return (
                <div className="flex flex-col">
                    {/* Free-text "other" / "Something else" row. */}
                    {showOther && (
                        <div className="px-1.5 py-0.5">
                            <div
                                className={cn(
                                    "w-full flex items-center gap-3 pl-2 pr-2.5 py-1.5 rounded-[6px] transition-colors",
                                    otherSelected ? "bg-[#f1f7f4]" : "hover:bg-[var(--colors-bg-secondary)]",
                                )}
                            >
                                <span className="shrink-0 size-6 flex items-center justify-center rounded-[6px] border border-[var(--colors-border-secondary)] bg-white">
                                    <PencilLine className="size-3 text-[var(--colors-text-quaternary)]" />
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
                                    className="flex-1 min-w-0 bg-transparent text-[14px] text-[var(--colors-text-secondary)] placeholder:text-[var(--colors-text-quaternary)] outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* Actions. In the compact PAGED panel a checkbox commits
                        when the user pages to the next question (no Confirm
                        button) — a button only appears when the checkbox is the
                        LAST question and there's nothing to page to. The inline
                        (non-compact) panel keeps the full Skip / Next footer. */}
                    {showActions && (
                        <div className="flex items-center justify-end gap-3 px-3 py-2">
                            {!compact && (
                                <Button variant="secondary-gray" size="sm" onClick={handleSkip}>
                                    Skip
                                </Button>
                            )}
                            <Button variant="primary" size="sm" disabled={!canAdvance} onClick={handleNext}>
                                {actionLabel}
                            </Button>
                        </div>
                    )}
                </div>
                );
            })()}
        </div>
    );
}
