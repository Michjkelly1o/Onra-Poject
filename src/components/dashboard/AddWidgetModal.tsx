"use client";

import { useState, useEffect, useRef } from "react";
import { XClose, SearchMd } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { WIDGET_CATALOG, type WidgetCategory } from "./widget-catalog";
import { DashboardWidgetCard } from "./DashboardWidgetCard";

// Tabs match the 6-category restructure (client 2026-07-20). Order is
// load-bearing — it's what the admin sees along the top of the picker.
// "Private sessions" + "Recovery" ship empty in commit A; their widgets
// land in commits B + C but the tabs stay clickable so the admin knows
// the sections exist.
const TABS: WidgetCategory[] = [
    "Financial",
    "Customer",
    "Classes",
    "Private sessions",
    "Recovery",
    "Marketing",
];

export interface AddWidgetModalProps {
    open: boolean;
    onClose: () => void;
    activeWidgetIds?: string[];
    onAdd?: (widgetId: string) => void;
    onRemove?: (widgetId: string) => void;
}

export function AddWidgetModal({
    open,
    onClose,
    activeWidgetIds = [],
    onAdd,
    onRemove,
}: AddWidgetModalProps) {
    const [activeTab, setActiveTab] = useState<WidgetCategory>("Financial");
    const [search, setSearch] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 80);
        else setSearch("");
    }, [open]);

    useEffect(() => {
        function handler(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        if (open) document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, onClose]);

    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    const visible = WIDGET_CATALOG.filter(w =>
        w.category === activeTab &&
        (search.trim() === "" || w.title.toLowerCase().includes(search.toLowerCase()))
    );

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-[#0c111d]/70" onClick={onClose} />

            {/* Modal — centered on screen (client Jul 2026, previously
                rendered as a bottom sheet). Rounded on all corners; drop
                shadow centered rather than bottom-anchored. */}
            <div className="relative w-[80vw] max-w-[1080px] h-[600px] max-h-[calc(100vh-48px)] bg-white rounded-[16px] border border-[#e4e7ec] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center gap-2 px-6 py-4 border-b border-[#e4e7ec] shrink-0">
                    <p className="flex-1 font-medium text-[18px] leading-[28px] text-[#101828]">Add widget</p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors"
                    >
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-6 py-4 shrink-0">
                    <div className="relative">
                        <SearchMd className="absolute left-[14px] top-1/2 -translate-y-1/2 w-5 h-5 text-[#667085]" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search..."
                            className="w-full h-[44px] pl-[42px] pr-4 border border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-all"
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6 shrink-0 border-b border-[#e4e7ec]">
                    <div className="flex gap-3">
                        {TABS.map(tab => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "h-8 pb-3 px-1 text-[14px] font-semibold transition-colors shrink-0",
                                    activeTab === tab
                                        ? "border-b-2 border-[#101828] text-[#101828]"
                                        : "text-[#667085] hover:text-[#344054]",
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Widget grid — scrollable */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6">
                    {visible.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-2">
                            <p className="text-[15px] font-medium text-[#344054]">
                                {search.trim()
                                    ? "No widgets found"
                                    : `${activeTab} widgets coming soon`}
                            </p>
                            <p className="text-[14px] text-[#667085]">
                                {search.trim()
                                    ? "Try a different search term or category"
                                    : "This section is scheduled for an upcoming release."}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-6">
                            {visible.map(w => {
                                const isActive = activeWidgetIds.includes(w.id);
                                return (
                                    <DashboardWidgetCard
                                        key={w.id}
                                        widgetId={w.id}
                                        action={isActive ? "kebab" : "add"}
                                        onAdd={() => { onAdd?.(w.id); }}
                                        onRemove={() => { onRemove?.(w.id); }}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
