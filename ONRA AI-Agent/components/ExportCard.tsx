"use client";
import { useState } from "react";

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
    a.href = `/api/export?id=${encodeURIComponent(exportId)}&format=csv`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function downloadPdf() {
    setBusy("pdf");
    try {
      const res = await fetch(`/api/export?id=${encodeURIComponent(exportId)}&format=json`);
      const data: { title: string; columns: string[]; rows: string[][] } = await res.json();
      // jsPDF + autotable, loaded on demand (client only).
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: data.columns.length > 4 ? "landscape" : "portrait" });
      doc.setFontSize(16);
      doc.setTextColor("#101828");
      doc.text(data.title, 14, 18);
      doc.setFontSize(9);
      doc.setTextColor("#667085");
      doc.text(`Onra · ${new Date().toISOString().slice(0, 10)} · ${data.rows.length} rows`, 14, 25);
      autoTable(doc, {
        head: [data.columns],
        body: data.rows,
        startY: 30,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [101, 135, 116], textColor: 255 },
        alternateRowStyles: { fillColor: [244, 247, 245] },
      });
      const safe = data.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "export";
      doc.save(`${safe}.pdf`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card exportcard">
      <div className="exporthead">
        <span className="exporticon">📄</span>
        <div>
          <div className="exporttitle">{title}</div>
          <div className="exportmeta">
            {rowCount} rows · {columns.length} columns · report ready
          </div>
        </div>
      </div>
      <div className="exportactions">
        <button className="mbtn primary" onClick={downloadCsv}>
          ⬇ Download CSV
        </button>
        <button className="mbtn" onClick={downloadPdf} disabled={busy === "pdf"}>
          {busy === "pdf" ? "Building PDF…" : "⬇ Download PDF"}
        </button>
      </div>
    </div>
  );
}
