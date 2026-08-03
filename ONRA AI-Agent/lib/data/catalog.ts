// ─────────────────────────────────────────────────────────────────────────────
// Data catalog — the queryable surface the agent reasons over. Each dataset lists
// the fields the model may group/filter/aggregate by (model-facing names → real
// row keys + resolvers). The engine (engine.ts) executes queries deterministically
// against these, so numbers are always correct; the model only decides WHAT to
// compute and HOW to show it.
// ─────────────────────────────────────────────────────────────────────────────
import { branches as _branches } from "@/mock-data/branches";
import { customers as _customers } from "@/mock-data/customers";
import { customer_transactions as _txns } from "@/mock-data/customer_transactions";
import { class_schedule as _schedule } from "@/mock-data/class_schedule";
import { class_bookings as _bookings } from "@/mock-data/class_bookings";
import { class_templates as _templates } from "@/mock-data/class_templates";
import { staff_profiles as _instructors } from "@/mock-data/staff_profiles";
import { leads as _leads } from "@/mock-data/leads";
import { marketing_campaign_stats as _campaigns } from "@/mock-data/marketing_campaign_stats";
import { marketing_spend as _spend } from "@/mock-data/marketing_spend";

export type Row = Record<string, unknown>;
const arr = (x: unknown) => x as unknown as Row[];

const branches = arr(_branches);
const instructors = arr(_instructors);
const templates = arr(_templates);
const branchName = (id: string) =>
  (branches.find((b) => b.id === id)?.name as string) ?? id;
const instrName = (id: string) =>
  (instructors.find((s) => s.id === id)?.full_name as string) ?? id;
const classNameOf = (id: string) =>
  (templates.find((t) => t.id === id)?.name as string) ?? id;

export type FieldType = "enum" | "string" | "number" | "date" | "ref";
export interface FieldMeta {
  row: string; // actual row key
  type: FieldType;
  label: string;
  values?: string[]; // enum options
  ref?: (v: string) => string; // resolve id → human label
}
export interface Dataset {
  key: string;
  label: string;
  rows: Row[];
  fields: Record<string, FieldMeta>;
}

const F = {
  branch: { row: "branch_id", type: "ref", label: "branch", ref: branchName } as FieldMeta,
};

export const CATALOG: Record<string, Dataset> = {
  transactions: {
    key: "transactions",
    label: "revenue & payments (one row per payment)",
    rows: arr(_txns),
    fields: {
      amount_aed: { row: "amount_aed", type: "number", label: "amount (AED)" },
      status: { row: "status", type: "enum", label: "status", values: ["complete", "pending", "failed", "refunded"] },
      kind: { row: "kind", type: "enum", label: "kind", values: ["membership", "package", "cancellation_penalty"] },
      payment_method: { row: "payment_method", type: "enum", label: "payment method", values: ["card", "cash"] },
      product: { row: "name", type: "string", label: "product" },
      branch: F.branch,
      created_at: { row: "created_at", type: "date", label: "date" },
    },
  },
  customers: {
    key: "customers",
    label: "members / customers",
    rows: arr(_customers),
    fields: {
      status: { row: "status", type: "enum", label: "status", values: ["active", "inactive", "archived"] },
      plan_kind: { row: "plan_kind", type: "enum", label: "plan kind", values: ["membership", "package"] },
      gender: { row: "gender", type: "enum", label: "gender", values: ["Male", "Female"] },
      city: { row: "city", type: "string", label: "city" },
      state: { row: "state", type: "string", label: "state" },
      plan_name: { row: "plan_name", type: "string", label: "plan" },
      branch: F.branch,
      created_at: { row: "created_at", type: "date", label: "joined date" },
      last_visit: { row: "last_visit_iso", type: "date", label: "last visit" },
      plan_expiry: { row: "plan_expiry_iso", type: "date", label: "plan expiry" },
    },
  },
  classes: {
    key: "classes",
    label: "scheduled class sessions",
    rows: arr(_schedule),
    fields: {
      booked: { row: "booked", type: "number", label: "bookings" },
      capacity: { row: "capacity", type: "number", label: "capacity" },
      rating: { row: "rating", type: "number", label: "rating" },
      status: { row: "status", type: "enum", label: "status", values: ["Completed", "Cancelled", "Ongoing", "Upcoming"] },
      class: { row: "template_id", type: "ref", label: "class", ref: classNameOf },
      instructor: { row: "instructor_id", type: "ref", label: "instructor", ref: instrName },
      branch: F.branch,
      date: { row: "date_iso", type: "date", label: "date" },
    },
  },
  bookings: {
    key: "bookings",
    label: "class bookings (one row per booked seat)",
    rows: arr(_bookings),
    fields: {
      attendance: { row: "attendance_status", type: "enum", label: "attendance", values: ["present", "no_show", "pending", "late_cancel"] },
      status: { row: "status", type: "enum", label: "status", values: ["booked", "waitlisted", "cancelled"] },
      branch: F.branch,
    },
  },
  leads: {
    key: "leads",
    label: "sales leads / funnel",
    rows: arr(_leads),
    fields: {
      stage: { row: "stage", type: "enum", label: "stage", values: ["new", "contacted", "trial-booked", "trial-attended", "paid", "lost"] },
      source: { row: "source", type: "enum", label: "source", values: ["Instagram", "Google", "Website", "Walk-in", "Referral", "WhatsApp"] },
      engagement: { row: "engagement_status", type: "enum", label: "engagement", values: ["cold", "warm", "hot", "converted", "lost"] },
      gender: { row: "gender", type: "enum", label: "gender", values: ["Male", "Female"] },
      first_purchase_aed: { row: "first_purchase_amount_aed", type: "number", label: "first purchase (AED)" },
      branch: F.branch,
      added_at: { row: "added_at", type: "date", label: "added date" },
    },
  },
  campaigns: {
    key: "campaigns",
    label: "marketing campaign performance",
    rows: arr(_campaigns),
    fields: {
      channel: { row: "channel", type: "enum", label: "channel", values: ["email", "whatsapp", "sms", "push"] },
      campaign: { row: "campaign_name", type: "string", label: "campaign" },
      sends: { row: "sends", type: "number", label: "sends" },
      opens: { row: "opens_reads", type: "number", label: "opens" },
      clicks: { row: "clicks_taps", type: "number", label: "clicks" },
      attributed_bookings: { row: "attributed_bookings", type: "number", label: "attributed bookings" },
      attributed_revenue_aed: { row: "attributed_revenue_aed", type: "number", label: "attributed revenue (AED)" },
      branch: F.branch,
    },
  },
  spend: {
    key: "spend",
    label: "marketing spend",
    rows: arr(_spend),
    fields: {
      channel: { row: "channel", type: "enum", label: "channel", values: ["Instagram", "Google", "WhatsApp", "Website"] },
      month: { row: "month", type: "string", label: "month" },
      spend_aed: { row: "spend_aed", type: "number", label: "spend (AED)" },
      branch: F.branch,
    },
  },
};

/** Compact schema text for the system prompt so the model knows what it can query. */
export function schemaForPrompt(): string {
  return Object.values(CATALOG)
    .map((ds) => {
      const fields = Object.entries(ds.fields)
        .map(([name, m]) => {
          const t =
            m.type === "enum" ? `${name}(${m.values?.join("|")})` : `${name}(${m.type})`;
          return t;
        })
        .join(", ");
      return `• ${ds.key} — ${ds.label}. fields: ${fields}`;
    })
    .join("\n");
}
