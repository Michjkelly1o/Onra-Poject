// Generative-UI cards for the migration wizard (Figma: Migration & Imports).
// Each migration tool returns one of these; the chat renders it and its buttons
// post structured actions back into the conversation.

export type Platform = { slug: string; name: string };

export type MappingRow = {
  source: string;
  target: string | null; // Onra field key, or null = skip
  status: "mapped" | "needs_review";
};

export type MigrationCard =
  | {
      card: "source_options";
      step: number;
      title: string;
      body: string;
      platforms: Platform[];
    }
  | {
      card: "branch_assignment";
      step: number;
      status: "detected" | "none";
      rows: { branch_name: string; count: number }[];
      blocked?: { reason: "no_branches" };
      note?: string;
      // what the AI read from the uploaded file
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
      totals: { total: number; valid: number; invalid: number; duplicate: number };
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
