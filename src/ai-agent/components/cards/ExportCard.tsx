// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · ExportCard (Client 2026-07-24 — Figma 528:108156 rebuild)
// ─────────────────────────────────────────────────────────────────────────────
//
// The "your report is ready" chat bubble. Renders as a file card with the
// report filename, a coloured file-type badge, and a single Download button.
// The format the user picked earlier in the flow (CSV / XLSX / PDF — asked
// via ask_questions BEFORE the model calls `export_report`) drives:
//   • the filename extension shown in the label
//   • the badge colour + text
//   • the download path — CSV / XLSX stream from /api/ai-agent/export as
//     attachments; PDF renders client-side via jspdf + jspdf-autotable so
//     the same card body works for every format the user picked.
//
// Client 2026-07-24 — PDF is a first-class export format alongside CSV
// and XLSX. The earlier "PDF isn't available yet" restriction has been
// lifted now that jspdf ships in the same file bubble.

"use client";

import { useState } from "react";
import { Download01, File04 } from "@untitledui/icons";
import { cn } from "@/lib/utils";

export type ExportFormat = "csv" | "xlsx" | "pdf";

type Props = {
    exportId: string;
    title: string;
    rowCount: number;
    columns: string[];
    format?: ExportFormat;
};

// File-type badge colour + label per Figma 528:108156 conventions.
// PDF stays red (design 3 shows PDF), CSV goes success-600 (green),
// XLSX goes the same green — Excel's brand green is close enough to
// the DS's success-600 that we don't need a bespoke token.
const BADGE_STYLE: Record<ExportFormat, { bg: string; label: string }> = {
    csv:  { bg: "#079455", label: "CSV"  },
    xlsx: { bg: "#079455", label: "XLSX" },
    pdf:  { bg: "#d92d20", label: "PDF"  },
};

const SUBTITLE: Record<ExportFormat, string> = {
    csv:  "Spreadsheet · CSV",
    xlsx: "Spreadsheet · XLSX",
    pdf:  "Document · PDF",
};

export function ExportCard({ exportId, title, rowCount, columns, format = "csv" }: Props) {
    const [busy, setBusy] = useState(false);
    const badge = BADGE_STYLE[format];
    // Filename echoed in the card label. Same slug logic the API uses,
    // so what the user sees matches what the browser saves.
    const safeName =
        (title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "export");
    const filename = `${safeName}.${format}`;

    async function handleDownload() {
        setBusy(true);
        try {
            if (format === "pdf") {
                // Legacy client-side PDF path — kept so a PDF response
                // doesn't hard-crash. The API doesn't return application/
                // pdf yet; we render via jspdf as the previous card did.
                const res = await fetch(
                    `/api/ai-agent/export?id=${encodeURIComponent(exportId)}&format=json`,
                );
                const data: { title: string; columns: string[]; rows: string[][] } =
                    await res.json();
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
                doc.save(filename);
                return;
            }
            // csv + xlsx — server streams the bytes with a Content-
            // Disposition header, so an anchor click triggers the
            // save-as dialog directly.
            const a = document.createElement("a");
            a.href = `/api/ai-agent/export?id=${encodeURIComponent(exportId)}&format=${format}`;
            a.download = "";
            document.body.appendChild(a);
            a.click();
            a.remove();
        } finally {
            setBusy(false);
        }
    }

    // Silence unused var — kept in the props for future card variants
    // (row-count subtitle, column preview, etc.).
    void rowCount;
    void columns;

    return (
        <div
            className={cn(
                "bg-white border border-[#e4e7ec] rounded-2xl p-4",
                "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                "flex items-center justify-between gap-3 max-w-[612px]",
            )}
        >
            <div className="flex items-center gap-3 min-w-0">
                {/* File-type icon — the DS File04 glyph with a coloured
                    format badge stamped over the lower-left corner, per
                    Figma 528:108156. */}
                <div className="relative size-10 shrink-0">
                    <File04 className="absolute inset-0 size-10 text-[#667085]" />
                    <span
                        className="absolute left-0 bottom-1 px-1 py-[2px] rounded-[2px] text-[10px] font-bold text-white leading-none"
                        style={{ backgroundColor: badge.bg }}
                    >
                        {badge.label}
                    </span>
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[14px] font-medium text-[#101828] leading-5 truncate">
                        {filename}
                    </span>
                    <span className="text-[14px] text-[#475467] leading-5">
                        {SUBTITLE[format]}
                    </span>
                </div>
            </div>
            <button
                type="button"
                onClick={handleDownload}
                disabled={busy}
                className={cn(
                    "shrink-0 h-9 px-3 inline-flex items-center gap-1 rounded-md",
                    "bg-white text-[#344054] text-[14px] font-semibold leading-5",
                    "border-1 border-[#d0d5dd]",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)]",
                    "hover:bg-[#f9fafb] transition-colors",
                    "disabled:opacity-60 disabled:cursor-not-allowed",
                )}
            >
                <Download01 className="size-5" />
                {busy ? "Downloading…" : "Download"}
            </button>
        </div>
    );
}
