"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Gift card report (/reports/gift-cards)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 4232:181034 (table) + 4232:183452 (Select column).
//
// **Phase 2 wired.** Rows derive from `issuedGiftCards` joined with
// `customers` (the buyer / holder) + `giftCardDesigns` (for the
// template name fallback). Recipient + sender display fields come
// directly off the issued row.

import { useMemo, useState } from "react";
import { MarkerPin01 } from "@untitledui/icons";
import { ReportShell, type ReportColumn } from "@/components/reports/ReportShell";
import { SelectColumnDropdown } from "@/components/reports/SelectColumnDropdown";
import { MultiSelectFilterDropdown } from "@/components/reports/MultiSelectFilterDropdown";
import { ExportDropdown } from "@/components/reports/ExportDropdown";
import { useDefaultBranchFilter } from "@/components/reports/use-default-branch-filter";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { dateFilterToRange, isoInRange } from "@/lib/period-filter";
import { buildCsv, downloadCsv, todayISO } from "@/lib/csv-export";
import { useAppStore, DEFAULT_BRANCH_ID } from "@/lib/store";

interface GiftCardRow {
    issuedId: string;
    branchId: string;
    branchName: string;
    purchaseDateISO: string;
    giftCardName: string;
    giftCardAmount: number;
    balanceLeft: number;
    senderName: string;
    senderEmail: string;
    recipientName: string;
    recipientEmail: string;
    redeemedDateISO: string;
    redeemedByName: string;
    redeemedByEmail: string;
    paymentSource: string;
}

function aed(n: number): string {
    return `AED ${Math.round(n).toLocaleString("en-US")}`;
}

function fmtDateTime(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day}, ${hh}:${mm}`;
}

const COLUMNS: ReportColumn<GiftCardRow>[] = [
    { key: "location",       label: "Branch location",  minWidth: 200, fixed: true, render: r => r.branchName,                    sort: { getValue: r => r.branchName } },
    { key: "purchaseDate",   label: "Purchase date",    minWidth: 180, fixed: true, render: r => fmtDateTime(r.purchaseDateISO),  sort: { getValue: r => r.purchaseDateISO } },
    { key: "giftCardName",   label: "Gift card name",   minWidth: 200, fixed: true, render: r => r.giftCardName,                  sort: { getValue: r => r.giftCardName } },
    { key: "giftCardAmount", label: "Gift card amount", minWidth: 160, fixed: true, render: r => aed(r.giftCardAmount),           sort: { getValue: r => r.giftCardAmount } },
    { key: "balanceLeft",    label: "Balance left",     minWidth: 140, fixed: true, render: r => aed(r.balanceLeft),              sort: { getValue: r => r.balanceLeft } },
    { key: "senderName",     label: "Sender name",      minWidth: 180, fixed: true, render: r => r.senderName,                    sort: { getValue: r => r.senderName } },
    { key: "senderEmail",    label: "Sender email",     minWidth: 220, fixed: true, render: r => r.senderEmail,                   sort: { getValue: r => r.senderEmail } },
    { key: "recipientName",  label: "Recipient name",   minWidth: 180, fixed: true, render: r => r.recipientName,                 sort: { getValue: r => r.recipientName } },
    { key: "recipientEmail", label: "Recipient email",  minWidth: 220, fixed: true, render: r => r.recipientEmail,                sort: { getValue: r => r.recipientEmail } },
    { key: "redeemedDate",   label: "Redeemed date",    minWidth: 180,              render: r => fmtDateTime(r.redeemedDateISO),  sort: { getValue: r => r.redeemedDateISO || "0000" } },
    { key: "redeemedByName", label: "Redeemed by name", minWidth: 180,              render: r => r.redeemedByName || "—",         sort: { getValue: r => r.redeemedByName } },
    { key: "redeemedByEmail",label: "Redeemed by email",minWidth: 220,              render: r => r.redeemedByEmail || "—",        sort: { getValue: r => r.redeemedByEmail } },
    { key: "paymentSource",  label: "Payment source",   minWidth: 180,              render: r => r.paymentSource,                 sort: { getValue: r => r.paymentSource } },
];

const DEFAULT_PERIOD: DateFilter = { type: "day", label: "Last 30 days" };
const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => !c.fixed).map(c => c.key));

export default function GiftCardReportPage() {
    const branches    = useAppStore(s => s.branches);
    const customers   = useAppStore(s => s.customers);
    const designs     = useAppStore(s => s.giftCardDesigns);
    const issuedCards = useAppStore(s => s.issuedGiftCards);
    const showToast   = useAppStore(s => s.showToast);

    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(DEFAULT_VISIBLE);
    const [branchFilter, setBranchFilter] = useDefaultBranchFilter();
    const [period, setPeriod] = useState<DateFilter>(DEFAULT_PERIOD);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const rows = useMemo<GiftCardRow[]>(() => {
        const customerById = new Map(customers.map(c => [c.id, c]));
        const designById   = new Map(designs.map(d => [d.id, d]));
        const branchById   = new Map(branches.map(b => [b.id, b]));

        return issuedCards.map(g => {
            const buyer  = customerById.get(g.customer_id);
            const design = designById.get(g.design_id);
            // Issued gift cards don't carry a branch_id yet — they're
            // sold at the buyer's home branch (matches POS behaviour).
            const branchId = buyer?.branchId ?? DEFAULT_BRANCH_ID;
            const branch   = branchById.get(branchId);

            const senderName  = g.sender_name ?? (buyer
                ? `${buyer.firstName} ${buyer.lastName}`.trim() : "—");
            const senderEmail = buyer?.email ?? "—";

            // "Redeemed" surfaces only when the card has actually been
            // spent (balance below face value) AND the holder is known.
            // The buyer is the holder, so they're also the redeemer.
            const isRedeemed = g.current_balance_aed < g.face_value_aed;
            const redeemedDate = isRedeemed && g.status !== "expired" ? g.issued_at : "";
            const redeemedName  = isRedeemed
                ? (buyer ? `${buyer.firstName} ${buyer.lastName}`.trim() : "—") : "";
            const redeemedEmail = isRedeemed ? (buyer?.email ?? "—") : "";

            return {
                issuedId: g.id,
                branchId,
                branchName: branch?.name ?? "—",
                purchaseDateISO: g.issued_at,
                giftCardName: design?.name ?? "Gift card",
                giftCardAmount: g.face_value_aed,
                balanceLeft: g.current_balance_aed,
                senderName,
                senderEmail,
                recipientName: g.recipient_name ?? "—",
                recipientEmail: g.recipient_email ?? "—",
                redeemedDateISO: redeemedDate,
                redeemedByName: redeemedName,
                redeemedByEmail: redeemedEmail,
                paymentSource: "POS",
            };
        });
    }, [issuedCards, customers, designs, branches]);

    const range = useMemo(() => dateFilterToRange(period), [period]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (!branchFilter.has(r.branchId)) return false;
            if (!isoInRange(r.purchaseDateISO, range)) return false;
            return true;
        });
    }, [rows, branchFilter, range]);

    const summaryText = useMemo(() => {
        const count = filteredRows.length;
        return `${count} record${count === 1 ? "" : "s"} · ${period.label}`;
    }, [filteredRows, period]);

    const branchOptions = useMemo(
        () => branches.filter(b => b.status !== "archive").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );

    function exportCsv() {
        if (filteredRows.length === 0) {
            showToast("Nothing to export", "No rows in the current view.", "error");
            return;
        }
        const exportCols = COLUMNS.filter(c => c.fixed || visibleKeys.has(c.key));
        const header = exportCols.map(c => c.label);
        const body = filteredRows.map(r => exportCols.map(c => csvValue(r, c.key)));
        const csv = buildCsv(header, body);
        downloadCsv(`gift-cards-${todayISO()}.csv`, csv);
        showToast("Gift cards exported", "CSV downloaded successfully.", "success", "check");
    }

    const toolbar = (
        <>
            <SelectColumnDropdown
                options={COLUMNS.filter(c => !c.fixed).map(c => ({ key: c.key, label: c.label }))}
                value={visibleKeys}
                onChange={setVisibleKeys}
            />
            <MultiSelectFilterDropdown
                icon={MarkerPin01}
                placeholder="Select location"
                value={branchFilter}
                options={branchOptions}
                onChange={setBranchFilter}
            />
            <DateRangeFilter value={period} onChange={setPeriod} />
            <ExportDropdown
                label="Export"
                variant="export"
                disabled={filteredRows.length === 0}
                onExportCsv={exportCsv}
            />
        </>
    );

    return (
        <ReportShell<GiftCardRow>
            title="Gift card"
            totalLabel="Total"
            summaryText={summaryText}
            toolbar={toolbar}
            columns={COLUMNS}
            visibleKeys={visibleKeys}
            rows={filteredRows}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            page={page}
            onPageChange={setPage}
            emptyTitle="No gift cards found"
            emptyMessage="Try a different location or period to see results."
        />
    );
}

function csvValue(r: GiftCardRow, key: string): string {
    switch (key) {
        case "location":         return r.branchName;
        case "purchaseDate":     return fmtDateTime(r.purchaseDateISO);
        case "giftCardName":     return r.giftCardName;
        case "giftCardAmount":   return aed(r.giftCardAmount);
        case "balanceLeft":      return aed(r.balanceLeft);
        case "senderName":       return r.senderName;
        case "senderEmail":      return r.senderEmail;
        case "recipientName":    return r.recipientName;
        case "recipientEmail":   return r.recipientEmail;
        case "redeemedDate":     return fmtDateTime(r.redeemedDateISO);
        case "redeemedByName":   return r.redeemedByName || "—";
        case "redeemedByEmail":  return r.redeemedByEmail || "—";
        case "paymentSource":    return r.paymentSource;
        default:                 return "";
    }
}
