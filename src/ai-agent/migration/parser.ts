// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration — pure CSV parser + planning helpers
// ─────────────────────────────────────────────────────────────────────────────
//
// Every function in this file is PURE — takes a ParsedFile in, returns a
// value out. NO side effects, NO globalThis / KV / Blob storage. The
// architectural swap from the POC (see the plan doc):
//
//   POC:   client uploads → server persists to `migrationStore` (globalThis
//          Map keyed by sessionId) → tools read from the store
//   Here:  client uploads → server parses + returns → CLIENT holds the
//          ParsedFile in React state → sends it back in every subsequent
//          request body → tools receive it as an arg
//
// Trade-off: request bodies for migration turns are larger (KBs, not
// bytes). Benefit: Vercel-safe out of the box (no Blob or KV setup, no
// warm-container assumption, no cold-start data loss). Same pattern as
// storeSnapshot for the Insight flow — client owns state, server is pure.
//
// Phase 9 (2026-07-20): every planning fn now takes an `entity` arg and
// routes to the matching EntityDef via `ENTITIES[entity]` for field
// list, synonym dict, validator, and dedupe key. Adding a new entity is
// one new file under `entities/` + one line in `entities/index.ts` —
// this file doesn't need to change.

import type { AuthContext } from "@/ai-agent/agent/auth";
import type {
    ParsedFile,
    MappingRow,
    BranchAssignment,
    MappingPreview,
} from "@/ai-agent/migration/migration-cards";
import {
    ENTITIES,
    normHeader,
    type EntityKey,
} from "@/ai-agent/migration/entities";

/** CSV parser with proper quoted-field handling.
 *
 *  RFC 4180 subset we handle:
 *    • Fields separated by an AUTO-DETECTED delimiter (see below),
 *      rows separated by LF or CRLF.
 *    • Fields optionally wrapped in double quotes.
 *    • Quoted fields may contain the delimiter AND newlines.
 *    • Escaped double-quote inside a quoted field is a doubled `""`.
 *    • UTF-8 BOM stripped on entry.
 *
 *  Client 2026-07-31 delimiter auto-detect — Numbers.app on macOS (and
 *  Excel in every EU locale) exports "CSV" with SEMICOLONS instead of
 *  commas whenever a cell might contain a comma-as-decimal separator or
 *  the OS locale uses `,` as the decimal mark. Same file opens fine in
 *  Numbers because it also auto-detects on read. Our earlier parser was
 *  comma-only, so a semicolon export landed as ONE giant header column
 *  and zero rows — admin sees "0 mapped, 1 need review" on the mapping
 *  card with the entire header line concatenated.
 *
 *  Detection algorithm — inspect the FIRST non-blank line (the header)
 *  outside of quoted spans and count `,`, `;`, and `\t` occurrences. The
 *  most frequent one wins; comma is the tiebreaker so pure-comma files
 *  behave exactly as before. */
function detectDelimiter(src: string): "," | ";" | "\t" {
    // Walk the first line respecting quotes so a value like
    // `"1,200 AED"` doesn't get counted as a comma delimiter.
    let commas = 0, semis = 0, tabs = 0;
    let inQ = false;
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (inQ) {
            if (c === '"') {
                if (src[i + 1] === '"') { i++; continue; }
                inQ = false;
            }
            continue;
        }
        if (c === '"') { inQ = true; continue; }
        if (c === "\n") break; // first line only
        if (c === "\r") continue;
        if (c === ",") commas++;
        else if (c === ";") semis++;
        else if (c === "\t") tabs++;
    }
    // Pick the winner. Ties → comma (backward-compatible default).
    if (semis > commas && semis >= tabs) return ";";
    if (tabs > commas && tabs > semis) return "\t";
    return ",";
}

export function parseCsv(text: string): {
    columns: string[];
    rows: Record<string, string>[];
} {
    // Strip UTF-8 BOM if present so the first header cell doesn't carry
    // an invisible U+FEFF prefix.
    const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const delim = detectDelimiter(src);
    const grid: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (inQuotes) {
            if (c === '"') {
                // Doubled quote → literal quote inside the field.
                if (src[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += c;
            }
            continue;
        }
        if (c === '"') {
            inQuotes = true;
        } else if (c === delim) {
            row.push(field);
            field = "";
        } else if (c === "\r") {
            // Swallow — the \n on the next iteration will finish the row.
        } else if (c === "\n") {
            row.push(field);
            field = "";
            // Skip fully-empty lines (e.g. trailing blank line at EOF).
            if (row.some((f) => f.length > 0)) grid.push(row);
            row = [];
        } else {
            field += c;
        }
    }
    // Handle the last field / row if the file didn't end with a newline.
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        if (row.some((f) => f.length > 0)) grid.push(row);
    }
    if (grid.length === 0) return { columns: [], rows: [] };
    const columns = grid[0].map((c) => c.trim());
    const rows = grid.slice(1).map((cells) => {
        const rec: Record<string, string> = {};
        columns.forEach((c, i) => {
            rec[c] = (cells[i] ?? "").trim();
        });
        return rec;
    });
    return { columns, rows };
}

/** Branch detection: find a branch column and count rows per known branch.
 *  Falls back to `status: "none"` when no branch column is found. Uses
 *  the ACTIVE entity's dict — since every entity's dict maps "branch" /
 *  "location" / "club" → the entity's own branch field key. */
export function branchAssignment(
    ctx: AuthContext,
    entity: EntityKey,
    file: ParsedFile,
    knownBranches: { id: string; name: string; status: string }[],
): BranchAssignment {
    const def = ENTITIES[entity];
    const allowed = knownBranches.filter(
        (b) => ctx.branchScope === "all" || ctx.branchScope.includes(b.id),
    );
    // Find the source column that maps to this entity's branch field.
    // The branch field key varies by entity (customers use branch_id;
    // most others too — but the lookup goes through the entity's dict
    // regardless, keeping this fn generic).
    const branchCol = file.columns.find((c) => {
        const target = def.dict[normHeader(c)];
        return target === "branch_id";
    });
    if (!branchCol) {
        if (allowed.length === 0) {
            return {
                status: "none",
                rows: [],
                blocked: { reason: "no_branches" },
            };
        }
        return { status: "none", rows: [] };
    }
    const counts = new Map<string, number>();
    for (const r of file.rows) {
        const v = r[branchCol]?.trim() || "Unassigned";
        counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return {
        status: "detected",
        rows: Array.from(counts.entries()).map(([branch_name, count]) => ({
            branch_name,
            count,
        })),
    };
}

/** Auto-map source columns to the entity's target fields via that
 *  entity's dict. Any header not in the dictionary comes back as
 *  `needs_review` (target=null). Returns BOTH the row-level mapping
 *  array (for the card) AND the invertible source→target lookup (for
 *  the preview step). */
export function proposeMapping(
    entity: EntityKey,
    file: ParsedFile,
): {
    mappings: MappingRow[];
    mapping: Record<string, string | null>;
    summary: { mapped: number; needs_review: number };
} {
    const def = ENTITIES[entity];
    const mapping: Record<string, string | null> = {};
    const mappings: MappingRow[] = file.columns.map((col) => {
        const target = def.dict[normHeader(col)] ?? null;
        mapping[col] = target;
        return {
            source: col,
            target,
            status: target ? "mapped" : "needs_review",
        };
    });
    return {
        mappings,
        mapping,
        summary: {
            mapped: mappings.filter((m) => m.status === "mapped").length,
            needs_review: mappings.filter((m) => m.status === "needs_review")
                .length,
        },
    };
}

/** Dry-run: apply the mapping, validate every row, count valid /
 *  invalid / duplicate. Never mutates anything. Validation + dedupe
 *  rules come from the entity's EntityDef.
 *
 *  Mapping resolution — auto-map FIRST, user overrides second. Passing
 *  a partial `mapping` (only the columns the user edited) merges cleanly
 *  on top of the entity dict's suggestions, so callers never need to send
 *  a complete mapping. `null` values are respected as an explicit "skip".
 *
 *  `existingKeys` — keys already in the LIVE store (SKUs for retail
 *  products, category names for retail categories, etc). Rows whose
 *  `dedupeKey()` matches one of these are counted as `duplicate` — the
 *  same category `seen` set gets pre-populated with them. Without this,
 *  preview would report "6 valid" for a CSV whose SKUs already exist in
 *  the catalog, and the commit would silently fail every row. Format
 *  must match the entity's `dedupeKey` output (typically lowercased). */
export function preview(
    entity: EntityKey,
    file: ParsedFile,
    mapping?: Record<string, string | null>,
    existingKeys?: readonly string[],
): MappingPreview {
    const def = ENTITIES[entity];
    const auto = proposeMapping(entity, file).mapping;
    const effectiveMapping = mapping ? { ...auto, ...mapping } : auto;
    const inv: Record<string, string> = {};
    for (const [src, tgt] of Object.entries(effectiveMapping)) {
        if (tgt) inv[tgt] = src;
    }

    // Seed `seen` with existing live keys so a CSV row that duplicates
    // an already-stored record is counted as `duplicate` (not `valid`).
    // The AI's Step-4 summary then reads correctly and the commit's
    // "created" count matches what the applier actually writes.
    const seen = new Set<string>(existingKeys ?? []);
    let valid = 0;
    let invalid = 0;
    let duplicate = 0;
    for (const r of file.rows) {
        if (!def.validate(r, inv)) {
            invalid++;
            continue;
        }
        const key = def.dedupeKey?.(r, inv);
        if (key) {
            if (seen.has(key)) {
                duplicate++;
                continue;
            }
            seen.add(key);
        }
        valid++;
    }

    const mappedCount = Object.values(effectiveMapping).filter(Boolean).length;
    // Include EVERY source column — skipped ones surface as `target: null`
    // so the Step-4 summary can render a "Skipped this column" pill for
    // them (Phase 4). Walk the file's columns rather than the effective
    // mapping so the display order matches the CSV.
    const fields = file.columns.map((src) => {
        const t = effectiveMapping[src] ?? null;
        return {
            source: src,
            target: t
                ? def.fields.find((f) => f.key === t)?.label ?? String(t)
                : null,
        };
    });
    return {
        totals: { total: file.rows.length, valid, invalid, duplicate },
        fields,
        columnsNote: `${file.columns.length} columns · ${mappedCount} mapped`,
    };
}

/** Commit — v1 returns the preview counts without actually writing to
 *  the corresponding Zustand store. That matches the POC's demo
 *  behaviour (the MigrationStore keeps a `committed` tally but doesn't
 *  create real rows). Wiring commits into the live Zustand store lands
 *  in a later phase alongside proper audit + undo support. */
export function commit(
    entity: EntityKey,
    file: ParsedFile,
    mapping?: Record<string, string | null>,
    existingKeys?: readonly string[],
): { created: number; skipped: number; failed: number } {
    const p = preview(entity, file, mapping, existingKeys);
    return {
        created: p.totals.valid,
        skipped: p.totals.duplicate,
        failed: p.totals.invalid,
    };
}

/** Materialize — the VALID, deduped rows the client should actually write,
 *  each keyed by TARGET field (e.g. { first_name, last_name, email, ... }).
 *  Applies exactly the same validate + dedupe rules as `preview` / `commit`,
 *  so `materialize(...).length` equals the `created` count those return. This
 *  is the pure bridge the client-side import applier uses to insert real rows
 *  into the Zustand store. */
export function materialize(
    entity: EntityKey,
    file: ParsedFile,
    mapping?: Record<string, string | null>,
    existingKeys?: readonly string[],
): Record<string, string>[] {
    const def = ENTITIES[entity];
    const auto = proposeMapping(entity, file).mapping;
    const effectiveMapping = mapping ? { ...auto, ...mapping } : auto;
    const inv: Record<string, string> = {};
    for (const [src, tgt] of Object.entries(effectiveMapping)) {
        if (tgt) inv[tgt] = src;
    }
    // Seed `seen` with existing live keys so a row that would collide
    // with a stored record is dropped here — the applier then never
    // even tries to write it. Keeps materialize().length in step with
    // the preview's `valid` count when the caller passes the same
    // `existingKeys` to both.
    const seen = new Set<string>(existingKeys ?? []);
    const out: Record<string, string>[] = [];
    for (const r of file.rows) {
        if (!def.validate(r, inv)) continue;
        const key = def.dedupeKey?.(r, inv);
        if (key) {
            if (seen.has(key)) continue;
            seen.add(key);
        }
        // Build a record keyed by the entity's TARGET field names.
        const rec: Record<string, string> = {};
        for (const [tgt, src] of Object.entries(inv)) {
            rec[tgt] = (r[src] ?? "").trim();
        }
        out.push(rec);
    }
    return out;
}
