"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    SearchMd, FilterLines, Plus, Grid01,
    ClockFastForward, Users01, User01, XClose, AlignLeft,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore, resolveTemplateCoverImage } from "@/lib/store";
import type { ClassTemplate, TemplateStatus } from "@/lib/store";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { StatusBadge } from "@/components/patterns/StatusBadge";

// ─── Local types ─────────────────────────────────────────────────────────────

type LocationType = "Group" | "Private";

// ─── Removed mock data (now in Zustand store) ─────────────────────────────────


const ALL_STATUSES: TemplateStatus[] = ["Active", "Archived", "Inactive"];
// Filter categories come from the LIVE `classCategories` store slice
// (Phase 4 wiring) so adding / editing / deleting categories in the
// Booking Rules module reflects here on the same render.
const LOCATION_TYPES: LocationType[] = ["Group", "Private"];

// ─── Class template card ──────────────────────────────────────────────────────

function ClassTemplateCard({ template }: { template: ClassTemplate }) {
    const router = useRouter();
    // Effective banner — template's own upload, else the parent category's
    // image (Phase 4 sync), else nothing.
    const classCategories = useAppStore(s => s.classCategories);
    const effectiveCover  = resolveTemplateCoverImage(template, classCategories);
    return (
        <div
            onClick={() => router.push(`/class-types/${template.id}?returnTo=${encodeURIComponent("/admin/class-types")}`)}
            className={cn(
                "bg-white border border-[#e4e7ec] rounded-[16px] overflow-hidden flex flex-col cursor-pointer",
                "transition-all duration-150",
                "hover:border-[#658774] hover:shadow-[0px_4px_8px_-2px_rgba(16,24,40,0.08),0px_2px_4px_-2px_rgba(16,24,40,0.03)]",
            )}>
            {/* Banner */}
            <div className="relative h-[156px] w-full overflow-hidden shrink-0" style={{ backgroundColor: template.coverColor }}>
                {effectiveCover && (
                    <img
                        src={effectiveCover}
                        alt={template.name}
                        className={cn("absolute inset-0 w-full h-full object-cover", template.status === "Inactive" && "grayscale")}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                )}
                <div className="absolute top-3 right-3 z-10">
                    <StatusBadge type="template" status={template.status} size="lg" />
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
                <div className="flex flex-col gap-1">
                    <h3 className="font-medium text-[18px] leading-[28px] text-[#101828]">{template.name}</h3>
                    <p className="text-[14px] text-[#667085] leading-[20px] line-clamp-2">{template.description}</p>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <Grid01 className="w-4 h-4 text-[#667085] shrink-0" />
                            <span className="text-[14px] text-[#667085] truncate">{template.category}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <User01 className="w-4 h-4 text-[#667085] shrink-0" />
                            <span className="text-[14px] text-[#667085] truncate">{template.locationType}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <ClockFastForward className="w-4 h-4 text-[#667085] shrink-0" />
                            <span className="text-[14px] text-[#667085]">{template.durationMin} min</span>
                        </div>
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <Users01 className="w-4 h-4 text-[#667085] shrink-0" />
                            <span className="text-[14px] text-[#667085]">{template.capacity} max</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Pill toggle ──────────────────────────────────────────────────────────────

function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "px-4 py-2 rounded-[8px] text-[14px] font-medium transition-all whitespace-nowrap",
                selected
                    ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                    : "bg-white border border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]",
            )}
        >
            {label}
        </button>
    );
}

// ─── Filter panel (right slide-in) ───────────────────────────────────────────

interface FilterState {
    statuses: string[];
    categories: string[];
}

interface FilterPanelProps {
    open: boolean;
    onClose: () => void;
    applied: FilterState;
    onApply: (filters: FilterState) => void;
}

function FilterPanel({ open, onClose, applied, onApply }: FilterPanelProps) {
    // Live category list — drives the Categories pill row below.
    const allCategories = useAppStore(s => s.classCategories).map(c => c.name);
    const [pending, setPending] = useState<FilterState>({ statuses: [], categories: [] });

    // Sync pending from applied when panel opens
    useEffect(() => {
        if (open) setPending({ statuses: [...applied.statuses], categories: [...applied.categories] });
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, onClose]);

    function toggle(arr: string[], val: string): string[] {
        return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
    }

    const hasSelection = pending.statuses.length > 0 || pending.categories.length > 0;


    return (
        <SlidePanel open={open} onClose={onClose} width={400} zIndex={50}>
{/* Header */}
                <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-medium text-[18px] leading-[28px] text-[#101828]">Filter</p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors"
                    >
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-6">
                    {/* Status */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {ALL_STATUSES.map(s => (
                                <Pill
                                    key={s}
                                    label={s}
                                    selected={pending.statuses.includes(s)}
                                    onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, s) }))}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                    {/* Categories */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Categories</p>
                        <div className="flex flex-wrap gap-2">
                            {allCategories.map(c => (
                                <Pill
                                    key={c}
                                    label={c}
                                    selected={pending.categories.includes(c)}
                                    onClick={() => setPending(p => ({ ...p, categories: toggle(p.categories, c) }))}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button
                        variant="secondary-gray"
                        size="md"
                        disabled={!hasSelection}
                        onClick={() => {
                            setPending({ statuses: [], categories: [] });
                            onApply({ statuses: [], categories: [] });
                            onClose();
                        }}
                    >
                        Clear filter
                    </Button>
                    <Button
                        variant="primary"
                        size="md"
                        disabled={!hasSelection}
                        onClick={() => { onApply(pending); onClose(); }}
                    >
                        Apply
                    </Button>
                </div>
        </SlidePanel>
    );
}

// ─── Empty state illustration ─────────────────────────────────────────────────

function EmptyStateIllustration() {
    return (
        <div className="bg-[#f9fafb] rounded-[16px] p-[10px] w-[360px] flex gap-[10px] items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)] shrink-0">
            <div className="bg-white rounded-[10px] w-[51px] h-[51px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02),-3px_4.4px_10.2px_rgba(0,0,0,0.02)]">
                <div className="bg-[#f9fafb] rounded-[7px] w-[31px] h-[31px] flex items-center justify-center shadow-[0px_1.5px_1.5px_rgba(0,0,0,0.04)]">
                    <AlignLeft className="w-[18px] h-[18px] text-[#98a2b3]" />
                </div>
            </div>
            <div className="flex flex-col gap-[8px] flex-1 min-w-0">
                <div className="bg-[#f2f4f7] h-[13px] w-[82px] rounded-full" />
                <div className="bg-[#f2f4f7] h-[13px] w-full rounded-full" />
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClassTypesPage() {
    const router = useRouter();
    const { classTemplates } = useAppStore();
    const [search, setSearch]           = useState("");
    const [filterOpen, setFilterOpen]   = useState(false);
    const [applied, setApplied]         = useState<FilterState>({ statuses: [], categories: [] });

    const hasActiveFilters = applied.statuses.length > 0 || applied.categories.length > 0;
    const isDataEmpty = classTemplates.length === 0;

    const visible = classTemplates.filter(t => {
        const matchesSearch   = t.name.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase());
        const matchesStatus   = applied.statuses.length === 0 || applied.statuses.includes(t.status);
        const matchesCategory = applied.categories.length === 0 || applied.categories.includes(t.category);
        return matchesSearch && matchesStatus && matchesCategory;
    });

    return (
        <div className="flex flex-col gap-6 flex-1 relative">
            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <p className="text-[16px] text-[#667085]">Total</p>
                    <p className="text-[16px] font-medium text-[#101828]">{visible.length} class templates</p>
                </div>

                {/* Search */}
                <div className="relative w-[220px]">
                    <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-5 h-5 text-[#667085]" />
                    <input
                        type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search template..."
                        className="h-10 w-full pl-[40px] pr-[14px] bg-white border border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>

                {/* Filter button */}
                <Button
                    variant="secondary-gray"
                    size="md"
                    leftIcon={
                        <div className="relative">
                            <FilterLines className="w-4 h-4" />
                            {hasActiveFilters && (
                                <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border border-white" />
                            )}
                        </div>
                    }
                    onClick={() => setFilterOpen(true)}
                >
                    Filter
                </Button>

                {/* Add template */}
                <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />} onClick={() => router.push(`/class-types/new?returnTo=${encodeURIComponent("/admin/class-types")}`)}>
                    Add template
                </Button>
            </div>

            {/* Card grid / empty states */}
            {isDataEmpty ? (
                /* True empty — absolute overlay so it centers in the full page, not just below the toolbar */
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-6 pointer-events-auto">
                        <EmptyStateIllustration />
                        <div className="flex flex-col items-center gap-1 text-center max-w-[352px]">
                            <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">No class templates yet</p>
                            <p className="text-[14px] text-[#475467] leading-[20px]">Create your first template to start scheduling classes.</p>
                        </div>
                    </div>
                </div>
            ) : visible.length === 0 ? (
                /* Filtered/search empty */
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <p className="text-[16px] font-medium text-[#344054]">No templates found</p>
                    <p className="text-[14px] text-[#667085]">
                        {hasActiveFilters ? "Try adjusting your filters" : `No results for "${search}"`}
                    </p>
                    {hasActiveFilters && (
                        <button type="button" onClick={() => setApplied({ statuses: [], categories: [] })}
                            className="text-[14px] text-[#658774] hover:underline font-medium">
                            Clear all filters
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-4">
                    {visible.map(t => <ClassTemplateCard key={t.id} template={t} />)}
                </div>
            )}

            {/* Filter panel */}
            <FilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={applied}
                onApply={setApplied}
            />

        </div>
    );
}
