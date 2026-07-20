// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · ExportCard (Phase 5.5 — CSV + PDF)
// ─────────────────────────────────────────────────────────────────────────────
//
// Rendered when the model calls `export_report`. Two download buttons —
// CSV (streamed directly from the API) and PDF (fetches JSON from the
// API and renders client-side via jspdf + jspdf-autotable).
//
// jspdf + autotable are dynamically imported on-click so the ~150KB pair
// only lands in the bundle when a user actually taps Download PDF, not
// on the initial /ai-agent page load. Phase 5 shipped CSV only; Phase
// 5.5 adds the PDF button back.
//
// Ported from ONRA AI-Agent/components/ExportCard.tsx (2-button layout
// + jspdf brand colour + landscape auto-detect all preserved).

"use client";

import { useState } from "react";
import { DownloadCloud01, File04 } from "@untitledui/icons";
import { cn } from "@/lib/utils";

type Props = {
    exportId: string;
    title: string;
    rowCount: number;
    columns: string[];
};

export function ExportCard({ exportId, title, rowCount, columns }: Props) {
    const [busy, setBusy] = useState<null | "pdf">(null);

    function downloadCsv() {
        const a = document.createElement("a");
        a.href = `/api/ai-agent/export?id=${encodeURIComponent(exportId)}&format=csv`;
        a.download = "";
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    async function downloadPdf() {
        setBusy("pdf");
        try {
            const res = await fetch(
                `/api/ai-agent/export?id=${encodeURIComponent(exportId)}&format=json`,
            );
            const data: { title: string; columns: string[]; rows: string[][] } =
                await res.json();
            // Dynamic-import so ~150KB only lands when the button is tapped.
            const { jsPDF } = await import("jspdf");
            const autoTable = (await import("jspdf-autotable")).default;
            const doc = new jsPDF({
                orientation: data.columns.length > 4 ? "landscape" : "portrait",
            });
            doc.setFontSize(16);
            doc.setTextColor("#101828");
            doc.text(data.title, 14, 18);
            doc.setFontSize(9);
            doc.setTextColor("#667085");
            doc.text(
                `Onra · ${new Date().toISOString().slice(0, 10)} · ${data.rows.length} rows`,
                14,
                25,
            );
            autoTable(doc, {
                head: [data.columns],
                body: data.rows,
                startY: 30,
                styles: { fontSize: 9, cellPadding: 3 },
                headStyles: { fillColor: [101, 135, 116], textColor: 255 },
                alternateRowStyles: { fillColor: [244, 247, 245] },
            });
            const safe =
                data.title
                    .replace(/[^a-z0-9]+/gi, "-")
                    .replace(/^-+|-+$/g, "")
                    .toLowerCase() || "export";
            doc.save(`${safe}.pdf`);
        } finally {
            setBusy(null);
        }
    }

    return (
        <div
            className={cn(
                "bg-white border border-[#e4e7ec] rounded-xl p-4",
                "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                "flex items-start gap-3 flex-wrap",
            )}
        >
            {/* Icon */}
            <div className="size-10 rounded-lg bg-[#f9fafb] border border-[#eaecf0] flex items-center justify-center shrink-0">
                <File04 className="size-5 text-[#667085]" />
            </div>

            {/* Copy */}
            <div className="flex-1 min-w-[180px]">
                <div className="text-[14px] font-semibold text-[#101828] leading-5 truncate">
                    {title}
                </div>
                <div className="text-[13px] text-[#667085] leading-5 truncate">
                    {rowCount} rows · {columns.length} columns · report ready
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    onClick={downloadCsv}
                    className={cn(
                        "h-9 px-3 inline-flex items-center gap-2 rounded-md",
                        "bg-[#c4edd6] text-[#0c2d34] text-[13px] font-medium border-1 border-white/[0.12]",
                        "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)]",
                        "hover:bg-[#aad4bd] transition-colors",
                    )}
                >
                    <DownloadCloud01 className="size-4" />
                    Download CSV
                </button>
                <button
                    type="button"
                    onClick={downloadPdf}
                    disabled={busy === "pdf"}
                    className={cn(
                        "h-9 px-3 inline-flex items-center gap-2 rounded-md",
                        "bg-white text-[#344054] text-[13px] font-medium border border-[#d0d5dd]",
                        "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                        "hover:bg-[#f9fafb] transition-colors",
                        "disabled:opacity-60 disabled:cursor-not-allowed",
                    )}
                >
                    <DownloadCloud01 className="size-4" />
                    {busy === "pdf" ? "Building PDF…" : "Download PDF"}
                </button>
            </div>
        </div>
    );
}
