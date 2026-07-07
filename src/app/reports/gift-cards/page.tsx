"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Gift Card report (/reports/gift-cards)
// ─────────────────────────────────────────────────────────────────────────────
//
// Snapshot report — one row per issued gift card. Row shape matches
// Excel spec (Sheet 2 rows 130-152).

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
    purchaseDateISO:     string;
    expiryDateISO:       string;
    giftCardNumber:      string;
    transactionNumber:   string;
    purchaserName:       string;
    purchaserEmail:      string;
    recipientName:       string;
    recipientEmail:      string;
    faceValue:           number;
    redeemedAmount:      number;
    balance:             number;
    status:              string;
    lastRedeemedDateISO: string;
    branchId:            string;
    location:            string;
}

export default function GiftCardsReportPage() {
    const issuedGiftCards = useAppStore(s => s.issuedGiftCards);
    const giftCardDesigns = useAppStore(s => s.giftCardDesigns);
    const customers       = useAppStore(s => s.customers);
    const branches        = useAppStore(s => s.branches);

    const report = getReportById("gift-cards");

    const raw = useMemo<GiftCardRow[]>(() => {
        if (!report) return [];
        const fn = resolveSelector(report) as unknown as (state: unknown) => GiftCardRow[];
        return fn({ issuedGiftCards, giftCardDesigns, customers, branches });
    }, [report, issuedGiftCards, giftCardDesigns, customers, branches]);

    const rows = useMemo<GiftCardDisplayRow[]>(() => {
        return raw.map(c => ({
            purchaseDateISO:     c.issuedAtISO.slice(0, 10),
            expiryDateISO:       c.expiresAtISO.slice(0, 10),
            giftCardNumber:      c.code,
            // The store doesn't join gift-card issuance back to a
            // transaction id — carrying a blank for now until POS starts
            // writing the FK to `issued_gift_cards.transaction_id`.
            transactionNumber:   "",
            purchaserName:       c.customerName,
            purchaserEmail:      c.customerEmail,
            recipientName:       c.recipientName || "—",
            recipientEmail:      c.recipientEmail || "—",
            faceValue:           c.faceValue,
            redeemedAmount:      c.redeemed,
            balance:             c.currentBalance,
            status:              STATUS_LABEL[c.status] ?? c.status,
            // Not tracked per card in today's seed — the store carries
            // only aggregate redeemed amount, not a per-redemption log.
            lastRedeemedDateISO: "",
            branchId:            c.branchId,
            location:            c.location,
        } satisfies GiftCardDisplayRow));
    }, [raw]);

    const branchOptions = useMemo<BranchOption[]>(
        () => branches.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
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
        <PivotableReportShell report={report} rows={rows} branches={branchOptions} backHref="/admin/reports" />
    );
}
