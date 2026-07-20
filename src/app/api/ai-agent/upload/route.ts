// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai-agent/upload — Migration file parser
// ─────────────────────────────────────────────────────────────────────────────
//
// Accepts a CSV via multipart/form-data, parses it server-side, and
// returns the full ParsedFile shape (columns + rows) to the client.
// Unlike the POC's version, this endpoint does NOT persist anything —
// the client keeps the parsed file in React state and includes it in
// every subsequent chat POST body (see /api/ai-agent/route.ts).
//
// Body:  multipart/form-data { file: File }
// Reply: { fileId, filename, columns: string[], rows: Record<string,string>[] }
//
// Guardrails:
//   • Admin-only (same feature-flag gate as the main chat endpoint).
//   • 2MB file size cap so we don't blow the request body limit on
//     subsequent chat turns that carry the whole file back to the
//     server.
//
// The `fileId` is a client-side identifier for the demo — nothing
// server-side keys off it. Kept in the response so the AI's cards can
// reference the upload by id if we ever need a stable handle.

import { isAiAgentEnabled } from "@/ai-agent/flags";
import { parseCsv } from "@/ai-agent/migration/parser";
import type { UserRole } from "@/types";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(req: Request) {
    // Role gate — same as the main chat route. The role comes as a form
    // field since multipart bodies can't easily carry JSON context.
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

    const text = await file.text();
    const { columns, rows } = parseCsv(text);

    if (columns.length === 0) {
        return Response.json(
            { error: "That file didn't contain a header row I could read." },
            { status: 400 },
        );
    }

    return Response.json({
        fileId: `up_${Date.now().toString(36)}`,
        filename: file.name || "upload.csv",
        columns,
        rows,
    });
}
