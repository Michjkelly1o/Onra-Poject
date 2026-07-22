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

import { Button } from "@/components/ui/button";
import { Sliders } from "@/components/icons/Sliders";
import { IconTooltip } from "./IconTooltip";

export interface ToolbarFilterProps {
    onClick: () => void;
    /** True when any filter is currently applied — renders the green dot
     *  indicator in the top-right corner of the filter icon. */
    active?: boolean;
    /** Tooltip label on hover. Defaults to "Filter". */
    label?: string;
    /** Visual size — matches ToolbarSearch's size prop so a filter next
     *  to a compact search in a customer-profile inner tab stays the
     *  same height. Defaults to "md" (h-10 w-10). */
    size?: "md" | "sm";
}

export function ToolbarFilter({ onClick, active = false, label = "Filter", size = "md" }: ToolbarFilterProps) {
    return (
        <IconTooltip label={label}>
            <Button
                variant="secondary-gray"
                size={size === "md" ? "icon" : "icon-sm"}
                aria-label={label}
                onClick={onClick}
            >
                <span className="relative inline-flex">
                    {/* Custom Sliders glyph — replaces FilterLines
                        (client 2026-07-22). Rendered at 20 px so the
                        drawn area matches other 4-hi icons after their
                        stroke padding; strokeWidth={2} keeps weight
                        consistent with sibling icons. */}
                    <Sliders className="w-5 h-5" />
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
