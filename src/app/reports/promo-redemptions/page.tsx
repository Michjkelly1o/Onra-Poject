"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Promo Redemptions report (/reports/promo-redemptions)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per promo code. POS doesn't emit `discountCode` / `discountValue`
// on customer_transactions yet, so redemption counts + discount + revenue
// stay at 0 until the promo FK is wired through — the report surface is
// ready.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById } from "@/config/reports-registry";
import { selectTransactionLedger } from "@/lib/reports/selectors";
import { branchTzShortLabel } from "@/lib/branch-time";

interface PromoRedemptionRow extends Record<string, unknown> {
    promoCode:        string;
    promoName:        string;
    redemptions:      number;
    discountGiven:    number;
    revenueFromPromo: number;
    revenueCategory:  string;
    newVsExisting:    string;
    branchId:         string;
    location:         string;
    dateAnchorISO:    string;
}

export default function PromoRedemptionsReportPage() {
    const promoCodes    = useAppStore(s => s.promoCodes);
    const transactions  = useAppStore(s => s.customerTransactions);
    const customers     = useAppStore(s => s.customers);
    const branches      = useAppStore(s => s.branches);
    const staff         = useAppStore(s => s.staff);
    const classBookings = useAppStore(s => s.classBookings);

    const report = getReportById("promo-redemptions");

    const rows = useMemo<PromoRedemptionRow[]>(() => {
        const ledger = selectTransactionLedger({
            customerTransactions: transactions, customers, branches, staff, classBookings,
        } as unknown as import("@/lib/store").AppState);

        // Aggregate ledger rows by promo code + branch.
        interface Bucket {
            promoCode: string;
            promoName: string;
            redemptions: number;
            discountGiven: number;
            revenueFromPromo: number;
            revenueCategory: string;
            newCustomers: number;
            existingCustomers: number;
            branchId: string;
            location: string;
            dateAnchorISO: string;
        }
        const buckets = new Map<string, Bucket>();
        const customerFirstSeen = new Map<string, string>();
        for (const l of ledger) {
            if (!customerFirstSeen.has(l.customerId)) customerFirstSeen.set(l.customerId, l.createdAtISO);
        }

        for (const l of ledger) {
            if (l.transactionType !== "sale") continue;
            const promoCode = String((l as unknown as { discountCode?: string }).discountCode ?? "");
            const discountValue = Number((l as unknown as { discountValue?: number }).discountValue ?? 0);
            if (!promoCode || discountValue <= 0) continue;
            const promo = promoCodes.find(p => p.code === promoCode);
            const key = `${l.branchId}|${promoCode}`;
            const bucket = buckets.get(key) ?? {
                promoCode,
                promoName: promo?.code ?? promoCode,
                redemptions: 0,
                discountGiven: 0,
                revenueFromPromo: 0,
                revenueCategory: l.kind === "membership" ? "Membership" : "Package / Credits",
                newCustomers: 0,
                existingCustomers: 0,
                branchId: l.branchId,
                location: l.location,
                dateAnchorISO: l.createdAtISO,
            };
            bucket.redemptions      += 1;
            bucket.discountGiven    += discountValue;
            bucket.revenueFromPromo += Math.abs(l.signedAmount);
            if (customerFirstSeen.get(l.customerId) === l.createdAtISO) bucket.newCustomers += 1;
            else bucket.existingCustomers += 1;
            if (l.createdAtISO > bucket.dateAnchorISO) bucket.dateAnchorISO = l.createdAtISO;
            buckets.set(key, bucket);
        }

        // Also list promo codes that have no redemptions yet (surfaces
        // client's full promo catalogue).
        for (const p of promoCodes) {
            const alreadyBucketed = Array.from(buckets.values()).some(b => b.promoCode === p.code);
            if (alreadyBucketed) continue;
            for (const branch of branches) {
                const key = `${branch.id}|${p.code}`;
                buckets.set(key, {
                    promoCode: p.code,
                    promoName: p.code,
                    redemptions: 0,
                    discountGiven: 0,
                    revenueFromPromo: 0,
                    revenueCategory: "—",
                    newCustomers: 0,
                    existingCustomers: 0,
                    branchId: branch.id,
                    // Location cell reads "Forma South · Dubai" so
                    // multi-timezone studios can tell rows apart at a glance.
                    location: `${branch.name} · ${branchTzShortLabel(branch)}`,
                    dateAnchorISO: "",
                });
            }
        }

        // TZ-enriched name map — used to overwrite every row's `location`
        // regardless of whether it originally came from the selector
        // (redemption path) or the enrichment loop above (unused-promo
        // path). Guarantees "Forma South · Dubai" everywhere.
        const branchTzName = new Map(
            branches.map(bx => [bx.id, `${bx.name} · ${branchTzShortLabel(bx)}`]),
        );
        return Array.from(buckets.values()).map(b => ({
            promoCode:        b.promoCode,
            promoName:        b.promoName,
            redemptions:      b.redemptions,
            discountGiven:    b.discountGiven,
            revenueFromPromo: b.revenueFromPromo,
            revenueCategory:  b.revenueCategory,
            newVsExisting:    b.redemptions === 0 ? "—" : `${b.newCustomers} new / ${b.existingCustomers} existing`,
            branchId:         b.branchId,
            location:         branchTzName.get(b.branchId) ?? b.location,
            dateAnchorISO:    b.dateAnchorISO,
        } satisfies PromoRedemptionRow));
    }, [promoCodes, transactions, customers, branches, staff, classBookings]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Promo Redemptions report definition is missing from the registry.
            </div>
        );
    }

    return (
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
