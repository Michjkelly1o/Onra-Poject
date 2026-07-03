"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Gift Card report (/admin/reports/gift-cards)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 4B. Snapshot report — one row per issued gift card. Uses the
// new selectGiftCards selector. No period pivot; the shell renders
// straight list mode.

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { PivotableReportShell, type BranchOption } from "@/components/reports/PivotableReportShell";
import { getReportById, resolveSelector } from "@/config/reports-registry";
import type { GiftCardRow } from "@/lib/reports/selectors";

const STATUS_LABEL: Record<GiftCardRow["status"], string> = {
    active:   "Active",
    redeemed: "Redeemed",
    expired:  "Expired",
};

interface GiftCardDisplayRow {
    [k: string]: unknown;
    code:           string;
    designName:     string;
    customerName:   string;
    customerId:     string;
    customerEmail:  string;
    recipientName:  string;
    recipientEmail: string;
    senderName:     string;
    faceValue:      number;
    redeemed:       number;
    currentBalance: number;
    status:         string;
    issuedAtISO:    string;
    expiresAtISO:   string;
    branchId:       string;
    location:       string;
}

export default function GiftCardsReportPage() {
    // Reactive slices — subscribe to everything the selector touches.
    const issuedGiftCards = useAppStore(s => s.issuedGiftCards);
    const giftCardDesigns = useAppStore(s => s.giftCardDesigns);
    const customers       = useAppStore(s => s.customers);
    const branches        = useAppStore(s => s.branches);

    const report = getReportById("gift-cards");

    const raw = useMemo<GiftCardRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => GiftCardRow[];
        return fn({
            issuedGiftCards,
            giftCardDesigns,
            customers,
            branches,
        });
    }, [report, issuedGiftCards, giftCardDesigns, customers, branches]);

    const rows = useMemo<GiftCardDisplayRow[]>(() => {
        return raw.map(c => ({
            code:           c.code,
            designName:     c.designName,
            customerName:   c.customerName,
            customerId:     c.customerId,
            customerEmail:  c.customerEmail,
            recipientName:  c.recipientName || "—",
            recipientEmail: c.recipientEmail || "—",
            senderName:     c.senderName || "—",
            faceValue:      c.faceValue,
            redeemed:       c.redeemed,
            currentBalance: c.currentBalance,
            status:         STATUS_LABEL[c.status] ?? c.status,
            issuedAtISO:    c.issuedAtISO.slice(0, 10),
            expiresAtISO:   c.expiresAtISO.slice(0, 10),
            branchId:       c.branchId,
            location:       c.location,
        } satisfies GiftCardDisplayRow));
    }, [raw]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches
            .filter(b => b.status !== "archive")
            .map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    if (!report) {
        return (
            <div className="px-[24px] py-[48px] text-[14px] text-[#475467]">
                Gift Card report definition is missing from the registry.
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
