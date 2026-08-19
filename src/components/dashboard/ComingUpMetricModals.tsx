"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Coming Up-tab metric drill-down modals
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-08-07 — Phase 3 of "make every KPI clickable". Every Coming Up
// tile opens a drill-down modal reusing the same "Needs attention" shell + cell
// primitives. Rows come from `stripDrilldown` (coming-up.ts), which mirrors
// `stripMetrics` row-for-row, so each modal's count/sum equals its tile value.
//
// The forward window (next 7 / 30 days) + session-type filter are already baked
// into the rows the page passes in (page runs stripDrilldown over the same
// branch-scoped slices the ComingUpTab strip uses). Under-filled classes reuse
// the existing UnderFilledModal, so it isn't re-implemented here.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/Pagination";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { TABLE_TH, TABLE_TD } from "@/lib/table-styles";
import { ModalShell, CustomerCell, fmtDate } from "./NeedsAttentionModals";
import { PersonCell, deriveInitials, aed } from "./TodayMetricModals";
import { aedFull } from "@/lib/dashboard/coming-up";
import type {
    RevenueDrillRow, BookingDrillRow, PersonDrillRow, ExpiringDrillRow,
} from "@/lib/dashboard/coming-up";
import type { ClassInstance, Customer, SessionType } from "@/lib/store";

const TH = TABLE_TH;
const TD = cn(TABLE_TD, "align-middle");

const TYPE_LABEL: Record<SessionType, string> = {
    class: "Class", private: "Private", recovery: "Recovery",
};

const RETURN_TO = `?returnTo=${encodeURIComponent("/admin/dashboard")}`;

/** Build a normalized person from a customer id (falls back gracefully). */
function personFor(customerId: string | undefined, byId: Map<string, Customer>) {
    const c = customerId ? byId.get(customerId) : undefined;
    if (!c) return { name: "Customer", initials: "—" as string, email: undefined as string | undefined, imageUrl: undefined as string | undefined };
    const name = `${c.firstName} ${c.lastName}`.trim();
    return { name, email: c.email, initials: c.initials || deriveInitials(name), imageUrl: c.imageUrl };
}

function sessionHref(kind: "class" | "appointment", id: string): string {
    return `${kind === "class" ? "/schedule" : "/appointments"}/${id}${RETURN_TO}`;
}
function sessionHrefForType(type: SessionType, id: string): string {
    return sessionHref(type === "class" ? "class" : "appointment", id);
}

interface BaseProps {
    open: boolean;
    onClose: () => void;
    /** "next 7 days" / "next 30 days" — window copy for the subtitle. */
    rangeLabel: string;
    /** Active session-type filter — appends "· Class only" to the subtitle. */
    typeFilter: SessionType | "";
}

function typeNote(typeFilter: SessionType | ""): string {
    return typeFilter ? ` · ${TYPE_LABEL[typeFilter]} only` : "";
}

// ─── 1. Revenue (projected) ─────────────────────────────────────────────────

export function ComingRevenueModal({ open, onClose, rangeLabel, typeFilter, rows }: BaseProps & { rows: RevenueDrillRow[] }) {
    const router = useRouter();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    const { sorted, sortKey, sortDir, toggle: toggleSort } =
        useSort<RevenueDrillRow>(rows, {
            session: (a, b) => a.session.name.localeCompare(b.session.name),
            date:    (a, b) => a.session.dateISO.localeCompare(b.session.dateISO),
            booked:  (a, b) => (a.session.booked ?? 0) - (b.session.booked ?? 0),
            revenue: (a, b) => a.revenueAed - b.revenueAed,
        });
    const totalRows = sorted.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const totalAed = useMemo(() => rows.reduce((s, r) => s + r.revenueAed, 0), [rows]);
    const paged = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return (
        <ModalShell
            open={open} onClose={onClose} title="Projected revenue"
            subtitle={<><span className="font-semibold text-[var(--colors-text-primary)]">{aedFull(totalAed)}</span> across <span className="font-semibold text-[var(--colors-text-primary)]">{totalRows} session{totalRows === 1 ? "" : "s"}</span> · {rangeLabel}{typeNote(typeFilter)}</>}
            footer={<Pagination variant="compact" page={clampedPage} total={totalRows} pageSize={pageSize} onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />}
        >
            <div className="px-6">
                <table className="w-full border-collapse">
                    <thead><tr>
                        <th className={TH}><SortableHeader sortKey="session" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Session</SortableHeader></th>
                        <th className={TH}><SortableHeader sortKey="date" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Date</SortableHeader></th>
                        <th className={cn(TH, "!text-right")}><SortableHeader sortKey="booked" currentSort={sortKey} dir={sortDir} onSort={toggleSort} align="right">Booked</SortableHeader></th>
                        <th className={cn(TH, "!text-right")}><SortableHeader sortKey="revenue" currentSort={sortKey} dir={sortDir} onSort={toggleSort} align="right">Revenue</SortableHeader></th>
                    </tr></thead>
                    <tbody>
                        {paged.map(r => (
                            <tr key={r.session.id}
                                onClick={() => { onClose(); router.push(sessionHrefForType(r.session.type, r.session.id)); }}
                                className="hover:bg-[var(--colors-bg-secondary)]/50 transition-colors cursor-pointer">
                                <td className={TD}>
                                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-[20px]">{r.session.name}</p>
                                    <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px]">{TYPE_LABEL[r.session.type]} · {r.session.displayTime}</p>
                                </td>
                                <td className={cn(TD, "text-[14px] text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{r.session.dateISO.slice(0, 10)}</td>
                                <td className={cn(TD, "whitespace-nowrap tabular-nums", "text-right")}>{r.session.booked ?? 0}/{r.session.capacity ?? 0}</td>
                                <td className={cn(TD, "whitespace-nowrap font-medium text-[var(--colors-text-primary)]", "text-right")}>{aed(Math.round(r.revenueAed))}</td>
                            </tr>
                        ))}
                        {paged.length === 0 && <tr><td colSpan={4} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">No sessions in this window.</td></tr>}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

// ─── 2. Bookings ────────────────────────────────────────────────────────────

export function ComingBookingsModal({ open, onClose, rangeLabel, typeFilter, rows, customersById }: BaseProps & { rows: BookingDrillRow[]; customersById: Map<string, Customer> }) {
    const router = useRouter();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    const view = useMemo(() => rows.map(r => ({ row: r, person: personFor(r.customerId, customersById) })), [rows, customersById]);
    const { sorted, sortKey, sortDir, toggle: toggleSort } =
        useSort<(typeof view)[number]>(view, {
            customer: (a, b) => a.person.name.localeCompare(b.person.name),
            session:  (a, b) => a.row.sessionName.localeCompare(b.row.sessionName),
            date:     (a, b) => a.row.dateISO.localeCompare(b.row.dateISO),
        });
    const totalRows = sorted.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const paged = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return (
        <ModalShell
            open={open} onClose={onClose} title="Upcoming bookings"
            subtitle={<><span className="font-semibold text-[var(--colors-text-primary)]">{totalRows} booking{totalRows === 1 ? "" : "s"}</span> · {rangeLabel}{typeNote(typeFilter)}</>}
            footer={<Pagination variant="compact" page={clampedPage} total={totalRows} pageSize={pageSize} onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />}
        >
            <div className="px-6">
                <table className="w-full border-collapse">
                    <thead><tr>
                        <th className={TH}><SortableHeader sortKey="customer" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Customer</SortableHeader></th>
                        <th className={TH}><SortableHeader sortKey="session" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Session</SortableHeader></th>
                        <th className={TH}><SortableHeader sortKey="date" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Date</SortableHeader></th>
                        <th className={TH}>Time</th>
                    </tr></thead>
                    <tbody>
                        {paged.map(({ row: r, person }) => (
                            <tr key={r.key}
                                onClick={() => { onClose(); router.push(sessionHref(r.kind, r.sessionId)); }}
                                className="hover:bg-[var(--colors-bg-secondary)]/50 transition-colors cursor-pointer">
                                <td className={TD}><PersonCell {...person} /></td>
                                <td className={TD}>
                                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-[20px]">{r.sessionName}</p>
                                    <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px]">{TYPE_LABEL[r.type]}</p>
                                </td>
                                <td className={cn(TD, "text-[14px] text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{r.dateISO.slice(0, 10)}</td>
                                <td className={cn(TD, "text-[14px] text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{r.displayTime ?? "—"}</td>
                            </tr>
                        ))}
                        {paged.length === 0 && <tr><td colSpan={4} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">No bookings in this window.</td></tr>}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

// ─── 3 + 4. New / Returning customers ───────────────────────────────────────

function PersonListModal({ open, onClose, title, rangeLabel, typeFilter, noun, rows, customersById }: BaseProps & {
    title: string; noun: string; rows: PersonDrillRow[]; customersById: Map<string, Customer>;
}) {
    const router = useRouter();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    const view = useMemo(() => rows.map(r => ({ row: r, person: personFor(r.customerId, customersById) })), [rows, customersById]);
    const { sorted, sortKey, sortDir, toggle: toggleSort } =
        useSort<(typeof view)[number]>(view, {
            customer: (a, b) => a.person.name.localeCompare(b.person.name),
            session:  (a, b) => a.row.sessionName.localeCompare(b.row.sessionName),
            date:     (a, b) => a.row.dateISO.localeCompare(b.row.dateISO),
        });
    const totalRows = sorted.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const paged = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return (
        <ModalShell
            open={open} onClose={onClose} title={title}
            subtitle={<><span className="font-semibold text-[var(--colors-text-primary)]">{totalRows} {noun}{totalRows === 1 ? "" : "s"}</span> · {rangeLabel}{typeNote(typeFilter)}</>}
            footer={<Pagination variant="compact" page={clampedPage} total={totalRows} pageSize={pageSize} onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />}
        >
            <div className="px-6">
                <table className="w-full border-collapse">
                    <thead><tr>
                        <th className={TH}><SortableHeader sortKey="customer" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Customer</SortableHeader></th>
                        <th className={TH}><SortableHeader sortKey="session" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Session</SortableHeader></th>
                        <th className={TH}><SortableHeader sortKey="date" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Date</SortableHeader></th>
                    </tr></thead>
                    <tbody>
                        {paged.map(({ row: r, person }) => (
                            <tr key={`${r.customerId}-${r.type}`}
                                onClick={() => { onClose(); router.push(`/customers/${r.customerId}${RETURN_TO}`); }}
                                className="hover:bg-[var(--colors-bg-secondary)]/50 transition-colors cursor-pointer">
                                <td className={TD}><PersonCell {...person} /></td>
                                <td className={TD}>
                                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-[20px]">{r.sessionName}</p>
                                    <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px]">{TYPE_LABEL[r.type]}</p>
                                </td>
                                <td className={cn(TD, "text-[14px] text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{r.dateISO.slice(0, 10)}</td>
                            </tr>
                        ))}
                        {paged.length === 0 && <tr><td colSpan={3} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">No {noun}s in this window.</td></tr>}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

export function ComingNewCustomersModal(props: BaseProps & { rows: PersonDrillRow[]; customersById: Map<string, Customer> }) {
    return <PersonListModal {...props} title="New customers" noun="new customer" />;
}
export function ComingReturningModal(props: BaseProps & { rows: PersonDrillRow[]; customersById: Map<string, Customer> }) {
    return <PersonListModal {...props} title="Returning customers" noun="returning customer" />;
}

// ─── 5. Expiring plans ──────────────────────────────────────────────────────

export function ComingExpiringModal({ open, onClose, rangeLabel, typeFilter, rows, customersById }: BaseProps & { rows: ExpiringDrillRow[]; customersById: Map<string, Customer> }) {
    const router = useRouter();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    const view = useMemo(() => rows.map(r => ({ plan: r.plan, customer: r.plan.customerId ? customersById.get(r.plan.customerId) : undefined })), [rows, customersById]);
    const { sorted, sortKey, sortDir, toggle: toggleSort } =
        useSort<(typeof view)[number]>(view, {
            customer: (a, b) => `${a.customer?.firstName ?? ""} ${a.customer?.lastName ?? ""}`.localeCompare(`${b.customer?.firstName ?? ""} ${b.customer?.lastName ?? ""}`),
            plan:     (a, b) => (a.plan.name ?? "").localeCompare(b.plan.name ?? ""),
            expires:  (a, b) => (a.plan.expiryISO ?? "").localeCompare(b.plan.expiryISO ?? ""),
        });
    const totalRows = sorted.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const paged = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return (
        <ModalShell
            open={open} onClose={onClose} title="Expiring plans"
            subtitle={<><span className="font-semibold text-[var(--colors-text-primary)]">{totalRows} plan{totalRows === 1 ? "" : "s"}</span> expiring · {rangeLabel}{typeNote(typeFilter)}</>}
            footer={<Pagination variant="compact" page={clampedPage} total={totalRows} pageSize={pageSize} onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />}
        >
            <div className="px-6">
                <table className="w-full border-collapse">
                    <thead><tr>
                        <th className={TH}><SortableHeader sortKey="customer" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Customer</SortableHeader></th>
                        <th className={TH}><SortableHeader sortKey="plan" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Plan</SortableHeader></th>
                        <th className={TH}><SortableHeader sortKey="expires" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Expires</SortableHeader></th>
                    </tr></thead>
                    <tbody>
                        {paged.map(({ plan, customer }) => (
                            <tr key={plan.id}
                                onClick={customer ? () => { onClose(); router.push(`/customers/${customer.id}${RETURN_TO}`); } : undefined}
                                className={cn("transition-colors", customer && "hover:bg-[var(--colors-bg-secondary)]/50 cursor-pointer")}>
                                <td className={TD}>{customer ? <CustomerCell c={customer} /> : <PersonCell name="Customer" initials="—" />}</td>
                                <td className={TD}>
                                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-[20px]">{plan.name ?? "Plan"}</p>
                                    <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px] capitalize">{plan.kind}</p>
                                </td>
                                <td className={cn(TD, "text-[14px] text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{fmtDate(plan.expiryISO)}</td>
                            </tr>
                        ))}
                        {paged.length === 0 && <tr><td colSpan={3} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">No plans expiring in this window.</td></tr>}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

// ─── 6. Capacity used ───────────────────────────────────────────────────────

export function ComingCapacityModal({ open, onClose, rangeLabel, typeFilter, sessions }: BaseProps & { sessions: ClassInstance[] }) {
    const router = useRouter();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    const view = useMemo(() => sessions.map(s => {
        const cap = s.capacity ?? 0;
        const booked = s.booked ?? 0;
        return { session: s, fill: cap > 0 ? Math.round((booked / cap) * 100) : 0 };
    }), [sessions]);
    const { sorted, sortKey, sortDir, toggle: toggleSort } =
        useSort<(typeof view)[number]>(view, {
            session: (a, b) => a.session.name.localeCompare(b.session.name),
            date:    (a, b) => a.session.dateISO.localeCompare(b.session.dateISO),
            fill:    (a, b) => a.fill - b.fill,
        });
    const totalRows = sorted.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const avgFill = useMemo(() => {
        const cap = sessions.reduce((n, s) => n + (s.capacity ?? 0), 0);
        const book = sessions.reduce((n, s) => n + (s.booked ?? 0), 0);
        return cap > 0 ? Math.round((book / cap) * 100) : 0;
    }, [sessions]);
    const paged = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return (
        <ModalShell
            open={open} onClose={onClose} title="Capacity used"
            subtitle={<><span className="font-semibold text-[var(--colors-text-primary)]">{avgFill}% filled</span> across <span className="font-semibold text-[var(--colors-text-primary)]">{totalRows} session{totalRows === 1 ? "" : "s"}</span> · {rangeLabel}{typeNote(typeFilter)}</>}
            footer={<Pagination variant="compact" page={clampedPage} total={totalRows} pageSize={pageSize} onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />}
        >
            <div className="px-6">
                <table className="w-full border-collapse">
                    <thead><tr>
                        <th className={TH}><SortableHeader sortKey="session" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Session</SortableHeader></th>
                        <th className={TH}><SortableHeader sortKey="date" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Date</SortableHeader></th>
                        <th className={cn(TH, "!text-right")}>Booked</th>
                        <th className={cn(TH, "!text-right")}><SortableHeader sortKey="fill" currentSort={sortKey} dir={sortDir} onSort={toggleSort} align="right">Fill</SortableHeader></th>
                    </tr></thead>
                    <tbody>
                        {paged.map(({ session: s, fill }) => (
                            <tr key={s.id}
                                onClick={() => { onClose(); router.push(sessionHrefForType(s.type, s.id)); }}
                                className="hover:bg-[var(--colors-bg-secondary)]/50 transition-colors cursor-pointer">
                                <td className={TD}>
                                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-[20px]">{s.name}</p>
                                    <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px]">{TYPE_LABEL[s.type]} · {s.displayTime}</p>
                                </td>
                                <td className={cn(TD, "text-[14px] text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{s.dateISO.slice(0, 10)}</td>
                                <td className={cn(TD, "whitespace-nowrap tabular-nums", "text-right")}>{s.booked ?? 0}/{s.capacity ?? 0}</td>
                                <td className={cn(TD, "whitespace-nowrap font-medium", fill < 50 ? "text-[#b54708]" : "text-[var(--colors-text-primary)]", "text-right")}>{fill}%</td>
                            </tr>
                        ))}
                        {paged.length === 0 && <tr><td colSpan={4} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">No sessions in this window.</td></tr>}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

// ─── 7. Top services (recovery) ─────────────────────────────────────────────

export function ComingTopServicesModal({ open, onClose, rangeLabel, typeFilter, services }: BaseProps & { services: { name: string; count: number }[] }) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    const { sorted, sortKey, sortDir, toggle: toggleSort } =
        useSort<{ name: string; count: number }>(services, {
            service: (a, b) => a.name.localeCompare(b.name),
            count:   (a, b) => a.count - b.count,
        });
    const totalRows = sorted.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const totalBookings = useMemo(() => services.reduce((n, s) => n + s.count, 0), [services]);
    const paged = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return (
        <ModalShell
            open={open} onClose={onClose} title="Top services"
            subtitle={<><span className="font-semibold text-[var(--colors-text-primary)]">{totalRows} service{totalRows === 1 ? "" : "s"}</span> · <span className="font-semibold text-[var(--colors-text-primary)]">{totalBookings} booking{totalBookings === 1 ? "" : "s"}</span> · {rangeLabel}{typeNote(typeFilter)}</>}
            footer={<Pagination variant="compact" page={clampedPage} total={totalRows} pageSize={pageSize} onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />}
        >
            <div className="px-6">
                <table className="w-full border-collapse">
                    <thead><tr>
                        <th className={TH}><SortableHeader sortKey="service" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Service</SortableHeader></th>
                        <th className={cn(TH, "!text-right")}><SortableHeader sortKey="count" currentSort={sortKey} dir={sortDir} onSort={toggleSort} align="right">Bookings</SortableHeader></th>
                    </tr></thead>
                    <tbody>
                        {paged.map(s => (
                            <tr key={s.name} className="transition-colors">
                                <td className={TD}>
                                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-[20px]">{s.name}</p>
                                </td>
                                <td className={cn(TD, "whitespace-nowrap tabular-nums font-medium text-[var(--colors-text-primary)]", "text-right")}>{s.count}</td>
                            </tr>
                        ))}
                        {paged.length === 0 && <tr><td colSpan={2} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">No recovery bookings in this window.</td></tr>}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}
