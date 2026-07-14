"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer detail · Referrals tab
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 5852:77841 (table) + 4108:186820 (filter).
//
// Lists every person this customer has successfully referred. Three metric
// cards summarise the customer's referral code, total referrals and total
// bonus credits earned. A customer who hasn't referred anyone shows the
// table's empty state (the metric cards still render, at zero).
//
// Data is derived live from useAppStore(s => s.customerReferrals); the
// referral code comes off the `customers` store.

import { useEffect, useMemo, useRef, useState } from "react";
import { SearchMd, FilterLines, ChevronLeft, XClose, AlignLeft, Copy01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { TableAvatar } from "@/components/ui/avatar";
import { DatePicker } from "@/components/ui/DatePicker";
import { useAppStore, type CustomerReferral } from "@/lib/store";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { SlidePanel } from "@/components/ui/SlidePanel";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReferralFilter {
    dateStart: string;
    dateEnd: string;
}
const EMPTY_REFERRAL_FILTER: ReferralFilter = { dateStart: "", dateEnd: "" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "2025-03-28, 10:00 PM" — date-referred column format. */
function fmtDateTime(iso: string): string {
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isNaN(d.getTime())) return "—";
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    let h = d.getUTCHours();
    const min = String(d.getUTCMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${y}-${m}-${day}, ${h}:${min} ${ampm}`;
}

/** "Olivia Rhye" → "OR". */
function nameInitials(name: string): string {
    return name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

// ─── Filter panel (Figma 4108:186820) ─────────────────────────────────────────

function ReferralFilterPanel({ open, onClose, applied, onApply }: {
    open: boolean; onClose: () => void;
    applied: ReferralFilter; onApply: (f: ReferralFilter) => void;
}) {
    const [pending, setPending] = useState<ReferralFilter>(EMPTY_REFERRAL_FILTER);
    useEffect(() => { if (open) setPending({ ...applied }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);

    const hasAny = pending.dateStart !== "" || pending.dateEnd !== "";

    return (
        <SlidePanel open={open} onClose={onClose} width={400}>
                <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Date range */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Date range</p>
                        <div className="grid grid-cols-2 gap-3">
                            <DatePicker value={pending.dateStart} placeholder="Start date"
                                onChange={v => setPending(p => ({
                                    ...p, dateStart: v,
                                    dateEnd: p.dateEnd && v && p.dateEnd < v ? "" : p.dateEnd,
                                }))} />
                            <DatePicker value={pending.dateEnd} placeholder="End date"
                                minDate={pending.dateStart || undefined}
                                onChange={v => setPending(p => ({ ...p, dateEnd: v }))} />
                        </div>
                    </div>
                </div>
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" disabled={!hasAny}
                        onClick={() => { setPending(EMPTY_REFERRAL_FILTER); onApply(EMPTY_REFERRAL_FILTER); onClose(); }}>Clear filter</Button>
                    <Button variant="primary" size="md" disabled={!hasAny}
                        onClick={() => { onApply(pending); onClose(); }}>Apply</Button>
                </div>
        </SlidePanel>
    );
}

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyBlock({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-6 pointer-events-auto">
                <div className="bg-[#f9fafb] rounded-[16px] p-[10px] w-[360px] flex gap-[10px] items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <div className="bg-white rounded-[10px] w-[51px] h-[51px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02)]">
                        <div className="bg-[#f9fafb] rounded-[7px] w-[31px] h-[31px] flex items-center justify-center">
                            <AlignLeft className="w-[18px] h-[18px] text-[#98a2b3]" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-[8px] flex-1 min-w-0">
                        <div className="bg-[#f2f4f7] h-[13px] w-[82px] rounded-full" />
                        <div className="bg-[#f2f4f7] h-[13px] w-full rounded-full" />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1 text-center max-w-[320px]">
                    <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">{title}</p>
                    <p className="text-[14px] text-[#475467] leading-[20px]">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}


// ─── Referrals tab ────────────────────────────────────────────────────────────

export function CustomerReferralsTab({ customerId }: { customerId: string }) {
    const customers = useAppStore(s => s.customers);
    const customerReferrals = useAppStore(s => s.customerReferrals);
    const branches = useAppStore(s => s.branches);
    // Cross-module sync (Phase 4) — when the admin deactivates the referral
    // program in Settings → Referral, the customer-facing share affordance
    // disappears here and a banner surfaces so anyone reviewing the tab can
    // see the program is paused.
    const referralProgramActive = useAppStore(s => s.referralSettings.programActive);
    /** Drives the new "Total referrals N / X" KPI denominator
     *  (Figma 7691:59021). Single source of truth — flipping the cap in
     *  the Reward rules & limits side panel re-renders this tab on the
     *  same cycle. When set to 0 (unlimited), only the numerator shows. */
    const maxReferralsPerMember = useAppStore(s => s.referralSettings.maxReferralsPerMember);
    /** v25 — Branch-lock toggle. When OFF, each row's earned credits
     *  are pinned to `originBranchId` (the referrer's branch at
     *  referral-creation). The Benefit column surfaces a small
     *  "Redeemable at [branch]" subtitle so admins see the constraint
     *  at a glance. */
    const creditsRedeemableAllBranches = useAppStore(s => s.referralSettings.creditsRedeemableAllBranches);
    const showToast = useAppStore(s => s.showToast);

    /** Look up a branch's display name from its id. Falls back to the
     *  id so a deleted branch still reads meaningfully. */
    const branchNameById = (id: string): string | undefined =>
        branches.find(b => b.id === id)?.name;

    const [search, setSearch] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [applied, setApplied] = useState<ReferralFilter>(EMPTY_REFERRAL_FILTER);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => { setPage(1); }, [search, applied]);

    const customer = customers.find(c => c.id === customerId);
    const referralCode = customer?.referralCode ?? "—";

    // ─── This customer's referrals (newest first) ───────────────────────────
    const rows = useMemo(
        () => customerReferrals
            .filter(r => r.referrerCustomerId === customerId)
            .sort((a, b) => b.referredAtISO.localeCompare(a.referredAtISO)),
        [customerReferrals, customerId],
    );

    // ─── Summary metrics (over all referrals, unfiltered) ───────────────────
    const totalReferrals = rows.length;
    // v56 — rewards are split by kind so the tab surfaces BOTH lines the
    // studio's program can pay out. Class credits (free_credits type) count
    // in the "N credits" total; account credits (wallet_credit type) count
    // in the AED total. Discount rows are ignored here — deferred until a
    // studio actually turns that reward on.
    const totalClassCredits = rows
        .filter(r => r.benefitType === "free_credits")
        .reduce((s, r) => s + r.benefitAmount, 0);
    const totalAccountCreditsAed = rows
        .filter(r => r.benefitType === "wallet_credit")
        .reduce((s, r) => s + r.benefitAmount, 0);

    // ─── Filtering + pagination ─────────────────────────────────────────────
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter(r => {
            if (q && !r.referredName.toLowerCase().includes(q) && !r.referredEmail.toLowerCase().includes(q)) return false;
            const date = r.referredAtISO.slice(0, 10);
            if (applied.dateStart && date < applied.dateStart) return false;
            if (applied.dateEnd && date > applied.dateEnd) return false;
            return true;
        });
    }, [rows, search, applied]);

    // ── Referrals sort — Referred customer / Benefit / Date referred /
    //    Expiry date. Rows without an explicit `expiresAtISO` sort to the
    //    end so legacy referrals (pre-v23 expiry column) stay
    //    discoverable but don't outrank dated ones.
    const { sorted: sortedReferrals, sortKey: referralSortKey, sortDir: referralSortDir, toggle: toggleReferralSort } = useSort<CustomerReferral>(filtered, {
        referred: (a, b) => a.referredName.localeCompare(b.referredName),
        // Sort by `benefitAmount` regardless of type — a 5-credit row and
        // an AED-5 row sort together numerically. Type is a semantic
        // qualifier surfaced in the cell, not a sort dimension.
        benefit:  (a, b) => a.benefitAmount - b.benefitAmount,
        date:     (a, b) => a.referredAtISO.localeCompare(b.referredAtISO),
        expiry:   (a, b) => (a.expiresAtISO ?? "9999").localeCompare(b.expiresAtISO ?? "9999"),
    });

    const totalPages = Math.max(1, Math.ceil(sortedReferrals.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const paged = sortedReferrals.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    const hasActiveFilter = applied.dateStart !== "" || applied.dateEnd !== "";

    // ─── Copy referral code ─────────────────────────────────────────────────
    function copyCode() {
        if (!customer?.referralCode) return;
        navigator.clipboard?.writeText(customer.referralCode);
        showToast(
            "Referral code copied",
            `${customer.referralCode} has been copied to your clipboard.`,
            "success", "check",
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Program-paused banner — fires when admin turns the referral
                program off via Settings → Referral. Historical referrals
                stay visible below but the share affordance is suppressed. */}
            {!referralProgramActive && (
                <div className="shrink-0 mx-6 mt-5 flex gap-3 items-start bg-[#fffaeb] border-1 border-[#fedf89] rounded-[12px] px-4 py-3">
                    <p className="text-[14px] text-[#b54708] leading-[20px]">
                        <span className="font-semibold">Referral program is currently paused.</span>{" "}
                        Customers can&apos;t earn or redeem referral rewards until the program is reactivated in Settings → Referral.
                    </p>
                </div>
            )}

            {/* Metric cards */}
            <div className="shrink-0 px-6 pt-5 pb-4 flex gap-4">
                <div className="flex-1 bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-2">
                    <p className="text-[14px] text-[#667085]">Referral code</p>
                    <div className="flex items-center gap-2">
                        <p className="text-[24px] font-semibold text-[#101828] leading-[32px]">{referralCode}</p>
                        {customer?.referralCode && referralProgramActive && (
                            <button type="button" onClick={copyCode}
                                className="w-7 h-7 flex items-center justify-center rounded-[6px] hover:bg-[#f2f4f7] transition-colors"
                                title="Copy referral code">
                                <Copy01 className="w-5 h-5 text-[#667085]" />
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex-1 bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-2">
                    <p className="text-[14px] text-[#667085]">Total referrals</p>
                    <p className="text-[24px] font-semibold text-[#101828] leading-[32px]">
                        {/* "N / cap" when a per-member cap is set, just "N"
                            when the cap is 0 (treat as unlimited). */}
                        {maxReferralsPerMember > 0
                            ? `${totalReferrals}/${maxReferralsPerMember}`
                            : totalReferrals}
                    </p>
                </div>
                {/* v56 — "Rewards earned" card. Mirrors the staff Payroll
                    page's pay-rate snapshot card (`PayRateSnapshotCard`)
                    1:1: `rounded-[12px]`, `p-5`, shadow, `gap-3` inside.
                    Title sits INSIDE the card at the top row; two columns
                    (Class credit | Account credit) sit below in a
                    `grid-cols-2 gap-4` layout with 14px muted labels +
                    16px medium values. */}
                <div className="flex-[1.5] min-w-0 bg-white border-1 border-[#e4e7ec] rounded-[12px] p-5 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                    {/* Title style matches sibling card labels ("Referral
                        code", "Total referrals") — 14px muted `#667085`,
                        no font-medium. */}
                    <p className="text-[14px] text-[#667085]">Rewards earned</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Class credit</p>
                            <p className="text-[16px] font-medium text-[#101828]">
                                {totalClassCredits} {totalClassCredits === 1 ? "credit" : "credits"}
                            </p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Account credit</p>
                            <p className="text-[16px] font-medium text-[#101828]">
                                AED {totalAccountCreditsAed.toLocaleString("en-US")}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="shrink-0 flex items-center gap-3 px-6 pb-4">
                <ToolbarTotal count={filtered.length} entitySingular="customer" size="sm" />
                <ToolbarSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Search customer..."
                    size="sm"
                />
                <ToolbarFilter onClick={() => setFilterOpen(true)} active={hasActiveFilter} />
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                {paged.length === 0 ? (
                    <EmptyBlock
                        title={rows.length === 0 ? "No referrals yet" : "No referrals found"}
                        subtitle={rows.length === 0
                            ? "This customer hasn't referred anyone yet."
                            : "Try adjusting your search or filter."}
                    />
                ) : (
                    <div className="px-6">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={cn(TH, "w-[320px]")}>
                                        <SortableHeader sortKey="referred" currentSort={referralSortKey} dir={referralSortDir} onSort={toggleReferralSort}>Referred customer</SortableHeader>
                                    </th>
                                    <th className={TH}>
                                        <SortableHeader sortKey="benefit"  currentSort={referralSortKey} dir={referralSortDir} onSort={toggleReferralSort}>Benefit</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[200px]")}>
                                        <SortableHeader sortKey="date"     currentSort={referralSortKey} dir={referralSortDir} onSort={toggleReferralSort}>Date referred</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[200px]")}>
                                        <SortableHeader sortKey="expiry"   currentSort={referralSortKey} dir={referralSortDir} onSort={toggleReferralSort}>Expiry date</SortableHeader>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map(r => (
                                    <tr key={r.id} className="hover:bg-[#f9fafb] transition-colors">
                                        <td className={TD}>
                                            <div className="flex items-center gap-3">
                                                <TableAvatar initials={nameInitials(r.referredName)} size={40} />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[14px] font-medium text-[#101828]">{r.referredName}</span>
                                                    <span className="text-[13px] text-[#475467]">{r.referredEmail}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={cn(TD, "text-[#667085]")}>
                                            <div className="flex flex-col gap-0.5">
                                                {/* v56 — type-aware Benefit cell. Class-credit rows
                                                    read "N credit(s)"; account-credit rows read
                                                    "AED N". Discount rows fall back to the legacy
                                                    "N credits" shape (not surfaced in the
                                                    prototype yet). */}
                                                <span>
                                                    {r.benefitType === "wallet_credit"
                                                        ? `AED ${r.benefitAmount.toLocaleString("en-US")}`
                                                        : `${r.benefitAmount} ${r.benefitAmount === 1 ? "credit" : "credits"}`}
                                                </span>
                                                {/* v25 — Branch-lock subtitle only surfaces when
                                                    (a) the global toggle is OFF, and (b) the row
                                                    has an origin branch captured. Amber tint
                                                    matches the "Re-accept due" / "N to re-accept"
                                                    warning stack. */}
                                                {!creditsRedeemableAllBranches && r.originBranchId && (
                                                    <span className="text-[12px] text-[#b54708] leading-[16px]">
                                                        Redeemable at {branchNameById(r.originBranchId) ?? "origin branch"}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={cn(TD, "text-[#667085] whitespace-nowrap")}>{fmtDateTime(r.referredAtISO)}</td>
                                        <td className={cn(TD, "text-[#667085] whitespace-nowrap")}>
                                            {r.expiresAtISO ? fmtDateTime(r.expiresAtISO) : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="px-6 shrink-0">
                <Pagination page={clampedPage} total={sortedReferrals.length} pageSize={pageSize}
                    onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />
            </div>

            <ReferralFilterPanel open={filterOpen} onClose={() => setFilterOpen(false)}
                applied={applied} onApply={f => { setApplied(f); setPage(1); }} />
        </div>
    );
}
