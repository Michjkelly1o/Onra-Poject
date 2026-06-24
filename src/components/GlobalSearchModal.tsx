"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Global search modal
// ─────────────────────────────────────────────────────────────────────────────
//
// Centered command-palette modal opened from the header trigger button.
// Reads results live via `useSearchIndex(query, category)` and renders them
// grouped under uppercase headings (PAGES / CUSTOMERS / CLASSES / PRODUCTS).
//
// Behavior — per the Brief:
//   • Click outside the card → close
//   • Esc → close
//   • Enter → navigate to the highlighted result + close
//   • ↑↓ → move highlight
//   • Successful navigation → close (handled at click time)
//   • Disabled-route results never appear (filtered inside useSearchIndex)
//   • Empty query → idle hint
//   • Query w/ zero matches → canonical `<EmptyState>` with `SearchLg`

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SearchLg, XClose } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import {
    useSearchIndex, groupResults,
    useDefaultSuggestions, readRecentResults, pushRecentResult,
    type SearchCategory, type SearchResult,
} from "@/lib/global-search";

const CATEGORIES: ("All" | SearchCategory)[] = [
    "All", "Pages", "Customers", "Instructors", "Classes", "Products",
];

export interface GlobalSearchModalProps {
    open: boolean;
    onClose: () => void;
}

export function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [query, setQuery]       = useState("");
    const [category, setCategory] = useState<"All" | SearchCategory>("All");
    const [highlight, setHighlight] = useState(0);
    const [recent, setRecent]     = useState<SearchResult[]>([]);
    const inputRef                = useRef<HTMLInputElement>(null);

    // Reset state every open — fresh slate. Also re-read recent from
    // localStorage so a result clicked in a previous session is reflected.
    useEffect(() => {
        if (!open) return;
        setQuery("");
        setCategory("All");
        setHighlight(0);
        setRecent(readRecentResults("All"));
        const t = setTimeout(() => inputRef.current?.focus(), 30);
        return () => clearTimeout(t);
    }, [open]);

    // Re-filter recent whenever the active chip changes.
    useEffect(() => {
        if (!open) return;
        setRecent(readRecentResults(category));
    }, [open, category]);

    // Esc → close.
    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const all         = useSearchIndex(query, category);
    const groups      = useMemo(() => groupResults(all, 5), [all]);
    const suggestions = useDefaultSuggestions(category);

    // Idle-state flat list: recent first, then default suggestions. Used
    // both for keyboard nav and grouped rendering below.
    const idleFlat = useMemo(() => {
        const recentIds = new Set(recent.map(r => r.id));
        const suggested = suggestions.filter(s => !recentIds.has(s.id));
        return [...recent, ...suggested];
    }, [recent, suggestions]);

    // Flatten for keyboard nav — items rendered in DOM order.
    const flat = useMemo(
        () => (query.trim() ? groups.flatMap(g => g.items) : idleFlat),
        [query, groups, idleFlat],
    );

    // Clamp highlight when results shrink as the user types.
    useEffect(() => {
        if (flat.length === 0) setHighlight(0);
        else if (highlight >= flat.length) setHighlight(flat.length - 1);
    }, [flat.length, highlight]);

    function navigateTo(r: SearchResult) {
        // Persist before navigating — opening the modal next time should
        // surface the just-clicked entry under "Recent".
        pushRecentResult(r);
        // Append `returnTo` so the destination detail page's close button
        // bounces back to wherever the modal was opened from. Preserve any
        // existing query string on the href.
        const sep = r.href.includes("?") ? "&" : "?";
        const returnTo = pathname ?? "/admin/dashboard";
        router.push(`${r.href}${sep}returnTo=${encodeURIComponent(returnTo)}`);
        onClose();
    }

    function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (flat.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight(h => Math.min(flat.length - 1, h + 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight(h => Math.max(0, h - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const target = flat[highlight];
            if (target) navigateTo(target);
        }
    }

    if (!open) return null;

    const idle      = query.trim().length === 0;
    const noResults = !idle && flat.length === 0;

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] w-full max-w-[640px] flex flex-col overflow-hidden">

                {/* ── Header — search input ─────────────────────────── */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e4e7ec]">
                    <SearchLg className="w-5 h-5 text-[#667085] shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => { setQuery(e.target.value); setHighlight(0); }}
                        onKeyDown={onInputKeyDown}
                        placeholder="Search for anything…"
                        className="flex-1 bg-transparent text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close search"
                        className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors text-[#667085]"
                    >
                        <XClose className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Category chips ────────────────────────────────── */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#e4e7ec] overflow-x-auto scrollbar-hide">
                    {CATEGORIES.map(c => {
                        const active = category === c;
                        return (
                            <button
                                key={c}
                                type="button"
                                onClick={() => { setCategory(c); setHighlight(0); }}
                                className={cn(
                                    // border-1 on BOTH states locks the pill width so
                                    // toggling active ↔ inactive doesn't shift sibling
                                    // chips. Only the color flips.
                                    "shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all whitespace-nowrap border-1",
                                    active
                                        ? "bg-[#e9fff3] border-[#7ba08c] text-[#344054]"
                                        : "bg-white border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]",
                                )}
                            >
                                {c}
                            </button>
                        );
                    })}
                </div>

                {/* ── Body — results / empty / idle ─────────────────── */}
                <div className="h-[380px] overflow-y-auto scrollbar-hide">
                    {noResults && (
                        <div className="relative h-full" style={{ minHeight: 380 }}>
                            <EmptyState
                                title="No results found"
                                subtitle="Try a different keyword or check spelling."
                                icon={SearchLg}
                            />
                        </div>
                    )}

                    {idle && (
                        <IdleBody
                            recent={recent}
                            suggestions={suggestions}
                            flat={flat}
                            highlight={highlight}
                            setHighlight={setHighlight}
                            navigateTo={navigateTo}
                        />
                    )}

                    {!idle && !noResults && (
                        <div className="py-2">
                            {groups.map(group => {
                                const flatIndexBase = flat.findIndex(r => r.id === group.items[0].id);
                                return (
                                    <section key={group.category}>
                                        <p className="px-4 pt-3 pb-1 text-[13px] font-medium text-[#667085]">
                                            {group.category}
                                        </p>
                                        {group.items.map((r, i) => {
                                            const flatIdx = flatIndexBase + i;
                                            const highlighted = flatIdx === highlight;
                                            return (
                                                <ResultRow
                                                    key={r.id}
                                                    result={r}
                                                    highlighted={highlighted}
                                                    onSelect={() => navigateTo(r)}
                                                    onHover={() => setHighlight(flatIdx)}
                                                />
                                            );
                                        })}
                                        {group.overflow > 0 && (
                                            <div className="px-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // "Show all" jumps the user to the category-scoped chip
                                                        // and keeps the typed query so they can keep refining.
                                                        setCategory(group.category);
                                                        setHighlight(0);
                                                        inputRef.current?.focus();
                                                    }}
                                                    className="block w-full text-left px-3 py-2 rounded-[8px] text-[13px] font-medium text-[#658774] hover:text-[#3b5446] hover:bg-[#f9fafb] transition-colors"
                                                >
                                                    Show all {group.overflow + group.items.length} results
                                                </button>
                                            </div>
                                        )}
                                    </section>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Idle body — Recent + Suggestions ───────────────────────────────────────

/** Idle-state body. Renders a "Recent" section above a "Suggestions"
 *  section when the user hasn't typed anything yet. Suggestions are filtered
 *  by the active chip via `useDefaultSuggestions(category)` upstream.
 *  Items already in Recent are dropped from Suggestions to avoid duplicates. */
function IdleBody({
    recent, suggestions, flat, highlight, setHighlight, navigateTo,
}: {
    recent: SearchResult[];
    suggestions: SearchResult[];
    flat: SearchResult[];
    highlight: number;
    setHighlight: (i: number) => void;
    navigateTo: (r: SearchResult) => void;
}) {
    const recentIds = new Set(recent.map(r => r.id));
    const visibleSuggestions = suggestions.filter(s => !recentIds.has(s.id));

    return (
        <div className="py-2">
            {recent.length > 0 && (
                <section>
                    <p className="px-4 pt-3 pb-1 text-[13px] font-medium text-[#667085]">
                        Recent
                    </p>
                    {recent.map(r => {
                        const flatIdx = flat.findIndex(x => x.id === r.id);
                        const highlighted = flatIdx === highlight;
                        return (
                            <ResultRow
                                key={r.id}
                                result={r}
                                highlighted={highlighted}
                                onSelect={() => navigateTo(r)}
                                onHover={() => flatIdx >= 0 && setHighlight(flatIdx)}
                            />
                        );
                    })}
                </section>
            )}

            {visibleSuggestions.length > 0 && (
                <section>
                    <p className="px-4 pt-3 pb-1 text-[13px] font-medium text-[#667085]">
                        Suggestions
                    </p>
                    {visibleSuggestions.map(r => {
                        const flatIdx = flat.findIndex(x => x.id === r.id);
                        const highlighted = flatIdx === highlight;
                        return (
                            <ResultRow
                                key={r.id}
                                result={r}
                                highlighted={highlighted}
                                onSelect={() => navigateTo(r)}
                                onHover={() => flatIdx >= 0 && setHighlight(flatIdx)}
                            />
                        );
                    })}
                </section>
            )}

            {recent.length === 0 && visibleSuggestions.length === 0 && (
                <p className="text-center text-[14px] text-[#667085] py-12 px-6">
                    Nothing to suggest here yet — try a different category.
                </p>
            )}
        </div>
    );
}

// ─── Result row ─────────────────────────────────────────────────────────────

function ResultRow({ result, highlighted, onSelect, onHover }: {
    result: SearchResult;
    highlighted: boolean;
    onSelect: () => void;
    onHover: () => void;
}) {
    const Icon = result.icon;
    // Outer `<div>` provides horizontal padding so the hover/highlight
    // background pulls inward from the modal edge instead of running flush.
    // Inner `<button>` carries the rounded hover/highlight bg — no green
    // ring, just the canonical gray fill consistent with every other DS
    // list row hover (e.g. Sidebar, Customer list, Schedule list).
    return (
        <div className="px-2">
            <button
                type="button"
                onClick={onSelect}
                onMouseEnter={onHover}
                className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-[8px] transition-colors",
                    highlighted ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]",
                )}
            >
                <ResultAvatar result={result} Icon={Icon} />
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-5 truncate">
                        {result.title}
                    </p>
                    {result.sublabel && (
                        <p className="text-[12px] text-[#667085] leading-4 truncate">
                            {result.sublabel}
                        </p>
                    )}
                </div>
            </button>
        </div>
    );
}

function ResultAvatar({ result, Icon }: {
    result: SearchResult;
    Icon: React.ComponentType<{ className?: string }>;
}) {
    // Customer / Instructor avatar — image else initials in a circle.
    // Same treatment for both since they both represent a person and the
    // seed shape (imageUrl + initials) is identical.
    if (result.category === "Customers" || result.category === "Instructors") {
        if (result.avatarImage) {
            return (
                <div className="w-8 h-8 rounded-full overflow-hidden bg-[#f2f4f7] border-1 border-[rgba(0,0,0,0.08)] shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result.avatarImage} alt="" className="w-full h-full object-cover" />
                </div>
            );
        }
        return (
            <div className="w-8 h-8 rounded-full bg-[#f2f4f7] border-1 border-[rgba(0,0,0,0.08)] flex items-center justify-center shrink-0">
                <span className="text-[12px] font-semibold text-[#475467]">
                    {result.avatarInitials || result.title.slice(0, 1).toUpperCase()}
                </span>
            </div>
        );
    }

    // Class template — cover image when present.
    if (result.category === "Classes" && result.avatarImage) {
        return (
            <div className="w-8 h-8 rounded-[6px] overflow-hidden bg-[#f2f4f7] border-1 border-[rgba(0,0,0,0.08)] shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.avatarImage} alt="" className="w-full h-full object-cover" />
            </div>
        );
    }

    // Generic — icon tile.
    return (
        <div className="w-8 h-8 rounded-[6px] bg-[#f2f4f7] border-1 border-[#e4e7ec] flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-[#475467]" />
        </div>
    );
}
