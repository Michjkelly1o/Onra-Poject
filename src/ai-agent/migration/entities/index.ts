// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration — entity registry (Phase 9)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 7 shipped customers-only. Phase 9 extends the wizard to 6
// entities total (customers + memberships + packages + class_templates
// + class_schedule + leads). To keep the wizard code entity-agnostic,
// every entity's definition (target fields + column synonym dictionary
// + validation + dedupe key) lives in its own file under `entities/`
// and is registered here.
//
// Adding a new entity in the future is a one-file edit:
//   1. Create `entities/<name>.ts` exporting an `EntityDef` object
//   2. Add the import + one line to `ENTITIES` below
//   3. Done — the wizard tools + migration prompt pick it up
//      automatically via the registry.
//
// The tool call surface (`migration-tools.ts`) takes `entity: EntityKey`
// as a Zod-validated arg on every tool; the parser routes to the
// registered EntityDef by key.

import { customersEntity } from "@/ai-agent/migration/entities/customers";
import { membershipsEntity } from "@/ai-agent/migration/entities/memberships";
import { packagesEntity } from "@/ai-agent/migration/entities/packages";
import { classTemplatesEntity } from "@/ai-agent/migration/entities/class-templates";
import { classSchedulesEntity } from "@/ai-agent/migration/entities/class-schedules";
import { leadsEntity } from "@/ai-agent/migration/entities/leads";
import { giftCardsEntity } from "@/ai-agent/migration/entities/gift-cards";
import { servicesEntity } from "@/ai-agent/migration/entities/services";
import { roomsEntity } from "@/ai-agent/migration/entities/rooms";
import { branchesEntity } from "@/ai-agent/migration/entities/branches";
import { staffEntity } from "@/ai-agent/migration/entities/staff";

/** One target field the wizard maps a source column to. */
export interface EntityField {
    key: string;
    label: string;
    /** True means a mapped source column is mandatory to consider a row valid.
     *  If left unmapped, every row of that entity is marked invalid. */
    required?: boolean;
}

/** Row shape as it arrives from parseCsv — just string cells keyed by
 *  source-column-header. */
export type CsvRow = Record<string, string>;

/** Inverted mapping: target-field key → source column header. Built by
 *  parser.ts's `proposeMapping()`. */
export type InvertedMapping = Record<string, string>;

/** Everything the wizard needs to know about one importable entity. */
export interface EntityDef {
    /** Machine key — matches the Zod enum. */
    key: EntityKey;
    /** Plural user-facing name, e.g. "customers", "memberships". */
    label: string;
    /** Singular user-facing name, e.g. "customer", "membership". */
    singular: string;
    /** The Onra target-field list the mapping card populates its
     *  <select> dropdowns with. */
    fields: EntityField[];
    /** Normalised-source-header → target-field-key. Powers the
     *  auto-map step. Extend freely to catch more synonyms. */
    dict: Record<string, string>;
    /** Basic per-row validation: return true if the required fields
     *  are mapped AND non-empty AND (where applicable) format-valid. */
    validate: (row: CsvRow, inv: InvertedMapping) => boolean;
    /** Optional per-row dedupe key. When two rows produce the same key,
     *  the second one is counted as `duplicate` instead of `valid`.
     *  Return null to skip dedupe for that row. Return null for the
     *  whole entity by omitting this fn. */
    dedupeKey?: (row: CsvRow, inv: InvertedMapping) => string | null;
}

/** Canonical entity keys — one per registered EntityDef. Also the Zod
 *  enum value migration-tools.ts uses on every tool. Adding a key here
 *  is a compile-time enforcement that a matching EntityDef exists. */
export type EntityKey =
    | "customers"
    | "memberships"
    | "packages"
    | "class_templates"
    | "class_schedule"
    | "leads"
    | "gift_cards"
    | "services"
    | "rooms"
    | "branches"
    | "staff";

/** The registry itself. Ordered — the model's system prompt lists them
 *  in this order when asking the user "which entity are you migrating?" */
export const ENTITIES: Record<EntityKey, EntityDef> = {
    customers:       customersEntity,
    memberships:     membershipsEntity,
    packages:        packagesEntity,
    class_templates: classTemplatesEntity,
    class_schedule:  classSchedulesEntity,
    leads:           leadsEntity,
    gift_cards:      giftCardsEntity,
    services:        servicesEntity,
    rooms:           roomsEntity,
    branches:        branchesEntity,
    staff:           staffEntity,
};

/** Human-readable menu the migration prompt lists for the AI to pick from. */
export const ENTITY_MENU: { key: EntityKey; label: string }[] = (
    Object.entries(ENTITIES) as [EntityKey, EntityDef][]
).map(([key, def]) => ({ key, label: def.label }));

/** Normalise a column header for dict lookup: lowercase, trim, replace
 *  underscores/hyphens with spaces, collapse whitespace. Kept here so
 *  every entity's `dict` uses the same key shape. */
export function normHeader(s: string): string {
    return s.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}
