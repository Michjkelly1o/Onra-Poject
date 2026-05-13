"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronSelectorVertical } from "@untitledui/icons";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

export interface SortState {
    key: string | null;
    dir: SortDir;
}

/**
 * Tri-state sort hook for tables. Click cycles: desc → asc → off.
 *
 * Pass an item array and a record of comparators keyed by column id. Returns
 * `sorted`, the current `sortKey` / `sortDir`, and a `toggle(key)` action.
 */
export function useSort<T>(
    items: T[],
    comparators: Record<string, (a: T, b: T) => number>,
    initial?: SortState
) {
    const [sortKey, setSortKey] = useState<string | null>(initial?.key ?? null);
    const [sortDir, setSortDir] = useState<SortDir>(initial?.dir ?? "desc");

    function toggle(key: string) {
        if (sortKey !== key) {
            setSortKey(key);
            setSortDir("desc");
            return;
        }
        if (sortDir === "desc") {
            setSortDir("asc");
            return;
        }
        setSortKey(null);
    }

    const sorted = useMemo(() => {
        if (!sortKey || !comparators[sortKey]) return items;
        const cmp = comparators[sortKey];
        const copy = [...items];
        copy.sort((a, b) => (sortDir === "asc" ? cmp(a, b) : cmp(b, a)));
        return copy;
    }, [items, sortKey, sortDir, comparators]);

    return { sorted, sortKey, sortDir, toggle };
}

/**
 * Clickable column-header label with a sort indicator.
 * Renders the neutral chevron-selector when not the active column, an arrow
 * up/down when active. Use inside a `<th>`.
 */
export function SortableHeader({
    children, sortKey, currentSort, dir, onSort, align = "left", className,
}: {
    children: ReactNode;
    sortKey: string;
    currentSort: string | null;
    dir: SortDir;
    onSort: (key: string) => void;
    align?: "left" | "right";
    className?: string;
}) {
    const active = currentSort === sortKey;
    const Icon = !active ? ChevronSelectorVertical : dir === "asc" ? ArrowUp : ArrowDown;
    return (
        <button type="button" onClick={() => onSort(sortKey)}
            className={cn(
                "inline-flex items-center gap-1 hover:text-[#101828] transition-colors select-none",
                align === "right" && "flex-row-reverse",
                className,
            )}>
            <span>{children}</span>
            <Icon className={cn("w-3.5 h-3.5 shrink-0", active ? "text-[#475467]" : "text-[#98a2b3]")} />
        </button>
    );
}
