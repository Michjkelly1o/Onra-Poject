// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared table cell styles
// ─────────────────────────────────────────────────────────────────────────────
//
// Centralized `<th>` and `<td>` className strings used across every list
// table in the app (admin + instructor + customer profile inner tabs).
//
// History: every list page used to define its own `const TH = "..."` and
// `const TD = "..."` literal — 32 duplicates of the same string. Centralised
// here so a designer-driven change (padding tweak, color refresh) propagates
// to every table in one diff.
//
// Two known variants live OUTSIDE this file and stay local on purpose:
//   • src/app/admin/settings/agreements/page.tsx uses `text-[var(--colors-text-tertiary)]` (darker)
//   • src/components/customers/CustomerAgreementsTab.tsx adds `align-middle`
// Those files keep their inline constants until a follow-up refactor decides
// whether to upstream the variants here.

/** Header cell — used on every `<th>` in a Onra Studio data table. */
export const TABLE_TH = "px-4 py-3 text-left text-[12px] font-medium text-[var(--colors-text-quaternary)] border-b border-[var(--colors-border-secondary)]";

/** Body cell — used on every `<td>` in a Onra Studio data table. */
export const TABLE_TD = "px-4 py-4 text-[14px] text-[var(--colors-text-secondary)] border-b border-[var(--colors-bg-tertiary)]";
