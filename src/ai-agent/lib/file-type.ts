// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · File-type helper
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-07-24 — the composer's FileChip and the user-message bubble
// both used to render a hardcoded "CSV" badge regardless of the actual
// file type, so uploading an image (in non-migration modes) rendered as
// a bright-green CSV badge which read as broken.
//
// This helper maps a filename → concrete file-type category, then to
// the matching icon asset the client dropped in /public/filetypeicon/*.
// UNKNOWN types return null so the caller can render a neutral fallback
// (a generic document icon or nothing) instead of a wrong badge.

export type FileTypeCategory =
    | "csv"
    | "xlsx"
    | "xls"
    | "pdf"
    | "doc"
    | "docx"
    | "png"
    | "jpg"
    | "jpeg"
    | "img"
    | "unknown";

/** Extract the file-type category from a filename. Case-insensitive on
 *  the extension. Files without an extension (or with only a dot at
 *  the start, e.g. `.env`) resolve to "unknown". */
export function getFileType(filename: string): FileTypeCategory {
    if (!filename) return "unknown";
    const idx = filename.lastIndexOf(".");
    if (idx < 0 || idx === filename.length - 1) return "unknown";
    const ext = filename.slice(idx + 1).toLowerCase();
    switch (ext) {
        case "csv":  return "csv";
        case "xlsx": return "xlsx";
        case "xls":  return "xls";
        case "pdf":  return "pdf";
        case "doc":  return "doc";
        case "docx": return "docx";
        case "png":  return "png";
        case "jpg":  return "jpg";
        case "jpeg": return "jpeg";
        case "gif":
        case "webp":
        case "svg":
        case "bmp":
        case "heic":
        case "avif":
            return "img";
        default:
            return "unknown";
    }
}

/** Public URL of the icon that matches this category. Returns null for
 *  "unknown" so the caller can decide the fallback (generic doc icon,
 *  neutral placeholder, etc.). Every returned URL is served straight
 *  from /public and needs no runtime asset pipeline. */
export function fileTypeIconUrl(type: FileTypeCategory): string | null {
    if (type === "unknown") return null;
    return `/filetypeicon/${type}.webp`;
}

/** Short uppercase label used inside the small pill next to the icon
 *  (e.g. "CSV", "PDF"). Falls back to "FILE" for unknown types. */
export function fileTypeLabel(type: FileTypeCategory): string {
    if (type === "unknown") return "FILE";
    return type.toUpperCase();
}

/** Accept-attribute string for the file input. Migration mode is
 *  narrower (structured data only, no images) since a photo can't be
 *  parsed into rows. Non-migration modes stay wide so the paperclip
 *  works as a general chat attachment. */
export const MIGRATION_ACCEPT_TYPES =
    ".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,application/vnd.ms-excel,.pdf,application/pdf";

export const GENERAL_ACCEPT_TYPES =
    ".csv,text/csv,.xlsx,.xls,.pdf,image/*,.doc,.docx,.txt";

/** True for file-type categories the migration upload path can turn
 *  into rows (CSV via the existing text parser, XLSX / XLS via SheetJS
 *  on the server). PDF is offered in the picker for consistency with
 *  the client's list but the upload path rejects it with a helpful
 *  error until we ship a PDF-table extractor. */
export function isMigrationParsable(type: FileTypeCategory): boolean {
    return type === "csv" || type === "xlsx" || type === "xls";
}
