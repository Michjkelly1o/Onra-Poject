// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration — 5 tools for the 4-step wizard
// ─────────────────────────────────────────────────────────────────────────────
//
// Ported from ONRA AI-Agent/lib/agent/migrationTools.ts with one core
// change: the POC held session state on the server (`migrationStore`
// keyed by sessionId). Here the CLIENT owns the parsed file and passes
// it as `parsedFile` in every request body (same pattern as
// storeSnapshot for Insight). The tools receive it as a closure arg —
// no session, no store, fully stateless server-side.
//
// The 5 tools mirror the Figma "Migration & Imports" flow:
//   1. start_migration     — Step 1. Source-of-import chip picker.
//   2. inspect_source      — Step 2. Read the uploaded file, detect
//                            columns + branch column, propose branch
//                            assignment.
//   3. propose_mapping     — Step 3. Auto-map source → Onra fields,
//                            surface a review card.
//   4. preview_import      — Step 4. DRY RUN. Validate + dedupe.
//                            Returns Total / Valid / Invalid /
//                            Duplicate counts. NO writes.
//   5. commit_import       — Only after the user approves step 4.
//                            Requires `confirmed: true` AND
//                            `ctx.canWrite`.

import { tool } from "ai";
import { z } from "zod";
import type { AuthContext } from "@/ai-agent/agent/auth";
import type { ParsedFile } from "@/ai-agent/migration/migration-cards";
import {
    branchAssignment,
    proposeMapping,
    preview,
    commit,
} from "@/ai-agent/migration/parser";
import { CUSTOMER_FIELDS } from "@/ai-agent/migration/customer-schema";

const PLATFORMS = [
    { slug: "upload",     name: "Upload file" },
    { slug: "mindbody",   name: "Mindbody" },
    { slug: "glofox",     name: "Glofox" },
    { slug: "classpass",  name: "ClassPass" },
    { slug: "kenko",      name: "Kenko" },
    { slug: "momence",    name: "Momence" },
    { slug: "mariana",    name: "Mariana Tek" },
];

/** The "no file uploaded yet" response every tool falls back to when
 *  parsedFile is null. The MigCard renderer knows to say
 *  "Nothing to import yet — upload your customer export to begin." */
const EMPTY_RESULT = {
    card: "import_result" as const,
    entity: "customers",
    created: 0,
    skipped: 0,
    failed: 0,
};

export function migrationTools(
    ctx: AuthContext,
    parsedFile: ParsedFile | null,
    knownBranches: { id: string; name: string; status: string }[],
) {
    return {
        start_migration: tool({
            description:
                "STEP 1 of 4. Begin a data migration. Returns the source-of-import options (platform chips + Upload file). Call this first when the user wants to import / migrate / bring in data.",
            parameters: z.object({}),
            execute: async () => ({
                card: "source_options" as const,
                step: 1,
                title: "Source of import",
                body: "Hi! I'll help you migrate your studio data into Onra step by step. Start by choosing where your data will come from, then upload your customer file (CSV).",
                platforms: PLATFORMS,
            }),
        }),

        inspect_source: tool({
            description:
                "STEP 2 of 4. Inspect the uploaded file: detect columns and assign rows to branches. Call this right after the user uploads a file. If nothing is uploaded yet, tell the user to click the paperclip and pick their CSV.",
            parameters: z.object({}),
            execute: async () => {
                if (!parsedFile) return EMPTY_RESULT;
                const ba = branchAssignment(ctx, parsedFile, knownBranches);
                const previewCols = parsedFile.columns.slice(0, 5);
                const sample = parsedFile.rows
                    .slice(0, 3)
                    .map((r) => previewCols.map((c) => String(r[c] ?? "")));
                return {
                    card: "branch_assignment" as const,
                    step: 2,
                    filename: parsedFile.filename,
                    rowCount: parsedFile.rows.length,
                    columns: parsedFile.columns,
                    sample,
                    status: ba.status,
                    rows: ba.rows,
                    blocked: ba.blocked,
                    note:
                        ba.status === "detected"
                            ? `I found a branch column and assigned all ${parsedFile.rows.length} records to your branches automatically.`
                            : "I didn't find a branch column — you can pick a branch for these records during mapping.",
                };
            },
        }),

        propose_mapping: tool({
            description:
                "STEP 3 of 4. Auto-map the file's columns to Onra customer fields and return an editable mapping card. Present it and let the user review / accept before previewing.",
            parameters: z.object({}),
            execute: async () => {
                if (!parsedFile) return EMPTY_RESULT;
                const m = proposeMapping(parsedFile);
                return {
                    card: "column_mapping" as const,
                    step: 3,
                    entity: "customers",
                    mappings: m.mappings,
                    summary: m.summary,
                    targetOptions: CUSTOMER_FIELDS.map((f) => ({
                        key: f.key,
                        label: f.label,
                    })),
                };
            },
        }),

        preview_import: tool({
            description:
                "STEP 4 of 4. DRY RUN — validate and dedupe against the auto-mapping, returning Total / Valid / Invalid / Duplicate counts and the field summary. NO data is written. The user must approve before committing.",
            parameters: z.object({}),
            execute: async () => {
                if (!parsedFile) return EMPTY_RESULT;
                const p = preview(parsedFile);
                return {
                    card: "mapping_summary" as const,
                    step: 4,
                    entity: "customers",
                    totals: p.totals,
                    fields: p.fields,
                    columnsNote: p.columnsNote,
                };
            },
        }),

        commit_import: tool({
            description:
                "Commit the validated records into Onra. Idempotent. Requires write permission AND that the user has explicitly approved the step-4 summary (e.g. clicked 'Yes, start import'). Never call this without that approval.",
            parameters: z.object({
                confirmed: z
                    .boolean()
                    .describe(
                        "Must be true; only set after the user approved the import.",
                    ),
            }),
            execute: async ({ confirmed }) => {
                if (!ctx.canWrite) return EMPTY_RESULT;
                if (!confirmed) return EMPTY_RESULT;
                if (!parsedFile) return EMPTY_RESULT;
                const r = commit(parsedFile);
                return {
                    card: "import_result" as const,
                    entity: "customers",
                    ...r,
                };
            },
        }),
    };
}
