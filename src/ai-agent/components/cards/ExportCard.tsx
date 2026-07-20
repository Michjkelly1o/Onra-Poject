// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · ExportCard (Phase 5 — CSV only, PDF hidden)
// ─────────────────────────────────────────────────────────────────────────────
//
// Rendered when the model calls `export_report`. Shows a compact tile with
// the report title, row/column counts, and a Download CSV button.
//
// PDF export is deliberately hidden in Phase 5 (per plan doc): jspdf +
// jspdf-autotable are ~150KB and land in Phase 5.5 alongside the gsap
// chart animations. Add the button back there — the API route already
// serves JSON at `?format=json` which is what the PDF renderer consumes.
//
// Ported from ONRA AI-Agent/components/ExportCard.tsx. CSV download flow
// preserved verbatim; the PDF handler + jsPDF dynamic imports stripped.

"use client";

import { DownloadCloud01, File04 } from "@untitledui/icons";
import { cn } from "@/lib/utils";

type Props = {
    exportId: string;
    title: string;
    rowCount: number;
    columns: string[];
};

export function ExportCard({ exportId, title, rowCount, columns }: Props) {
    function downloadCsv() {
        const a = document.createElement("a");
        a.href = `/api/ai-agent/export?id=${encodeURIComponent(exportId)}&format=csv`;
        a.download = "";
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    return (
        <div
            className={cn(
                "bg-white border border-[#e4e7ec] rounded-xl p-4",
                "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                "flex items-start gap-3",
            )}
        >
            {/* Icon */}
            <div className="size-10 rounded-lg bg-[#f9fafb] border border-[#eaecf0] flex items-center justify-center shrink-0">
                <File04 className="size-5 text-[#667085]" />
            </div>

            {/* Copy */}
            <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[#101828] leading-5 truncate">
                    {title}
                </div>
                <div className="text-[13px] text-[#667085] leading-5 truncate">
                    {rowCount} rows · {columns.length} columns · report ready
                </div>
            </div>

            {/* Action */}
            <button
                type="button"
                onClick={downloadCsv}
                className={cn(
                    "shrink-0 h-9 px-3 inline-flex items-center gap-2 rounded-md",
                    "bg-[#c4edd6] text-[#0c2d34] text-[13px] font-medium border-1 border-white/[0.12]",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)]",
                    "hover:bg-[#aad4bd] transition-colors",
                )}
            >
                <DownloadCloud01 className="size-4" />
                Download CSV
            </button>
        </div>
    );
}
