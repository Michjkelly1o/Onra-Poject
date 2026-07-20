// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai-agent/export?id=…&format=csv|json
// ─────────────────────────────────────────────────────────────────────────────
//
// Serves an ExportTable previously stashed by the `export_report` tool. CSV
// downloads as an attachment; JSON is used client-side to render the PDF via
// jspdf (Phase 5.5). The table lives entirely server-side (`export-store.ts`);
// the model context never carries the tabular bytes.
//
// Auth = capability: the exportId is unguessable and short-lived. If we ever
// need to lock it to a user we can stamp `userId` onto ExportTable and check
// against the session — not needed at Phase 3.
//
// Ported from ONRA AI-Agent/app/api/export/route.ts.

import { exportStore } from "@/ai-agent/data/export-store";

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
