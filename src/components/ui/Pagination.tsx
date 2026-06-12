"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared table pagination
// ─────────────────────────────────────────────────────────────────────────────
//
// Lifted VERBATIM from the admin Customers list at
// [/admin/customers/page.tsx:493](src/app/admin/customers/page.tsx) and
// also matches the admin class-detail tabs pagination. Every admin table
// uses this exact chrome:
//
//   • per-page button with bottom-anchored dropdown (10 / 20 / 30)
//   • "per page" label next to the button
//   • flex spacer
//   • "Page X of Y" caption + Previous + Next buttons (disabled when at
//     edge with muted styling)
//
// Drop into any list/table: `<Pagination page total pageSize onPage onPageSize />`.

import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "@untitledui/icons";
import { cn } from "@/lib/utils";

export interface PaginationProps {
    page: number;
    total: number;
    pageSize: number;
    onPage: (p: number) => void;
    onPageSize: (s: number) => void;
}

export function Pagination({ page, total, pageSize, onPage, onPageSize }: PaginationProps) {
    const [sizeOpen, setSizeOpen] = useState(false);
    const sizeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) {
            if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) setSizeOpen(false);
        }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div className="shrink-0 flex items-center gap-3 py-4 border-t border-[#e4e7ec]">
            <div ref={sizeRef} className="relative flex items-center gap-2 flex-1">
                <button
                    type="button"
                    onClick={() => setSizeOpen(p => !p)}
                    className="flex items-center gap-1 px-3 py-[7px] border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] text-[14px] font-semibold text-[#344054]"
                >
                    {pageSize}
                    <ChevronLeft className="w-4 h-4 text-[#667085] rotate-90" />
                </button>
                {sizeOpen && (
                    <div className="absolute bottom-[calc(100%+4px)] left-0 z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 min-w-[80px]">
                        {[10, 20, 30].map(s => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => { onPageSize(s); setSizeOpen(false); }}
                                className={cn(
                                    "flex items-center w-full px-4 py-[9px] text-[14px] font-medium hover:bg-[#f9fafb] transition-colors",
                                    s === pageSize ? "text-[#101828] font-semibold" : "text-[#344054]",
                                )}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}
                <span className="text-[14px] font-medium text-[#344054]">per page</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-[14px] font-medium text-[#344054] whitespace-nowrap">
                    Page {page} of {totalPages}
                </span>
                <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => onPage(Math.max(1, page - 1))}
                    className={cn(
                        "px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page <= 1
                            ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white"
                            : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]",
                    )}
                >
                    Previous
                </button>
                <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => onPage(Math.min(totalPages, page + 1))}
                    className={cn(
                        "px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page >= totalPages
                            ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white"
                            : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]",
                    )}
                >
                    Next
                </button>
            </div>
        </div>
    );
}
