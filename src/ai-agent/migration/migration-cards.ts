// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration — generative-UI card contract
// ─────────────────────────────────────────────────────────────────────────────
//
// Ported verbatim from ONRA AI-Agent/lib/agent/migrationCards.ts. Each
// migration tool returns one of these shapes; the MigCard renderer
// (components/MigCard.tsx) switches on the `card` discriminator to draw
// the right body + action buttons.
//
// Additional shared types (ParsedFile, MappingRow, etc.) live in the
// same file so both the migration tools AND the client can import
// without depending on the render layer.

export type Platform = { slug: string; name: string };

export type MappingRow = {
    source: string;
    target: string | null; // Onra field key, or null = skip
    status: "mapped" | "needs_review";
};

/** The parsed CSV shape the client stores and re-sends per request. */
export interface ParsedFile {
    fileId: string;
    filename: string;
    columns: string[];
    rows: Record<string, string>[];
}

/** Result of `branchAssignment()` — visible on the branch-assignment card
 *  after upload. */
export interface BranchAssignment {
    status: "detected" | "none";
    rows: { branch_name: string; count: number }[];
    blocked?: { reason: "no_branches" };
}

/** Result of `preview()` — the dry-run counts + field summary. */
export interface MappingPreview {
    totals: { total: number; valid: number; invalid: number; duplicate: number };
    fields: { source: string; target: string }[];
    columnsNote: string;
}

export type MigrationCard =
    | {
          card: "source_options";
          step: number;
          title: string;
          body: string;
          platforms: Platform[];
      }
    | {
          // Phase 9: `entity` now carried through from step 2 onward so
          // MigCard can label ("15 customers", "8 memberships", etc.).
          card: "branch_assignment";
          step: number;
          entity: string;
          status: "detected" | "none";
          rows: { branch_name: string; count: number }[];
          blocked?: { reason: "no_branches" };
          note?: string;
          filename?: string;
          rowCount?: number;
          columns?: string[];
          sample?: string[][];
      }
    | {
          card: "column_mapping";
          step: number;
          entity: string;
          mappings: MappingRow[];
          summary: { mapped: number; needs_review: number };
          targetOptions: { key: string; label: string }[];
      }
    | {
          card: "mapping_summary";
          step: number;
          entity: string;
          totals: {
              total: number;
              valid: number;
              invalid: number;
              duplicate: number;
          };
          fields: { source: string; target: string }[];
          columnsNote: string;
      }
    | {
          card: "import_result";
          entity: string;
          created: number;
          skipped: number;
          failed: number;
      };
