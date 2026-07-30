"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Stock on Hand report (/reports/retail-stock-on-hand)
// ─────────────────────────────────────────────────────────────────────────────
//
// Snapshot report — one row per retail product. Row shape matches Excel
// spec (Sheet 2 rows 505-519).

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { RetailStockOnHandRow } from "@/lib/reports/selectors";

interface StockOnHandDisplayRow {
    [k: string]: unknown;
    productName:         string;
    productCategory:     string;
    sku:                 string;
    unitsOnHand:         number;
    unitCost:            number;
    stockValue:          number;
    reorderThreshold:    number;
    unitsReceivedPeriod: number;
    unitsSoldPeriod:     number;
    sellThroughPct:      number;
    stockTurnover:       number;
    lastReceivedDateISO: string;
    lastSoldDateISO:     string;
    location:            string;
    branchId:            string;
}

export default function StockOnHandReportPage() {
    const retailProducts         = useAppStore(s => s.retailProducts);
    const retailCategories       = useAppStore(s => s.retailCategories);
    const retailStock            = useAppStore(s => s.retailStock);
    const retailStockAdjustments = useAppStore(s => s.retailStockAdjustments);
    const branches               = useAppStore(s => s.branches);

    const report = getReportById("retail-stock-on-hand");

    const raw = useMemo<RetailStockOnHandRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => RetailStockOnHandRow[];
        return fn({ retailProducts, retailCategories, retailStock, retailStockAdjustments, branches });
    }, [report, retailProducts, retailCategories, retailStock, retailStockAdjustments, branches]);

    const rows = useMemo<StockOnHandDisplayRow[]>(() => raw.map(r => ({ ...r }) satisfies StockOnHandDisplayRow), [raw]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Stock on Hand report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
