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
// Ported from the pure parts of ONRA AI-Agent/lib/migration/MigrationStore.ts.

import type { AuthContext } from "@/ai-agent/agent/auth";
import type {
    ParsedFile,
    MappingRow,
    BranchAssignment,
    MappingPreview,
} from "@/ai-agent/migration/migration-cards";
import {
    CUSTOMER_FIELDS,
    DICT,
    normHeader,
} from "@/ai-agent/migration/customer-schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Minimal CSV parser — same one the POC ships. Handles `\r` and blank
 *  lines. Doesn't do quoted-comma or escaped-quote parsing (fine for the
 *  demo prototype; production would want papaparse or csv-parse). */
export function parseCsv(text: string): {
    columns: string[];
    rows: Record<string, string>[];
} {
    const lines = text
        .replace(/\r/g, "")
        .split("\n")
        .filter((l) => l.trim().length);
    if (lines.length === 0) return { columns: [], rows: [] };
    const columns = lines[0].split(",").map((c) => c.trim());
    const rows = lines.slice(1).map((line) => {
        const cells = line.split(",");
        const row: Record<string, string> = {};
        columns.forEach((c, i) => (row[c] = (cells[i] ?? "").trim()));
        return row;
    });
    return { columns, rows };
}

/** Branch detection: find a branch column and count rows per known branch.
 *  Falls back to `status: "none"` when no branch column is found. */
export function branchAssignment(
    ctx: AuthContext,
    file: ParsedFile,
    knownBranches: { id: string; name: string; status: string }[],
): BranchAssignment {
    const allowed = knownBranches.filter(
        (b) => ctx.branchScope === "all" || ctx.branchScope.includes(b.id),
    );
    const branchCol = file.columns.find(
        (c) => DICT[normHeader(c)] === "branch_id",
    );
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

/** Auto-map source columns to Onra target fields via DICT. Any header not
 *  in the dictionary comes back as `needs_review` (target=null). Returns
 *  BOTH the row-level mapping array (for the card) AND the invertible
 *  source→target lookup (for the preview step). */
export function proposeMapping(file: ParsedFile): {
    mappings: MappingRow[];
    mapping: Record<string, string | null>;
    summary: { mapped: number; needs_review: number };
} {
    const mapping: Record<string, string | null> = {};
    const mappings: MappingRow[] = file.columns.map((col) => {
        const target = DICT[normHeader(col)] ?? null;
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

/** Dry-run: apply the mapping, validate every row, count valid / invalid /
 *  duplicate. Never mutates anything. `mapping` defaults to the auto-
 *  proposal so callers that skip explicit-mapping still get the demo
 *  numbers.
 *
 *  Validation rules (v1, matches POC):
 *    • first_name, last_name, email must all be mapped + non-empty
 *    • email must match a simple email regex
 *    • duplicate emails (case-insensitive) count as duplicates, not valid
 */
export function preview(
    file: ParsedFile,
    mapping?: Record<string, string | null>,
): MappingPreview {
    const effectiveMapping = mapping ?? proposeMapping(file).mapping;
    const inv: Record<string, string> = {};
    for (const [src, tgt] of Object.entries(effectiveMapping)) {
        if (tgt) inv[tgt] = src;
    }

    const seenEmail = new Set<string>();
    let valid = 0;
    let invalid = 0;
    let duplicate = 0;
    for (const r of file.rows) {
        const email = inv.email ? r[inv.email]?.trim().toLowerCase() : "";
        const firstOk = inv.first_name
            ? !!r[inv.first_name]?.trim()
            : false;
        const lastOk = inv.last_name ? !!r[inv.last_name]?.trim() : false;
        const emailOk = !!email && EMAIL_RE.test(email);
        if (!firstOk || !lastOk || !emailOk) {
            invalid++;
            continue;
        }
        if (seenEmail.has(email)) {
            duplicate++;
            continue;
        }
        seenEmail.add(email);
        valid++;
    }

    const mappedCount = Object.values(effectiveMapping).filter(Boolean).length;
    const fields = Object.entries(effectiveMapping)
        .filter(([, t]) => t)
        .map(([src, t]) => ({
            source: src,
            target:
                CUSTOMER_FIELDS.find((f) => f.key === t)?.label ?? String(t),
        }));
    return {
        totals: { total: file.rows.length, valid, invalid, duplicate },
        fields,
        columnsNote: `${file.columns.length} columns · ${mappedCount} mapped`,
    };
}

/** Commit — v1 returns the preview counts without actually writing to
 *  the customers store. That matches the POC's demo behaviour (the
 *  MigrationStore keeps a `committed` tally but doesn't create real
 *  customers). Wiring commits into the live Zustand store lands with
 *  Phase 9 when we add write-back for memberships / packages / etc. too. */
export function commit(
    file: ParsedFile,
    mapping?: Record<string, string | null>,
): { created: number; skipped: number; failed: number } {
    const p = preview(file, mapping);
    return {
        created: p.totals.valid,
        skipped: p.totals.duplicate,
        failed: p.totals.invalid,
    };
}
