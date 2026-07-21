"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — RadioCard (patterns/)
// ─────────────────────────────────────────────────────────────────────────────
//
// Single-select "option card" primitive. Mirrors the visual shape of the
// existing `ToggleCard` (see FreezePolicyPanel.tsx) but carries a radio
// dot instead of a switch, and stacks vertically (one card per option)
// rather than horizontally.
//
// First shipped for the Freeze policy v2 "Billing during a freeze" and
// "Who can freeze" sections (Figma reference — client 2026-07-20).
// Kept generic + reusable — future forms with 2–4 clearly-worded options
// each carrying a title + description should reuse this rather than
// rolling their own.
//
// Selected state matches the DS convention set by ToggleCard: mint-green
// border (`#7ba08c`) + subtle mint tint background. "Recommended" pill
// uses the mint palette so it never fights the selected state.

import { cn } from "@/lib/utils";

export interface RadioCardOption<K extends string = string> {
    /** Machine key returned via onChange. */
    key: K;
    /** Row title — bold, black. */
    label: string;
    /** One-line supporting text under the title. */
    description?: string;
    /** When true, adds a mint "Recommended" pill next to the label. */
    recommended?: boolean;
}

export function RadioCardGroup<K extends string>({
    options,
    value,
    onChange,
    ariaLabel,
}: {
    options: RadioCardOption<K>[];
    value: K;
    onChange: (next: K) => void;
    /** Group aria-label — the section title, e.g. "Billing during a freeze". */
    ariaLabel: string;
}) {
    return (
        <div
            role="radiogroup"
            aria-label={ariaLabel}
            className="flex flex-col gap-2"
        >
            {options.map(opt => {
                const selected = opt.key === value;
                return (
                    <button
                        key={opt.key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange(opt.key)}
                        className={cn(
                            "text-left rounded-[12px] border-1 px-4 py-3 flex items-start gap-3 transition-colors",
                            selected
                                ? "border-[#7ba08c] bg-[#f5fffa]"
                                : "border-[#e4e7ec] bg-white hover:bg-[#fafafa]",
                        )}
                    >
                        {/* Radio dot — solid mint ring + inner dot when
                            selected; grey outline only when idle. */}
                        <span
                            className={cn(
                                "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                selected
                                    ? "border-[#658774]"
                                    : "border-[#d0d5dd]",
                            )}
                            aria-hidden
                        >
                            {selected && (
                                <span className="w-2.5 h-2.5 rounded-full bg-[#658774]" />
                            )}
                        </span>
                        <div className="flex-1 flex flex-col gap-1 min-w-0">
                            <p className="text-[14px] font-semibold text-[#101828] leading-[20px] flex items-center gap-2 flex-wrap">
                                <span>{opt.label}</span>
                                {opt.recommended && (
                                    <span className="inline-flex items-center h-5 px-1.5 rounded-full bg-[#ecfdf3] border border-[#abefc6] text-[11px] font-medium text-[#067647] whitespace-nowrap">
                                        Recommended
                                    </span>
                                )}
                            </p>
                            {opt.description && (
                                <p className="text-[14px] text-[#667085] leading-[20px]">
                                    {opt.description}
                                </p>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
