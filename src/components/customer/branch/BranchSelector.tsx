"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — BranchSelector (shared)
// ─────────────────────────────────────────────────────────────────────────────
//
// The active-branch chip: pin + branch name (+ chevron when switchable). Reused
// across the Customer app (the Products header is branch-selector-only; Home/Search
// embed the same control). Full-width by default; tapping opens /customer/select-branch.

import { ChevronDown, MarkerPin01 } from "@untitledui/icons";

export function BranchSelector({
    branchName,
    canSwitch = true,
    onClick,
}: {
    branchName: string;
    canSwitch?: boolean;
    onClick?: () => void;
}) {
    const content = (
        <>
            <span className="flex min-w-0 flex-1 items-center gap-1">
                <MarkerPin01 className="size-5 shrink-0 text-[#667085]" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-base font-normal leading-6 text-[#667085]">{branchName}</span>
            </span>
            {canSwitch && <ChevronDown className="size-4 shrink-0 text-[#667085]" aria-hidden />}
        </>
    );
    const base = "flex w-full items-center gap-2 rounded-full border border-[#e4e7ec] bg-white px-3 py-2 text-left";
    if (!canSwitch) return <div className={base}>{content}</div>;
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={`Current studio: ${branchName}. Tap to switch studio.`}
            className={`${base} transition-colors active:bg-gray-50`}
        >
            {content}
        </button>
    );
}
