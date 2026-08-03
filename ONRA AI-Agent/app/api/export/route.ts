// Serves a stored export as CSV (streamed attachment) or JSON (for the client to
// build a PDF). Data lives in the ExportStore, never in the model context.
import { exportStore } from "@/lib/export/ExportStore";

function csvCell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const format = url.searchParams.get("format") ?? "csv";
  const table = exportStore.get(id);
  if (!table) return new Response("Export not found or expired", { status: 404 });

  const safeName =
    table.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() ||
    "export";

  if (format === "json") {
    return Response.json(table);
  }

  // CSV
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
