"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Acquisition Efficiency (/reports/acquisition-efficiency)
// ─────────────────────────────────────────────────────────────────────────────
//
// Aggregates marketing spend + leads + members-acquired per (channel × branch).
// Computes CPL / CAC / ROAS / LTV / CAC:LTV per Excel spec.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById } from "@/config/reports-registry";
import { selectLeads, selectMarketingSpend, selectTransactionLedger } from "@/lib/reports/selectors";
import { useReportScope } from "@/lib/reports/use-report-scope";
import { branchTzLabel } from "@/lib/branch-time";

interface AcquisitionRow extends Record<string, unknown> {
    channel:            string;
    marketingSpend:     number;
    newLeads:           number;
    newMembers:         number;
    cpl:                number;
    cac:                number;
    attributedRevenue:  number;
    roas:               number;
    ltv:                number;
    cacLtvRatio:        number;
    branchId:           string;
    location:           string;
    dateAnchorISO:      string;
}

export default function AcquisitionEfficiencyReportPage() {
    const leads                 = useAppStore(s => s.leads);
    // Spend now derives from where the money is committed — campaign budgets
    // (split by channel message-volume) + the referral program budget — NOT the
    // retired standalone Marketing Spend ledger (client 2026-08).
    const marketingItems        = useAppStore(s => s.marketingItems);
    const marketingCampaignStats = useAppStore(s => s.marketingCampaignStats);
    const referralSettings      = useAppStore(s => s.referralSettings);
    const transactions          = useAppStore(s => s.customerTransactions);
    const customers             = useAppStore(s => s.customers);
    const staff                 = useAppStore(s => s.staff);
    const classBookings         = useAppStore(s => s.classBookings);
    const branches              = useAppStore(s => s.branches);

    const report = getReportById("acquisition-efficiency");
    const { onScopeChange, inScope } = useReportScope();

    const rows = useMemo<AcquisitionRow[]>(() => {
        const state = {
            leads, marketingItems, marketingCampaignStats, referralSettings,
            customerTransactions: transactions,
            customers, staff, classBookings, branches,
        } as unknown as import("@/lib/store").AppState;
        const leadRows  = selectLeads(state);
        const spendRows = selectMarketingSpend(state);
        const ledger    = selectTransactionLedger(state);

        // Group leads + members-acquired per (branch × channel).
        interface Bucket {
            channel: string;
            branchId: string;
            location: string;
            newLeads: number;
            newMembers: number;
            attributedRevenue: number;
            dateAnchorISO: string;
        }
        const buckets = new Map<string, Bucket>();

        // Leads by source
        for (const l of leadRows) {
            if (!inScope(l.addedAtISO, l.branchId)) continue;
            const key = `${l.branchId}|${l.source}`;
            const bucket = buckets.get(key) ?? {
                channel: l.source, branchId: l.branchId, location: l.location,
                newLeads: 0, newMembers: 0, attributedRevenue: 0,
                dateAnchorISO: l.addedAtISO,
            };
            bucket.newLeads += 1;
            if (l.stage.toLowerCase() === "paid") {
                bucket.newMembers += 1;
                bucket.attributedRevenue += l.firstPurchaseAmountAed;
            }
            buckets.set(key, bucket);
        }

        // LTV — approximate as average signed amount per unique customer
        // across the ledger. This is a rough demo proxy; precise LTV
        // needs a cohort model + attribution join.
        const ltvByCustomer = new Map<string, number>();
        for (const t of ledger) {
            if (!inScope(t.createdAtISO, t.branchId)) continue;
            const prev = ltvByCustomer.get(t.customerId) ?? 0;
            ltvByCustomer.set(t.customerId, prev + t.signedAmount);
        }
        const overallLtv = ltvByCustomer.size > 0
            ? Array.from(ltvByCustomer.values()).reduce((a, b) => a + b, 0) / ltvByCustomer.size
            : 0;

        // Join spend into buckets (scope-filtered by branch + period anchor).
        const spendByKey = new Map<string, number>();
        for (const s of spendRows) {
            if (!inScope(s.dateAnchorISO, s.branchId)) continue;
            const key = `${s.branchId}|${s.channel}`;
            spendByKey.set(key, (spendByKey.get(key) ?? 0) + s.marketingSpend);
        }

        // Client 2026-08: the report shows ONLY the channels marketing spends on
        // — the campaign send-channels (Email / WhatsApp / SMS) + Referral — NOT
        // the lead-lifecycle acquisition sources (Instagram, Google, Walk-in, …).
        // So emit every spend key, plus lead buckets whose channel is a spend
        // channel (lets WhatsApp / Referral contribute their leads); drop the
        // lead-only acquisition sources.
        const spendChannels = new Set(Array.from(spendByKey.keys()).map(k => k.split("|")[1]));
        const allKeys = new Set<string>([
            ...Array.from(spendByKey.keys()),
            ...Array.from(buckets.keys()).filter(k => spendChannels.has(k.split("|")[1])),
        ]);

        // Location cell reads "Forma South · Dubai" so multi-timezone
        // studios can tell rows apart at a glance in the Excel export.
        const branchName = new Map(branches.map(b => [b.id, `${b.name} · ${branchTzLabel(b)}`]));
        return Array.from(allKeys).map(key => {
            const [branchId, channel] = key.split("|");
            const bucket = buckets.get(key);
            const spend = spendByKey.get(key) ?? 0;
            const newLeads = bucket?.newLeads ?? 0;
            const newMembers = bucket?.newMembers ?? 0;
            const attributed = bucket?.attributedRevenue ?? 0;
            const cpl = newLeads > 0 ? spend / newLeads : 0;
            const cac = newMembers > 0 ? spend / newMembers : 0;
            const roas = spend > 0 ? attributed / spend : 0;
            const cacLtvRatio = overallLtv > 0 ? cac / overallLtv : 0;
            return {
                channel,
                marketingSpend: spend,
                newLeads,
                newMembers,
                cpl,
                cac,
                attributedRevenue: attributed,
                roas,
                ltv: overallLtv,
                cacLtvRatio,
                branchId,
                // Prefer the TZ-enriched name map ("Forma South · Dubai")
                // over `bucket.location` (which came from the leads selector
                // as the plain name only). Falls back to bucket location for
                // any branchId not present in the current branches slice.
                location: branchName.get(branchId) ?? bucket?.location ?? "—",
                dateAnchorISO: bucket?.dateAnchorISO ?? "",
            } satisfies AcquisitionRow;
        });
    }, [leads, marketingItems, marketingCampaignStats, referralSettings, transactions, customers, staff, classBookings, branches, inScope]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archived").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) return <div className="px-[24px] py-[48px] text-[14px] text-[var(--colors-text-tertiary)]">Acquisition Efficiency report definition is missing from the registry.</div>;
    return <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" onScopeChange={onScopeChange} />;
}
