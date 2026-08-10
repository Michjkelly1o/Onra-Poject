"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor dashboard "Clients taught" KPI modal
// ─────────────────────────────────────────────────────────────────────────────
//
// Opens when the instructor clicks the "Clients taught" metric card.
// Lists every unique customer whose bookings sit on a class the
// instructor taught in the active period, with their visit count + last
// visit date.
//
// Read-only — instructor doesn't have access to customer profile pages,
// so rows are info-only (no navigation). Sortable on Name / Visits /
// Last visit.
//
// Uses the SAME drill-down chrome as the admin dashboard modals: shared
// `ModalShell` (title + aggregate subtitle + paginated footer) and the
// shared `<table>` + `TABLE_TH/TD` + `Pagination` primitives, so the
// instructor modals look identical to admin's.
//
// Pure view: the dashboard owns the period + instructor scoping and
// hands the pre-filtered (customers × bookings) data via props.

import { useMemo, useState } from "react";
import { useAppStore, type ClassBooking, type ClassSchedule, type Customer } from "@/lib/store";
import { cn } from "@/lib/utils";
import { SortableHeader, type SortDir } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { TABLE_TH, TABLE_TD } from "@/lib/table-styles";
import { ModalShell } from "@/components/dashboard/NeedsAttentionModals";

interface ClientsModalProps {
    open: boolean;
    onClose: () => void;
    /** Period-scoped, instructor-scoped class list. */
    classes: ClassSchedule[];
    /** Period-scoped bookings for those classes. */
    bookings: ClassBooking[];
}

type SortKey = "name" | "visits" | "lastVisit";
// SortDir comes from the canonical SortableHeader import above.

interface ClientRow {
    customerId: string;
    name: string;
    email: string;
    imageUrl?: string;
    initials: string;
    color: string;
    /** Number of bookings (any status) the client has on this
     *  instructor's classes in the period. */
    bookings: number;
    /** Number of present attendances — what we surface as "Visits". */
    visits: number;
    /** ISO date of the most recent class the client attended. */
    lastVisitISO: string;
}

export function ClientsModal({ open, onClose, classes, bookings }: ClientsModalProps) {
    const customers = useAppStore(s => s.customers);
    const [sortKey, setSortKey] = useState<SortKey>("visits");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [search,  setSearch]  = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const rows = useMemo<ClientRow[]>(() => {
        const customerById = new Map<string, Customer>(customers.map(c => [c.id, c]));
        const classById    = new Map<string, ClassSchedule>(classes.map(c => [c.id, c]));

        // Aggregate per-customer counts + max date
        const agg = new Map<string, { bookings: number; visits: number; lastVisitISO: string }>();
        for (const b of bookings) {
            const klass = classById.get(b.classScheduleId);
            if (!klass) continue;
            const current = agg.get(b.customerId) ?? { bookings: 0, visits: 0, lastVisitISO: "" };
            current.bookings += 1;
            if (b.attendanceStatus === "present") {
                current.visits += 1;
                if (klass.dateISO > current.lastVisitISO) current.lastVisitISO = klass.dateISO;
            }
            agg.set(b.customerId, current);
        }

        return Array.from(agg.entries())
            .map<ClientRow | null>(([customerId, stats]) => {
                const c = customerById.get(customerId);
                if (!c) return null;
                return {
                    customerId,
                    name: `${c.firstName} ${c.lastName}`.trim(),
                    email: c.email,
                    imageUrl: c.imageUrl,
                    initials: c.initials,
                    color: "#94aeaf",
                    bookings: stats.bookings,
                    visits:   stats.visits,
                    lastVisitISO: stats.lastVisitISO,
                };
            })
            .filter((r): r is ClientRow => r !== null);
    }, [classes, bookings, customers]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(r =>
            r.name.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q),
        );
    }, [rows, search]);

    const sortedRows = useMemo(() => {
        const copy = [...filteredRows];
        const cmp = (a: ClientRow, b: ClientRow): number => {
            switch (sortKey) {
                case "name":      return a.name.localeCompare(b.name);
                case "visits":    return a.visits - b.visits;
                case "lastVisit": return a.lastVisitISO.localeCompare(b.lastVisitISO);
            }
        };
        copy.sort((a, b) => sortDir === "asc" ? cmp(a, b) : cmp(b, a));
        return copy;
    }, [filteredRows, sortKey, sortDir]);

    function handleSort(key: SortKey) {
        if (sortKey === key) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir(key === "name" ? "asc" : "desc");
        }
        setPage(1);
    }

    const totalRows = sortedRows.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const paged = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    const strong = "font-semibold text-[var(--colors-text-primary)]";

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            width={760}
            title="Clients taught"
            subtitle={
                <>
                    <span className={strong}>{rows.length}</span> client{rows.length === 1 ? "" : "s"} booked one of your classes in the active period.
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
                {/* Search */}
                <div className="pb-4">
                    <input
                        type="text"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search name or email..."
                        className="w-full h-10 px-3 bg-white border-1 border-[var(--colors-border-primary)] rounded-[8px] text-sm text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--colors-secondary-300)] focus:border-[var(--colors-secondary-500)] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>

                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={TABLE_TH}><SortableHeader sortKey="name"      currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)}>Client</SortableHeader></th>
                            <th className={TABLE_TH}><SortableHeader sortKey="visits"    currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)}>Visits</SortableHeader></th>
                            <th className={TABLE_TH}><SortableHeader sortKey="lastVisit" currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)}>Last visit</SortableHeader></th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(r => (
                            <tr key={r.customerId} className="transition-colors">
                                <td className={TABLE_TD}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        {r.imageUrl ? (
                                            <img src={r.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                                        ) : (
                                            <div
                                                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-semibold"
                                                style={{ backgroundColor: r.color }}
                                            >
                                                {r.initials}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-[var(--colors-text-primary)] leading-5 truncate">{r.name}</p>
                                            <p className="text-sm font-normal text-[var(--colors-text-tertiary)] leading-5 truncate">{r.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className={cn(TABLE_TD, "font-medium text-[var(--colors-text-primary)]")}>
                                    {r.visits} <span className="text-xs font-normal text-[var(--colors-text-quaternary)]">/ {r.bookings} booked</span>
                                </td>
                                <td className={cn(TABLE_TD, "whitespace-nowrap text-[var(--colors-text-tertiary)]")}>
                                    {r.lastVisitISO ? formatDate(r.lastVisitISO) : "—"}
                                </td>
                            </tr>
                        ))}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={3} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">
                                    {search ? "No clients match your search." : "No clients in this period."}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

// ─── Atoms ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
