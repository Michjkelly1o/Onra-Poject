"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Performance-tab metric drill-down modals
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-08-07 — Phase 2 of "make every KPI card clickable". Covers the
// Performance tab's 4 cards (Sales / Revenue / New customers / Bookings). They
// REUSE the exact "Needs attention" shell + the Phase-1 cell primitives so the
// whole family looks identical.
//
// The Performance tab is BRANCH + PERIOD scoped (no session-type filter). Each
// modal re-derives its rows with the SAME predicate the card uses over the
// SAME period bounds (via dateFilterToRange) + the SAME branch scope, so the
// modal's total always equals the card's number.
//
// Revenue is the subtle one: the card accrues revenue (membership pro-rata +
// package per-credit-used), so the modal lists per-transaction ACCRUED amounts
// that sum to the card — not raw purchase amounts.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/Pagination";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { TABLE_TH, TABLE_TD } from "@/lib/table-styles";
import {
    ModalShell, branchInScope, CustomerCell, fmtDateTime,
} from "./NeedsAttentionModals";
import { PersonCell, deriveInitials, aed, isBillableSaleTxn } from "./TodayMetricModals";
import { useAppStore } from "@/lib/store";
import { dateFilterToRange } from "@/lib/period-filter";
import type { DateFilter } from "@/components/ui/date-range-filter";

const TH = TABLE_TH;
const TD = cn(TABLE_TD, "align-middle");
const DAY_MS = 86_400_000;

function isoDay(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

interface PerfModalProps {
    open: boolean;
    onClose: () => void;
    branchIds?: string[] | null;
    /** The Performance tab's DateRangeFilter value — the modal derives its
     *  window with `dateFilterToRange(period)`, identical to the card. */
    period: DateFilter;
}

// ─── 1. Sales (period) ──────────────────────────────────────────────────────
//
// Rows = billable sales whose purchase timestamp lands in the period. Headline
// = AED sold (cash-basis), matching the card's `salesPeriod`.

export function PerfSalesModal({ open, onClose, branchIds, period }: PerfModalProps) {
    const router = useRouter();
    const customers = useAppStore(s => s.customers);
    const customerTransactions = useAppStore(s => s.customerTransactions);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    function openCustomerPayments(id: string) {
        onClose();
        router.push(`/customers/${id}?tab=Payments&returnTo=${encodeURIComponent("/admin/dashboard")}`);
    }

    const rows = useMemo(() => {
        const { from, to } = dateFilterToRange(period);
        const fromMs = from.getTime();
        const toMs = to.getTime();
        const inRangeMs = (iso: string) => {
            const t = new Date(iso).getTime();
            return !Number.isNaN(t) && t >= fromMs && t <= toMs;
        };
        return customerTransactions
            .filter(t => isBillableSaleTxn(t) && inRangeMs(t.createdAtISO))
            .filter(t => branchInScope(t.branchId, branchIds))
            .slice()
            .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO))
            .map(t => {
                const c = customers.find(cx => cx.id === t.customerId);
                const name = c ? `${c.firstName} ${c.lastName}`.trim() : "Walk-in";
                return {
                    txn: t,
                    customerId: c?.id,
                    person: {
                        name,
                        email: c?.email,
                        initials: c ? (c.initials || deriveInitials(name)) : "WI",
                        imageUrl: c?.imageUrl,
                    },
                };
            });
    }, [customerTransactions, customers, branchIds, period]);

    const { sorted, sortKey, sortDir, toggle: toggleSort } =
        useSort<(typeof rows)[number]>(rows, {
            customer: (a, b) => a.person.name.localeCompare(b.person.name),
            product:  (a, b) => a.txn.name.localeCompare(b.txn.name),
            amount:   (a, b) => a.txn.amountAed - b.txn.amountAed,
            date:     (a, b) => a.txn.createdAtISO.localeCompare(b.txn.createdAtISO),
        });

    const totalRows = sorted.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const totalAed = useMemo(() => rows.reduce((sum, r) => sum + r.txn.amountAed, 0), [rows]);
    const paged = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            title="Sales"
            subtitle={
                <>
                    <span className="font-semibold text-[var(--colors-text-primary)]">{aed(Math.round(totalAed))}</span>{" "}
                    sold · <span className="font-semibold text-[var(--colors-text-primary)]">{totalRows} sale{totalRows === 1 ? "" : "s"}</span>{" "}
                    · {period.label}
                </>
            }
            footer={
                <Pagination
                    variant="compact" page={clampedPage} total={totalRows} pageSize={pageSize}
                    onPage={setPage} onPageSize={size => { setPageSize(size); setPage(1); }}
                />
            }
        >
            <div className="px-6">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={TH}><SortableHeader sortKey="customer" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Customer</SortableHeader></th>
                            <th className={TH}><SortableHeader sortKey="product" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Products or service</SortableHeader></th>
                            <th className={TH}><SortableHeader sortKey="amount" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Amount</SortableHeader></th>
                            <th className={TH}><SortableHeader sortKey="date" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Date &amp; Time</SortableHeader></th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(r => {
                            const clickable = !!r.customerId;
                            return (
                                <tr key={r.txn.id}
                                    onClick={clickable ? () => openCustomerPayments(r.customerId!) : undefined}
                                    className={cn("transition-colors", clickable && "hover:bg-[var(--colors-bg-secondary)]/50 cursor-pointer")}>
                                    <td className={TD}><PersonCell {...r.person} /></td>
                                    <td className={TD}>
                                        <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-[20px]">{r.txn.name}</p>
                                    </td>
                                    <td className={cn(TD, "whitespace-nowrap font-medium text-[var(--colors-text-primary)]")}>{aed(r.txn.amountAed)}</td>
                                    <td className={cn(TD, "text-[14px] text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{fmtDateTime(r.txn.createdAtISO)}</td>
                                </tr>
                            );
                        })}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">
                                    No sales in this period.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

// ─── 2. Revenue (period, accrual) ───────────────────────────────────────────
//
// Rows = per-transaction ACCRUED revenue in the period. Membership revenue is
// pro-rated across its duration; package revenue accrues per credit spent
// (booking = recognition event). Replicates `accrueRevenue` in page.tsx so the
// sum of the Accrued column equals the card.

export function PerfRevenueModal({ open, onClose, branchIds, period }: PerfModalProps) {
    const router = useRouter();
    const customers = useAppStore(s => s.customers);
    const customerTransactions = useAppStore(s => s.customerTransactions);
    const classBookings = useAppStore(s => s.classBookings);
    const memberships = useAppStore(s => s.memberships);
    const packages = useAppStore(s => s.packages);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    function openCustomerPayments(id: string) {
        onClose();
        router.push(`/customers/${id}?tab=Payments&returnTo=${encodeURIComponent("/admin/dashboard")}`);
    }

    const rows = useMemo(() => {
        const { from, to } = dateFilterToRange(period);
        const fromMs = from.getTime();
        const toMs = to.getTime();
        const inRangeMs = (iso: string) => {
            const t = new Date(iso).getTime();
            return !Number.isNaN(t) && t >= fromMs && t <= toMs;
        };
        interface Row {
            key: string;
            person: { name: string; email?: string; initials: string; imageUrl?: string };
            customerId?: string;
            product: string;
            basis: string;
            accruedAed: number;
        }
        const out: Row[] = [];
        for (const t of customerTransactions) {
            if (!isBillableSaleTxn(t)) continue;
            if (!branchInScope(t.branchId, branchIds)) continue;
            const purchaseMs = new Date(t.createdAtISO).getTime();
            if (Number.isNaN(purchaseMs)) continue;
            const c = customers.find(cx => cx.id === t.customerId);
            const name = c ? `${c.firstName} ${c.lastName}`.trim() : "Walk-in";
            const person = {
                name,
                email: c?.email,
                initials: c ? (c.initials || deriveInitials(name)) : "WI",
                imageUrl: c?.imageUrl,
            };

            if (t.kind === "membership") {
                const mem = memberships.find(m => m.id === t.productId);
                const durationDays = Math.max(1, (mem?.duration_months ?? 1) * 30);
                const expiryMs = purchaseMs + durationDays * DAY_MS;
                const overlap = Math.max(0, Math.min(expiryMs, toMs) - Math.max(purchaseMs, fromMs));
                if (overlap > 0) {
                    out.push({
                        key: t.id, person, customerId: c?.id, product: t.name,
                        basis: "Membership · pro-rated",
                        accruedAed: t.amountAed * (overlap / (durationDays * DAY_MS)),
                    });
                }
            } else if (t.kind === "package") {
                const pkg = packages.find(p => p.id === t.productId);
                const totalCredits = Math.max(1, pkg?.credits ?? 1);
                const revPerCredit = t.amountAed / totalCredits;
                const creditsUsed = classBookings.filter(b =>
                    b.customerId === t.customerId
                    && b.planKindUsed === "package"
                    && b.planId === t.productId
                    && b.status !== "cancelled"
                    && inRangeMs(b.bookingTime),
                ).length;
                if (creditsUsed > 0) {
                    out.push({
                        key: t.id, person, customerId: c?.id, product: t.name,
                        basis: `Package · ${creditsUsed} credit${creditsUsed === 1 ? "" : "s"} used`,
                        accruedAed: creditsUsed * revPerCredit,
                    });
                }
            }
        }
        return out;
    }, [customerTransactions, customers, classBookings, memberships, packages, branchIds, period]);

    const { sorted, sortKey, sortDir, toggle: toggleSort } =
        useSort<(typeof rows)[number]>(rows, {
            customer: (a, b) => a.person.name.localeCompare(b.person.name),
            product:  (a, b) => a.product.localeCompare(b.product),
            accrued:  (a, b) => a.accruedAed - b.accruedAed,
        });

    const totalRows = sorted.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const totalAccrued = useMemo(() => rows.reduce((sum, r) => sum + r.accruedAed, 0), [rows]);
    const paged = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            title="Revenue"
            subtitle={
                <>
                    <span className="font-semibold text-[var(--colors-text-primary)]">{aed(Math.round(totalAccrued))}</span>{" "}
                    earned · across{" "}
                    <span className="font-semibold text-[var(--colors-text-primary)]">{totalRows} plan{totalRows === 1 ? "" : "s"}</span>{" "}
                    · {period.label}
                </>
            }
            footer={
                <Pagination
                    variant="compact" page={clampedPage} total={totalRows} pageSize={pageSize}
                    onPage={setPage} onPageSize={size => { setPageSize(size); setPage(1); }}
                />
            }
        >
            <div className="px-6">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={TH}><SortableHeader sortKey="customer" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Customer</SortableHeader></th>
                            <th className={TH}><SortableHeader sortKey="product" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Plan</SortableHeader></th>
                            <th className={TH}>Basis</th>
                            <th className={TH}><SortableHeader sortKey="accrued" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Accrued</SortableHeader></th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(r => {
                            const clickable = !!r.customerId;
                            return (
                                <tr key={r.key}
                                    onClick={clickable ? () => openCustomerPayments(r.customerId!) : undefined}
                                    className={cn("transition-colors", clickable && "hover:bg-[var(--colors-bg-secondary)]/50 cursor-pointer")}>
                                    <td className={TD}><PersonCell {...r.person} /></td>
                                    <td className={TD}>
                                        <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-[20px]">{r.product}</p>
                                    </td>
                                    <td className={cn(TD, "text-[14px] text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{r.basis}</td>
                                    <td className={cn(TD, "whitespace-nowrap font-medium text-[var(--colors-text-primary)]")}>{aed(Math.round(r.accruedAed))}</td>
                                </tr>
                            );
                        })}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">
                                    No revenue earned in this period.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

// ─── 3. New customers (period) ──────────────────────────────────────────────
//
// Rows = active customers whose join date lands in the period. Matches the
// card's `newCustomersPeriod` (status active + createdAt in range).

export function PerfNewCustomersModal({ open, onClose, branchIds, period }: PerfModalProps) {
    const router = useRouter();
    const customers = useAppStore(s => s.customers);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    function viewCustomer(id: string) {
        onClose();
        router.push(`/customers/${id}?returnTo=${encodeURIComponent("/admin/dashboard")}`);
    }

    const rows = useMemo(() => {
        const { from, to } = dateFilterToRange(period);
        const fromMs = from.getTime();
        const toMs = to.getTime();
        const inRangeMs = (iso: string) => {
            const t = new Date(iso).getTime();
            return !Number.isNaN(t) && t >= fromMs && t <= toMs;
        };
        return customers
            .filter(c => c.status === "active")
            .filter(c => branchInScope(c.branchId, branchIds))
            .filter(c => inRangeMs(c.createdAt ?? ""))
            .map(c => ({ customer: c }));
    }, [customers, branchIds, period]);

    const { sorted, sortKey, sortDir, toggle: toggleSort } =
        useSort<(typeof rows)[number]>(rows, {
            customer: (a, b) => `${a.customer.firstName} ${a.customer.lastName}`.localeCompare(`${b.customer.firstName} ${b.customer.lastName}`),
            joined:   (a, b) => (a.customer.createdAt ?? "").localeCompare(b.customer.createdAt ?? ""),
        });

    const totalRows = sorted.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const paged = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            title="New customers"
            subtitle={
                <>
                    <span className="font-semibold text-[var(--colors-text-primary)]">
                        {totalRows} customer{totalRows === 1 ? "" : "s"}
                    </span>{" "}
                    joined · {period.label}
                </>
            }
            footer={
                <Pagination
                    variant="compact" page={clampedPage} total={totalRows} pageSize={pageSize}
                    onPage={setPage} onPageSize={size => { setPageSize(size); setPage(1); }}
                />
            }
        >
            <div className="px-6">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={TH}><SortableHeader sortKey="customer" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Customer</SortableHeader></th>
                            <th className={TH}><SortableHeader sortKey="joined" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Joined</SortableHeader></th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(r => (
                            <tr key={r.customer.id}
                                onClick={() => viewCustomer(r.customer.id)}
                                className="hover:bg-[var(--colors-bg-secondary)]/50 transition-colors cursor-pointer">
                                <td className={TD}><CustomerCell c={r.customer} /></td>
                                <td className={cn(TD, "text-[14px] text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{fmtDateTime(r.customer.createdAt)}</td>
                            </tr>
                        ))}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={2} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">
                                    No new customers in this period.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

// ─── 4. Bookings (period) ───────────────────────────────────────────────────
//
// Rows = booked class bookings on schedules whose date lands in the period.
// Matches the card's `bookingsPeriod` (scopedBookings status booked on
// in-range scopedSchedules). Class bookings only — no appointments, mirroring
// the card.

export function PerfBookingsModal({ open, onClose, branchIds, period }: PerfModalProps) {
    const router = useRouter();
    const customers = useAppStore(s => s.customers);
    const classBookings = useAppStore(s => s.classBookings);
    const classSchedules = useAppStore(s => s.classSchedules);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    function openClass(id: string) {
        onClose();
        router.push(`/schedule/${id}?returnTo=${encodeURIComponent("/admin/dashboard")}`);
    }

    const rows = useMemo(() => {
        const { from, to } = dateFilterToRange(period);
        const fromISO = isoDay(from);
        const toISO = isoDay(to);
        const inRangeDay = (iso: string) => {
            const d = iso.slice(0, 10);
            return d >= fromISO && d <= toISO;
        };
        const schedMap = new Map(
            classSchedules
                .filter(s => inRangeDay(s.dateISO) && branchInScope(s.branchId, branchIds))
                .map(s => [s.id, s] as const),
        );
        return classBookings
            .filter(b => branchInScope(b.branchId, branchIds) && b.status === "booked" && schedMap.has(b.classScheduleId))
            .map(b => {
                const sched = schedMap.get(b.classScheduleId)!;
                const c = customers.find(cx => cx.id === b.customerId);
                const name = c ? `${c.firstName} ${c.lastName}`.trim() : (b.guestName || "Guest");
                return {
                    booking: b,
                    sched,
                    customerId: c?.id,
                    person: {
                        name,
                        email: c?.email || b.guestEmail,
                        initials: c ? (c.initials || deriveInitials(name)) : deriveInitials(name),
                        imageUrl: c?.imageUrl,
                    },
                };
            });
    }, [classBookings, classSchedules, customers, branchIds, period]);

    const { sorted, sortKey, sortDir, toggle: toggleSort } =
        useSort<(typeof rows)[number]>(rows, {
            customer: (a, b) => a.person.name.localeCompare(b.person.name),
            klass:    (a, b) => a.sched.name.localeCompare(b.sched.name),
            date:     (a, b) => a.sched.dateISO.localeCompare(b.sched.dateISO),
        });

    const totalRows = sorted.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const paged = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            title="Bookings"
            subtitle={
                <>
                    <span className="font-semibold text-[var(--colors-text-primary)]">
                        {totalRows} booking{totalRows === 1 ? "" : "s"}
                    </span>{" "}
                    · {period.label}
                </>
            }
            footer={
                <Pagination
                    variant="compact" page={clampedPage} total={totalRows} pageSize={pageSize}
                    onPage={setPage} onPageSize={size => { setPageSize(size); setPage(1); }}
                />
            }
        >
            <div className="px-6">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={TH}><SortableHeader sortKey="customer" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Customer</SortableHeader></th>
                            <th className={TH}><SortableHeader sortKey="klass" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Class</SortableHeader></th>
                            <th className={TH}><SortableHeader sortKey="date" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Date</SortableHeader></th>
                            <th className={TH}>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(r => (
                            <tr key={r.booking.id}
                                onClick={() => openClass(r.sched.id)}
                                className="hover:bg-[var(--colors-bg-secondary)]/50 transition-colors cursor-pointer">
                                <td className={TD}><PersonCell {...r.person} /></td>
                                <td className={TD}>
                                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-[20px]">{r.sched.name}</p>
                                </td>
                                <td className={cn(TD, "text-[14px] text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{r.sched.dateISO.slice(0, 10)}</td>
                                <td className={cn(TD, "text-[14px] text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{r.sched.displayTime}</td>
                            </tr>
                        ))}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">
                                    No bookings in this period.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}
