// Generative-UI card contract. Insight tools return one of these; the chat
// renderer switches on `card` to draw the right component. Mirrors the Figma
// (see AI-AGENT-DESIGN-REFERENCE.md §4.1).

export type MetricTile = { label: string; value: string };

export type RankedRow = {
  title: string;
  subtitle?: string;
  right1?: string; // e.g. "142 bookings"
  right2?: string; // e.g. "89% occupancy"
};

export type TableCard = {
  card: "data_table";
  columns: string[];
  rows: string[][];
  note?: string;
};

export type SeriesPoint = { label: string; value: number };

export type InsightCard =
  | { card: "metric_group"; title?: string; tiles: MetricTile[]; note?: string; deepLink?: string }
  | { card: "ranked_list"; title: string; rows: RankedRow[]; note?: string; deepLink?: string }
  | {
      card: "line_chart";
      title: string;
      series: SeriesPoint[];
      unit?: "AED" | "count";
      valueLabel?: string; // tooltip label, e.g. "Total bookings"
      note?: string;
      deepLink?: string;
    }
  | {
      card: "bar_chart";
      title: string;
      unit?: "AED" | "count" | "rating";
      bars: { label: string; sublabel?: string; value: number }[];
      maxValue?: number; // override scaling (e.g. 5 for ratings)
      note?: string;
      deepLink?: string;
    }
  | {
      card: "donut";
      title: string;
      unit?: "AED" | "count";
      segments: { label: string; value: number }[];
      centerLabel?: string;
      centerValue?: string;
      note?: string;
      deepLink?: string;
    }
  | (TableCard & { deepLink?: string })
  | {
      card: "export";
      exportId: string;
      title: string;
      rowCount: number;
      columns: string[];
    }
  | { card: "empty"; message: string };

export const AED = (n: number) =>
  `AED ${Math.round(n).toLocaleString("en-US")}`;
