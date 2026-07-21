"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared ToolbarFilter button
// ─────────────────────────────────────────────────────────────────────────────
//
// Icon-only Button with a `FilterLines` glyph + hover tooltip. Client
// 2026-07-21 asked us to trim toolbar copy across the app — Filter,
// Search, and Export all collapse to their icons and disclose their
// name on hover instead. The green-dot indicator stays visible when
// any filter is applied so the active state reads at a glance without
// opening the panel.
//
// Signature preserved from the v1 text-only version so consumers only
// re-render with the new chrome. `label` still controls the tooltip
// copy (defaults to "Filter"), but the button no longer renders the
// text — only the tooltip does.

import { FilterLines } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "./IconTooltip";

export interface ToolbarFilterProps {
    onClick: () => void;
    /** True when any filter is currently applied — renders the green dot
     *  indicator in the top-right corner of the filter icon. */
    active?: boolean;
    /** Tooltip label on hover. Defaults to "Filter". */
    label?: string;
}

export function ToolbarFilter({ onClick, active = false, label = "Filter" }: ToolbarFilterProps) {
    return (
        <IconTooltip label={label}>
            <Button
                variant="secondary-gray"
                size="icon"
                aria-label={label}
                onClick={onClick}
            >
                <span className="relative inline-flex">
                    <FilterLines className="w-4 h-4" />
                    {active && (
                        <span
                            className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white"
                            aria-hidden
                        />
                    )}
                </span>
            </Button>
        </IconTooltip>
    );
}
