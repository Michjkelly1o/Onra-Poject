"use client";

import * as React from "react";
import { AlignLeft } from "@untitledui/icons";
import { cn } from "@/lib/utils";

// ─── Onra DS — Empty State ────────────────────────────────────────────────────
//
// The "tiny faux-table-row + title + subtitle" empty state used everywhere a
// list/grid has no rows. Originally inlined per-page; centralised here so the
// POS catalog, schedule list, etc. all share one shape.
//
// `icon` lets each surface inject a module-appropriate glyph (e.g. AlignLeft
// for tables, ShoppingBag03 for POS). Defaults to AlignLeft so existing
// table call-sites can drop the prop and look unchanged.

export interface EmptyStateProps {
    title: string;
    subtitle: string;
    /** Glyph rendered inside the inner tile. Defaults to AlignLeft. */
    icon?: React.ComponentType<{ className?: string }>;
    /** When true, the tile is absolutely positioned to fill its parent. Use
     *  inside a `relative` container with a fixed minHeight. Default true to
     *  preserve the original behaviour. */
    absolute?: boolean;
    className?: string;
}

export function EmptyState({ title, subtitle, icon: Icon = AlignLeft, absolute = true, className }: EmptyStateProps) {
    return (
        <div className={cn(
            "flex items-center justify-center pointer-events-none",
            absolute ? "absolute inset-0" : "w-full h-full",
            className,
        )}>
            <div className="flex flex-col items-center gap-6 pointer-events-auto">
                <div className="bg-[#f9fafb] rounded-[16px] p-[10px] w-[360px] flex gap-[10px] items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <div className="bg-white rounded-[10px] w-[51px] h-[51px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02)]">
                        <div className="bg-[#f9fafb] rounded-[7px] w-[31px] h-[31px] flex items-center justify-center">
                            <Icon className="w-[18px] h-[18px] text-[#98a2b3]" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-[8px] flex-1 min-w-0">
                        <div className="bg-[#f2f4f7] h-[13px] w-[82px] rounded-full" />
                        <div className="bg-[#f2f4f7] h-[13px] w-full rounded-full" />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1 text-center max-w-[320px]">
                    <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">{title}</p>
                    <p className="text-[14px] text-[#475467] leading-[20px]">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}
