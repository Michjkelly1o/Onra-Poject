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
// Pure view: the dashboard owns the period + instructor scoping and
// hands the pre-filtered (customers × bookings) data via props.

import { useMemo, useState } from "react";
import { X, ArrowUp, ArrowDown, ChevronSelectorVertical } from "@untitledui/icons";
import { useAppStore, type ClassBooking, type ClassSchedule, type Customer } from "@/lib/store";
import { cn } from "@/lib/utils";

interface ClientsModalProps {
    open: boolean;
    onClose: () => void;
    /** Period-scoped, instructor-scoped class list. */
    classes: ClassSchedule[];
    /** Period-scoped bookings for those classes. */
    bookings: ClassBooking[];
}

type SortKey = "name" | "visits" | "lastVisit";
type SortDir = "asc" | "desc";

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
                    color: "#aad4bd",
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
    }

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c111d]/70 p-4"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="clients-modal-title"
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-[16px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] w-full max-w-[760px] h-[600px] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="shrink-0 flex items-start gap-4 pt-6 px-6 pb-5">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <h2 id="clients-modal-title" className="text-[18px] font-semibold text-[#101828] leading-7">
                            Clients taught
                        </h2>
                        <p className="text-sm font-normal text-[#475467] leading-5">
                            Every client who booked one of your classes in the active period.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="shrink-0 w-10 h-10 -mr-2 -mt-2 flex items-center justify-center rounded-full text-[#98a2b3] hover:text-[#101828] hover:bg-[#f9fafb] transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="shrink-0 px-6 pb-4">
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search name or email..."
                        className="w-full h-10 px-3 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-sm text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>

                {/* Table */}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
                    {/* Header row */}
                    <div className="grid grid-cols-[1.6fr_100px_120px] gap-4 items-center pb-3 border-b-1 border-[#e4e7ec] sticky top-0 bg-white z-10">
                        <SortableHeader label="Client"      sortKey="name"      activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Visits"      sortKey="visits"    activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        <SortableHeader label="Last visit"  sortKey="lastVisit" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    </div>

                    {/* Body */}
                    {sortedRows.length === 0 ? (
                        <div className="h-full min-h-[280px] flex items-center justify-center text-sm text-[#667085]">
                            {search ? "No clients match your search." : "No clients in this period."}
                        </div>
                    ) : (
                        sortedRows.map(r => (
                            <div key={r.customerId} className="grid grid-cols-[1.6fr_100px_120px] gap-4 items-center py-3 border-b-1 border-[#f2f4f7] last:border-b-0">
                                {/* Client cell */}
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
                                        <p className="text-sm font-medium text-[#101828] leading-5 truncate">{r.name}</p>
                                        <p className="text-sm font-normal text-[#475467] leading-5 truncate">{r.email}</p>
                                    </div>
                                </div>
                                {/* Visits */}
                                <div className="text-sm font-medium text-[#101828] leading-5">
                                    {r.visits} <span className="text-xs font-normal text-[#667085]">/ {r.bookings} booked</span>
                                </div>
                                {/* Last visit */}
                                <div className="text-sm font-normal text-[#475467] leading-5">
                                    {r.lastVisitISO ? formatDate(r.lastVisitISO) : "—"}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Atoms ──────────────────────────────────────────────────────────────────

interface SortableHeaderProps {
    label: string;
    sortKey?: SortKey;
    activeSortKey?: SortKey;
    sortDir?: SortDir;
    onSort?: (key: SortKey) => void;
}
function SortableHeader({ label, sortKey, activeSortKey, sortDir, onSort }: SortableHeaderProps) {
    if (!sortKey || !onSort) {
        return <div className="text-sm font-normal text-[#475467] leading-5">{label}</div>;
    }
    const isActive = activeSortKey === sortKey;
    const Icon = !isActive ? ChevronSelectorVertical : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
        <button
            type="button"
            onClick={() => onSort(sortKey)}
            className="text-left text-sm font-normal text-[#475467] leading-5 hover:text-[#101828] transition-colors inline-flex items-center gap-1 select-none"
        >
            <span>{label}</span>
            <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-[#475467]" : "text-[#98a2b3]")} />
        </button>
    );
}

function formatDate(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
