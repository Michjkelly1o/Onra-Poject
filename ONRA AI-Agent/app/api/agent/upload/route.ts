// Accepts the migration source file (CSV), parses it server-side, stores it in
// the MigrationStore under the caller's sessionId, and returns a small reference
// (never the raw rows) — so big files never enter the model context.
import { parseCsv, migrationStore, type ParsedFile } from "@/lib/migration/MigrationStore";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const sessionId = String(form.get("sessionId") || "");
  if (!(file instanceof File) || !sessionId) {
    return Response.json({ error: "file and sessionId required" }, { status: 400 });
  }
  const text = await file.text();
  const { columns, rows } = parseCsv(text);
  const parsed: ParsedFile = {
    fileId: `up_${Date.now().toString(36)}`,
    filename: file.name || "upload.csv",
    columns,
    rows,
  };
  migrationStore.saveFile(sessionId, parsed);

  // Only the reference goes back to the client (and thence to the model).
  return Response.json({
    fileId: parsed.fileId,
    filename: parsed.filename,
    rowCount: rows.length,
    columns,
  });
}
