// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration — wizard tools (Phase 9 — multi-entity)
// ─────────────────────────────────────────────────────────────────────────────
//
// Ported from ONRA AI-Agent/lib/agent/migrationTools.ts with two core
// changes:
//
// 1. Stateless server (Phase 7). The POC held session state on the server
//    (migrationStore keyed by sessionId, backed by globalThis). Vercel
//    serverless doesn't survive cold starts, so this port takes the
//    parsed file as a closure arg — the CLIENT owns it in React state
//    and passes it back in every request body. No session, no store.
//
// 2. Multi-entity (Phase 9). The POC hard-coded customers. Now every
//    tool takes an `entity: EntityKey` Zod-validated arg and routes to
//    the registered EntityDef via `ENTITIES[entity]`. The model asks
//    the user which entity up front (see buildMigrationPrompt) and
//    threads the same value through the whole wizard.

import { tool } from "ai";
import { z } from "zod";
import type { AuthContext } from "@/ai-agent/agent/auth";
import { askQuestionsTool } from "@/ai-agent/agent/tools";
import type { ParsedFile } from "@/ai-agent/migration/migration-cards";
import {
    branchAssignment,
    proposeMapping,
    preview,
    commit,
} from "@/ai-agent/migration/parser";
import { ENTITIES, type EntityKey } from "@/ai-agent/migration/entities";

const PLATFORMS = [
    { slug: "upload",     name: "Upload file" },
    { slug: "mindbody",   name: "Mindbody" },
    { slug: "glofox",     name: "Glofox" },
    { slug: "classpass",  name: "ClassPass" },
    { slug: "kenko",      name: "Kenko" },
    { slug: "momence",    name: "Momence" },
    { slug: "mariana",    name: "Mariana Tek" },
];

/** Zod enum matching EntityKey. Passed to every tool so the model has
 *  a single strict source of truth for valid entity strings. */
const ENTITY_ENUM = z.enum([
    "customers",
    "memberships",
    "packages",
    "class_templates",
    "class_schedule",
    "leads",
    "gift_cards",
    "services",
    "rooms",
    "branches",
    "staff",
    "promo_codes",
    "pay_rates",
    "campaigns",
    "tax_rates",
    "agreements",
    "class_categories",
    "customer_plans",
    "customer_transactions",
    "class_bookings",
    "wallet_transactions",
    "issued_gift_cards",
    "customer_referrals",
    "class_ratings",
]);

/** Empty result — used when no file is uploaded or the caller is not
 *  authorised to write. Entity carried through so the card matches. */
const emptyResult = (entity: EntityKey) => ({
    card: "import_result" as const,
    entity,
    created: 0,
    skipped: 0,
    failed: 0,
});

export function migrationTools(
    ctx: AuthContext,
    parsedFile: ParsedFile | null,
    knownBranches: { id: string; name: string; status: string }[],
) {
    return {
        ...askQuestionsTool(),
        start_migration: tool({
            description:
                "STEP 1 of 4. Begin a data migration. Returns the source-of-import options (platform chips + Upload file). Call this first when the user wants to import / migrate / bring in data. This is BEFORE the user has told you which entity they're importing — that comes next.",
            parameters: z.object({}),
            execute: async () => ({
                card: "source_options" as const,
                step: 1,
                title: "Source of import",
                body: "Hi! I'll help you migrate your studio data into Onra step by step. Start by choosing where your data will come from, then upload your export (CSV).",
                platforms: PLATFORMS,
            }),
        }),

        inspect_source: tool({
            description:
                "STEP 2 of 4. Inspect the uploaded file: detect columns and assign rows to branches. Call this right after the user uploads a file. You MUST know which entity you're importing by now — the tool call requires it. If nothing is uploaded yet, tell the user to click the paperclip and pick their CSV.",
            parameters: z.object({
                entity: ENTITY_ENUM.describe(
                    "Which Onra entity this file is for. Pick based on what the user said they were importing.",
                ),
            }),
            execute: async ({ entity }) => {
                if (!parsedFile) return emptyResult(entity);
                const def = ENTITIES[entity];
                const ba = branchAssignment(
                    ctx,
                    entity,
                    parsedFile,
                    knownBranches,
                );
                const previewCols = parsedFile.columns.slice(0, 5);
                const sample = parsedFile.rows
                    .slice(0, 3)
                    .map((r) => previewCols.map((c) => String(r[c] ?? "")));
                return {
                    card: "branch_assignment" as const,
                    step: 2,
                    entity,
                    filename: parsedFile.filename,
                    rowCount: parsedFile.rows.length,
                    columns: parsedFile.columns,
                    sample,
                    status: ba.status,
                    rows: ba.rows,
                    blocked: ba.blocked,
                    note:
                        ba.status === "detected"
                            ? `I found a branch column and assigned all ${parsedFile.rows.length} ${def.label} to your branches automatically.`
                            : `I didn't find a branch column — you can pick a branch for these ${def.label} during mapping.`,
                };
            },
        }),

        propose_mapping: tool({
            description:
                "STEP 3 of 4. Auto-map the file's columns to the target Onra fields for the chosen entity and return an editable mapping card. Present it and let the user review / accept before previewing.",
            parameters: z.object({
                entity: ENTITY_ENUM,
            }),
            execute: async ({ entity }) => {
                if (!parsedFile) return emptyResult(entity);
                const def = ENTITIES[entity];
                const m = proposeMapping(entity, parsedFile);
                return {
                    card: "column_mapping" as const,
                    step: 3,
                    entity,
                    mappings: m.mappings,
                    summary: m.summary,
                    targetOptions: def.fields.map((f) => ({
                        key: f.key,
                        label: f.label,
                    })),
                };
            },
        }),

        preview_import: tool({
            description:
                "STEP 4 of 4. DRY RUN — validate and dedupe against the auto-mapping, returning Total / Valid / Invalid / Duplicate counts and the field summary. NO data is written. The user must approve before committing.",
            parameters: z.object({
                entity: ENTITY_ENUM,
            }),
            execute: async ({ entity }) => {
                if (!parsedFile) return emptyResult(entity);
                const p = preview(entity, parsedFile);
                return {
                    card: "mapping_summary" as const,
                    step: 4,
                    entity,
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
                entity: ENTITY_ENUM,
                confirmed: z
                    .boolean()
                    .describe(
                        "Must be true; only set after the user approved the import.",
                    ),
            }),
            execute: async ({ entity, confirmed }) => {
                if (!ctx.canWrite) return emptyResult(entity);
                if (!confirmed) return emptyResult(entity);
                if (!parsedFile) return emptyResult(entity);
                const r = commit(entity, parsedFile);
                return {
                    card: "import_result" as const,
                    entity,
                    ...r,
                };
            },
        }),
    };
}
