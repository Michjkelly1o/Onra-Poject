// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai-agent/upload — Migration file parser
// ─────────────────────────────────────────────────────────────────────────────
//
// Accepts a CSV / XLSX / XLS via multipart/form-data, parses it
// server-side, and returns the full ParsedFile shape (columns + rows)
// to the client. Unlike the POC's version, this endpoint does NOT
// persist anything — the client keeps the parsed file in React state
// and includes it in every subsequent chat POST body (see
// /api/ai-agent/route.ts).
//
// Body:  multipart/form-data { file: File, role: UserRole }
// Reply: { fileId, filename, columns: string[], rows: Record<string,string>[] }
//
// Guardrails:
//   • Admin-only (same feature-flag gate as the main chat endpoint).
//   • File-size cap shared with the client via AI_AGENT_MAX_UPLOAD_BYTES.
//
// Client 2026-07-24 — XLSX / XLS support added via SheetJS. Same
// output shape as CSV so the model's inspect_source flow doesn't
// care about the source format. First sheet is used; all cells are
// coerced to strings to match the CSV branch.

import { isAiAgentEnabled, AI_AGENT_MAX_UPLOAD_BYTES } from "@/ai-agent/flags";
import { parseCsv } from "@/ai-agent/migration/parser";
import { getFileType, isMigrationParsable } from "@/ai-agent/lib/file-type";
import type { UserRole } from "@/types";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

const MAX_BYTES = AI_AGENT_MAX_UPLOAD_BYTES;

export async function POST(req: Request) {
    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return Response.json(
            { error: "Expected multipart/form-data body." },
            { status: 400 },
        );
    }

    const role = (form.get("role") as UserRole | null) ?? undefined;
    if (!isAiAgentEnabled(role)) {
        return Response.json(
            { error: "AI Agent is admin-only." },
            { status: 403 },
        );
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
        return Response.json(
            { error: "`file` field is required (must be a File)." },
            { status: 400 },
        );
    }

    if (file.size > MAX_BYTES) {
        return Response.json(
            {
                error: `File is too large — max ${MAX_BYTES / 1024 / 1024}MB. Try splitting the export or filtering to fewer rows.`,
            },
            { status: 413 },
        );
    }

    // Client 2026-07-24 — branch on the file's actual extension so a
    // user renaming an .xlsx to .csv (or vice-versa) still hits the
    // right parser. Anything else is rejected up-front with a message
    // the client also shows during pre-flight.
    const fileType = getFileType(file.name || "");
    if (!isMigrationParsable(fileType)) {
        return Response.json(
            {
                error:
                    fileType === "pdf"
                        ? "PDF import isn't ready yet — please export your data to CSV, XLSX, or XLS."
                        : "Migration only accepts CSV, XLSX, or XLS files.",
            },
            { status: 400 },
        );
    }

    let columns: string[] = [];
    let rows: Record<string, string>[] = [];

    if (fileType === "csv") {
        const text = await file.text();
        const parsed = parseCsv(text);
        columns = parsed.columns;
        rows = parsed.rows;
    } else {
        // XLSX / XLS — SheetJS handles both formats from the same
        // read call. We use the first sheet only (matches Excel's
        // "the sheet you'd open into" default) and coerce every cell
        // to a string so downstream tools don't have to think about
        // number/date formatting.
        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const sheetName = wb.SheetNames[0];
            if (!sheetName) {
                return Response.json(
                    { error: "That workbook didn't contain any sheets." },
                    { status: 400 },
                );
            }
            const sheet = wb.Sheets[sheetName];
            // header:1 = array-of-arrays so we can pull the header row
            // manually. defval:"" gives us empty strings for blank
            // cells (rather than undefined) which matches the CSV
            // parser's output.
            const aoa: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: "",
                raw: false,
                blankrows: false,
            });
            if (aoa.length === 0) {
                return Response.json(
                    { error: "That sheet is empty." },
                    { status: 400 },
                );
            }
            const headerRow = aoa[0].map((c) => (c == null ? "" : String(c).trim()));
            columns = headerRow.filter((h) => h.length > 0);
            rows = aoa.slice(1).map((row) => {
                const obj: Record<string, string> = {};
                for (let i = 0; i < headerRow.length; i++) {
                    const key = headerRow[i];
                    if (!key) continue;
                    const cell = row[i];
                    obj[key] = cell == null ? "" : String(cell);
                }
                return obj;
            });
        } catch {
            return Response.json(
                { error: "Couldn't read that spreadsheet — the file may be corrupted or password-protected." },
                { status: 400 },
            );
        }
    }

    if (columns.length === 0) {
        return Response.json(
            { error: "That file didn't contain a header row I could read." },
            { status: 400 },
        );
    }

    return Response.json({
        fileId: `up_${Date.now().toString(36)}`,
        filename: file.name || `upload.${fileType}`,
        columns,
        rows,
    });
}
