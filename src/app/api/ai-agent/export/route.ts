// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai-agent/export?id=…&format=csv|xlsx|json
// ─────────────────────────────────────────────────────────────────────────────
//
// Serves an ExportTable previously stashed by the `export_report` tool.
//   csv  → downloaded as text/csv attachment (Excel-friendly BOM prefix)
//   xlsx → downloaded as a real workbook, generated server-side via SheetJS
//   json → used client-side by the (now legacy) jspdf PDF path
//
// Client 2026-07-24 adds XLSX. PDF is out of scope for this pass but the
// json path stays so any existing PDF flow keeps working.
//
// Auth = capability: the exportId is unguessable and short-lived.

import { exportStore } from "@/ai-agent/data/export-store";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

function csvCell(s: string): string {
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "";
    const format = url.searchParams.get("format") ?? "csv";
    const table = exportStore.get(id);
    if (!table) {
        return new Response("Export not found or expired", { status: 404 });
    }

    const safeName =
        table.title
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-+|-+$/g, "")
            .toLowerCase() || "export";

    if (format === "json") {
        return Response.json(table);
    }

    if (format === "xlsx") {
        // Build a workbook from the columns + rows in the stashed table.
        // Header row first, then every data row — matches the CSV layout.
        const aoa = [table.columns, ...table.rows];
        const worksheet = XLSX.utils.aoa_to_sheet(aoa);
        const workbook = XLSX.utils.book_new();
        // Sheet name: max 31 chars per Excel spec, no forbidden chars.
        const sheetName = (table.title || "Report")
            .replace(/[\\/*?:[\]]/g, " ")
            .slice(0, 31) || "Report";
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        const buffer: Buffer = XLSX.write(workbook, {
            type: "buffer",
            bookType: "xlsx",
        });
        // Copy into a fresh Uint8Array so its underlying ArrayBuffer is
        // the plain (non-SharedArrayBuffer) variant Blob's BlobPart
        // union expects on the Response type.
        const bytes = new Uint8Array(buffer);
        return new Response(bytes, {
            headers: {
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${safeName}.xlsx"`,
            },
        });
    }

    // CSV — BOM prepended so Excel opens with UTF-8 encoding.
    const lines = [table.columns, ...table.rows]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n");
    return new Response("﻿" + lines, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${safeName}.csv"`,
        },
    });
}
