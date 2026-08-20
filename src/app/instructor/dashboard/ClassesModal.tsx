"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor dashboard "Classes" KPI modal
// ─────────────────────────────────────────────────────────────────────────────
//
// Opens when the instructor clicks the "Classes" metric card on the
// dashboard. Lists every class the instructor taught (or has scheduled)
// in the active period filter, sortable by Date / Status / Booked.
//
// Rows are clickable — clicking navigates to the instructor-scope class
// detail page (`/class/[id]` for Upcoming/Ongoing, `/earnings/[id]` for
// Completed/Cancelled), preserving the dashboard returnTo so the X-close
// bounces back here.
//
// Uses the SAME drill-down chrome as the admin dashboard modals: shared
// `ModalShell` (title + aggregate subtitle + paginated footer) and the
// shared `<table>` + `TABLE_TH/TD` + `Pagination` primitives, so the
// instructor modals look identical to admin's.
//
// Pure view: the dashboard owns the period-filter + instructor-scope
// math and hands the pre-filtered class list in via props. Same pattern
// as `CancellationsModal`.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isAppointmentId, type ClassSchedule } from "@/lib/store";
import { cn } from "@/lib/utils";
import { SortableHeader, type SortDir } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { TABLE_TH, TABLE_TD } from "@/lib/table-styles";
import { ModalShell } from "@/components/dashboard/NeedsAttentionModals";

interface ClassesModalProps {
    open: boolean;
    onClose: () => void;
    /** Period-scoped, instructor-scoped class list. Sorted by date ASC
     *  on entry — the modal applies its own sort state on top. */
    classes: ClassSchedule[];
}

type SortKey = "date" | "status" | "booked";
// SortDir is re-imported from @/components/ui/SortableHeader so the
// canonical hook + this modal agree on the union.

const STATUS_ORDER: Record<ClassSchedule["status"], number> = {
    Upcoming: 0, Ongoing: 1, Completed: 2, Cancelled: 3,
};

const STATUS_STYLES: Record<ClassSchedule["status"], string> = {
    Upcoming: "bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)]",
    Ongoing:  "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    Completed:"bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
    Cancelled:"bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
};

export function ClassesModal({ open, onClose, classes }: ClassesModalProps) {
    const router = useRouter();
    const [sortKey, setSortKey] = useState<SortKey>("date");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const sortedClasses = useMemo(() => {
        const copy = [...classes];
        const cmp = (a: ClassSchedule, b: ClassSchedule): number => {
            if (sortKey === "date") {
                return (a.dateISO + a.startTime).localeCompare(b.dateISO + b.startTime);
            }
            if (sortKey === "status") {
                return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
            }
            // booked
            return a.booked - b.booked;
        };
        copy.sort((a, b) => sortDir === "asc" ? cmp(a, b) : cmp(b, a));
        return copy;
    }, [classes, sortKey, sortDir]);

    function handleSort(key: SortKey) {
        if (sortKey === key) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir(key === "date" ? "desc" : "asc");
        }
        setPage(1);
    }

    function handleRowClick(c: ClassSchedule) {
        // Mirrors the dashboard upcoming-card branching: appointments
        // never appear in `classes` (they're a separate slice), so we
        // branch on class status only — Completed/Cancelled go to the
        // earnings takeover, the rest go to the class detail page.
        const base = isAppointmentId(c.id)
            ? `/appointments/${c.id}`
            : (c.status === "Completed" || c.status === "Cancelled")
                ? `/instructor/earnings/${c.id}`
                : `/instructor/class/${c.id}`;
        const qs = new URLSearchParams({ returnTo: "/instructor/dashboard" }).toString();
        onClose();
        router.push(`${base}?${qs}`);
    }

    const totalRows = sortedClasses.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const paged = sortedClasses.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    const strong = "font-semibold text-[var(--colors-text-primary)]";

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            width={720}
            title="Classes"
            subtitle={
                <>
                    <span className={strong}>{totalRows}</span> class{totalRows === 1 ? "" : "es"} taught or scheduled in the active period.
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
                            <th className={TABLE_TH}>Class</th>
                            <th className={TABLE_TH}><SortableHeader sortKey="date"   currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)}>Date</SortableHeader></th>
                            <th className={TABLE_TH}><SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)}>Status</SortableHeader></th>
                            <th className={cn(TABLE_TH, "!text-right")}><SortableHeader sortKey="booked" currentSort={sortKey} dir={sortDir} onSort={(k) => handleSort(k as SortKey)} align="right">Booked</SortableHeader></th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(c => (
                            <tr
                                key={c.id}
                                onClick={() => handleRowClick(c)}
                                className="transition-colors hover:bg-[var(--colors-bg-secondary)]/50 cursor-pointer"
                            >
                                <td className={TABLE_TD}>
                                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-5 truncate">{c.name}</p>
                                    <p className="text-[14px] font-normal text-[var(--colors-text-tertiary)] leading-5 truncate">{c.displayTime}</p>
                                </td>
                                <td className={cn(TABLE_TD, "whitespace-nowrap text-[var(--colors-text-tertiary)]")}>{formatDate(c.dateISO)}</td>
                                <td className={TABLE_TD}>
                                    <span className={cn(
                                        "inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap",
                                        STATUS_STYLES[c.status],
                                    )}>
                                        {c.status}
                                    </span>
                                </td>
                                <td className={cn(TABLE_TD, "font-medium text-[var(--colors-text-primary)] text-right")}>{c.booked} / {c.capacity}</td>
                            </tr>
                        ))}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">
                                    No classes in this period.
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
