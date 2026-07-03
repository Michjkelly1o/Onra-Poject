"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Intro Offers report (/reports/intro-offers)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per customer's FIRST plan (the intro offer). Excel spec
// columns: Customer name/ID/email, Intro offer name, Purchase date,
// Expiry date, Sessions included, Sessions used, Converted to, Price
// (of converted-to plan).

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { CustomerPlanRow } from "@/lib/reports/selectors";

interface IntroOfferDisplayRow {
    [k: string]: unknown;
    customerName:      string;
    customerId:        string;
    customerEmail:     string;
    introOfferName:    string;
    purchaseDateISO:   string;
    expiryDateISO:     string;
    sessionsIncluded:  number;
    sessionsUsed:      number;
    convertedTo:       string;
    price:             number;
    branchId:          string;
    location:          string;
}

function parseCredits(creditsLabel: string): number {
    if (!creditsLabel) return 0;
    const m = /(\d+)/.exec(creditsLabel);
    return m ? Number(m[1]) : 0;
}

export default function IntroOffersReportPage() {
    const customerPlans = useAppStore(s => s.customerPlans);
    const customers     = useAppStore(s => s.customers);
    const branches      = useAppStore(s => s.branches);

    const report = getReportById("intro-offers");

    const raw = useMemo<CustomerPlanRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => CustomerPlanRow[];
        return fn({ customerPlans, customers, branches });
    }, [report, customerPlans, customers, branches]);

    const rows = useMemo<IntroOfferDisplayRow[]>(() => {
        // Group by customer to find their SECOND plan (the "converted-to").
        const byCustomer = new Map<string, CustomerPlanRow[]>();
        for (const r of raw) {
            const arr = byCustomer.get(r.customerId) ?? [];
            arr.push(r);
            byCustomer.set(r.customerId, arr);
        }
        for (const arr of Array.from(byCustomer.values())) {
            arr.sort((a, b) => a.purchasedAtISO.localeCompare(b.purchasedAtISO));
        }

        return raw
            .filter(r => r.isFirstPlan)
            .map(r => {
                const custPlans = byCustomer.get(r.customerId) ?? [];
                const converted = custPlans[1];   // second plan, if any
                return {
                    customerName:      r.customerName,
                    customerId:        r.customerId,
                    customerEmail:     r.customerEmail,
                    introOfferName:    r.planName,
                    purchaseDateISO:   r.purchasedAtISO.slice(0, 10),
                    expiryDateISO:     r.expiryISO.slice(0, 10),
                    sessionsIncluded:  parseCredits(r.creditsLabel),
                    // The store doesn't track per-plan credit usage yet;
                    // set to 0 until credit-consumption events land.
                    sessionsUsed:      0,
                    convertedTo:       converted?.planName ?? "",
                    // Price = price of the converted-to plan (per Excel spec).
                    price:             converted?.priceAed ?? 0,
                    branchId:          r.branchId,
                    location:          r.location,
                } satisfies IntroOfferDisplayRow;
            });
    }, [raw]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Intro Offers report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
