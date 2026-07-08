"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Referral · Overview tab
// ─────────────────────────────────────────────────────────────────────────────
//
// Program-performance snapshot for the referral program:
//
//   • Header — "Referral program" + Active / Paused status pill + a
//     "resets in N days" note (N = days to end of the current month, when
//     the monthly budget rolls over) + a "Share program link" action.
//   • 4 metric cards — New members / Referrals sent / Credits issued /
//     Est. revenue.
//   • Monthly budget progress bar — rewards spent vs the configured cap.
//   • Top referrers — the full list of referrers in a paginated table
//     (no "view all" indirection; every referrer is listed here directly).
//
// All figures derive LIVE from the `customerReferrals` slice + the current
// `referralSettings` + centralized product averages (`memberships` /
// `packages`), so a new referral or a reward-config change reflects here on
// the same render cycle. See `deriveReferralOverview` in referral-helpers.

import { useMemo, useState } from "react";
import { Share07 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TableAvatar } from "@/components/ui/avatar";
import { Pagination } from "@/components/ui/Pagination";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { useAppStore } from "@/lib/store";
import { deriveReferralOverview } from "@/lib/referral-helpers";

function fmtAed(n: number): string {
    return `AED ${n.toLocaleString("en-US")}`;
}

/** Days until the end of the current calendar month — when the monthly
 *  program budget resets. Uses the real clock (client component). */
function daysToMonthEnd(): number {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const ms = endOfMonth.getTime() - now.getTime();
    return Math.max(0, Math.ceil(ms / 86_400_000));
}

interface ReferrerRow {
    customerId: string;
    name: string;
    email: string;
    initials: string;
    branchName: string;
    referrals: number;
    credits: number;
}

export function ReferralOverviewTab() {
    const customerReferrals = useAppStore(s => s.customerReferrals);
    const customers         = useAppStore(s => s.customers);
    const branches          = useAppStore(s => s.branches);
    const memberships       = useAppStore(s => s.memberships);
    const packages          = useAppStore(s => s.packages);
    const settings          = useAppStore(s => s.referralSettings);
    const showToast         = useAppStore(s => s.showToast);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // ── Centralized product averages feeding the derived KPIs ──────────────
    const avgMembershipPriceAed = useMemo(() => {
        const active = memberships.filter(m => m.status === "active");
        const pool = active.length ? active : memberships;
        if (!pool.length) return 0;
        return pool.reduce((s, m) => s + m.price_aed, 0) / pool.length;
    }, [memberships]);

    const avgAedPerCredit = useMemo(() => {
        const priced = packages.filter(p => p.credits > 0 && p.price_aed > 0);
        if (!priced.length) return 0;
        return priced.reduce((s, p) => s + p.price_aed / p.credits, 0) / priced.length;
    }, [packages]);

    const metrics = useMemo(
        () => deriveReferralOverview(customerReferrals, settings, avgMembershipPriceAed, avgAedPerCredit),
        [customerReferrals, settings, avgMembershipPriceAed, avgAedPerCredit],
    );

    // ── Top referrers — group the ledger by referrer, join to customer ─────
    const referrerRows = useMemo<ReferrerRow[]>(() => {
        const byReferrer = new Map<string, { referrals: number; credits: number }>();
        for (const r of customerReferrals) {
            const acc = byReferrer.get(r.referrerCustomerId) ?? { referrals: 0, credits: 0 };
            acc.referrals += 1;
            acc.credits += r.benefitCredits;
            byReferrer.set(r.referrerCustomerId, acc);
        }
        const rows: ReferrerRow[] = [];
        for (const [customerId, agg] of Array.from(byReferrer.entries())) {
            const c = customers.find(x => x.id === customerId);
            if (!c) continue;
            const branchName = branches.find(b => b.id === c.branchId)?.name ?? "—";
            rows.push({
                customerId,
                name: `${c.firstName} ${c.lastName}`.trim(),
                email: c.email,
                initials: c.initials,
                branchName,
                referrals: agg.referrals,
                credits: agg.credits,
            });
        }
        return rows;
    }, [customerReferrals, customers, branches]);

    const { sorted, sortKey, sortDir, toggle } = useSort<ReferrerRow>(referrerRows, {
        name:      (a, b) => a.name.localeCompare(b.name),
        referrals: (a, b) => a.referrals - b.referrals,
        credits:   (a, b) => a.credits - b.credits,
    });

    // Default view = most credits first (highest earners on top).
    const ranked = useMemo(
        () => sortKey ? sorted : [...referrerRows].sort((a, b) => b.credits - a.credits || b.referrals - a.referrals),
        [sorted, sortKey, referrerRows],
    );

    const totalPages = Math.max(1, Math.ceil(ranked.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const paged = ranked.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    const resetDays = daysToMonthEnd();

    function shareLink() {
        const link = "https://onra.studio/r/FITLAB";
        navigator.clipboard?.writeText(link);
        showToast(
            "Program link copied",
            "Share it anywhere — new sign-ups are attributed to the referral program.",
            "success", "check",
        );
    }

    const metricCards = [
        { label: "New members",    value: String(metrics.newMembers) },
        { label: "Referrals sent", value: String(metrics.referralsSent) },
        { label: "Credits issued", value: `${metrics.creditsIssued} ${metrics.creditsIssued === 1 ? "credit" : "credits"}` },
        { label: "Est. revenue",   value: fmtAed(metrics.estRevenueAed) },
    ];

    return (
        <div className="flex flex-col gap-4 max-w-[1100px]">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] flex items-center gap-4 p-6 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="flex-1 flex flex-col gap-1">
                    <div className="flex items-center gap-2.5">
                        <p className="text-[18px] font-semibold text-[#101828]">Referral program</p>
                        <span className={cn(
                            "inline-flex items-center gap-1.5 px-[10px] py-[2px] rounded-full text-[13px] font-medium border-1",
                            settings.programActive
                                ? "bg-[#ecfdf3] border-[#abefc6] text-[#067647]"
                                : "bg-[#f9fafb] border-[#e4e7ec] text-[#475467]",
                        )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", settings.programActive ? "bg-[#17b26a]" : "bg-[#98a2b3]")} />
                            {settings.programActive ? "Active" : "Paused"}
                        </span>
                    </div>
                    <p className="text-[14px] text-[#667085] leading-[20px]">
                        Monthly budget resets in {resetDays} {resetDays === 1 ? "day" : "days"}.
                    </p>
                </div>
                <Button variant="secondary-gray" size="md" leftIcon={<Share07 className="w-4 h-4" />} onClick={shareLink}>
                    Share program link
                </Button>
            </div>

            {/* ── Metric cards ───────────────────────────────────────────── */}
            <div className="flex gap-4">
                {metricCards.map(m => (
                    <div key={m.label} className="flex-1 bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-2 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <p className="text-[14px] text-[#667085]">{m.label}</p>
                        <p className="text-[24px] font-semibold text-[#101828] leading-[32px]">{m.value}</p>
                    </div>
                ))}
            </div>

            {/* ── Monthly budget progress ────────────────────────────────── */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] flex flex-col gap-4 p-6 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="flex items-end justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <p className="text-[16px] font-semibold text-[#101828]">Monthly budget</p>
                        <p className="text-[14px] text-[#667085] leading-[20px]">
                            Estimated value of rewards issued against this month&apos;s cap.
                        </p>
                    </div>
                    <p className="text-[14px] text-[#475467] shrink-0">
                        <span className="font-semibold text-[#101828]">{fmtAed(metrics.rewardsSpentAed)}</span>
                        {" "}of {metrics.budgetAed > 0 ? fmtAed(metrics.budgetAed) : "no cap"}
                    </p>
                </div>
                <div className="h-2 w-full rounded-full bg-[#f2f4f7] overflow-hidden">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all",
                            metrics.budgetPct >= 100 ? "bg-[#d92d20]" : "bg-[#658774]",
                        )}
                        style={{ width: `${metrics.budgetAed > 0 ? metrics.budgetPct : 0}%` }}
                    />
                </div>
                {metrics.budgetAed > 0 && (
                    <p className="text-[13px] text-[#667085]">{metrics.budgetPct}% of budget used</p>
                )}
            </div>

            {/* ── Top referrers ──────────────────────────────────────────── */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] flex flex-col shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="flex flex-col gap-1 p-6 pb-4">
                    <p className="text-[16px] font-semibold text-[#101828]">Top referrers</p>
                    <p className="text-[14px] text-[#667085] leading-[20px]">Members driving the most sign-ups.</p>
                </div>

                {ranked.length === 0 ? (
                    <div className="px-6 pb-8 pt-2">
                        <div className="border-1 border-dashed border-[#e4e7ec] rounded-[12px] py-10 flex flex-col items-center gap-1">
                            <p className="text-[14px] font-medium text-[#344054]">No referrers yet</p>
                            <p className="text-[13px] text-[#667085]">Referrers appear here once members start sharing their link.</p>
                        </div>
                    </div>
                ) : (
                    <div className="px-6 pb-6 flex flex-col gap-3">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={cn(TH, "w-[48px] text-center")}>#</th>
                                    <th className={TH}><SortableHeader sortKey="name"      currentSort={sortKey} dir={sortDir} onSort={toggle}>Member</SortableHeader></th>
                                    <th className={TH}>Branch</th>
                                    <th className={TH}><SortableHeader sortKey="referrals" currentSort={sortKey} dir={sortDir} onSort={toggle}>Referrals</SortableHeader></th>
                                    <th className={TH}><SortableHeader sortKey="credits"   currentSort={sortKey} dir={sortDir} onSort={toggle}>Credits earned</SortableHeader></th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map((r, i) => (
                                    <tr key={r.customerId} className="hover:bg-[#f9fafb] transition-colors">
                                        <td className={cn(TD, "text-center text-[14px] text-[#667085]")}>{(clampedPage - 1) * pageSize + i + 1}</td>
                                        <td className={TD}>
                                            <div className="flex items-center gap-3">
                                                <TableAvatar initials={r.initials} size={40} />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[14px] font-medium text-[#101828]">{r.name}</span>
                                                    <span className="text-[13px] text-[#475467]">{r.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={cn(TD, "text-[14px] text-[#475467]")}>{r.branchName}</td>
                                        <td className={cn(TD, "text-[14px] text-[#101828]")}>{r.referrals}</td>
                                        <td className={cn(TD, "text-[14px] text-[#101828]")}>{r.credits} {r.credits === 1 ? "credit" : "credits"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <Pagination page={clampedPage} total={ranked.length} pageSize={pageSize}
                            onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />
                    </div>
                )}
            </div>
        </div>
    );
}
