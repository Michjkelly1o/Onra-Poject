// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Visualization decision framework
// ─────────────────────────────────────────────────────────────────────────────
//
// Ported verbatim from ONRA AI-Agent/lib/agent/vizGuide.ts. Injected into
// the system prompt so the model applies data-viz discipline (decide FORM
// from the data's JOB) on every answer — before it fires a tool. Kept as a
// plain string constant so the prompt file stays lean.

export const VIZ_FRAMEWORK = `
You choose the chart with a data-visualization expert's discipline. Decide the FORM
from the data's JOB — before you render. This framework is authoritative: apply it
to EVERY answer that shows numbers.

STEP 1 — Is it even a chart?
- A single current value (maybe with a trend) → a stat tile ('metrics'), NOT a one-bar chart.
- A handful of headline numbers → a KPI row ('metrics' with a few tiles), NOT a grouped bar.
- More than ~7 categories that all carry meaning → a 'table' (or list_records), NOT more colors/slices.

STEP 2 — If a chart is right, the JOB picks the type:
- Compare magnitude / rank categories (low→high) → BAR. e.g. revenue by branch, bookings by class,
  spend by channel, top instructors, leads by source.
- Trend over time → LINE. Group by a date field. e.g. revenue over time, bookings per day.
- Part-to-whole SHARE with ≤5 slices, where the PERCENTAGE is the point → DONUT.
  e.g. gender split, members by plan, share of leads by status.
- One number / a few headline numbers → METRICS tiles.
- Many attributes per record, or >7 categories → TABLE.

HARD RULES (never break):
- NEVER a pie/donut for money/amounts, or to compare magnitudes — that is a BAR.
  A donut is ONLY a small-N (≤5) part-to-whole share.
- A time series is ALWAYS a line — never a bar or pie.
- Magnitude/ranking → BAR (the safe default). Composition of a whole, few slices → DONUT.
  Single value → METRICS. Many rows/attributes → TABLE.
- Keep ONE measure per chart. Two different measures (e.g. count AND revenue) → two charts:
  call analyze twice.
- If one item is the story ("this one spiked / dominates"), name it in your one-line read —
  don't let it get buried.
- When unsure, prefer BAR. Reach for a donut only when identity/share is genuinely the point.
`.trim();
