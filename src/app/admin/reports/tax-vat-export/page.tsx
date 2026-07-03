"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Tax / VAT Export report (/admin/reports/tax-vat-export)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 4B. Aggregates the resolved ledger into per-(month × treatment ×
// category × branch) rows. Refunds are subtracted in the period they
// occurred — the "Net tax remitted" column is what accounting owes.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { LedgerRow } from "@/lib/reports/selectors";

interface TaxExportDisplayRow {
    [k: string]: unknown;
    periodKey:          string;
    period:             string;
    taxTreatment:       string;
    taxRatePct:         number;
    revenueCategory:    string;
    taxableGross:       number;
    taxableNet:         number;
    taxCollected:       number;
    refundsTaxRefunded: number;
    netTaxRemitted:     number;
    branchId:           string;
    location:           string;
}

const REVENUE_CATEGORY_LABEL: Record<string, string> = {
    membership: "Membership",
    package:    "Package / Credits",
};
const TREATMENT_LABEL: Record<string, string> = {
    standard:     "Standard-rated (5%)",
    zero_rated:   "Zero-rated",
    exempt:       "Exempt",
    out_of_scope: "Out of scope",
};

export default function TaxVatExportReportPage() {
    const transactions = useAppStore(s => s.customerTransactions);
    const customers    = useAppStore(s => s.customers);
    const branches     = useAppStore(s => s.branches);
    const staff        = useAppStore(s => s.staff);

    const report = getReportById("tax-vat-export");

    const rawLedger = useMemo<LedgerRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => LedgerRow[];
        return fn({ customerTransactions: transactions, customers, branches, staff, classBookings: [] });
    }, [report, transactions, customers, branches, staff]);

    const rows = useMemo<TaxExportDisplayRow[]>(() => {
        // Bucket by (branch, treatment, revenue category, YYYY-MM-15).
        // Mid-month anchor so the shell's row-level date filter picks
        // up buckets for any range overlapping the month.
        const monthKey = (iso: string) => `${iso.slice(0, 7)}-15`;

        interface Bucket {
            periodKey:          string;
            period:             string;
            taxTreatment:       string;
            taxTreatmentKey:    string;
            taxRatePct:         number;
            revenueCategory:    string;
            taxableGross:       number;
            taxableNet:         number;
            taxCollected:       number;
            refundsTaxRefunded: number;
            branchId:           string;
            location:           string;
        }

        const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const periodLabel = (k: string) => {
            const [y, m] = k.split("-");
            return `${MONTH[Number(m) - 1] ?? m} ${y}`;
        };

        const buckets = new Map<string, Bucket>();

        for (const r of rawLedger) {
            const treatmentKey = r.taxTreatment ?? "standard";
            const treatment = TREATMENT_LABEL[treatmentKey] ?? treatmentKey;
            const catLabel  = REVENUE_CATEGORY_LABEL[r.kind] ?? r.kind;
            const pkey      = monthKey(r.createdAtISO);
            const key       = `${r.branchId}|${treatmentKey}|${r.kind}|${pkey}`;

            const bucket = buckets.get(key) ?? {
                periodKey:          pkey,
                period:             periodLabel(pkey),
                taxTreatment:       treatment,
                taxTreatmentKey:    treatmentKey,
                taxRatePct:         Number(r.taxRatePercentage ?? 5),
                revenueCategory:    catLabel,
                taxableGross:       0,
                taxableNet:         0,
                taxCollected:       0,
                refundsTaxRefunded: 0,
                branchId:           r.branchId,
                location:           r.location,
            };

            const grossAbs = Math.abs(r.signedAmount);
            const taxAbs   = Math.abs(Number(r.taxAed ?? 0));
            const netAbs   = grossAbs - taxAbs;

            if (r.transactionType === "sale") {
                bucket.taxableGross += grossAbs;
                bucket.taxableNet   += netAbs;
                bucket.taxCollected += taxAbs;
            } else {
                // refund + write-off — subtract in period of occurrence
                bucket.taxableGross       -= grossAbs;
                bucket.taxableNet         -= netAbs;
                bucket.refundsTaxRefunded += taxAbs;
            }

            buckets.set(key, bucket);
        }

        return Array.from(buckets.values()).map(b => ({
            periodKey:          b.periodKey,
            period:             b.period,
            taxTreatment:       b.taxTreatment,
            taxRatePct:         b.taxRatePct,
            revenueCategory:    b.revenueCategory,
            taxableGross:       b.taxableGross,
            taxableNet:         b.taxableNet,
            taxCollected:       b.taxCollected,
            refundsTaxRefunded: b.refundsTaxRefunded,
            netTaxRemitted:     b.taxCollected - b.refundsTaxRefunded,
            branchId:           b.branchId,
            location:           b.location,
        } satisfies TaxExportDisplayRow));
    }, [rawLedger]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches
            .filter(b => b.status !== "archive")
            .map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Tax / VAT Export report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell
            report={report}
            rows={rows}
            branches={branchOptions}
            backHref="/admin/reports"
        />
    );
}
