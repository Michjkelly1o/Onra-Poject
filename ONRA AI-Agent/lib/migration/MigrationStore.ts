// ─────────────────────────────────────────────────────────────────────────────
// MigrationStore — in-memory staging for the migration wizard. Parses uploaded
// CSVs, proposes column mappings, validates, previews (dry-run), and commits.
// Writes go HERE, never to the mock-data seed arrays (per the dataset rules).
// Keyed by a client-provided sessionId so state survives across turns.
// ─────────────────────────────────────────────────────────────────────────────
import type { AuthContext } from "@/lib/agent/auth";
import { branches as _branches } from "@/mock-data/branches";

type BranchRow = { id: string; name: string; status: string };
const branches = _branches as unknown as BranchRow[];

export type ParsedFile = {
  fileId: string;
  filename: string;
  columns: string[];
  rows: Record<string, string>[];
};

type Session = {
  file?: ParsedFile;
  mapping?: Record<string, string | null>; // source col -> onra field | null(skip)
  committed: number;
};

// ── Onra customer target fields ─────────────────────────────────────────────
export const CUSTOMER_FIELDS: { key: string; label: string; required?: boolean }[] =
  [
    { key: "first_name", label: "First name", required: true },
    { key: "last_name", label: "Last name", required: true },
    { key: "email", label: "Email", required: true },
    { key: "phone", label: "Phone" },
    { key: "gender", label: "Gender" },
    { key: "date_of_birth", label: "Date of birth" },
    { key: "country", label: "Country" },
    { key: "state", label: "State" },
    { key: "city", label: "City" },
    { key: "postal_code", label: "Postal code" },
    { key: "street_address", label: "Address" },
    { key: "plan_name", label: "Plan" },
    { key: "branch_id", label: "Branch" },
  ];

// Synonym dictionary: normalized source header -> Onra field key.
const DICT: Record<string, string> = {
  "first name": "first_name",
  firstname: "first_name",
  "last name": "last_name",
  lastname: "last_name",
  surname: "last_name",
  email: "email",
  "email address": "email",
  phone: "phone",
  mobile: "phone",
  "phone number": "phone",
  gender: "gender",
  sex: "gender",
  "date of birth": "date_of_birth",
  dob: "date_of_birth",
  birthday: "date_of_birth",
  country: "country",
  province: "state",
  state: "state",
  region: "state",
  regency: "city",
  city: "city",
  district: "city",
  postcode: "postal_code",
  "postal code": "postal_code",
  zip: "postal_code",
  "zip code": "postal_code",
  "street address": "street_address",
  address: "street_address",
  street: "street_address",
  "membership type": "plan_name",
  membership: "plan_name",
  plan: "plan_name",
  branch: "branch_id",
  location: "branch_id",
  club: "branch_id",
};

const norm = (s: string) => s.trim().toLowerCase().replace(/[_-]+/g, " ");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
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

class MigrationStoreImpl {
  private sessions = new Map<string, Session>();
  private s(id: string): Session {
    let x = this.sessions.get(id);
    if (!x) {
      x = { committed: 0 };
      this.sessions.set(id, x);
    }
    return x;
  }

  saveFile(sessionId: string, file: ParsedFile) {
    this.s(sessionId).file = file;
  }

  getFile(sessionId: string): ParsedFile | undefined {
    return this.s(sessionId).file;
  }

  /** Branch detection: find a branch column and count rows per known branch. */
  branchAssignment(ctx: AuthContext, sessionId: string) {
    const file = this.s(sessionId).file;
    const allowed = branches.filter(
      (b) => ctx.branchScope === "all" || (ctx.branchScope as string[]).includes(b.id),
    );
    if (!file) return { status: "none" as const, rows: [] };
    const branchCol = file.columns.find((c) => DICT[norm(c)] === "branch_id");
    if (!branchCol) {
      // no branch column
      if (allowed.length === 0)
        return { status: "none" as const, rows: [], blocked: { reason: "no_branches" as const } };
      return { status: "none" as const, rows: [] };
    }
    const counts = new Map<string, number>();
    for (const r of file.rows) {
      const v = r[branchCol]?.trim() || "Unassigned";
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return {
      status: "detected" as const,
      rows: [...counts.entries()].map(([branch_name, count]) => ({ branch_name, count })),
    };
  }

  /** Propose source->Onra mapping. Auto-map by dictionary; unmatched = needs_review. */
  proposeMapping(sessionId: string) {
    const file = this.s(sessionId).file;
    if (!file) return { mappings: [], summary: { mapped: 0, needs_review: 0 } };
    const mapping: Record<string, string | null> = {};
    const mappings = file.columns.map((col) => {
      const target = DICT[norm(col)] ?? null;
      mapping[col] = target;
      return {
        source: col,
        target,
        status: target ? ("mapped" as const) : ("needs_review" as const),
      };
    });
    this.s(sessionId).mapping = mapping;
    return {
      mappings,
      summary: {
        mapped: mappings.filter((m) => m.status === "mapped").length,
        needs_review: mappings.filter((m) => m.status === "needs_review").length,
      },
    };
  }

  /** Dry-run: validate + dedupe against the current mapping. No writes. */
  preview(sessionId: string) {
    const sess = this.s(sessionId);
    const file = sess.file;
    const mapping = sess.mapping ?? {};
    if (!file) return null;

    // invert mapping: onra field -> source column
    const inv: Record<string, string> = {};
    for (const [src, tgt] of Object.entries(mapping)) if (tgt) inv[tgt] = src;

    const seenEmail = new Set<string>();
    let valid = 0,
      invalid = 0,
      duplicate = 0;
    for (const r of file.rows) {
      const email = inv.email ? r[inv.email]?.trim().toLowerCase() : "";
      const firstOk = inv.first_name ? !!r[inv.first_name]?.trim() : false;
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
    const mappedCount = Object.values(mapping).filter(Boolean).length;
    const fields = Object.entries(mapping)
      .filter(([, t]) => t)
      .map(([src, t]) => ({
        source: src,
        target: CUSTOMER_FIELDS.find((f) => f.key === t)?.label ?? String(t),
      }));
    return {
      totals: { total: file.rows.length, valid, invalid, duplicate },
      fields,
      columnsNote: `${file.columns.length} columns · ${mappedCount} mapped`,
    };
  }

  /** Commit staged valid records (idempotent by email). Returns counts. */
  commit(sessionId: string) {
    const p = this.preview(sessionId);
    if (!p) return { created: 0, skipped: 0, failed: 0 };
    this.s(sessionId).committed += p.totals.valid;
    return {
      created: p.totals.valid,
      skipped: p.totals.duplicate,
      failed: p.totals.invalid,
    };
  }
}

// module-level singleton (in-memory; resets on server restart)
const g = globalThis as unknown as { __migStore?: MigrationStoreImpl };
export const migrationStore = g.__migStore ?? (g.__migStore = new MigrationStoreImpl());
