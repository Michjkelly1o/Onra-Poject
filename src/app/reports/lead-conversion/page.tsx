"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Lead Conversion report (/reports/lead-conversion)
// ─────────────────────────────────────────────────────────────────────────────
//
// Aggregates leads per branch (current window). Excel spec: 7 metrics per
// row. When the user picks Period=Month/Quarter, the shell pivots.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { LeadRow } from "@/lib/reports/selectors";

interface LeadConversionRow extends Record<string, unknown> {
    periodKey:             string;
    newLeads:              number;
    leadsToTrial:          number;
    leadToTrialPct:        number;
    leadsToPaid:           number;
    leadToPaidPct:         number;
    avgTimeToConvert:      number;
    avgTimeToFirstContact: number;
    branchId:              string;
    location:              string;
}

export default function LeadConversionReportPage() {
    const leads    = useAppStore(s => s.leads);
    const staff    = useAppStore(s => s.staff);
    const branches = useAppStore(s => s.branches);

    const report = getReportById("lead-conversion");

    const raw = useMemo<LeadRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => LeadRow[];
        return fn({ leads, staff, branches });
    }, [report, leads, staff, branches]);

    const rows = useMemo<LeadConversionRow[]>(() => {
        // Bucket per (branch × month of added_at). periodKey mid-month.
        interface Bucket {
            branchId: string;
            location: string;
            periodKey: string;
            newLeads: number;
            leadsToTrial: number;
            leadsToPaid: number;
            convertDays: number[];
            contactDays: number[];
        }
        const buckets = new Map<string, Bucket>();
        for (const l of raw) {
            const key = `${l.branchId}|${l.addedAtISO.slice(0, 7)}-15`;
            const bucket = buckets.get(key) ?? {
                branchId: l.branchId,
                location: l.location,
                periodKey: `${l.addedAtISO.slice(0, 7)}-15`,
                newLeads: 0,
                leadsToTrial: 0,
                leadsToPaid: 0,
                convertDays: [],
                contactDays: [],
            };
            bucket.newLeads += 1;
            const stageLower = l.stage.toLowerCase();
            if (stageLower.includes("trial") || stageLower.includes("paid")) bucket.leadsToTrial += 1;
            if (stageLower === "paid") {
                bucket.leadsToPaid += 1;
                if (l.firstPurchaseISO) {
                    const diff = (new Date(l.firstPurchaseISO).getTime() - new Date(l.addedAtISO).getTime()) / (24 * 60 * 60 * 1000);
                    if (Number.isFinite(diff) && diff >= 0) bucket.convertDays.push(diff);
                }
            }
            if (l.firstContactISO) {
                const diff = (new Date(l.firstContactISO).getTime() - new Date(l.addedAtISO).getTime()) / (24 * 60 * 60 * 1000);
                if (Number.isFinite(diff) && diff >= 0) bucket.contactDays.push(diff);
            }
            buckets.set(key, bucket);
        }
        return Array.from(buckets.values()).map(b => {
            const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
            return {
                periodKey:             b.periodKey,
                newLeads:              b.newLeads,
                leadsToTrial:          b.leadsToTrial,
                leadToTrialPct:        b.newLeads > 0 ? (b.leadsToTrial / b.newLeads) * 100 : 0,
                leadsToPaid:           b.leadsToPaid,
                leadToPaidPct:         b.newLeads > 0 ? (b.leadsToPaid / b.newLeads) * 100 : 0,
                avgTimeToConvert:      avg(b.convertDays),
                avgTimeToFirstContact: avg(b.contactDays),
                branchId:              b.branchId,
                location:              b.location,
            } satisfies LeadConversionRow;
        });
    }, [raw]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) return <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">Lead Conversion report definition is missing from the registry.</div>;
    return <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />;
}
