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
// Pure view: the dashboard owns the period-filter + instructor-scope
// math and hands the pre-filtered class list in via props. Same pattern
// as `CancellationsModal`.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowUp, ArrowDown, ChevronSelectorVertical } from "@untitledui/icons";
import { isAppointmentId, type ClassSchedule } from "@/lib/store";
import { cn } from "@/lib/utils";

interface ClassesModalProps {
    open: boolean;
    onClose: () => void;
    /** Period-scoped, instructor-scoped class list. Sorted by date ASC
     *  on entry — the modal applies its own sort state on top. */
    classes: ClassSchedule[];
}

type SortKey = "date" | "status" | "booked";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<ClassSchedule["status"], number> = {
    Upcoming: 0, Ongoing: 1, Completed: 2, Cancelled: 3,
};

const STATUS_STYLES: Record<ClassSchedule["status"], string> = {
    Upcoming: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    Ongoing:  "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    Completed:"bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    Cancelled:"bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
};

export function ClassesModal({ open, onClose, classes }: ClassesModalProps) {
    const router = useRouter();
    const [sortKey, setSortKey] = useState<SortKey>("date");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

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
    }

    function handleRowClick(c: ClassSchedule) {
        // Mirrors the dashboard upcoming-card branching: appointments
        // never appear in `classes` (they're a separate slice), so we
        // branch on class status only — Completed/Cancelled go to the
        // earnings takeover, the rest go to the class detail page.
        const base = isAppointmentId(c.id)
            ? `/appointments/${c.id}`
            : (c.status === "Completed" || c.status === "Cancelled")
                ? `/earnings/${c.id}`
                : `/class/${c.id}`;
        const qs = new URLSearchParams({ returnTo: "/instructor/dashboard" }).toString();
        onClose();
        router.push(`${base}?${qs}`);
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
                aria-labelledby="classes-modal-title"
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-[16px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] w-full max-w-[720px] h-[560px] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="shrink-0 flex items-start gap-4 pt-6 px-6 pb-5">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <h2 id="classes-modal-title" className="text-[18px] font-semibold text-[#101828] leading-7">
                            Classes
                        </h2>
                        <p className="text-sm font-normal text-[#475467] leading-5">
                            Every class you taught or have scheduled in the active period.
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

                {/* Table */}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
                    {/* Header row */}
                    <div className="grid grid-cols-[1.6fr_1fr_120px_100px] gap-4 items-center pb-3 border-b-1 border-[#e4e7ec] sticky top-0 bg-white z-10">
                        <SortableHeader label="Class" />
                        <SortableHeader
                            label="Date"
                            sortKey="date"
                            activeSortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                        />
                        <SortableHeader
                            label="Status"
                            sortKey="status"
                            activeSortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                        />
                        <SortableHeader
                            label="Booked"
                            sortKey="booked"
                            activeSortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                        />
                    </div>

                    {/* Body */}
                    {sortedClasses.length === 0 ? (
                        <div className="h-full min-h-[280px] flex items-center justify-center text-sm text-[#667085]">
                            No classes in this period.
                        </div>
                    ) : (
                        sortedClasses.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => handleRowClick(c)}
                                className="w-full grid grid-cols-[1.6fr_1fr_120px_100px] gap-4 items-center py-3 border-b-1 border-[#f2f4f7] last:border-b-0 hover:bg-[#f9fafb] transition-colors text-left cursor-pointer"
                            >
                                {/* Class name + time */}
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-[#101828] leading-5 truncate">{c.name}</p>
                                    <p className="text-sm font-normal text-[#475467] leading-5 truncate">{c.displayTime}</p>
                                </div>
                                {/* Date */}
                                <div className="text-sm font-normal text-[#475467] leading-5 truncate">
                                    {formatDate(c.dateISO)}
                                </div>
                                {/* Status */}
                                <div>
                                    <span className={cn(
                                        "inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap",
                                        STATUS_STYLES[c.status],
                                    )}>
                                        {c.status}
                                    </span>
                                </div>
                                {/* Booked */}
                                <div className="text-sm font-medium text-[#101828] leading-5">
                                    {c.booked} / {c.capacity}
                                </div>
                            </button>
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
    /** When omitted the header is non-interactive (e.g. "Class" column). */
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
