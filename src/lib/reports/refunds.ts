// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · void-vs-refund ledger resolver
// ─────────────────────────────────────────────────────────────────────────────
//
// Single source of truth for the client's requirement #10 (see
// new-prd/reports-implementation-plan.md §2.7):
//
//   "If the refund happens the same day, before the payment settles, most
//    systems void instead — a void cancels the sale entirely. However if it
//    does not happen the same day, you never restate a past month."
//
// Every Financial report reads its ledger through `resolveLedger()`. The
// helper normalises TWO seed patterns into one honest ledger:
//
//   Pattern A — new v30 rows (explicit `transactionType` set):
//     • "sale"      → included as a positive amount on its own date
//     • "refund"    → included as a negative amount on ITS OWN date
//                     (the refund's created_at, NOT the original sale's date).
//                     Never modifies the original sale row.
//     • "void"      → both the void row AND the linked original sale are
//                     ERASED from every report. Sales and voids never
//                     appear in aggregates because they never happened.
//     • "write_off" → included as a negative amount on its own date
//                     (treated the same as a refund for reporting purposes,
//                     but reason field flags it as bad debt for revenue
//                     recognition consumers).
//
//   Pattern B — legacy rows (no `transactionType` set — the ~30 seed rows
//   older than v30):
//     • `status: "complete"` → a normal sale on `created_at`.
//     • `status: "refunded"` → the SAME row was a sale on `created_at`
//                              AND later refunded on `refunded_at`.
//       The helper splits it into TWO virtual rows: the original sale
//       (positive, on `created_at`) + a synthetic refund row (negative,
//       on `refunded_at`). Applies the same-day/unsettled void rule:
//       when `refunded_at.slice(0,10) === created_at.slice(0,10)`, both
//       virtual rows are erased (treated as an implicit void).
//     • `status: "pending" | "failed"` → passes through as-is.
//
// The helper is a PURE function — no store reads, no side effects. Callers
// pass in the raw transaction array (from `useAppStore(s => s.customerTransactions)`)
// and receive the resolved ledger.

import type { CustomerTransaction } from "@/lib/store";

/** Resolved ledger row. Carries the SAME shape as `CustomerTransaction` with
 *  three guarantees:
 *   1. `transactionType` is always populated (defaulted to "sale" for
 *      legacy rows that didn't set it explicitly).
 *   2. Refund + write-off rows land on THEIR OWN date's period —
 *      `createdAtISO` is the refund/write-off's date, not the sale's.
 *   3. Void pairs have been erased. Anything you see below is either a
 *      real sale, a real refund, or a real write-off.
 *
 *  `amountAed` on refund/write-off rows is NEGATIVE (matches the seed convention
 *  + the Excel spec column "Refund amount — shown negative"). */
export type ResolvedLedgerRow = CustomerTransaction & {
    transactionType: "sale" | "refund" | "write_off";
};

/** Normalises the raw transaction array into an honest ledger per the
 *  client's void-vs-refund rule. See file header for the full contract.
 *
 *  Pure function — safe to call from any component or memo. Runs in O(N)
 *  with two passes: (1) index sales by id so linked rows can look them up,
 *  (2) filter + expand. */
export function resolveLedger(
    txns: readonly CustomerTransaction[],
): ResolvedLedgerRow[] {
    // Pass 1: id → sale map so refund/void/write_off rows can join back.
    // Only sale-kind rows (either explicit `transactionType: "sale"` or
    // legacy rows with no `transactionType` set) become lookup targets.
    const salesById = new Map<string, CustomerTransaction>();
    for (const t of txns) {
        const isSale = t.transactionType === "sale"
            || (t.transactionType === undefined
                && (t.status === "complete" || t.status === "pending" || t.status === "failed"));
        if (isSale) salesById.set(t.id, t);
    }

    // Pass 2: build the set of sale ids that got voided. A void erases
    // BOTH rows from every report, so we need this ahead of the emission
    // loop.
    const voidedSaleIds = new Set<string>();
    for (const t of txns) {
        if (t.transactionType === "void" && t.originalTransactionId) {
            voidedSaleIds.add(t.originalTransactionId);
        }
        // Legacy same-day refund heuristic (Pattern B implicit void):
        // status === "refunded" AND refunded_at same day as created_at.
        // Treats these as if the seed had been written as a void pair.
        if (
            t.transactionType === undefined
            && t.status === "refunded"
            && t.refundedAtISO
            && t.createdAtISO.slice(0, 10) === t.refundedAtISO.slice(0, 10)
        ) {
            voidedSaleIds.add(t.id);
        }
    }

    // Pass 3: emit the resolved ledger.
    const out: ResolvedLedgerRow[] = [];
    for (const t of txns) {
        // Skip anything the void rule erased.
        if (t.transactionType === "void") continue;
        if (voidedSaleIds.has(t.id)) continue;

        // Explicit v30 rows — pass through with `transactionType` normalized.
        if (t.transactionType === "sale") {
            out.push({ ...t, transactionType: "sale" });
            continue;
        }
        if (t.transactionType === "refund") {
            out.push({ ...t, transactionType: "refund" });
            continue;
        }
        if (t.transactionType === "write_off") {
            out.push({ ...t, transactionType: "write_off" });
            continue;
        }

        // Legacy Pattern B — split status === "refunded" into two virtual rows.
        if (t.transactionType === undefined) {
            if (t.status === "refunded" && t.refundedAtISO) {
                // Emit the ORIGINAL sale row unchanged (positive amount,
                // original date). The past NEVER restates.
                out.push({
                    ...t,
                    status: "complete",
                    transactionType: "sale",
                });
                // Emit a synthetic REFUND row on the refund's own date.
                out.push({
                    ...t,
                    id: `${t.id}::synthetic_refund`,
                    amountAed: -Math.abs(t.amountAed),
                    createdAtISO: t.refundedAtISO,
                    status: "refunded",
                    transactionType: "refund",
                    originalTransactionId: t.id,
                });
                continue;
            }
            // Everything else (complete / pending / failed with no refund):
            // pass through as a sale-kind row.
            out.push({ ...t, transactionType: "sale" });
            continue;
        }
    }

    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers built on top of resolveLedger — every Financial report
// uses these instead of re-implementing the sign convention.
// ─────────────────────────────────────────────────────────────────────────────

/** Signed amount as it should appear on a report line:
 *   • Sales      → positive
 *   • Refunds    → negative (the seed already stores refund amounts negative,
 *                  but legacy synthetic rows are stored positive and inverted
 *                  here — this helper hides the difference).
 *   • Write-offs → negative
 */
export function signedAmount(row: ResolvedLedgerRow): number {
    if (row.transactionType === "sale") return Math.abs(row.amountAed);
    return -Math.abs(row.amountAed);
}

/** Whether a row is a "money-in" event (sale that settled) — used by the
 *  Payments report to decide inclusion in "money in by method". */
export function isMoneyIn(row: ResolvedLedgerRow): boolean {
    return row.transactionType === "sale" && row.status === "complete";
}
