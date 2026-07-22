// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Generative-UI card contract
// ─────────────────────────────────────────────────────────────────────────────
//
// Ported from ONRA AI-Agent/lib/agent/cards.ts (Phase 2 — see plan doc). The
// engine (data/engine.ts) returns one of these; the chat renderer (Phase 5)
// switches on `card` to draw the right component. Kept as a plain typed
// contract so both server + client stay in agreement.
//
// Mirrors the Figma card inventory — see
// ONRA AI-Agent/AI-AGENT-DESIGN-REFERENCE.md §4.1 for the visual spec.

export type MetricTile = { label: string; value: string };

export type RankedRow = {
    title: string;
    subtitle?: string;
    right1?: string; // e.g. "142 bookings"
    right2?: string; // e.g. "89% occupancy"
    /** Phase 12 — when set, the whole row is clickable and navigates
     *  via Next.js's client router. Used by find_customer (row → profile)
     *  and list_create_shortcuts (row → new-record form). */
    href?: string;
};

/** Phase 10 — every card can carry an optional deep link. Clicking the
 *  chip navigates the tester to the matching /admin/insights tab (or
 *  any other admin route). `label` is the CTA text; `href` is a Next.js
 *  route (client-side navigation via `router.push`). */
export type DeepLink = {
    label: string;
    href: string;
};

export type TableCard = {
    card: "data_table";
    columns: string[];
    rows: string[][];
    note?: string;
};

export type SeriesPoint = { label: string; value: number };

export type InsightCard =
    | { card: "metric_group"; title?: string; tiles: MetricTile[]; note?: string; deepLink?: DeepLink }
    | { card: "ranked_list"; title: string; rows: RankedRow[]; note?: string; deepLink?: DeepLink }
    | {
          card: "line_chart";
          title: string;
          series: SeriesPoint[];
          unit?: "AED" | "count";
          valueLabel?: string; // tooltip label, e.g. "Total bookings"
          note?: string;
          deepLink?: DeepLink;
      }
    | {
          card: "bar_chart";
          title: string;
          unit?: "AED" | "count" | "rating";
          bars: { label: string; sublabel?: string; value: number }[];
          maxValue?: number; // override scaling (e.g. 5 for ratings)
          note?: string;
          deepLink?: DeepLink;
      }
    | {
          card: "donut";
          title: string;
          unit?: "AED" | "count";
          segments: { label: string; value: number }[];
          centerLabel?: string;
          centerValue?: string;
          note?: string;
          deepLink?: DeepLink;
      }
    | (TableCard & { deepLink?: DeepLink })
    | {
          card: "export";
          exportId: string;
          title: string;
          rowCount: number;
          columns: string[];
      }
    // Clarifying-question popup (renders <AiQuestionPrompt>). The agent emits
    // this when it needs input before it can answer; the user picks an option
    // or types their own, and the answer comes back as the next user message.
    | {
          card: "questions";
          questions: {
              title: string;
              options: { id: string; lead?: string; label: string; subtitle?: string }[];
          }[];
      }
    | { card: "empty"; message: string };

/** Canonical AED money formatter — mirrors the app-wide `AED N,NNN` display
 *  (payroll, insights, notification bodies, store fixtures). */
export const AED = (n: number) =>
    `AED ${Math.round(n).toLocaleString("en-US")}`;
