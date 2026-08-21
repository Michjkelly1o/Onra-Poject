"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Today-tab metric drill-down modals
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-08-07 — every KPI card on the dashboard becomes clickable and
// opens a drill-down modal showing the underlying records behind the number.
// Phase 1 covers the Today tab's 4 cards (Sales / Revenue / New customers /
// Bookings). The modals REUSE the exact "Needs attention" shell + primitives
// (ModalShell, branchInScope, CustomerCell, fmtDateTime) so they look
// identical to the existing family.
//
// Correctness invariant: each modal re-derives its rows from the live store
// using the SAME predicate the Today card uses to compute its value, scoped
// by the same branch pick and passed the page's `todayISO` — so the modal's
// row count always equals the card's number (no gaps, no drift).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/Pagination";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { TABLE_TH, TABLE_TD } from "@/lib/table-styles";
import { recognizedRevenueLineItems } from "@/lib/reports/recognized-revenue";
import {
    ModalShell, branchInScope, CustomerCell, fmtDateTime,
} from "./NeedsAttentionModals";
import { useAppStore, type SessionType, type CustomerTransaction } from "@/lib/store";

const TH = TABLE_TH;
const TD = cn(TABLE_TD, "align-middle");

const TYPE_LABEL: Record<SessionType, string> = {
    class: "Class", private: "Private", recovery: "Recovery",
};

export function aed(n: number): string {
    return `AED ${n.toLocaleString("en-US")}`;
}

/** Billable-sale predicate — the SINGLE source shared by the Today card
 *  (page.tsx) and the Sales / Revenue / New-customers modals so their counts
 *  always agree. A completed sale that isn't a refund / void / penalty /
 *  freeze-fee / gift-card (gift cards are deferred revenue). Date scoping is
 *  applied separately by each caller. */
export function isBillableSaleTxn(t: CustomerTransaction): boolean {
    return t.status === "complete"
        && (t.transactionType === undefined || t.transactionType === "sale")
        && t.kind !== "cancellation_penalty"
        && t.kind !== "freeze_fee"
        && t.kind !== "gift_card";
}

/** Map a transaction's `kind` to the session type it belongs to, so the Today
 *  tab's Type filter (Class / Private / Recovery) can scope Sales, Revenue and
 *  New customers the same data-native way the transaction ledger already
 *  models it. `membership` + `package` are class-credit plans → Class; the
 *  session-payment kinds map 1:1; retail / gift-card / penalties have no
 *  session type (returns null → excluded from a typed view). */
export function txnSessionType(kind: CustomerTransaction["kind"]): SessionType | null {
    if (kind === "membership" || kind === "package") return "class";
    if (kind === "private") return "private";
    if (kind === "recovery") return "recovery";
    return null;
}

export function deriveInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    const a = parts[0]?.[0] ?? "";
    const b = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
    return `${a}${b}`.toUpperCase() || "—";
}

/** Two-line person cell — identical markup to the shared CustomerCell, but
 *  fed from a normalized `{ name, email, initials, imageUrl }` so it also
 *  renders walk-in POS sales (no customer record) and guest bookings without
 *  dropping the row (which would make the modal count disagree with the
 *  card). Used for Sales / Revenue / Bookings; New-customers uses the shared
 *  CustomerCell directly since those rows are always real customers. */
export function PersonCell({ name, email, initials, imageUrl }: {
    name: string; email?: string; initials: string; imageUrl?: string;
}) {
    return (
        <div className="flex items-center gap-3">
            {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={imageUrl} alt={name} loading="lazy"
                    style={{ width: 40, height: 40 }}
                    className="rounded-full object-cover shrink-0 border border-black/[0.04]"
                />
            ) : (
                <div
                    style={{ width: 40, height: 40, backgroundColor: "#f2f4f7", fontSize: 40 * 0.32 }}
                    className="rounded-full flex items-center justify-center shrink-0 text-[var(--colors-text-tertiary)] font-semibold border border-black/[0.04]"
                >
                    {initials}
                </div>
            )}
            <div className="flex flex-col min-w-0">
                <p className="text-[14px] font-semibold text-[var(--colors-text-primary)] leading-[20px] truncate">{name}</p>
                {email ? <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px] truncate">{email}</p> : null}
            </div>
        </div>
    );
}

// ─── 1 + 2. Sales / Revenue modal ──────────────────────────────────────────
//
// Both cards drill into the SAME record set — today's billable sale
// transactions — because Sales = count and Revenue = sum of that set. The
// `variant` only changes the title + headline emphasis. Predicate mirrors
// `isBillableSaleToday` in page.tsx exactly (complete sale, no refund / void /
// penalty / freeze / gift-card) so the modal count == the card.

export interface TodaySalesModalProps {
    open: boolean;
    onClose: () => void;
    branchIds?: string[] | null;
    todayISO: string;
    variant: "sales" | "revenue";
    /** Today-tab session-type filter. "" = all types (every billable sale);
     *  a type narrows to sales whose kind maps to it (see `txnSessionType`).
     *  Mirrors the card so count == list. */
    typeFilter: SessionType | "";
}

export function TodaySalesModal({ open, onClose, branchIds, todayISO, variant, typeFilter }: TodaySalesModalProps) {
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
        return customerTransactions
            .filter(t => isBillableSaleTxn(t) && t.createdAtISO.startsWith(todayISO))
            // Session-type scope — same mapping the card uses.
            .filter(t => !typeFilter || txnSessionType(t.kind) === typeFilter)
            .filter(t => branchInScope(t.branchId, branchIds))
            // Newest first by default; the header sorts still work.
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
    }, [customerTransactions, customers, branchIds, todayISO, typeFilter]);

    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } =
        useSort<(typeof rows)[number]>(rows, {
            customer: (a, b) => a.person.name.localeCompare(b.person.name),
            product:  (a, b) => a.txn.name.localeCompare(b.txn.name),
            amount:   (a, b) => a.txn.amountAed - b.txn.amountAed,
            date:     (a, b) => a.txn.createdAtISO.localeCompare(b.txn.createdAtISO),
        });

    const totalRows = sortedRows.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const totalAed = useMemo(() => rows.reduce((sum, r) => sum + r.txn.amountAed, 0), [rows]);
    const paged = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
    const typeNote = typeFilter ? ` · ${TYPE_LABEL[typeFilter]} only` : "";

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            title={variant === "revenue" ? "Revenue today" : "Sales today"}
            subtitle={
                variant === "revenue" ? (
                    <>
                        <span className="font-semibold text-[var(--colors-text-primary)]">{aed(totalAed)}</span>{" "}
                        collected today · from{" "}
                        <span className="font-semibold text-[var(--colors-text-primary)]">{totalRows} sale{totalRows === 1 ? "" : "s"}</span>{typeNote}
                    </>
                ) : (
                    <>
                        <span className="font-semibold text-[var(--colors-text-primary)]">{totalRows} sale{totalRows === 1 ? "" : "s"}</span>{" "}
                        today · <span className="font-semibold text-[var(--colors-text-primary)]">{aed(totalAed)}</span> collected{typeNote}
                    </>
                )
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
                            <th className={cn(TH, "!text-right")}><SortableHeader sortKey="amount" currentSort={sortKey} dir={sortDir} onSort={toggleSort} align="right">Amount</SortableHeader></th>
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
                                    <td className={cn(TD, "whitespace-nowrap font-medium text-[var(--colors-text-primary)]", "text-right")}>{aed(r.txn.amountAed)}</td>
                                    <td className={cn(TD, "text-[14px] text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{fmtDateTime(r.txn.createdAtISO)}</td>
                                </tr>
                            );
                        })}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">
                                    No sales recorded today.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

// ─── 3. New customers today modal ───────────────────────────────────────────
//
// Rows = customers created today, branch-scoped. Mirrors the Today card's
// `newCustomers` count EXACTLY (scopedCustomers created today, no status /
// booking filter — that's what the card counts).

export interface NewCustomersTodayModalProps {
    open: boolean;
    onClose: () => void;
    branchIds?: string[] | null;
    todayISO: string;
    /** Today-tab session-type filter. "" = every customer who joined today; a
     *  type narrows to those who also made a purchase of that type today
     *  (same rule the card uses so count == list). */
    typeFilter: SessionType | "";
}

// ─── Today · Revenue (recognized — credits used) ─────────────────────────────
// Lists the recognized-revenue line items so the modal SUM equals the Revenue
// card: each class credit spent today (package / credit-based membership),
// plus unlimited-membership straight-line earned today, plus retail/private/
// recovery recognized at sale. Same engine the card uses.
export function TodayRevenueModal({ open, onClose, branchIds, todayISO, typeFilter }: Omit<TodaySalesModalProps, "variant">) {
    const router = useRouter();
    const customers = useAppStore(s => s.customers);
    const customerTransactions = useAppStore(s => s.customerTransactions);
    const classBookings = useAppStore(s => s.classBookings);
    const packages = useAppStore(s => s.packages);
    const memberships = useAppStore(s => s.memberships);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    function openCustomerPayments(id: string) {
        onClose();
        router.push(`/customers/${id}?tab=Payments&returnTo=${encodeURIComponent("/admin/dashboard")}`);
    }

    const rows = useMemo(() => {
        const txns = customerTransactions
            .filter(t => branchInScope(t.branchId, branchIds))
            .filter(t => !typeFilter || txnSessionType(t.kind) === typeFilter);
        const bookings = classBookings.filter(b => branchInScope(b.branchId, branchIds));
        const dayStartMs = new Date(`${todayISO}T00:00:00`).getTime();
        const dayEndMs   = new Date(`${todayISO}T23:59:59.999`).getTime();
        const items = recognizedRevenueLineItems({ transactions: txns, bookings, packages, memberships }, dayStartMs, dayEndMs);
        return items.map((it, i) => {
            const c = customers.find(cx => cx.id === it.customerId);
            const name = c ? `${c.firstName} ${c.lastName}`.trim() : "Walk-in";
            return {
                key: `${it.customerId}-${i}`,
                item: it,
                customerId: c?.id,
                person: { name, email: c?.email, initials: c ? (c.initials || deriveInitials(name)) : "WI", imageUrl: c?.imageUrl },
            };
        });
    }, [customerTransactions, classBookings, packages, memberships, customers, branchIds, todayISO, typeFilter]);

    const totalRows = rows.length;
    const totalAed = useMemo(() => rows.reduce((sum, r) => sum + r.item.amountAed, 0), [rows]);
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const paged = rows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            width={760}
            title="Revenue today"
            subtitle={
                <span className="font-semibold text-[var(--colors-text-primary)]">{aed(totalAed)}</span>
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
                            <th className={TH}>Customer</th>
                            <th className={TH}>Detail</th>
                            <th className={cn(TH, "!text-right")}>Earned</th>
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
                                    <td className={TD}><p className="text-[14px] text-[var(--colors-text-primary)] leading-[20px]">{r.item.label}</p></td>
                                    <td className={cn(TD, "whitespace-nowrap font-medium text-[var(--colors-text-primary)]", "text-right")}>{aed(r.item.amountAed)}</td>
                                </tr>
                            );
                        })}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={3} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">
                                    No revenue recognised today.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

export function NewCustomersTodayModal({ open, onClose, branchIds, todayISO, typeFilter }: NewCustomersTodayModalProps) {
    const router = useRouter();
    const customers = useAppStore(s => s.customers);
    const customerTransactions = useAppStore(s => s.customerTransactions);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    function viewCustomer(id: string) {
        onClose();
        router.push(`/customers/${id}?returnTo=${encodeURIComponent("/admin/dashboard")}`);
    }

    const rows = useMemo(() => {
        // When a session type is picked, keep only new customers who also made
        // a purchase of that type today — same rule as the card.
        const hasTypedTxnToday = (custId: string) => customerTransactions.some(t =>
            t.customerId === custId
            && isBillableSaleTxn(t)
            && t.createdAtISO.startsWith(todayISO)
            && branchInScope(t.branchId, branchIds)
            && txnSessionType(t.kind) === typeFilter,
        );
        return customers
            .filter(c => branchInScope(c.branchId, branchIds))
            .filter(c => (c.createdAt ?? "").startsWith(todayISO))
            .filter(c => !typeFilter || hasTypedTxnToday(c.id))
            .map(c => ({ customer: c }));
    }, [customers, customerTransactions, branchIds, todayISO, typeFilter]);

    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } =
        useSort<(typeof rows)[number]>(rows, {
            customer: (a, b) => `${a.customer.firstName} ${a.customer.lastName}`.localeCompare(`${b.customer.firstName} ${b.customer.lastName}`),
            signedUp: (a, b) => (a.customer.createdAt ?? "").localeCompare(b.customer.createdAt ?? ""),
        });

    const totalRows = sortedRows.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const paged = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            title="New customers today"
            subtitle={
                <>
                    <span className="font-semibold text-[var(--colors-text-primary)]">
                        {totalRows} customer{totalRows === 1 ? "" : "s"}
                    </span>{" "}
                    joined today{typeFilter ? ` with a ${TYPE_LABEL[typeFilter]} purchase` : ""}
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
                            <th className={TH}><SortableHeader sortKey="signedUp" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Signed up</SortableHeader></th>
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
                                    No new customers today.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

// ─── 4. Bookings today modal ────────────────────────────────────────────────
//
// Rows = booked seats on today's sessions (classes + private/recovery
// appointments), respecting the Today tab's Type filter. Reconciles with the
// card's `sessionMetrics.bookingsToday` (Σ session.booked): a class's `booked`
// == its status-"booked" ClassBookings; an appointment's `booked` == its
// non-cancelled AppointmentBookings.

export interface BookingsTodayModalProps {
    open: boolean;
    onClose: () => void;
    branchIds?: string[] | null;
    todayISO: string;
    typeFilter: SessionType | "";
}

export function BookingsTodayModal({ open, onClose, branchIds, todayISO, typeFilter }: BookingsTodayModalProps) {
    const router = useRouter();
    const customers = useAppStore(s => s.customers);
    const classBookings = useAppStore(s => s.classBookings);
    const classSchedules = useAppStore(s => s.classSchedules);
    const appointments = useAppStore(s => s.appointments);
    const appointmentBookings = useAppStore(s => s.appointmentBookings);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    function openSession(kind: "class" | "appointment", id: string) {
        onClose();
        const base = kind === "class" ? "/schedule" : "/appointments";
        router.push(`${base}/${id}?returnTo=${encodeURIComponent("/admin/dashboard")}`);
    }

    const rows = useMemo(() => {
        interface Row {
            key: string;
            person: { name: string; email?: string; initials: string; imageUrl?: string };
            customerId?: string;
            sessionKind: "class" | "appointment";
            sessionId: string;
            sessionName: string;
            sessionTime: string;
            sessionType: SessionType;
            location: string;
        }
        const out: Row[] = [];

        // Classes — included when the type filter is All or Class.
        if (typeFilter === "" || typeFilter === "class") {
            const todayScheds = new Map(
                classSchedules
                    .filter(s => s.dateISO === todayISO && s.type === "class" && branchInScope(s.branchId, branchIds))
                    .map(s => [s.id, s] as const),
            );
            for (const b of classBookings) {
                if (b.status !== "booked") continue;
                const sched = todayScheds.get(b.classScheduleId);
                if (!sched) continue;
                const c = customers.find(cx => cx.id === b.customerId);
                const name = c ? `${c.firstName} ${c.lastName}`.trim() : (b.guestName || "Guest");
                out.push({
                    key: b.id,
                    person: {
                        name,
                        email: c?.email || b.guestEmail,
                        initials: c ? (c.initials || deriveInitials(name)) : deriveInitials(name),
                        imageUrl: c?.imageUrl,
                    },
                    customerId: c?.id,
                    sessionKind: "class",
                    sessionId: sched.id,
                    sessionName: sched.name,
                    sessionTime: sched.displayTime,
                    sessionType: "class",
                    location: sched.location,
                });
            }
        }

        // Appointments (private + recovery) — included when the type filter is
        // All or matches the appointment's type.
        if (typeFilter !== "class") {
            const todayAppts = new Map(
                appointments
                    .filter(a =>
                        a.dateISO === todayISO
                        // Appointments are inherently private/recovery
                        // (ServiceType), so an empty type filter includes them
                        // all; a "class" filter excludes them (handled by the
                        // outer `typeFilter !== "class"` guard).
                        && (typeFilter === "" || a.type === typeFilter)
                        && branchInScope(a.branchId, branchIds),
                    )
                    .map(a => [a.id, a] as const),
            );
            for (const ab of appointmentBookings) {
                if (ab.status === "Cancelled") continue;
                const appt = todayAppts.get(ab.appointmentId);
                if (!appt) continue;
                const c = customers.find(cx => cx.id === ab.customerId);
                const name = c ? `${c.firstName} ${c.lastName}`.trim() : (ab.customerName || "Customer");
                out.push({
                    key: ab.id,
                    person: {
                        name,
                        email: c?.email,
                        initials: c ? (c.initials || deriveInitials(name)) : (ab.customerInitials || deriveInitials(name)),
                        imageUrl: c?.imageUrl || ab.customerImageUrl,
                    },
                    customerId: c?.id,
                    sessionKind: "appointment",
                    sessionId: appt.id,
                    sessionName: appt.serviceName,
                    sessionTime: appt.displayTime,
                    sessionType: appt.type,
                    location: appt.branchName,
                });
            }
        }

        return out;
    }, [classBookings, classSchedules, appointments, appointmentBookings, customers, branchIds, todayISO, typeFilter]);

    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } =
        useSort<(typeof rows)[number]>(rows, {
            customer: (a, b) => a.person.name.localeCompare(b.person.name),
            session:  (a, b) => a.sessionName.localeCompare(b.sessionName),
            time:     (a, b) => a.sessionTime.localeCompare(b.sessionTime),
        });

    const totalRows = sortedRows.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const paged = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
    const typeNote = typeFilter ? ` · ${TYPE_LABEL[typeFilter]} only` : "";

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            title="Bookings today"
            subtitle={
                <>
                    <span className="font-semibold text-[var(--colors-text-primary)]">
                        {totalRows} booking{totalRows === 1 ? "" : "s"}
                    </span>{" "}
                    on today&apos;s sessions{typeNote}
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
                            <th className={TH}><SortableHeader sortKey="session" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Session</SortableHeader></th>
                            <th className={TH}><SortableHeader sortKey="time" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Time</SortableHeader></th>
                            <th className={TH}>Location</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(r => (
                            <tr key={r.key}
                                onClick={() => openSession(r.sessionKind, r.sessionId)}
                                className="hover:bg-[var(--colors-bg-secondary)]/50 transition-colors cursor-pointer">
                                <td className={TD}><PersonCell {...r.person} /></td>
                                <td className={TD}>
                                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-[20px]">{r.sessionName}</p>
                                    <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px]">{TYPE_LABEL[r.sessionType]}</p>
                                </td>
                                <td className={cn(TD, "text-[14px] text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{r.sessionTime}</td>
                                <td className={cn(TD, "text-[14px] text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{r.location}</td>
                            </tr>
                        ))}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">
                                    No bookings on today&apos;s sessions.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}
