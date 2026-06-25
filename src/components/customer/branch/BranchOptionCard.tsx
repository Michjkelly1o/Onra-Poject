"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Select branch option card (PRD 13 §6.1 / Select branch screen)
// ─────────────────────────────────────────────────────────────────────────────
//
// Built from scratch for the member surface (not the admin DS). Figma:
// 9ByGNc4N7Vw3BLMHyaWJ1j node 3306-65583/65599. A tappable card: a "modern"
// featured building icon, the branch name + address (or the "All branches"
// blurb), and — for a real branch — an operational-status row (Open/Closed +
// today's hours). The selected card gets a 2px brand-green border.

import { Building01, Clock } from "@untitledui/icons";

export interface BranchOptionCardProps {
    /** Branch name, or "All branches". */
    name: string;
    /** Address line, or the All-branches blurb. */
    subtitle: string;
    /** Whether this card is the staged selection (2px brand border). */
    selected: boolean;
    onClick: () => void;
    /** Open/closed + hours for today. Omitted for the "All branches" card. */
    operational?: { isOpen: boolean; hoursLabel: string };
}

export function BranchOptionCard({ name, subtitle, selected, onClick, operational }: BranchOptionCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={`flex w-full flex-col gap-3 rounded-2xl bg-white p-4 text-left transition-colors ${
                selected ? "border-2 border-[#7ba08c]" : "border border-[#e4e7ec]"
            }`}
        >
            <div className="flex flex-col gap-3">
                {/* Featured icon — modern style (border + skeuomorphic shadow). */}
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#e4e7ec] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                    <Building01 className="size-5 text-[#344054]" aria-hidden />
                </span>

                <div className="flex flex-col gap-1">
                    <p className="text-base font-semibold leading-6 text-[#101828]">{name}</p>
                    <p className="line-clamp-2 text-sm font-normal leading-5 text-[#475467]">{subtitle}</p>
                </div>
            </div>

            {operational && (
                <div className="flex items-center gap-2">
                    <span
                        className={`flex items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-[18px] ${
                            operational.isOpen
                                ? "border-[#abefc6] bg-[#ecfdf3] text-[#067647]"
                                : "border-[#fecdca] bg-[#fef3f2] text-[#b42318]"
                        }`}
                    >
                        {operational.isOpen ? "Open" : "Closed"}
                    </span>
                    <span className="flex items-center gap-1 rounded-full border border-[#e4e7ec] bg-[#f9fafb] px-2 py-0.5 text-xs font-medium leading-[18px] text-[#344054]">
                        <Clock className="size-3 shrink-0 text-[#344054]" aria-hidden />
                        {operational.hoursLabel}
                    </span>
                </div>
            )}
        </button>
    );
}
