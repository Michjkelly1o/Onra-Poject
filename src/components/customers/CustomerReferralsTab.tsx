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
import { TableAvatar } from "@/components/ui/avatar";
import { DatePicker } from "@/components/ui/DatePicker";
import { useAppStore, type CustomerReferral } from "@/lib/store";

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
    if (!open) return null;

    const hasAny = pending.dateStart !== "" || pending.dateEnd !== "";

    return (
        <div className="fixed inset-0 z-[200] flex justify-end">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onClose} />
            <div className="relative w-[400px] h-full bg-white border-l border-[#e4e7ec] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col">
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
            </div>
        </div>
    );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, total, pageSize, onPage, onPageSize }: {
    page: number; total: number; pageSize: number; onPage: (p: number) => void; onPageSize: (s: number) => void;
}) {
    const [sizeOpen, setSizeOpen] = useState(false);
    const sizeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) setSizeOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return (
        <div className="shrink-0 flex items-center gap-3 py-4 border-t border-[#e4e7ec]">
            <div ref={sizeRef} className="relative flex items-center gap-2 flex-1">
                <button type="button" onClick={() => setSizeOpen(p => !p)}
                    className="flex items-center gap-1 px-3 py-[7px] border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] text-[14px] font-semibold text-[#344054]">
                    {pageSize}<ChevronLeft className="w-4 h-4 text-[#667085] rotate-90" />
                </button>
                {sizeOpen && (
                    <div className="absolute bottom-[calc(100%+4px)] left-0 z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 min-w-[80px]">
                        {[10, 20, 30].map(s => (
                            <button key={s} type="button" onClick={() => { onPageSize(s); setSizeOpen(false); }}
                                className={cn("flex items-center w-full px-4 py-[9px] text-[14px] font-medium hover:bg-[#f9fafb] transition-colors", s === pageSize ? "text-[#101828] font-semibold" : "text-[#344054]")}>{s}</button>
                        ))}
                    </div>
                )}
                <span className="text-[14px] font-medium text-[#344054]">per page</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-[14px] font-medium text-[#344054] whitespace-nowrap">Page {page} of {totalPages}</span>
                <button type="button" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}
                    className={cn("px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page <= 1 ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Previous</button>
                <button type="button" disabled={page >= totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))}
                    className={cn("px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page >= totalPages ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Next</button>
            </div>
        </div>
    );
}

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

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

// ─── Referrals tab ────────────────────────────────────────────────────────────

export function CustomerReferralsTab({ customerId }: { customerId: string }) {
    const customers = useAppStore(s => s.customers);
    const customerReferrals = useAppStore(s => s.customerReferrals);
    const showToast = useAppStore(s => s.showToast);

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
    const totalBonusCredits = rows.reduce((s, r) => s + r.benefitCredits, 0);

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

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const paged = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

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
            {/* Metric cards */}
            <div className="shrink-0 px-6 pt-5 pb-4 flex gap-4">
                <div className="flex-1 bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-2">
                    <p className="text-[14px] text-[#667085]">Referral code</p>
                    <div className="flex items-center gap-2">
                        <p className="text-[24px] font-semibold text-[#101828] leading-[32px]">{referralCode}</p>
                        {customer?.referralCode && (
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
                    <p className="text-[24px] font-semibold text-[#101828] leading-[32px]">{totalReferrals}</p>
                </div>
                <div className="flex-1 bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-2">
                    <p className="text-[14px] text-[#667085]">Total bonus credits</p>
                    <p className="text-[24px] font-semibold text-[#101828] leading-[32px]">
                        {totalBonusCredits} {totalBonusCredits === 1 ? "credit" : "credits"}
                    </p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="shrink-0 flex items-center gap-3 px-6 pb-4">
                <div className="flex-1">
                    <p className="text-[14px] text-[#667085]">Total</p>
                    <p className="text-[14px] font-medium text-[#101828]">
                        {filtered.length} {filtered.length === 1 ? "customer" : "customers"}
                    </p>
                </div>
                <div className="relative w-[200px]">
                    <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search customer..."
                        className="h-9 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>
                <Button variant="secondary-gray" size="md"
                    leftIcon={
                        <div className="relative">
                            <FilterLines className="w-4 h-4" />
                            {hasActiveFilter && <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border border-white" />}
                        </div>
                    }
                    onClick={() => setFilterOpen(true)}>Filter</Button>
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
                                    <th className={cn(TH, "w-[320px]")}>Referred customer</th>
                                    <th className={TH}>Benefit</th>
                                    <th className={cn(TH, "w-[240px]")}>Date referred</th>
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
                                            {r.benefitCredits} free {r.benefitCredits === 1 ? "credit" : "credits"}
                                        </td>
                                        <td className={cn(TD, "text-[#667085] whitespace-nowrap")}>{fmtDateTime(r.referredAtISO)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="px-6 shrink-0">
                <Pagination page={clampedPage} total={filtered.length} pageSize={pageSize}
                    onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />
            </div>

            <ReferralFilterPanel open={filterOpen} onClose={() => setFilterOpen(false)}
                applied={applied} onApply={f => { setApplied(f); setPage(1); }} />
        </div>
    );
}
