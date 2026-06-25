"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared ToolbarFilter button
// ─────────────────────────────────────────────────────────────────────────────
//
// Secondary-gray Button with a `FilterLines` icon and an optional little
// green dot in the top-right of the icon when any filter is active.
// Replaces ~10 lines per file × 11 files = ~110 duplicate lines.
//
// Renders:
//
//   <Button variant="secondary-gray" size="md" leftIcon={...}>Filter</Button>
//
// with the standard chrome already baked in. Pass `active` true when any
// filter is applied so the dot indicator shows.

import { FilterLines } from "@untitledui/icons";
import { Button } from "@/components/ui/button";

export interface ToolbarFilterProps {
    onClick: () => void;
    /** True when any filter is currently applied — renders the green dot
     *  indicator in the top-right corner of the filter icon. */
    active?: boolean;
    /** Button label. Defaults to "Filter". */
    label?: string;
}

export function ToolbarFilter({ onClick, active = false, label = "Filter" }: ToolbarFilterProps) {
    return (
        <Button
            variant="secondary-gray"
            size="md"
            leftIcon={
                <div className="relative">
                    <FilterLines className="w-4 h-4" />
                    {active && (
                        <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" />
                    )}
                </div>
            }
            onClick={onClick}
        >
            {label}
        </Button>
    );
}
