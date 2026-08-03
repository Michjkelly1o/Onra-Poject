// Migration tools — the 4-step wizard (Figma: Migrate data). Stateful via the
// MigrationStore, keyed by sessionId. AuthContext gates writes (commit).
import { tool } from "ai";
import { z } from "zod";
import type { AuthContext } from "@/lib/agent/auth";
import { migrationStore, CUSTOMER_FIELDS } from "@/lib/migration/MigrationStore";

const PLATFORMS = [
  { slug: "upload", name: "Upload file" },
  { slug: "mindbody", name: "Mindbody" },
  { slug: "glofox", name: "Glofox" },
  { slug: "classpass", name: "ClassPass" },
  { slug: "kenko", name: "Kenko" },
  { slug: "momence", name: "Momence" },
  { slug: "mariana", name: "Mariana Tek" },
];

export function migrationTools(ctx: AuthContext, sessionId: string) {
  return {
    start_migration: tool({
      description:
        "STEP 1 of 4. Begin a data migration. Returns the source-of-import options (platform chips + Upload file). Call this first when the user wants to import/migrate/bring in data.",
      parameters: z.object({}),
      execute: async () => ({
        card: "source_options",
        step: 1,
        title: "Source of import",
        body: "Hi! I'll help you migrate your studio data into Onra step by step. Start by choosing where your data will come from, then upload your customer file (CSV or XLS).",
        platforms: PLATFORMS,
      }),
    }),

    inspect_source: tool({
      description:
        "STEP 2 of 4. Inspect the uploaded file: detects columns and assigns rows to branches. Call this right after the user uploads a file. If nothing is uploaded yet, tell the user to upload their customer export.",
      parameters: z.object({}),
      execute: async () => {
        const file = migrationStore.getFile(sessionId);
        if (!file)
          return {
            card: "import_result",
            entity: "customers",
            created: 0,
            skipped: 0,
            failed: 0,
          };
        const ba = migrationStore.branchAssignment(ctx, sessionId);
        // A 3-row preview of the actual uploaded data (first ~5 columns).
        const previewCols = file.columns.slice(0, 5);
        const sample = file.rows
          .slice(0, 3)
          .map((r) => previewCols.map((c) => String(r[c] ?? "")));
        return {
          card: "branch_assignment",
          step: 2,
          filename: file.filename,
          rowCount: file.rows.length,
          columns: file.columns,
          sample,
          status: ba.status,
          rows: ba.rows,
          blocked: (ba as { blocked?: { reason: "no_branches" } }).blocked,
          note:
            ba.status === "detected"
              ? `I found a branch column and assigned all ${file.rows.length} records to your branches automatically.`
              : "I didn't find a branch column — you can pick a branch for these records during mapping.",
        };
      },
    }),

    propose_mapping: tool({
      description:
        "STEP 3 of 4. Auto-map the file's columns to Onra customer fields and return an editable mapping card. Present it and let the user review/accept before previewing.",
      parameters: z.object({}),
      execute: async () => {
        const file = migrationStore.getFile(sessionId);
        if (!file)
          return { card: "import_result", entity: "customers", created: 0, skipped: 0, failed: 0 };
        const m = migrationStore.proposeMapping(sessionId);
        return {
          card: "column_mapping",
          step: 3,
          entity: "customers",
          mappings: m.mappings,
          summary: m.summary,
          targetOptions: CUSTOMER_FIELDS.map((f) => ({ key: f.key, label: f.label })),
        };
      },
    }),

    preview_import: tool({
      description:
        "STEP 4 of 4. DRY RUN — validate and dedupe against the mapping, returning Total/Valid/Invalid/Duplicate counts and the field summary. NO data is written. The user must approve before committing.",
      parameters: z.object({}),
      execute: async () => {
        const p = migrationStore.preview(sessionId);
        if (!p)
          return { card: "import_result", entity: "customers", created: 0, skipped: 0, failed: 0 };
        return {
          card: "mapping_summary",
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
          .describe("Must be true; only set after the user approved the import."),
      }),
      execute: async ({ confirmed }) => {
        if (!ctx.canWrite)
          return { card: "import_result", entity: "customers", created: 0, skipped: 0, failed: 0 };
        if (!confirmed)
          return { card: "import_result", entity: "customers", created: 0, skipped: 0, failed: 0 };
        const r = migrationStore.commit(sessionId);
        return { card: "import_result", entity: "customers", ...r };
      },
    }),
  };
}
